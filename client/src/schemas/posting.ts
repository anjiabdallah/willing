import { z } from 'zod';

import { newPostingSchema } from '../../../server/src/db/tables';

function getTodayDateString() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
}

const getDateTimeFromStrings = (date: string, time: string) => {
  const parsed = new Date(`${date}T${time}`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const notPastDate = (date: string, ctx: z.RefinementCtx, field: string, label: string) => {
  if (date && date < getTodayDateString()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `${label} cannot be in the past`,
      path: [field],
    });
  }
};

const validatePostingDateTimeOrder = (
  data: {
    start_date: string;
    start_time: string;
    end_date: string;
    end_time: string;
  },
  ctx: z.RefinementCtx,
) => {
  const startDateTime = getDateTimeFromStrings(data.start_date, data.start_time);
  const endDateTime = getDateTimeFromStrings(data.end_date, data.end_time);

  if (startDateTime && endDateTime && endDateTime <= startDateTime) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'End time cannot be after start time',
      path: ['end_time'],
    });
  }
};

export const postingFormSchema = newPostingSchema
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
  })
  .superRefine((data, ctx) => {
    notPastDate(data.start_date, ctx, 'start_date', 'Start date');
    notPastDate(data.end_date, ctx, 'end_date', 'End date');

    validatePostingDateTimeOrder(data, ctx);
  });

export type PostingFormData = z.infer<typeof postingFormSchema>;

export const postingEditFormSchema = newPostingSchema
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
  })
  .superRefine((data, ctx) => {
    notPastDate(data.start_date, ctx, 'start_date', 'Start date');
    notPastDate(data.end_date, ctx, 'end_date', 'End date');

    validatePostingDateTimeOrder(data, ctx);
  });

export type PostingEditFormData = z.infer<typeof postingEditFormSchema>;
