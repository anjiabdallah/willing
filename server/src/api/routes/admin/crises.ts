import { Router, Response } from 'express';
import zod from 'zod';

import {
  AdminCrisisCreateResponse,
  AdminCrisisDeleteResponse,
  AdminCrisisPinResponse,
  AdminCrisisUpdateResponse,
  AdminCrisesResponse,
} from './crises.types.js';
import database from '../../../db/index.js';
import { newCrisisSchema } from '../../../db/tables.js';

const adminCrisesRouter = Router();

const createCrisisBodySchema = newCrisisSchema;

const crisisParamsSchema = zod.object({
  id: zod.coerce.number().int().positive('ID must be a positive number'),
});

const crisisPinBodySchema = zod.object({
  pinned: zod.boolean(),
});

adminCrisesRouter.get('/', async (_req, res: Response<AdminCrisesResponse>) => {
  const crises = await database
    .selectFrom('crisis')
    .selectAll()
    .orderBy('pinned', 'desc')
    .orderBy('created_at', 'desc')
    .execute();

  res.json({ crises });
});

adminCrisesRouter.post('/', async (req, res: Response<AdminCrisisCreateResponse>) => {
  const body = createCrisisBodySchema.parse(req.body);

  const crisis = await database
    .insertInto('crisis')
    .values({ ...body, pinned: false })
    .returningAll()
    .executeTakeFirst();

  if (!crisis) {
    res.status(500);
    throw new Error('Failed to create crisis');
  }

  res.status(201).json({ crisis });
});

adminCrisesRouter.put('/:id', async (req, res: Response<AdminCrisisUpdateResponse>) => {
  const { id } = crisisParamsSchema.parse(req.params);
  const body = createCrisisBodySchema.parse(req.body);

  const crisis = await database
    .updateTable('crisis')
    .set(body)
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirst();

  if (!crisis) {
    res.status(404);
    throw new Error('Crisis not found');
  }

  res.json({ crisis });
});

adminCrisesRouter.patch('/:id/pin', async (req, res: Response<AdminCrisisPinResponse>) => {
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

adminCrisesRouter.delete('/:id', async (req, res: Response<AdminCrisisDeleteResponse>) => {
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

export default adminCrisesRouter;
