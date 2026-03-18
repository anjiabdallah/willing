import fs from 'fs';
import path from 'path';

import { Router, Response } from 'express';

import {
  GetCertificateInfoResponse,
  UpdateCertificateInfoResponse,
  UploadCertificateSignatureResponse,
  DeleteCertificateSignatureResponse,
} from './certificateInfo.types.js';
import database from '../../../db/index.js';
import {
  newOrganizationCertificateInfoSchema,
} from '../../../db/tables.js';
import { orgSignatureMulter } from '../../../services/uploads/orgSignature.js';
import { ORG_SIGNATURE_UPLOAD_DIR } from '../../../services/uploads/paths.js';
import uploadSingle from '../../../services/uploads/uploadSingle.js';

const certificateInfoRouter = Router();

// GET /organization/certificate-info
certificateInfoRouter.get('/', async (req, res: Response<GetCertificateInfoResponse>) => {
  const organizationId = req.userJWT!.id;

  const organization = await database
    .selectFrom('organization_account')
    .select(['certificate_info_id'])
    .where('id', '=', organizationId)
    .executeTakeFirstOrThrow();

  let certificateInfo = null;

  if (organization.certificate_info_id) {
    certificateInfo = await database
      .selectFrom('organization_certificate_info')
      .selectAll()
      .where('id', '=', organization.certificate_info_id)
      .executeTakeFirst();
  }

  res.json({ certificateInfo: certificateInfo || null });
});

// PUT /organization/certificate-info (update info without signature)
certificateInfoRouter.put('/', async (req, res: Response<UpdateCertificateInfoResponse>) => {
  const organizationId = req.userJWT!.id;
  const body = newOrganizationCertificateInfoSchema
    .omit({ signature_path: true })
    .partial()
    .parse(req.body);

  const organization = await database
    .selectFrom('organization_account')
    .select(['certificate_info_id'])
    .where('id', '=', organizationId)
    .executeTakeFirstOrThrow();

  let certificateInfo;

  if (organization.certificate_info_id) {
    // Update existing certificate info
    certificateInfo = await database
      .updateTable('organization_certificate_info')
      .set(body)
      .where('id', '=', organization.certificate_info_id)
      .returningAll()
      .executeTakeFirstOrThrow();
  } else {
    // Create new certificate info
    certificateInfo = await database
      .insertInto('organization_certificate_info')
      .values(body)
      .returningAll()
      .executeTakeFirstOrThrow();

    // Link it to the organization
    await database
      .updateTable('organization_account')
      .set({ certificate_info_id: certificateInfo.id })
      .where('id', '=', organizationId)
      .execute();
  }

  res.json({ certificateInfo });
});

// POST /organization/certificate-info/upload-signature (upload signature file)
certificateInfoRouter.post(
  '/upload-signature',
  uploadSingle(orgSignatureMulter, 'signature'),
  async (req, res: Response<UploadCertificateSignatureResponse>) => {
    if (!req.file) {
      res.status(400);
      throw new Error('No signature file provided');
    }

    const organizationId = req.userJWT!.id;
    const signaturePath = req.file.filename;

    const organization = await database
      .selectFrom('organization_account')
      .select(['certificate_info_id'])
      .where('id', '=', organizationId)
      .executeTakeFirstOrThrow();

    let certificateInfo;

    if (organization.certificate_info_id) {
      // Get existing certificate info to delete old signature if exists
      const existing = await database
        .selectFrom('organization_certificate_info')
        .select(['signature_path'])
        .where('id', '=', organization.certificate_info_id)
        .executeTakeFirstOrThrow();

      if (existing.signature_path) {
        const oldPath = path.join(ORG_SIGNATURE_UPLOAD_DIR, existing.signature_path);
        try {
          await fs.promises.unlink(oldPath);
        } catch (error) {
          console.error(`Failed to delete old signature: ${oldPath}`, error);
        }
      }

      // Update certificate info with new signature
      certificateInfo = await database
        .updateTable('organization_certificate_info')
        .set({ signature_path: signaturePath })
        .where('id', '=', organization.certificate_info_id)
        .returningAll()
        .executeTakeFirstOrThrow();
    } else {
      // Create new certificate info with signature
      certificateInfo = await database
        .insertInto('organization_certificate_info')
        .values({ signature_path: signaturePath })
        .returningAll()
        .executeTakeFirstOrThrow();

      // Link it to the organization
      await database
        .updateTable('organization_account')
        .set({ certificate_info_id: certificateInfo.id })
        .where('id', '=', organizationId)
        .execute();
    }

    res.json({ certificateInfo });
  },
);

// DELETE /organization/certificate-info/signature (delete signature file)
certificateInfoRouter.delete(
  '/signature',
  async (req, res: Response<DeleteCertificateSignatureResponse>) => {
    const organizationId = req.userJWT!.id;

    const organization = await database
      .selectFrom('organization_account')
      .select(['certificate_info_id'])
      .where('id', '=', organizationId)
      .executeTakeFirstOrThrow();

    if (!organization.certificate_info_id) {
      res.status(404);
      throw new Error('Certificate info not found');
    }

    const certificateInfo = await database
      .selectFrom('organization_certificate_info')
      .select(['signature_path'])
      .where('id', '=', organization.certificate_info_id)
      .executeTakeFirstOrThrow();

    if (certificateInfo.signature_path) {
      const oldPath = path.join(ORG_SIGNATURE_UPLOAD_DIR, certificateInfo.signature_path);
      try {
        await fs.promises.unlink(oldPath);
      } catch (error) {
        console.error(`Failed to delete signature: ${oldPath}`, error);
      }

      // Clear signature path in database
      await database
        .updateTable('organization_certificate_info')
        .set({ signature_path: null })
        .where('id', '=', organization.certificate_info_id)
        .execute();
    }

    res.json({});
  },
);

export default certificateInfoRouter;
