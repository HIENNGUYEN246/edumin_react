import { AppError } from '../lib/AppError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { verifyToken } from '../lib/jwt.js';
import { User } from '../modules/auth/user.model.js';

/**
 * Verify the Bearer token, then confirm the user still exists, is active, and
 * carries the same tokenVersion embedded in the token. Loading the user on
 * every request is what makes JWT revocation immediate.
 */
export const authenticate = asyncHandler(async (req, _res, next) => {
  const header = String(req.headers.authorization || '');
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) throw AppError.unauthorized('Thiếu token xác thực');

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    throw AppError.unauthorized('Phiên đăng nhập không hợp lệ hoặc đã hết hạn');
  }

  const user = await User.findById(payload.sub);
  if (!user) throw AppError.unauthorized('Tài khoản không còn tồn tại');
  if (user.status === 'Locked') {
    throw AppError.locked(user.lockReason ? `Tài khoản đã bị khóa: ${user.lockReason}` : 'Tài khoản đã bị khóa');
  }
  if ((user.tokenVersion ?? 0) !== (payload.tokenVersion ?? 0)) {
    throw AppError.unauthorized('Phiên đăng nhập đã hết hiệu lực, vui lòng đăng nhập lại');
  }

  if (!user.teacher && user.teacherId) user.teacher = user.teacherId;
  if (!user.student && user.studentId) user.student = user.studentId;

  if (!user.department && !user.khoa) {
    if (user.role === 'sinh-vien' && user.student) {
      const { Student } = await import('../modules/students/student.model.js').catch(() => ({}));
      if (Student) {
        const s = await Student.findById(user.student).select('department').lean();
        if (s?.department) {
          user.department = s.department;
          user.khoa = s.department;
        }
      }
    } else if (user.role === 'giao-vien' && user.teacher) {
      const { Teacher } = await import('../modules/teachers/teacher.model.js').catch(() => ({}));
      if (Teacher) {
        const t = await Teacher.findById(user.teacher).select('department').lean();
        if (t?.department) {
          user.department = t.department;
          user.khoa = t.department;
        }
      }
    }
  }

  req.user = user;
  next();
});

export default authenticate;
