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
    return {
      success: true,
      status: 'approved',
      approved: true,
      message: 'Cập nhật ảnh đại diện thành công',
      avatar: uploaded,
      user: userDoc.toPublic(),
    };
  }

  // Teacher or Student: route through admin approval process with deterministic moderation
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

  const { getAdminCriteria } = await import('../ai/adminCriteria.store.js');
  const adminCriteria = await getAdminCriteria().catch(() => null);
  const rules = adminCriteria?.rules;

  if (rules?.noAvatar) {
    const { createRequest } = await import('../profileRequests/profileRequest.service.js');
    const request = await createRequest(user, {
      type: 'avatar',
      requestedData: { avatar: uploaded },
    });
    return {
      success: false,
      status: 'rejected',
      approved: false,
      isValid: false,
      count: analysis?.count ?? 0,
      personCount: analysis?.personCount ?? 0,
      pending: true,
      autoApproved: false,
      message: 'Chính sách tạm dừng đổi avatar: Quản trị viên đang tạm khóa tính năng đổi ảnh đại diện.',
      reason: 'Chính sách tạm dừng đổi avatar',
      avatar: uploaded,
      request,
    };
  }

  const { createRequest } = await import('../profileRequests/profileRequest.service.js');
  const request = await createRequest(user, {
    type: 'avatar',
    requestedData: { avatar: uploaded },
  });

  // DETERMINISTIC ZERO-TOLERANCE MODERATION:
  // Điều kiện ĐẠT (approved: true): count === 1 VÀ approved === true VÀ isValid === true
  const isCountOne = (analysis?.count === 1 || analysis?.personCount === 1);
  const isApprovedByVision = isCountOne && analysis?.approved === true && analysis?.isValid === true;

  if (isApprovedByVision) {
    const isAutoApproved = request.status === 'approved';

    if (isAutoApproved) {
      const userDoc = await User.findById(user._id);
      if (userDoc) {
        userDoc.avatar = uploaded;
        await userDoc.save();
      }
      const ProfileModel =
        user.role === ROLES.TEACHER
          ? (await import('../teachers/teacher.model.js')).Teacher
          : (await import('../students/student.model.js')).Student;
      if (ProfileModel) {
        await ProfileModel.updateOne({ userId: user._id }, { $set: { avatar: uploaded } });
      }

      return {
        success: true,
        status: 'approved',
        approved: true,
        isValid: true,
        count: 1,
        personCount: 1,
        pending: false,
        autoApproved: true,
        message: 'EduMin AI đã tự động phê duyệt ảnh đại diện theo tiêu chí của Quản trị viên!',
        avatar: uploaded,
        request,
        user: userDoc?.toPublic(),
      };
    }

    // Valid 1-person portrait awaiting manual Admin approval (when auto-approval criteria not active)
    return {
      success: true,
      status: 'approved',
      approved: true,
      isValid: true,
      count: 1,
      personCount: 1,
      pending: true,
      autoApproved: false,
      message: 'Ảnh hợp lệ (có đúng 1 người). Yêu cầu thay đổi ảnh đại diện đã được gửi đến Quản trị viên để phê duyệt.',
      avatar: uploaded,
      request,
    };
  } else {
    // Điều kiện TỪ CHỐI (approved: false): count === 0, count > 1, hoặc hình ảnh chứa text, phong cảnh, vật thể
    const rawFailReason =
      analysis?.rejectReason ||
      analysis?.reason ||
      analysis?.message ||
      'Ảnh không hợp lệ: Yêu cầu bắt buộc phải có đúng 1 người trong khung hình!';

    const formattedFail = rawFailReason.includes('Ảnh không hợp lệ')
      ? rawFailReason
      : `Ảnh không hợp lệ: Yêu cầu bắt buộc phải có đúng 1 người trong khung hình! (${rawFailReason})`;

    request.status = 'pending';
    if (!request.adminNote) {
      request.adminNote = `[EduMin AI Giữ lại bên phần Duyệt] Chưa đạt tiêu chí: ${formattedFail}`;
      await request.save().catch(() => {});
    }

    return {
      success: false,
      status: 'rejected',
      approved: false,
      isValid: false,
      count: analysis?.count ?? 0,
      personCount: analysis?.personCount ?? 0,
      pending: true,
      autoApproved: false,
      message: formattedFail,
      reason: formattedFail,
      avatar: uploaded,
      request,
    };
  }
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
