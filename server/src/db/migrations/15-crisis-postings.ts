import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  // create crisis table
  await db.schema
    .createTable('crisis')
    .addColumn('id', 'serial', col => col.primaryKey())
    .addColumn('name', 'varchar(256)', col => col.notNull())
    .addColumn('description', 'text')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`now()`))
    .addColumn('pinned', 'boolean', col => col.notNull().defaultTo(false))
    .execute();

  await db.schema
    .alterTable('organization_posting')
    .addColumn('crisis_id', 'integer')
    .execute();

  await db.schema
    .alterTable('organization_posting')
    .addForeignKeyConstraint(
      'organization_posting_crisis_fk',
      ['crisis_id'],
      'crisis',
      ['id'],
    )
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('organization_posting')
    .dropColumn('crisis_id')
    .execute();

  await db.schema
    .dropTable('crisis')
    .execute();
}
