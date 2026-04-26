import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import morgan from 'morgan';
import { ZodError } from 'zod';

import createAPIRouter from './api/index.ts';
import config from './config.ts';

import type { Database } from './db/tables/index.ts';
import type { Kysely } from 'kysely';

function createApp(db: Kysely<Database>) {
  const app = express();

  if (config.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
  }

  app.use(express.json());

  app.use(cors({
    origin: config.NODE_ENV === 'development'
      ? [
          config.CLIENT_URL,
          'http://localhost:5173',
          'http://127.0.0.1:5173',
        ]
      : config.CLIENT_URL,
    credentials: true,
  }));

  app.set('trust proxy', 1);
  app.use(createAPIRouter(db));

  app.use((req, res, next) => {
    res.status(404);
    const error = new Error(`Not Found - ${req.originalUrl}`);
    next(error);
  });

  app.use(((err, _req, res, _next) => {
    if (res.statusCode === 200) {
      if (err instanceof ZodError) {
        res.status(400);
      } else {
        res.status(500);
      }
    }

    res.json({
      message: err.message,
      stack: config.NODE_ENV === 'production' ? '' : err.stack,
    });
  }) as ErrorRequestHandler);

  return app;
}

export default createApp;
