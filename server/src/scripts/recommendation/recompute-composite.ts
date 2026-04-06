import config from '../../config.ts';
import database from '../../db/index.ts';
import {
  recomputeOrganizationHistoryVectorOnly,
  recomputeOrganizationCompositeVectorOnly,
  recomputePostingContextVectorOnly,
  recomputeVolunteerExperienceVector,
} from '../../services/embeddings/updates.ts';

const getIds = async () => {
  const [organizationRows, postingRows, volunteerRows] = await Promise.all([
    database.selectFrom('organization_account').select('id').orderBy('id', 'asc').execute(),
    database.selectFrom('organization_posting').select('id').orderBy('id', 'asc').execute(),
    database.selectFrom('volunteer_account').select('id').orderBy('id', 'asc').execute(),
  ]);

  return {
    organizationIds: organizationRows.map(row => row.id),
    postingIds: postingRows.map(row => row.id),
    volunteerIds: volunteerRows.map(row => row.id),
  };
};

const getMissingCounts = async () => {
  const [orgProfile, orgHistory, orgContext, opp, ctx, profile, experience, volunteerContext] = await Promise.all([
    database.selectFrom('organization_account').select(eb => eb.fn.countAll().as('count')).where('org_profile_vector', 'is', null).executeTakeFirstOrThrow(),
    database.selectFrom('organization_account').select(eb => eb.fn.countAll().as('count')).where('org_history_vector', 'is', null).executeTakeFirstOrThrow(),
    database.selectFrom('organization_account').select(eb => eb.fn.countAll().as('count')).where('org_context_vector', 'is', null).executeTakeFirstOrThrow(),
    database.selectFrom('organization_posting').select(eb => eb.fn.countAll().as('count')).where('posting_profile_vector', 'is', null).executeTakeFirstOrThrow(),
    database.selectFrom('organization_posting').select(eb => eb.fn.countAll().as('count')).where('posting_context_vector', 'is', null).executeTakeFirstOrThrow(),
    database.selectFrom('volunteer_account').select(eb => eb.fn.countAll().as('count')).where('volunteer_profile_vector', 'is', null).executeTakeFirstOrThrow(),
    database.selectFrom('volunteer_account').select(eb => eb.fn.countAll().as('count')).where('volunteer_history_vector', 'is', null).executeTakeFirstOrThrow(),
    database.selectFrom('volunteer_account').select(eb => eb.fn.countAll().as('count')).where('volunteer_context_vector', 'is', null).executeTakeFirstOrThrow(),
  ]);

  return {
    orgProfileMissing: Number(orgProfile.count),
    orgHistoryMissing: Number(orgHistory.count),
    orgContextMissing: Number(orgContext.count),
    opportunityMissing: Number(opp.count),
    postingContextMissing: Number(ctx.count),
    profileMissing: Number(profile.count),
    experienceMissing: Number(experience.count),
    volunteerContextMissing: Number(volunteerContext.count),
  };
};

async function recomputeCompositeVectors() {
  if (config.NODE_ENV === 'production') {
    throw new Error('Refusing to recompute composite vectors in production.');
  }

  const { organizationIds, postingIds, volunteerIds } = await getIds();

  console.log('Starting composite-only vector recomputation (no OpenAI embedding calls)...');
  console.log(`Organizations: ${organizationIds.length}, Postings: ${postingIds.length}, Volunteers: ${volunteerIds.length}`);

  for (const organizationId of organizationIds) {
    await recomputeOrganizationHistoryVectorOnly(organizationId, database);
    await recomputeOrganizationCompositeVectorOnly(organizationId, database);
  }

  for (const postingId of postingIds) {
    await recomputePostingContextVectorOnly(postingId, database, { skipIfMissingOpportunityVector: true });
  }

  for (const volunteerId of volunteerIds) {
    await recomputeVolunteerExperienceVector(volunteerId, database);
  }

  const missing = await getMissingCounts();
  console.log(
    `Missing vectors: org_profile=${missing.orgProfileMissing}, org_history=${missing.orgHistoryMissing}, org_context=${missing.orgContextMissing}, opportunity=${missing.opportunityMissing}, posting_context=${missing.postingContextMissing}, profile=${missing.profileMissing}, experience=${missing.experienceMissing}, volunteer_context=${missing.volunteerContextMissing}`,
  );
}

recomputeCompositeVectors()
  .catch((error) => {
    console.error('Recompute composite vectors failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await database.destroy();
  });
