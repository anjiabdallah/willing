import { z } from 'zod';

import { newOrganizationPostingSchema } from '../../../server/src/db/tables';

export const organizationPostingFormSchema = newOrganizationPostingSchema
  .omit({
    crisis_id: true,
    latitude: true,
    longitude: true,
    start_date: true,
    start_time: true,
    end_date: true,
    end_time: true,
    is_closed: true,
    allows_partial_attendance: true,
  })
  .extend({
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    start_date: z.string().min(1, 'Start date is required'),
    start_time: z.string().min(1, 'Start time is required'),
    end_date: z.string().min(1, 'End date is required'),
    end_time: z.string().min(1, 'End time is required'),
    max_volunteers: z.string().optional(),
    minimum_age: z.string().optional(),
    automatic_acceptance: z.boolean(),
    allows_partial_attendance: z.boolean().optional(),
  });

export type OrganizationPostingFormData = z.infer<typeof organizationPostingFormSchema>;

export const organizationPostingEditFormSchema = newOrganizationPostingSchema
  .omit({
    crisis_id: true,
    latitude: true,
    longitude: true,
    start_date: true,
    start_time: true,
    end_date: true,
    end_time: true,
  })
  .extend({
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    start_date: z.string().min(1, 'Start date is required'),
    start_time: z.string().min(1, 'Start time is required'),
    end_date: z.string().min(1, 'End date is required'),
    end_time: z.string().min(1, 'End time is required'),
    max_volunteers: z.string().optional(),
    minimum_age: z.string().optional(),
    automatic_acceptance: z.boolean(),
    allows_partial_attendance: z.boolean().optional(),
    is_closed: z.boolean(),
  });

export type OrganizationPostingEditFormData = z.infer<typeof organizationPostingEditFormSchema>;
