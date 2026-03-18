import { Router, Response } from 'express';
import { sql } from 'kysely';
import zod from 'zod';

import { VolunteerEnrollmentsResponse, VolunteerPostingEnrollResponse, VolunteerPostingResponse, VolunteerPostingSearchResponse, VolunteerPostingWithdrawResponse } from './posting.types.js';
import database from '../../../db/index.js';
import { Enrollment, EnrollmentApplication } from '../../../db/tables.js';
import { recomputeVolunteerExperienceVector } from '../../../services/embeddings/updates.js';
import { authorizeOnly } from '../../authorization.js';

const volunteerPostingRouter = Router();
const organizationPostingResponseColumns = [
  'organization_posting.id',
  'organization_posting.organization_id',
  'organization_posting.crisis_id',
  'organization_posting.title',
  'organization_posting.description',
  'organization_posting.latitude',
  'organization_posting.longitude',
  'organization_posting.max_volunteers',
  'organization_posting.start_timestamp',
  'organization_posting.end_timestamp',
  'organization_posting.minimum_age',
  'organization_posting.automatic_acceptance',
  'organization_posting.is_closed',
  'organization_posting.location_name',
  'organization_posting.created_at',
  'organization_posting.updated_at',
  'organization_posting.crisis_id',
  'crisis.name as crisis_name',
] as const;

const postingIdParamsSchema = zod.object({
  id: zod.coerce.number().int().positive('ID must be a positive number'),
});

const applyBodySchema = zod.object({
  message: zod.string().trim().min(1, 'Message cannot be empty').optional(),
});

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

function isPostingFull(maxVolunteers: number | undefined, enrollmentCount: number): boolean {
  return maxVolunteers !== undefined && maxVolunteers !== null && enrollmentCount >= maxVolunteers;
}

volunteerPostingRouter.use(authorizeOnly('volunteer'));

