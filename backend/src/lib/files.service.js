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

/** Signed, time-limited delivery URL for authenticated (private) assets. */
export function signedUrl(publicId, { resourceType = 'raw', expiresInSeconds = 300 } = {}) {
  ensureEnabled();
  const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
  return cloudinary.utils.private_download_url
    ? cloudinary.utils.private_download_url(publicId, undefined, {
        resource_type: resourceType,
        type: 'authenticated',
        expires_at: expiresAt,
      })
    : cloudinary.url(publicId, {
        resource_type: resourceType,
        type: 'authenticated',
        sign_url: true,
        secure: true,
      });
}

export default { uploadBuffer, destroy, signedUrl };
