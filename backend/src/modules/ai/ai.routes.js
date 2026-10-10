import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { handleAiAssistantQuery } from './ai.service.js';
import { ROLES } from '../../lib/roles.js';

const router = Router();

// POST /api/ai/query
router.post('/query', authenticate, async (req, res, next) => {
  try {
    const { message, currentPath } = req.body;
    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: 'Nội dung câu hỏi không được để trống' });
    }

    const result = await handleAiAssistantQuery({
      message: String(message).trim(),
      user: req.user,
      currentPath: currentPath || '',
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/ai/suggestions
router.get('/suggestions', authenticate, (req, res) => {
  const role = req.user?.role;
  let suggestions = [];

  if (role === ROLES.TEACHER || role === 'teacher' || role === 'giao-vien') {
    suggestions = [
      'Lịch dạy của tôi tuần này',
      'Làm sao để cấu hình điểm giữa kỳ?',
      'Danh sách lớp tôi phụ trách',
      'Xem phản hồi từ sinh viên',
      'Điểm danh sinh viên ở đâu?',
    ];
  } else if (role === ROLES.STUDENT || role === 'student' || role === 'sinh-vien') {
    suggestions = [
      'Thời khóa biểu của tôi',
      'Đăng ký học phần ở đâu?',
      'Xem điểm danh & chuyên cần',
      'Xem bài tập & làm quiz',
      'Tải tài liệu học tập ở đâu?',
    ];
  } else {
    suggestions = [
      'Thống kê hệ thống',
      'Có bao nhiêu yêu cầu duyệt hồ sơ?',
      'Quản lý tài khoản giảng viên',
      'Quản lý lớp học phần',
      'Tìm kiếm sinh viên',
    ];
  }

  res.json({
    success: true,
    suggestions,
  });
});

export default router;

