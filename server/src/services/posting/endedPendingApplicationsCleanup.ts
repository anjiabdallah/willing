import { type Kysely } from 'kysely';

import { rejectEndedPendingApplicationsForPostings } from './rejectEndedPendingApplications.ts';
import config from '../../config.ts';
import { type Database } from '../../db/tables/index.ts';

const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

export function startEndedPendingApplicationsCleanup(db: Kysely<Database>) {
  if (config.NODE_ENV === 'test') {
    return undefined;
  }

  const runCleanup = async () => {
    try {
      await rejectEndedPendingApplicationsForPostings(db);
    } catch (error) {
      console.error('Failed to clean up ended pending applications:', error);
    }
  };

  void runCleanup();

  const timer = setInterval(() => {
    void runCleanup();
  }, CLEANUP_INTERVAL_MS);

  timer.unref?.();

  return timer;
}
