import { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('organization_account')
    .addColumn('logo_path', 'varchar(256)')
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('organization_account')
    .dropColumn('logo_path')
    .execute();
}
