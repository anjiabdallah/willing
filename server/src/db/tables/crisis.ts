import zod from 'zod';

import { idSchema } from '../../schemas/index.ts';

import type { WithGeneratedIDAndCreatedAt } from './shared.ts';

export const crisisSchema = zod.object({
  id: idSchema,
  name: zod.string().trim().min(1, 'Crisis name is required').max(256, 'Crisis name can at most be 256 characters'),
  description: zod.string().trim().nullable(),
  pinned: zod.boolean(),
  created_at: zod.date(),
});

export type Crisis = zod.infer<typeof crisisSchema>;
export type CrisisTable = WithGeneratedIDAndCreatedAt<Crisis>;

export const newCrisisSchema = crisisSchema.omit({
  id: true,
  pinned: true,
  created_at: true,
}).strict();
export type NewCrisis = zod.infer<typeof newCrisisSchema>;
