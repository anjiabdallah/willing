import zod from 'zod';

import { idSchema } from '../../schemas/index.ts';

import type { WithGeneratedID } from './shared.ts';

export const enrollmentDateSchema = zod.object({
  id: idSchema,
  enrollment_id: zod.number().min(1, 'Enrollment ID is required'),
  posting_id: zod.number().min(1, 'Posting ID is required'),
  date: zod.coerce.date({
    error: (issue) => {
      if (issue.code === 'invalid_type') return 'Date is required';
      return 'Invalid date format';
    },
  }),
  attended: zod.boolean(),
});

export type EnrollmentDate = zod.infer<typeof enrollmentDateSchema>;

export type EnrollmentDateTable = WithGeneratedID<EnrollmentDate>;

export const newEnrollmentDateSchema = enrollmentDateSchema.omit({ id: true }).strict();
export type NewEnrollmentDate = zod.infer<typeof newEnrollmentDateSchema>;
