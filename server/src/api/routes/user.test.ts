import supertest from 'supertest';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import createApp from '../../app.ts';
import database from '../../db/index.ts';
import { compare } from '../../services/bcrypt/index.ts';
import * as emailService from '../../services/smtp/emails.ts';
import { createAdminAccount, createOrganizationAccount, createVolunteerAccount } from '../../tests/fixtures/accounts.ts';

import type { Database } from '../../db/tables/index.ts';
import type { ControlledTransaction } from 'kysely';
import type TestAgent from 'supertest/lib/agent.js';

const sendPasswordResetEmailSpy = vi
  .spyOn(emailService, 'sendPasswordResetEmail')
  .mockResolvedValue(undefined);

let transaction: ControlledTransaction<Database>;
let server: TestAgent;

beforeEach(async () => {
  transaction = await database.startTransaction().execute();
  server = supertest(createApp(transaction));
});

afterEach(async () => {
  await transaction.rollback().execute();
  sendPasswordResetEmailSpy.mockClear();
});

describe('POST /user/login', () => {
  test('returns 400 for invalid login payload', async () => {
    await server
      .post('/user/login')
      .send({ email: 'invalid-email-format' })
      .expect(400);
  });

  test('logs in organization account with valid credentials', async () => {
    const { organization, plainPassword } = await createOrganizationAccount(transaction);

    const response = await server
      .post('/user/login')
      .send({ email: organization.email, password: plainPassword })
      .expect(200);

    expect(response.body.role).toBe('organization');
    expect(typeof response.body.token).toBe('string');
    expect(response.body.organization).toMatchObject({
      id: organization.id,
      email: organization.email,
      name: organization.name,
    });
    expect(response.body.organization.password).toBeUndefined();
    expect(response.body.organization.org_vector).toBeUndefined();
  });

  test('logs in volunteer account with valid credentials', async () => {
    const { volunteer, plainPassword } = await createVolunteerAccount(transaction, {
      email: 'login-vol@example.com',
    });

    const response = await server
      .post('/user/login')
      .send({ email: volunteer.email, password: plainPassword })
      .expect(200);

    expect(response.body.role).toBe('volunteer');
    expect(response.body.volunteer).toMatchObject({
      id: volunteer.id,
      email: volunteer.email,
      first_name: volunteer.first_name,
    });
    expect(response.body.volunteer.password).toBeUndefined();
    expect(response.body.volunteer.profile_vector).toBeUndefined();
    expect(response.body.volunteer.experience_vector).toBeUndefined();
  });

  test('rejects login for inexistent account', async () => {
    const response = await server
      .post('/user/login')
      .send({ email: 'missing@example.com', password: 'password' })
      .expect(403);

    expect(response.body.message).toBe('Invalid email or password');
  });

  test('rejects login for organization account', async () => {
    const { organization } = await createOrganizationAccount(transaction);

    const response = await server
      .post('/user/login')
      .send({ email: organization.email, password: 'wrongpassword' })
      .expect(403);

    expect(response.body.message).toBe('Invalid email or password');
  });

  test('rejects login for volunteer account', async () => {
    const { volunteer } = await createVolunteerAccount(transaction);

    const response = await server
      .post('/user/login')
      .send({ email: volunteer.email, password: 'wrongpassword' })
      .expect(403);

    expect(response.body.message).toBe('Invalid email or password');
  });

  test('rejects login for correct admin credentials', async () => {
    const { admin, plainPassword } = await createAdminAccount(transaction);

    const response = await server
      .post('/user/login')
      .send({ email: admin.email, password: plainPassword })
      .expect(403);

    expect(response.body.message).toBe('Invalid email or password');
  });
});

