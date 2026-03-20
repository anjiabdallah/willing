import { Router, Response } from 'express';
import { sql } from 'kysely';
import zod from 'zod';

import attendanceRouter from './attendance.js';
import {
  OrganizationPostingApplicationAcceptanceResponse,
  OrganizationPostingApplicationRejectionResponse,
  OrganizationPostingApplicationsReponse,
  OrganizationPostingCreateResponse,
  OrganizationPostingDeleteResponse,
  OrganizationPostingEnrollmentsResponse,
  OrganizationPostingListResponse,
  OrganizationPostingResponse,
  OrganizationPostingUpdateResponse,
} from './posting.types.js';
import { getPostingEnrollments } from './postingEnrollments.js';
import database from '../../../db/index.js';
import {
  newOrganizationPostingSchema,
  type NewOrganizationPosting,
  type PostingSkill,
} from '../../../db/tables.js';
import {
  recomputePostingVectors,
  recomputeVolunteerExperienceVector,
} from '../../../services/embeddings/updates.js';
import {
  sendVolunteerApplicationAcceptedEmail,
  sendVolunteerApplicationRejectedEmail,
} from '../../../services/smtp/emails.js';

const postingRouter = Router();
const organizationPostingUpdateSchema = newOrganizationPostingSchema.partial().extend({
  crisis_id: zod.number().int().positive().nullable().optional(),
});
const postingStartTimestampExpression = sql<Date>`(organization_posting.start_date + organization_posting.start_time)`.as('start_timestamp');
const postingEndTimestampExpression = sql<Date | undefined>`CASE WHEN organization_posting.end_date IS NULL OR organization_posting.end_time IS NULL THEN NULL ELSE (organization_posting.end_date + organization_posting.end_time) END`.as('end_timestamp');
const organizationPostingResponseColumns = [
  'organization_posting.id',
  'organization_posting.organization_id',
  'organization_posting.crisis_id',
  'organization_posting.title',
  'organization_posting.description',
  'organization_posting.latitude',
  'organization_posting.longitude',
  'organization_posting.max_volunteers',
  postingStartTimestampExpression,
  postingEndTimestampExpression,
  'organization_posting.start_date',
  'organization_posting.start_time',
  'organization_posting.end_date',
  'organization_posting.end_time',
  'organization_posting.minimum_age',
  'organization_posting.automatic_acceptance',
  'organization_posting.is_closed',
  'organization_posting.location_name',
  'organization_posting.created_at',
  'organization_posting.updated_at',
] as const;

const normalizeSkillList = (skills: string[]) => Array.from(new Set(skills.map(skill => skill.trim()).filter(Boolean))).sort();
const areSkillListsEqual = (left: string[], right: string[]) => {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
};
const areDatesEqual = (left: Date | undefined, right: Date | undefined) => (left?.getTime() ?? null) === (right?.getTime() ?? null);
const areTimeValuesEqual = (left: string | undefined, right: string | undefined) => (left ?? null) === (right ?? null);
const isPostingFull = (maxVolunteers: number | undefined, enrollmentCount: number) => maxVolunteers !== undefined
  && maxVolunteers !== null
  && enrollmentCount >= maxVolunteers;

const toPostingDate = (value: Date) => {
  const year = value.getUTCFullYear();
  const month = `${value.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${value.getUTCDate()}`.padStart(2, '0');
  return new Date(`${year}-${month}-${day}T00:00:00.000Z`);
};

const toPostingTime = (value: Date) => {
  const hours = `${value.getUTCHours()}`.padStart(2, '0');
  const minutes = `${value.getUTCMinutes()}`.padStart(2, '0');
  const seconds = `${value.getUTCSeconds()}`.padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
};

const normalizePostingTemporalFields = (posting: {
  start_timestamp: Date;
  end_timestamp?: Date | undefined;
  start_date?: Date | undefined;
  start_time?: string | undefined;
  end_date?: Date | undefined;
  end_time?: string | undefined;
}) => ({
  start_date: posting.start_date ?? toPostingDate(posting.start_timestamp),
  start_time: posting.start_time ?? toPostingTime(posting.start_timestamp),
  end_date: posting.end_date ?? (posting.end_timestamp ? toPostingDate(posting.end_timestamp) : undefined),
  end_time: posting.end_time ?? (posting.end_timestamp ? toPostingTime(posting.end_timestamp) : undefined),
});

const postingIdParamsSchema = zod.object({
  id: zod.coerce.number().int().positive('ID must be a positive number'),
});

const assertCrisisExists = async (crisisId: number, res: Response) => {
  const crisis = await database
    .selectFrom('crisis')
    .select(['id'])
    .where('id', '=', crisisId)
    .executeTakeFirst();

  if (!crisis) {
    res.status(400);
    throw new Error('Selected crisis tag does not exist');
  }
};

