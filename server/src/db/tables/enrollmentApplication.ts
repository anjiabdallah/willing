import zod from 'zod';

import { idSchema } from '../../schemas/index.ts';

import type { WithGeneratedIDAndCreatedAt } from './shared.ts';

export const enrollmentApplicationSchema = zod.object({
  id: idSchema,
  volunteer_id: idSchema,
  posting_id: idSchema,
  message: zod.string().max(350, 'Your message is too long. Please limit it to 350 characters.').nullable(),
  created_at: zod.date(),
});

export type EnrollmentApplication = zod.infer<typeof enrollmentApplicationSchema>;
export const newEnrollmentApplicationSchema = enrollmentApplicationSchema.omit({ id: true, created_at: true }).strict();
export type EnrollmentApplicationTable = WithGeneratedIDAndCreatedAt<EnrollmentApplication>;
