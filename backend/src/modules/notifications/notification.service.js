import { AppError } from '../../lib/AppError.js';
import { parseListQuery, paginate } from '../../lib/pagination.js';
import { Notification } from './notification.model.js';

export async function createNotification(payload) {
  const notif = await Notification.create({
    recipientUser: payload.recipientUser || null,
    recipientRole: payload.recipientRole,
    type: payload.type || 'system',
    title: payload.title,
    message: payload.message,
    link: payload.link || '',
    metadata: payload.metadata || {},
  });
  return notif;
}

export async function listMyNotifications(user, query = {}) {
  const { page, limit, skip, sort } = parseListQuery(query, { defaultSort: '-createdAt' });
  const filter = {
    $or: [
      { recipientUser: user._id },
      { recipientRole: user.role, recipientUser: null },
    ],
  };

  if (query.unreadOnly === 'true' || query.unreadOnly === true) {
    filter.isRead = false;
  }

  const result = await paginate(Notification, { filter, page, limit, skip, sort: { createdAt: -1 } });
  const unreadCount = await Notification.countDocuments({
    ...filter,
    isRead: false,
  });

  return { ...result, unreadCount };
}

export async function markNotificationRead(id, user) {
  const notif = await Notification.findOneAndUpdate(
    {
      _id: id,
      $or: [{ recipientUser: user._id }, { recipientRole: user.role, recipientUser: null }],
    },
    { isRead: true },
    { new: true }
  );
  if (!notif) throw AppError.notFound('Không tìm thấy thông báo');
  return notif;
}

export async function markAllMyNotificationsRead(user) {
  await Notification.updateMany(
    {
      $or: [{ recipientUser: user._id }, { recipientRole: user.role, recipientUser: null }],
      isRead: false,
    },
    { isRead: true }
  );
  return { success: true };
}

export async function deleteNotification(id, user) {
  const res = await Notification.findOneAndDelete({
    _id: id,
    $or: [{ recipientUser: user._id }, { recipientRole: user.role, recipientUser: null }],
  });
  if (!res) throw AppError.notFound('Không tìm thấy thông báo');
  return { success: true };
}

export async function bulkDeleteNotifications(ids, user) {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw AppError.badRequest('Danh sách mã thông báo không hợp lệ');
  }
  const result = await Notification.deleteMany({
    _id: { $in: ids },
    $or: [{ recipientUser: user._id }, { recipientRole: user.role, recipientUser: null }],
  });
  return { deletedCount: result.deletedCount };
}

