import bcrypt from 'bcrypt';
import crypto from 'node:crypto';

// Độ phức tạp băm mật khẩu chuẩn khuyến nghị (OWASP recommendation: 10 - 12 rounds)
const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS) || 10;

/**
 * Băm mật khẩu bằng bcrypt với salt key chuẩn bảo mật cao.
 * Sử dụng bcrypt.genSalt để sinh salt ngẫu nhiên chuẩn cryptographic và băm mật khẩu.
 * 
 * @param {string} plain Mật khẩu dạng văn bản gốc
 * @returns {Promise<string>} Chuỗi hash bcrypt chuẩn ($2b$10$...)
 */
export async function hashPassword(plain) {
  if (plain === undefined || plain === null || String(plain).trim() === '') {
    throw new Error('Mật khẩu không được để trống khi băm');
  }
  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  return bcrypt.hash(String(plain), salt);
}

/**
 * So khớp mật khẩu người dùng nhập với chuỗi hash bcrypt trong cơ sở dữ liệu.
 * 
 * @param {string} plain Mật khẩu dạng văn bản gốc
 * @param {string} hash Chuỗi hash bcrypt đã lưu
 * @returns {Promise<boolean>} Trả về true nếu trùng khớp, false nếu sai hoặc hash không hợp lệ
 */
export async function comparePassword(plain, hash) {
  if (!plain || !hash) return false;
  try {
    return await bcrypt.compare(String(plain), String(hash));
  } catch {
    return false;
  }
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

export default {
  hashPassword,
  comparePassword,
  generateTempPassword,
};
