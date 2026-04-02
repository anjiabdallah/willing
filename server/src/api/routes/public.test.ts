import fs from 'fs';
import path from 'path';

import supertest from 'supertest';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import createApp from '../../app.ts';
import database from '../../db/index.ts';
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
