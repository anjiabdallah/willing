import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  sql`CREATE EXTENSION vector;`.execute(db);
}
export async function down(db: Kysely<unknown>): Promise<void> {
  sql`DROP EXTENSION IF EXISTS vector;`.execute(db);
}
