import mongoose from 'mongoose';
import { AppError } from '../../lib/AppError.js';
import { parseListQuery, paginate } from '../../lib/pagination.js';
import { Notification } from './notification.model.js';
import { CourseClass } from '../classes/courseClass.model.js';
import { Enrollment } from '../enrollments/enrollment.model.js';
import { Student } from '../students/student.model.js';
import { Teacher } from '../teachers/teacher.model.js';
import { User } from '../auth/user.model.js';

export async function createNotification(payload) {
  const notif = await Notification.create({
    senderId: payload.senderId || null,
    senderRole: payload.senderRole || '',
    senderName: payload.senderName || '',
    recipientUser: payload.recipientUser || null,
    recipientRole: payload.recipientRole || 'all',
    targetType: payload.targetType || 'role',
    targetIds: payload.targetIds || [],
    targetClassId: payload.targetClassId || '',
    type: payload.type || 'system',
    title: payload.title,
    message: payload.message,
    link: payload.link || '',
    isRead: false,
    metadata: payload.metadata || {},
  });
  return notif;
}

function getRoleFilters(role) {
  const roles = [role, 'all'];
  if (role === 'dao-tao') roles.push('admin');
  if (role === 'admin') roles.push('dao-tao');
  return roles;
}

function buildRecipientFilter(user, query = {}) {
  const roles = getRoleFilters(user.role);
  const filter = {
    $or: [
      { recipientUser: user._id },
      { recipientRole: { $in: roles }, recipientUser: null },
      { recipientRole: { $in: roles }, recipientUser: { $exists: false } },
      { targetType: 'all' },
    ],
  };

  if (query.classId) {
    filter.targetClassId = query.classId;
  }
  if (query.type) {
    filter.type = query.type;
  }
  if (query.unreadOnly === 'true' || query.unreadOnly === true) {
    filter.isRead = false;
  }

  return filter;
}

export async function listMyNotifications(user, query = {}) {
  const { page, limit, skip } = parseListQuery(query, { defaultSort: '-createdAt' });
  const filter = buildRecipientFilter(user, query);

  const result = await paginate(Notification, { filter, page, limit, skip, sort: { createdAt: -1 } });
  const unreadCount = await Notification.countDocuments({
    ...filter,
    isRead: false,
  });

  return { ...result, items: result.data, unreadCount };
}

/**
 * Creates targeted schedule change or announcement notifications.
 * Supports:
 * - targetType: 'class': resolves all enrolled students and assigned teacher.
 * - targetType: 'individual': resolves targeted student/teacher/user IDs.
 * - targetType: 'department': resolves students and teachers in given department.
 * - targetType: 'all': creates broadcast notification for everyone.
 */
