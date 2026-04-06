import { Router, type Response } from 'express';
import { sql, type Kysely } from 'kysely';
import zod from 'zod';

import createAttendanceRouter from './attendance.ts';
import {
  type OrganizationPostingCreateResponse,
  type OrganizationPostingListResponse,
  type OrganizationPostingResponse,
  type OrganizationPostingEnrollmentsResponse,
  type OrganizationPostingUpdateResponse,
  type OrganizationPostingDeleteResponse,
  type OrganizationPostingApplicationsReponse,
  type OrganizationPostingApplicationAcceptanceResponse,
  type OrganizationPostingApplicationRejectionResponse,
} from './posting.types.ts';
import { getPostingEnrollments } from './postingEnrollments.ts';
import executeTransaction from '../../../db/executeTransaction.ts';
import {
  type Database,
  type OrganizationPostingWithoutVectors,
  type PostingSkill,
  type VolunteerSkill,
  newOrganizationPostingSchema,
} from '../../../db/tables/index.ts';
import {
  recomputeOrganizationCompositeVectorOnly,
  recomputeOrganizationHistoryVectorOnly,
  recomputePostingContextVectorOnly,
  recomputePostingContextVectorsForOrganization,
  recomputePostingVectors,
  recomputeVolunteerExperienceVector,
} from '../../../services/embeddings/updates.ts';
import {
  sendVolunteerApplicationAcceptedEmail,
  sendVolunteerApplicationRejectedEmail,
} from '../../../services/smtp/emails.ts';
import {
  parseListQuery,
  parseOptionalBooleanQueryParam,
  parseOptionalNumberQueryParam,
} from '../utils/listQuery.ts';
import {
  applyPostingDateTimeFilters,
  applySharedPostingSort,
  buildSearchRegexPattern,
  normalizeSearchTerms,
  parsePostingDateTimeFilters,
} from '../utils/postingList.ts';

const organizationPostingUpdateSchema = newOrganizationPostingSchema.partial().extend({
  crisis_id: zod.number().int().positive().nullable().optional(),
});

const organizationPostingResponseColumns = [
  'organization_posting.id',
  'organization_posting.organization_id',
  'organization_posting.crisis_id',
  'organization_posting.title',
  'organization_posting.description',
  'organization_posting.latitude',
  'organization_posting.longitude',
  'organization_posting.max_volunteers',
  'organization_posting.start_date',
  'organization_posting.start_time',
  'organization_posting.end_date',
  'organization_posting.end_time',
  'organization_posting.minimum_age',
  'organization_posting.automatic_acceptance',
  'organization_posting.is_closed',
  'organization_posting.allows_partial_attendance',
  'organization_posting.location_name',
  'organization_posting.created_at',
  'organization_posting.updated_at',
] as const;

const normalizeSkillList = (skills: string[]) => Array.from(new Set(skills.map(skill => skill.trim()).filter(Boolean))).sort();
const areSkillListsEqual = (left: string[], right: string[]) => {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
};
const formatDateToIso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const normalizeStoredDate = (value: Date | string | null | undefined) => {
  if (value instanceof Date) return formatDateToIso(value);
  if (typeof value === 'string') {
    const datePart = value.split('T')[0]?.trim();
    return datePart || undefined;
  }
  return undefined;
};
const parseIsoDateParts = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
};
const getPostingDates = (startDate: Date | string, endDate: Date | string): string[] => {
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
};
const areDatesEqual = (left: Date | undefined, right: Date | undefined) => (left?.getTime() ?? null) === (right?.getTime() ?? null);
const areTimeValuesEqual = (left: string | undefined, right: string | undefined) => (left ?? null) === (right ?? null);
const isPostingFull = (maxVolunteers: number | null | undefined, enrollmentCount: number) => maxVolunteers !== undefined && maxVolunteers !== null && enrollmentCount >= maxVolunteers;

const postingIdParamsSchema = zod.object({
  id: zod.coerce.number().int().positive('ID must be a positive number'),
});

const assertCrisisExists = async (crisisId: number, db: Kysely<Database>, res: Response) => {
  const crisis = await db
    .selectFrom('crisis')
    .select(['id'])
    .where('id', '=', crisisId)
    .executeTakeFirst();

  if (!crisis) {
    res.status(400);
    throw new Error('Selected crisis tag does not exist');
  }
};

