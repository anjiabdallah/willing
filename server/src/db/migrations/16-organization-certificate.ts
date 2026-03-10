import { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('organization_table_info')
    .addColumn('id', 'serial', col => col.primaryKey())
    .addColumn('hours_threshold', 'integer')
    .addColumn('signatory_name', 'varchar(128)')
    .addColumn('signature_path', 'varchar(256)')
    .execute();

  await db.schema
    .alterTable('organization_account')
    .addColumn('certificate_info_id', 'integer')
    .execute();

  await db.schema
    .alterTable('organization_account')
    .addForeignKeyConstraint(
      'organization_account_certificate_info_fk',
      ['certificate_info_id'],
      'organization_table_info',
      ['id'],
    )
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('organization_account')
    .dropColumn('certificate_info_id')
    .execute();

  await db.schema
    .dropTable('organization_table_info')
    .execute();
}
