import { Kysely, Transaction, sql } from 'kysely';

import { runOrDeferEmbeddingJob } from './embeddingRateLimiter.js';
import {
  combineVectors,
  deterministicFallbackVector,
  embedText,
  parseVectorLiteral,
  vectorToSqlLiteral,
} from './embeddingService.js';
import database from '../db/index.js';
import { Database } from '../db/tables.js';

type DBExecutor = Kysely<Database> | Transaction<Database>;

const updateOrganizationVector = async (orgId: number, vector: number[], executor: DBExecutor) => {
  await sql`
    UPDATE organization_account
    SET org_vector = ${vectorToSqlLiteral(vector)}::vector
    WHERE id = ${orgId}
  `.execute(executor);
};

const updatePostingVectors = async (
  postingId: number,
  opportunityVector: number[],
  postingContextVector: number[],
  executor: DBExecutor,
) => {
  await sql`
    UPDATE organization_posting
    SET
      opportunity_vector = ${vectorToSqlLiteral(opportunityVector)}::vector,
      posting_context_vector = ${vectorToSqlLiteral(postingContextVector)}::vector
    WHERE id = ${postingId}
  `.execute(executor);
};

const updateVolunteerProfileVector = async (volunteerId: number, profileVector: number[], executor: DBExecutor) => {
  await sql`
    UPDATE volunteer_account
    SET profile_vector = ${vectorToSqlLiteral(profileVector)}::vector
    WHERE id = ${volunteerId}
  `.execute(executor);
};

const buildOrganizationText = (organization: {
  name: string;
  url: string;
  location_name: string;
  latitude: number | undefined;
  longitude: number | undefined;
}) => {
  return [
    `Organization: ${organization.name}`,
    `Website: ${organization.url}`,
    `Location: ${organization.location_name}`,
    `Coordinates: ${organization.latitude ?? ''}, ${organization.longitude ?? ''}`,
  ].join('\n');
};

const buildPostingText = (posting: {
  title: string;
  description: string;
  location_name: string;
  start_timestamp: Date;
  end_timestamp: Date | undefined;
  minimum_age: number | undefined;
  max_volunteers: number | undefined;
}, skills: string[]) => {
  return [
    `Title: ${posting.title}`,
    `Description: ${posting.description}`,
    `Location: ${posting.location_name}`,
    `Start: ${posting.start_timestamp.toISOString()}`,
    `End: ${posting.end_timestamp?.toISOString() ?? ''}`,
    `Minimum age: ${posting.minimum_age ?? ''}`,
    `Max volunteers: ${posting.max_volunteers ?? ''}`,
    `Skills: ${skills.join(', ')}`,
  ].join('\n');
};

const buildVolunteerProfileText = (volunteer: {
  first_name: string;
  last_name: string;
  description: string | undefined;
  gender: 'male' | 'female' | 'other';
}, skills: string[]) => {
  return [
    `Volunteer: ${volunteer.first_name} ${volunteer.last_name}`,
    `Gender: ${volunteer.gender}`,
    `Description: ${volunteer.description ?? ''}`,
    `Skills: ${skills.join(', ')}`,
  ].join('\n');
};

export const recomputeOrganizationVector = async (organizationId: number, executor: DBExecutor = database) => {
  let computedVector: number[] | null = null;
  const run = async () => {
    const organization = await executor
      .selectFrom('organization_account')
      .select(['id', 'name', 'url', 'location_name', 'latitude', 'longitude'])
      .where('id', '=', organizationId)
      .executeTakeFirstOrThrow();

    const vector = await embedText(buildOrganizationText(organization));
    await updateOrganizationVector(organization.id, vector, executor);
    computedVector = vector;

    await recomputePostingContextVectorsForOrganization(organization.id, executor);
  };

  if (executor === database) {
    const result = await runOrDeferEmbeddingJob(`organization:${organizationId}:org_vector`, run);
    if (!result.executed) return null;
    return computedVector;
  }

  await run();
  return computedVector;
};

