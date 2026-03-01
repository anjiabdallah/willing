import { Kysely, sql } from 'kysely';

import {
  addUpdatedAtTrigger,
  dropSetUpdatedAtFunction,
  dropUpdatedAtTrigger,
  ensureSetUpdatedAtFunction,
} from '../migration-utils.js';

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
  await ensureSetUpdatedAtFunction(db);

  await addUpdatedAtTrigger(db, 'organization_account');
  await addUpdatedAtTrigger(db, 'volunteer_account');
  await addUpdatedAtTrigger(db, 'admin_account');
  await addUpdatedAtTrigger(db, 'organization_posting');
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await dropUpdatedAtTrigger(db, 'organization_posting');
  await dropUpdatedAtTrigger(db, 'admin_account');
  await dropUpdatedAtTrigger(db, 'volunteer_account');
  await dropUpdatedAtTrigger(db, 'organization_account');

  await dropSetUpdatedAtFunction(db);

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
