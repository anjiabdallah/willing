import { sql, type ControlledTransaction } from 'kysely';
import supertest from 'supertest';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import createApp from '../../../app.ts';
import database from '../../../db/index.ts';
import { compare } from '../../../services/bcrypt/index.ts';
import * as embeddingUpdates from '../../../services/embeddings/updates.ts';
import * as jwtService from '../../../services/jwt/index.ts';
import * as emailService from '../../../services/smtp/emails.ts';
import * as volunteerService from '../../../services/volunteer/index.ts';
import { createAdminAccount, createOrganizationAccount, createVolunteerAccount } from '../../../tests/fixtures/accounts.ts';
import { createOrganizationRequest } from '../../../tests/fixtures/organizationData.ts';

import type { Database } from '../../../db/tables/index.ts';
import type { VolunteerProfileData } from '../../../services/volunteer/index.ts';
import type TestAgent from 'supertest/lib/agent.js';

let transaction: ControlledTransaction<Database>;
let server: TestAgent;

const generateJWTSpy = vi
  .spyOn(jwtService, 'generateJWT');
const sendVolunteerVerificationEmailSpy = vi
  .spyOn(emailService, 'sendVolunteerVerificationEmail')
  .mockResolvedValue(undefined);

beforeEach(async () => {
  transaction = await database.startTransaction().execute();
  server = supertest(createApp(transaction));
});

afterEach(async () => {
  await transaction.rollback().execute();
  generateJWTSpy.mockClear();
  sendVolunteerVerificationEmailSpy.mockClear();
});

describe('POST /volunteer/create', () => {
  test('returns 409 if email is used by another volunteer', async () => {
    const { volunteer } = await createVolunteerAccount(transaction);

    await server
      .post('/volunteer/create')
      .send({
        password: 'TestPassword123!',
        email: volunteer.email,
        gender: 'male',
        first_name: 'test',
        last_name: 'test',
        date_of_birth: new Date(),
      })
      .expect(409);

    const volunteersNumber = await transaction
      .selectFrom('volunteer_account')
      .select(({ fn }) => fn.count('id').as('volunteer_count'))
      .executeTakeFirst();

    const pendingVolunteersNumber = await transaction
      .selectFrom('volunteer_pending_account')
      .select(({ fn }) => fn.count('id').as('pending_volunteer_count'))
      .executeTakeFirst();

    expect(volunteersNumber?.volunteer_count).toBe('1');
    expect(pendingVolunteersNumber?.pending_volunteer_count).toBe('0');
    expect(sendVolunteerVerificationEmailSpy).not.toHaveBeenCalled();
  });

  test('returns 409 if email is used in organization request', async () => {
    const request = await createOrganizationRequest(transaction);

    await server
      .post('/volunteer/create')
      .send({
        password: 'TestPassword123!',
        email: request.email,
        gender: 'male',
        first_name: 'test',
        last_name: 'test',
        date_of_birth: new Date(),
      })
      .expect(409);

    const [{ volunteer_count }, { organization_request_count }, { pending_volunteer_count }] = await Promise.all([
      transaction
        .selectFrom('volunteer_account')
        .select(({ fn }) => fn.count('id').as('volunteer_count'))
        .executeTakeFirstOrThrow(),
      transaction
        .selectFrom('organization_request')
        .select(({ fn }) => fn.count('id').as('organization_request_count'))
        .executeTakeFirstOrThrow(),
      transaction
        .selectFrom('volunteer_pending_account')
        .select(({ fn }) => fn.count('id').as('pending_volunteer_count'))
        .executeTakeFirstOrThrow(),
    ]);

    expect(volunteer_count).toBe('0');
    expect(organization_request_count).toBe('1');
    expect(pending_volunteer_count).toBe('0');
    expect(sendVolunteerVerificationEmailSpy).not.toHaveBeenCalled();
  });

  test('returns 409 if email is used by an organization', async () => {
    const { organization } = await createOrganizationAccount(transaction);

    await server
      .post('/volunteer/create')
      .send({
        password: 'TestPassword123!',
        email: organization.email,
        gender: 'male',
        first_name: 'test',
        last_name: 'test',
        date_of_birth: new Date(),
      })
      .expect(409);

    const [{ volunteer_count }, { organization_count }, { pending_volunteer_count }] = await Promise.all([
      transaction
        .selectFrom('volunteer_account')
        .select(({ fn }) => fn.count('id').as('volunteer_count'))
        .executeTakeFirstOrThrow(),
      transaction
        .selectFrom('organization_account')
        .select(({ fn }) => fn.count('id').as('organization_count'))
        .executeTakeFirstOrThrow(),
      transaction
        .selectFrom('volunteer_pending_account')
        .select(({ fn }) => fn.count('id').as('pending_volunteer_count'))
        .executeTakeFirstOrThrow(),
    ]);

    expect(volunteer_count).toBe('0');
    expect(organization_count).toBe('1');
    expect(pending_volunteer_count).toBe('0');
    expect(sendVolunteerVerificationEmailSpy).not.toHaveBeenCalled();
  });

  test('returns 200, creates a pending volunteer, and sends verification email', async () => {
    const response = await server
      .post('/volunteer/create')
      .send({
        password: 'TestPassword123!',
        email: 'volunteer@willing.social',
        gender: 'male',
        first_name: 'John',
        last_name: 'Doe',
        date_of_birth: '2000-01-01',
      })
      .expect(200);

    expect(response.body).toEqual({ requires_email_verification: true });
    expect(generateJWTSpy).not.toHaveBeenCalled();
    expect(sendVolunteerVerificationEmailSpy).toHaveBeenCalledTimes(1);

    const pendingVolunteer = await transaction
      .selectFrom('volunteer_pending_account')
      .selectAll()
      .where('email', '=', 'volunteer@willing.social')
      .executeTakeFirstOrThrow();

    expect(pendingVolunteer.first_name).toBe('John');
    expect(pendingVolunteer.last_name).toBe('Doe');
    expect(pendingVolunteer.password).not.toBe('TestPassword123!');
    expect(pendingVolunteer.token.length).toBeGreaterThan(0);

    expect(sendVolunteerVerificationEmailSpy).toHaveBeenCalledWith({
      volunteerEmail: 'volunteer@willing.social',
      volunteerName: 'John Doe',
      verificationToken: pendingVolunteer.token,
    });

    const [volunteerCountRow, pendingVolunteerCountRow] = await Promise.all([
      transaction
        .selectFrom('volunteer_account')
        .select(({ fn }) => fn.count('id').as('volunteer_count'))
        .executeTakeFirstOrThrow(),
      transaction
        .selectFrom('volunteer_pending_account')
        .select(({ fn }) => fn.count('id').as('pending_volunteer_count'))
        .executeTakeFirstOrThrow(),
    ]);

    expect(volunteerCountRow.volunteer_count).toBe('0');
    expect(pendingVolunteerCountRow.pending_volunteer_count).toBe('1');
  });

  test('replaces existing pending volunteer entry for same email', async () => {
    await transaction
      .insertInto('volunteer_pending_account')
      .values({
        first_name: 'Old',
        last_name: 'User',
        password: 'old-hash',
        email: 'pending@willing.social',
        gender: 'male',
        date_of_birth: new Date('1999-01-01T00:00:00.000Z'),
        token: 'old-token',
      })
      .execute();

    await server
      .post('/volunteer/create')
      .send({
        password: 'TestPassword123!',
        email: 'pending@willing.social',
        gender: 'female',
        first_name: 'New',
        last_name: 'User',
        date_of_birth: '2001-02-03',
      })
      .expect(200);

    const pendingVolunteers = await transaction
      .selectFrom('volunteer_pending_account')
      .selectAll()
      .where('email', '=', 'pending@willing.social')
      .execute();

    expect(pendingVolunteers).toHaveLength(1);
    expect(pendingVolunteers[0]!.first_name).toBe('New');
    expect(pendingVolunteers[0]!.last_name).toBe('User');
    expect(pendingVolunteers[0]!.gender).toBe('female');
    expect(pendingVolunteers[0]!.token).not.toBe('old-token');
    expect(sendVolunteerVerificationEmailSpy).toHaveBeenCalledTimes(1);
  });
});