const getOrganizationVectorOrCompute = async (organizationId: number, executor: DBExecutor) => {
  const organization = await executor
    .selectFrom('organization_account')
    .select(['org_vector'])
    .where('id', '=', organizationId)
    .executeTakeFirstOrThrow();

  const parsed = parseVectorLiteral(organization.org_vector);
  if (parsed) return parsed;

  return recomputeOrganizationVector(organizationId, executor);
};

export const recomputePostingVectors = async (postingId: number, executor: DBExecutor = database) => {
  let resultVectors: { opportunityVector: number[]; postingContextVector: number[] } | null = null;
  const run = async () => {
    const posting = await executor
      .selectFrom('organization_posting')
      .select([
        'id',
        'organization_id',
        'title',
        'description',
        'location_name',
        'start_timestamp',
        'end_timestamp',
        'minimum_age',
        'max_volunteers',
      ])
      .where('id', '=', postingId)
      .executeTakeFirstOrThrow();

    const skills = await executor
      .selectFrom('posting_skill')
      .select(['name'])
      .where('posting_id', '=', posting.id)
      .execute();

    const opportunityVector = await embedText(
      buildPostingText(posting, skills.map(skill => skill.name)),
    );

    const orgVector = await getOrganizationVectorOrCompute(posting.organization_id, executor);
    const resolvedOrganizationVector = orgVector ?? deterministicFallbackVector(`organization:${posting.organization_id}:missing-org-vector`);
    const postingContextVector = combineVectors(opportunityVector, resolvedOrganizationVector, 0.7, 0.3);
    await updatePostingVectors(posting.id, opportunityVector, postingContextVector, executor);
    resultVectors = { opportunityVector, postingContextVector };
  };

  if (executor === database) {
    const result = await runOrDeferEmbeddingJob(`posting:${postingId}:opportunity_vector`, run);
    if (!result.executed) return null;
    return resultVectors;
  }

  await run();
  return resultVectors;
};

export const recomputeVolunteerProfileVector = async (volunteerId: number, executor: DBExecutor = database) => {
  let profileVector: number[] | null = null;
  const run = async () => {
    const volunteer = await executor
      .selectFrom('volunteer_account')
      .select(['id', 'first_name', 'last_name', 'description', 'gender'])
      .where('id', '=', volunteerId)
      .executeTakeFirstOrThrow();

    const skills = await executor
      .selectFrom('volunteer_skill')
      .select('name')
      .where('volunteer_id', '=', volunteer.id)
      .execute();

    const nextProfileVector = await embedText(
      buildVolunteerProfileText(volunteer, skills.map(skill => skill.name)),
    );
    await updateVolunteerProfileVector(volunteer.id, nextProfileVector, executor);
    profileVector = nextProfileVector;
  };

  if (executor === database) {
    const result = await runOrDeferEmbeddingJob(`volunteer:${volunteerId}:profile_vector`, run);
    if (!result.executed) return null;
    return profileVector;
  }

  await run();
  return profileVector;
};

export const recomputePostingContextVectorsForOrganization = async (organizationId: number, executor: DBExecutor = database) => {
  const organization = await executor
    .selectFrom('organization_account')
    .select(['org_vector'])
    .where('id', '=', organizationId)
    .executeTakeFirstOrThrow();

  const orgVector = parseVectorLiteral(organization.org_vector);
  if (!orgVector) return;

  const postings = await executor
    .selectFrom('organization_posting')
    .select(['id', 'opportunity_vector'])
    .where('organization_id', '=', organizationId)
    .execute();

  for (const posting of postings) {
    const opportunityVector = parseVectorLiteral(posting.opportunity_vector);
    if (!opportunityVector) {
      await recomputePostingVectors(posting.id, executor);
      continue;
    }

    const postingContextVector = combineVectors(opportunityVector, orgVector, 0.7, 0.3);
    await sql`
      UPDATE organization_posting
      SET posting_context_vector = ${vectorToSqlLiteral(postingContextVector)}::vector
      WHERE id = ${posting.id}
    `.execute(executor);
  }
};
