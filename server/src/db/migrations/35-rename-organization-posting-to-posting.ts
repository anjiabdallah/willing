import { type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('organization_posting').renameTo('posting').execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('posting').renameTo('organization_posting').execute();
}
