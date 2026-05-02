import fs from 'fs';
import path from 'path';

import { sql } from 'kysely';
import zod from 'zod';

import config from '../../config.ts';
import database from '../../db/index.ts';

const DATASET_PATH = path.resolve('src/scripts/data/recommendation/dataset.json');
const TOP_K = 5;

const datasetSchema = zod.object({
  volunteers: zod.array(zod.object({
    id: zod.number().int().positive(),
    email: zod.email(),
  })),
  new_postings: zod.array(zod.object({
    id: zod.number().int().positive(),
    title: zod.string().min(1),
  })),
  expected_matches: zod.array(zod.object({
    volunteer_id: zod.number().int().positive(),
    top_5_new_posting_ids: zod.array(zod.number().int().positive()).length(TOP_K),
  })),
});

type AuditDataset = zod.infer<typeof datasetSchema>;

const loadDataset = (): AuditDataset => {
  if (!fs.existsSync(DATASET_PATH)) {
    throw new Error(`Dataset file not found: ${DATASET_PATH}`);
  }

  const raw = fs.readFileSync(DATASET_PATH, 'utf8');
  return datasetSchema.parse(JSON.parse(raw));
};

const getVectorCoverage = async () => {
  const [orgProfile, orgHistory, orgContext, postingOpp, postingCtx, volunteerProfile, volunteerExperience, volunteerContext] = await Promise.all([
    database
      .selectFrom('organization_account')
      .select(sql<number>`count(*) filter (where org_profile_vector is null)`.as('missing'))
      .select(sql<number>`count(*)`.as('total'))
      .executeTakeFirstOrThrow(),
    database
      .selectFrom('organization_account')
      .select(sql<number>`count(*) filter (where org_history_vector is null)`.as('missing'))
      .select(sql<number>`count(*)`.as('total'))
      .executeTakeFirstOrThrow(),
    database
      .selectFrom('organization_account')
      .select(sql<number>`count(*) filter (where org_context_vector is null)`.as('missing'))
      .select(sql<number>`count(*)`.as('total'))
      .executeTakeFirstOrThrow(),
    database
      .selectFrom('posting')
      .select(sql<number>`count(*) filter (where posting_profile_vector is null)`.as('missing'))
      .select(sql<number>`count(*)`.as('total'))
      .executeTakeFirstOrThrow(),
    database
      .selectFrom('posting')
      .select(sql<number>`count(*) filter (where posting_context_vector is null)`.as('missing'))
      .select(sql<number>`count(*)`.as('total'))
      .executeTakeFirstOrThrow(),
    database
      .selectFrom('volunteer_account')
      .select(sql<number>`count(*) filter (where volunteer_profile_vector is null)`.as('missing'))
      .select(sql<number>`count(*)`.as('total'))
      .executeTakeFirstOrThrow(),
    database
      .selectFrom('volunteer_account')
      .select(sql<number>`count(*) filter (where volunteer_history_vector is null)`.as('missing'))
      .select(sql<number>`count(*)`.as('total'))
      .executeTakeFirstOrThrow(),
    database
      .selectFrom('volunteer_account')
      .select(sql<number>`count(*) filter (where volunteer_context_vector is null)`.as('missing'))
      .select(sql<number>`count(*)`.as('total'))
      .executeTakeFirstOrThrow(),
  ]);

  return {
    organizationProfile: { missing: Number(orgProfile.missing), total: Number(orgProfile.total) },
    organizationHistory: { missing: Number(orgHistory.missing), total: Number(orgHistory.total) },
    organizationContext: { missing: Number(orgContext.missing), total: Number(orgContext.total) },
    postingOpportunity: { missing: Number(postingOpp.missing), total: Number(postingOpp.total) },
    postingContext: { missing: Number(postingCtx.missing), total: Number(postingCtx.total) },
    volunteerProfile: { missing: Number(volunteerProfile.missing), total: Number(volunteerProfile.total) },
    volunteerExperience: { missing: Number(volunteerExperience.missing), total: Number(volunteerExperience.total) },
    volunteerContext: { missing: Number(volunteerContext.missing), total: Number(volunteerContext.total) },
  };
};