export async function createTargetedNotification(payload, senderUser) {
  const {
    targetType = 'class',
    targetIds = [],
    targetClassId = '',
    title,
    message,
    metadata = {},
    type = 'schedule_change',
    link,
  } = payload;

  if (!title || !message) {
    throw AppError.badRequest('Tiêu đề và nội dung thông báo là bắt buộc');
  }

  const senderId = senderUser?._id || null;
  const senderRole = senderUser?.role || 'dao-tao';
  const senderName = senderUser?.hoTen || senderUser?.username || 'Hệ thống';

  let recipientUserIds = new Set();
  let resolvedClassId = targetClassId;

  if (targetType === 'class') {
    const classCode = targetClassId || (Array.isArray(targetIds) && targetIds.length > 0 ? targetIds[0] : '');
    resolvedClassId = classCode;

    if (!classCode) {
      throw AppError.badRequest('Vui lòng chọn lớp học phần nhận thông báo');
    }

    const courseClass = await CourseClass.findOne({
      $or: [
        { id: classCode },
        ...(mongoose.isValidObjectId(classCode) ? [{ _id: classCode }] : []),
      ],
    });

    if (courseClass) {
      resolvedClassId = courseClass.id;
      // 1. Find all enrolled students
      const enrollments = await Enrollment.find({
        $or: [{ classRef: courseClass._id }, { classId: courseClass.id }],
      }).populate('student');

      for (const enr of enrollments) {
        if (enr.student?.userId) {
          recipientUserIds.add(String(enr.student.userId));
        }
      }

      // 2. Add teacher if assigned and not the sender
      if (courseClass.teacherRef) {
        const teacher = await Teacher.findById(courseClass.teacherRef);
        if (teacher?.userId && String(teacher.userId) !== String(senderId)) {
          recipientUserIds.add(String(teacher.userId));
        }
      }
    }
  } else if (targetType === 'individual') {
    if (!Array.isArray(targetIds) || targetIds.length === 0) {
      throw AppError.badRequest('Vui lòng chọn ít nhất một người nhận cụ thể');
    }

    for (const rawId of targetIds) {
      if (!rawId) continue;
      // Direct User ObjectId
      if (mongoose.isValidObjectId(rawId)) {
        const directUser = await User.findById(rawId);
        if (directUser) {
          recipientUserIds.add(String(directUser._id));
          continue;
        }
      }

      // Student search by numeric ID or email
      const numId = Number(rawId);
      const student = await Student.findOne({
        $or: [
          ...(isNaN(numId) ? [] : [{ id: numId }]),
          { email: rawId.toString().toLowerCase() },
          ...(mongoose.isValidObjectId(rawId) ? [{ _id: rawId }] : []),
        ],
      });
      if (student?.userId) {
        recipientUserIds.add(String(student.userId));
        continue;
      }

      // Teacher search by numeric ID or email
      const teacher = await Teacher.findOne({
        $or: [
          ...(isNaN(numId) ? [] : [{ id: numId }]),
          { email: rawId.toString().toLowerCase() },
          ...(mongoose.isValidObjectId(rawId) ? [{ _id: rawId }] : []),
        ],
      });
      if (teacher?.userId) {
        recipientUserIds.add(String(teacher.userId));
      }
    }
  } else if (targetType === 'department') {
    const departments = Array.isArray(targetIds) ? targetIds : [targetIds];
    const students = await Student.find({ department: { $in: departments } });
    for (const s of students) {
      if (s.userId) recipientUserIds.add(String(s.userId));
    }
    const teachers = await Teacher.find({ department: { $in: departments } });
    for (const t of teachers) {
      if (t.userId && String(t.userId) !== String(senderId)) {
        recipientUserIds.add(String(t.userId));
      }
    }
  }

  const defaultLink = link || (targetType === 'class' ? '/student/timetable' : '/student');
  const enrichedMetadata = {
    ...metadata,
    classCode: resolvedClassId || metadata.classCode || '',
    senderName,
    createdAt: new Date().toISOString(),
  };

  const createdNotifications = [];

  // Create notifications for each targeted user
  if (recipientUserIds.size > 0) {
    const docs = Array.from(recipientUserIds).map((uid) => ({
      senderId,
      senderRole,
      senderName,
      recipientUser: uid,
      recipientRole: 'all',
      targetType,
      targetIds: Array.isArray(targetIds) ? targetIds : [targetIds],
      targetClassId: resolvedClassId,
      type,
      title,
      message,
      link: defaultLink,
      isRead: false,
      metadata: enrichedMetadata,
    }));

    const inserted = await Notification.insertMany(docs);
    createdNotifications.push(...inserted);
  }

  // Also create a master record representing the broadcast announcement (for class archive / sender audit)
  const masterRecord = await Notification.create({
    senderId,
    senderRole,
    senderName,
    recipientUser: recipientUserIds.size === 0 ? null : undefined,
    recipientRole: targetType === 'all' ? 'all' : (recipientUserIds.size === 0 ? 'all' : 'dao-tao'),
    targetType,
    targetIds: Array.isArray(targetIds) ? targetIds : [targetIds],
    targetClassId: resolvedClassId,
    type,
    title,
    message,
    link: defaultLink,
    isRead: false,
    metadata: enrichedMetadata,
  });
  createdNotifications.push(masterRecord);

  return {
    success: true,
    recipientCount: recipientUserIds.size,
    targetType,
    targetClassId: resolvedClassId,
    notifications: createdNotifications,
  };
}

export async function markNotificationRead(id, user) {
  const recipientFilter = buildRecipientFilter(user);
  const notif = await Notification.findOneAndUpdate(
    {
      _id: id,
      ...recipientFilter,
    },
    { isRead: true },
    { new: true }
  );
  if (!notif) throw AppError.notFound('Không tìm thấy thông báo');
  return notif;
}

export async function markAllMyNotificationsRead(user) {
  const recipientFilter = buildRecipientFilter(user);
  await Notification.updateMany(
    {
      ...recipientFilter,
      isRead: false,
    },
    { isRead: true }
  );
  return { success: true };
}

export async function deleteNotification(id, user) {
  const recipientFilter = buildRecipientFilter(user);
  const res = await Notification.findOneAndDelete({
    _id: id,
    ...recipientFilter,
  });
  if (!res) throw AppError.notFound('Không tìm thấy thông báo');
  return { success: true };
}

export async function bulkDeleteNotifications(ids, user) {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw AppError.badRequest('Danh sách mã thông báo không hợp lệ');
  }
  const recipientFilter = buildRecipientFilter(user);
  const result = await Notification.deleteMany({
    _id: { $in: ids },
    ...recipientFilter,
  });
  return { deletedCount: result.deletedCount };
}