const getPostingCrisis = async (crisisId: number | undefined | null) => {
  if (crisisId == null) return undefined;

  return database
    .selectFrom('crisis')
    .selectAll()
    .where('id', '=', crisisId)
    .executeTakeFirst();
};

postingRouter.post('/', async (req, res: Response<OrganizationPostingCreateResponse>) => {
  const body: NewOrganizationPosting = newOrganizationPostingSchema.parse(req.body);
  const orgId = req.userJWT!.id;
  const {
    skills,
    ...postingBody
  } = body;

  if (body.crisis_id !== undefined) {
    await assertCrisisExists(body.crisis_id, res);
  }

  const result = await database.transaction().execute(async (trx) => {
    const postingInsertValues = {
      organization_id: orgId,
      ...postingBody,
    };

    const newPosting = await trx
      .insertInto('organization_posting')
      .values(postingInsertValues as never)
      .returning('id')
      .executeTakeFirst();

    if (!newPosting) {
      throw new Error('Failed to create posting');
    }

    if (skills && skills.length > 0) {
      const skillRows = skills.map(skill => ({
        posting_id: newPosting.id,
        name: skill,
      }));

      await trx.insertInto('posting_skill').values(skillRows).execute();
    }

    return { postingId: newPosting.id };
  });

  await recomputePostingVectors(result.postingId);

  const posting = await database
    .selectFrom('organization_posting')
    .select(organizationPostingResponseColumns)
    .where('id', '=', result.postingId)
    .executeTakeFirstOrThrow();

  const insertedSkills: PostingSkill[] = await database
    .selectFrom('posting_skill')
    .selectAll()
    .where('posting_id', '=', result.postingId)
    .execute();

  res.json({ posting, skills: insertedSkills });
});

postingRouter.get('/', async (req, res: Response<OrganizationPostingListResponse>) => {
  const orgId = req.userJWT!.id;

  const postings = await database
    .selectFrom('organization_posting')
    .select(organizationPostingResponseColumns)
    .where('organization_id', '=', orgId)
    .orderBy('organization_posting.start_date', 'asc')
    .orderBy('organization_posting.start_time', 'asc')
    .execute();

  const postingIds = postings.map(p => p.id);
  const skills = postingIds.length > 0
    ? await database
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

  const posting = await database
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
    database
      .selectFrom('posting_skill')
      .selectAll()
      .where('posting_id', '=', postingId)
      .execute(),
    getPostingCrisis(posting.crisis_id),
    database
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

  const posting = await database
    .selectFrom('organization_posting')
    .select(['id'])
    .where('organization_posting.id', '=', postingId)
    .where('organization_posting.organization_id', '=', orgId)
    .executeTakeFirst();

  if (!posting) {
    res.status(404);
    throw new Error('Posting not found');
  }
  const enrollments = await getPostingEnrollments(postingId);
  res.json({ enrollments });
});

postingRouter.put('/:id', async (req, res: Response<OrganizationPostingUpdateResponse>) => {
  const orgId = req.userJWT!.id;
  const { id: postingId } = postingIdParamsSchema.parse(req.params);
  const body = organizationPostingUpdateSchema.parse(req.body);

  const posting = await database
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
    ])
    .where('id', '=', postingId)
    .where('organization_id', '=', orgId)
    .executeTakeFirst();

  if (!posting) {
    res.status(404);
    throw new Error('Posting not found');
  }

  if (body.crisis_id !== undefined && body.crisis_id !== null && body.crisis_id !== posting.crisis_id) {
    await assertCrisisExists(body.crisis_id, res);
  }

  const existingSkills = await database
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

  await database.transaction().execute(async (trx) => {
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
          .values(normalizedIncomingSkills.map(name => ({
            posting_id: postingId,
            name,
          })))
          .execute();
      }
    }
  });

  if (shouldRecomputePostingVectors) {
    await recomputePostingVectors(postingId);
  }

  const updatedPosting = await database
    .selectFrom('organization_posting')
    .select(organizationPostingResponseColumns)
    .where('id', '=', postingId)
    .where('organization_id', '=', orgId)
    .executeTakeFirstOrThrow();

  const [skills, crisis] = await Promise.all([
    database
      .selectFrom('posting_skill')
      .selectAll()
      .where('posting_id', '=', postingId)
      .execute(),
    getPostingCrisis(updatedPosting.crisis_id),
  ]);

  res.json({
    posting: updatedPosting,
    skills,
    ...(crisis ? { crisis } : {}),
  });
});

