import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import {
  getChannelsForUser,
  getContactsForUser,
  getMessages,
  sendMessage,
} from './chat.service.js';

const router = Router();

// GET /api/chat/channels - Lấy danh sách nhóm lớp học phần và cuộc trò chuyện cá nhân
router.get(
  '/channels',
  authenticate,
  asyncHandler(async (req, res) => {
    const data = await getChannelsForUser(req.user);
    res.json({
      success: true,
      ...data,
    });
  })
);

// GET /api/chat/contacts - Lấy danh bạ người dùng có thể nhắn tin trực tiếp
router.get(
  '/contacts',
  authenticate,
  asyncHandler(async (req, res) => {
    const contacts = await getContactsForUser(req.user, req.query.search);
    res.json({
      success: true,
      data: contacts,
    });
  })
);

// GET /api/chat/messages - Lấy lịch sử tin nhắn trong nhóm lớp hoặc cá nhân 1-1
router.get(
  '/messages',
  authenticate,
  asyncHandler(async (req, res) => {
    const { type, classId, recipientId, limit } = req.query;
    const result = await getMessages(req.user, {
      type,
      classId,
      recipientId,
      limit,
    });
    res.json({
      success: true,
      data: result,
    });
  })
);

// POST /api/chat/messages - Gửi tin nhắn mới vào nhóm lớp hoặc cá nhân
router.post(
  '/messages',
  authenticate,
  asyncHandler(async (req, res) => {
    const { type, classId, recipientId, content } = req.body;
    const message = await sendMessage(req.user, {
      type,
      classId,
      recipientId,
      content,
    });
    res.status(201).json({
      success: true,
      message,
    });
  })
);

export default router;

