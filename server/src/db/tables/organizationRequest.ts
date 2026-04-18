import zod from 'zod';

import { emailSchema, idSchema, latitudeSchema, longitudeSchema, websiteSchema } from '../../schemas/index.ts';

import type { WithGeneratedIDAndCreatedAt } from './shared.ts';

export const organizationRequestSchema = zod.object({
  id: idSchema,
  name: zod.string().min(1, 'Name is required'),
  email: emailSchema,
  phone_number: zod.e164('Phone number is invalid'),
  url: websiteSchema,
  latitude: latitudeSchema.nullable(),
  longitude: longitudeSchema.nullable(),
  location_name: zod.string().min(2, 'Location must be longer than 2 characters'),
  created_at: zod.date(),
});

export type OrganizationRequest = zod.infer<typeof organizationRequestSchema>;

export type OrganizationRequestTable = WithGeneratedIDAndCreatedAt<OrganizationRequest>;

export const newOrganizationRequestSchema = organizationRequestSchema.omit({ id: true, created_at: true }).strict();
export type NewOrganizationRequest = zod.infer<typeof newOrganizationRequestSchema>;
