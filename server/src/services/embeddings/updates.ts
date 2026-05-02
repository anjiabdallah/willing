import { type Kysely, type Transaction, sql } from 'kysely';

import {
  embedText,
  parseVectorLiteral,
  vectorToSqlLiteral,
  weightedAverage,
} from './index.ts';
import { runOrDeferEmbeddingJob } from './rateLimiter.ts';
import { extractCvText } from './textExtraction.ts';
import database from '../../db/index.ts';
import { type Database, type OrganizationAccount, type Posting, type VolunteerAccountWithoutPassword } from '../../db/tables/index.ts';

type DBExecutor = Kysely<Database> | Transaction<Database>;

const EXPERIENCE_VECTOR_MAX_ENROLLMENTS = 10;
const EXPERIENCE_VECTOR_DECAY_LAMBDA = 0.35;
const ORG_HISTORY_MAX_POSTINGS = 20;
const ORG_HISTORY_DECAY_LAMBDA = 0.25;

const getRecencyRankWeight = (rank: number) => Math.exp(-EXPERIENCE_VECTOR_DECAY_LAMBDA * rank);
const getOrgHistoryRankWeight = (rank: number) => Math.exp(-ORG_HISTORY_DECAY_LAMBDA * rank);
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const cosineSimilarity = (left: number[], right: number[]) =>
  left.reduce((sum, value, index) => sum + (value * (right[index] ?? 0)), 0);

type OrganizationEmbeddingSource = Pick<OrganizationAccount, 'name' | 'description' | 'location_name'>;
type PostingEmbeddingSource = Pick<Posting, 'title' | 'description' | 'location_name' | 'start_date' | 'start_time' | 'end_date' | 'end_time' | 'minimum_age' | 'max_volunteers'>;
type VolunteerProfileEmbeddingSource = Pick<VolunteerAccountWithoutPassword, 'first_name' | 'last_name' | 'description' | 'gender'>;

