import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('organization_account')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamp', col => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .alterTable('volunteer_account')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamp', col => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .alterTable('admin_account')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamp', col => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .alterTable('organization_posting')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamp', col => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .alterTable('organization_request')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .alterTable('enrollment')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .alterTable('enrollment_application')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`now()`))
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('enrollment_application')
    .dropColumn('created_at')
    .execute();

  await db.schema
    .alterTable('enrollment')
    .dropColumn('created_at')
    .execute();

  await db.schema
    .alterTable('organization_request')
    .dropColumn('created_at')
    .execute();

  await db.schema
    .alterTable('organization_posting')
    .dropColumn('updated_at')
    .dropColumn('created_at')
    .execute();

  await db.schema
    .alterTable('admin_account')
    .dropColumn('updated_at')
    .dropColumn('created_at')
    .execute();

  await db.schema
    .alterTable('volunteer_account')
    .dropColumn('updated_at')
    .dropColumn('created_at')
    .execute();

  await db.schema
    .alterTable('organization_account')
    .dropColumn('updated_at')
    .dropColumn('created_at')
    .execute();
}
