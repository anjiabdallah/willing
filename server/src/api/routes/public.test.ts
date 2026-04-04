import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import supertest from 'supertest';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import createApp from '../../app.ts';
import config from '../../config.ts';
import database from '../../db/index.ts';
import {
  type CertificateVerificationPayload,
  CERTIFICATE_PAYLOAD_VERSION,
  CERTIFICATE_TYPE,
  signCertificateVerificationPayload,
} from '../../services/certificates/token.ts';
import { PLATFORM_SIGNATURE_UPLOAD_DIR } from '../../services/uploads/paths.ts';
import { createOrganizationAccount, createVolunteerAccount } from '../../tests/fixtures/accounts.ts';
import { createOrganizationPosting } from '../../tests/fixtures/organizationData.ts';

import type { Database } from '../../db/tables/index.ts';
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

describe('GET /public/home-stats', () => {
  test('returns 0 for everything if the database is empty', async () => {
    const response = await server
      .get('/public/home-stats')
      .expect(200);

    expect(response.body).toMatchObject({
      totalOpportunities: 0,
      totalOrganizations: 0,
      totalVolunteers: 0,
      newOpportunitiesThisWeek: 0,
      newOrganizationsThisWeek: 0,
      newVolunteersThisWeek: 0,
    });
  });

  test('returns the correct number of total organizations, volunteers, and opportunities', async () => {
    const org1 = await createOrganizationAccount(transaction, { email: 'org1@willing.social', phone_number: '+10000000001', url: 'https://org1.com' });
    const org2 = await createOrganizationAccount(transaction, { email: 'org2@willing.social', phone_number: '+10000000002', url: 'https://org2.com' });
    const org3 = await createOrganizationAccount(transaction, { email: 'org3@willing.social', phone_number: '+10000000003', url: 'https://org3.com' });
    const org4 = await createOrganizationAccount(transaction, { email: 'org4@willing.social', phone_number: '+10000000004', url: 'https://org4.com' });

    await createVolunteerAccount(transaction, { email: 'vol1@willing.social' });
    await createVolunteerAccount(transaction, { email: 'vol2@willing.social' });
    await createVolunteerAccount(transaction, { email: 'vol3@willing.social' });

    await createOrganizationPosting(transaction, { organizationId: org1.organization.id });
    await createOrganizationPosting(transaction, { organizationId: org2.organization.id });
    await createOrganizationPosting(transaction, { organizationId: org1.organization.id });
    await createOrganizationPosting(transaction, { organizationId: org4.organization.id });
    await createOrganizationPosting(transaction, { organizationId: org3.organization.id });
    await createOrganizationPosting(transaction, { organizationId: org2.organization.id });
    await createOrganizationPosting(transaction, { organizationId: org1.organization.id });

    const response = await server
      .get('/public/home-stats')
      .expect(200);

    expect(response.body).toMatchObject({
      totalOpportunities: 7,
      totalOrganizations: 4,
      totalVolunteers: 3,
    });
  });

  test('returns the correct number of new organizations, volunteers, and opportunities', async () => {
    const org1 = await createOrganizationAccount(transaction, { email: 'org1@willing.social', phone_number: '+10000000001', url: 'https://org1.com', created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) });
    const org2 = await createOrganizationAccount(transaction, { email: 'org2@willing.social', phone_number: '+10000000002', url: 'https://org2.com' });
    const org3 = await createOrganizationAccount(transaction, { email: 'org3@willing.social', phone_number: '+10000000003', url: 'https://org3.com', created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) });
    const org4 = await createOrganizationAccount(transaction, { email: 'org4@willing.social', phone_number: '+10000000004', url: 'https://org4.com', created_at: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000) });

    await createVolunteerAccount(transaction, { email: 'vol1@willing.social', created_at: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000) });
    await createVolunteerAccount(transaction, { email: 'vol2@willing.social', created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) });
    await createVolunteerAccount(transaction, { email: 'vol3@willing.social' });

    await createOrganizationPosting(transaction, { organizationId: org1.organization.id, created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) });
    await createOrganizationPosting(transaction, { organizationId: org2.organization.id, created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) });
    await createOrganizationPosting(transaction, { organizationId: org1.organization.id, created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) });
    await createOrganizationPosting(transaction, { organizationId: org4.organization.id, created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) });
    await createOrganizationPosting(transaction, { organizationId: org3.organization.id, created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) });
    await createOrganizationPosting(transaction, { organizationId: org2.organization.id, created_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000) });
    await createOrganizationPosting(transaction, { organizationId: org1.organization.id });

    const response = await server
      .get('/public/home-stats')
      .expect(200);

    expect(response.body).toMatchObject({
      newOrganizationsThisWeek: 2,
      newVolunteersThisWeek: 2,
      newOpportunitiesThisWeek: 4,
    });
  });
});

