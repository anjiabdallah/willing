import { Kysely } from 'kysely';

async function hasCvPathColumn(db: Kysely<unknown>): Promise<boolean> {
  const tables = await db.introspection.getTables();
  const table = tables.find(table => table.name === 'volunteer_account');
  return table?.columns.some(column => column.name === 'cv_path') ?? false;
}

export async function up(db: Kysely<unknown>): Promise<void> {
  if (!await hasCvPathColumn(db)) {
    await db.schema
      .alterTable('volunteer_account')
      .addColumn('cv_path', 'varchar(256)')
      .execute();
  }
}

export async function down(db: Kysely<unknown>): Promise<void> {
  if (await hasCvPathColumn(db)) {
    await db.schema
      .alterTable('volunteer_account')
      .dropColumn('cv_path')
      .execute();
  }
}
