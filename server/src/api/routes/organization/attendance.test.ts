import supertest from 'supertest';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import createApp from '../../../app.ts';
import database from '../../../db/index.ts';
import { createOrganizationAccount, createVolunteerAccount } from '../../../tests/fixtures/accounts.ts';
import { createOrganizationPosting } from '../../../tests/fixtures/organizationData.ts';

import type { Database } from '../../../db/tables/index.ts';
import type { ControlledTransaction } from 'kysely';
import type TestAgent from 'supertest/lib/agent.js';

let transaction: ControlledTransaction<Database, []>;
let server: TestAgent;

beforeEach(async () => {
  transaction = await database.startTransaction().execute();
  server = supertest(createApp(transaction));
});

afterEach(async () => {
  await transaction.rollback().execute();
});

describe('Organization attendance endpoints', () => {
  test('returns posting date range and allows per-date updates', async () => {
    const org = await createOrganizationAccount(transaction, { email: 'org-a@example.com' });
    const volunteer = await createVolunteerAccount(transaction, { email: 'vol-a@example.com' });

    const posting = await createOrganizationPosting(transaction, {
      organizationId: org.organization.id,
      overrides: {
        allows_partial_attendance: true,
        start_date: new Date('2026-01-01'),
        end_date: new Date('2026-01-03'),
      },
    });

    const enrollment = await transaction
      .insertInto('enrollment')
      .values({
        volunteer_id: volunteer.volunteer.id,
        posting_id: posting.id,
        message: 'Participating',
        attended: false,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    const dateRecord = await transaction
      .insertInto('enrollment_date')
      .values({
        enrollment_id: enrollment.id,
        posting_id: posting.id,
        date: new Date('2026-01-01'),
        attended: false,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    const fetch1 = await server
      .get(`/organization/posting/${posting.id}/attendance`)
      .set('Authorization', `Bearer ${org.token}`)
      .expect(200);

    expect(fetch1.body).toMatchObject({
      posting: {
        id: posting.id,
        allows_partial_attendance: true,
        start_date: expect.any(String),
        end_date: expect.any(String),
      },
      posting_dates: ['2026-01-01', '2026-01-02', '2026-01-03'],
      enrollments: [
        expect.objectContaining({
          enrollment_id: enrollment.id,
          volunteer_id: volunteer.volunteer.id,
          dates: [
            expect.objectContaining({
              id: dateRecord.id,
              date: '2026-01-01',
              attended: false,
            }),
          ],
        }),
      ],
    });

    // Mark single day attended
    await server
      .patch(`/organization/posting/${posting.id}/enrollment-dates/${dateRecord.id}/attendance`)
      .set('Authorization', `Bearer ${org.token}`)
      .send({ attended: true })
      .expect(200);

    const fetch2 = await server
      .get(`/organization/posting/${posting.id}/attendance`)
      .set('Authorization', `Bearer ${org.token}`)
      .expect(200);

    expect(fetch2.body.enrollments[0].dates?.[0].attended).toBe(true);
  });
});