describe('POST /user/forgot-password', () => {
  test('returns 400 for invalid email format', async () => {
    await server
      .post('/user/forgot-password')
      .send({ email: 'not-an-email' })
      .expect(400);

    expect(sendPasswordResetEmailSpy).not.toHaveBeenCalled();
  });

  test('silently succeeds when the email is unknown', async () => {
    const response = await server
      .post('/user/forgot-password')
      .send({ email: 'unknown@example.com' })
      .expect(200);

    expect(response.body).toEqual({});

    const tokens = await transaction
      .selectFrom('password_reset_token')
      .selectAll()
      .execute();
    expect(tokens).toHaveLength(0);
    expect(sendPasswordResetEmailSpy).not.toHaveBeenCalled();
  });

  test('creates a reset token and emails organization', async () => {
    const { organization } = await createOrganizationAccount(transaction);

    const response = await server
      .post('/user/forgot-password')
      .send({ email: organization.email })
      .expect(200);

    expect(response.body).toEqual({});

    const tokens = await transaction
      .selectFrom('password_reset_token')
      .selectAll()
      .execute();

    expect(tokens).toHaveLength(1);
    expect(tokens[0]!.user_id).toBe(organization.id);
    expect(tokens[0]!.role).toBe('organization');

    expect(sendPasswordResetEmailSpy).toHaveBeenCalledTimes(1);
    expect(sendPasswordResetEmailSpy).toHaveBeenCalledWith(
      organization.email,
      organization.name,
      tokens[0]!.token,
    );
  });

  test('creates a reset token and emails volunteer', async () => {
    const { volunteer } = await createVolunteerAccount(transaction);

    const response = await server
      .post('/user/forgot-password')
      .send({ email: volunteer.email })
      .expect(200);

    expect(response.body).toEqual({});

    const tokens = await transaction
      .selectFrom('password_reset_token')
      .selectAll()
      .execute();

    expect(tokens).toHaveLength(1);
    expect(tokens[0]!.user_id).toBe(volunteer.id);
    expect(tokens[0]!.role).toBe('volunteer');

    expect(sendPasswordResetEmailSpy).toHaveBeenCalledTimes(1);
    expect(sendPasswordResetEmailSpy).toHaveBeenCalledWith(
      volunteer.email,
      `${volunteer.first_name} ${volunteer.last_name}`,
      tokens[0]!.token,
    );
  });

  test('doesn\'t create a reset token for admin', async () => {
    const { admin } = await createAdminAccount(transaction, {
      email: 'reset-admin@example.com',
    });

    const response = await server
      .post('/user/forgot-password')
      .send({ email: admin.email })
      .expect(200);

    expect(response.body).toEqual({});

    const tokens = await transaction
      .selectFrom('password_reset_token')
      .selectAll()
      .execute();

    expect(tokens).toHaveLength(0);

    expect(sendPasswordResetEmailSpy).not.toHaveBeenCalled();
  });
});

