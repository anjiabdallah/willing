import fs from 'fs';
import path from 'path';

import { Router, type Request, type Response } from 'express';
import { sql, type Kysely } from 'kysely';
import zod from 'zod';

import createOrganizationCertificateInfoRouter from './certificateInfo.ts';
import {
  type OrganizationGetLogoFileResponse,
  type OrganizationGetSignatureFileResponse,
  type OrganizationDeleteLogoResponse,
  type OrganizationCrisisResponse,
  type OrganizationCrisesResponse,
  type OrganizationGetMeResponse,
  type OrganizationPinnedCrisesResponse,
  type OrganizationProfileResponse,
  type OrganizationReportVolunteerResponse,
  type OrganizationRequestResponse,
  type OrganizationUpdateProfileResponse,
  type OrganizationVolunteerCvDownloadResponse,
  type OrganizationVolunteerProfileResponse,
  type OrganizationUploadLogoResponse,
} from './index.types.ts';
import createOrganizationPostingRouter from './posting.ts';
import authorizeOnly from '../../../auth/authorizeOnly.ts';
import createResetPassword from '../../../auth/resetPassword.ts';
import {
  newOrganizationRequestSchema,
  newVolunteerReportSchema,
  organizationAccountSchema,
  type PostingSkill,
  type Database,
} from '../../../db/tables/index.ts';
import { recomputeOrganizationVector } from '../../../services/embeddings/updates.ts';
import { sendAdminOrganizationRequestEmail } from '../../../services/smtp/emails.ts';
import { orgLogoMulter } from '../../../services/uploads/orgLogo.ts';
import { CV_UPLOAD_DIR, ORG_LOGO_UPLOAD_DIR, ORG_SIGNATURE_UPLOAD_DIR } from '../../../services/uploads/paths.ts';
import uploadSingle from '../../../services/uploads/uploadSingle.ts';
import { getVolunteerProfile } from '../../../services/volunteer/index.ts';

const organizationProfileResponseColumns = [
  'id',
  'name',
  'email',
  'phone_number',
  'url',
  'description',
  'latitude',
  'longitude',
  'location_name',
  'logo_path',
  'created_at',
  'updated_at',
] as const;

const organizationPrivateResponseColumns = [
  'id',
  'name',
  'email',
  'phone_number',
  'url',
  'description',
  'latitude',
  'longitude',
  'location_name',
  'logo_path',
] as const;

const organizationPostingResponseColumns = [
  'organization_posting.id',
  'organization_posting.organization_id',
  'organization_posting.title',
  'organization_posting.description',
  'organization_posting.latitude',
  'organization_posting.longitude',
  'organization_posting.max_volunteers',
  'organization_posting.start_date',
  'organization_posting.start_time',
  'organization_posting.end_date',
  'organization_posting.end_time',
  'organization_posting.minimum_age',
  'organization_posting.automatic_acceptance',
  'organization_posting.is_closed',
  'organization_posting.allows_partial_attendance',
  'organization_posting.location_name',
  'organization_posting.created_at',
  'organization_posting.updated_at',
] as const;

const organizationProfileUpdateSchema = organizationAccountSchema
  .omit({
    id: true,
    password: true,
    email: true,
    name: true,
    url: true,
    org_vector: true,
    created_at: true,
    updated_at: true,
  })
  .partial();

const isSameNullableNumber = (
  left: number | undefined,
  right: number | undefined,
) => (left ?? null) === (right ?? null);