volunteerPostingRouter.get('/', async (req, res: Response<VolunteerPostingSearchResponse>) => {
  const volunteerId = req.userJWT!.id;
  const { location_name, start_timestamp, end_timestamp, skill } = req.query;
  const skillFilter = typeof skill === 'string' ? skill.trim() : '';

  const volunteerVectors = await database
    .selectFrom('volunteer_account')
    .select(['profile_vector', 'experience_vector'])
    .where('id', '=', volunteerId)
    .executeTakeFirstOrThrow();

  const profileVectorLiteral = volunteerVectors.profile_vector;
  const experienceVectorLiteral = volunteerVectors.experience_vector;
  const hasProfileVector = Boolean(profileVectorLiteral);
  const hasExperienceVector = Boolean(experienceVectorLiteral);

  let query = database
    .selectFrom('organization_posting')
    .innerJoin(
      'organization_account',
      'organization_account.id',
      'organization_posting.organization_id',
    )
    .leftJoin(
      'crisis',
      'crisis.id',
      'organization_posting.crisis_id',
    )
    .select(organizationPostingResponseColumns)
    .select(['organization_account.name as organization_name'])
    .where('organization_posting.is_closed', '=', false);

  if (skillFilter) {
    query = query.where(({ exists, selectFrom }) => exists(
      selectFrom('posting_skill')
        .select('posting_skill.id')
        .whereRef('posting_skill.posting_id', '=', 'organization_posting.id')
        .where('posting_skill.name', 'ilike', `%${skillFilter}%`),
    ));
  }

  if (location_name) {
    query = query.where(
      'organization_posting.location_name',
      'ilike',
      `%${location_name}%`,
    );
  }

  let parsedStart: Date | undefined;
  let parsedEnd: Date | undefined;

  if (start_timestamp) {
    const s = start_timestamp as string;
    parsedStart = /^\d{4}-\d{2}-\d{2}$/.test(s)
      ? new Date(`${s}T00:00:00`)
      : new Date(s);
  }

  if (end_timestamp) {
    const e = end_timestamp as string;
    parsedEnd = /^\d{4}-\d{2}-\d{2}$/.test(e)
      ? new Date(`${e}T23:59:59.999`)
      : new Date(e);
  }

  if (parsedStart && parsedEnd) {
    query = query.where(qu =>
      qu.and([
        qu('organization_posting.start_timestamp', '<=', parsedEnd),
        qu.or([
          qu('organization_posting.end_timestamp', '>=', parsedStart),
          qu('organization_posting.end_timestamp', 'is', null),
        ]),
      ]),
    );
  } else {
    if (parsedStart) {
      query = query.where(
        'organization_posting.start_timestamp',
        '>=',
        parsedStart,
      );
    }

    if (parsedEnd) {
      query = query.where('organization_posting.end_timestamp', '<=', parsedEnd);
    }
  }

  if (hasProfileVector && profileVectorLiteral) {
    const profileSimilarity = sql<number>`
      1 - (organization_posting.opportunity_vector <=> ${profileVectorLiteral}::vector)
    `;

    if (hasExperienceVector && experienceVectorLiteral) {
      const experienceSimilarity = sql<number>`
        1 - (organization_posting.opportunity_vector <=> ${experienceVectorLiteral}::vector)
      `;
      const finalScore = sql<number>`(0.6 * ${profileSimilarity}) + (0.4 * ${experienceSimilarity})`;

      query = query.orderBy(sql`${finalScore} desc nulls last`);
    } else {
      const profileOnlyScore = sql<number>`0.6 * ${profileSimilarity}`;
      query = query.orderBy(sql`${profileOnlyScore} desc nulls last`);
    }

    query = query.orderBy('organization_posting.start_timestamp', 'asc');
  } else {
    if (!hasProfileVector && hasExperienceVector) {
      console.info('[recommendation] Volunteer has experience_vector but no valid profile_vector. Using default opportunity ordering.');
    } else if (!hasProfileVector && !hasExperienceVector) {
      console.info('[recommendation] Volunteer vectors unavailable. Using default opportunity ordering.');
    }

    query = query.orderBy('organization_posting.start_timestamp', 'asc');
  }

  const postings = await query.execute();

  const postingIds = postings.map(p => p.id);

  const skills = postingIds.length > 0
    ? await database
        .selectFrom('posting_skill')
        .selectAll()
        .where('posting_id', 'in', postingIds)
        .execute()
    : [];

  const skillsByPostingId = new Map<number, typeof skills>();

  skills.forEach((skillRow) => {
    if (!skillsByPostingId.has(skillRow.posting_id)) {
      skillsByPostingId.set(skillRow.posting_id, []);
    }
    skillsByPostingId.get(skillRow.posting_id)!.push(skillRow);
  });

  const enrollmentCounts = postingIds.length > 0
    ? await database
        .selectFrom('enrollment')
        .select([
          'posting_id',
          sql<number>`count(enrollment.id)`.as('count'),
        ])
        .where('posting_id', 'in', postingIds)
        .groupBy('posting_id')
        .execute()
    : [];

  const countsByPostingId = new Map<number, number>();
  enrollmentCounts.forEach((r) => {
    countsByPostingId.set(r.posting_id, Number(r.count ?? 0));
  });

  const postingWithSkills = postings.map((posting) => {
    const enrollmentCount = countsByPostingId.get(posting.id) ?? 0;

    return {
      ...posting,
      skills: skillsByPostingId.get(posting.id) || [],
      enrollment_count: enrollmentCount,
      is_full: isPostingFull(posting.max_volunteers, enrollmentCount),
    };
  });

  res.json({ postings: postingWithSkills });
});

