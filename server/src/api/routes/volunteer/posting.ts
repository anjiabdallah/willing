import { Router, type Response } from 'express';
import { sql, type Kysely } from 'kysely';
import zod from 'zod';

import { type VolunteerEnrollmentsResponse, type VolunteerPostingEnrollResponse, type VolunteerPostingResponse, type VolunteerPostingSearchResponse, type VolunteerPostingWithdrawResponse } from './posting.types.ts';
import { buildPostingsWithContext, isVolunteerPostingFull, postingWithContextSelectColumns } from './postingWithContext.ts';
import authorizeOnly from '../../../auth/authorizeOnly.ts';
import executeTransaction from '../../../db/executeTransaction.ts';
import { type Database, type Enrollment, type EnrollmentApplication } from '../../../db/tables/index.ts';
import { recomputePostingContextVectorOnly, recomputeVolunteerExperienceVector } from '../../../services/embeddings/updates.ts';
import { type PostingWithContext } from '../../../types.ts';
import {
  parseListQuery,
  parseOptionalBooleanQueryParam,
  parseOptionalNumberQueryParam,
} from '../utils/listQuery.ts';
import {
  applyPostingDateTimeFilters,
  applySharedPostingSort,
  matchesPostingDateTimeFilters,
  matchesPostingSearch,
  normalizeSearchTerms,
  parsePostingDateTimeFilters,
  sortPostingsBySharedSort,
} from '../utils/postingList.ts';

const postingIdParamsSchema = zod.object({
  id: zod.coerce.number().int().positive('ID must be a positive number'),
});

