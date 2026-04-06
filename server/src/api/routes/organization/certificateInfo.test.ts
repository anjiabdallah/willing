import fs from 'fs';
import path from 'path';

import sharp from 'sharp';
import supertest from 'supertest';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import createApp from '../../../app.ts';
import database from '../../../db/index.ts';
import { getAbsoluteSignaturePath } from '../../../services/uploads/orgSignature.ts';
import { ORG_SIGNATURE_UPLOAD_DIR } from '../../../services/uploads/paths.ts';
import { createOrganizationAccount } from '../../../tests/fixtures/accounts.ts';

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

describe('Organization certificate info routes', () => {
  test('GET /organization/certificate-info returns null when no certificate info exists', async () => {
    const { token } = await createOrganizationAccount(transaction, { email: 'org-cert-info-null@example.com' });

    const response = await server
      .get('/organization/certificate-info')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toEqual({ certificateInfo: null });
  });

  test('PUT /organization/certificate-info creates new certificate info and links the organization', async () => {
    const { organization, token } = await createOrganizationAccount(transaction, { email: 'org-cert-info-create@example.com' });

    const response = await server
      .put('/organization/certificate-info')
      .set('Authorization', `Bearer ${token}`)
      .send({
        hours_threshold: 10,
        signatory_name: 'Certificate Signatory',
        signatory_position: 'Director',
      })
      .expect(200);

    expect(response.body.certificateInfo).toMatchObject({
      hours_threshold: 10,
      signatory_name: 'Certificate Signatory',
      signatory_position: 'Director',
      signature_path: null,
      certificate_feature_enabled: false,
    });

    const linkedOrganization = await transaction
      .selectFrom('organization_account')
      .select(['certificate_info_id'])
      .where('id', '=', organization.id)
      .executeTakeFirstOrThrow();

    expect(linkedOrganization.certificate_info_id).toBe(response.body.certificateInfo.id);
  });

  test('PUT /organization/certificate-info rejects enabling certificates when logo is missing', async () => {
    const { token } = await createOrganizationAccount(transaction, { email: 'org-cert-info-logo-missing@example.com' });

    const response = await server
      .put('/organization/certificate-info')
      .set('Authorization', `Bearer ${token}`)
      .send({
        certificate_feature_enabled: true,
        hours_threshold: 12,
        signatory_name: 'Signer',
        signatory_position: 'Manager',
      })
      .expect(400);

    expect(response.body.message).toBe('Organization profile picture is required to enable certificates.');
  });

  test('POST /organization/certificate-info/upload-signature rejects missing file', async () => {
    const { token } = await createOrganizationAccount(transaction, { email: 'org-cert-info-upload-missing@example.com' });

    const response = await server
      .post('/organization/certificate-info/upload-signature')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    expect(response.body.message).toBe('No signature file provided');
  });

  test('POST /organization/certificate-info/upload-signature stores a normalized signature and creates certificate info', async () => {
    const { organization, token } = await createOrganizationAccount(transaction, { email: 'org-cert-info-upload-create@example.com' });
    const inputPath = path.join(ORG_SIGNATURE_UPLOAD_DIR, 'certificate-signature-input.png');
    let normalizedPath: string | null = null;

    await fs.promises.mkdir(ORG_SIGNATURE_UPLOAD_DIR, { recursive: true });
    await fs.promises.writeFile(
      inputPath,
      await sharp({
        create: {
          width: 16,
          height: 16,
          channels: 4,
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        },
      }).png().toBuffer(),
    );

    try {
      const response = await server
        .post('/organization/certificate-info/upload-signature')
        .set('Authorization', `Bearer ${token}`)
        .attach('signature', inputPath, {
          filename: 'signature.png',
          contentType: 'image/png',
        })
        .expect(200);

      expect(response.body.certificateInfo.signature_path).toBeTruthy();
      expect(response.body.certificateInfo.signature_path.endsWith('.png')).toBe(true);
      normalizedPath = response.body.certificateInfo.signature_path as string;

      const normalizedAbsolutePath = getAbsoluteSignaturePath(normalizedPath);
      const normalizedStat = await fs.promises.stat(normalizedAbsolutePath);
      expect(normalizedStat.isFile()).toBe(true);

      const linkedOrganization = await transaction
        .selectFrom('organization_account')
        .select(['certificate_info_id'])
        .where('id', '=', organization.id)
        .executeTakeFirstOrThrow();

      expect(linkedOrganization.certificate_info_id).toBe(response.body.certificateInfo.id);
    } finally {
      await fs.promises.unlink(inputPath).catch(() => {});
      if (normalizedPath) {
        await fs.promises.unlink(getAbsoluteSignaturePath(normalizedPath)).catch(() => {});
      }
    }
  });

  test('POST /organization/certificate-info/upload-signature replaces an existing signature file', async () => {
    const { organization, token } = await createOrganizationAccount(transaction, { email: 'org-cert-info-upload-replace@example.com' });
    const inputPath = path.join(ORG_SIGNATURE_UPLOAD_DIR, 'certificate-signature-old.png');
    const oldSignatureName = 'org-signature-123-old.png';
    const oldSignaturePath = getAbsoluteSignaturePath(oldSignatureName);
    let newSignaturePath: string | null = null;

    await fs.promises.mkdir(ORG_SIGNATURE_UPLOAD_DIR, { recursive: true });
    await fs.promises.writeFile(inputPath, await sharp({ create: { width: 16, height: 16, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } }).png().toBuffer());
    await fs.promises.writeFile(oldSignaturePath, 'old-signature-content');

    const certificateInfo = await transaction
      .insertInto('organization_certificate_info')
      .values({
        signature_path: oldSignatureName,
        certificate_feature_enabled: false,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    await transaction
      .updateTable('organization_account')
      .set({ certificate_info_id: certificateInfo.id })
      .where('id', '=', organization.id)
      .execute();

    try {
      const response = await server
        .post('/organization/certificate-info/upload-signature')
        .set('Authorization', `Bearer ${token}`)
        .attach('signature', inputPath, {
          filename: 'signature.png',
          contentType: 'image/png',
        })
        .expect(200);

      expect(response.body.certificateInfo.id).toBe(certificateInfo.id);
      expect(response.body.certificateInfo.signature_path).not.toBe(oldSignatureName);
      newSignaturePath = response.body.certificateInfo.signature_path as string;

      await expect(fs.promises.access(oldSignaturePath)).rejects.toThrow();
      await expect(fs.promises.access(getAbsoluteSignaturePath(newSignaturePath))).resolves.toBeUndefined();
    } finally {
      await fs.promises.unlink(inputPath).catch(() => {});
      await fs.promises.unlink(oldSignaturePath).catch(() => {});
      if (newSignaturePath) {
        await fs.promises.unlink(getAbsoluteSignaturePath(newSignaturePath)).catch(() => {});
      }
    }
  });

  test('DELETE /organization/certificate-info/signature returns 404 when no certificate info exists', async () => {
    const { token } = await createOrganizationAccount(transaction, { email: 'org-cert-info-delete-null@example.com' });

    const response = await server
      .delete('/organization/certificate-info/signature')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);

    expect(response.body.message).toBe('Certificate info not found');
  });

  test('DELETE /organization/certificate-info/signature returns 400 when certificates are enabled', async () => {
    const { organization, token } = await createOrganizationAccount(transaction, { email: 'org-cert-info-delete-enabled@example.com' });
    const certificateInfo = await transaction
      .insertInto('organization_certificate_info')
      .values({
        signature_path: 'org-signature-enabled.png',
        certificate_feature_enabled: true,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    await transaction
      .updateTable('organization_account')
      .set({ certificate_info_id: certificateInfo.id })
      .where('id', '=', organization.id)
      .execute();

    const response = await server
      .delete('/organization/certificate-info/signature')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    expect(response.body.message).toBe('Disable certificates before removing signature.');
  });

  test('DELETE /organization/certificate-info/signature clears signature path when certificates are disabled', async () => {
    const { organization, token } = await createOrganizationAccount(transaction, { email: 'org-cert-info-delete-success@example.com' });
    const signaturePath = 'org-signature-delete.png';
    await fs.promises.mkdir(ORG_SIGNATURE_UPLOAD_DIR, { recursive: true });
    await fs.promises.writeFile(getAbsoluteSignaturePath(signaturePath), 'signature-content');

    const certificateInfo = await transaction
      .insertInto('organization_certificate_info')
      .values({
        signature_path: signaturePath,
        certificate_feature_enabled: false,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    await transaction
      .updateTable('organization_account')
      .set({ certificate_info_id: certificateInfo.id })
      .where('id', '=', organization.id)
      .execute();

    const response = await server
      .delete('/organization/certificate-info/signature')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toEqual({});

    const updatedCertificateInfo = await transaction
      .selectFrom('organization_certificate_info')
      .select(['signature_path'])
      .where('id', '=', certificateInfo.id)
      .executeTakeFirstOrThrow();

    expect(updatedCertificateInfo.signature_path).toBeNull();
    await expect(fs.promises.access(getAbsoluteSignaturePath(signaturePath))).rejects.toThrow();
  });
});