volunteerPostingRouter.get('/enrollments', async (req, res: Response<VolunteerEnrollmentsResponse>) => {
  const volunteerId = req.userJWT!.id;

  const [enrolledPostings, pendingPostings] = await Promise.all([
    database
      .selectFrom('enrollment')
      .innerJoin('organization_posting', 'organization_posting.id', 'enrollment.posting_id')
      .innerJoin('organization_account', 'organization_account.id', 'organization_posting.organization_id')
      .leftJoin('crisis', 'crisis.id', 'organization_posting.crisis_id')
      .select(organizationPostingResponseColumns)
      .select(['organization_account.name as organization_name'])
      .where('enrollment.volunteer_id', '=', volunteerId)
      .execute(),
    database
      .selectFrom('enrollment_application')
      .innerJoin('organization_posting', 'organization_posting.id', 'enrollment_application.posting_id')
      .innerJoin('organization_account', 'organization_account.id', 'organization_posting.organization_id')
      .leftJoin('crisis', 'crisis.id', 'organization_posting.crisis_id')
      .select(organizationPostingResponseColumns)
      .select(['organization_account.name as organization_name'])
      .where('enrollment_application.volunteer_id', '=', volunteerId)
      .execute(),
  ]);

  // Merge: enrolled takes priority over pending for the same posting
  const statusMap = new Map<number, 'enrolled' | 'pending'>();
  const postingsMap = new Map<number, typeof enrolledPostings[0]>();

  for (const posting of pendingPostings) {
    statusMap.set(posting.id, 'pending');
    postingsMap.set(posting.id, posting);
  }
  for (const posting of enrolledPostings) {
    statusMap.set(posting.id, 'enrolled');
    postingsMap.set(posting.id, posting);
  }

  const allPostingIds = Array.from(postingsMap.keys());

  const skills = allPostingIds.length > 0
    ? await database
        .selectFrom('posting_skill')
        .selectAll()
        .where('posting_id', 'in', allPostingIds)
        .execute()
    : [];

  const skillsByPostingId = new Map<number, typeof skills>();
  skills.forEach((skill) => {
    if (!skillsByPostingId.has(skill.posting_id)) {
      skillsByPostingId.set(skill.posting_id, []);
    }
    skillsByPostingId.get(skill.posting_id)!.push(skill);
  });

  const enrollmentCounts = allPostingIds.length > 0
    ? await database
        .selectFrom('enrollment')
        .select([
          'posting_id',
          sql<number>`count(enrollment.id)`.as('count'),
        ])
        .where('posting_id', 'in', allPostingIds)
        .groupBy('posting_id')
        .execute()
    : [];

  const countsByPostingId = new Map<number, number>();
  enrollmentCounts.forEach((r) => {
    countsByPostingId.set(r.posting_id, Number(r.count ?? 0));
  });

  const postings = Array.from(postingsMap.values())
    .sort((a, b) => new Date(a.start_timestamp).getTime() - new Date(b.start_timestamp).getTime())
    .map((posting) => {
      const enrollmentCount = countsByPostingId.get(posting.id) ?? 0;

      return {
        ...posting,
        skills: skillsByPostingId.get(posting.id) ?? [],
        status: statusMap.get(posting.id) as 'enrolled' | 'pending',
        enrollment_count: enrollmentCount,
        is_full: isPostingFull(posting.max_volunteers, enrollmentCount),
        crisis_name: posting.crisis_name ?? null,
      };
    });

  res.json({ postings });
});

volunteerPostingRouter.get('/:id', async (req, res: Response<VolunteerPostingResponse>) => {
  const volunteerId = req.userJWT!.id;
  const { id } = postingIdParamsSchema.parse(req.params);

  const posting = await database
    .selectFrom('organization_posting')
    .leftJoin(
      'crisis',
      'crisis.id',
      'organization_posting.crisis_id',
    )
    .select(organizationPostingResponseColumns)
    .where('organization_posting.id', '=', id)
    .executeTakeFirst();

  if (!posting) {
    res.status(404);
    throw new Error('Posting not found');
  }

  const [skills, pendingApplication, existingEnrollment, enrollmentCountRow] = await Promise.all([
    database
      .selectFrom('posting_skill')
      .selectAll()
      .where('posting_id', '=', id)
      .execute(),
    database
      .selectFrom('enrollment_application')
      .selectAll()
      .where(eb => eb('volunteer_id', '=', volunteerId))
      .where(eb => eb('posting_id', '=', id))
      .executeTakeFirst(),
    database
      .selectFrom('enrollment')
      .select('id')
      .where('posting_id', '=', id)
      .where('volunteer_id', '=', volunteerId)
      .executeTakeFirst(),
    database
      .selectFrom('enrollment')
      .select(sql<number>`count(enrollment.id)`.as('count'))
      .where('posting_id', '=', id)
      .executeTakeFirst(),
  ]);

  const enrollmentCount = Number(enrollmentCountRow?.count ?? 0);

  res.json({
    posting,
    skills,
    hasPendingApplication: Boolean(pendingApplication),
    isEnrolled: Boolean(existingEnrollment),
    is_full: isPostingFull(posting.max_volunteers, enrollmentCount),
  });
});

