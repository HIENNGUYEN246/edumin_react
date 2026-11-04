import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';

/**
 * Tối ưu hóa quá trình sinh Access Token (JWT) theo chuẩn RFC 7519:
 * - Chuẩn hóa payload tối ưu: sub (Subject), id, email, role, tokenVersion
 * - Chỉ định tường minh thuật toán mã hóa (algorithm: 'HS256') ngăn ngừa các lỗ hổng alg:none
 * - Hạn dùng linh hoạt theo cấu hình (mặc định '8h')
 * - Tích hợp tokenVersion phục vụ thu hồi session tức thì khi đổi mật khẩu / khóa tài khoản
 * 
 * @param {object} user Thông tin người dùng từ CSDL
 * @param {object} [customOptions] Tùy chọn bổ sung (nếu có)
 * @returns {string} Chuỗi JSON Web Token đã ký
 */
export function signToken(user, customOptions = {}) {
  if (!user) {
    throw new Error('User object is required to sign JWT');
  }

  const userId = String(user._id || user.id || '');
  if (!userId) {
    throw new Error('User ID is missing for JWT generation');
  }

  const payload = {
    sub: userId,
    id: userId,
    email: user.email ? String(user.email).toLowerCase() : undefined,
    role: user.role || 'sinh-vien',
    tokenVersion: Number(user.tokenVersion ?? 0),
  };

  const secret = config.JWT_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }

  const options = {
    expiresIn: config.JWT_EXPIRES_IN || '8h',
    algorithm: 'HS256',
    ...customOptions,
  };

  return jwt.sign(payload, secret, options);
}

/**
 * Xác thực token an toàn với việc cố định thuật toán HS256
 * @param {string} token Chuỗi JWT
 * @returns {object} Decoded payload
 */
export function verifyToken(token) {
  const secret = config.JWT_SECRET || process.env.JWT_SECRET;
  return jwt.verify(token, secret, {
    algorithms: ['HS256'],
  });
}

export default {
  signToken,
  verifyToken,
};