const applyBodySchema = zod.object({
  message: zod.string().trim().min(1, 'Message cannot be empty').optional(),
  dates: zod.array(zod.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')).optional(),
});

function formatDateToIso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function normalizeStoredDate(value: Date | string | null | undefined): string | undefined {
  if (value instanceof Date) {
    return formatDateToIso(value);
  }

  if (typeof value === 'string') {
    const datePart = value.split('T')[0]?.trim();
    return datePart || undefined;
  }

  return undefined;
}

function dateColumnAsIsoSql(columnName: string) {
  return sql<string>`to_char(${sql.ref(columnName)}, 'YYYY-MM-DD')`;
}

function toUtcDateOnly(isoDate: string) {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

function parseIsoDateParts(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function getPostingDates(startDate: Date | string, endDate: Date | string): string[] {
  const normalizedStartDate = normalizeStoredDate(startDate);
  const normalizedEndDate = normalizeStoredDate(endDate);
  const startParts = normalizedStartDate ? parseIsoDateParts(normalizedStartDate) : undefined;
  const endParts = normalizedEndDate ? parseIsoDateParts(normalizedEndDate) : undefined;

  if (!startParts || !endParts) {
    return [];
  }

  const result: string[] = [];
  const current = new Date(startParts.year, startParts.month - 1, startParts.day);
  const end = new Date(endParts.year, endParts.month - 1, endParts.day);

  while (current.getTime() <= end.getTime()) {
    result.push(formatDateToIso(current));
    current.setDate(current.getDate() + 1);
  }

  return result;
}

async function getFullSelectedDates(
  trx: Kysely<Database>,
  postingId: number,
  selectedDates: string[],
  maxVolunteers: number | null | undefined,
) {
  if (maxVolunteers == null || selectedDates.length === 0) {
    return [];
  }

  const enrollmentCounts = await trx
    .selectFrom('enrollment_date')
    .select([
      dateColumnAsIsoSql('enrollment_date.date').as('date'),
      sql<number>`count(*)`.as('count'),
    ])
    .where('posting_id', '=', postingId)
    .where('enrollment_date.date', 'in', selectedDates.map(date => toUtcDateOnly(date)))
    .groupBy('enrollment_date.date')
    .execute();

  const applicationCounts = await trx
    .selectFrom('enrollment_application_date')
    .innerJoin('enrollment_application', 'enrollment_application.id', 'enrollment_application_date.application_id')
    .select([
      dateColumnAsIsoSql('enrollment_application_date.date').as('date'),
      sql<number>`count(*)`.as('count'),
    ])
    .where('enrollment_application.posting_id', '=', postingId)
    .where('enrollment_application_date.date', 'in', selectedDates.map(date => toUtcDateOnly(date)))
    .groupBy('enrollment_application_date.date')
    .execute();

  const countsByDate = [...enrollmentCounts, ...applicationCounts]
    .map((row) => {
      const normalizedDate = normalizeStoredDate(row.date);
      return normalizedDate ? [normalizedDate, Number(row.count)] as const : undefined;
    })
    .filter((entry): entry is readonly [string, number] => Boolean(entry))
    .reduce<Record<string, number>>((acc, [date, count]) => {
      acc[date] = (acc[date] ?? 0) + count;
      return acc;
    }, {});

  return Object.entries(countsByDate)
    .filter(([, count]) => count >= maxVolunteers)
    .map(([date]) => date);
}

function calculateAge(dateOfBirth: string, at: Date = new Date()): number | null {
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) {
    return null;
  }

  let age = at.getUTCFullYear() - dob.getUTCFullYear();
  const monthDiff = at.getUTCMonth() - dob.getUTCMonth();
  const dayDiff = at.getUTCDate() - dob.getUTCDate();

  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }

  return age;
}

function createVolunteerPostingRouter(db: Kysely<Database>) {
  const volunteerPostingRouter = Router();

  volunteerPostingRouter.use(authorizeOnly('volunteer'));

  volunteerPostingRouter.get('/', async (req, res: Response<VolunteerPostingSearchResponse>) => {
    const volunteerId = req.userJWT!.id;
    const { location_name, skill } = req.query;
    const dateTimeFilters = parsePostingDateTimeFilters(req.query);
    const hideFull = parseOptionalBooleanQueryParam(req.query.hide_full) ?? false;
    const includeApplied = parseOptionalBooleanQueryParam(req.query.include_applied) ?? false;
    const crisisIdFilter = parseOptionalNumberQueryParam(req.query.crisis_id);
    const postingFilter = typeof req.query.posting_filter === 'string' ? req.query.posting_filter : 'all';
    const { search, sortBy, sortDir } = parseListQuery(req.query, {
      allowedSortBy: ['recommended', 'start_date', 'created_at', 'title'],
      defaultSortBy: 'recommended',
      defaultSortDir: 'desc',
    });
    const skillFilter = typeof skill === 'string' ? skill.trim() : '';

    const volunteerVectors = await db
      .selectFrom('volunteer_account')
      .select(['volunteer_context_vector'])
      .where('id', '=', volunteerId)
      .executeTakeFirstOrThrow();

    const volunteerContextVectorLiteral = volunteerVectors.volunteer_context_vector;
    const hasVolunteerContextVector = Boolean(volunteerContextVectorLiteral);

    let query = db
      .selectFrom('organization_posting')
      .innerJoin('organization_account', 'organization_account.id', 'organization_posting.organization_id')
      .leftJoin('crisis', 'crisis.id', 'organization_posting.crisis_id')
      .select(postingWithContextSelectColumns)
      .where('organization_posting.is_closed', '=', false);

    if (!includeApplied) {
      query = query.where(({ not, exists, selectFrom, or }) => not(or([
        exists(
          selectFrom('enrollment')
            .select('enrollment.id')
            .whereRef('enrollment.posting_id', '=', 'organization_posting.id')
            .where('enrollment.volunteer_id', '=', volunteerId),
        ),
        exists(
          selectFrom('enrollment_application')
            .select('enrollment_application.id')
            .whereRef('enrollment_application.posting_id', '=', 'organization_posting.id')
            .where('enrollment_application.volunteer_id', '=', volunteerId),
        ),
      ])));
    }

    if (skillFilter) {
      query = query.where(({ exists, selectFrom }) => exists(
        selectFrom('posting_skill')
          .select('posting_skill.id')
          .whereRef('posting_skill.posting_id', '=', 'organization_posting.id')
          .where('posting_skill.name', 'ilike', `%${skillFilter}%`),
      ));
    }

    if (location_name) {
      query = query.where('organization_posting.location_name', 'ilike', `%${location_name}%`);
    }

    if (crisisIdFilter !== undefined) {
      query = query.where('organization_posting.crisis_id', '=', crisisIdFilter);
    }

    if (postingFilter === 'open') {
      query = query.where('organization_posting.automatic_acceptance', '=', true);
    } else if (postingFilter === 'review') {
      query = query.where('organization_posting.automatic_acceptance', '=', false);
    } else if (postingFilter === 'partial') {
      query = query.where('organization_posting.allows_partial_attendance', '=', true);
    } else if (postingFilter === 'full') {
      query = query.where('organization_posting.allows_partial_attendance', '=', false);
    } else if (postingFilter === 'tagged') {
      query = query.where('organization_posting.crisis_id', 'is not', null);
    } else if (postingFilter === 'untagged') {
      query = query.where('organization_posting.crisis_id', 'is', null);
    }

    if (search) {
      const terms = normalizeSearchTerms(search);
      query = query.where(({ and, exists, selectFrom, or }) => and(
        terms.map((term) => {
          const likePattern = `%${term}%`;

          return or([
            sql<boolean>`lower(organization_posting.title) LIKE ${likePattern}`,
            sql<boolean>`regexp_replace(lower(organization_posting.title), '[^a-z0-9]+', '', 'g') LIKE ${likePattern}`,
            sql<boolean>`lower(organization_posting.description) LIKE ${likePattern}`,
            sql<boolean>`regexp_replace(lower(organization_posting.description), '[^a-z0-9]+', '', 'g') LIKE ${likePattern}`,
            sql<boolean>`lower(organization_posting.location_name) LIKE ${likePattern}`,
            sql<boolean>`regexp_replace(lower(organization_posting.location_name), '[^a-z0-9]+', '', 'g') LIKE ${likePattern}`,
            sql<boolean>`lower(organization_account.name) LIKE ${likePattern}`,
            sql<boolean>`regexp_replace(lower(organization_account.name), '[^a-z0-9]+', '', 'g') LIKE ${likePattern}`,
            exists(
              selectFrom('posting_skill')
                .select('posting_skill.id')
                .whereRef('posting_skill.posting_id', '=', 'organization_posting.id')
                .where(sql<boolean>`lower(posting_skill.name) LIKE ${likePattern}`),
            ),
          ]);
        }),
      ));

      const normalizedSearch = search.toLowerCase();
      const titleRelevance = sql<number>`
      CASE
        WHEN lower(organization_posting.title) = ${normalizedSearch} THEN 3
        WHEN lower(organization_posting.title) LIKE ${`${normalizedSearch}%`} THEN 2
        WHEN lower(organization_posting.title) LIKE ${`%${normalizedSearch}%`} THEN 1
        ELSE 0
      END
    `;
      query = query.orderBy(sql`${titleRelevance} desc`);
    }

    query = applyPostingDateTimeFilters(query, dateTimeFilters);

    if (sortBy === 'recommended' && hasVolunteerContextVector && volunteerContextVectorLiteral) {
      const profileSimilarity = sql<number>`
      1 - (organization_posting.posting_context_vector <=> ${volunteerContextVectorLiteral}::vector)
    `;
      query = query.orderBy(sql`${profileSimilarity} desc nulls last`);

      query = query.orderBy('organization_posting.start_date', sortDir).orderBy('organization_posting.start_time', sortDir);
    } else {
      if (sortBy === 'recommended' && !hasVolunteerContextVector) {
        console.info('[recommendation] Volunteer vectors unavailable. Using default opportunity ordering.');
      }

      const fallbackSortBy = sortBy === 'recommended' ? 'start_date' : sortBy;
      query = applySharedPostingSort(query, fallbackSortBy, sortDir);
    }

    const postings = await query.execute();
    const postingsWithContext = await buildPostingsWithContext(db, {
      volunteerId,
      postings,
    });

    const visiblePostings = hideFull
      ? postingsWithContext.filter(posting => !isVolunteerPostingFull(posting))
      : postingsWithContext;

    res.json({ postings: visiblePostings });
  });

  volunteerPostingRouter.get('/enrollments', async (req, res: Response<VolunteerEnrollmentsResponse>) => {
    const volunteerId = req.userJWT!.id;
    const { search, sortBy, sortDir } = parseListQuery(req.query, {
      allowedSortBy: ['recommended', 'start_date', 'created_at', 'title'],
      defaultSortBy: 'recommended',
      defaultSortDir: 'desc',
    });
    const hideFull = parseOptionalBooleanQueryParam(req.query.hide_full) ?? false;
    const dateTimeFilters = parsePostingDateTimeFilters(req.query);

    const [enrolledPostings, pendingPostings] = await Promise.all([
      db
        .selectFrom('enrollment')
        .innerJoin('organization_posting', 'organization_posting.id', 'enrollment.posting_id')
        .innerJoin('organization_account', 'organization_account.id', 'organization_posting.organization_id')
        .leftJoin('crisis', 'crisis.id', 'organization_posting.crisis_id')
        .select(postingWithContextSelectColumns)
        .where('enrollment.volunteer_id', '=', volunteerId)
        .execute(),
      db
        .selectFrom('enrollment_application')
        .innerJoin('organization_posting', 'organization_posting.id', 'enrollment_application.posting_id')
        .innerJoin('organization_account', 'organization_account.id', 'organization_posting.organization_id')
        .leftJoin('crisis', 'crisis.id', 'organization_posting.crisis_id')
        .select(postingWithContextSelectColumns)
        .where('enrollment_application.volunteer_id', '=', volunteerId)
        .execute(),
    ]);

    const applicationStatusMap = new Map<number, 'registered' | 'pending'>();
    const postingsMap = new Map<number, typeof enrolledPostings[0]>();

    for (const posting of pendingPostings) {
      applicationStatusMap.set(posting.id, 'pending');
      postingsMap.set(posting.id, posting);
    }
    for (const posting of enrolledPostings) {
      applicationStatusMap.set(posting.id, 'registered');
      postingsMap.set(posting.id, posting);
    }

    const postings = await buildPostingsWithContext(db, {
      volunteerId,
      postings: Array.from(postingsMap.values()),
      applicationStatusByPostingId: applicationStatusMap,
    });

    const filteredPostings = postings
      .filter(posting => matchesPostingSearch(posting, search))
      .filter(posting => matchesPostingDateTimeFilters<PostingWithContext>(posting, dateTimeFilters))
      .filter(posting => (hideFull ? !isVolunteerPostingFull(posting) : true));

    const effectiveSortBy = sortBy === 'recommended' ? 'start_date' : sortBy;
    const effectiveSortDir = sortDir;
    const sortedPostings = sortPostingsBySharedSort<PostingWithContext>(filteredPostings, effectiveSortBy, effectiveSortDir);

    res.json({ postings: sortedPostings });
  });

  volunteerPostingRouter.get('/:id', async (req, res: Response<VolunteerPostingResponse>) => {
    const volunteerId = req.userJWT!.id;
    const { id } = postingIdParamsSchema.parse(req.params);

    const posting = await db
      .selectFrom('organization_posting')
      .innerJoin('organization_account', 'organization_account.id', 'organization_posting.organization_id')
      .leftJoin('crisis', 'crisis.id', 'organization_posting.crisis_id')
      .select(postingWithContextSelectColumns)
      .where('organization_posting.id', '=', id)
      .executeTakeFirst();

    if (!posting) {
      res.status(404);
      throw new Error('Posting not found');
    }

    const [postingWithContext] = await buildPostingsWithContext(db, {
      volunteerId,
      postings: [posting],
    });

    if (!postingWithContext) {
      res.status(404);
      throw new Error('Posting not found');
    }

    const dateCapacities = await db
      .selectFrom('enrollment_date')
      .select([
        dateColumnAsIsoSql('enrollment_date.date').as('date'),
        sql<number>`count(*)`.as('count'),
      ])
      .where('posting_id', '=', id)
      .groupBy('enrollment_date.date')
      .execute();

    const applicationDateCapacities = await db
      .selectFrom('enrollment_application_date')
      .innerJoin('enrollment_application', 'enrollment_application.id', 'enrollment_application_date.application_id')
      .select([
        dateColumnAsIsoSql('enrollment_application_date.date').as('date'),
        sql<number>`count(*)`.as('count'),
      ])
      .where('enrollment_application.posting_id', '=', id)
      .groupBy('enrollment_application_date.date')
      .execute();

    const confirmedCapacityMap = dateCapacities
      .map((row) => {
        const normalizedDate = normalizeStoredDate(row.date);
        return normalizedDate ? [normalizedDate, Number(row.count)] as const : undefined;
      })
      .filter((entry): entry is readonly [string, number] => Boolean(entry))
      .reduce<Record<string, number>>((acc, [date, count]) => {
        acc[date] = (acc[date] ?? 0) + count;
        return acc;
      }, {});

    const combinedCapacityMap = [...dateCapacities, ...applicationDateCapacities]
      .map((row) => {
        const normalizedDate = normalizeStoredDate(row.date);
        return normalizedDate ? [normalizedDate, Number(row.count)] as const : undefined;
      })
      .filter((entry): entry is readonly [string, number] => Boolean(entry))
      .reduce<Record<string, number>>((acc, [date, count]) => {
        acc[date] = (acc[date] ?? 0) + count;
        return acc;
      }, {});

    const date_capacity = combinedCapacityMap;
    const confirmed_date_capacity = confirmedCapacityMap;

    const [enrollmentDates, applicationDates] = await Promise.all([
      db
        .selectFrom('enrollment_date')
        .innerJoin('enrollment', 'enrollment.id', 'enrollment_date.enrollment_id')
        .select(dateColumnAsIsoSql('enrollment_date.date').as('date'))
        .where('enrollment.posting_id', '=', id)
        .where('enrollment.volunteer_id', '=', volunteerId)
        .execute(),
      db
        .selectFrom('enrollment_application_date')
        .innerJoin('enrollment_application', 'enrollment_application.id', 'enrollment_application_date.application_id')
        .select(dateColumnAsIsoSql('enrollment_application_date.date').as('date'))
        .where('enrollment_application.posting_id', '=', id)
        .where('enrollment_application.volunteer_id', '=', volunteerId)
        .execute(),
    ]);

    const enrolled_dates = enrollmentDates
      .map(row => normalizeStoredDate(row.date))
      .filter((d): d is string => Boolean(d));
    const requested_dates = applicationDates
      .map(row => normalizeStoredDate(row.date))
      .filter((d): d is string => Boolean(d));
    const posting_dates = postingWithContext.start_date && postingWithContext.end_date
      ? getPostingDates(postingWithContext.start_date, postingWithContext.end_date)
      : [];
    const selected_dates = postingWithContext.application_status === 'registered'
      ? enrolled_dates
      : postingWithContext.application_status === 'pending'
        ? requested_dates
        : [];

    res.json({
      posting: {
        ...postingWithContext,
        date_capacity,
        confirmed_date_capacity,
      },
      enrolled_dates,
      selected_dates,
      posting_dates,
    });
  });

  volunteerPostingRouter.post('/:id/enroll', async (req, res: Response<VolunteerPostingEnrollResponse>) => {
    const volunteerId = req.userJWT!.id;
    const { id } = postingIdParamsSchema.parse(req.params);
    const { message, dates } = applyBodySchema.parse(req.body ?? {});

    const [posting, volunteer] = await Promise.all([
      db
        .selectFrom('organization_posting')
        .select(['id', 'automatic_acceptance', 'is_closed', 'minimum_age', 'max_volunteers', 'allows_partial_attendance', 'start_date', 'end_date'])
        .where('id', '=', id)
        .executeTakeFirst(),
      db
        .selectFrom('volunteer_account')
        .select('date_of_birth')
        .where('id', '=', volunteerId)
        .executeTakeFirst(),
    ]);

    if (!posting) {
      res.status(404);
      throw new Error('Posting not found');
    }

    if (posting.is_closed) {
      res.status(403);
      throw new Error('This posting is closed and no longer accepting applications');
    }

    if (!volunteer) {
      res.status(404);
      throw new Error('Volunteer not found');
    }

    if (posting.minimum_age !== undefined && posting.minimum_age !== null) {
      const volunteerAge = calculateAge(volunteer.date_of_birth);

      if (volunteerAge === null) {
        res.status(400);
        throw new Error('Volunteer date of birth is invalid');
      }

      if (volunteerAge < posting.minimum_age) {
        res.status(403);
        throw new Error(`You must be at least ${posting.minimum_age} years old to apply for this posting`);
      }
    }

    const postingDateKeys = posting.start_date && posting.end_date
      ? getPostingDates(posting.start_date, posting.end_date)
      : [];

    const isPartial = Boolean(posting.allows_partial_attendance);
    let selectedDates: string[] = [];

    if (isPartial) {
      if (!dates || dates.length === 0) {
        res.status(400);
        throw new Error('You must select at least one date when partial attendance is enabled');
      }

      selectedDates = Array.from(new Set(dates.map(d => d.trim())));

      const invalidDate = selectedDates.find(date => !postingDateKeys.includes(date));
      if (invalidDate) {
        res.status(400);
        throw new Error(`Selected date ${invalidDate} is outside the posting date range`);
      }

      const fullDates = await getFullSelectedDates(db, id, selectedDates, posting.max_volunteers);
      if (fullDates.length > 0) {
        res.status(403);
        throw new Error(`Selected date ${fullDates[0]} is already full`);
      }
    } else {
      if (dates && dates.length > 0) {
        res.status(400);
        throw new Error('This posting requires full commitment; date selection is not allowed');
      }

      if (posting.max_volunteers !== undefined && posting.max_volunteers !== null) {
        const enrollmentCountRow = await db
          .selectFrom('enrollment')
          .select(sql<number>`count(enrollment.id)`.as('count'))
          .where('posting_id', '=', id)
          .executeTakeFirst();

        if (Number(enrollmentCountRow?.count ?? 0) >= posting.max_volunteers) {
          res.status(403);
          throw new Error('This posting has reached the maximum number of volunteers');
        }
      }
    }

    const [existingApplication, existingEnrollment] = await Promise.all([
      db
        .selectFrom('enrollment_application')
        .select('id')
        .where('posting_id', '=', id)
        .where('volunteer_id', '=', volunteerId)
        .executeTakeFirst(),
      db
        .selectFrom('enrollment')
        .select('id')
        .where('posting_id', '=', id)
        .where('volunteer_id', '=', volunteerId)
        .executeTakeFirst(),
    ]);

    if (existingApplication && existingEnrollment) {
      res.status(409);
      throw new Error('You are already enrolled or have already applied to this posting');
    }

    let enrollment: Enrollment | EnrollmentApplication | undefined;

    if (posting.automatic_acceptance) {
      enrollment = await executeTransaction(db, async (trx) => {
        const lockedPosting = await trx
          .selectFrom('organization_posting')
          .select(['id', 'is_closed', 'max_volunteers'])
          .where('id', '=', id)
          .forUpdate()
          .executeTakeFirst();

        if (!lockedPosting) {
          res.status(404);
          throw new Error('Posting not found');
        }

        if (lockedPosting.is_closed) {
          res.status(403);
          throw new Error('This posting is closed and no longer accepting applications');
        }

        if (!isPartial && lockedPosting.max_volunteers !== undefined && lockedPosting.max_volunteers !== null) {
          const enrollmentCountRow = await trx
            .selectFrom('enrollment')
            .select(sql<number>`count(enrollment.id)`.as('count'))
            .where('posting_id', '=', id)
            .executeTakeFirst();

          if (Number(enrollmentCountRow?.count ?? 0) >= lockedPosting.max_volunteers) {
            res.status(403);
            throw new Error('This posting has reached the maximum number of volunteers');
          }
        }

        if (isPartial) {
          const fullDates = await getFullSelectedDates(trx, id, selectedDates, lockedPosting.max_volunteers);
          if (fullDates.length > 0) {
            res.status(403);
            throw new Error(`Selected date ${fullDates[0]} is already full`);
          }
        }

        const createdEnrollment = await trx
          .insertInto('enrollment')
          .values({
            volunteer_id: volunteerId,
            posting_id: id,
            message: message ?? undefined,
            attended: false,
          })
          .returningAll()
          .executeTakeFirst();

        if (!createdEnrollment) {
          throw new Error('Failed to create enrollment');
        }

        if (isPartial && selectedDates.length > 0) {
          await trx
            .insertInto('enrollment_date')
            .values(selectedDates.map(date => ({
              enrollment_id: createdEnrollment.id,
              posting_id: id,
              date: toUtcDateOnly(date),
              attended: false,
            })))
            .execute();
        } else if (!isPartial && postingDateKeys.length > 0) {
          await trx
            .insertInto('enrollment_date')
            .values(postingDateKeys.map(date => ({
              enrollment_id: createdEnrollment.id,
              posting_id: id,
              date: toUtcDateOnly(date),
              attended: false,
            })))
            .execute();
        }

        return createdEnrollment;
      });
    } else {
      enrollment = await executeTransaction(db, async (trx) => {
        const lockedPosting = await trx
          .selectFrom('organization_posting')
          .select(['id', 'is_closed', 'max_volunteers'])
          .where('id', '=', id)
          .forUpdate()
          .executeTakeFirst();

        if (!lockedPosting) {
          res.status(404);
          throw new Error('Posting not found');
        }

        if (lockedPosting.is_closed) {
          res.status(403);
          throw new Error('This posting is closed and no longer accepting applications');
        }

        if (!isPartial && lockedPosting.max_volunteers !== undefined && lockedPosting.max_volunteers !== null) {
          const enrollmentCountRow = await trx
            .selectFrom('enrollment')
            .select(sql<number>`count(enrollment.id)`.as('count'))
            .where('posting_id', '=', id)
            .executeTakeFirst();

          if (Number(enrollmentCountRow?.count ?? 0) >= lockedPosting.max_volunteers) {
            res.status(403);
            throw new Error('This posting has reached the maximum number of volunteers');
          }
        }

        if (isPartial) {
          const fullDates = await getFullSelectedDates(trx, id, selectedDates, lockedPosting.max_volunteers);
          if (fullDates.length > 0) {
            res.status(403);
            throw new Error(`Selected date ${fullDates[0]} is already full`);
          }
        }

        const createdApplication = await trx
          .insertInto('enrollment_application')
          .values({
            volunteer_id: volunteerId,
            posting_id: id,
            message: message ?? undefined,
          })
          .returningAll()
          .executeTakeFirst();

        if (!createdApplication) {
          throw new Error('Failed to create enrollment');
        }

        if (isPartial && selectedDates.length > 0) {
          await trx
            .insertInto('enrollment_application_date')
            .values(selectedDates.map(date => ({
              application_id: createdApplication.id,
              date: toUtcDateOnly(date),
            })))
            .execute();
        }

        return createdApplication;
      });
    }

    if (!enrollment) {
      res.status(500);
      throw new Error('Failed to create enrollment');
    }

    if (posting.automatic_acceptance) {
      await recomputePostingContextVectorOnly(id, db);
    }

    res.json({ enrollment, isOpen: posting.automatic_acceptance });
  });

  volunteerPostingRouter.delete('/:id/enroll', async (req, res: Response<VolunteerPostingWithdrawResponse>) => {
    const volunteerId = req.userJWT!.id;
    const { id } = postingIdParamsSchema.parse(req.params);

    const { enrollment } = await executeTransaction(db, async (trx) => {
      const posting = await trx
        .selectFrom('organization_posting')
        .select(['id'])
        .where('id', '=', id)
        .forUpdate()
        .executeTakeFirst();

      if (!posting) {
        res.status(404);
        throw new Error('Posting not found');
      }

      const enrollment = await trx
        .selectFrom('enrollment')
        .select(['id', 'attended'])
        .where('posting_id', '=', id)
        .where('volunteer_id', '=', volunteerId)
        .executeTakeFirst();

      const application = await trx
        .selectFrom('enrollment_application')
        .select(['id'])
        .where('posting_id', '=', id)
        .where('volunteer_id', '=', volunteerId)
        .executeTakeFirst();

      if (application) {
        await trx
          .deleteFrom('enrollment_application_date')
          .where('application_id', '=', application.id)
          .execute();

        await trx
          .deleteFrom('enrollment_application')
          .where('id', '=', application.id)
          .execute();
      }

      if (enrollment) {
        await trx
          .deleteFrom('enrollment_date')
          .where('enrollment_id', '=', enrollment.id)
          .execute();

        await trx
          .deleteFrom('enrollment')
          .where('id', '=', enrollment.id)
          .execute();
      }

      return { posting, enrollment, application };
    });

    if (enrollment?.attended) {
      await recomputeVolunteerExperienceVector(volunteerId, db);
    }
    await recomputePostingContextVectorOnly(id, db);

    res.json({});
  });

  return volunteerPostingRouter;
}

export default createVolunteerPostingRouter;
