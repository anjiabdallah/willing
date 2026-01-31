import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {

  // Example to create a table : https://www.kysely.dev/docs/migrations

  // await db.schema
  //   .createTable('person')
  //   .addColumn('id', 'integer', (col) => col.primaryKey())
  //   .addColumn('first_name', 'text', (col) => col.notNull())
  //   .addColumn('last_name', 'text')
  //   .addColumn('gender', 'text', (col) => col.notNull())
  //   .addColumn('created_at', 'text', (col) =>
  //     col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
  //   )
  //   .execute()

  // Create all the tables here...
}

export async function down(db: Kysely<any>): Promise<void> {

  // Undo the changes here
  // await db.schema.dropTable("person")

}
