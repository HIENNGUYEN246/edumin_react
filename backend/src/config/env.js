import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const booleanish = (value) => value === 'true' || value === '1';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGO_URI: z.string().min(1, 'MONGO_URI is required'),
  JWT_SECRET: z
    .string()
    .min(16, 'JWT_SECRET must be at least 16 characters')
    // Allow a weak default only outside production so local dev/test can boot.
    .default('dev-only-insecure-jwt-secret-change-me'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  UPLOAD_MAX_MB: z.coerce.number().positive().default(10),
  CLOUDINARY_CLOUD_NAME: z.string().default(''),
  CLOUDINARY_API_KEY: z.string().default(''),
  CLOUDINARY_API_SECRET: z.string().default(''),
  CLOUDINARY_FOLDER: z.string().default('edumin'),
  SEED_ADMIN_EMAIL: z.string().email().default('admin1@edu.vn'),
  SEED_ADMIN_PASSWORD: z.string().min(6).default('Admin@123'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
  // Fail fast: a misconfigured process should never start serving requests.
  console.error(`Invalid environment configuration:\n${issues}`);
  process.exit(1);
}

const env = parsed.data;

if (env.NODE_ENV === 'production' && env.JWT_SECRET === 'dev-only-insecure-jwt-secret-change-me') {
  console.error('JWT_SECRET must be set to a strong value in production.');
  process.exit(1);
}

export const config = {
  ...env,
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  cloudinaryEnabled: Boolean(
    env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET
  ),
  uploadMaxBytes: env.UPLOAD_MAX_MB * 1024 * 1024,
};

export { booleanish };
export default config;
