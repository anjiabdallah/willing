import path from 'path';

import config from '../../config.js';

export const CV_UPLOAD_DIR = path.resolve(path.join(config.UPLOAD_DIR, 'cvs'));
export const ORG_LOGO_UPLOAD_DIR = path.resolve(path.join(config.UPLOAD_DIR, 'org-logos'));
export const ORG_SIGNATURE_UPLOAD_DIR = path.resolve(path.join(config.UPLOAD_DIR, 'org-signatures'));