function createOrganizationRouter(db: Kysely<Database>) {
  const hasVolunteerRelationshipWithOrganization = async (
    organizationId: number,
    volunteerId: number,
  ) => {
    const relatedApplication = await db
      .selectFrom('enrollment_application')
      .innerJoin(
        'organization_posting',
        'organization_posting.id',
        'enrollment_application.posting_id',
      )
      .select('enrollment_application.id')
      .where('enrollment_application.volunteer_id', '=', volunteerId)
      .where('organization_posting.organization_id', '=', organizationId)
      .executeTakeFirst();

    if (relatedApplication) return true;

    const relatedEnrollment = await db
      .selectFrom('enrollment')
      .innerJoin('organization_posting', 'organization_posting.id', 'enrollment.posting_id')
      .select('enrollment.id')
      .where('enrollment.volunteer_id', '=', volunteerId)
      .where('organization_posting.organization_id', '=', organizationId)
      .executeTakeFirst();

    return Boolean(relatedEnrollment);
  };

  const organizationRouter = Router();

  organizationRouter.post('/request', async (req, res: Response<OrganizationRequestResponse>) => {
    const body = newOrganizationRequestSchema.parse(req.body);

    const email = body.email;

    const checkAccountRequest = await db
      .selectFrom('organization_account')
      .select('id')
      .where('email', '=', email)
      .executeTakeFirst();

    if (checkAccountRequest) {
      res.status(400);
      throw new Error('An organization with this email account already exists');
    }

    const checkPendingRequest = await db
      .selectFrom('organization_request')
      .select('id')
      .where('email', '=', email)
      .executeTakeFirst();

    if (checkPendingRequest) {
      res.status(400);
      throw new Error('A request with this email is already pending');
    }

    const organization = await db
      .insertInto('organization_request')
      .values(body)
      .returningAll()
      .executeTakeFirst();

    if (!organization) {
      throw new Error('Failed to create organization request');
    }

    const adminEmails = (await db.selectFrom('admin_account').select('email').execute()).map(
      row => row.email,
    );

    await sendAdminOrganizationRequestEmail(organization, adminEmails);
    res.json({});
  });

  organizationRouter.get('/:id/logo', async (req, res: Response<OrganizationGetLogoFileResponse>, next) => {
    const { id } = zod
      .object({
        id: zod.coerce.number().int().positive('ID must be a positive number'),
      })
      .parse(req.params);

    const organization = await db
      .selectFrom('organization_account')
      .select(['logo_path'])
      .where('id', '=', id)
      .executeTakeFirst();

    if (!organization?.logo_path) {
      res.status(404);
      throw new Error('Organization logo not found');
    }

    const ext = path.extname(organization.logo_path).toLowerCase();
    if (ext === '.png') {
      res.setHeader('Content-Type', 'image/png');
    } else {
      res.setHeader('Content-Type', 'image/jpeg');
    }
    res.setHeader('Content-Disposition', 'inline; filename="organization-logo"');

    res.sendFile(organization.logo_path, { root: ORG_LOGO_UPLOAD_DIR }, (error) => {
      if (!error) return;
      next(error);
    });
  });

  organizationRouter.get(
    '/:id/signature',
    async (req, res: Response<OrganizationGetSignatureFileResponse>, next) => {
      const { id } = zod
        .object({
          id: zod.coerce.number().int().positive('ID must be a positive number'),
        })
        .parse(req.params);

      const organization = await db
        .selectFrom('organization_account')
        .leftJoin(
          'organization_certificate_info',
          'organization_certificate_info.id',
          'organization_account.certificate_info_id',
        )
        .select(['organization_certificate_info.signature_path'])
        .where('organization_account.id', '=', id)
        .executeTakeFirst();

      if (!organization?.signature_path) {
        res.status(404);
        throw new Error('Organization signature not found');
      }

      const ext = path.extname(organization.signature_path).toLowerCase();
      if (ext === '.png') {
        res.setHeader('Content-Type', 'image/png');
      } else if (ext === '.svg') {
        res.setHeader('Content-Type', 'image/svg+xml');
      } else {
        res.setHeader('Content-Type', 'image/jpeg');
      }
      res.setHeader('Content-Disposition', 'inline; filename="organization-signature"');

      res.sendFile(organization.signature_path, { root: ORG_SIGNATURE_UPLOAD_DIR }, (error) => {
        if (!error) return;
        next(error);
      });
    },
  );

  organizationRouter.get('/:id', authorizeOnly('volunteer', 'organization'), async (req, res: Response<OrganizationProfileResponse>, next) => {
    let orgId;
    try {
      orgId = zod
        .object({
          id: zod.coerce.number(),
        })
        .parse(req.params).id;
    } catch (_error: unknown) {
      next();
      return;
    }

    const organization = await db
      .selectFrom('organization_account')
      .select(organizationProfileResponseColumns)
      .where('id', '=', orgId)
      .executeTakeFirst();

    if (!organization) {
      res.status(404);
      throw new Error('Organization not found');
    }

    const postings = await db
      .selectFrom('organization_posting')
      .select(organizationPostingResponseColumns)
      .where('organization_id', '=', orgId)
      .orderBy('organization_posting.start_date', 'asc')
      .orderBy('organization_posting.start_time', 'asc')
      .execute();

    const postingIds = postings.map(p => p.id);
    const skills = postingIds.length > 0
      ? await db
          .selectFrom('posting_skill')
          .selectAll()
          .where('posting_id', 'in', postingIds)
          .execute()
      : [];

    const skillsByPostingId = new Map<number, PostingSkill[]>();
    skills.forEach((skill) => {
      if (!skillsByPostingId.has(skill.posting_id)) {
        skillsByPostingId.set(skill.posting_id, []);
      }
      skillsByPostingId.get(skill.posting_id)!.push(skill);
    });

    const postingsWithSkills = postings.map(posting => ({
      ...posting,
      skills: skillsByPostingId.get(posting.id) || [],
    }));

    res.json({ organization, postings: postingsWithSkills });
  });

  organizationRouter.use(authorizeOnly('organization'));

  organizationRouter.get('/crises/pinned', async (_req, res: Response<OrganizationPinnedCrisesResponse>) => {
    const crises = await db
      .selectFrom('crisis')
      .selectAll()
      .where('pinned', '=', true)
      .orderBy('created_at', 'desc')
      .execute();

    res.json({ crises });
  });

  organizationRouter.get('/crises', async (_req, res: Response<OrganizationCrisesResponse>) => {
    const crises = await db
      .selectFrom('crisis')
      .selectAll()
      .orderBy('pinned', 'desc')
      .orderBy('created_at', 'desc')
      .execute();

    res.json({ crises });
  });

  organizationRouter.get('/crises/:id', async (req, res: Response<OrganizationCrisisResponse>) => {
    const { id } = zod
      .object({
        id: zod.coerce.number().int().positive('ID must be a positive number'),
      })
      .parse(req.params);

    const crisis = await db.selectFrom('crisis').selectAll().where('id', '=', id).executeTakeFirst();

    if (!crisis) {
      res.status(404);
      throw new Error('Crisis not found');
    }

    res.json({ crisis });
  });

  organizationRouter.get('/me', async (req, res: Response<OrganizationGetMeResponse>) => {
    const organization = await db
      .selectFrom('organization_account')
      .select(organizationPrivateResponseColumns)
      .where('id', '=', req.userJWT!.id)
      .executeTakeFirstOrThrow();

    res.json({ organization });
  });

  organizationRouter.get('/volunteer/:id', async (req, res: Response<OrganizationVolunteerProfileResponse>) => {
    const { id: volunteerId } = zod
      .object({
        id: zod.coerce.number().int().positive('Volunteer ID must be a positive number'),
      })
      .parse(req.params);

    const organizationId = req.userJWT!.id;

    const hasRelationship = await hasVolunteerRelationshipWithOrganization(organizationId, volunteerId);
    if (!hasRelationship) {
      res.status(403);
      throw new Error('You can only view profiles of volunteers related to your postings.');
    }

    const profile = await getVolunteerProfile(volunteerId);
    res.json({ profile });
  });

  organizationRouter.post('/volunteer/:id/report', async (req, res: Response<OrganizationReportVolunteerResponse>) => {
    const { id: volunteerId } = zod
      .object({
        id: zod.coerce.number().int().positive('Volunteer ID must be a positive number'),
      })
      .parse(req.params);

    const body = newVolunteerReportSchema.parse(req.body);
    const organizationId = req.userJWT!.id;

    await db
      .insertInto('volunteer_report')
      .values({
        reported_volunteer_id: volunteerId,
        reporter_organization_id: organizationId,
        title: body.title,
        message: body.message,
      })
      .execute();

    res.json({});
  });

  organizationRouter.get(
    '/volunteer/:id/cv',
    async (req, res: Response<OrganizationVolunteerCvDownloadResponse>, next) => {
      const { id: volunteerId } = zod
        .object({
          id: zod.coerce.number().int().positive('Volunteer ID must be a positive number'),
        })
        .parse(req.params);

      const organizationId = req.userJWT!.id;
      const hasRelationship = await hasVolunteerRelationshipWithOrganization(organizationId, volunteerId);
      if (!hasRelationship) {
        res.status(403);
        throw new Error('You can only access CVs of volunteers related to your postings.');
      }

      const volunteer = await db
        .selectFrom('volunteer_account')
        .select(['id', 'cv_path', 'first_name', 'last_name'])
        .where('id', '=', volunteerId)
        .executeTakeFirstOrThrow();

      if (!volunteer.cv_path) {
        res.status(404);
        throw new Error('Volunteer CV not found');
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${volunteer.first_name}-${volunteer.last_name}-cv.pdf"`,
      );

      res.sendFile(volunteer.cv_path, { root: CV_UPLOAD_DIR }, (error) => {
        if (!error) return;
        next(error);
      });
    },
  );

  organizationRouter.put('/profile', async (req, res: Response<OrganizationUpdateProfileResponse>) => {
    const body = organizationProfileUpdateSchema.parse(req.body);
    const organizationId = req.userJWT!.id;
    const existingOrganization = await db
      .selectFrom('organization_account')
      .select(['description', 'location_name', 'latitude', 'longitude'])
      .where('id', '=', organizationId)
      .executeTakeFirstOrThrow();

    const shouldUpdateDescription = body.description !== undefined && body.description !== existingOrganization.description;
    const shouldUpdateLocationName = body.location_name !== undefined && body.location_name !== existingOrganization.location_name;
    const shouldUpdateLatitude = body.latitude !== undefined && !isSameNullableNumber(body.latitude, existingOrganization.latitude);
    const shouldUpdateLongitude = body.longitude !== undefined && !isSameNullableNumber(body.longitude, existingOrganization.longitude);
    const shouldRecomputeOrganizationVector = shouldUpdateDescription || shouldUpdateLocationName || shouldUpdateLatitude || shouldUpdateLongitude;

    if (Object.keys(body).length > 0) {
      await db
        .updateTable('organization_account')
        .set(body)
        .where('id', '=', organizationId)
        .execute();
    }

    if (shouldRecomputeOrganizationVector) {
      await recomputeOrganizationVector(organizationId, db);
    }

    const organization = await db
      .selectFrom('organization_account')
      .select(organizationPrivateResponseColumns)
      .where('id', '=', organizationId)
      .executeTakeFirstOrThrow();

    res.json({ organization });
  });

  organizationRouter.post(
    '/logo',
    uploadSingle(orgLogoMulter, 'logo'),
    async (req: Request, res: Response<OrganizationUploadLogoResponse>) => {
      if (!req.file) {
        res.status(400);
        throw new Error('No logo file provided');
      }

      const organizationId = req.userJWT!.id;
      const existingOrganization = await db
        .selectFrom('organization_account')
        .select(['logo_path'])
        .where('id', '=', organizationId)
        .executeTakeFirstOrThrow();

      if (existingOrganization.logo_path) {
        try {
          await fs.promises.unlink(path.join(ORG_LOGO_UPLOAD_DIR, existingOrganization.logo_path));
        } catch {
          // ignore missing old logo file
        }
      }

      await db
        .updateTable('organization_account')
        .set({ logo_path: req.file.filename })
        .where('id', '=', organizationId)
        .execute();

      const organization = await db
        .selectFrom('organization_account')
        .select(organizationPrivateResponseColumns)
        .where('id', '=', organizationId)
        .executeTakeFirstOrThrow();

      res.json({ organization });
    },
  );

  organizationRouter.delete('/logo', async (req: Request, res: Response<OrganizationDeleteLogoResponse>) => {
    const organizationId = req.userJWT!.id;
    const existingOrganization = await db
      .selectFrom('organization_account')
      .select(['logo_path', 'certificate_info_id'])
      .where('id', '=', organizationId)
      .executeTakeFirstOrThrow();

    if (existingOrganization.certificate_info_id) {
      const certificateInfo = await db
        .selectFrom('organization_certificate_info')
        .select(['certificate_feature_enabled'])
        .where('id', '=', existingOrganization.certificate_info_id)
        .executeTakeFirst();

      if (certificateInfo?.certificate_feature_enabled) {
        res.status(400);
        throw new Error('Disable certificates before removing organization profile picture.');
      }
    }

    if (existingOrganization.logo_path) {
      try {
        await fs.promises.unlink(path.join(ORG_LOGO_UPLOAD_DIR, existingOrganization.logo_path));
      } catch {
        // ignore missing old logo file
      }
    }

    await db
      .updateTable('organization_account')
      .set({ logo_path: sql`NULL` })
      .where('id', '=', organizationId)
      .execute();

    const organization = await db
      .selectFrom('organization_account')
      .select(organizationPrivateResponseColumns)
      .where('id', '=', organizationId)
      .executeTakeFirstOrThrow();

    res.json({ organization });
  });

  organizationRouter.post('/reset-password', createResetPassword(db));

  organizationRouter.use('/posting', createOrganizationPostingRouter(db));
  organizationRouter.use('/certificate-info', createOrganizationCertificateInfoRouter(db));

  return organizationRouter;
}

export default createOrganizationRouter;