describe('POST /volunteer/verify-email', () => {
  test('returns 400 for an invalid verification token', async () => {
    await server
      .post('/volunteer/verify-email')
      .send({ key: 'invalid-token' })
      .expect(400);
  });

  test('returns 400 and deletes pending account when token is expired', async () => {
    await transaction
      .insertInto('volunteer_pending_account')
      .values({
        first_name: 'Expired',
        last_name: 'Token',
        password: 'hashed-password',
        email: 'expired-token@example.com',
        gender: 'male',
        date_of_birth: new Date('2000-01-01T00:00:00.000Z'),
        token: 'expired-token',
        created_at: sql`now() - interval '2 hours'`,
      })
      .execute();

    await server
      .post('/volunteer/verify-email')
      .send({ key: 'expired-token' })
      .expect(400);

    const pendingVolunteer = await transaction
      .selectFrom('volunteer_pending_account')
      .select('id')
      .where('email', '=', 'expired-token@example.com')
      .executeTakeFirst();

    expect(pendingVolunteer).toBeUndefined();
    expect(generateJWTSpy).not.toHaveBeenCalled();
  });

  test('returns 409 and removes pending account when account already exists', async () => {
    const { volunteer } = await createVolunteerAccount(transaction, { email: 'existing-verify@example.com' });
    generateJWTSpy.mockClear();

    await transaction
      .insertInto('volunteer_pending_account')
      .values({
        first_name: volunteer.first_name,
        last_name: volunteer.last_name,
        password: 'hashed-password',
        email: volunteer.email,
        gender: volunteer.gender,
        date_of_birth: new Date(volunteer.date_of_birth),
        token: 'existing-token',
      })
      .execute();

    await server
      .post('/volunteer/verify-email')
      .send({ key: 'existing-token' })
      .expect(409);

    const pendingVolunteer = await transaction
      .selectFrom('volunteer_pending_account')
      .select('id')
      .where('email', '=', volunteer.email)
      .executeTakeFirst();

    expect(pendingVolunteer).toBeUndefined();
    expect(generateJWTSpy).not.toHaveBeenCalled();
  });

  test('returns 200, creates volunteer account, and returns jwt token', async () => {
    const recomputeProfileSpy = vi
      .spyOn(embeddingUpdates, 'recomputeVolunteerProfileVector')
      .mockResolvedValue(null);
    const recomputeExperienceSpy = vi
      .spyOn(embeddingUpdates, 'recomputeVolunteerExperienceVector')
      .mockResolvedValue(null);

    await transaction
      .insertInto('volunteer_pending_account')
      .values({
        first_name: 'Verified',
        last_name: 'Volunteer',
        password: 'hashed-password',
        email: 'verify-success@example.com',
        gender: 'female',
        date_of_birth: new Date('2002-05-06T00:00:00.000Z'),
        token: 'valid-token',
      })
      .execute();

    const response = await server
      .post('/volunteer/verify-email')
      .send({ key: 'valid-token' })
      .expect(200);

    expect(response.body.volunteer.email).toBe('verify-success@example.com');
    expect(response.body.volunteer.password).toBeUndefined();
    expect(response.body.volunteer.profile_vector).toBeUndefined();
    expect(response.body.volunteer.experience_vector).toBeUndefined();
    expect(typeof response.body.token).toBe('string');

    expect(generateJWTSpy).toHaveBeenCalledWith({
      id: response.body.volunteer.id,
      role: 'volunteer',
      token_version: 0,
    });
    expect(recomputeProfileSpy).toHaveBeenCalledWith(response.body.volunteer.id, transaction);
    expect(recomputeExperienceSpy).toHaveBeenCalledWith(response.body.volunteer.id, transaction);

    const volunteer = await transaction
      .selectFrom('volunteer_account')
      .selectAll()
      .where('email', '=', 'verify-success@example.com')
      .executeTakeFirst();

    expect(volunteer).not.toBeUndefined();

    const pendingVolunteer = await transaction
      .selectFrom('volunteer_pending_account')
      .select('id')
      .where('email', '=', 'verify-success@example.com')
      .executeTakeFirst();

    expect(pendingVolunteer).toBeUndefined();

    recomputeProfileSpy.mockRestore();
    recomputeExperienceSpy.mockRestore();
  });
});

