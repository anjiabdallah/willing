import { warnBeforeOpenAiCalls } from './warnings.ts';
import config from '../../config.ts';
import executeTransaction from '../../db/executeTransaction.ts';
import database from '../../db/index.ts';
import {
  recomputeOrganizationVector,
  recomputePostingVectors,
  recomputeVolunteerExperienceVector,
  recomputeVolunteerProfileVector,
} from '../../services/embeddings/updates.ts';

const MAX_PASSES = 3;

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
    contextMissing: Number(ctx.count),
    profileMissing: Number(profile.count),
    experienceMissing: Number(experience.count),
    volunteerContextMissing: Number(volunteerContext.count),
  };
};

async function recomputeAllEmbeddings() {
  if (config.NODE_ENV === 'production') {
    throw new Error('Refusing to recompute all embeddings in production.');
  }
  await warnBeforeOpenAiCalls({
    countdownSeconds: 5,
    force: process.argv.includes('--yes') || process.env.SKIP_OPENAI_WARNING === 'true',
  });

  const { organizationIds, postingIds, volunteerIds } = await getIds();

  console.log('Starting full embedding recomputation...');
  console.log(`Organizations: ${organizationIds.length}, Postings: ${postingIds.length}, Volunteers: ${volunteerIds.length}`);

  for (let pass = 1; pass <= MAX_PASSES; pass += 1) {
    console.log(`\nPass ${pass}/${MAX_PASSES}`);

    for (const organizationId of organizationIds) {
      await executeTransaction(database, async (trx) => {
        await recomputeOrganizationVector(organizationId, trx);
      });
    }

    for (const postingId of postingIds) {
      await executeTransaction(database, async (trx) => {
        await recomputePostingVectors(postingId, trx);
      });
    }

    for (const volunteerId of volunteerIds) {
      await executeTransaction(database, async (trx) => {
        await recomputeVolunteerProfileVector(volunteerId, trx);
      });
    }

    for (const volunteerId of volunteerIds) {
      await executeTransaction(database, async (trx) => {
        await recomputeVolunteerExperienceVector(volunteerId, trx);
      });
    }

    const missing = await getMissingCounts();
    console.log(
      `Missing vectors after pass ${pass}: org_profile=${missing.orgProfileMissing}, org_history=${missing.orgHistoryMissing}, org_context=${missing.orgContextMissing}, opportunity=${missing.opportunityMissing}, posting_context=${missing.contextMissing}, profile=${missing.profileMissing}, experience=${missing.experienceMissing}, volunteer_context=${missing.volunteerContextMissing}`,
    );

    if (missing.orgProfileMissing === 0
      && missing.orgHistoryMissing === 0
      && missing.orgContextMissing === 0
      && missing.opportunityMissing === 0
      && missing.contextMissing === 0
      && missing.profileMissing === 0
      && missing.volunteerContextMissing === 0
    ) {
      console.log('Core vector fields are fully populated.');
      break;
    }
  }
}

recomputeAllEmbeddings()
  .catch((error) => {
    console.error('Recompute-all embeddings failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await database.destroy();
  });
