import zod from 'zod';

import { idSchema, latitudeSchema, longitudeSchema } from '../../schemas/index.ts';

import type { WithGeneratedColumns, WithGeneratedIDAndTimestamps } from './shared.ts';

export const postingSchema = zod.object({
  id: idSchema,
  organization_id: zod.number().min(1, 'Organization ID is required'),
  crisis_id: zod.number().int().positive().nullable(),
  title: zod.string().min(1, 'Title is required'),
  description: zod.string().min(1, 'Description is required'),
  latitude: latitudeSchema.nullable(),
  longitude: longitudeSchema.nullable(),
  max_volunteers: zod.number().nullable(),
  start_date: zod.preprocess(val => val ? new Date(val as string) : val, zod.date({ message: 'Start date must be valid' })),
  start_time: zod.string().min(1, 'Start time is required'),
  end_date: zod.preprocess(val => val ? new Date(val as string) : val, zod.date({ message: 'End date must be valid' })),
  end_time: zod.string().min(1, 'End time is required'),
  minimum_age: zod.number().nullable(),
  automatic_acceptance: zod.boolean().default(true),
  is_closed: zod.boolean().default(false),
  allows_partial_attendance: zod.boolean().default(false),
  location_name: zod.string().min(2, 'Location must be longer than 2 characters'),
  posting_profile_vector: zod.string().nullable(),
  posting_context_vector: zod.string().nullable(),
  updated_at: zod.date(),
  created_at: zod.date(),
});

export type Posting = zod.infer<typeof postingSchema>;

export type PostingTable = WithGeneratedIDAndTimestamps<
  WithGeneratedColumns<Posting, 'allows_partial_attendance'>
>;

export const newPostingSchema = postingSchema
  .omit({ id: true, posting_profile_vector: true, posting_context_vector: true, created_at: true, updated_at: true, organization_id: true })
  .extend({
    skills: zod
      .array(zod.string().min(1, 'Skill name is required'))
      .optional(),
    max_volunteers: zod.number().nullable().optional(),
    minimum_age: zod.number().nullable().optional(),
    crisis_id: zod.number().int().positive().nullable().optional(),
  })
  .strict();
export type NewPosting = zod.infer<typeof newPostingSchema>;

export const postingWithoutVectorsSchema = postingSchema.omit({
  posting_profile_vector: true,
  posting_context_vector: true,
});
export type PostingWithoutVectors = zod.infer<typeof postingWithoutVectorsSchema>;
