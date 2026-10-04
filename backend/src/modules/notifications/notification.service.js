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

function getRoleFilters(role) {
  const roles = [role];
  if (role === 'dao-tao') roles.push('admin');
  if (role === 'admin') roles.push('dao-tao');
  return roles;
}

function buildRecipientFilter(user) {
  const roles = getRoleFilters(user.role);
  return {
    $or: [
      { recipientUser: user._id },
      { recipientRole: { $in: roles }, recipientUser: null },
      { recipientRole: { $in: roles }, recipientUser: { $exists: false } },
    ],
  };
}

export async function listMyNotifications(user, query = {}) {
  const { page, limit, skip, sort } = parseListQuery(query, { defaultSort: '-createdAt' });
  const filter = buildRecipientFilter(user);

  if (query.unreadOnly === 'true' || query.unreadOnly === true) {
    filter.isRead = false;
  }

  const result = await paginate(Notification, { filter, page, limit, skip, sort: { createdAt: -1 } });
  const unreadCount = await Notification.countDocuments({
    ...filter,
    isRead: false,
  });

  return { ...result, items: result.data, unreadCount };
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