describe('POST /volunteer/resend-verification', () => {
  test('returns 200 and does nothing when email already belongs to a volunteer', async () => {
    const { volunteer } = await createVolunteerAccount(transaction, { email: 'resend-existing@example.com' });

    const response = await server
      .post('/volunteer/resend-verification')
      .send({ email: volunteer.email })
      .expect(200);

    expect(response.body).toEqual({});
    expect(sendVolunteerVerificationEmailSpy).not.toHaveBeenCalled();

    const { pending_volunteer_count } = await transaction
      .selectFrom('volunteer_pending_account')
      .select(({ fn }) => fn.count('id').as('pending_volunteer_count'))
      .executeTakeFirstOrThrow();

    expect(pending_volunteer_count).toBe('0');
  });

  test('returns 200 and does nothing when pending volunteer is not found', async () => {
    const response = await server
      .post('/volunteer/resend-verification')
      .send({ email: 'missing-pending@example.com' })
      .expect(200);

    expect(response.body).toEqual({});
    expect(sendVolunteerVerificationEmailSpy).not.toHaveBeenCalled();
  });

  test('returns 200, rotates pending token, and resends verification email', async () => {
    const oldCreatedAt = new Date('2025-01-01T00:00:00.000Z');

    await transaction
      .insertInto('volunteer_pending_account')
      .values({
        first_name: 'Resend',
        last_name: 'Volunteer',
        password: 'hashed-password',
        email: 'resend@example.com',
        gender: 'male',
        date_of_birth: new Date('2001-07-08T00:00:00.000Z'),
        token: 'old-token',
        created_at: oldCreatedAt,
      })
      .execute();

    const response = await server
      .post('/volunteer/resend-verification')
      .send({ email: 'resend@example.com' })
      .expect(200);

    expect(response.body).toEqual({});
    expect(sendVolunteerVerificationEmailSpy).toHaveBeenCalledTimes(1);

    const pendingVolunteer = await transaction
      .selectFrom('volunteer_pending_account')
      .selectAll()
      .where('email', '=', 'resend@example.com')
      .executeTakeFirstOrThrow();

    expect(pendingVolunteer.token).not.toBe('old-token');
    expect(pendingVolunteer.created_at.getTime()).toBeGreaterThan(oldCreatedAt.getTime());

    expect(sendVolunteerVerificationEmailSpy).toHaveBeenCalledWith({
      volunteerEmail: 'resend@example.com',
      volunteerName: 'Resend Volunteer',
      verificationToken: pendingVolunteer.token,
    });
  });
});

describe('GET /volunteer/me', () => {
  test('returns 403 when unauthenticated', async () => {
    await server
      .get('/volunteer/me')
      .expect(403);
  });

  test('returns 403 when logged in as organization', async () => {
    const { token: orgToken } = await createOrganizationAccount(transaction);

    await server
      .get('/volunteer/me')
      .set('Authorization', 'Bearer ' + orgToken)
      .expect(403);
  });

  test('returns 403 when logged in as admin', async () => {
    const { token: adminToken } = await createAdminAccount(transaction);

    await server
      .get('/volunteer/me')
      .set('Authorization', 'Bearer ' + adminToken)
      .expect(403);
  });

  test('returns 200 with the currently logged in volunteer', async () => {
    const { volunteer, token } = await createVolunteerAccount(transaction);

    const response = await server
      .get('/volunteer/me')
      .set('Authorization', 'Bearer ' + token)
      .expect(200);

    expect(response.body).toMatchObject({
      volunteer: {
        email: volunteer.email,
      },
    });
  });
});

