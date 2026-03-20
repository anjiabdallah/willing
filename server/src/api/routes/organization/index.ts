import fs from 'fs';
import path from 'path';

import { Router, Response } from 'express';
import { sql } from 'kysely';
import zod from 'zod';

import certificateInfoRouter from './certificateInfo.js';
import {
  OrganizationGetLogoFileResponse,
  OrganizationDeleteLogoResponse,
  OrganizationCrisisResponse,
  OrganizationCrisesResponse,
  OrganizationGetMeResponse,
  OrganizationPinnedCrisesResponse,
  OrganizationProfileResponse,
  OrganizationRequestResponse,
  OrganizationResetPasswordResponse,
  OrganizationUpdateProfileResponse,
  OrganizationUploadLogoResponse,
} from './index.types.js';
import postingRouter from './posting.js';
import resetPassword from '../../../auth/resetPassword.js';
import database from '../../../db/index.js';
import { newOrganizationRequestSchema, organizationAccountSchema, PostingSkill } from '../../../db/tables.js';
import { recomputeOrganizationVector } from '../../../services/embeddings/updates.js';
import { sendAdminOrganizationRequestEmail } from '../../../services/smtp/emails.js';
import { orgLogoMulter } from '../../../services/uploads/orgLogo.js';
import { ORG_LOGO_UPLOAD_DIR } from '../../../services/uploads/paths.js';
import uploadSingle from '../../../services/uploads/uploadSingle.js';
import { authorizeOnly } from '../../authorization.js';

const organizationRouter = Router();
const organizationProfileResponseColumns = [
  'id',
  'name',
  'email',
  'phone_number',
  'url',
  'latitude',
  'longitude',
  'location_name',
  'created_at',
  'updated_at',
] as const;

const organizationPrivateResponseColumns = [
  'id',
  'name',
  'email',
  'phone_number',
  'url',
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
  sql<Date>`(organization_posting.start_date + organization_posting.start_time)`.as('start_timestamp'),
  sql<Date | undefined>`CASE WHEN organization_posting.end_date IS NULL OR organization_posting.end_time IS NULL THEN NULL ELSE (organization_posting.end_date + organization_posting.end_time) END`.as('end_timestamp'),
  'organization_posting.start_date',
  'organization_posting.start_time',
  'organization_posting.end_date',
  'organization_posting.end_time',
  'organization_posting.minimum_age',
  'organization_posting.automatic_acceptance',
  'organization_posting.is_closed',
  'organization_posting.location_name',
  'organization_posting.created_at',
  'organization_posting.updated_at',
] as const;

const organizationProfileUpdateSchema = organizationAccountSchema.omit({
  id: true,
  password: true,
  email: true,
  org_vector: true,
  created_at: true,
  updated_at: true,
}).partial();

const isSameNullableNumber = (left: number | undefined, right: number | undefined) => (left ?? null) === (right ?? null);

organizationRouter.post('/request', async (req, res: Response<OrganizationRequestResponse>) => {
  const body = newOrganizationRequestSchema.parse(req.body);

  const email = body.email;

  const checkAccountRequest = await database
    .selectFrom('organization_account')
    .select('id')
    .where('email', '=', email)
    .executeTakeFirst();

  if (checkAccountRequest) {
    res.status(400);
    throw new Error('An organization with this email account already exists');
  }

  const checkPendingRequest = await database
    .selectFrom('organization_request')
    .select('id')
    .where('email', '=', email)
    .executeTakeFirst();

  if (checkPendingRequest) {
    res.status(400);
    throw new Error('A request with this email is already pending');
  }

  const organization = await database
    .insertInto('organization_request')
    .values(body)
    .returningAll().executeTakeFirst();

  if (!organization) {
    throw new Error('Failed to create organization request');
  } else {
    await sendAdminOrganizationRequestEmail(organization);
    res.json({});
  }
});

