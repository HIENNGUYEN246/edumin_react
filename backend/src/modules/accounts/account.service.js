import mongoose from 'mongoose';
import { AppError } from '../../lib/AppError.js';
import { parseListQuery, paginate, searchFilter } from '../../lib/pagination.js';
import { hashPassword, generateTempPassword } from '../../lib/password.js';
import { ROLES } from '../../lib/roles.js';
import { User } from '../auth/user.model.js';

/** Which profile field to populate for a given role. */
function profilePath(role) {
  if (role === ROLES.TEACHER) return 'teacher';
  if (role === ROLES.STUDENT) return 'student';
  return null;
}

export async function listAccounts(query) {
  const { page, limit, skip, sort, search } = parseListQuery(query, { defaultSort: 'email' });
  const filter = { ...searchFilter(search, ['email', 'hoTen']) };
  if (query.role) filter.role = query.role;

  const path = profilePath(query.role);
  const populate = path && mongoose.modelNames().includes(path === 'teacher' ? 'Teacher' : 'Student')
    ? { path, select: 'id hoTen department className avatar' }
    : undefined;

  // passwordHash is select:false, so it is never returned here.
  return paginate(User, { filter, page, limit, skip, sort, populate, select: '-passwordHash' });
}

export async function updateStatus(actor, id, { status, lockReason }) {
  if (String(actor._id) === String(id) && status === 'Locked') {
    throw AppError.badRequest('Bạn không thể tự khóa tài khoản của mình');
  }
  const user = await User.findById(id);
  if (!user) throw AppError.notFound('Không tìm thấy tài khoản');

  user.status = status;
  user.lockReason = status === 'Locked' ? lockReason || '' : '';
  // Locking revokes active sessions immediately.
  if (status === 'Locked') user.tokenVersion = (user.tokenVersion ?? 0) + 1;
  await user.save();
  return user.toPublic();
}

/** Reset to a random temp password and return it once for the admin to relay. */
export async function resetPassword(id) {
  const user = await User.findById(id);
  if (!user) throw AppError.notFound('Không tìm thấy tài khoản');

  const tempPassword = generateTempPassword();
  user.passwordHash = await hashPassword(tempPassword);
  user.tokenVersion = (user.tokenVersion ?? 0) + 1;
  await user.save();
  return { tempPassword };
}

/** Delete an account plus its profile (and avatar/enrollments) sequentially. */
export async function deleteAccount(actor, id) {
  if (String(actor._id) === String(id)) {
    throw AppError.badRequest('Bạn không thể xóa tài khoản của mình');
  }
  const user = await User.findById(id);
  if (!user) throw AppError.notFound('Không tìm thấy tài khoản');

  const models = mongoose.modelNames();
  let avatarToDelete = null;

  if (user.teacher && models.includes('Teacher')) {
    const teacher = await mongoose.model('Teacher').findById(user.teacher);
    if (teacher) {
      avatarToDelete = teacher.avatar?.publicId || null;
      if (models.includes('Department')) {
        await mongoose.model('Department').updateMany({ head: teacher._id }, { $set: { head: null } });
      }
      await mongoose.model('Teacher').deleteOne({ _id: teacher._id });
    }
  }
  if (user.student && models.includes('Student')) {
    const student = await mongoose.model('Student').findById(user.student);
    if (student) {
      avatarToDelete = student.avatar?.publicId || null;
      if (models.includes('Enrollment')) {
        await mongoose.model('Enrollment').deleteMany({ student: student._id });
      }
      await mongoose.model('Student').deleteOne({ _id: student._id });
    }
  }
  await User.deleteOne({ _id: user._id });

  if (avatarToDelete) {
    const filesService = await import('../../lib/files.service.js');
    await filesService.destroy(avatarToDelete, { resourceType: 'image' }).catch(() => {});
  }
  return { success: true };
}

export async function bulkDeleteAccounts(actor, ids) {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw AppError.badRequest('Danh sách mã tài khoản không hợp lệ');
  }
  let deletedCount = 0;
  for (const id of ids) {
    try {
      await deleteAccount(actor, id);
      deletedCount += 1;
    } catch {
      // Continue next
    }
  }
  return { deletedCount };
}

