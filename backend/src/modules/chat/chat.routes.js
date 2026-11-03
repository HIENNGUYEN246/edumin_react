import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../../middleware/authenticate.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import {
  getChannelsForUser,
  getContactsForUser,
  getMessages,
  sendMessage,
  uploadChatAttachment,
} from './chat.service.js';

const router = Router();

const chatUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max
});

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

// POST /api/chat/upload - Tải lên tệp đính kèm (Hình ảnh, Tài liệu, Tin nhắn thoại)
router.post(
  '/upload',
  authenticate,
  chatUpload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn tệp để tải lên' });
    }
    const uploaded = await uploadChatAttachment(req.file, req.body.duration);
    res.json({
      success: true,
      file: uploaded,
    });
  })
);

// POST /api/chat/messages - Gửi tin nhắn mới vào nhóm lớp hoặc cá nhân
router.post(
  '/messages',
  authenticate,
  asyncHandler(async (req, res) => {
    const { type, classId, recipientId, content, attachments, mentions } = req.body;
    const message = await sendMessage(req.user, {
      type,
      classId,
      recipientId,
      content,
      attachments,
      mentions,
    });
    res.status(201).json({
      success: true,
      message,
    });
  })
);

export default router;

