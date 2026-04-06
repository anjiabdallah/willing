import zod from 'zod';

import { emailSchema, idSchema, latitudeSchema, longitudeSchema, passwordSchema, websiteSchema } from '../../schemas/index.ts';

import type { WithGeneratedColumns, WithGeneratedIDAndTimestamps } from './shared.ts';

export const organizationAccountSchema = zod.object({
  id: idSchema,
  name: zod.string().min(1, 'Name is required'),
  email: emailSchema,
  phone_number: zod.e164('Phone number is invalid'),
  url: websiteSchema,
  description: zod.string().max(300, 'Description must be less than 300 characters').optional(),
  latitude: latitudeSchema.optional(),
  longitude: longitudeSchema.optional(),
  location_name: zod.string().min(2, 'Location must be longer than 2 characters'),
  password: passwordSchema,
  logo_path: zod.string().optional(),
  certificate_info_id: zod.number().nullable().optional(),
  org_profile_vector: zod.string().optional(),
  org_history_vector: zod.string().optional(),
  org_context_vector: zod.string().optional(),
  token_version: zod.number().int().nonnegative().default(0),
  is_disabled: zod.boolean().default(false),
  is_deleted: zod.boolean().default(false),
  updated_at: zod.date(),
  created_at: zod.date(),
});

export type OrganizationAccount = zod.infer<typeof organizationAccountSchema>;

export type OrganizationAccountTable = WithGeneratedIDAndTimestamps<
  WithGeneratedColumns<OrganizationAccount, 'is_disabled' | 'is_deleted' | 'token_version'>
>;

export const newOrganizationAccountSchema = organizationAccountSchema.omit({ id: true, certificate_info_id: true, org_profile_vector: true, org_history_vector: true, org_context_vector: true, is_disabled: true, is_deleted: true, created_at: true, updated_at: true, token_version: true }).strict();
export type NewOrganizationAccount = zod.infer<typeof newOrganizationAccountSchema>;

export const organizationAccountUpdate = organizationAccountSchema.omit({ password: true, certificate_info_id: true, org_profile_vector: true, org_history_vector: true, org_context_vector: true, is_disabled: true, is_deleted: true, token_version: true, created_at: true, updated_at: true }).partial().strict();
export type OrganizationAccountWithoutPassword = zod.infer<typeof organizationAccountUpdate>;

export const organizationAccountWithoutPasswordAndVectorSchema = organizationAccountSchema.omit({
  password: true,
  certificate_info_id: true,
  org_profile_vector: true,
  org_history_vector: true,
  org_context_vector: true,
  token_version: true,
  is_disabled: true,
  is_deleted: true,
});
export type OrganizationAccountWithoutPasswordAndVector = zod.infer<typeof organizationAccountWithoutPasswordAndVectorSchema>;
