import zod from 'zod';

import { idSchema } from '../../schemas/index.ts';

import type { WithGeneratedIDAndCreatedAt } from './shared.ts';

export const enrollmentSchema = zod.object({
  id: idSchema,
  volunteer_id: idSchema,
  posting_id: idSchema,
  message: zod.string().max(350, 'Your message is too long. Please limit it to 350 characters.').nullable(),
  created_at: zod.date(),
  attended: zod.boolean(),
});

export type Enrollment = zod.infer<typeof enrollmentSchema>;
export const newEnrollmentSchema = enrollmentSchema.omit({ id: true, created_at: true, attended: true }).strict();

export type EnrollmentTable = WithGeneratedIDAndCreatedAt<Enrollment>;