describe('GET /public/certificate-signature', () => {
  test('returns 404 if the platform certificate is missing', async () => {
    await server
      .get('/public/certificate-signature')
      .expect(404);
  });

  test('returns the platform signature if it exists', async () => {
    const signatureFileName = 'platform-signature-test.png';
    const signatureContents = Buffer.from('sample-platform-signature');
    const signatureAbsolutePath = path.join(PLATFORM_SIGNATURE_UPLOAD_DIR, signatureFileName);

    await fs.promises.mkdir(PLATFORM_SIGNATURE_UPLOAD_DIR, { recursive: true });
    await fs.promises.writeFile(signatureAbsolutePath, signatureContents);

    await transaction
      .insertInto('platform_certificate_settings')
      .values({
        signatory_name: 'Signer',
        signatory_position: 'Director',
        signature_path: signatureFileName,
        signature_uploaded_by_admin_id: null,
      })
      .execute();

    try {
      const response = await server
        .get('/public/certificate-signature')
        .buffer(true)
        .expect(200);

      expect(response.headers['content-type']).toBe('image/png');
      expect(response.headers['content-disposition']).toBe('inline; filename="platform-certificate-signature"');
      expect(Buffer.isBuffer(response.body)).toBe(true);
    } finally {
      await fs.promises.rm(signatureAbsolutePath, { force: true });
    }
  });

  test('falls back to jpeg content type for non-png and non-svg extensions', async () => {
    const signatureFileName = 'platform-signature-test.jpg';
    const signatureContents = Buffer.from('sample-platform-signature-jpg');
    const signatureAbsolutePath = path.join(PLATFORM_SIGNATURE_UPLOAD_DIR, signatureFileName);

    await fs.promises.mkdir(PLATFORM_SIGNATURE_UPLOAD_DIR, { recursive: true });
    await fs.promises.writeFile(signatureAbsolutePath, signatureContents);

    await transaction
      .insertInto('platform_certificate_settings')
      .values({
        signatory_name: 'Signer',
        signatory_position: 'Director',
        signature_path: signatureFileName,
        signature_uploaded_by_admin_id: null,
      })
      .execute();

    try {
      const response = await server
        .get('/public/certificate-signature')
        .buffer(true)
        .expect(200);

      expect(response.headers['content-type']).toBe('image/jpeg');
      expect(Buffer.isBuffer(response.body)).toBe(true);
    } finally {
      await fs.promises.rm(signatureAbsolutePath, { force: true });
    }
  });

  test('returns 500 when signature file path is stored but file does not exist', async () => {
    await transaction
      .insertInto('platform_certificate_settings')
      .values({
        signatory_name: 'Signer',
        signatory_position: 'Director',
        signature_path: 'missing-signature.png',
        signature_uploaded_by_admin_id: null,
      })
      .execute();

    await server
      .get('/public/certificate-signature')
      .expect(500);
  });
});