describe('GET /volunteer/profile', () => {
  test('returns 403 when unauthenticated', async () => {
    await server
      .get('/volunteer/profile')
      .expect(403);
  });

  test('returns 403 when logged in as organization', async () => {
    const { token: orgToken } = await createOrganizationAccount(transaction);

    await server
      .get('/volunteer/profile')
      .set('Authorization', 'Bearer ' + orgToken)
      .expect(403);
  });

  test('returns 403 when logged in as admin', async () => {
    const { token: adminToken } = await createAdminAccount(transaction);

    await server
      .get('/volunteer/profile')
      .set('Authorization', 'Bearer ' + adminToken)
      .expect(403);
  });

  test('returns profile data for the current volunteer', async () => {
    const { volunteer, token } = await createVolunteerAccount(transaction);

    const profileData: VolunteerProfileData = {
      volunteer: {
        id: volunteer.id,
        first_name: volunteer.first_name,
        last_name: volunteer.last_name,
        email: volunteer.email,
        date_of_birth: volunteer.date_of_birth,
        gender: volunteer.gender,
        cv_path: 'uploads/cv.pdf',
        description: 'Ready to lend a hand',
      },
      skills: ['First Aid', 'CPR'],
      experience_stats: {
        total_completed_experiences: 2,
        organizations_supported: 2,
        crisis_related_experiences: 1,
        total_hours_completed: 12,
        total_skills_used: 4,
        most_volunteered_crisis: 'Winter Storm',
      },
      completed_experiences: [
        {
          enrollment_id: 101,
          posting_id: 202,
          posting_title: 'Food Drive',
          organization_id: 303,
          organization_name: 'Helping Hands',
          organization_logo_path: null,
          location_name: 'Community Center',
          start_date: new Date('2025-01-15T00:00:00.000Z'),
          start_time: '08:00:00',
          end_date: new Date('2025-01-15T00:00:00.000Z'),
          end_time: '12:00:00',
          crisis_name: null,
          is_closed: false,
          automatic_acceptance: true,
          enrollment_count: 12,
        },
      ],
    };

    const getVolunteerProfileSpy = vi
      .spyOn(volunteerService, 'getVolunteerProfile')
      .mockResolvedValue(profileData);

    const response = await server
      .get('/volunteer/profile')
      .set('Authorization', 'Bearer ' + token)
      .expect(200);

    expect(getVolunteerProfileSpy).toHaveBeenCalledWith(volunteer.id);
    expect(response.body).toEqual(JSON.parse(JSON.stringify(profileData)));

    getVolunteerProfileSpy.mockRestore();
  });
});

