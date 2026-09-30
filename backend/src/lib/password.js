import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

const SALT_ROUNDS = 10;

export function hashPassword(plain) {
  return bcrypt.hash(String(plain), SALT_ROUNDS);
}

export function comparePassword(plain, hash) {
  if (!hash) return Promise.resolve(false);
  return bcrypt.compare(String(plain), hash);
}

/**
 * Generate a readable temporary password for admin-triggered resets.
 * Avoids ambiguous characters so it can be dictated over the phone.
 */
export function generateTempPassword(length = 10) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}
