import dotenv from 'dotenv';
import zod from 'zod';

dotenv.config();

const deriveUploadDirFromLegacyCVDir = (cvUploadDir: string | undefined): string | undefined => {
  if (!cvUploadDir) return undefined;

  const normalized = cvUploadDir.replace(/[\\/]+$/, '');
  const lastSeparatorIndex = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'));

  if (lastSeparatorIndex < 0) return undefined;

  return normalized.slice(0, lastSeparatorIndex);
};

const env = {
  ...process.env,
  UPLOAD_DIR: process.env.UPLOAD_DIR ?? deriveUploadDirFromLegacyCVDir(process.env.CV_UPLOAD_DIR),
};

const optionalInDev = <T>(schema: zod.ZodType<T>): zod.ZodType<T> =>
  zod.preprocess((val: unknown) => (val === '' ? undefined : val), schema);

const schema = zod.object({
  NODE_ENV: zod.enum(['development', 'production']).default('development'),

  SERVER_PORT: zod.string().regex(/[0-9]+/),
  CLIENT_URL: zod.url().refine((url: string) => !url.endsWith('/'), {
    message: 'The client url should not end with a trailing slash',
  }),

  POSTGRES_HOST: zod.string().min(1),
  POSTGRES_DB: zod.string().min(1),
  POSTGRES_USER: zod.string().min(1),
  POSTGRES_PASSWORD: zod.string().min(1),
  POSTGRES_PORT: zod.coerce.number(),

  JWT_SECRET: zod.string().min(1),
  UPLOAD_DIR: zod.string().min(1),

  SMTP_HOST: optionalInDev(zod.string().optional()),
  SMTP_PORT: optionalInDev(zod.coerce.number().optional()),
  SMTP_USER: optionalInDev(zod.string().optional()),
  SMTP_PASS: optionalInDev(zod.string().optional()),
  MAIL_FROM: optionalInDev(zod.string().optional()),

  OPENAI_API_KEY: optionalInDev(zod.string().optional()),
  LOCATION_IQ_API_KEY: optionalInDev(zod.string().optional()),
})
  .superRefine((values: Record<string, unknown>, ctx: zod.RefinementCtx) => {
    if (values.NODE_ENV === 'development') return;

    const prodRequired: (keyof typeof values)[] = [
      'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM', 'LOCATION_IQ_API_KEY',
    ];

    prodRequired.forEach((key) => {
      if (!values[key]) {
        ctx.addIssue({
          code: 'invalid_type',
          path: [String(key)],
          expected: 'string',
          received: 'undefined',
          message: `${key} is required in production`,
        });
      }
    });
  });

const config = schema.parse(env);

export default config;
