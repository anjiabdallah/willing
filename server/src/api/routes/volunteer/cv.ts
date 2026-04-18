import fs from 'fs';
import path from 'path';

import { type NextFunction, Router, type Request, type Response } from 'express';
import { sql, type Kysely } from 'kysely';

import { type DeleteVolunteerCvResponse, type UploadVolunteerCvResponse } from './cv.types.ts';
import { type Database } from '../../../db/tables/index.ts';
import { recomputeVolunteerProfileVector } from '../../../services/embeddings/updates.ts';
import { cvMulter, validateCvMiddleware } from '../../../services/uploads/cv.ts';
import { CV_UPLOAD_DIR } from '../../../services/uploads/paths.ts';
import uploadSingle from '../../../services/uploads/uploadSingle.ts';
import { getVolunteerProfile } from '../../../services/volunteer/index.ts';
import { canRecomputeProfileVector } from '../utils/rateLimit.ts';

export const deleteCvFileIfExists = async (cvPath?: string | null) => {
  if (!cvPath) return;

  try {
    await fs.promises.unlink(path.join(CV_UPLOAD_DIR, cvPath));
  } catch {
    // ignore
  }
};

function createVolunteerCvRouter(db: Kysely<Database>) {
  const volunteerCvRouter = Router();

  volunteerCvRouter.post(
    '/',
    uploadSingle(cvMulter, 'cv'),
    validateCvMiddleware,
    async (req: Request, res: Response<UploadVolunteerCvResponse>) => {
      const volunteerId = req.userJWT!.id;

      const existing = await db
        .selectFrom('volunteer_account')
        .select(['cv_path'])
        .where('id', '=', volunteerId)
        .where('is_deleted', '=', false)
        .executeTakeFirst();

      if (existing?.cv_path) {
        console.log('deleting cv with name ', existing.cv_path);
        await deleteCvFileIfExists(existing.cv_path);
      }

      await db
        .updateTable('volunteer_account')
        .set({ cv_path: req.file!.filename })
        .where('id', '=', volunteerId)
        .execute();

      if (canRecomputeProfileVector(req)) {
        await recomputeVolunteerProfileVector(volunteerId, db);
      }

      const profile = await getVolunteerProfile(volunteerId);
      res.status(201).json(profile);
    },
  );

  volunteerCvRouter.get('/preview', async (req: Request, res: Response, next: NextFunction) => {
    const profile = await db
      .selectFrom('volunteer_account')
      .select(['cv_path'])
      .where('id', '=', req.userJWT!.id)
      .where('is_deleted', '=', false)
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
    const profile = await db
      .selectFrom('volunteer_account')
      .select(['cv_path'])
      .where('id', '=', req.userJWT!.id)
      .where('is_deleted', '=', false)
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
    const row = await db
      .selectFrom('volunteer_account')
      .select(['cv_path'])
      .where('id', '=', req.userJWT!.id)
      .where('is_deleted', '=', false)
      .executeTakeFirst();

    if (row?.cv_path) {
      await deleteCvFileIfExists(row.cv_path);
    }

    await db
      .updateTable('volunteer_account')
      .set({ cv_path: sql`NULL` })
      .where('id', '=', req.userJWT!.id)
      .execute();

    if (canRecomputeProfileVector(req)) {
      await recomputeVolunteerProfileVector(req.userJWT!.id, db);
    }

    const profile = await getVolunteerProfile(req.userJWT!.id);
    res.json(profile);
  });

  return volunteerCvRouter;
}

export default createVolunteerCvRouter;
