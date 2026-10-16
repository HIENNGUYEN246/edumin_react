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
  const userPublic = user.toPublic();
  const dept = profile?.department || profile?.departmentRef?.name || profile?.departmentRef?.id || user.department || user.khoa || '';
  if (dept) {
    userPublic.department = dept;
    userPublic.khoa = dept;
    if (!user.department || !user.khoa) {
      user.department = dept;
      user.khoa = dept;
      await user.save().catch(() => {});
    }
  }
  return { token, user: userPublic, profile };
}

/** Current user with role profile. */
export async function getMe(user) {
  const profile = await loadProfile(user);
  const userPublic = user.toPublic();
  const dept = profile?.department || profile?.departmentRef?.name || profile?.departmentRef?.id || user.department || user.khoa || '';
  if (dept) {
    userPublic.department = dept;
    userPublic.khoa = dept;
    if (!user.department || !user.khoa) {
      user.department = dept;
      user.khoa = dept;
      await user.save().catch(() => {});
    }
  }
  return { user: userPublic, profile };
}

/** Update the authenticated user's own avatar (admin/teacher/student). */
export async function updateMyAvatar(user, file) {
  if (!file) throw AppError.badRequest('Thiếu tệp ảnh');

  const uploaded = await filesService.uploadBuffer(file.buffer, {
    folder: 'avatars',
    resourceType: 'image',
    access: 'public',
  });

  if (user.role === ROLES.ADMIN) {
    const userDoc = await User.findById(user._id);
    if (!userDoc) throw AppError.notFound('Không tìm thấy tài khoản quản trị');
    const previous = userDoc.avatar?.publicId;
    userDoc.avatar = uploaded;
    await userDoc.save();
    if (previous && previous !== uploaded.publicId) {
      await filesService.destroy(previous, { resourceType: 'image' }).catch(() => {});
    }
    return { avatar: uploaded, user: userDoc.toPublic() };
  }

  // Teacher or Student: route through admin approval process
  const { analyzeAvatarImage } = await import('../ai/avatarVision.service.js');
  const analysis = await analyzeAvatarImage({
    buffer: file.buffer,
    mimetype: file.mimetype,
    originalname: file.originalname,
    publicId: uploaded.publicId,
    url: uploaded.url,
  });

  uploaded.originalName = file.originalname;
  uploaded.analysis = analysis;

  const { createRequest } = await import('../profileRequests/profileRequest.service.js');
  const request = await createRequest(user, {
    type: 'avatar',
    requestedData: { avatar: uploaded },
  });

  if (request.status === 'approved') {
    return {
      pending: false,
      autoApproved: true,
      message: 'EduMin AI đã tự động phê duyệt ảnh đại diện theo tiêu chí của Quản trị viên!',
      avatar: uploaded,
      request,
    };
  }

  const failNote = request.adminNote ? ` (${request.adminNote.replace(/^\[.*?\]\s*/, '')})` : '';
  return {
    pending: true,
    message: `Yêu cầu thay đổi ảnh đại diện đã được ghi nhận và gửi đến Quản trị viên xem xét${failNote}.`,
    avatar: uploaded,
    request,
  };
}

/** Submit a profile information update request (self-service for teacher/student). */
export async function requestProfileUpdate(user, updateData) {
  if (user.role === ROLES.ADMIN) {
    const userDoc = await User.findById(user._id);
    if (!userDoc) throw AppError.notFound('Không tìm thấy tài khoản quản trị');
    if (updateData.hoTen) userDoc.hoTen = updateData.hoTen;
    await userDoc.save();
    return { user: userDoc.toPublic() };
  }

  const { createRequest } = await import('../profileRequests/profileRequest.service.js');
  const request = await createRequest(user, {
    type: 'profile',
    requestedData: updateData,
  });

  if (request.status === 'approved') {
    return {
      pending: false,
      autoApproved: true,
      message: 'EduMin AI đã tự động phê duyệt yêu cầu thay đổi thông tin theo tiêu chí của Quản trị viên!',
      request,
    };
  }

  return {
    pending: true,
    message: 'Yêu cầu cập nhật thông tin cá nhân đã được gửi đến Quản trị viên để phê duyệt',
    request,
  };
}

/** Change own password after verifying the old one; revokes old tokens. */
export async function changeOwnPassword(userId, { oldPassword, newPassword }) {
  const user = await User.findById(userId).select('+passwordHash +password');
  if (!user) throw AppError.notFound('Không tìm thấy tài khoản');

  let ok = false;
  if (user.passwordHash) {
    ok = await comparePassword(oldPassword, user.passwordHash);
  }
  if (!ok && user.password) {
    ok = String(user.password) === String(oldPassword);
  }
  if (!ok) throw AppError.badRequest('Mật khẩu cũ không chính xác');

  if (user.passwordHash && (await comparePassword(newPassword, user.passwordHash))) {
    throw AppError.badRequest('Mật khẩu mới không được trùng mật khẩu cũ');
  }
  if (user.password && String(user.password) === String(newPassword)) {
    throw AppError.badRequest('Mật khẩu mới không được trùng mật khẩu cũ');
  }

  // Mã hóa mật khẩu mới bằng bcrypt trước khi lưu vào Database
  user.passwordHash = await hashPassword(newPassword);
  user.set('password', undefined);
  user.tokenVersion = (user.tokenVersion ?? 0) + 1;
  await user.save();

  return {
    message: 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại bằng mật khẩu mới.',
    token: signToken(user),
  };
}
