import { sql } from 'kysely';
import { beforeAll } from 'vitest';

import { truncateAllTables } from './helpers/database.ts';

beforeAll(async () => {
  const [{ default: config }, { default: database }, { migrateToLatest }] = await Promise.all([
    import('../config.ts'),
    import('../db/index.ts'),
    import('../db/migrate.ts'),
  ]);

  await database.schema.createSchema(config.POSTGRES_SCHEMA).ifNotExists().execute();
  await sql`SET search_path TO ${sql.raw(config.POSTGRES_SCHEMA)}, public`.execute(database);

  await migrateToLatest(database);
  await truncateAllTables();
});