const getVolunteerRecommendations = async (volunteerId: number) => {
  const vectors = await database
    .selectFrom('volunteer_account')
    .select(['volunteer_context_vector'])
    .where('id', '=', volunteerId)
    .executeTakeFirstOrThrow();

  const hasContext = Boolean(vectors.volunteer_context_vector);

  let query = database
    .selectFrom('posting')
    .select(['posting.id', 'posting.title'])
    .where('posting.is_closed', '=', false)
    .where(({ not, exists, selectFrom, or }) => not(or([
      exists(
        selectFrom('enrollment')
          .select('enrollment.id')
          .whereRef('enrollment.posting_id', '=', 'posting.id')
          .where('enrollment.volunteer_id', '=', volunteerId),
      ),
      exists(
        selectFrom('enrollment_application')
          .select('enrollment_application.id')
          .whereRef('enrollment_application.posting_id', '=', 'posting.id')
          .where('enrollment_application.volunteer_id', '=', volunteerId),
      ),
    ])));

  if (hasContext && vectors.volunteer_context_vector) {
    const contextSimilarity = sql<number>`1 - (posting.posting_context_vector <=> ${vectors.volunteer_context_vector}::vector)`;
    query = query.orderBy(sql`${contextSimilarity} desc nulls last`);

    query = query.orderBy('posting.start_date', 'desc').orderBy('posting.start_time', 'desc');
  } else {
    query = query.orderBy('posting.start_date', 'desc').orderBy('posting.start_time', 'desc');
  }

  return query.limit(TOP_K).execute();
};

const auditRecommendations = async (dataset: AuditDataset) => {
  const emailByVolunteerDatasetId = new Map<number, string>();
  dataset.volunteers.forEach((volunteer) => {
    emailByVolunteerDatasetId.set(volunteer.id, volunteer.email);
  });

  const newPostingTitleByDatasetId = new Map<number, string>();
  dataset.new_postings.forEach((posting) => {
    newPostingTitleByDatasetId.set(posting.id, posting.title);
  });

  let volunteersChecked = 0;
  let exactTop5Matches = 0;
  let totalHitCount = 0;

  console.log('\nRecommendation Audit (Top-5):');

  for (const expected of dataset.expected_matches) {
    const email = emailByVolunteerDatasetId.get(expected.volunteer_id);
    if (!email) {
      console.log(`- volunteer_id=${expected.volunteer_id}: SKIPPED (missing email in dataset)`);
      continue;
    }

    const volunteer = await database
      .selectFrom('volunteer_account')
      .select(['id', 'email'])
      .where('email', '=', email)
      .executeTakeFirst();

    if (!volunteer) {
      console.log(`- ${email}: SKIPPED (not found in DB)`);
      continue;
    }

    const expectedTitles = expected.top_5_new_posting_ids
      .map(id => newPostingTitleByDatasetId.get(id))
      .filter((title): title is string => Boolean(title));
    const actual = await getVolunteerRecommendations(volunteer.id);
    const actualTitles = actual.map(posting => posting.title);

    const hitCount = expectedTitles.filter(title => actualTitles.includes(title)).length;
    const isExact = expectedTitles.length === TOP_K && expectedTitles.every((title, index) => title === actualTitles[index]);

    volunteersChecked += 1;
    totalHitCount += hitCount;
    if (isExact) exactTop5Matches += 1;

    console.log(`- ${email}: hits=${hitCount}/${TOP_K}${isExact ? ' (exact order match)' : ''}`);
  }

  const precisionAt5 = volunteersChecked === 0 ? 0 : totalHitCount / (volunteersChecked * TOP_K);
  const exactMatchRate = volunteersChecked === 0 ? 0 : exactTop5Matches / volunteersChecked;

  console.log('\nRecommendation Summary:');
  console.log(`- Volunteers audited: ${volunteersChecked}`);
  console.log(`- Aggregate Precision@5: ${precisionAt5.toFixed(3)}`);
  console.log(`- Exact top-5 order match rate: ${(exactMatchRate * 100).toFixed(1)}%`);
};

async function main() {
  if (config.NODE_ENV === 'production') {
    throw new Error('Refusing to audit recommendations in production.');
  }

  const dataset = loadDataset();
  const coverage = await getVectorCoverage();

  console.log('Vector Coverage:');
  console.log(`- organization_account.org_profile_vector missing: ${coverage.organizationProfile.missing}/${coverage.organizationProfile.total}`);
  console.log(`- organization_account.org_history_vector missing: ${coverage.organizationHistory.missing}/${coverage.organizationHistory.total}`);
  console.log(`- organization_account.org_context_vector missing: ${coverage.organizationContext.missing}/${coverage.organizationContext.total}`);
  console.log(`- posting.posting_profile_vector missing: ${coverage.postingOpportunity.missing}/${coverage.postingOpportunity.total}`);
  console.log(`- posting.posting_context_vector missing: ${coverage.postingContext.missing}/${coverage.postingContext.total}`);
  console.log(`- volunteer_account.volunteer_profile_vector missing: ${coverage.volunteerProfile.missing}/${coverage.volunteerProfile.total}`);
  console.log(`- volunteer_account.volunteer_history_vector missing: ${coverage.volunteerExperience.missing}/${coverage.volunteerExperience.total}`);
  console.log(`- volunteer_account.volunteer_context_vector missing: ${coverage.volunteerContext.missing}/${coverage.volunteerContext.total}`);

  await auditRecommendations(dataset);
}

main()
  .catch((error) => {
    console.error('Recommendation audit failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await database.destroy();
  });
