import supertest from 'supertest';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import createApp from '../../../app.ts';
import database from '../../../db/index.ts';
import { createOrganizationAccount, createVolunteerAccount } from '../../../tests/fixtures/accounts.ts';

import type { Database } from '../../../db/tables/index.ts';
import type { ControlledTransaction } from 'kysely';
import type TestAgent from 'supertest/lib/agent.js';

const formatDateToIso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

let transaction: ControlledTransaction<Database, []>;
let server: TestAgent;

beforeEach(async () => {
  transaction = await database.startTransaction().execute();
  server = supertest(createApp(transaction));
});

afterEach(async () => {
  await transaction.rollback().execute();
});

describe('Organization posting applications', () => {
  test('returns requested_dates for partial attendance applications', async () => {
    const { organization, token } = await createOrganizationAccount(transaction, { email: 'org-posting-apps@example.com' });
    const { volunteer } = await createVolunteerAccount(transaction, { email: 'vol-posting-apps@example.com' });

    const posting = await transaction
      .insertInto('organization_posting')
      .values({
        organization_id: organization.id,
        title: 'Review Partial Attendance Event',
        description: 'Review requested dates',
        latitude: 33.9,
        longitude: 35.5,
        max_volunteers: 20,
        start_date: new Date('2026-06-01T00:00:00.000Z'),
        start_time: '09:00:00',
        end_date: new Date('2026-06-03T00:00:00.000Z'),
        end_time: '17:00:00',
        minimum_age: 18,
        automatic_acceptance: false,
        is_closed: false,
        allows_partial_attendance: true,
        location_name: 'Test Location',
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    const application = await transaction
      .insertInto('enrollment_application')
      .values({
        volunteer_id: volunteer.id,
        posting_id: posting.id,
        message: 'Available on selected days',
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    await transaction
      .insertInto('enrollment_application_date')
      .values([
        { application_id: application.id, date: new Date('2026-06-01T00:00:00.000Z') },
        { application_id: application.id, date: new Date('2026-06-03T00:00:00.000Z') },
      ])
      .execute();

    const response = await server
      .get(`/organization/posting/${posting.id}/applications`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.applications).toHaveLength(1);
    expect(response.body.applications[0]).toMatchObject({
      application_id: application.id,
      volunteer_id: volunteer.id,
      requested_dates: ['2026-06-01', '2026-06-03'],
    });
  });

  test('accepting a review-based partial application creates enrollment_date rows', async () => {
    const { organization, token } = await createOrganizationAccount(transaction, { email: 'org-posting-accept@example.com' });
    const { volunteer } = await createVolunteerAccount(transaction, { email: 'vol-posting-accept@example.com' });

    const posting = await transaction
      .insertInto('organization_posting')
      .values({
        organization_id: organization.id,
        title: 'Review Acceptance Dates Event',
        description: 'Accepted volunteers should keep their selected dates',
        latitude: 33.9,
        longitude: 35.5,
        max_volunteers: 20,
        start_date: new Date('2026-07-01T00:00:00.000Z'),
        start_time: '09:00:00',
        end_date: new Date('2026-07-03T00:00:00.000Z'),
        end_time: '17:00:00',
        minimum_age: 18,
        automatic_acceptance: false,
        is_closed: false,
        allows_partial_attendance: true,
        location_name: 'Test Location',
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    const application = await transaction
      .insertInto('enrollment_application')
      .values({
        volunteer_id: volunteer.id,
        posting_id: posting.id,
        message: 'Available on selected days',
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    await transaction
      .insertInto('enrollment_application_date')
      .values([
        { application_id: application.id, date: new Date('2026-07-01T00:00:00.000Z') },
        { application_id: application.id, date: new Date('2026-07-03T00:00:00.000Z') },
      ])
      .execute();

    await server
      .post(`/organization/posting/${posting.id}/applications/${application.id}/accept`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const enrollment = await transaction
      .selectFrom('enrollment')
      .select(['id', 'volunteer_id', 'posting_id', 'attended'])
      .where('posting_id', '=', posting.id)
      .where('volunteer_id', '=', volunteer.id)
      .executeTakeFirstOrThrow();

    expect(enrollment.attended).toBe(false);

    const enrollmentDates = await transaction
      .selectFrom('enrollment_date')
      .select(['date', 'attended'])
      .where('enrollment_id', '=', enrollment.id)
      .orderBy('date', 'asc')
      .execute();

    expect(enrollmentDates.map(row => formatDateToIso(row.date))).toEqual([
      '2026-07-01',
      '2026-07-03',
    ]);
    expect(enrollmentDates.every(row => row.attended === false)).toBe(true);

    const remainingApplicationDates = await transaction
      .selectFrom('enrollment_application_date')
      .select('id')
      .where('application_id', '=', application.id)
      .execute();

    expect(remainingApplicationDates).toEqual([]);
  });

  test('rejecting a review-based partial application deletes its requested dates', async () => {
    const { organization, token } = await createOrganizationAccount(transaction, { email: 'org-posting-reject@example.com' });
    const { volunteer } = await createVolunteerAccount(transaction, { email: 'vol-posting-reject@example.com' });

    const posting = await transaction
      .insertInto('organization_posting')
      .values({
        organization_id: organization.id,
        title: 'Review Partial Attendance Rejection',
        description: 'Reject requested dates cleanly',
        latitude: 33.9,
        longitude: 35.5,
        max_volunteers: 20,
        start_date: new Date('2026-08-01T00:00:00.000Z'),
        start_time: '09:00:00',
        end_date: new Date('2026-08-03T00:00:00.000Z'),
        end_time: '17:00:00',
        minimum_age: 18,
        automatic_acceptance: false,
        is_closed: false,
        allows_partial_attendance: true,
        location_name: 'Test Location',
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    const application = await transaction
      .insertInto('enrollment_application')
      .values({
        volunteer_id: volunteer.id,
        posting_id: posting.id,
        message: 'Available on selected days',
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    await transaction
      .insertInto('enrollment_application_date')
      .values([
        { application_id: application.id, date: new Date('2026-08-01T00:00:00.000Z') },
        { application_id: application.id, date: new Date('2026-08-03T00:00:00.000Z') },
      ])
      .execute();

    await server
      .delete(`/organization/posting/${posting.id}/applications/${application.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const remainingApp = await transaction
      .selectFrom('enrollment_application')
      .select('id')
      .where('id', '=', application.id)
      .executeTakeFirst();

    const remainingDates = await transaction
      .selectFrom('enrollment_application_date')
      .select('id')
      .where('application_id', '=', application.id)
      .execute();

    expect(remainingApp).toBeUndefined();
    expect(remainingDates).toEqual([]);
  });
});
