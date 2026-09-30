import { Router } from 'express';
import { Feedback } from './feedback.model.js';
import { Student } from '../students/student.model.js';
import { Teacher } from '../teachers/teacher.model.js';
import { Course } from '../courses/course.model.js';

const router = Router();

const parseTeacherId = (val) => {
  if (val === null || val === undefined || val === '') return null;
  const num = Number(val);
  if (!Number.isNaN(num)) return num;
  return String(val);
};

// GET /api/feedbacks
router.get('/', async (req, res, next) => {
  try {
    const { teacherId, studentId, courseId, rating } = req.query;
    const filter = {};
    if (teacherId) {
      const parsedTeacherId = parseTeacherId(teacherId);
      filter.$or = [{ teacherId: parsedTeacherId }, { teacherId: String(teacherId) }];
    }
    if (studentId) filter.studentId = Number(studentId);
    if (courseId) filter.courseId = String(courseId);
    if (rating) filter.rating = Number(rating);

    const list = await Feedback.find(filter)
      .populate('studentRef', 'id hoTen name email avatar')
      .populate('teacherRef', 'id hoTen name email avatar')
      .sort({ createdAt: -1 })
      .lean();

    const formatted = list.map((item) => {
      const sAvatar =
        item.studentAvatar ||
        (typeof item.studentRef?.avatar === 'string' ? item.studentRef?.avatar : item.studentRef?.avatar?.url) ||
        '';
      return {
        ...item,
        studentAvatar: sAvatar,
      };
    });

    res.json(formatted);
  } catch (error) {
    next(error);
  }
});

// POST /api/feedbacks (Student sends feedback)
router.post('/', async (req, res, next) => {
  try {
    const {
      studentId,
      studentName,
      studentEmail,
      studentAvatar,
      teacherId,
      teacherName,
      courseId,
      courseName,
      regId,
      rating = 5,
      courseQuality = 'Tốt',
      feedbackText,
      isAnonymous = false,
    } = req.body;

    if (!studentId || !feedbackText) {
      return res.status(400).json({ error: 'Thiếu thông tin đánh giá (studentId, feedbackText)' });
    }

    const numericStudentId = Number(studentId);
    const parsedTeacherId = parseTeacherId(teacherId);

    const [student, teacher] = await Promise.all([
      Student.findOne({ $or: [{ id: numericStudentId }, { email: studentEmail }] }),
      parsedTeacherId ? Teacher.findOne({ $or: [{ id: parsedTeacherId }, { _id: String(teacherId).match(/^[0-9a-fA-F]{24}$/) ? teacherId : null }] }) : null,
    ]);

    const sAvatar =
      studentAvatar ||
      (typeof student?.avatar === 'string' ? student?.avatar : student?.avatar?.url) ||
      '';

    const id = `FB_${Date.now()}_${numericStudentId}`;
    const newFeedback = await Feedback.create({
      id,
      studentId: numericStudentId,
      studentRef: student ? student._id : null,
      studentName: studentName || student?.hoTen || 'Sinh viên',
      studentEmail: studentEmail || student?.email || '',
      studentAvatar: sAvatar,
      teacherId: parsedTeacherId,
      teacherRef: teacher ? teacher._id : null,
      teacherName: teacherName || teacher?.hoTen || '',
      courseId: courseId || '',
      courseName: courseName || '',
      regId: regId || '',
      rating: Number(rating) || 5,
      courseQuality: courseQuality || 'Tốt',
      feedbackText: feedbackText.trim(),
      isAnonymous: Boolean(isAnonymous),
      timestamp: Date.now(),
    });

    res.status(201).json({ success: true, message: 'Gửi phản hồi thành công!', feedback: newFeedback });
  } catch (error) {
    next(error);
  }
});

// POST /api/feedbacks/:id/reply (Teacher/Admin reply)
router.post('/:id/reply', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { response } = req.body;

    if (!response || !response.trim()) {
      return res.status(400).json({ error: 'Nội dung phản hồi không được để trống' });
    }

    let fb = null;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      fb = await Feedback.findById(id);
    }
    if (!fb) {
      fb = await Feedback.findOne({ id });
    }
    if (!fb) {
      return res.status(404).json({ error: 'Không tìm thấy phản hồi' });
    }

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const respondedAt = `${pad(now.getHours())}:${pad(now.getMinutes())} ${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;

    fb.response = response.trim();
    fb.respondedAt = respondedAt;
    await fb.save();

    res.json({ success: true, message: 'Đã gửi phản hồi thành công!', feedback: fb });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/feedbacks/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    let deleted = null;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      deleted = await Feedback.findByIdAndDelete(id);
    }
    if (!deleted) {
      deleted = await Feedback.findOneAndDelete({ id });
    }
    res.json({ success: true, message: 'Đã xóa phản hồi', deleted });
  } catch (error) {
    next(error);
  }
});

export default router;