volunteerPostingRouter.post('/:id/enroll', async (req, res: Response<VolunteerPostingEnrollResponse>) => {
  const volunteerId = req.userJWT!.id;
  const { id } = postingIdParamsSchema.parse(req.params);
  const { message } = applyBodySchema.parse(req.body ?? {});

  const [posting, volunteer] = await Promise.all([
    database
      .selectFrom('organization_posting')
      .select(['id', 'automatic_acceptance', 'is_closed', 'minimum_age', 'max_volunteers'])
      .where('id', '=', id)
      .executeTakeFirst(),
    database
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

  if (posting.max_volunteers !== undefined && posting.max_volunteers !== null) {
    const enrollmentCountRow = await database
      .selectFrom('enrollment')
      .select(sql<number>`count(enrollment.id)`.as('count'))
      .where('posting_id', '=', id)
      .executeTakeFirst();

    if (Number(enrollmentCountRow?.count ?? 0) >= posting.max_volunteers) {
      res.status(403);
      throw new Error('This posting has reached the maximum number of volunteers');
    }
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

  const [existingApplication, existingEnrollment] = await Promise.all([
    database
      .selectFrom('enrollment_application')
      .select('id')
      .where('posting_id', '=', id)
      .where('volunteer_id', '=', volunteerId)
      .executeTakeFirst(),
    database
      .selectFrom('enrollment')
      .select('id')
      .where('posting_id', '=', id)
      .where('volunteer_id', '=', volunteerId)
      .executeTakeFirst(),
  ]);

  if (existingApplication || existingEnrollment) {
    res.status(409);
    throw new Error('You are already enrolled or have already applied to this posting');
  }

  let enrollment: Enrollment | EnrollmentApplication | undefined;

  if (posting.automatic_acceptance) {
    enrollment = await database.transaction().execute(async (trx) => {
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

      let currentEnrollmentCount = 0;
      if (lockedPosting.max_volunteers !== undefined && lockedPosting.max_volunteers !== null) {
        const enrollmentCountRow = await trx
          .selectFrom('enrollment')
          .select(sql<number>`count(enrollment.id)`.as('count'))
          .where('posting_id', '=', id)
          .executeTakeFirst();

        currentEnrollmentCount = Number(enrollmentCountRow?.count ?? 0);

        if (currentEnrollmentCount >= lockedPosting.max_volunteers) {
          res.status(403);
          throw new Error('This posting has reached the maximum number of volunteers');
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

      return createdEnrollment;
    });
  } else {
    enrollment = await database.transaction().execute(async (trx) => {
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

      if (lockedPosting.max_volunteers !== undefined && lockedPosting.max_volunteers !== null) {
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

      return createdApplication;
    });
  }

  if (!enrollment) {
    res.status(500);
    throw new Error('Failed to create enrollment');
  }

  res.json({ enrollment, isOpen: posting.automatic_acceptance });
});

volunteerPostingRouter.delete('/:id/enroll', async (req, res: Response<VolunteerPostingWithdrawResponse>) => {
  const volunteerId = req.userJWT!.id;
  const { id } = postingIdParamsSchema.parse(req.params);

  const { existingEnrollment } = await database.transaction().execute(async (trx) => {
    const posting = await trx
      .selectFrom('organization_posting')
      .select(['id', 'automatic_acceptance'])
      .where('id', '=', id)
      .forUpdate()
      .executeTakeFirst();

    if (!posting) {
      res.status(404);
      throw new Error('Posting not found');
    }

    const existingEnrollment = await trx
      .selectFrom('enrollment')
      .select(['id', 'attended'])
      .where('volunteer_id', '=', volunteerId)
      .where('posting_id', '=', id)
      .executeTakeFirst();

    await trx
      .deleteFrom('enrollment')
      .where('volunteer_id', '=', volunteerId)
      .where('posting_id', '=', id)
      .execute();

    if (!posting.automatic_acceptance) {
      await trx
        .deleteFrom('enrollment_application')
        .where('volunteer_id', '=', volunteerId)
        .where('posting_id', '=', id)
        .execute();
    }

    return { existingEnrollment };
  });

  if (existingEnrollment?.attended) {
    await recomputeVolunteerExperienceVector(volunteerId);
  }

  res.json({});
});

export default volunteerPostingRouter;
