import supertest from 'supertest';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import createApp from '../../../app.ts';
import database from '../../../db/index.ts';
import * as embeddingService from '../../../services/embeddings/updates.ts';
import { createOrganizationAccount, createVolunteerAccount } from '../../../tests/fixtures/accounts.ts';
import { createOrganizationPosting } from '../../../tests/fixtures/organizationData.ts';

import type { Database } from '../../../db/tables/index.ts';
import type { ControlledTransaction } from 'kysely';
import type TestAgent from 'supertest/lib/agent.js';

let transaction: ControlledTransaction<Database, []>;
let server: TestAgent;
const recomputeVolunteerExperienceVectorSpy = vi.spyOn(embeddingService, 'recomputeVolunteerExperienceVector').mockResolvedValue(null);

beforeEach(async () => {
  transaction = await database.startTransaction().execute();
  server = supertest(createApp(transaction));
});

afterEach(async () => {
  await transaction.rollback().execute();
  vi.clearAllMocks();
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

  test('PATCH /organization/posting/:id/attendance updates all enrollment attendance and recomputes volunteer vectors', async () => {
    const org = await createOrganizationAccount(transaction, { email: 'org-b@example.com' });
    const volunteerOne = await createVolunteerAccount(transaction, { email: 'vol-b1@example.com' });
    const volunteerTwo = await createVolunteerAccount(transaction, { email: 'vol-b2@example.com' });

    const posting = await createOrganizationPosting(transaction, {
      organizationId: org.organization.id,
      overrides: {
        allows_partial_attendance: false,
      },
    });

    await transaction
      .insertInto('enrollment')
      .values({
        volunteer_id: volunteerOne.volunteer.id,
        posting_id: posting.id,
        attended: false,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    await transaction
      .insertInto('enrollment')
      .values({
        volunteer_id: volunteerTwo.volunteer.id,
        posting_id: posting.id,
        attended: false,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    const response = await server
      .patch(`/organization/posting/${posting.id}/attendance`)
      .set('Authorization', `Bearer ${org.token}`)
      .send({ attended: true })
      .expect(200);

    expect(response.body).toEqual({ updated_count: 2 });
    expect(recomputeVolunteerExperienceVectorSpy).toHaveBeenCalledTimes(2);
    expect(recomputeVolunteerExperienceVectorSpy).toHaveBeenCalledWith(volunteerOne.volunteer.id, transaction);
    expect(recomputeVolunteerExperienceVectorSpy).toHaveBeenCalledWith(volunteerTwo.volunteer.id, transaction);

    const updatedEnrollments = await transaction
      .selectFrom('enrollment')
      .select(['attended'])
      .where('posting_id', '=', posting.id)
      .execute();

    expect(updatedEnrollments.every(row => row.attended)).toBe(true);
  });

  test('GET /organization/posting/:id/attendance/export returns CSV of enrollments', async () => {
    const org = await createOrganizationAccount(transaction, { email: 'org-c@example.com' });
    const volunteer = await createVolunteerAccount(transaction, { email: 'vol-c@example.com' });

    await transaction
      .insertInto('volunteer_skill')
      .values({ volunteer_id: volunteer.volunteer.id, name: 'First Aid' })
      .execute();

    const posting = await createOrganizationPosting(transaction, {
      organizationId: org.organization.id,
      overrides: { allows_partial_attendance: false },
    });

    await transaction
      .insertInto('enrollment')
      .values({
        volunteer_id: volunteer.volunteer.id,
        posting_id: posting.id,
        message: 'Ready to help',
        attended: false,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    const response = await server
      .get(`/organization/posting/${posting.id}/attendance/export`)
      .set('Authorization', `Bearer ${org.token}`)
      .expect(200);

    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.headers['content-disposition']).toContain(`${posting.title.replace(/[^a-z0-9-_]+/gi, '_')}-attendance.csv`);
    expect(response.text).toContain('enrollment_id');
    expect(response.text).toContain('First Aid');
    expect(response.text).toContain('Ready to help');
    expect(response.text).toContain(volunteer.volunteer.email);
  });

  test('PATCH /organization/posting/:id/enrollments/:enrollmentId/attendance returns empty result when attendance does not change', async () => {
    const org = await createOrganizationAccount(transaction, { email: 'org-d@example.com' });
    const volunteer = await createVolunteerAccount(transaction, { email: 'vol-d@example.com' });
    const posting = await createOrganizationPosting(transaction, { organizationId: org.organization.id });

    const enrollment = await transaction
      .insertInto('enrollment')
      .values({
        volunteer_id: volunteer.volunteer.id,
        posting_id: posting.id,
        attended: false,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    const response = await server
      .patch(`/organization/posting/${posting.id}/enrollments/${enrollment.id}/attendance`)
      .set('Authorization', `Bearer ${org.token}`)
      .send({ attended: false })
      .expect(200);

    expect(response.body).toEqual({});
    expect(recomputeVolunteerExperienceVectorSpy).not.toHaveBeenCalled();
  });

  test('returns 404 when attendance is requested for a missing posting', async () => {
    const org = await createOrganizationAccount(transaction, { email: 'org-missing@example.com' });

    await server
      .get('/organization/posting/9999/attendance')
      .set('Authorization', `Bearer ${org.token}`)
      .expect(404);
  });

  test('PATCH /organization/posting/:id/attendance returns 404 when posting is missing', async () => {
    const org = await createOrganizationAccount(transaction, { email: 'org-missing-2@example.com' });

    await server
      .patch('/organization/posting/9999/attendance')
      .set('Authorization', `Bearer ${org.token}`)
      .send({ attended: true })
      .expect(404);
  });

  test('PATCH /organization/posting/:id/attendance returns zero updates when attendance already matches', async () => {
    const org = await createOrganizationAccount(transaction, { email: 'org-noupdate@example.com' });
    const volunteer = await createVolunteerAccount(transaction, { email: 'vol-noupdate@example.com' });

    const posting = await createOrganizationPosting(transaction, {
      organizationId: org.organization.id,
    });

    await transaction
      .insertInto('enrollment')
      .values({
        volunteer_id: volunteer.volunteer.id,
        posting_id: posting.id,
        attended: true,
      })
      .execute();

    const response = await server
      .patch(`/organization/posting/${posting.id}/attendance`)
      .set('Authorization', `Bearer ${org.token}`)
      .send({ attended: true })
      .expect(200);

    expect(response.body).toEqual({ updated_count: 0 });
    expect(recomputeVolunteerExperienceVectorSpy).not.toHaveBeenCalled();
  });

  test('PATCH /organization/posting/:id/enrollment-dates/:enrollmentDateId/attendance returns 404 when date record is missing', async () => {
    const org = await createOrganizationAccount(transaction, { email: 'org-date-missing@example.com' });
    const posting = await createOrganizationPosting(transaction, {
      organizationId: org.organization.id,
      overrides: { allows_partial_attendance: true },
    });

    await server
      .patch(`/organization/posting/${posting.id}/enrollment-dates/9999/attendance`)
      .set('Authorization', `Bearer ${org.token}`)
      .send({ attended: true })
      .expect(404);
  });

  test('PATCH /organization/posting/:id/enrollments/:enrollmentId/attendance returns 404 when enrollment does not belong to the posting', async () => {
    const org = await createOrganizationAccount(transaction, { email: 'org-enrollment-mismatch@example.com' });
    const volunteer = await createVolunteerAccount(transaction, { email: 'vol-enrollment-mismatch@example.com' });
    const postingOne = await createOrganizationPosting(transaction, { organizationId: org.organization.id });
    const postingTwo = await createOrganizationPosting(transaction, { organizationId: org.organization.id });

    const enrollment = await transaction
      .insertInto('enrollment')
      .values({
        volunteer_id: volunteer.volunteer.id,
        posting_id: postingTwo.id,
        attended: false,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    await server
      .patch(`/organization/posting/${postingOne.id}/enrollments/${enrollment.id}/attendance`)
      .set('Authorization', `Bearer ${org.token}`)
      .send({ attended: true })
      .expect(404);
  });

  test('PATCH /organization/posting/:id/enrollments/:enrollmentId/attendance updates attendance and recomputes vector', async () => {
    const org = await createOrganizationAccount(transaction, { email: 'org-e@example.com' });
    const volunteer = await createVolunteerAccount(transaction, { email: 'vol-e@example.com' });
    const posting = await createOrganizationPosting(transaction, { organizationId: org.organization.id });

    const enrollment = await transaction
      .insertInto('enrollment')
      .values({
        volunteer_id: volunteer.volunteer.id,
        posting_id: posting.id,
        attended: false,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    await server
      .patch(`/organization/posting/${posting.id}/enrollments/${enrollment.id}/attendance`)
      .set('Authorization', `Bearer ${org.token}`)
      .send({ attended: true })
      .expect(200);

    expect(recomputeVolunteerExperienceVectorSpy).toHaveBeenCalledWith(volunteer.volunteer.id, transaction);

    const updatedEnrollment = await transaction
      .selectFrom('enrollment')
      .select(['attended'])
      .where('id', '=', enrollment.id)
      .executeTakeFirstOrThrow();

    expect(updatedEnrollment.attended).toBe(true);
  });
});
