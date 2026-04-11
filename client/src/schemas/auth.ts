import { z } from 'zod';

import { passwordSchema } from '../../../server/src/schemas/index.ts';

export { passwordSchema } from '../../../server/src/schemas/index.ts';

export const loginFormSchema = z.object({
  email: z.email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginFormData = z.infer<typeof loginFormSchema>;

export const forgotPasswordRequestSchema = z.object({
  email: z.email('Invalid email'),
});

export type ForgotPasswordRequestFormData = z.infer<typeof forgotPasswordRequestSchema>;

export const forgotPasswordResetSchema = z.object({
  password: passwordSchema,
  confirmPassword: z.string().min(1, 'Confirm password is required'),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export type ForgotPasswordResetFormData = z.infer<typeof forgotPasswordResetSchema>;
