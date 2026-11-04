import { cloudinary } from '../config/cloudinary.js';
import { config } from '../config/env.js';
import { AppError } from './AppError.js';

/**
 * Thin wrapper over Cloudinary so controllers never touch the SDK directly
 * and tests can mock this module. All uploads live under CLOUDINARY_FOLDER.
 *
 * Metadata persisted to Mongo: { publicId, url, resourceType, bytes, format }.
 */

function ensureEnabled() {
  if (!config.cloudinaryEnabled) {
    throw AppError.badRequest(
      'Chức năng tải tệp chưa được cấu hình (thiếu thông tin Cloudinary trong .env)'
    );
  }
}

/**
 * Upload a buffer.
 * @param {Buffer} buffer
 * @param {{ folder?: string, resourceType?: 'image'|'raw'|'auto', access?: 'public'|'authenticated', publicId?: string }} options
 */
export function uploadBuffer(buffer, { folder = '', resourceType = 'auto', access = 'public', publicId } = {}) {
  ensureEnabled();
  const fullFolder = [config.CLOUDINARY_FOLDER, folder].filter(Boolean).join('/');
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: fullFolder,
        resource_type: resourceType,
        type: access === 'authenticated' ? 'authenticated' : 'upload',
        ...(publicId ? { public_id: publicId } : {}),
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({
          publicId: result.public_id,
          url: result.secure_url,
          resourceType: result.resource_type,
          bytes: result.bytes,
          format: result.format || '',
          access,
        });
      }
    );
    stream.end(buffer);
  });
}

export async function destroy(publicId, { resourceType = 'image', access = 'upload' } = {}) {
  if (!publicId) return;
  ensureEnabled();
  await cloudinary.uploader.destroy(publicId, {
    resource_type: resourceType,
    type: access === 'authenticated' ? 'authenticated' : 'upload',
    invalidate: true,
  });
}

/**
 * Tạo URL có chữ ký số (signed URL) để tải hoặc xem tệp an toàn,
 * vượt qua các hạn chế ACL / 401 của Cloudinary đối với tệp PDF và Raw files.
 */
export function signedUrl(
  publicId,
  { resourceType = 'auto', format = '', access = 'public', expiresInSeconds = 3600 } = {}
) {
  ensureEnabled();
  const type = access === 'authenticated' ? 'authenticated' : 'upload';
  const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const cleanFormat = format ? String(format).replace(/^\./, '') : undefined;

  return cloudinary.url(publicId, {
    resource_type: resourceType || 'auto',
    type,
    sign_url: true,
    secure: true,
    ...(cleanFormat ? { format: cleanFormat } : {}),
    expires_at: expiresAt,
  });
}

/**
 * Tạo URL tải riêng biệt qua Cloudinary API (private_download_url),
 * dùng chữ ký HMAC xác thực trực tiếp với Cloudinary Server.
 * Giúp vượt qua triệt để lỗi "401 deny or ACL failure" của CDN đối với các tệp PDF/tài liệu.
 */
export function privateDownloadUrl(
  publicId,
  { resourceType = 'image', format = 'pdf', access = 'public', attachment = false, expiresInSeconds = 3600 } = {}
) {
  ensureEnabled();
  const type = access === 'authenticated' ? 'authenticated' : 'upload';
  const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const cleanFormat = format ? String(format).replace(/^\./, '') : 'pdf';

  return cloudinary.utils.private_download_url(publicId, cleanFormat, {
    resource_type: resourceType || 'image',
    type,
    attachment,
    expires_at: expiresAt,
  });
}

export const filesService = { uploadBuffer, destroy, signedUrl, privateDownloadUrl };
export default filesService;
