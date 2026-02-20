import { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('volunteer_account')
    .addColumn('privacy', 'varchar(32)', col => col.notNull().defaultTo('public'))
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('volunteer_account')
    .dropColumn('privacy')
    .execute();
}
