import { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.createTable('enrollment')
    .addColumn('id', 'serial', col => col.primaryKey())
    .addColumn('volunteer_id', 'serial', col => col.notNull().references('volunteer_account.id').onDelete('cascade'))
    .addColumn('posting_id', 'serial', col => col.notNull().references('organization_posting.id').onDelete('cascade'))
    .addColumn('message', 'text')
    .execute();
  await db.schema.createTable('enrollment_application')
    .addColumn('id', 'serial', col => col.primaryKey())
    .addColumn('volunteer_id', 'serial', col => col.notNull().references('volunteer_account.id').onDelete('cascade'))
    .addColumn('enrollment_id', 'serial', col => col.notNull().references('enrollment.id').onDelete('cascade'))
    .addColumn('message', 'text')
    .execute();
}
export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('enrollment_application').execute();
  await db.schema.dropTable('enrollment').execute();
}
