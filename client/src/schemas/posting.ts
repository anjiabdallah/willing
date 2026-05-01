import { z } from 'zod';

import { newPostingSchema } from '../../../server/src/db/tables';

function getTodayDateString() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
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

const parseTimeToMinutes = (time: string) => {
  const parts = time.split(':').map(Number);
  const hours = parts[0] ?? 0;
  const minutes = parts[1] ?? 0;
  const seconds = parts[2] ?? 0;
  return hours * 60 + minutes + seconds / 60;
};

const getLocalTodayDateString = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const getCurrentLocalMinutes = () => {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
};

const validateTimeOrder = (start_time: string, end_time: string, ctx: z.RefinementCtx) => {
  if (start_time && end_time && parseTimeToMinutes(end_time) < parseTimeToMinutes(start_time)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'End time cannot be before start time',
      path: ['end_time'],
    });
  }
};

const validateStartTimeNotPast = (start_date: string, start_time: string, ctx: z.RefinementCtx) => {
  if (
    start_date === getLocalTodayDateString()
    && start_time
    && parseTimeToMinutes(start_time) < getCurrentLocalMinutes()
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Start time cannot be in the past',
      path: ['start_time'],
    });
  }
};

const validateEndTimeNotPast = (end_date: string, end_time: string, ctx: z.RefinementCtx) => {
  if (
    end_date === getLocalTodayDateString()
    && end_time
    && parseTimeToMinutes(end_time) < getCurrentLocalMinutes()
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'End time cannot be in the past',
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
    validateTimeOrder(data.start_time, data.end_time, ctx);
    validateStartTimeNotPast(data.start_date, data.start_time, ctx);
    validateEndTimeNotPast(data.end_date, data.end_time, ctx);
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
    validateTimeOrder(data.start_time, data.end_time, ctx);
    validateStartTimeNotPast(data.start_date, data.start_time, ctx);
    validateEndTimeNotPast(data.end_date, data.end_time, ctx);
  });

export type PostingEditFormData = z.infer<typeof postingEditFormSchema>;
