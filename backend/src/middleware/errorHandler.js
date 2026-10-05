import { ZodError } from 'zod';
import mongoose from 'mongoose';
import multer from 'multer';
import { AppError } from '../lib/AppError.js';
import { config } from '../config/env.js';

export function notFoundHandler(req, res) {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `Không tìm thấy đường dẫn ${req.method} ${req.originalUrl}` },
  });
}

/**
 * Central error translator. Maps known error shapes (AppError, Zod,
 * Mongoose validation/cast, duplicate key, Multer) to the shared
 * `{ error: { code, message, details? } }` envelope.
 */
// eslint-disable-next-line no-unused-vars -- Express detects error handlers by arity (4 args).
export function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
    });
  }

  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Dữ liệu không hợp lệ', details },
    });
  }

  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((e) => ({ path: e.path, message: e.message }));
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Dữ liệu không hợp lệ', details },
    });
  }

  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({
      error: { code: 'INVALID_ID', message: `Giá trị không hợp lệ cho trường ${err.path}` },
    });
  }

  if (err?.code === 11000) {
    const fields = Object.keys(err.keyValue || {});
    return res.status(409).json({
      error: {
        code: 'DUPLICATE_KEY',
        message: 'Dữ liệu đã tồn tại',
        details: fields.map((path) => ({ path, message: `${path} đã tồn tại` })),
      },
    });
  }

  if (err instanceof multer.MulterError) {
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return res.status(status).json({
      error: { code: err.code, message: err.message },
    });
  }

  console.error('Unhandled error:', err);
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: config.isProduction ? 'Lỗi máy chủ nội bộ' : err.message || 'Lỗi máy chủ nội bộ',
    },
  });
}
