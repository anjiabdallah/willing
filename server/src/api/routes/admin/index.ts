import { Router } from 'express';
import zod from 'zod';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import database from '../../../db/index.js';
import { authorizeOnly } from '../../authorization.js';
import config from '../../../config.js';
import { sendOrganizationAcceptanceEmail, sendOrganizationRejectionEmail } from './emails.js';

const adminRouter = Router();

adminRouter.post('/login', async (req, res) => {
  const body = zod.object({
    email: zod.email(),
    password: zod.string(),
  }).parse(req.body);

  const account = await database
    .selectFrom('admin_account')
    .selectAll()
    .where('admin_account.email', '=', body.email)
    .executeTakeFirst();

  if (!account) {
    res.status(403);
    throw new Error('Invalid login');
  }

  const match = await bcrypt.compare(body.password, account.password);

  if (!match) {
    res.status(403);
    throw new Error('Invalid login');
  }

  const token = jwt.sign({
    id: account.id,
    role: 'admin',
  }, config.JWT_SECRET);

  res.json({
    token,
  });
});

adminRouter.use(authorizeOnly('admin'));

adminRouter.get('/getOrganizationRequests', async (req, res) => {
  const organizationRequests = await database
    .selectFrom('organization_request')
    .selectAll()
    .execute();

  res.json({ organizationRequests });
});

adminRouter.post('/reviewOrganizationRequest', async (req, res, next) => {
  const { requestId, accepted, reason } = zod.object({
    requestId: zod.string().transform(s => Number(s)),
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
  try {
    if (accepted) {
      await sendOrganizationAcceptanceEmail(organizationRequest, reason);
    } else {
      await sendOrganizationRejectionEmail(organizationRequest, reason);
    }
  } catch (error: unknown) {
    next(error);
    return;
  }

  await database
    .deleteFrom('organization_request')
    .where('id', '=', requestId)
    .execute();

  res.json({});
});

export default adminRouter;
