import fs from 'fs';

import { Router, Request, Response } from 'express';

import config from '../../../config.js';
import database from '../../../db/index.js';
import { uploadCv, validateCvPdf, deleteCvFileIfExists } from '../../../services/cv/index.js';

const volunteerCvRouter = Router();

// POST /api/volunteer/cv (upload/replace)
volunteerCvRouter.post(
  '/',
  (req, res, next) => {
    uploadCv.single('cv')(req, res, (err: unknown) => {
      if (err instanceof Error) {
        res.status(400);
        throw new Error(err.message);
      }

      if (err) {
        res.status(400);
        throw new Error('Upload failed');
      }

      next();
    });
  },
  async (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400);
      throw new Error('Missing file field "cv".');
    }

    try {
      await validateCvPdf(req.file.path);
    } catch (error) {
      await fs.promises.unlink(req.file.path).catch(() => {});
      res.status(400);
      throw error instanceof Error ? error : new Error('Upload failed');
    }

    const volunteerId = req.userJWT!.id;

    const existing = await database
      .selectFrom('volunteer_account')
      .select(['cv_path'])
      .where('id', '=', volunteerId)
      .executeTakeFirst();

    if (existing?.cv_path) {
      await deleteCvFileIfExists(existing.cv_path);
    }

    await database
      .updateTable('volunteer_account')
      .set({ cv_path: req.file.filename })
      .where('id', '=', volunteerId)
      .execute();

    res.status(201).json({ ok: true });
  },
);

// GET /api/volunteer/cv/preview
volunteerCvRouter.get('/preview', async (req, res) => {
  const row = await database
    .selectFrom('volunteer_account')
    .select(['cv_path'])
    .where('id', '=', req.userJWT!.id)
    .executeTakeFirst();

  if (!row?.cv_path) return res.status(404).json({ error: 'No CV uploaded.' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename="cv.pdf"');

  res.sendFile(row.cv_path, { root: config.CV_UPLOAD_DIR });
});

// GET /api/volunteer/cv/download
volunteerCvRouter.get('/download', async (req, res) => {
  const row = await database
    .selectFrom('volunteer_account')
    .select(['cv_path'])
    .where('id', '=', req.userJWT!.id)
    .executeTakeFirst();

  if (!row?.cv_path) return res.status(404).json({ error: 'No CV uploaded.' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="cv.pdf"');

  res.sendFile(row.cv_path, { root: config.CV_UPLOAD_DIR });
});

// DELETE /api/volunteer/cv
volunteerCvRouter.delete('/', async (req, res) => {
  const row = await database
    .selectFrom('volunteer_account')
    .select(['cv_path'])
    .where('id', '=', req.userJWT!.id)
    .executeTakeFirst();

  if (row?.cv_path) {
    await deleteCvFileIfExists(row.cv_path);
  }

  await database
    .updateTable('volunteer_account')
    .set({ cv_path: undefined })
    .where('id', '=', req.userJWT!.id)
    .execute();

  res.json({ ok: true });
});

export default volunteerCvRouter;
