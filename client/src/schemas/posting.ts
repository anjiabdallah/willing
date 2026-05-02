import { z } from 'zod';

import { newPostingSchema } from '../../../server/src/db/tables';

function getTodayDateString() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
}

function getLocalTodayDateString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function getLocalTimeString() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

const notPastDate = (date: string, ctx: z.RefinementCtx, field: string, label: string) => {
  if (date && date < getTodayDateString()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `${label} cannot be in the past`,
      path: [field],
    });
  }
};

const isTimeOrderValid = (startTime: string, endTime: string) => {
  return !startTime || !endTime || endTime > startTime;
};

const isSameLocalDate = (date: string) => date === getLocalTodayDateString();
const isTimeInThePast = (time: string) => time < getLocalTimeString();

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

    if (data.start_date && data.start_time && isSameLocalDate(data.start_date) && isTimeInThePast(data.start_time)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Start time cannot be in the past',
        path: ['start_time'],
      });
    }

    if (data.end_date && data.end_time && isSameLocalDate(data.end_date) && isTimeInThePast(data.end_time)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'End time cannot be in the past',
        path: ['end_time'],
      });
    }

    if (!isTimeOrderValid(data.start_time, data.end_time)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'End time cannot be before or equal to start time',
        path: ['end_time'],
      });
    }
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

    if (data.start_date && data.start_time && isSameLocalDate(data.start_date) && isTimeInThePast(data.start_time)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Start time cannot be in the past',
        path: ['start_time'],
      });
    }

    if (data.end_date && data.end_time && isSameLocalDate(data.end_date) && isTimeInThePast(data.end_time)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'End time cannot be in the past',
        path: ['end_time'],
      });
    }

    if (!isTimeOrderValid(data.start_time, data.end_time)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'End time cannot be before or equal to start time',
        path: ['end_time'],
      });
    }
  });

export type PostingEditFormData = z.infer<typeof postingEditFormSchema>;