organizationRouter.get('/:id/logo', async (req, res: Response<OrganizationGetLogoFileResponse>, next) => {
  const { id } = zod.object({
    id: zod.coerce.number().int().positive('ID must be a positive number'),
  }).parse(req.params);

  const organization = await database
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

organizationRouter.get('/:id', async (req, res: Response<OrganizationProfileResponse>, next) => {
  let orgId;
  try {
    orgId = zod.object({
      id: zod.coerce.number(),
    }).parse(req.params).id;
  } catch (_error: unknown) {
    next();
    return;
  }

  const organization = await database
    .selectFrom('organization_account')
    .select(organizationProfileResponseColumns)
    .where('id', '=', orgId)
    .executeTakeFirst();

  if (!organization) {
    res.status(404);
    throw new Error('Organization not found');
  }

  // Fetch organization's postings
  const postings = await database
    .selectFrom('organization_posting')
    .select(organizationPostingResponseColumns)
    .where('organization_id', '=', orgId)
    .orderBy('organization_posting.start_date', 'asc')
    .orderBy('organization_posting.start_time', 'asc')
    .execute();

  // Fetch skills for all postings
  const postingIds = postings.map(p => p.id);
  const skills = postingIds.length > 0
    ? await database
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

// Protected organization routes
organizationRouter.use(authorizeOnly('organization'));

organizationRouter.get('/crises/pinned', async (_req, res: Response<OrganizationPinnedCrisesResponse>) => {
  const crises = await database
    .selectFrom('crisis')
    .selectAll()
    .where('pinned', '=', true)
    .orderBy('created_at', 'desc')
    .execute();

  res.json({ crises });
});

organizationRouter.get('/crises', async (_req, res: Response<OrganizationCrisesResponse>) => {
  const crises = await database
    .selectFrom('crisis')
    .selectAll()
    .orderBy('pinned', 'desc')
    .orderBy('created_at', 'desc')
    .execute();

  res.json({ crises });
});

organizationRouter.get('/crises/:id', async (req, res: Response<OrganizationCrisisResponse>) => {
  const { id } = zod.object({
    id: zod.coerce.number().int().positive('ID must be a positive number'),
  }).parse(req.params);

  const crisis = await database
    .selectFrom('crisis')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst();

  if (!crisis) {
    res.status(404);
    throw new Error('Crisis not found');
  }

  res.json({ crisis });
});

organizationRouter.get('/me', async (req, res: Response<OrganizationGetMeResponse>) => {
  const organization = await database
    .selectFrom('organization_account')
    .select(organizationPrivateResponseColumns)
    .where('id', '=', req.userJWT!.id)
    .executeTakeFirstOrThrow();

  res.json({ organization });
});

organizationRouter.put('/profile', async (req, res: Response<OrganizationUpdateProfileResponse>) => {
  const body = organizationProfileUpdateSchema.parse(req.body);
  const organizationId = req.userJWT!.id;
  const existingOrganization = await database
    .selectFrom('organization_account')
    .select([
      'name',
      'url',
      'location_name',
      'latitude',
      'longitude',
    ])
    .where('id', '=', organizationId)
    .executeTakeFirstOrThrow();

  const shouldRecomputeOrganizationVector = (
    (body.name !== undefined && body.name !== existingOrganization.name)
    || (body.url !== undefined && body.url !== existingOrganization.url)
    || (body.location_name !== undefined && body.location_name !== existingOrganization.location_name)
    || (body.latitude !== undefined && !isSameNullableNumber(body.latitude, existingOrganization.latitude))
    || (body.longitude !== undefined && !isSameNullableNumber(body.longitude, existingOrganization.longitude))
  );

  if (Object.keys(body).length > 0) {
    await database
      .updateTable('organization_account')
      .set(body)
      .where('id', '=', organizationId)
      .execute();
  }

  if (shouldRecomputeOrganizationVector) {
    await recomputeOrganizationVector(organizationId);
  }

  const organization = await database
    .selectFrom('organization_account')
    .select(organizationPrivateResponseColumns)
    .where('id', '=', organizationId)
    .executeTakeFirstOrThrow();

  res.json({ organization });
});

organizationRouter.post('/logo', uploadSingle(orgLogoMulter, 'logo'), async (req, res: Response<OrganizationUploadLogoResponse>) => {
  if (!req.file) {
    res.status(400);
    throw new Error('No logo file provided');
  }

  const organizationId = req.userJWT!.id;
  const existingOrganization = await database
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

  await database
    .updateTable('organization_account')
    .set({ logo_path: req.file.filename })
    .where('id', '=', organizationId)
    .execute();

  const organization = await database
    .selectFrom('organization_account')
    .select(organizationPrivateResponseColumns)
    .where('id', '=', organizationId)
    .executeTakeFirstOrThrow();

  res.json({ organization });
});

organizationRouter.delete('/logo', async (req, res: Response<OrganizationDeleteLogoResponse>) => {
  const organizationId = req.userJWT!.id;
  const existingOrganization = await database
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

  await database
    .updateTable('organization_account')
    .set({ logo_path: sql`NULL` })
    .where('id', '=', organizationId)
    .execute();

  const organization = await database
    .selectFrom('organization_account')
    .select(organizationPrivateResponseColumns)
    .where('id', '=', organizationId)
    .executeTakeFirstOrThrow();

  res.json({ organization });
});

organizationRouter.post('/reset-password', async (req, res: Response<OrganizationResetPasswordResponse>) => {
  await resetPassword(req, res);
});

organizationRouter.use('/posting', postingRouter);
organizationRouter.use('/certificate-info', certificateInfoRouter);

export default organizationRouter;
