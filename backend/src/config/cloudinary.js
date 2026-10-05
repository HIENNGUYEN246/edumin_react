import { v2 as cloudinary } from 'cloudinary';
import { config } from './env.js';

if (config.cloudinaryEnabled) {
  const sanitize = (val) => String(val || '').replace(/^[\s("']+|[\s)"']+$/g, '').trim();
  cloudinary.config({
    cloud_name: sanitize(config.CLOUDINARY_CLOUD_NAME),
    api_key: sanitize(config.CLOUDINARY_API_KEY),
    api_secret: sanitize(config.CLOUDINARY_API_SECRET),
    secure: true,
  });
}

export { cloudinary };
export default cloudinary;
