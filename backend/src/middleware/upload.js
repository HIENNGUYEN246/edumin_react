import multer from 'multer';
import { config } from '../config/env.js';
import { AppError } from '../lib/AppError.js';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

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

/** Strict PDF-only uploader for course learning documents */
function makeDocumentUploader() {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: config.uploadMaxBytes },
    fileFilter: (_req, file, cb) => {
      const isPdfMime = file.mimetype === 'application/pdf';
      const isPdfExt = file.originalname && file.originalname.toLowerCase().endsWith('.pdf');
      if (isPdfMime || isPdfExt) {
        return cb(null, true);
      }
      cb(
        AppError.badRequest(
          `Tệp "${file.originalname}" không hợp lệ. Hệ thống chỉ chấp nhận tệp tài liệu định dạng PDF (.pdf). Vui lòng lưu/xuất file sang PDF trước khi tải lên. Các định dạng khác và thư mục đều bị từ chối.`
        )
      );
    },
  });
}

const documentMulter = makeDocumentUploader().fields([
  { name: 'file', maxCount: 1 },
  { name: 'files', maxCount: 10 },
]);

export const uploadDocument = (req, res, next) => {
  documentMulter(req, res, (err) => {
    if (err) return next(err);
    if (req.files) {
      if (req.files.file && req.files.file[0]) {
        req.file = req.files.file[0];
      }
    }
    next();
  });
};
