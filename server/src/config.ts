import dotenv from 'dotenv';
import zod from 'zod';

dotenv.config();

const schema = zod.object({
  NODE_ENV: zod.enum(['development', 'production']).default('development'),

  POSTGRES_HOST: zod.string().nonempty(),
  POSTGRES_DB: zod.string().nonempty(),
  POSTGRES_USER: zod.string().nonempty(),
  POSTGRES_PASSWORD: zod.string().nonempty(),
  POSTGRES_PORT: zod.string().regex(/^[0-9]+$/).nonempty().transform(s => Number(s)),

  SERVER_PORT: zod.string().regex(/[0-9]+/).nonempty().transform(s => Number(s)),
  CLIENT_URL: zod.url().refine(url => !url.endsWith('/'), {
    error: 'The client url should not end with a trailing slash',
  }),

  JWT_SECRET: zod.string().nonempty(),
<<<<<<< HEAD
  CLIENT_URL: zod.url(),

  SMTP_USER: zod.string().nonempty(),
  SMTP_PASS: zod.string().nonempty(),
  MAIL_FROM: zod.string().nonempty(),
  SMTP_HOST: zod.string().nonempty(),
  SMTP_PORT: zod.string().regex(/^[0-9]+$/).nonempty().transform(s => Number(s)),

=======
>>>>>>> 70685d713a1c7aa533ec6ade6f9a1e85c6e6310a
});

const config = schema.parse(process.env);

export default config;
