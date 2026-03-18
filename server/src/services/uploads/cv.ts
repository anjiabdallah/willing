import fs from 'fs';
import path from 'path';

import { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { PDFParse } from 'pdf-parse';

import { CV_UPLOAD_DIR } from './paths.js';

export const cvStorage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    await fs.promises.mkdir(CV_UPLOAD_DIR, { recursive: true });
    cb(null, CV_UPLOAD_DIR);
  },
  filename: (req, _file, cb) => {
    cb(null, `volunteer-${req.userJWT!.id}-${Date.now()}.pdf`);
  },
});

export const cvMulter = multer({
  storage: cvStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== 'application/pdf'
      || path.extname(file.originalname).toLowerCase() !== '.pdf') {
      cb(new Error('Only PDF CV files are allowed.'));
      return;
    }

    cb(null, true);
  },
});

export const validateCvMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.file) {
    res.status(400);
    throw new Error('Missing file field "cv".');
  }

  let parser: PDFParse | undefined;

  try {
    const fileBytes = await fs.promises.readFile(req.file.path);

    parser = new PDFParse({ data: fileBytes });
    const info = await parser.getInfo();

    const pageCount = info.total ?? 0;
    if (pageCount > 3) {
      throw new Error();
    }
    next();
  } catch (_err) {
    await fs.promises.unlink(req.file.path).catch(() => {});
    next(new Error('CV must be a PDF with no more than 3 pages.'));
  } finally {
    await parser?.destroy();
  }
};
