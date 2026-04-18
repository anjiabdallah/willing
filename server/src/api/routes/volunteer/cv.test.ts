import supertest from 'supertest';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import createApp from '../../../app.ts';
import database from '../../../db/index.ts';
import * as embeddingUpdates from '../../../services/embeddings/updates.ts';
import * as volunteerService from '../../../services/volunteer/index.ts';
import { createVolunteerAccount } from '../../../tests/fixtures/accounts.ts';

import type { Database } from '../../../db/tables/index.ts';
import type { ControlledTransaction } from 'kysely';
import type TestAgent from 'supertest/lib/agent.js';

let transaction: ControlledTransaction<Database>;
let server: TestAgent;

beforeEach(async () => {
  transaction = await database.startTransaction().execute();
  server = supertest(createApp(transaction));
});

afterEach(async () => {
  await transaction.rollback().execute();
});

describe('Volunteer CV routes', () => {
  test('DELETE /volunteer/profile/cv skips profile vector recomputation after the per-window limit is exceeded', async () => {
    const { volunteer, token } = await createVolunteerAccount(transaction, { email: 'vol-cv-rate-limit@example.com' });

    const recomputeProfileSpy = vi
      .spyOn(embeddingUpdates, 'recomputeVolunteerProfileVector')
      .mockResolvedValue(null);
    const getVolunteerProfileSpy = vi
      .spyOn(volunteerService, 'getVolunteerProfile')
      .mockResolvedValue({
        volunteer: {
          id: volunteer.id,
          first_name: volunteer.first_name,
          last_name: volunteer.last_name,
          email: volunteer.email,
          date_of_birth: volunteer.date_of_birth,
          gender: volunteer.gender,
          cv_path: null,
          description: volunteer.description ?? '',
        },
        skills: [],
        experience_stats: {
          total_completed_experiences: 0,
          organizations_supported: 0,
          crisis_related_experiences: 0,
          total_hours_completed: 0,
          total_skills_used: 0,
          most_volunteered_crisis: null,
        },
        completed_experiences: [],
      });

    for (let index = 0; index < 3; index += 1) {
      await server
        .delete('/volunteer/profile/cv')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    }

    await server
      .delete('/volunteer/profile/cv')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(recomputeProfileSpy).toHaveBeenCalledTimes(3);

    recomputeProfileSpy.mockRestore();
    getVolunteerProfileSpy.mockRestore();
  });
});