postingRouter.delete('/:id', async (req, res: Response<OrganizationPostingDeleteResponse>) => {
  const orgId = req.userJWT!.id;
  const { id: postingId } = postingIdParamsSchema.parse(req.params);

  const posting = await database
    .selectFrom('organization_posting')
    .select(['id'])
    .where('id', '=', postingId)
    .where('organization_id', '=', orgId)
    .executeTakeFirst();

  if (!posting) {
    res.status(404);
    throw new Error('Posting not found');
  }

  const impactedVolunteerRows = await database
    .selectFrom('enrollment')
    .select('volunteer_id')
    .where('posting_id', '=', postingId)
    .where('attended', '=', true)
    .execute();

  await database.transaction().execute(async (trx) => {
    await trx.deleteFrom('posting_skill').where('posting_id', '=', postingId).execute();
    await trx.deleteFrom('enrollment_application').where('posting_id', '=', postingId).execute();
    await trx.deleteFrom('enrollment').where('posting_id', '=', postingId).execute();
    await trx.deleteFrom('organization_posting').where('id', '=', postingId).execute();
  });

  const impactedVolunteerIds = Array.from(new Set(impactedVolunteerRows.map(row => row.volunteer_id)));
  for (const volunteerId of impactedVolunteerIds) {
    await recomputeVolunteerExperienceVector(volunteerId);
  }

  res.json({});
});

postingRouter.get('/:id/applications', async (req, res: Response<OrganizationPostingApplicationsReponse>) => {
  const orgId = req.userJWT!.id;
  const { id: postingId } = postingIdParamsSchema.parse(req.params);

  const posting = await database
    .selectFrom('organization_posting')
    .select(['id', 'automatic_acceptance', 'is_closed', 'max_volunteers'])
    .where('organization_posting.id', '=', postingId)
    .where('organization_posting.organization_id', '=', orgId)
    .executeTakeFirst();

  if (!posting) {
    res.status(404);
    throw new Error('Posting not found');
  }

  if (posting.automatic_acceptance) {
    res.json({ applications: [] });
    return;
  }

  const applications = await database
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
    ? await database
        .selectFrom('volunteer_skill')
        .selectAll()
        .where('volunteer_id', 'in', volunteerIds)
        .execute()
    : [];

  const skillsByVolunteerId = new Map<number, typeof skills>();
  skills.forEach((skill) => {
    if (!skillsByVolunteerId.has(skill.volunteer_id)) {
      skillsByVolunteerId.set(skill.volunteer_id, []);
    }
    skillsByVolunteerId.get(skill.volunteer_id)!.push(skill);
  });

  const applicationsWithSkills = applications.map(app => ({
    ...app,
    skills: skillsByVolunteerId.get(app.volunteer_id) || [],
  }));

  res.json({ applications: applicationsWithSkills });
});

postingRouter.post('/:id/applications/:applicationId/accept', async (req, res: Response<OrganizationPostingApplicationAcceptanceResponse>) => {
  const orgId = req.userJWT!.id;
  const { id: postingId, applicationId } = zod.object({
    id: zod.coerce.number().int().positive(),
    applicationId: zod.coerce.number().int().positive(),
  }).parse(req.params);

  const posting = await database
    .selectFrom('organization_posting')
    .select(['id', 'automatic_acceptance', 'is_closed', 'max_volunteers'])
    .where('organization_posting.id', '=', postingId)
    .where('organization_posting.organization_id', '=', orgId)
    .executeTakeFirst();

  if (!posting) {
    res.status(404);
    throw new Error('Posting not found');
  }

  if (posting.automatic_acceptance) {
    res.status(400);
    throw new Error('Cannot accept applications for open postings');
  }

  const application = await database
    .selectFrom('enrollment_application')
    .select([
      'enrollment_application.id',
      'enrollment_application.volunteer_id',
      'enrollment_application.posting_id',
      'enrollment_application.message',
    ])
    .where('enrollment_application.id', '=', applicationId)
    .executeTakeFirst();

  if (!application) {
    res.status(404);
    throw new Error('Application not found');
  }

  if (application.posting_id !== postingId) {
    res.status(403);
    throw new Error('Application does not belong to this posting');
  }
  const emailContext = await database
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
  await database.transaction().execute(async (trx) => {
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
        attended: true,
      })
      .returningAll()
      .executeTakeFirst();

    if (!enrollment) {
      throw new Error('Failed to create enrollment');
    }

    await trx
      .deleteFrom('enrollment_application')
      .where('id', '=', applicationId)
      .execute();
  });
  if (emailContext) {
    try {
      await sendVolunteerApplicationAcceptedEmail({
        volunteerEmail: emailContext.volunteer_email,
        volunteerName: `${emailContext.first_name} ${emailContext.last_name}`,
        organizationName: emailContext.organization_name,
        postingTitle: emailContext.posting_title,
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

  const posting = await database
    .selectFrom('organization_posting')
    .select(['id', 'automatic_acceptance'])
    .where('organization_posting.id', '=', postingId)
    .where('organization_posting.organization_id', '=', orgId)
    .executeTakeFirst();

  if (!posting) {
    res.status(404);
    throw new Error('Posting not found');
  }

  const application = await database
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
  const emailContext = await database
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

  await database
    .deleteFrom('enrollment_application')
    .where('id', '=', applicationId)
    .execute();
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

postingRouter.use(attendanceRouter);

export default postingRouter;
