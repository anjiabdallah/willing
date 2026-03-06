import { Kysely, sql } from 'kysely';

export async function ensureSetUpdatedAtFunction(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE OR REPLACE FUNCTION set_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `.execute(db);
}

export async function addUpdatedAtTrigger(
  db: Kysely<unknown>,
  tableName: string,
): Promise<void> {
  await sql.raw(`
    CREATE TRIGGER set_updated_at_${tableName}
    BEFORE UPDATE ON ${tableName}
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  `).execute(db);
}

export async function dropUpdatedAtTrigger(
  db: Kysely<unknown>,
  tableName: string,
): Promise<void> {
  await sql.raw(`
    DROP TRIGGER IF EXISTS set_updated_at_${tableName}
    ON ${tableName};
  `).execute(db);
}

export async function dropSetUpdatedAtFunction(db: Kysely<unknown>): Promise<void> {
  await sql`
    DROP FUNCTION IF EXISTS set_updated_at();
  `.execute(db);
}
