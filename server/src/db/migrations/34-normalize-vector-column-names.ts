import { type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('idx_organization_account_org_vector').ifExists().execute();
  await db.schema.dropIndex('idx_organization_posting_opportunity_vector').ifExists().execute();
  await db.schema.dropIndex('idx_volunteer_account_profile_vector').ifExists().execute();
  await db.schema.dropIndex('idx_volunteer_account_experience_vector').ifExists().execute();

  await db.schema
    .alterTable('organization_account')
    .renameColumn('org_vector', 'org_context_vector')
    .execute();

  await db.schema
    .alterTable('organization_posting')
    .renameColumn('opportunity_vector', 'posting_profile_vector')
    .execute();

  await db.schema
    .alterTable('volunteer_account')
    .renameColumn('profile_vector', 'volunteer_profile_vector')
    .execute();

  await db.schema
    .alterTable('volunteer_account')
    .renameColumn('experience_vector', 'volunteer_history_vector')
    .execute();

  await db.schema
    .createIndex('idx_organization_account_org_context_vector')
    .ifNotExists()
    .on('organization_account')
    .using('ivfflat')
    .column('org_context_vector')
    .execute();

  await db.schema
    .createIndex('idx_organization_posting_posting_profile_vector')
    .ifNotExists()
    .on('organization_posting')
    .using('ivfflat')
    .column('posting_profile_vector')
    .execute();

  await db.schema
    .createIndex('idx_volunteer_account_volunteer_profile_vector')
    .ifNotExists()
    .on('volunteer_account')
    .using('ivfflat')
    .column('volunteer_profile_vector')
    .execute();

  await db.schema
    .createIndex('idx_volunteer_account_volunteer_history_vector')
    .ifNotExists()
    .on('volunteer_account')
    .using('ivfflat')
    .column('volunteer_history_vector')
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('idx_volunteer_account_volunteer_history_vector').ifExists().execute();
  await db.schema.dropIndex('idx_volunteer_account_volunteer_profile_vector').ifExists().execute();
  await db.schema.dropIndex('idx_organization_posting_posting_profile_vector').ifExists().execute();
  await db.schema.dropIndex('idx_organization_account_org_context_vector').ifExists().execute();

  await db.schema
    .alterTable('volunteer_account')
    .renameColumn('volunteer_history_vector', 'experience_vector')
    .execute();

  await db.schema
    .alterTable('volunteer_account')
    .renameColumn('volunteer_profile_vector', 'profile_vector')
    .execute();

  await db.schema
    .alterTable('organization_posting')
    .renameColumn('posting_profile_vector', 'opportunity_vector')
    .execute();

  await db.schema
    .alterTable('organization_account')
    .renameColumn('org_context_vector', 'org_vector')
    .execute();

  await db.schema
    .createIndex('idx_organization_account_org_vector')
    .ifNotExists()
    .on('organization_account')
    .using('ivfflat')
    .column('org_vector')
    .execute();

  await db.schema
    .createIndex('idx_organization_posting_opportunity_vector')
    .ifNotExists()
    .on('organization_posting')
    .using('ivfflat')
    .column('opportunity_vector')
    .execute();

  await db.schema
    .createIndex('idx_volunteer_account_profile_vector')
    .ifNotExists()
    .on('volunteer_account')
    .using('ivfflat')
    .column('profile_vector')
    .execute();

  await db.schema
    .createIndex('idx_volunteer_account_experience_vector')
    .ifNotExists()
    .on('volunteer_account')
    .using('ivfflat')
    .column('experience_vector')
    .execute();
}