describe('POST /user/forgot-password/reset', () => {
  test('returns 400 when reset payload is invalid', async () => {
    await server
      .post('/user/forgot-password/reset')
      .send({ key: '', password: 'ValidPass123!' })
      .expect(400);
  });

  test('updates the password of a volunteer and deletes the token', async () => {
    const { volunteer } = await createVolunteerAccount(transaction, {
      email: 'needs-reset@example.com',
      password: 'OldPassword123!',
    });

    const resetTokenKey = 'test-reset-token';
    await transaction
      .insertInto('password_reset_token')
      .values({
        user_id: volunteer.id,
        role: 'volunteer',
        token: resetTokenKey,
        expires_at: new Date(Date.now() + 60 * 60 * 1000),
        created_at: new Date(),
      })
      .execute();

    const newPassword = 'NewPassword123!';
    const response = await server
      .post('/user/forgot-password/reset')
      .send({ key: resetTokenKey, password: newPassword })
      .expect(200);

    expect(response.body).toEqual({});

    const updatedVolunteer = await transaction
      .selectFrom('volunteer_account')
      .select(['password'])
      .where('id', '=', volunteer.id)
      .executeTakeFirstOrThrow();

    expect(await compare(newPassword, updatedVolunteer.password)).toBe(true);

    const tokens = await transaction
      .selectFrom('password_reset_token')
      .selectAll()
      .execute();
    expect(tokens).toHaveLength(0);
  });

  test('updates the password of an organization and deletes the token', async () => {
    const { organization } = await createOrganizationAccount(transaction, {
      email: 'needs-reset@example.com',
      password: 'OldPassword123!',
    });

    const resetTokenKey = 'test-reset-token';
    await transaction
      .insertInto('password_reset_token')
      .values({
        user_id: organization.id,
        role: 'organization',
        token: resetTokenKey,
        expires_at: new Date(Date.now() + 60 * 60 * 1000),
        created_at: new Date(),
      })
      .execute();

    const newPassword = 'NewPassword123!';
    const response = await server
      .post('/user/forgot-password/reset')
      .send({ key: resetTokenKey, password: newPassword })
      .expect(200);

    expect(response.body).toEqual({});

    const updatedOrganization = await transaction
      .selectFrom('organization_account')
      .select(['password'])
      .where('id', '=', organization.id)
      .executeTakeFirstOrThrow();

    expect(await compare(newPassword, updatedOrganization.password)).toBe(true);

    const tokens = await transaction
      .selectFrom('password_reset_token')
      .selectAll()
      .execute();
    expect(tokens).toHaveLength(0);
  });

  test('returns 400 for unknown reset token', async () => {
    await server
      .post('/user/forgot-password/reset')
      .send({ key: 'unknown-token', password: 'Whatever123!' })
      .expect(400);
  });

  test('returns 400 for expired token', async () => {
    const { organization } = await createOrganizationAccount(transaction, {
      email: 'needs-reset@example.com',
      password: 'OldPassword123!',
    });

    const resetTokenKey = 'test-reset-token';
    await transaction
      .insertInto('password_reset_token')
      .values({
        user_id: organization.id,
        role: 'organization',
        token: resetTokenKey,
        expires_at: new Date(Date.now() - 60 * 1000),
        created_at: new Date(Date.now() - 61 * 60 * 1000),
      })
      .execute();

    const response = await server
      .post('/user/forgot-password/reset')
      .send({ key: resetTokenKey, password: 'Whatever123!' })
      .expect(400);

    expect(response.body.message).toBe('Reset token has expired');

    const tokens = await transaction
      .selectFrom('password_reset_token')
      .selectAll()
      .execute();

    expect(tokens).toHaveLength(1);
  });

  test('doesn\'t allow setting a weak password', async () => {
    const { volunteer } = await createVolunteerAccount(transaction, {
      email: 'needs-reset@example.com',
      password: 'OldPassword123!',
    });

    const resetTokenKey = 'test-reset-token';
    await transaction
      .insertInto('password_reset_token')
      .values({
        user_id: volunteer.id,
        role: 'volunteer',
        token: resetTokenKey,
        expires_at: new Date(Date.now() + 60 * 60 * 1000),
        created_at: new Date(),
      })
      .execute();

    const newPassword = 'weakpassword';
    await server
      .post('/user/forgot-password/reset')
      .send({ key: resetTokenKey, password: newPassword })
      .expect(400);

    const unchangedVolunteer = await transaction
      .selectFrom('volunteer_account')
      .select(['password'])
      .where('id', '=', volunteer.id)
      .executeTakeFirstOrThrow();

    expect(await compare('OldPassword123!', unchangedVolunteer.password)).toBe(true);

    const tokens = await transaction
      .selectFrom('password_reset_token')
      .selectAll()
      .execute();

    expect(tokens).toHaveLength(1);
  });

  test('invalidates previous token after password reset', async () => {
    const { volunteer, plainPassword } = await createVolunteerAccount(transaction, {
      email: 'invalidates-token@example.com',
      password: 'OldPassword123!',
    });

    const loginResult = await server
      .post('/user/login')
      .send({ email: volunteer.email, password: plainPassword })
      .expect(200);

    const oldToken = loginResult.body.token;

    await server
      .get('/volunteer/me')
      .set('Authorization', `Bearer ${oldToken}`)
      .expect(200);

    const resetTokenKey = 'reset-token-' + Date.now();
    await transaction
      .insertInto('password_reset_token')
      .values({
        user_id: volunteer.id,
        role: 'volunteer',
        token: resetTokenKey,
        expires_at: new Date(Date.now() + 60 * 60 * 1000),
        created_at: new Date(),
      })
      .execute();

    await server
      .post('/user/forgot-password/reset')
      .send({ key: resetTokenKey, password: 'NewPassword123!' })
      .expect(200);

    await server
      .get('/volunteer/me')
      .set('Authorization', `Bearer ${oldToken}`)
      .expect(403);

    const loggedIn = await server
      .post('/user/login')
      .send({ email: volunteer.email, password: 'NewPassword123!' })
      .expect(200);

    const newToken = loggedIn.body.token;
    expect(newToken).toBeTruthy();

    await server
      .get('/volunteer/me')
      .set('Authorization', `Bearer ${newToken}`)
      .expect(200);
  });
});
