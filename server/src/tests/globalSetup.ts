import fs from 'fs';

import config from '../config.ts';
import { truncateAllTables } from './helpers/database.ts';

export async function setup() {
  await truncateAllTables();
}

export async function teardown() {
  const { default: database } = await import('../db/index.ts');
  await database.destroy();

  await fs.promises.rm(config.UPLOAD_DIR, { recursive: true, force: true });
}