const formatDate = (value: Date | undefined) => {
  if (!value) return '';
  const year = value.getUTCFullYear();
  const month = `${value.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${value.getUTCDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateTime = (date: Date | undefined, time: string | undefined) => {
  const datePart = formatDate(date);
  if (!datePart) return '';
  return `${datePart} ${time ?? ''}`.trim();
};

const updateOrganizationVector = async (organizationId: number, vector: number[], executor: DBExecutor) => {
  await executor
    .updateTable('organization_account')
    .set({
      org_context_vector: sql<string>`${vectorToSqlLiteral(vector)}::vector`,
    })
    .where('id', '=', organizationId)
    .execute();
};

const updateOrganizationProfileVector = async (organizationId: number, vector: number[], executor: DBExecutor) => {
  await executor
    .updateTable('organization_account')
    .set({
      org_profile_vector: sql<string>`${vectorToSqlLiteral(vector)}::vector`,
    })
    .where('id', '=', organizationId)
    .execute();
};

const updateOrganizationHistoryVector = async (organizationId: number, vector: number[] | null, executor: DBExecutor) => {
  if (!vector) {
    await executor
      .updateTable('organization_account')
      .set({
        org_history_vector: sql<string>`NULL`,
      })
      .where('id', '=', organizationId)
      .execute();
    return;
  }

  await executor
    .updateTable('organization_account')
    .set({
      org_history_vector: sql<string>`${vectorToSqlLiteral(vector)}::vector`,
    })
    .where('id', '=', organizationId)
    .execute();
};

const updatePostingVectors = async (
  postingId: number,
  opportunityVector: number[],
  postingContextVector: number[],
  executor: DBExecutor,
) => {
  await executor
    .updateTable('posting')
    .set({
      posting_profile_vector: sql<string>`${vectorToSqlLiteral(opportunityVector)}::vector`,
      posting_context_vector: sql<string>`${vectorToSqlLiteral(postingContextVector)}::vector`,
    })
    .where('id', '=', postingId)
    .execute();
};

const updateVolunteerProfileVector = async (volunteerId: number, profileVector: number[], executor: DBExecutor) => {
  await executor
    .updateTable('volunteer_account')
    .set({
      volunteer_profile_vector: sql<string>`${vectorToSqlLiteral(profileVector)}::vector`,
    })
    .where('id', '=', volunteerId)
    .execute();
};

const updateVolunteerExperienceVector = async (volunteerId: number, experienceVector: number[] | null, executor: DBExecutor) => {
  if (!experienceVector) {
    await executor
      .updateTable('volunteer_account')
      .set({
        volunteer_history_vector: sql<string>`NULL`,
      })
      .where('id', '=', volunteerId)
      .execute();
    return;
  }

  await executor
    .updateTable('volunteer_account')
    .set({
      volunteer_history_vector: sql<string>`${vectorToSqlLiteral(experienceVector)}::vector`,
    })
    .where('id', '=', volunteerId)
    .execute();
};

const buildOrganizationText = (organization: OrganizationEmbeddingSource) => {
  return [
    `Organization: ${organization.name}`,
    `Description: ${organization.description ?? ''}`,
    `Location: ${organization.location_name}`,
  ].join('\n');
};

const updateVolunteerContextVector = async (volunteerId: number, contextVector: number[] | null, executor: DBExecutor) => {
  if (!contextVector) {
    await executor
      .updateTable('volunteer_account')
      .set({
        volunteer_context_vector: sql<string>`NULL`,
      })
      .where('id', '=', volunteerId)
      .execute();
    return;
  }

  await executor
    .updateTable('volunteer_account')
    .set({
      volunteer_context_vector: sql<string>`${vectorToSqlLiteral(contextVector)}::vector`,
    })
    .where('id', '=', volunteerId)
    .execute();
};

const updatePostingContextVectorOnly = async (
  postingId: number,
  postingContextVector: number[],
  executor: DBExecutor,
) => {
  await executor
    .updateTable('posting')
    .set({
      posting_context_vector: sql<string>`${vectorToSqlLiteral(postingContextVector)}::vector`,
    })
    .where('id', '=', postingId)
    .execute();
};

const getOrganizationHistoricalPostingVector = async (organizationId: number, executor: DBExecutor) => {
  const rows = await executor
    .selectFrom('posting')
    .select(['posting_context_vector', 'posting_profile_vector'])
    .where('organization_id', '=', organizationId)
    .where('is_closed', '=', true)
    .orderBy('end_date', 'desc')
    .orderBy('end_time', 'desc')
    .orderBy('id', 'desc')
    .limit(ORG_HISTORY_MAX_POSTINGS)
    .execute();

  const vectors: number[][] = [];
  const weights: number[] = [];
  let validRank = 0;

  rows.forEach((row) => {
    const parsed = parseVectorLiteral(row.posting_context_vector) ?? parseVectorLiteral(row.posting_profile_vector);
    if (!parsed) return;
    vectors.push(parsed);
    weights.push(getOrgHistoryRankWeight(validRank));
    validRank += 1;
  });

  if (vectors.length === 0) return null;
  return weightedAverage(vectors, weights);
};

const buildPostingText = (posting: PostingEmbeddingSource, skills: string[]) => {
  return [
    `Title: ${posting.title}`,
    `Description: ${posting.description}`,
    `Location: ${posting.location_name}`,
    `Start: ${formatDateTime(posting.start_date, posting.start_time)}`,
    `End: ${formatDateTime(posting.end_date, posting.end_time)}`,
    `Minimum age: ${posting.minimum_age ?? ''}`,
    `Max volunteers: ${posting.max_volunteers ?? ''}`,
    `Skills: ${skills.join(', ')}`,
  ].join('\n');
};

const buildVolunteerProfileText = (volunteer: VolunteerProfileEmbeddingSource, skills: string[], cvText: string | null) => {
  return [
    `Volunteer: ${volunteer.first_name} ${volunteer.last_name}`,
    `Gender: ${volunteer.gender}`,
    `Description: ${volunteer.description ?? ''}`,
    `Skills: ${skills.join(', ')}`,
    `CV Text: ${cvText ?? ''}`,
  ].join('\n');
};

type PostingRegisteredVolunteerSignal = {
  vector: number[];
  alignedVolunteerCount: number;
  coherence: number;
};

const getPostingRegisteredVolunteerVector = async (
  postingId: number,
  intentVector: number[],
  executor: DBExecutor,
): Promise<PostingRegisteredVolunteerSignal | null> => {
  const rows = await executor
    .selectFrom('enrollment')
    .innerJoin('volunteer_account', 'volunteer_account.id', 'enrollment.volunteer_id')
    .select(['volunteer_account.volunteer_profile_vector', 'volunteer_account.volunteer_history_vector', 'volunteer_account.volunteer_context_vector'])
    .where('enrollment.posting_id', '=', postingId)
    .execute();

  const alignedVectors: number[][] = [];
  const alignedWeights: number[] = [];
  const alignmentScores: number[] = [];

  rows.forEach((row) => {
    const contextVector = parseVectorLiteral(row.volunteer_context_vector);
    const profileVector = parseVectorLiteral(row.volunteer_profile_vector);
    const experienceVector = parseVectorLiteral(row.volunteer_history_vector);

    const volunteerVector = contextVector ?? (profileVector && experienceVector
      ? weightedAverage([profileVector, experienceVector], [0.7, 0.3])
      : profileVector ?? experienceVector ?? null);

    if (!volunteerVector) return;

    const alignment = cosineSimilarity(volunteerVector, intentVector);
    const alignmentWeight = clamp01((alignment + 1) / 2);

    if (alignmentWeight < 0.45) return;

    alignedVectors.push(volunteerVector);
    alignedWeights.push(alignmentWeight);
    alignmentScores.push(alignmentWeight);
  });

  if (alignedVectors.length < 2) return null;

  return {
    vector: weightedAverage(alignedVectors, alignedWeights),
    alignedVolunteerCount: alignedVectors.length,
    coherence: alignmentScores.reduce((sum, value) => sum + value, 0) / alignmentScores.length,
  };
};

const buildPostingContextVector = async (
  postingId: number,
  opportunityVector: number[],
  organizationVector: number[],
  executor: DBExecutor,
) => {
  const postingIntentVector = weightedAverage([opportunityVector, organizationVector], [0.75, 0.25]);
  const registeredVolunteerSignal = await getPostingRegisteredVolunteerVector(postingId, postingIntentVector, executor);

  if (registeredVolunteerSignal) {
    const reliability = clamp01(((registeredVolunteerSignal.alignedVolunteerCount - 1) / 4) * registeredVolunteerSignal.coherence);
    const enrolledWeight = 0.05 + (0.15 * reliability);
    const organizationWeight = 0.25;
    const opportunityWeight = 1 - organizationWeight - enrolledWeight;
    return weightedAverage(
      [opportunityVector, organizationVector, registeredVolunteerSignal.vector],
      [opportunityWeight, organizationWeight, enrolledWeight],
    );
  }

  return weightedAverage([opportunityVector, organizationVector], [0.75, 0.25]);
};

const recomputeVolunteerExperienceVectorsForPosting = async (postingId: number, executor: DBExecutor) => {
  const volunteers = await executor
    .selectFrom('enrollment')
    .select('volunteer_id')
    .where('posting_id', '=', postingId)
    .where('attended', '=', true)
    .execute();

  const volunteerIds = Array.from(new Set(volunteers.map(volunteer => volunteer.volunteer_id)));
  for (const volunteerId of volunteerIds) {
    await recomputeVolunteerExperienceVector(volunteerId, executor);
  }
};

export const recomputeVolunteerContextVectorOnly = async (volunteerId: number, executor: DBExecutor) => {
  const volunteer = await executor
    .selectFrom('volunteer_account')
    .select(['volunteer_profile_vector', 'volunteer_history_vector'])
    .where('id', '=', volunteerId)
    .executeTakeFirst();

  if (!volunteer) return null;

  const profileVector = parseVectorLiteral(volunteer.volunteer_profile_vector);
  const experienceVector = parseVectorLiteral(volunteer.volunteer_history_vector);

  if (profileVector && experienceVector) {
    const contextVector = weightedAverage([profileVector, experienceVector], [0.75, 0.25]);
    await updateVolunteerContextVector(volunteerId, contextVector, executor);
    return contextVector;
  }

  if (profileVector) {
    await updateVolunteerContextVector(volunteerId, profileVector, executor);
    return profileVector;
  }

  if (experienceVector) {
    await updateVolunteerContextVector(volunteerId, experienceVector, executor);
    return experienceVector;
  }

  await updateVolunteerContextVector(volunteerId, null, executor);
  return null;
};

export const recomputeOrganizationVector = async (organizationId: number, executor: DBExecutor) => {
  let computedVector: number[] | null = null;
  const run = async () => {
    const organization = await executor
      .selectFrom('organization_account')
      .select(['id', 'name', 'description', 'location_name'])
      .where('id', '=', organizationId)
      .where('is_deleted', '=', false)
      .executeTakeFirstOrThrow();

    const orgProfileVector = await embedText(buildOrganizationText(organization));
    await updateOrganizationProfileVector(organization.id, orgProfileVector, executor);
    await recomputeOrganizationHistoryVectorOnly(organization.id, executor);
    const organizationWithHistory = await executor
      .selectFrom('organization_account')
      .select(['org_history_vector'])
      .where('id', '=', organization.id)
      .executeTakeFirstOrThrow();
    const historicalPostingVector = parseVectorLiteral(organizationWithHistory.org_history_vector);

    const finalOrganizationVector = historicalPostingVector
      ? weightedAverage([orgProfileVector, historicalPostingVector], [0.6, 0.4])
      : orgProfileVector;

    await updateOrganizationVector(organization.id, finalOrganizationVector, executor);
    computedVector = finalOrganizationVector;

    await recomputePostingContextVectorsForOrganization(organization.id, executor);
  };

  if (executor === database) {
    const result = await runOrDeferEmbeddingJob(`organization:${organizationId}:org_context_vector`, run);
    if (!result.executed) return null;
  } else {
    await run();
  }

  return computedVector;
};

export const recomputeOrganizationHistoryVectorOnly = async (organizationId: number, executor: DBExecutor) => {
  const organization = await executor
    .selectFrom('organization_account')
    .select(['id'])
    .where('id', '=', organizationId)
    .executeTakeFirst();

  if (!organization) return null;

  const historicalPostingVector = await getOrganizationHistoricalPostingVector(organization.id, executor);
  await updateOrganizationHistoryVector(organization.id, historicalPostingVector, executor);
  return historicalPostingVector;
};

const getOrganizationVectorOrCompute = async (organizationId: number, executor: DBExecutor) => {
  const organization = await executor
    .selectFrom('organization_account')
    .select(['org_profile_vector', 'org_history_vector', 'org_context_vector'])
    .where('id', '=', organizationId)
    .where('is_deleted', '=', false)
    .executeTakeFirstOrThrow();

  const contextVector = parseVectorLiteral(organization.org_context_vector);
  if (contextVector) return contextVector;

  const profileVector = parseVectorLiteral(organization.org_profile_vector);
  if (profileVector) {
    if (!parseVectorLiteral(organization.org_history_vector)) {
      await recomputeOrganizationHistoryVectorOnly(organizationId, executor);
    }
    await recomputeOrganizationCompositeVectorOnly(organizationId, executor);
    const refreshed = await executor
      .selectFrom('organization_account')
      .select(['org_context_vector'])
      .where('id', '=', organizationId)
      .executeTakeFirstOrThrow();
    return parseVectorLiteral(refreshed.org_context_vector);
  }

  return recomputeOrganizationVector(organizationId, executor);
};

export const recomputePostingVectors = async (postingId: number, executor: DBExecutor) => {
  let resultVectors: { opportunityVector: number[]; postingContextVector: number[] } | null = null;
  const run = async () => {
    const posting = await executor
      .selectFrom('posting')
      .select([
        'id',
        'organization_id',
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
      .executeTakeFirstOrThrow();

    const skills = await executor
      .selectFrom('posting_skill')
      .select(['name'])
      .where('posting_id', '=', posting.id)
      .execute();

    const opportunityVector = await embedText(buildPostingText(posting, skills.map(skill => skill.name)));
    const organizationVector = await getOrganizationVectorOrCompute(posting.organization_id, executor);

    if (!organizationVector) {
      console.warn(`[embeddings] Missing organization vector for posting ${posting.id}; posting_context_vector not updated.`);
      return;
    }

    const postingContextVector = await buildPostingContextVector(posting.id, opportunityVector, organizationVector, executor);
    await updatePostingVectors(posting.id, opportunityVector, postingContextVector, executor);
    await recomputeVolunteerExperienceVectorsForPosting(posting.id, executor);
    resultVectors = { opportunityVector, postingContextVector };
  };

  if (executor === database) {
    const result = await runOrDeferEmbeddingJob(`posting:${postingId}:posting_profile_vector`, run);
    if (!result.executed) return null;
  } else {
    await run();
  }

  return resultVectors;
};

export const recomputeOrganizationCompositeVectorOnly = async (organizationId: number, executor: DBExecutor) => {
  const organization = await executor
    .selectFrom('organization_account')
    .select(['id', 'org_profile_vector', 'org_history_vector'])
    .where('id', '=', organizationId)
    .executeTakeFirst();

  if (!organization) return;

  const orgProfileVector = parseVectorLiteral(organization.org_profile_vector);
  if (!orgProfileVector) return;

  const historicalPostingVector = parseVectorLiteral(organization.org_history_vector);
  const organizationCompositeVector = historicalPostingVector
    ? weightedAverage([orgProfileVector, historicalPostingVector], [0.6, 0.4])
    : orgProfileVector;

  await updateOrganizationVector(organization.id, organizationCompositeVector, executor);
};

export const recomputePostingContextVectorOnly = async (
  postingId: number,
  executor: DBExecutor,
  options?: { skipIfMissingOpportunityVector?: boolean },
) => {
  const posting = await executor
    .selectFrom('posting')
    .select(['id', 'organization_id', 'posting_profile_vector'])
    .where('id', '=', postingId)
    .executeTakeFirst();

  if (!posting) return;

  const opportunityVector = parseVectorLiteral(posting.posting_profile_vector);
  if (!opportunityVector) {
    if (options?.skipIfMissingOpportunityVector) {
      return;
    }
    await recomputePostingVectors(postingId, executor);
    return;
  }

  const organizationVector = await getOrganizationVectorOrCompute(posting.organization_id, executor);
  if (!organizationVector) return;

  const postingContextVector = await buildPostingContextVector(posting.id, opportunityVector, organizationVector, executor);
  await updatePostingContextVectorOnly(posting.id, postingContextVector, executor);
  await recomputeVolunteerExperienceVectorsForPosting(posting.id, executor);
};

export const recomputeVolunteerProfileVector = async (volunteerId: number, executor: DBExecutor) => {
  let computedProfileVector: number[] | null = null;
  const run = async () => {
    const volunteer = await executor
      .selectFrom('volunteer_account')
      .select(['id', 'first_name', 'last_name', 'description', 'gender', 'cv_path'])
      .where('id', '=', volunteerId)
      .where('is_deleted', '=', false)
      .executeTakeFirstOrThrow();

    const skills = await executor
      .selectFrom('volunteer_skill')
      .select('name')
      .where('volunteer_id', '=', volunteer.id)
      .execute();

    const cvText = await extractCvText(volunteer.cv_path);
    const profileVector = await embedText(buildVolunteerProfileText(volunteer, skills.map(skill => skill.name), cvText));

    await updateVolunteerProfileVector(volunteer.id, profileVector, executor);
    await recomputeVolunteerContextVectorOnly(volunteer.id, executor);
    computedProfileVector = profileVector;
    await recomputePostingVectorsForVolunteerEnrollments(volunteer.id, executor);
  };

  if (executor === database) {
    const result = await runOrDeferEmbeddingJob(`volunteer:${volunteerId}:volunteer_profile_vector`, run);
    if (!result.executed) return null;
  } else {
    await run();
  }

  return computedProfileVector;
};

export const recomputePostingVectorsForVolunteerEnrollments = async (volunteerId: number, executor: DBExecutor) => {
  const rows = await executor
    .selectFrom('enrollment')
    .select('posting_id')
    .where('volunteer_id', '=', volunteerId)
    .execute();

  const postingIds = Array.from(new Set(rows.map(row => row.posting_id)));
  for (const postingId of postingIds) {
    await recomputePostingContextVectorOnly(postingId, executor);
  }
};

export const recomputeVolunteerExperienceVector = async (volunteerId: number, executor: DBExecutor) => {
  const rows = await executor
    .selectFrom('enrollment')
    .innerJoin('posting', 'posting.id', 'enrollment.posting_id')
    .select(['posting.posting_context_vector'])
    .where('enrollment.volunteer_id', '=', volunteerId)
    .where('enrollment.attended', '=', true)
    .orderBy('enrollment.created_at', 'desc')
    .orderBy('enrollment.id', 'desc')
    .limit(EXPERIENCE_VECTOR_MAX_ENROLLMENTS)
    .execute();

  const vectors: number[][] = [];
  const weights: number[] = [];
  let validRank = 0;

  rows.forEach((row) => {
    const parsed = parseVectorLiteral(row.posting_context_vector);
    if (!parsed) return;
    vectors.push(parsed);
    weights.push(getRecencyRankWeight(validRank));
    validRank += 1;
  });

  if (vectors.length === 0) {
    if (rows.length === 0) {
      console.info(`[embeddings] No attended experiences found for volunteer ${volunteerId}. Leaving volunteer_history_vector as NULL.`);
    } else {
      console.warn(`[embeddings] Attended enrollments exist for volunteer ${volunteerId}, but no valid posting_context_vector values were found.`);
    }
    await updateVolunteerExperienceVector(volunteerId, null, executor);
    await recomputeVolunteerContextVectorOnly(volunteerId, executor);
    return null;
  }

  // More recent experiences receive higher rank-based weights.
  const experienceVector = weightedAverage(vectors, weights);
  await updateVolunteerExperienceVector(volunteerId, experienceVector, executor);
  await recomputeVolunteerContextVectorOnly(volunteerId, executor);
  return experienceVector;
};

export const recomputePostingContextVectorsForOrganization = async (organizationId: number, executor: DBExecutor) => {
  const organization = await executor
    .selectFrom('organization_account')
    .select(['org_context_vector'])
    .where('id', '=', organizationId)
    .where('is_deleted', '=', false)
    .executeTakeFirstOrThrow();

  const orgVector = parseVectorLiteral(organization.org_context_vector);
  if (!orgVector) return;

  const postings = await executor
    .selectFrom('posting')
    .select(['id', 'posting_profile_vector'])
    .where('organization_id', '=', organizationId)
    .execute();

  for (const posting of postings) {
    const opportunityVector = parseVectorLiteral(posting.posting_profile_vector);
    if (!opportunityVector) {
      await recomputePostingVectors(posting.id, executor);
      continue;
    }

    const postingContextVector = await buildPostingContextVector(posting.id, opportunityVector, orgVector, executor);
    await executor
      .updateTable('posting')
      .set({
        posting_context_vector: sql<string>`${vectorToSqlLiteral(postingContextVector)}::vector`,
      })
      .where('id', '=', posting.id)
      .execute();
    await recomputeVolunteerExperienceVectorsForPosting(posting.id, executor);
  }
};

export const recomputeVolunteerVectors = async (volunteerId: number, executor: DBExecutor) => {
  const [profileVector, experienceVector] = await Promise.all([
    recomputeVolunteerProfileVector(volunteerId, executor),
    recomputeVolunteerExperienceVector(volunteerId, executor),
  ]);

  return { profileVector, experienceVector };
};