describe('GET /volunteer/certificate', () => {
  test('returns 403 when unauthenticated', async () => {
    await server
      .get('/volunteer/certificate')
      .expect(403);
  });

  test('returns total hours, organization eligibility, and platform certificate info', async () => {
    const { volunteer, token } = await createVolunteerAccount(transaction, { email: 'certificate-volunteer@example.com' });
    const { organization } = await createOrganizationAccount(transaction, { email: 'certificate-org@example.com' });

    const certificateInfo = await transaction
      .insertInto('organization_certificate_info')
      .values({
        certificate_feature_enabled: true,
        hours_threshold: 3,
        signatory_name: 'Org Signatory',
        signatory_position: 'Director',
        signature_path: 'uploads/org-signature.png',
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    await transaction
      .updateTable('organization_account')
      .set({ certificate_info_id: certificateInfo.id })
      .where('id', '=', organization.id)
      .execute();

    const posting = await transaction
      .insertInto('organization_posting')
      .values({
        organization_id: organization.id,
        title: 'Relief Packing',
        description: 'Prepare family food boxes',
        latitude: 33.9,
        longitude: 35.5,
        max_volunteers: 25,
        start_date: new Date('2026-02-01T00:00:00.000Z'),
        start_time: '09:00:00',
        end_date: new Date('2026-02-01T00:00:00.000Z'),
        end_time: '13:00:00',
        minimum_age: 18,
        automatic_acceptance: true,
        is_closed: false,
        allows_partial_attendance: false,
        location_name: 'Beirut',
        crisis_id: undefined,
        created_at: new Date('2026-01-01T00:00:00.000Z'),
        updated_at: new Date('2026-01-01T00:00:00.000Z'),
      })
      .returning(['id'])
      .executeTakeFirstOrThrow();

    await transaction
      .insertInto('enrollment')
      .values({
        volunteer_id: volunteer.id,
        posting_id: posting.id,
        attended: true,
        created_at: new Date('2026-02-02T00:00:00.000Z'),
      })
      .execute();

    await transaction
      .insertInto('platform_certificate_settings')
      .values({
        signatory_name: 'Old Signatory',
        signatory_position: 'Legacy Lead',
        signature_path: 'uploads/old-platform.png',
        signature_uploaded_by_admin_id: null,
        created_at: new Date('2026-01-04T00:00:00.000Z'),
        updated_at: new Date('2026-01-04T00:00:00.000Z'),
      })
      .execute();

    const latestPlatform = await transaction
      .insertInto('platform_certificate_settings')
      .values({
        signatory_name: 'Platform Lead',
        signatory_position: 'Coordinator',
        signature_path: 'uploads/platform.png',
        signature_uploaded_by_admin_id: null,
        created_at: new Date('2026-01-05T00:00:00.000Z'),
        updated_at: new Date('2026-01-05T00:00:00.000Z'),
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    const response = await server
      .get('/volunteer/certificate')
      .set('Authorization', 'Bearer ' + token)
      .expect(200);

    expect(response.body).toMatchObject({
      volunteer: {
        id: volunteer.id,
        first_name: volunteer.first_name,
        last_name: volunteer.last_name,
      },
      total_hours: 4,
      platform_certificate: {
        signatory_name: latestPlatform.signatory_name,
        signatory_position: latestPlatform.signatory_position,
        signature_path: latestPlatform.signature_path,
      },
    });

    expect(response.body.organizations).toHaveLength(1);
    expect(response.body.organizations[0]).toEqual({
      id: organization.id,
      name: organization.name,
      hours: 4,
      hours_threshold: 3,
      certificate_feature_enabled: true,
      eligible: true,
      logo_path: null,
      signatory_name: 'Org Signatory',
      signatory_position: 'Director',
      signature_path: 'uploads/org-signature.png',
    });
  });

  test('returns empty organizations and null platform certificate when no certificate data exists', async () => {
    const { volunteer, token } = await createVolunteerAccount(transaction, { email: 'certificate-empty@example.com' });

    const response = await server
      .get('/volunteer/certificate')
      .set('Authorization', 'Bearer ' + token)
      .expect(200);

    expect(response.body).toMatchObject({
      volunteer: {
        id: volunteer.id,
        first_name: volunteer.first_name,
        last_name: volunteer.last_name,
      },
      total_hours: 0,
      organizations: [],
      platform_certificate: null,
    });
  });
});

describe('GET /volunteer/crises/pinned', () => {
  test('returns pinned crises ordered by creation time', async () => {
    const { token } = await createVolunteerAccount(transaction, { email: 'crisis-pinned@example.com' });

    const olderPinned = await transaction
      .insertInto('crisis')
      .values({
        name: 'Flood Response',
        description: 'Support flooded regions',
        pinned: true,
        created_at: new Date('2024-01-01T00:00:00.000Z'),
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    const latestPinned = await transaction
      .insertInto('crisis')
      .values({
        name: 'Wildfire Relief',
        description: 'Coordinate evacuations',
        pinned: true,
        created_at: new Date('2024-02-01T00:00:00.000Z'),
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    await transaction
      .insertInto('crisis')
      .values({
        name: 'Unpinned Event',
        description: 'General support',
        pinned: false,
        created_at: new Date('2024-03-01T00:00:00.000Z'),
      })
      .execute();

    const response = await server
      .get('/volunteer/crises/pinned')
      .set('Authorization', 'Bearer ' + token)
      .expect(200);

    expect(response.body.crises).toHaveLength(2);
    expect(response.body.crises.map((crisis: { id: number }) => crisis.id)).toEqual([
      latestPinned.id,
      olderPinned.id,
    ]);
  });
});

describe('GET /volunteer/crises/:id', () => {
  test('returns 400 for non-positive crisis id', async () => {
    const { token } = await createVolunteerAccount(transaction, { email: 'crisis-invalid-id@example.com' });

    await server
      .get('/volunteer/crises/0')
      .set('Authorization', 'Bearer ' + token)
      .expect(400);
  });

  test('returns 404 for unknown crisis', async () => {
    const { token } = await createVolunteerAccount(transaction, { email: 'crisis-lookup@example.com' });

    await server
      .get('/volunteer/crises/999999')
      .set('Authorization', 'Bearer ' + token)
      .expect(404);
  });

  test('returns the requested crisis', async () => {
    const { token } = await createVolunteerAccount(transaction, { email: 'crisis-lookup-success@example.com' });

    const crisis = await transaction
      .insertInto('crisis')
      .values({
        name: 'Fuel Shortage',
        description: 'Coordinate deliveries',
        pinned: false,
        created_at: new Date('2025-03-01T00:00:00.000Z'),
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    const response = await server
      .get(`/volunteer/crises/${crisis.id}`)
      .set('Authorization', 'Bearer ' + token)
      .expect(200);

    expect(response.body.crisis).toMatchObject({
      id: crisis.id,
      name: 'Fuel Shortage',
      description: 'Coordinate deliveries',
      pinned: false,
    });
  });
});

describe('PUT /volunteer/profile', () => {
  test('returns 403 when unauthenticated', async () => {
    await server
      .put('/volunteer/profile')
      .send({ first_name: 'Updated' })
      .expect(403);
  });

  test('returns 403 when logged in as organization', async () => {
    const { token } = await createOrganizationAccount(transaction, { email: 'profile-org-forbidden@example.com' });

    await server
      .put('/volunteer/profile')
      .set('Authorization', 'Bearer ' + token)
      .send({ first_name: 'Updated' })
      .expect(403);
  });

  test('returns 403 when logged in as admin', async () => {
    const { token } = await createAdminAccount(transaction, { email: 'profile-admin-forbidden@example.com' });

    await server
      .put('/volunteer/profile')
      .set('Authorization', 'Bearer ' + token)
      .send({ first_name: 'Updated' })
      .expect(403);
  });

  test('updates volunteer details, replaces skills, and recomputes profile vector', async () => {
    const { volunteer, token } = await createVolunteerAccount(transaction, { email: 'profile-update@example.com' });

    await transaction
      .insertInto('volunteer_skill')
      .values({ volunteer_id: volunteer.id, name: 'First Aid' })
      .execute();

    const recomputeProfileSpy = vi
      .spyOn(embeddingUpdates, 'recomputeVolunteerProfileVector')
      .mockResolvedValue(null);

    const profileData: VolunteerProfileData = {
      volunteer: {
        id: volunteer.id,
        first_name: 'Updated',
        last_name: volunteer.last_name,
        email: volunteer.email,
        date_of_birth: volunteer.date_of_birth,
        gender: volunteer.gender,
        cv_path: undefined,
        description: 'Available evenings',
      },
      skills: ['First Aid', 'Logistics'],
      experience_stats: {
        total_completed_experiences: 0,
        organizations_supported: 0,
        crisis_related_experiences: 0,
        total_hours_completed: 0,
        total_skills_used: 0,
        most_volunteered_crisis: null,
      },
      completed_experiences: [],
    };

    const getVolunteerProfileSpy = vi
      .spyOn(volunteerService, 'getVolunteerProfile')
      .mockResolvedValue(profileData);

    const response = await server
      .put('/volunteer/profile')
      .set('Authorization', 'Bearer ' + token)
      .send({
        first_name: 'Updated',
        description: 'Available evenings',
        skills: ['Logistics ', 'First Aid', 'Logistics'],
      })
      .expect(200);

    expect(recomputeProfileSpy).toHaveBeenCalledWith(volunteer.id, transaction);
    expect(getVolunteerProfileSpy).toHaveBeenCalledWith(volunteer.id);
    expect(response.body).toEqual(JSON.parse(JSON.stringify(profileData)));

    const updatedVolunteer = await transaction
      .selectFrom('volunteer_account')
      .select(['first_name', 'description'])
      .where('id', '=', volunteer.id)
      .executeTakeFirst();

    expect(updatedVolunteer).not.toBeUndefined();
    expect(updatedVolunteer).toMatchObject({
      first_name: 'Updated',
      description: 'Available evenings',
    });

    const updatedSkills = await transaction
      .selectFrom('volunteer_skill')
      .select('name')
      .where('volunteer_id', '=', volunteer.id)
      .orderBy('name', 'asc')
      .execute();

    expect(updatedSkills.map(skill => skill.name)).toEqual(['First Aid', 'Logistics']);

    recomputeProfileSpy.mockRestore();
    getVolunteerProfileSpy.mockRestore();
  });

  test('does not recompute profile vector for a no-op update payload', async () => {
    const { volunteer, token } = await createVolunteerAccount(transaction, { email: 'profile-noop@example.com' });

    await transaction
      .insertInto('volunteer_skill')
      .values({ volunteer_id: volunteer.id, name: 'First Aid' })
      .execute();

    const recomputeProfileSpy = vi
      .spyOn(embeddingUpdates, 'recomputeVolunteerProfileVector')
      .mockResolvedValue(null);

    const profileData: VolunteerProfileData = {
      volunteer: {
        id: volunteer.id,
        first_name: volunteer.first_name,
        last_name: volunteer.last_name,
        email: volunteer.email,
        date_of_birth: volunteer.date_of_birth,
        gender: volunteer.gender,
        cv_path: volunteer.cv_path,
        description: volunteer.description ?? '',
      },
      skills: ['First Aid'],
      experience_stats: {
        total_completed_experiences: 0,
        organizations_supported: 0,
        crisis_related_experiences: 0,
        total_hours_completed: 0,
        total_skills_used: 0,
        most_volunteered_crisis: null,
      },
      completed_experiences: [],
    };

    const getVolunteerProfileSpy = vi
      .spyOn(volunteerService, 'getVolunteerProfile')
      .mockResolvedValue(profileData);

    const response = await server
      .put('/volunteer/profile')
      .set('Authorization', 'Bearer ' + token)
      .send({})
      .expect(200);

    expect(recomputeProfileSpy).not.toHaveBeenCalled();
    expect(getVolunteerProfileSpy).toHaveBeenCalledWith(volunteer.id);
    expect(response.body).toEqual(JSON.parse(JSON.stringify(profileData)));

    const skills = await transaction
      .selectFrom('volunteer_skill')
      .select('name')
      .where('volunteer_id', '=', volunteer.id)
      .orderBy('name', 'asc')
      .execute();

    expect(skills.map(skill => skill.name)).toEqual(['First Aid']);

    recomputeProfileSpy.mockRestore();
    getVolunteerProfileSpy.mockRestore();
  });

  test('clears all skills when skills is an empty array and recomputes profile vector', async () => {
    const { volunteer, token } = await createVolunteerAccount(transaction, { email: 'profile-clear-skills@example.com' });

    await transaction
      .insertInto('volunteer_skill')
      .values([
        { volunteer_id: volunteer.id, name: 'First Aid' },
        { volunteer_id: volunteer.id, name: 'Logistics' },
      ])
      .execute();

    const recomputeProfileSpy = vi
      .spyOn(embeddingUpdates, 'recomputeVolunteerProfileVector')
      .mockResolvedValue(null);

    const profileData: VolunteerProfileData = {
      volunteer: {
        id: volunteer.id,
        first_name: volunteer.first_name,
        last_name: volunteer.last_name,
        email: volunteer.email,
        date_of_birth: volunteer.date_of_birth,
        gender: volunteer.gender,
        cv_path: volunteer.cv_path,
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
    };

    const getVolunteerProfileSpy = vi
      .spyOn(volunteerService, 'getVolunteerProfile')
      .mockResolvedValue(profileData);

    const response = await server
      .put('/volunteer/profile')
      .set('Authorization', 'Bearer ' + token)
      .send({ skills: [] })
      .expect(200);

    expect(recomputeProfileSpy).toHaveBeenCalledWith(volunteer.id, transaction);
    expect(getVolunteerProfileSpy).toHaveBeenCalledWith(volunteer.id);
    expect(response.body).toEqual(JSON.parse(JSON.stringify(profileData)));

    const skills = await transaction
      .selectFrom('volunteer_skill')
      .select('name')
      .where('volunteer_id', '=', volunteer.id)
      .execute();

    expect(skills).toEqual([]);

    recomputeProfileSpy.mockRestore();
    getVolunteerProfileSpy.mockRestore();
  });
});

describe('GET /volunteer/organizations', () => {
  test('returns 403 when unauthenticated', async () => {
    await server
      .get('/volunteer/organizations')
      .expect(403);
  });

  test('returns organizations with posting counts sorted by name by default', async () => {
    const { token } = await createVolunteerAccount(transaction, { email: 'org-search-viewer@example.com' });
    const { organization: firstOrg } = await createOrganizationAccount(transaction, {
      email: 'org-a@example.com',
      name: 'Alpha Responders',
      phone_number: '123-456-7890',
      url: 'https://alpharesponders.org',
    });
    const { organization: secondOrg } = await createOrganizationAccount(transaction, {
      email: 'org-b@example.com',
      name: 'Bravo Collective',
      phone_number: '987-654-3210',
      url: 'https://bravocollective.org',
    });

    await transaction
      .insertInto('organization_posting')
      .values([
        {
          organization_id: firstOrg.id,
          title: 'First Posting',
          description: 'Support first area',
          latitude: 33.9,
          longitude: 35.5,
          start_date: new Date('2026-02-01T00:00:00.000Z'),
          start_time: '09:00:00',
          end_date: new Date('2026-02-01T00:00:00.000Z'),
          end_time: '13:00:00',
          automatic_acceptance: true,
          is_closed: false,
          allows_partial_attendance: false,
          location_name: 'Beirut Downtown',
        },
        {
          organization_id: firstOrg.id,
          title: 'Second Posting',
          description: 'Support second area',
          latitude: 33.91,
          longitude: 35.51,
          start_date: new Date('2026-02-02T00:00:00.000Z'),
          start_time: '09:00:00',
          end_date: new Date('2026-02-02T00:00:00.000Z'),
          end_time: '13:00:00',
          automatic_acceptance: true,
          is_closed: false,
          allows_partial_attendance: false,
          location_name: 'Beirut Waterfront',
        },
        {
          organization_id: secondOrg.id,
          title: 'Third Posting',
          description: 'Support third area',
          latitude: 33.92,
          longitude: 35.52,
          start_date: new Date('2026-02-03T00:00:00.000Z'),
          start_time: '09:00:00',
          end_date: new Date('2026-02-03T00:00:00.000Z'),
          end_time: '13:00:00',
          automatic_acceptance: true,
          is_closed: false,
          allows_partial_attendance: false,
          location_name: 'Beirut Suburbs',
        },
      ])
      .execute();

    const response = await server
      .get('/volunteer/organizations')
      .set('Authorization', 'Bearer ' + token)
      .expect(200);

    expect(response.body.organizations.map((org: { name: string }) => org.name)).toEqual([
      'Alpha Responders',
      'Bravo Collective',
    ]);

    expect(response.body.organizations).toEqual([
      {
        id: firstOrg.id,
        name: 'Alpha Responders',
        description: null,
        location_name: 'Beirut',
        logo_path: null,
        posting_count: 2,
      },
      {
        id: secondOrg.id,
        name: 'Bravo Collective',
        description: null,
        location_name: 'Beirut',
        logo_path: null,
        posting_count: 1,
      },
    ]);
  });

  test('applies search across organization fields', async () => {
    const { token } = await createVolunteerAccount(transaction, { email: 'org-search-filter@example.com' });
    const { organization: matchingOrg } = await createOrganizationAccount(transaction, {
      email: 'beirut-helpers@example.com',
      name: 'Beirut Helpers',
      phone_number: '111-222-3333',
      url: 'https://beirut-helpers.example.org',
    });

    await transaction
      .updateTable('organization_account')
      .set({
        description: 'Emergency logistics and food support',
        location_name: 'Beirut Downtown',
      })
      .where('id', '=', matchingOrg.id)
      .execute();

    await createOrganizationAccount(transaction, {
      email: 'tripoli-care@example.com',
      name: 'Tripoli Care Network',
      phone_number: '444-555-6666',
      url: 'https://tripoli-care.example.org',
    });

    const response = await server
      .get('/volunteer/organizations?search=beiruthelpers')
      .set('Authorization', 'Bearer ' + token)
      .expect(200);

    expect(response.body.organizations).toHaveLength(1);
    expect(response.body.organizations[0]).toMatchObject({
      id: matchingOrg.id,
      name: 'Beirut Helpers',
    });
  });
});

describe('GET /volunteer/crises', () => {
  test('returns 403 when unauthenticated', async () => {
    await server
      .get('/volunteer/crises')
      .expect(403);
  });

  test('returns crises with pinned entries first by default sorting', async () => {
    const { token } = await createVolunteerAccount(transaction, { email: 'crises-default-sort@example.com' });

    await transaction
      .insertInto('crisis')
      .values([
        {
          name: 'Bravo Crisis',
          description: 'Unpinned crisis',
          pinned: false,
          created_at: new Date('2026-01-01T00:00:00.000Z'),
        },
        {
          name: 'Zulu Crisis',
          description: 'Pinned crisis',
          pinned: true,
          created_at: new Date('2026-01-02T00:00:00.000Z'),
        },
        {
          name: 'Alpha Crisis',
          description: 'Pinned crisis',
          pinned: true,
          created_at: new Date('2026-01-03T00:00:00.000Z'),
        },
      ])
      .execute();

    const response = await server
      .get('/volunteer/crises')
      .set('Authorization', 'Bearer ' + token)
      .expect(200);

    expect(response.body.crises.map((crisis: { name: string }) => crisis.name)).toEqual([
      'Alpha Crisis',
      'Zulu Crisis',
      'Bravo Crisis',
    ]);
  });

  test('filters by pinned flag and supports title_desc sorting', async () => {
    const { token } = await createVolunteerAccount(transaction, { email: 'crises-filter-sort@example.com' });

    await transaction
      .insertInto('crisis')
      .values([
        {
          name: 'Storm Aid',
          description: 'Primary storm response',
          pinned: true,
          created_at: new Date('2026-02-01T00:00:00.000Z'),
        },
        {
          name: 'Avalanche Rescue',
          description: 'Mountain response',
          pinned: true,
          created_at: new Date('2026-02-02T00:00:00.000Z'),
        },
        {
          name: 'Storm Recovery',
          description: 'Long-term support',
          pinned: false,
          created_at: new Date('2026-02-03T00:00:00.000Z'),
        },
      ])
      .execute();

    const response = await server
      .get('/volunteer/crises?pinned=true&sort_by=title_desc')
      .set('Authorization', 'Bearer ' + token)
      .expect(200);

    expect(response.body.crises.map((crisis: { name: string }) => crisis.name)).toEqual([
      'Storm Aid',
      'Avalanche Rescue',
    ]);
  });
});

describe('POST /volunteer/reset-password', () => {
  test('returns 403 when unauthenticated', async () => {
    await server
      .post('/volunteer/reset-password')
      .send({ currentPassword: 'current', newPassword: 'NewPassword123!' })
      .expect(403);
  });

  test('returns 403 when logged in as organization', async () => {
    const { token } = await createOrganizationAccount(transaction, { email: 'reset-password-org@example.com' });

    await server
      .post('/volunteer/reset-password')
      .set('Authorization', 'Bearer ' + token)
      .send({ currentPassword: 'OrgPassword123!', newPassword: 'NewPassword123!' })
      .expect(403);
  });

  test('returns 403 when current password is incorrect', async () => {
    const { token } = await createVolunteerAccount(transaction, { email: 'reset-password-invalid-current@example.com' });

    await server
      .post('/volunteer/reset-password')
      .set('Authorization', 'Bearer ' + token)
      .send({ currentPassword: 'WrongPassword123!', newPassword: 'NewPassword123!' })
      .expect(403);
  });

  test('updates password hash and returns a fresh token when current password is correct', async () => {
    const { volunteer, token, plainPassword } = await createVolunteerAccount(transaction, { email: 'reset-password-success@example.com' });

    const beforeUpdate = await transaction
      .selectFrom('volunteer_account')
      .select('password')
      .where('id', '=', volunteer.id)
      .executeTakeFirstOrThrow();

    const response = await server
      .post('/volunteer/reset-password')
      .set('Authorization', 'Bearer ' + token)
      .send({ currentPassword: plainPassword, newPassword: 'NewPassword123!' })
      .expect(200);

    expect(typeof response.body.token).toBe('string');
    expect(response.body.token.length).toBeGreaterThan(0);

    const afterUpdate = await transaction
      .selectFrom('volunteer_account')
      .select('password')
      .where('id', '=', volunteer.id)
      .executeTakeFirstOrThrow();

    expect(afterUpdate.password).not.toBe(beforeUpdate.password);
    expect(await compare(plainPassword, afterUpdate.password)).toBe(false);
    expect(await compare('NewPassword123!', afterUpdate.password)).toBe(true);
  });
});
