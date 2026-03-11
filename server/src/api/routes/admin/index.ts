import bcrypt from 'bcrypt';
import { Router, Response } from 'express';
import * as jose from 'jose';
import zod from 'zod';

import {
  AdminCrisisCreateResponse,
  AdminCrisisDeleteResponse,
  AdminCrisisPinResponse,
  AdminCrisisUpdateResponse,
  AdminCrisesResponse,
  AdminLoginResponse,
  AdminMeResponse,
  AdminOrganizationRequestReviewResponse,
  AdminOrganizationRequestsResponse,
} from './index.types.js';
import resetPassword from '../../../auth/resetPassword.js';
import config from '../../../config.js';
import database from '../../../db/index.js';
import { newCrisisSchema } from '../../../db/tables.js';
import { recomputeOrganizationVector } from '../../../services/embeddings/embeddingUpdateService.js';
import { sendOrganizationAcceptanceEmail, sendOrganizationRejectionEmail } from '../../../SMTP/emails.js';
import { loginInfoSchema } from '../../../types.js';
import { authorizeOnly } from '../../authorization.js';

const adminRouter = Router();
const createCrisisBodySchema = newCrisisSchema.pick({
  name: true,
  description: true,
});
const crisisParamsSchema = zod.object({
  id: zod.coerce.number().int().positive('ID must be a positive number'),
});
const crisisPinBodySchema = zod.object({
  pinned: zod.boolean(),
});

adminRouter.post('/login', async (req, res: Response<AdminLoginResponse>) => {
  const body = loginInfoSchema.parse(req.body);

  const account = await database
    .selectFrom('admin_account')
    .selectAll()
    .where('admin_account.email', '=', body.email)
    .executeTakeFirst();

  if (!account) {
    res.status(403);
    throw new Error('Invalid email or password');
  }

  const match = await bcrypt.compare(body.password, account.password);

  if (!match) {
    res.status(403);
    throw new Error('Invalid email or password');
  }
  const token = await new jose.SignJWT({
    id: account.id,
    role: 'admin',
  })
    .setIssuedAt()
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(new TextEncoder().encode(config.JWT_SECRET));

  // @ts-expect-error: Do not return the password
  delete account.password;

  res.json({
    token,
    admin: account,
  });
});

adminRouter.use(authorizeOnly('admin'));

adminRouter.get('/me', async (req, res: Response<AdminMeResponse>) => {
  const admin = await database
    .selectFrom('admin_account')
    .selectAll()
    .where('id', '=', req.userJWT!.id)
    .executeTakeFirstOrThrow();

  // @ts-expect-error: Do not return the password
  delete admin.password;

  res.json({ admin });
});

adminRouter.get('/getOrganizationRequests', async (_req, res: Response<AdminOrganizationRequestsResponse>) => {
  const organizationRequests = await database
    .selectFrom('organization_request')
    .selectAll()
    .execute();

  res.json({ organizationRequests });
});

adminRouter.post('/reviewOrganizationRequest', async (req, res: Response<AdminOrganizationRequestReviewResponse>, next) => {
  const { requestId, accepted, reason } = zod.object({
    requestId: zod.number(),
    accepted: zod.boolean(),
    reason: zod.string().nullable(),
  }).parse(req.body);

  const organizationRequest = await database
    .selectFrom('organization_request')
    .selectAll()
    .where('id', '=', requestId)
    .executeTakeFirst();

  if (!organizationRequest) {
    res.status(404);
    next(new Error('Organization request with id ' + requestId + ' not found.'));
    return;
  }

  if (!accepted) {
    await sendOrganizationRejectionEmail(organizationRequest, reason);
    await database
      .deleteFrom('organization_request')
      .where('id', '=', requestId)
      .execute();
    res.json({});
    return;
  }

  const password = Math.random().toString(36).slice(-8);

  const insertedOrganization = await database.transaction().execute(async (trx) => {
    await trx
      .deleteFrom('organization_request')
      .where('id', '=', requestId)
      .execute();

    return await trx
      .insertInto('organization_account')
      .values({
        name: organizationRequest.name,
        email: organizationRequest.email,
        phone_number: organizationRequest.phone_number,
        url: organizationRequest.url,
        latitude: Number(organizationRequest.latitude),
        longitude: Number(organizationRequest.longitude),
        location_name: organizationRequest.location_name,
        password: await bcrypt.hash(password, 10),
      })
      .returningAll()
      .executeTakeFirst();
  });

  if (!insertedOrganization) {
    res.status(500);
    throw new Error('Failed to create organization account');
  }

  await recomputeOrganizationVector(insertedOrganization.id);

  await sendOrganizationAcceptanceEmail(organizationRequest, password);

  // @ts-expect-error: Do not return the password
  delete insertedOrganization.password;

  res.json({
    organization: insertedOrganization,
  });
});

adminRouter.get('/crises', async (_req, res: Response<AdminCrisesResponse>) => {
  const crises = await database
    .selectFrom('crisis')
    .selectAll()
    .orderBy('pinned', 'desc')
    .orderBy('created_at', 'desc')
    .execute();

  res.json({ crises });
});

adminRouter.post('/crises', async (req, res: Response<AdminCrisisCreateResponse>) => {
  const body = createCrisisBodySchema.parse(req.body);

  const crisis = await database
    .insertInto('crisis')
    .values({
      name: body.name,
      description: body.description,
      pinned: false,
    })
    .returningAll()
    .executeTakeFirst();

  if (!crisis) {
    res.status(500);
    throw new Error('Failed to create crisis');
  }

  res.status(201).json({ crisis });
});

adminRouter.put('/crises/:id', async (req, res: Response<AdminCrisisUpdateResponse>) => {
  const { id } = crisisParamsSchema.parse(req.params);
  const body = createCrisisBodySchema.parse(req.body);

  const crisis = await database
    .updateTable('crisis')
    .set({
      name: body.name,
      description: body.description,
    })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirst();

  if (!crisis) {
    res.status(404);
    throw new Error('Crisis not found');
  }

  res.json({ crisis });
});

adminRouter.patch('/crises/:id/pin', async (req, res: Response<AdminCrisisPinResponse>) => {
  const { id } = crisisParamsSchema.parse(req.params);
  const { pinned } = crisisPinBodySchema.parse(req.body);

  const crisis = await database
    .updateTable('crisis')
    .set({ pinned })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirst();

  if (!crisis) {
    res.status(404);
    throw new Error('Crisis not found');
  }

  res.json({ crisis });
});

adminRouter.delete('/crises/:id', async (req, res: Response<AdminCrisisDeleteResponse>) => {
  const { id } = crisisParamsSchema.parse(req.params);

  const deleted = await database
    .deleteFrom('crisis')
    .where('id', '=', id)
    .returning('id')
    .executeTakeFirst();

  if (!deleted) {
    res.status(404);
    throw new Error('Crisis not found');
  }

  res.json({});
});

adminRouter.post('/reset-password', resetPassword);

export default adminRouter;
