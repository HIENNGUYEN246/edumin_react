import { v2 as cloudinary } from 'cloudinary';
import { config } from './env.js';

if (config.cloudinaryEnabled) {
  cloudinary.config({
    cloud_name: config.CLOUDINARY_CLOUD_NAME,
    api_key: config.CLOUDINARY_API_KEY,
    api_secret: config.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export { cloudinary };
export default cloudinary;
