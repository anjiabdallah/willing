import { type Kysely, sql } from 'kysely';

const VECTOR_DIM = 1536;
const VECTOR_DIM_TYPE = sql`vector(${sql.raw(String(VECTOR_DIM))})`;

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('organization_account')
    .addColumn('org_history_vector', VECTOR_DIM_TYPE)
    .execute();

  await db.schema
    .createIndex('idx_organization_account_org_history_vector')
    .ifNotExists()
    .on('organization_account')
    .using('ivfflat')
    .column('org_history_vector')
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('idx_organization_account_org_history_vector').ifExists().execute();

  await db.schema
    .alterTable('organization_account')
    .dropColumn('org_history_vector')
    .execute();
}
