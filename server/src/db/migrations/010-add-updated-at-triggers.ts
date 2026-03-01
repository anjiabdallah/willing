import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE OR REPLACE FUNCTION set_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `.execute(db);

  await sql`
    CREATE TRIGGER set_updated_at_organization_account
    BEFORE UPDATE ON organization_account
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  `.execute(db);

  await sql`
    CREATE TRIGGER set_updated_at_volunteer_account
    BEFORE UPDATE ON volunteer_account
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  `.execute(db);

  await sql`
    CREATE TRIGGER set_updated_at_admin_account
    BEFORE UPDATE ON admin_account
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  `.execute(db);

  await sql`
    CREATE TRIGGER set_updated_at_organization_posting
    BEFORE UPDATE ON organization_posting
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DROP TRIGGER IF EXISTS set_updated_at_organization_posting
    ON organization_posting;
  `.execute(db);

  await sql`
    DROP TRIGGER IF EXISTS set_updated_at_admin_account
    ON admin_account;
  `.execute(db);

  await sql`
    DROP TRIGGER IF EXISTS set_updated_at_volunteer_account
    ON volunteer_account;
  `.execute(db);

  await sql`
    DROP TRIGGER IF EXISTS set_updated_at_organization_account
    ON organization_account;
  `.execute(db);

  await sql`
    DROP FUNCTION IF EXISTS set_updated_at();
  `.execute(db);
}
