import fs from 'fs';
import path from 'path';

import multer from 'multer';

import { ORG_LOGO_UPLOAD_DIR } from './paths.js';

export const getAbsoluteLogoPath = (logoPath: string) => {
  return path.join(ORG_LOGO_UPLOAD_DIR, logoPath);
};

export const orgLogoStorage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    await fs.promises.mkdir(ORG_LOGO_UPLOAD_DIR, { recursive: true });
    cb(null, ORG_LOGO_UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `org-logo-${req.userJWT!.id}-${Date.now()}${ext}`);
  },
});

export const orgLogoMulter = multer({
  storage: orgLogoStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = ['image/png', 'image/jpeg', 'image/jpg'];
    const allowedExts = ['.png', '.jpg', '.jpeg'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (!allowedMimes.includes(file.mimetype) || !allowedExts.includes(ext)) {
      return cb(new Error('Only PNG, JPG, and JPEG image files are allowed.'));
    }

    cb(null, true);
  },
});