const getPostingCrisis = async (crisisId: number | null | undefined, db: Kysely<Database>) => {
  if (crisisId == null) return undefined;
  return db
    .selectFrom('crisis')
    .selectAll()
    .where('id', '=', crisisId)
    .executeTakeFirst();
};

function createOrganizationPostingRouter(db: Kysely<Database>) {
  const postingRouter = Router();

  postingRouter.post('/', async (req, res: Response<OrganizationPostingCreateResponse>) => {
    const body = newOrganizationPostingSchema.parse(req.body);
    const orgId = req.userJWT!.id;
    const { skills, ...postingBody } = body;

    if (body.crisis_id !== undefined) {
      await assertCrisisExists(body.crisis_id, db, res);
    }

    const result = await executeTransaction(db, async (trx) => {
      const postingInsertValues = {
        organization_id: orgId,
        ...postingBody,
      } as Partial<OrganizationPostingWithoutVectors>;

      const newPosting = await trx
        .insertInto('organization_posting')
        .values(postingInsertValues as never)
        .returning('id')
        .executeTakeFirst();

      if (!newPosting) {
        throw new Error('Failed to create posting');
      }

      if (skills && skills.length > 0) {
        const skillRows = skills.map(name => ({ posting_id: newPosting.id, name }));
        await trx.insertInto('posting_skill').values(skillRows).execute();
      }

      return { postingId: newPosting.id };
    });

    await recomputePostingVectors(result.postingId, db);

    const posting = await db
      .selectFrom('organization_posting')
      .select(organizationPostingResponseColumns)
      .where('id', '=', result.postingId)
      .executeTakeFirstOrThrow();

    const insertedSkills = await db
      .selectFrom('posting_skill')
      .selectAll()
      .where('posting_id', '=', result.postingId)
      .execute();

    res.json({ posting, skills: insertedSkills });
  });

  postingRouter.get('/', async (req, res: Response<OrganizationPostingListResponse>) => {
    const orgId = req.userJWT!.id;
    const { search, sortBy, sortDir } = parseListQuery(req.query, {
      allowedSortBy: ['start_date', 'created_at', 'title'],
      defaultSortBy: 'start_date',
      defaultSortDir: 'asc',
    });
    const isClosedFilter = parseOptionalBooleanQueryParam(req.query.is_closed);
    const automaticAcceptanceFilter = parseOptionalBooleanQueryParam(req.query.automatic_acceptance);
    const crisisIdFilter = parseOptionalNumberQueryParam(req.query.crisis_id);
    const dateTimeFilters = parsePostingDateTimeFilters(req.query);

    let postingsQuery = db
      .selectFrom('organization_posting')
      .select(organizationPostingResponseColumns)
      .where('organization_id', '=', orgId);

    if (search) {
      const terms = normalizeSearchTerms(search);
      postingsQuery = postingsQuery.where(({ and, or }) => and(
        terms.map((term) => {
          const searchPattern = buildSearchRegexPattern(term);
          return or([
            sql<boolean>`lower(organization_posting.title) ~ ${searchPattern}`,
            sql<boolean>`lower(organization_posting.description) ~ ${searchPattern}`,
            sql<boolean>`lower(organization_posting.location_name) ~ ${searchPattern}`,
          ]);
        }),
      ));
    }

    if (isClosedFilter !== undefined) {
      postingsQuery = postingsQuery.where('organization_posting.is_closed', '=', isClosedFilter);
    }

    if (automaticAcceptanceFilter !== undefined) {
      postingsQuery = postingsQuery.where('organization_posting.automatic_acceptance', '=', automaticAcceptanceFilter);
    }

    if (crisisIdFilter !== undefined) {
      postingsQuery = postingsQuery.where('organization_posting.crisis_id', '=', crisisIdFilter);
    }

    postingsQuery = applyPostingDateTimeFilters(postingsQuery, dateTimeFilters);

    if (sortBy === 'title') {
      postingsQuery = postingsQuery.orderBy('organization_posting.title', sortDir);
    } else {
      postingsQuery = applySharedPostingSort(postingsQuery, sortBy, sortDir);
    }

    const postings = await postingsQuery.execute();
    const postingIds = postings.map(p => p.id);

    const skills = postingIds.length > 0
      ? await db
          .selectFrom('posting_skill')
          .selectAll()
          .where('posting_id', 'in', postingIds)
          .execute()
      : [];

    const skillsByPostingId = new Map<number, PostingSkill[]>();
    skills.forEach((skill) => {
      if (!skillsByPostingId.has(skill.posting_id)) {
        skillsByPostingId.set(skill.posting_id, []);
      }
      skillsByPostingId.get(skill.posting_id)!.push(skill);
    });

    const enrollmentCounts = postingIds.length > 0
      ? await db
          .selectFrom('enrollment')
          .select(['posting_id', sql<number>`count(enrollment.id)`.as('count')])
          .where('posting_id', 'in', postingIds)
          .groupBy('posting_id')
          .execute()
      : [];

    const countsByPostingId = new Map<number, number>();
    enrollmentCounts.forEach((row) => {
      countsByPostingId.set(row.posting_id, Number(row.count ?? 0));
    });

    const postingsWithSkills = postings.map((posting) => {
      const enrollmentCount = countsByPostingId.get(posting.id) ?? 0;
      return {
        ...posting,
        skills: skillsByPostingId.get(posting.id) || [],
        enrollment_count: enrollmentCount,
        is_full: isPostingFull(posting.max_volunteers, enrollmentCount),
      };
    });

    res.json({ postings: postingsWithSkills });
  });

  postingRouter.get('/:id', async (req, res: Response<OrganizationPostingResponse>) => {
    const orgId = req.userJWT!.id;
    const { id: postingId } = postingIdParamsSchema.parse(req.params);

    const posting = await db
      .selectFrom('organization_posting')
      .select(organizationPostingResponseColumns)
      .where('organization_posting.id', '=', postingId)
      .where('organization_posting.organization_id', '=', orgId)
      .executeTakeFirst();

    if (!posting) {
      res.status(404);
      throw new Error('Posting not found');
    }

    const [skills, crisis, enrollmentCountRow] = await Promise.all([
      db
        .selectFrom('posting_skill')
        .selectAll()
        .where('posting_id', '=', postingId)
        .execute(),
      getPostingCrisis(posting.crisis_id, db),
      db
        .selectFrom('enrollment')
        .select(sql<number>`count(enrollment.id)`.as('count'))
        .where('posting_id', '=', postingId)
        .executeTakeFirst(),
    ]);

    const enrollmentCount = Number(enrollmentCountRow?.count ?? 0);

    res.json({
      posting,
      skills,
      is_full: isPostingFull(posting.max_volunteers, enrollmentCount),
      ...(crisis ? { crisis } : {}),
    });
  });

  postingRouter.get('/:id/enrollments', async (req, res: Response<OrganizationPostingEnrollmentsResponse>) => {
    const orgId = req.userJWT!.id;
    const { id: postingId } = postingIdParamsSchema.parse(req.params);

    const posting = await db
      .selectFrom('organization_posting')
      .select(['id'])
      .where('organization_posting.id', '=', postingId)
      .where('organization_posting.organization_id', '=', orgId)
      .executeTakeFirst();

    if (!posting) {
      res.status(404);
      throw new Error('Posting not found');
    }

    const enrollments = await getPostingEnrollments(db, postingId);
    res.json({ enrollments });
  });

  postingRouter.put('/:id', async (req, res: Response<OrganizationPostingUpdateResponse>) => {
    const orgId = req.userJWT!.id;
    const { id: postingId } = postingIdParamsSchema.parse(req.params);
    const body = organizationPostingUpdateSchema.parse(req.body);

    const posting = await db
      .selectFrom('organization_posting')
      .select([
        'id',
        'crisis_id',
        'title',
        'description',
        'location_name',
        'start_date',
        'start_time',
        'end_date',
        'end_time',
        'minimum_age',
        'max_volunteers',
        'is_closed',
      ])
      .where('id', '=', postingId)
      .where('organization_id', '=', orgId)
      .executeTakeFirst();

    if (!posting) {
      res.status(404);
      throw new Error('Posting not found');
    }

    if (body.crisis_id !== undefined && body.crisis_id !== null && body.crisis_id !== posting.crisis_id) {
      await assertCrisisExists(body.crisis_id, db, res);
    }

    const existingSkills = await db
      .selectFrom('posting_skill')
      .select('name')
      .where('posting_id', '=', postingId)
      .execute();

    const normalizedExistingSkills = normalizeSkillList(existingSkills.map(skill => skill.name));
    const normalizedIncomingSkills = body.skills !== undefined ? normalizeSkillList(body.skills) : undefined;
    const didSkillsChange = normalizedIncomingSkills !== undefined
      ? !areSkillListsEqual(normalizedIncomingSkills, normalizedExistingSkills)
      : false;

    const shouldRecomputePostingVectors = (
      (body.title !== undefined && body.title !== posting.title)
      || (body.description !== undefined && body.description !== posting.description)
      || (body.location_name !== undefined && body.location_name !== posting.location_name)
      || (body.start_date !== undefined && !areDatesEqual(body.start_date, posting.start_date))
      || (body.end_date !== undefined && !areDatesEqual(body.end_date, posting.end_date))
      || (body.start_time !== undefined && !areTimeValuesEqual(body.start_time, posting.start_time))
      || (body.end_time !== undefined && !areTimeValuesEqual(body.end_time, posting.end_time))
      || (body.minimum_age !== undefined && (body.minimum_age ?? null) !== (posting.minimum_age ?? null))
      || (body.max_volunteers !== undefined && (body.max_volunteers ?? null) !== (posting.max_volunteers ?? null))
      || didSkillsChange
    );
    const didClosedStateChange = body.is_closed !== undefined && body.is_closed !== posting.is_closed;

    await executeTransaction(db, async (trx) => {
      const postingFields: Record<string, unknown> = {};
      if (body.title !== undefined) postingFields.title = body.title;
      if (body.description !== undefined) postingFields.description = body.description;
      if (body.latitude !== undefined) postingFields.latitude = body.latitude;
      if (body.longitude !== undefined) postingFields.longitude = body.longitude;
      if (body.max_volunteers !== undefined) postingFields.max_volunteers = body.max_volunteers;
      if (body.start_date !== undefined) postingFields.start_date = body.start_date;
      if (body.start_time !== undefined) postingFields.start_time = body.start_time;
      if (body.end_date !== undefined) postingFields.end_date = body.end_date;
      if (body.end_time !== undefined) postingFields.end_time = body.end_time;
      if (body.minimum_age !== undefined) postingFields.minimum_age = body.minimum_age;
      if (body.automatic_acceptance !== undefined) postingFields.automatic_acceptance = body.automatic_acceptance;
      if (body.is_closed !== undefined) postingFields.is_closed = body.is_closed;
      if (body.allows_partial_attendance !== undefined) postingFields.allows_partial_attendance = body.allows_partial_attendance;
      if (body.location_name !== undefined) postingFields.location_name = body.location_name;
      if (body.crisis_id !== undefined) postingFields.crisis_id = body.crisis_id;

      if (Object.keys(postingFields).length > 0) {
        await trx
          .updateTable('organization_posting')
          .set(postingFields)
          .where('id', '=', postingId)
          .where('organization_id', '=', orgId)
          .execute();
      }

      if (didSkillsChange) {
        await trx
          .deleteFrom('posting_skill')
          .where('posting_id', '=', postingId)
          .execute();

        if (normalizedIncomingSkills && normalizedIncomingSkills.length > 0) {
          await trx
            .insertInto('posting_skill')
            .values(normalizedIncomingSkills.map(name => ({ posting_id: postingId, name })))
            .execute();
        }
      }
    });

    if (shouldRecomputePostingVectors) {
      await recomputePostingVectors(postingId, db);
    }
    if (didClosedStateChange) {
      await recomputeOrganizationHistoryVectorOnly(orgId, db);
      await recomputeOrganizationCompositeVectorOnly(orgId, db);
      await recomputePostingContextVectorsForOrganization(orgId, db);
    }

    const updatedPosting = await db
      .selectFrom('organization_posting')
      .select(organizationPostingResponseColumns)
      .where('id', '=', postingId)
      .where('organization_id', '=', orgId)
      .executeTakeFirstOrThrow();

    const [skills, crisis] = await Promise.all([
      db
        .selectFrom('posting_skill')
        .selectAll()
        .where('posting_id', '=', postingId)
        .execute(),
      getPostingCrisis(updatedPosting.crisis_id, db),
    ]);

    res.json({ posting: updatedPosting, skills, ...(crisis ? { crisis } : {}) });
  });

  postingRouter.delete('/:id', async (req, res: Response<OrganizationPostingDeleteResponse>) => {
    const orgId = req.userJWT!.id;
    const { id: postingId } = postingIdParamsSchema.parse(req.params);

    const posting = await db
      .selectFrom('organization_posting')
      .select(['id'])
      .where('id', '=', postingId)
      .where('organization_id', '=', orgId)
      .executeTakeFirst();

    if (!posting) {
      res.status(404);
      throw new Error('Posting not found');
    }

    const impactedVolunteerRows = await db
      .selectFrom('enrollment')
      .select('volunteer_id')
      .where('posting_id', '=', postingId)
      .where('attended', '=', true)
      .execute();

    await executeTransaction(db, async (trx) => {
      await trx.deleteFrom('posting_skill').where('posting_id', '=', postingId).execute();
      await trx.deleteFrom('enrollment_application_date').where('application_id', 'in', trx
        .selectFrom('enrollment_application')
        .select('id')
        .where('posting_id', '=', postingId)).execute();
      await trx.deleteFrom('enrollment_date').where('posting_id', '=', postingId).execute();
      await trx.deleteFrom('enrollment_application').where('posting_id', '=', postingId).execute();
      await trx.deleteFrom('enrollment').where('posting_id', '=', postingId).execute();
      await trx.deleteFrom('organization_posting').where('id', '=', postingId).execute();
    });

    const impactedVolunteerIds = Array.from(new Set(impactedVolunteerRows.map(row => row.volunteer_id)));
    await Promise.all(impactedVolunteerIds.map(volunteerId => recomputeVolunteerExperienceVector(volunteerId, db)));
    await recomputeOrganizationHistoryVectorOnly(orgId, db);
    await recomputeOrganizationCompositeVectorOnly(orgId, db);
    await recomputePostingContextVectorsForOrganization(orgId, db);

    res.json({});
  });

  postingRouter.get('/:id/applications', async (req, res: Response<OrganizationPostingApplicationsReponse>) => {
    const orgId = req.userJWT!.id;
    const { id: postingId } = postingIdParamsSchema.parse(req.params);

    const posting = await db
      .selectFrom('organization_posting')
      .select(['id', 'automatic_acceptance', 'is_closed', 'max_volunteers'])
      .where('id', '=', postingId)
      .where('organization_id', '=', orgId)
      .executeTakeFirst();

    if (!posting) {
      res.status(404);
      throw new Error('Posting not found');
    }

    if (posting.automatic_acceptance) {
      res.json({ applications: [] });
      return;
    }

    const applications = await db
      .selectFrom('enrollment_application')
      .innerJoin('volunteer_account', 'volunteer_account.id', 'enrollment_application.volunteer_id')
      .select([
        'enrollment_application.id as application_id',
        'enrollment_application.volunteer_id',
        'enrollment_application.message',
        'enrollment_application.created_at',
        'volunteer_account.first_name',
        'volunteer_account.last_name',
        'volunteer_account.email',
        'volunteer_account.date_of_birth',
        'volunteer_account.gender',
        'volunteer_account.cv_path',
      ])
      .where('enrollment_application.posting_id', '=', postingId)
      .execute();

    const volunteerIds = applications.map(a => a.volunteer_id);
    const skills = volunteerIds.length > 0
      ? await db
          .selectFrom('volunteer_skill')
          .selectAll()
          .where('volunteer_id', 'in', volunteerIds)
          .execute()
      : [];
    const applicationIds = applications.map(application => application.application_id);
    const applicationDates = applicationIds.length > 0
      ? await db
          .selectFrom('enrollment_application_date')
          .select([
            'application_id',
            sql<string>`to_char(enrollment_application_date.date, 'YYYY-MM-DD')`.as('date'),
          ])
          .where('application_id', 'in', applicationIds)
          .execute()
      : [];

    const skillsByVolunteerId = new Map<number, VolunteerSkill[]>();
    skills.forEach((skill) => {
      if (!skillsByVolunteerId.has(skill.volunteer_id)) {
        skillsByVolunteerId.set(skill.volunteer_id, []);
      }
      skillsByVolunteerId.get(skill.volunteer_id)!.push(skill);
    });
    const requestedDatesByApplicationId = new Map<number, string[]>();
    applicationDates.forEach((dateRow) => {
      if (!requestedDatesByApplicationId.has(dateRow.application_id)) {
        requestedDatesByApplicationId.set(dateRow.application_id, []);
      }
      requestedDatesByApplicationId.get(dateRow.application_id)!.push(dateRow.date);
    });

    const applicationsWithSkills = applications.map(app => ({
      ...app,
      skills: skillsByVolunteerId.get(app.volunteer_id) ?? [],
      requested_dates: requestedDatesByApplicationId.get(app.application_id)?.sort() ?? [],
    }));

    res.json({ applications: applicationsWithSkills });
  });

  postingRouter.post('/:id/applications/:applicationId/accept', async (req, res: Response<OrganizationPostingApplicationAcceptanceResponse>) => {
    const orgId = req.userJWT!.id;
    const { id: postingId, applicationId } = zod.object({
      id: zod.coerce.number().int().positive(),
      applicationId: zod.coerce.number().int().positive(),
    }).parse(req.params);

    const posting = await db
      .selectFrom('organization_posting')
      .select(['id', 'automatic_acceptance', 'is_closed', 'max_volunteers', 'allows_partial_attendance', 'start_date', 'end_date'])
      .where('id', '=', postingId)
      .where('organization_id', '=', orgId)
      .executeTakeFirst();

    if (!posting) {
      res.status(404);
      throw new Error('Posting not found');
    }

    if (posting.automatic_acceptance) {
      res.status(400);
      throw new Error('Cannot accept applications for open postings');
    }

    const application = await db
      .selectFrom('enrollment_application')
      .select(['id', 'volunteer_id', 'posting_id', 'message'])
      .where('id', '=', applicationId)
      .executeTakeFirst();

    if (!application) {
      res.status(404);
      throw new Error('Application not found');
    }

    if (application.posting_id !== postingId) {
      res.status(403);
      throw new Error('Application does not belong to this posting');
    }

    const emailContext = await db
      .selectFrom('enrollment_application')
      .innerJoin('volunteer_account', 'volunteer_account.id', 'enrollment_application.volunteer_id')
      .innerJoin('organization_posting', 'organization_posting.id', 'enrollment_application.posting_id')
      .innerJoin('organization_account', 'organization_account.id', 'organization_posting.organization_id')
      .select([
        'volunteer_account.email as volunteer_email',
        'volunteer_account.first_name',
        'volunteer_account.last_name',
        'organization_account.name as organization_name',
        'organization_posting.title as posting_title',
      ])
      .where('enrollment_application.id', '=', applicationId)
      .where('enrollment_application.posting_id', '=', postingId)
      .where('organization_posting.organization_id', '=', orgId)
      .executeTakeFirst();

    if (!emailContext) {
      res.status(404);
      throw new Error('Application not found');
    }

    const appDates = await db
      .selectFrom('enrollment_application_date')
      .select('date')
      .where('application_id', '=', applicationId)
      .execute();
    const acceptedDateStrings = appDates
      .map(row => normalizeStoredDate(row.date))
      .filter((date): date is string => Boolean(date));
    const enrollmentDateStrings = acceptedDateStrings.length > 0
      ? acceptedDateStrings
      : getPostingDates(posting.start_date, posting.end_date);

    await executeTransaction(db, async (trx) => {
      const lockedPosting = await trx
        .selectFrom('organization_posting')
        .select(['id', 'is_closed', 'max_volunteers'])
        .where('id', '=', postingId)
        .where('organization_id', '=', orgId)
        .forUpdate()
        .executeTakeFirst();

      if (!lockedPosting) {
        res.status(404);
        throw new Error('Posting not found');
      }

      const enrollment = await trx
        .insertInto('enrollment')
        .values({
          volunteer_id: application.volunteer_id,
          posting_id: application.posting_id,
          message: application.message ?? undefined,
          attended: false,
        })
        .returningAll()
        .executeTakeFirst();

      if (!enrollment) {
        throw new Error('Failed to create enrollment');
      }

      if (enrollmentDateStrings.length > 0) {
        await trx
          .insertInto('enrollment_date')
          .values(enrollmentDateStrings.map(date => ({
            enrollment_id: enrollment.id,
            posting_id: postingId,
            date: new Date(`${date}T00:00:00.000Z`),
            attended: false,
          })))
          .execute();
      }

      await trx
        .deleteFrom('enrollment_application_date')
        .where('application_id', '=', applicationId)
        .execute();

      await trx
        .deleteFrom('enrollment_application')
        .where('id', '=', applicationId)
        .execute();
    });

    await recomputePostingContextVectorOnly(postingId, db);
    const acceptedDates = enrollmentDateStrings;
    if (emailContext) {
      try {
        await sendVolunteerApplicationAcceptedEmail({
          volunteerEmail: emailContext.volunteer_email,
          volunteerName: `${emailContext.first_name} ${emailContext.last_name}`,
          organizationName: emailContext.organization_name,
          postingTitle: emailContext.posting_title,
          acceptedDates,
        });
      } catch (err) {
        console.error('Failed to send acceptance email:', err);
      }
    }

    res.json({});
  });

  postingRouter.delete('/:id/applications/:applicationId', async (req, res: Response<OrganizationPostingApplicationRejectionResponse>) => {
    const orgId = req.userJWT!.id;
    const { id: postingId, applicationId } = zod.object({
      id: zod.coerce.number().int().positive(),
      applicationId: zod.coerce.number().int().positive(),
    }).parse(req.params);

    const posting = await db
      .selectFrom('organization_posting')
      .select(['id', 'automatic_acceptance'])
      .where('id', '=', postingId)
      .where('organization_id', '=', orgId)
      .executeTakeFirst();

    if (!posting) {
      res.status(404);
      throw new Error('Posting not found');
    }

    const application = await db
      .selectFrom('enrollment_application')
      .selectAll()
      .where('id', '=', applicationId)
      .executeTakeFirst();

    if (!application) {
      res.status(404);
      throw new Error('Application not found');
    }

    if (application.posting_id !== postingId) {
      res.status(403);
      throw new Error('Application does not belong to this posting');
    }

    const emailContext = await db
      .selectFrom('enrollment_application')
      .innerJoin('volunteer_account', 'volunteer_account.id', 'enrollment_application.volunteer_id')
      .innerJoin('organization_posting', 'organization_posting.id', 'enrollment_application.posting_id')
      .innerJoin('organization_account', 'organization_account.id', 'organization_posting.organization_id')
      .select([
        'volunteer_account.email as volunteer_email',
        'volunteer_account.first_name',
        'volunteer_account.last_name',
        'organization_account.name as organization_name',
        'organization_posting.title as posting_title',
      ])
      .where('enrollment_application.id', '=', applicationId)
      .where('enrollment_application.posting_id', '=', postingId)
      .where('organization_posting.organization_id', '=', orgId)
      .executeTakeFirst();

    await executeTransaction(db, async (trx) => {
      await trx
        .deleteFrom('enrollment_application_date')
        .where('application_id', '=', applicationId)
        .execute();

      await trx
        .deleteFrom('enrollment_application')
        .where('id', '=', applicationId)
        .execute();
    });

    if (emailContext) {
      try {
        await sendVolunteerApplicationRejectedEmail({
          volunteerEmail: emailContext.volunteer_email,
          volunteerName: `${emailContext.first_name} ${emailContext.last_name}`,
          organizationName: emailContext.organization_name,
          postingTitle: emailContext.posting_title,
        });
      } catch (err) {
        console.error('Failed to send rejection email:', err);
      }
    }

    res.json({});
  });

  postingRouter.use(createAttendanceRouter(db));

  return postingRouter;
}

export default createOrganizationPostingRouter;
