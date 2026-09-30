import mongoose from 'mongoose';
import { AppError } from '../../lib/AppError.js';
import { comparePassword, hashPassword } from '../../lib/password.js';
import { signToken } from '../../lib/jwt.js';
import { ROLES } from '../../lib/roles.js';
import * as filesService from '../../lib/files.service.js';
import { User } from './user.model.js';
import { loadProfile } from './profile.js';

/** Authenticate credentials and issue a token. */
export async function login({ email, password }) {
  // passwordHash and password are select:false, so request them explicitly for comparison.
  const user = await User.findOne({ email }).select('+passwordHash +password');
  if (!user) throw AppError.unauthorized('Email hoặc mật khẩu không chính xác');

  let ok = false;
  if (user.passwordHash) {
    ok = await comparePassword(password, user.passwordHash);
  }
  // Fallback for legacy plain-text passwords
  if (!ok && user.password) {
    if (String(user.password) === String(password)) {
      ok = true;
      user.passwordHash = await hashPassword(password);
      await user.save().catch(() => {});
    }
  }

  if (!ok) throw AppError.unauthorized('Email hoặc mật khẩu không chính xác');

  if (user.status === 'Locked') {
    throw AppError.locked(user.lockReason ? `Tài khoản đã bị khóa: ${user.lockReason}` : 'Tài khoản đã bị khóa');
  }

  // Ensure references are populated
  if (!user.teacher && user.teacherId) {
    user.teacher = user.teacherId;
    await user.save().catch(() => {});
  }
  if (!user.student && user.studentId) {
    user.student = user.studentId;
    await user.save().catch(() => {});
  }

  const token = signToken(user);
  const profile = await loadProfile(user);
  return { token, user: user.toPublic(), profile };
}

/** Current user with role profile. */
export async function getMe(user) {
  const profile = await loadProfile(user);
  return { user: user.toPublic(), profile };
}

/** Update the authenticated user's own avatar (teacher/student profile). */
export async function updateMyAvatar(user, file) {
  if (!file) throw AppError.badRequest('Thiếu tệp ảnh');

  const modelName =
    user.role === ROLES.TEACHER ? 'Teacher' : user.role === ROLES.STUDENT ? 'Student' : null;
  if (!modelName) throw AppError.badRequest('Vai trò không có hồ sơ ảnh đại diện');

  const Model = mongoose.model(modelName);
  const profileId = user.role === ROLES.TEACHER ? user.teacher : user.student;
  const profile = await Model.findById(profileId);
  if (!profile) throw AppError.notFound('Không tìm thấy hồ sơ');

  const uploaded = await filesService.uploadBuffer(file.buffer, {
    folder: 'avatars',
    resourceType: 'image',
    access: 'public',
  });
  const previous = profile.avatar?.publicId;
  profile.avatar = uploaded;
  await profile.save();
  if (previous && previous !== uploaded.publicId) {
    await filesService.destroy(previous, { resourceType: 'image' }).catch(() => {});
  }
  return { avatar: uploaded };
}

/** Change own password after verifying the old one; revokes old tokens. */
export async function changeOwnPassword(userId, { oldPassword, newPassword }) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) throw AppError.notFound('Không tìm thấy tài khoản');

  const ok = await comparePassword(oldPassword, user.passwordHash);
  if (!ok) throw AppError.badRequest('Mật khẩu cũ không chính xác');

  if (await comparePassword(newPassword, user.passwordHash)) {
    throw AppError.badRequest('Mật khẩu mới không được trùng mật khẩu cũ');
  }

  user.passwordHash = await hashPassword(newPassword);
  user.tokenVersion = (user.tokenVersion ?? 0) + 1;
  await user.save();

  // Issue a fresh token so the current session keeps working.
  return { token: signToken(user) };
}
