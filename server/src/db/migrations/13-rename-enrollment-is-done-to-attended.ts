import { Kysely } from 'kysely';

async function hasColumn(db: Kysely<unknown>, columnName: string): Promise<boolean> {
  const tables = await db.introspection.getTables();
  const table = tables.find(table => table.name === 'enrollment');
  return table?.columns.some(column => column.name === columnName) ?? false;
}

export async function up(db: Kysely<unknown>): Promise<void> {
  if (await hasColumn(db, 'is_done') && !await hasColumn(db, 'attended')) {
    await db.schema
      .alterTable('enrollment')
      .renameColumn('is_done', 'attended')
      .execute();
  }
}

export async function down(db: Kysely<unknown>): Promise<void> {
  if (await hasColumn(db, 'attended') && !await hasColumn(db, 'is_done')) {
    await db.schema
      .alterTable('enrollment')
      .renameColumn('attended', 'is_done')
      .execute();
  }
}
