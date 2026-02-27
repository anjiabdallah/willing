import { Router } from 'express';
import zod from 'zod';

import database from '../../../db/index.js';
import { newOrganizationPostingSchema, type NewOrganizationPosting, type PostingSkill } from '../../../db/tables.js';
import { recomputePostingVectors } from '../../../services/embeddingUpdateService.js';

const postingRouter = Router();
const organizationPostingUpdateSchema = newOrganizationPostingSchema.partial();
const normalizeSkillList = (skills: string[]) => Array.from(new Set(skills.map(skill => skill.trim()).filter(Boolean))).sort();
const areSkillListsEqual = (left: string[], right: string[]) => {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
};
const areDatesEqual = (left: Date | undefined, right: Date | undefined) => (left?.getTime() ?? null) === (right?.getTime() ?? null);

postingRouter.post('/', async (req, res) => {
  const body: NewOrganizationPosting = newOrganizationPostingSchema.parse(req.body);
  const orgId = req.userJWT!.id;

  const result = await database.transaction().execute(async (trx) => {
    const newPosting = await trx
      .insertInto('organization_posting')
      .values({
        organization_id: orgId,
        title: body.title,
        description: body.description,
        latitude: body.latitude ?? undefined,
        longitude: body.longitude ?? undefined,
        max_volunteers: body.max_volunteers ?? undefined,
        start_timestamp: body.start_timestamp,
        end_timestamp: body.end_timestamp ?? undefined,
        minimum_age: body.minimum_age ?? undefined,
        is_open: body.is_open ?? true,
        location_name: body.location_name,
      })
      .returningAll()
      .executeTakeFirst();

    if (!newPosting) {
      throw new Error('Failed to create posting');
    }

    if (body.skills && body.skills.length > 0) {
      const skillRows = body.skills.map(skill => ({
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
    .selectAll()
    .where('id', '=', result.postingId)
    .executeTakeFirstOrThrow();

  const skills: PostingSkill[] = await database
    .selectFrom('posting_skill')
    .selectAll()
    .where('posting_id', '=', result.postingId)
    .execute();

  res.json({ posting, skills });
});

postingRouter.put('/:postingId', async (req, res) => {
  const postingId = zod.coerce.number().parse(req.params.postingId);
  const orgId = req.userJWT!.id;
  const body = organizationPostingUpdateSchema.parse(req.body);

  const posting = await database
    .selectFrom('organization_posting')
    .select([
      'id',
      'title',
      'description',
      'location_name',
      'start_timestamp',
      'end_timestamp',
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
    || (body.start_timestamp !== undefined && !areDatesEqual(body.start_timestamp, posting.start_timestamp))
    || (body.end_timestamp !== undefined && !areDatesEqual(body.end_timestamp, posting.end_timestamp))
    || (body.minimum_age !== undefined && (body.minimum_age ?? null) !== (posting.minimum_age ?? null))
    || (body.max_volunteers !== undefined && (body.max_volunteers ?? null) !== (posting.max_volunteers ?? null))
    || didSkillsChange
  );

  const result = await database.transaction().execute(async (trx) => {
    const postingFields: Record<string, unknown> = {};

    if (body.title !== undefined) postingFields.title = body.title;
    if (body.description !== undefined) postingFields.description = body.description;
    if (body.latitude !== undefined) postingFields.latitude = body.latitude;
    if (body.longitude !== undefined) postingFields.longitude = body.longitude;
    if (body.max_volunteers !== undefined) postingFields.max_volunteers = body.max_volunteers;
    if (body.start_timestamp !== undefined) postingFields.start_timestamp = body.start_timestamp;
    if (body.end_timestamp !== undefined) postingFields.end_timestamp = body.end_timestamp;
    if (body.minimum_age !== undefined) postingFields.minimum_age = body.minimum_age;
    if (body.is_open !== undefined) postingFields.is_open = body.is_open;
    if (body.location_name !== undefined) postingFields.location_name = body.location_name;

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
    return { postingId };
  });

  if (shouldRecomputePostingVectors) {
    await recomputePostingVectors(result.postingId);
  }

  const postingWithVectors = await database
    .selectFrom('organization_posting')
    .selectAll()
    .where('id', '=', postingId)
    .where('organization_id', '=', orgId)
    .executeTakeFirstOrThrow();

  const skills = await database
    .selectFrom('posting_skill')
    .selectAll()
    .where('posting_id', '=', postingId)
    .execute();

  res.json({ posting: postingWithVectors, skills });
});

postingRouter.get('/', async (req, res) => {
  const orgId = req.userJWT!.id;

  const postings = await database
    .selectFrom('organization_posting')
    .selectAll()
    .where('organization_id', '=', orgId)
    .orderBy('start_timestamp', 'asc')
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

  const postingsWithSkills = postings.map(posting => ({
    ...posting,
    skills: skillsByPostingId.get(posting.id) || [],
  }));

  res.json({ posting: postingsWithSkills });
});

export default postingRouter;