describe('POST /public/certificate/verify', () => {
  const createValidCertificateVerificationContext = async () => {
    const { volunteer } = await createVolunteerAccount(transaction, { email: 'verify-volunteer@example.com' });
    const { organization: organizationOne } = await createOrganizationAccount(transaction, {
      email: 'verify-org-1@example.com',
      name: 'Rescue One',
      phone_number: '+10000000011',
      url: 'https://rescue-one.example.org',
    });
    const { organization: organizationTwo } = await createOrganizationAccount(transaction, {
      email: 'verify-org-2@example.com',
      name: 'Rescue Two',
      phone_number: '+10000000012',
      url: 'https://rescue-two.example.org',
    });

    const postingOne = await createOrganizationPosting(transaction, {
      organizationId: organizationOne.id,
      title: 'Medical Tent Setup',
      overrides: {
        start_date: new Date('2026-02-01T00:00:00.000Z'),
        start_time: '08:00:00',
        end_date: new Date('2026-02-01T00:00:00.000Z'),
        end_time: '12:00:00',
      },
    });
    const postingTwo = await createOrganizationPosting(transaction, {
      organizationId: organizationTwo.id,
      title: 'Food Box Coordination',
      overrides: {
        start_date: new Date('2026-02-03T00:00:00.000Z'),
        start_time: '13:00:00',
        end_date: new Date('2026-02-03T00:00:00.000Z'),
        end_time: '15:30:00',
      },
    });

    const issuedAtDate = new Date();
    issuedAtDate.setSeconds(issuedAtDate.getSeconds() - 30);
    issuedAtDate.setMilliseconds(0);
    const enrollmentCreatedAt = new Date(issuedAtDate);
    enrollmentCreatedAt.setMinutes(enrollmentCreatedAt.getMinutes() - 2);

    await transaction
      .insertInto('enrollment')
      .values([
        {
          volunteer_id: volunteer.id,
          posting_id: postingOne.id,
          attended: true,
          created_at: enrollmentCreatedAt,
        },
        {
          volunteer_id: volunteer.id,
          posting_id: postingTwo.id,
          attended: true,
          created_at: enrollmentCreatedAt,
        },
      ])
      .execute();

    const payload: CertificateVerificationPayload = {
      v: CERTIFICATE_PAYLOAD_VERSION,
      uid: String(volunteer.id),
      issued_at: issuedAtDate.toISOString(),
      org_ids: [String(organizationOne.id), String(organizationTwo.id)],
      total_hours: 6.5,
      hours_per_org: {
        [String(organizationOne.id)]: 4,
        [String(organizationTwo.id)]: 2.5,
      },
      type: CERTIFICATE_TYPE,
    };

    const token = signCertificateVerificationPayload(payload, config.CERTIFICATE_VERIFICATION_SECRET);

    return {
      token,
      payload,
      volunteer,
      organizationOne,
      organizationTwo,
    };
  };

  test('returns 400 when token format is malformed', async () => {
    const response = await server
      .post('/public/certificate/verify')
      .send({ token: 'not-a-valid-token' })
      .expect(400);

    expect(response.body).toEqual({
      valid: false,
      message: 'Invalid certificate token format.',
    });
  });

  test('returns invalid when signature is incorrect', async () => {
    const { token } = await createValidCertificateVerificationContext();
    const [payloadPart, signaturePart] = token.split('.');
    if (!payloadPart || !signaturePart) {
      throw new Error('Expected signed token to contain payload and signature parts.');
    }

    const tamperedSignature = signaturePart[0] === 'a'
      ? `b${signaturePart.slice(1)}`
      : `a${signaturePart.slice(1)}`;
    const tamperedToken = `${payloadPart}.${tamperedSignature}`;

    const response = await server
      .post('/public/certificate/verify')
      .send({ token: tamperedToken })
      .expect(200);

    expect(response.body).toEqual({
      valid: false,
      message: 'Certificate is invalid.',
    });
  });

  test('returns invalid when payload is not parseable even with a valid signature', async () => {
    const malformedPayload = Buffer.from('not-a-compressed-certificate-payload');
    const signature = crypto
      .createHmac('sha256', config.CERTIFICATE_VERIFICATION_SECRET)
      .update(malformedPayload)
      .digest()
      .subarray(0, 16);
    const token = `${malformedPayload.toString('base64url')}.${signature.toString('base64url')}`;

    const response = await server
      .post('/public/certificate/verify')
      .send({ token })
      .expect(200);

    expect(response.body).toEqual({
      valid: false,
      message: 'Certificate is invalid.',
    });
  });

  test('returns invalid when token payload does not match database facts', async () => {
    const { payload } = await createValidCertificateVerificationContext();
    const mismatchedToken = signCertificateVerificationPayload({
      ...payload,
      total_hours: payload.total_hours + 1,
    }, config.CERTIFICATE_VERIFICATION_SECRET);

    const response = await server
      .post('/public/certificate/verify')
      .send({ token: mismatchedToken })
      .expect(200);

    expect(response.body).toEqual({
      valid: false,
      message: 'Certificate is invalid.',
    });
  });

  test('returns certificate verification details when token and database facts are valid', async () => {
    const { token, payload, volunteer, organizationOne, organizationTwo } = await createValidCertificateVerificationContext();

    const response = await server
      .post('/public/certificate/verify')
      .send({ token })
      .expect(200);

    expect(response.body).toEqual({
      valid: true,
      message: 'Certificate is valid.',
      issued_at: payload.issued_at,
      certificate_type: CERTIFICATE_TYPE,
      volunteer_name: `${volunteer.first_name} ${volunteer.last_name}`,
      total_hours: payload.total_hours,
      organizations: [
        {
          id: organizationOne.id,
          name: organizationOne.name,
          hours: payload.hours_per_org[String(organizationOne.id)],
        },
        {
          id: organizationTwo.id,
          name: organizationTwo.name,
          hours: payload.hours_per_org[String(organizationTwo.id)],
        },
      ],
    });
  });
});
