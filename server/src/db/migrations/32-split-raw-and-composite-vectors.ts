import { type Kysely, sql } from 'kysely';

const VECTOR_DIM = 1536;
const VECTOR_DIM_TYPE = sql`vector(${sql.raw(String(VECTOR_DIM))})`;

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('organization_account')
    .addColumn('org_profile_vector', VECTOR_DIM_TYPE)
    .execute();

  await db.schema
    .alterTable('volunteer_account')
    .addColumn('volunteer_context_vector', VECTOR_DIM_TYPE)
    .execute();

  await db.schema
    .createIndex('idx_organization_account_org_profile_vector')
    .ifNotExists()
    .on('organization_account')
    .using('ivfflat')
    .column('org_profile_vector')
    .execute();

  await db.schema
    .createIndex('idx_volunteer_account_volunteer_context_vector')
    .ifNotExists()
    .on('volunteer_account')
    .using('ivfflat')
    .column('volunteer_context_vector')
    .execute();

  // Bootstrap new columns from existing vectors for immediate compatibility.
  await sql`
    UPDATE organization_account
    SET org_profile_vector = org_vector
    WHERE org_profile_vector IS NULL
      AND org_vector IS NOT NULL
  `.execute(db);

  await sql`
    UPDATE volunteer_account
    SET volunteer_context_vector = profile_vector
    WHERE volunteer_context_vector IS NULL
      AND profile_vector IS NOT NULL
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('idx_volunteer_account_volunteer_context_vector').ifExists().execute();
  await db.schema.dropIndex('idx_organization_account_org_profile_vector').ifExists().execute();

  await db.schema
    .alterTable('volunteer_account')
    .dropColumn('volunteer_context_vector')
    .execute();

  await db.schema
    .alterTable('organization_account')
    .dropColumn('org_profile_vector')
    .execute();
}
