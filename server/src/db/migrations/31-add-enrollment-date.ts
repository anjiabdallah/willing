import { type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('enrollment_date')
    .addColumn('id', 'serial', col => col.primaryKey())
    .addColumn('enrollment_id', 'integer', col =>
      col.notNull().references('enrollment.id'),
    )
    .addColumn('posting_id', 'integer', col =>
      col.notNull().references('organization_posting.id'),
    )
    .addColumn('date', 'date', col => col.notNull())
    .addColumn('attended', 'boolean', col => col.notNull().defaultTo(false))
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .dropTable('enrollment_date')
    .execute();
}
