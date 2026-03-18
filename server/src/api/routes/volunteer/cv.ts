import fs from 'fs';
import path from 'path';

import { NextFunction, Router, Request, Response } from 'express';
import { sql } from 'kysely';

import { DeleteVolunteerCvResponse, UploadVolunteerCvResponse } from './cv.types.js';
import database from '../../../db/index.js';
import { recomputeVolunteerProfileVector } from '../../../services/embeddings/updates.js';
import { cvMulter, validateCvMiddleware } from '../../../services/uploads/cv.js';
import { CV_UPLOAD_DIR } from '../../../services/uploads/paths.js';
import uploadSingle from '../../../services/uploads/uploadSingle.js';
import { getVolunteerProfile } from '../../../services/volunteer/index.js';

export const deleteCvFileIfExists = async (cvPath?: string | null) => {
  if (!cvPath) return;

  try {
    await fs.promises.unlink(path.join(CV_UPLOAD_DIR, cvPath));
  } catch {
    // ignore
  }
};

const volunteerCvRouter = Router();

volunteerCvRouter.post(
  '/',
  uploadSingle(cvMulter, 'cv'),
  validateCvMiddleware,
  async (req: Request, res: Response<UploadVolunteerCvResponse>) => {
    const volunteerId = req.userJWT!.id;

    const existing = await database
      .selectFrom('volunteer_account')
      .select(['cv_path'])
      .where('id', '=', volunteerId)
      .executeTakeFirst();

    if (existing?.cv_path) {
      console.log('deleting cv with name ', existing.cv_path);
      await deleteCvFileIfExists(existing.cv_path);
    }

    await database
      .updateTable('volunteer_account')
      .set({ cv_path: req.file!.filename })
      .where('id', '=', volunteerId)
      .execute();

    await recomputeVolunteerProfileVector(volunteerId);

    const profile = await getVolunteerProfile(volunteerId);
    res.status(201).json(profile);
  },
);

volunteerCvRouter.get('/preview', async (req: Request, res: Response, next: NextFunction) => {
  const profile = await database
    .selectFrom('volunteer_account')
    .select(['cv_path'])
    .where('id', '=', req.userJWT!.id)
    .executeTakeFirst();

  if (!profile?.cv_path) {
    res.status(404);
    throw new Error('No CV uploaded');
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename="cv.pdf"');

  res.sendFile(profile.cv_path, { root: CV_UPLOAD_DIR }, (error) => {
    if (!error) return;
    next(error);
  });
});

volunteerCvRouter.get('/download', async (req: Request, res: Response, next: NextFunction) => {
  const profile = await database
    .selectFrom('volunteer_account')
    .select(['cv_path'])
    .where('id', '=', req.userJWT!.id)
    .executeTakeFirst();

  if (!profile?.cv_path) {
    res.status(404);
    throw new Error('No CV uploaded');
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="cv.pdf"');

  res.sendFile(profile.cv_path, { root: CV_UPLOAD_DIR }, (error) => {
    if (!error) return;
    next(error);
  });
});

volunteerCvRouter.delete('/', async (req, res: Response<DeleteVolunteerCvResponse>) => {
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
    .set({ cv_path: sql`NULL` })
    .where('id', '=', req.userJWT!.id)
    .execute();

  await recomputeVolunteerProfileVector(req.userJWT!.id);

  const profile = await getVolunteerProfile(req.userJWT!.id);
  res.json(profile);
});

export default volunteerCvRouter;
