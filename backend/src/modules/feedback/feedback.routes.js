import { Router } from 'express';
import { Feedback } from './feedback.model.js';
import { Student } from '../students/student.model.js';
import { Teacher } from '../teachers/teacher.model.js';
import { CourseClass } from '../classes/courseClass.model.js';

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
    const { teacherId, studentId, courseId, rating, regId } = req.query;
    const filter = {};
    if (teacherId) {
      const parsedTeacherId = parseTeacherId(teacherId);
      const teacherOr = [{ teacherId: parsedTeacherId }, { teacherId: String(teacherId) }];
      if (String(teacherId).match(/^[0-9a-fA-F]{24}$/)) {
        teacherOr.push({ teacherRef: teacherId });
      }
      filter.$or = teacherOr;
    }
    if (studentId) {
      if (String(studentId).match(/^[0-9a-fA-F]{24}$/)) {
        filter.$or = [{ studentRef: studentId }, { studentId: Number(studentId) || 0 }];
      } else {
        filter.studentId = Number(studentId);
      }
    }
    if (courseId) filter.courseId = String(courseId);
    if (regId) filter.regId = String(regId);
    if (rating) filter.rating = Number(rating);

    const list = await Feedback.find(filter)
      .populate('studentRef', 'id hoTen name email avatar className department')
      .populate('teacherRef', 'id hoTen name email avatar department')
      .sort({ createdAt: -1 })
      .lean();

    const formatted = list.map((item) => {
      const student = item.studentRef;
      const teacher = item.teacherRef;

      // Always resolve actual database properties
      const sName = student?.hoTen || student?.name || item.studentName || 'Sinh viên';
      const sEmail = student?.email || item.studentEmail || '';
      const sCode = student?.id != null ? student.id : item.studentId;
      const sClass = student?.className || '';
      const sAvatar =
        (typeof student?.avatar === 'string' ? student.avatar : student?.avatar?.url) ||
        item.studentAvatar ||
        '';

      const tName = teacher?.hoTen || teacher?.name || item.teacherName || 'Giảng viên';
      const tCode = teacher?.id != null ? teacher.id : item.teacherId;
      const tAvatar =
        (typeof teacher?.avatar === 'string' ? teacher.avatar : teacher?.avatar?.url) ||
        '';

      const pad = (n) => String(n).padStart(2, '0');
      let createdFormatted = '';
      const dateSource = item.createdAt || item.timestamp;
      if (dateSource) {
        const d = new Date(dateSource);
        if (!Number.isNaN(d.getTime())) {
          createdFormatted = `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
        }
      }

      return {
        ...item,
        studentName: sName,
        studentEmail: sEmail,
        studentId: sCode,
        studentClass: sClass,
        studentAvatar: item.isAnonymous ? '' : sAvatar,
        displayName: item.isAnonymous ? 'Sinh viên ẩn danh' : sName,
        teacherName: tName,
        teacherId: tCode,
        teacherAvatar: tAvatar,
        createdAtFormatted: createdFormatted,
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

    if (!studentId || !feedbackText || !feedbackText.trim()) {
      return res.status(400).json({ error: 'Thiếu thông tin đánh giá (studentId, feedbackText)' });
    }

    const numericStudentId = Number(studentId);
    const parsedTeacherId = parseTeacherId(teacherId);

    // Resolve student directly from DB
    const student = await Student.findOne({
      $or: [
        { id: numericStudentId },
        ...(studentEmail ? [{ email: studentEmail }] : []),
        ...(String(studentId).match(/^[0-9a-fA-F]{24}$/) ? [{ _id: studentId }] : []),
      ],
    });

    // Resolve class directly from DB if regId or courseId provided
    let resolvedClass = null;
    if (regId) {
      resolvedClass = await CourseClass.findOne({
        $or: [{ id: regId }, ...(String(regId).match(/^[0-9a-fA-F]{24}$/) ? [{ _id: regId }] : [])],
      });
    }
    if (!resolvedClass && courseId) {
      resolvedClass = await CourseClass.findOne({ courseId });
    }

    // Resolve teacher directly from DB
    let teacher = null;
    const finalTeacherId = resolvedClass?.teacherId || parsedTeacherId;
    if (resolvedClass?.teacherRef) {
      teacher = await Teacher.findById(resolvedClass.teacherRef);
    } else if (finalTeacherId) {
      teacher = await Teacher.findOne({
        $or: [
          { id: finalTeacherId },
          ...(String(teacherId).match(/^[0-9a-fA-F]{24}$/) ? [{ _id: teacherId }] : []),
        ],
      });
    }

    const finalStudentName = student?.hoTen || studentName || 'Sinh viên';
    const finalStudentEmail = student?.email || studentEmail || '';
    const finalStudentAvatar =
      (typeof student?.avatar === 'string' ? student.avatar : student?.avatar?.url) ||
      studentAvatar ||
      '';

    const finalTeacherName = teacher?.hoTen || resolvedClass?.teacher || teacherName || 'Giảng viên';
    const finalCourseId = resolvedClass?.courseId || courseId || '';
    const finalCourseName = resolvedClass?.courseName || courseName || '';
    const finalRegId = resolvedClass?.id || regId || '';

    const id = `FB_${Date.now()}_${student?.id || numericStudentId || Math.floor(Math.random() * 1000)}`;
    const newFeedback = await Feedback.create({
      id,
      studentId: student?.id || numericStudentId,
      studentRef: student ? student._id : null,
      studentName: finalStudentName,
      studentEmail: finalStudentEmail,
      studentAvatar: finalStudentAvatar,
      teacherId: teacher?.id || finalTeacherId,
      teacherRef: teacher ? teacher._id : resolvedClass?.teacherRef || null,
      teacherName: finalTeacherName,
      courseId: finalCourseId,
      courseName: finalCourseName,
      regId: finalRegId,
      rating: Math.min(5, Math.max(1, Number(rating) || 5)),
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

// POST /api/feedbacks/bulk-delete
router.post('/bulk-delete', async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Danh sách mã phản hồi không hợp lệ' });
    }
    const result = await Feedback.deleteMany({
      $or: [
        { _id: { $in: ids.filter((i) => String(i).match(/^[0-9a-fA-F]{24}$/)) } },
        { id: { $in: ids } },
      ],
    });
    res.json({ success: true, deletedCount: result.deletedCount });
  } catch (error) {
    next(error);
  }
});

export default router;

