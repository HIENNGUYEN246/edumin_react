import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';

/**
 * Sign an access token. `tokenVersion` is embedded so that bumping the user's
 * version (on password change / lock / reset) invalidates all older tokens.
 */
export function signToken(user) {
  return jwt.sign(
    { sub: String(user._id), role: user.role, tokenVersion: user.tokenVersion ?? 0 },
    config.JWT_SECRET,
    { expiresIn: config.JWT_EXPIRES_IN }
  );
}

export function verifyToken(token) {
  return jwt.verify(token, config.JWT_SECRET);
}
