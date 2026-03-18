import fs from 'fs';
import path from 'path';

import multer from 'multer';

import { ORG_SIGNATURE_UPLOAD_DIR } from './paths.js';

export const getAbsoluteSignaturePath = (signaturePath: string) => {
  return path.join(ORG_SIGNATURE_UPLOAD_DIR, signaturePath);
};

export const orgSignatureStorage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    await fs.promises.mkdir(ORG_SIGNATURE_UPLOAD_DIR, { recursive: true });
    cb(null, ORG_SIGNATURE_UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `org-signature-${req.userJWT!.id}-${Date.now()}${ext}`);
  },
});

export const orgSignatureMulter = multer({
  storage: orgSignatureStorage,
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
