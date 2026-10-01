import mongoose from 'mongoose';
import { AppError } from '../../lib/AppError.js';
import { parseListQuery, paginate, searchFilter } from '../../lib/pagination.js';
import { ROLES } from '../../lib/roles.js';
import { User } from '../auth/user.model.js';
import { ProfileRequest } from './profileRequest.model.js';
import { createNotification } from '../notifications/notification.service.js';

export async function createRequest(user, { type = 'avatar', requestedData = {} }) {
  const modelName =
    user.role === ROLES.TEACHER ? 'Teacher' : user.role === ROLES.STUDENT ? 'Student' : null;
  if (!modelName) throw AppError.badRequest('Vai trò không hỗ trợ gửi yêu cầu');

  const Model = mongoose.model(modelName);
  const profileId = user.role === ROLES.TEACHER ? user.teacher : user.student;
  let profile = profileId ? await Model.findById(profileId) : null;
  if (!profile && user._id) {
    profile = await Model.findOne({ userId: user._id });
  }
  if (!profile) throw AppError.notFound('Không tìm thấy hồ sơ người dùng');

  const currentData = {
    avatar: profile.avatar || null,
    hoTen: profile.hoTen || '',
    phone: profile.phone || '',
    address: profile.address || '',
    dob: profile.dob || '',
    gender: profile.gender || '',
    education: profile.education || '',
  };

  const reqDoc = await ProfileRequest.create({
    userId: user._id,
    targetModel: modelName,
    targetId: profile._id,
    requesterRole: user.role,
    requesterName: profile.hoTen || user.hoTen || '',
    requesterEmail: user.email || '',
    requesterCode: profile.id || '',
    type,
    status: 'pending',
    currentData,
    requestedData,
  });

  // Notify admin
  const roleName = user.role === ROLES.TEACHER ? 'Giảng viên' : 'Sinh viên';
  const actionName = type === 'avatar' ? 'ảnh đại diện' : type === 'profile' ? 'thông tin cá nhân' : 'thông tin và ảnh đại diện';
  await createNotification({
    recipientRole: ROLES.ADMIN,
    type: 'approval',
    title: 'Yêu cầu duyệt thông tin mới',
    message: `${roleName} ${profile.hoTen || user.email} vừa gửi yêu cầu đổi ${actionName}.`,
    link: '/admin/profile-requests',
    metadata: { requestId: reqDoc._id },
  }).catch(() => {});

  return reqDoc;
}

export async function listRequests(query = {}) {
  const { page, limit, skip, sort, search } = parseListQuery(query, { defaultSort: '-createdAt' });
  const filter = { ...searchFilter(search, ['requesterName', 'requesterEmail', 'requesterCode']) };

  if (query.status) {
    filter.status = query.status;
  }
  if (query.requesterRole) {
    filter.requesterRole = query.requesterRole;
  }
  if (query.type) {
    filter.type = query.type;
  }

  const result = await paginate(ProfileRequest, {
    filter,
    page,
    limit,
    skip,
    sort: { createdAt: -1 },
  });

  const pendingCount = await ProfileRequest.countDocuments({ status: 'pending' });
  return { ...result, pendingCount };
}

export async function getMyLatestRequest(user) {
  const req = await ProfileRequest.findOne({ userId: user._id }).sort({ createdAt: -1 });
  return req;
}

export async function approveOne(id, adminUser) {
  const request = await ProfileRequest.findById(id);
  if (!request) throw AppError.notFound('Không tìm thấy yêu cầu');
  if (request.status !== 'pending') {
    throw AppError.badRequest('Yêu cầu này đã được xử lý trước đó');
  }

  const Model = mongoose.model(request.targetModel);
  const profile = await Model.findById(request.targetId);
  if (!profile) throw AppError.notFound('Hồ sơ người dùng không còn tồn tại');

  const { avatar, hoTen, phone, address, dob, gender, education } = request.requestedData || {};

  if (avatar) {
    profile.avatar = avatar;
    await User.updateOne({ _id: request.userId }, { $set: { avatar } }).catch(() => {});
  }
  if (hoTen) {
    profile.hoTen = hoTen;
    await User.updateOne({ _id: request.userId }, { $set: { hoTen } }).catch(() => {});
  }
  if (phone !== undefined) profile.phone = phone;
  if (address !== undefined) profile.address = address;
  if (dob !== undefined) profile.dob = dob;
  if (gender !== undefined) profile.gender = gender;
  if (education !== undefined) profile.education = education;

  await profile.save();

  request.status = 'approved';
  request.reviewedBy = adminUser._id;
  request.reviewedAt = new Date();
  await request.save();

  // Notify user
  await createNotification({
    recipientUser: request.userId,
    recipientRole: request.requesterRole,
    type: 'approval',
    title: 'Yêu cầu thay đổi đã được phê duyệt',
    message: `Quản trị viên đã phê duyệt thay đổi ${request.type === 'avatar' ? 'ảnh đại diện' : 'thông tin'} của bạn.`,
    link: request.requesterRole === ROLES.STUDENT ? '/student' : '/teacher',
    metadata: { requestId: request._id },
  }).catch(() => {});

  return request;
}

export async function rejectOne(id, adminUser, reason = '') {
  const request = await ProfileRequest.findById(id);
  if (!request) throw AppError.notFound('Không tìm thấy yêu cầu');
  if (request.status !== 'pending') {
    throw AppError.badRequest('Yêu cầu này đã được xử lý trước đó');
  }

  request.status = 'rejected';
  request.adminNote = reason || '';
  request.reviewedBy = adminUser._id;
  request.reviewedAt = new Date();
  await request.save();

  // Notify user
  await createNotification({
    recipientUser: request.userId,
    recipientRole: request.requesterRole,
    type: 'approval',
    title: 'Yêu cầu thay đổi bị từ chối',
    message: `Quản trị viên đã từ chối yêu cầu thay đổi của bạn.${reason ? ` Lý do: ${reason}` : ''}`,
    link: request.requesterRole === ROLES.STUDENT ? '/student' : '/teacher',
    metadata: { requestId: request._id },
  }).catch(() => {});

  return request;
}

export async function bulkApprove(ids, adminUser) {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw AppError.badRequest('Danh sách mã yêu cầu không hợp lệ');
  }
  let approvedCount = 0;
  for (const id of ids) {
    try {
      await approveOne(id, adminUser);
      approvedCount += 1;
    } catch {
      // Continue next
    }
  }
  return { approvedCount };
}

export async function bulkReject(ids, adminUser, reason = '') {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw AppError.badRequest('Danh sách mã yêu cầu không hợp lệ');
  }
  let rejectedCount = 0;
  for (const id of ids) {
    try {
      await rejectOne(id, adminUser, reason);
      rejectedCount += 1;
    } catch {
      // Continue next
    }
  }
  return { rejectedCount };
}

export async function bulkDelete(ids) {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw AppError.badRequest('Danh sách mã yêu cầu không hợp lệ');
  }
  const result = await ProfileRequest.deleteMany({ _id: { $in: ids } });
  return { deletedCount: result.deletedCount };
}

