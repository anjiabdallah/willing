import { Kysely, sql } from 'kysely';

import type { Database } from '../tables.js';

type DatabaseWithPostingTimestamps = Database & {
  organization_posting: Database['organization_posting'] & {
    start_timestamp: Date;
    end_timestamp: Date | null;
  };
};

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable('organization_posting')
    .addColumn('start_date', 'date')
    .addColumn('start_time', 'time')
    .addColumn('end_date', 'date')
    .addColumn('end_time', 'time')
    .execute();

  await db
    .updateTable('organization_posting')
    .set({
      start_date: sql`start_timestamp::date`,
      start_time: sql`start_timestamp::time`,
      end_date: sql`end_timestamp::date`,
      end_time: sql`end_timestamp::time`,
    })
    .execute();

  await db.schema
    .alterTable('organization_posting')
    .dropColumn('start_timestamp')
    .dropColumn('end_timestamp')
    .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable('organization_posting')
    .addColumn('start_timestamp', 'timestamp')
    .addColumn('end_timestamp', 'timestamp')
    .execute();

  const migrationDb = db as unknown as Kysely<DatabaseWithPostingTimestamps>;

  await migrationDb
    .updateTable('organization_posting')
    .set({
      start_timestamp: sql<Date>`(start_date + start_time)`,
      end_timestamp: sql<Date | null>`CASE WHEN end_date IS NULL OR end_time IS NULL THEN NULL ELSE (end_date + end_time) END`,
    })
    .execute();

  await db.schema
    .alterTable('organization_posting')
    .dropColumn('start_date')
    .dropColumn('start_time')
    .dropColumn('end_date')
    .dropColumn('end_time')
    .execute();
}
