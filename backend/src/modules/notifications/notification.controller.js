import { asyncHandler } from '../../lib/asyncHandler.js';
import * as notificationService from './notification.service.js';

export const list = asyncHandler(async (req, res) => {
  res.json(await notificationService.listMyNotifications(req.user, req.query));
});

export const markRead = asyncHandler(async (req, res) => {
  res.json(await notificationService.markNotificationRead(req.params.id, req.user));
});

export const markAllRead = asyncHandler(async (req, res) => {
  res.json(await notificationService.markAllMyNotificationsRead(req.user));
});

export const remove = asyncHandler(async (req, res) => {
  res.json(await notificationService.deleteNotification(req.params.id, req.user));
});

export const bulkDelete = asyncHandler(async (req, res) => {
  res.json(await notificationService.bulkDeleteNotifications(req.body.ids, req.user));
});

