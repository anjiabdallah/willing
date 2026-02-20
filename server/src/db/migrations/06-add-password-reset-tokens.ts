import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('password_reset_token')
    .addColumn('id', 'serial', col => col.primaryKey())
    .addColumn('user_id', 'integer', col => col.notNull())
    .addColumn('role', 'varchar(32)', col => col.notNull())
    .addColumn('token', 'varchar(128)', col => col.notNull().unique())
    .addColumn('expires_at', 'timestamp', col => col.notNull())
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`now()`))
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('password_reset_token').execute();
}
