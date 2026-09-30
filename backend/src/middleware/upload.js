import multer from 'multer';
import { config } from '../config/env.js';
import { AppError } from '../lib/AppError.js';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const DOC_TYPES = [
  ...IMAGE_TYPES,
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
  'application/x-zip-compressed',
  'text/plain',
];

/** In-memory single-file upload; the buffer is streamed to Cloudinary. */
function makeUploader(allowed) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: config.uploadMaxBytes },
    fileFilter: (_req, file, cb) => {
      if (allowed.includes(file.mimetype)) return cb(null, true);
      cb(AppError.badRequest(`Định dạng tệp không được hỗ trợ: ${file.mimetype}`));
    },
  });
}

export const uploadImage = makeUploader(IMAGE_TYPES).single('file');
export const uploadDocument = makeUploader(DOC_TYPES).single('file');
