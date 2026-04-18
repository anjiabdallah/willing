import zod from 'zod';

import { emailSchema, genderSchema, idSchema, passwordSchema } from '../../schemas/index.ts';

import type { WithGeneratedColumns, WithGeneratedIDAndTimestamps } from './shared.ts';

export const volunteerAccountSchema = zod.object({
  id: idSchema,
  first_name: zod.string().min(1, 'First name is required'),
  last_name: zod.string().min(1, 'Last name is required'),
  email: emailSchema,
  password: passwordSchema,
  date_of_birth: zod
    .string()
    .min(1, 'Date of birth is required')
    .refine(str => !isNaN(Date.parse(str)), { message: 'Invalid date format' }),
  gender: genderSchema,
  cv_path: zod.string().trim().max(256, 'CV path must be at most 256 characters').nullable(),
  description: zod.string().max(500, 'Description must be less than 500 characters').nullable(),
  volunteer_profile_vector: zod.string().nullable(),
  volunteer_history_vector: zod.string().nullable(),
  volunteer_context_vector: zod.string().nullable(),
  token_version: zod.number().int().nonnegative().default(0),
  is_disabled: zod.boolean().default(false),
  is_deleted: zod.boolean().default(false),
  updated_at: zod.date(),
  created_at: zod.date(),
});
export type VolunteerAccount = zod.infer<typeof volunteerAccountSchema>;

export type VolunteerAccountTable = WithGeneratedIDAndTimestamps<
  WithGeneratedColumns<VolunteerAccount, 'is_disabled' | 'is_deleted' | 'token_version'>
>;

export const newVolunteerAccountSchema = volunteerAccountSchema.omit({
  id: true,
  cv_path: true,
  description: true,
  volunteer_profile_vector: true,
  volunteer_history_vector: true,
  volunteer_context_vector: true,
  is_disabled: true,
  is_deleted: true,
  token_version: true,
  created_at: true,
  updated_at: true,
}).strict();
export type NewVolunteerAccount = zod.infer<typeof newVolunteerAccountSchema>;

export const volunteerAccountWithoutPasswordSchema = volunteerAccountSchema.omit({
  password: true,
  volunteer_profile_vector: true,
  volunteer_history_vector: true,
  volunteer_context_vector: true,
  is_disabled: true,
  is_deleted: true,
  token_version: true,
  created_at: true,
  updated_at: true,
});
export type VolunteerAccountWithoutPassword = zod.infer<typeof volunteerAccountWithoutPasswordSchema>;
