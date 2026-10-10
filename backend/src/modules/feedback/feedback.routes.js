import { Router } from 'express';
import mongoose from 'mongoose';
import { Feedback } from './feedback.model.js';
import { Student } from '../students/student.model.js';
import { Teacher } from '../teachers/teacher.model.js';
import { CourseClass } from '../classes/courseClass.model.js';
import { User } from '../auth/user.model.js';
import { verifyToken } from '../../lib/jwt.js';
import { ROLES } from '../../lib/roles.js';

const router = Router();

const isStudentRole = (role) =>
  role === 'student' || role === 'sinh-vien' || role === ROLES.STUDENT;

const isTeacherRole = (role) =>
  role === 'teacher' || role === 'giao-vien' || role === ROLES.TEACHER;

const isAdminRole = (role) =>
  role === 'admin' || role === 'dao-tao' || role === ROLES.ADMIN;

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
      .populate('teacherRef', 'id hoTen name email avatar department gender')
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
      const tGender = teacher?.gender || item.teacherGender || '';
      const tAvatar =
        (typeof teacher?.avatar === 'string' ? teacher.avatar : teacher?.avatar?.url) ||
        item.teacherAvatar ||
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

      const respName = item.respondedByName || tName;
      const respAvatar = item.respondedByAvatar || tAvatar;
      const respRole = item.respondedByRole || (item.response ? 'teacher' : '');

      return {
        ...item,
        studentName: sName,
        studentEmail: sEmail,
        studentId: sCode,
        studentClass: sClass,
        studentAvatar: item.isAnonymous ? '' : sAvatar,
        displayName: item.isAnonymous ? 'Sinh viên ẩn danh' : sName,
        teacherName: tName,
        teacherGender: tGender,
        teacherId: tCode,
        teacherAvatar: tAvatar,
        respondedByName: respName,
        respondedByAvatar: respAvatar,
        respondedByRole: respRole,
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
    const finalTeacherGender = teacher?.gender || '';
    const finalTeacherAvatar =
      (typeof teacher?.avatar === 'string' ? teacher.avatar : teacher?.avatar?.url) ||
      '';
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
      teacherGender: finalTeacherGender,
      teacherAvatar: finalTeacherAvatar,
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

    // Role & Permission verification
    const authHeader = String(req.headers.authorization || '');
    let authenticatedUser = null;
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      try {
        const payload = verifyToken(token);
        if (payload?.sub) {
          authenticatedUser = await User.findById(payload.sub);
        }
      } catch {
        return res.status(401).json({ error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn' });
      }
    }

    if (authenticatedUser) {
      if (isStudentRole(authenticatedUser.role)) {
        return res.status(403).json({ error: 'Sinh viên không có quyền phản hồi ý kiến đánh giá' });
      }

      if (isTeacherRole(authenticatedUser.role)) {
        let currentTeacher = null;
        if (authenticatedUser.teacher) {
          currentTeacher = await Teacher.findById(authenticatedUser.teacher);
        } else if (authenticatedUser.teacherId && mongoose.Types.ObjectId.isValid(authenticatedUser.teacherId)) {
          currentTeacher = await Teacher.findById(authenticatedUser.teacherId);
        } else {
          currentTeacher = await Teacher.findOne({ email: authenticatedUser.email });
        }

        const userTeacherId = currentTeacher?.id ?? authenticatedUser.teacherId;
        const userTeacherRef = currentTeacher?._id
          ? String(currentTeacher._id)
          : authenticatedUser.teacher
          ? String(authenticatedUser.teacher)
          : null;

        const fbTeacherId = fb.teacherId;
        const fbTeacherRef = fb.teacherRef ? String(fb.teacherRef) : null;

        const isMatch =
          (fbTeacherRef && userTeacherRef && fbTeacherRef === userTeacherRef) ||
          (userTeacherId != null && fbTeacherId != null && String(userTeacherId) === String(fbTeacherId)) ||
          (userTeacherRef && fbTeacherId != null && String(userTeacherRef) === String(fbTeacherId));

        let isClassTeacher = false;
        if (!isMatch && (fb.regId || fb.courseId)) {
          const cls = await CourseClass.findOne({
            $or: [{ id: fb.regId }, { courseId: fb.courseId }],
          });
          if (cls) {
            if (
              (cls.teacherRef && userTeacherRef && String(cls.teacherRef) === userTeacherRef) ||
              (cls.teacherId != null && userTeacherId != null && String(cls.teacherId) === String(userTeacherId)) ||
              (cls.teacher && currentTeacher?.hoTen && cls.teacher.trim().toLowerCase() === currentTeacher.hoTen.trim().toLowerCase())
            ) {
              isClassTeacher = true;
            }
          }
        }

        if (!isMatch && !isClassTeacher) {
          return res.status(403).json({
            error: 'Bạn không phải là giảng viên phụ trách lớp học phần này nên không thể gửi phản hồi',
          });
        }
      } else if (!isAdminRole(authenticatedUser.role)) {
        return res.status(403).json({ error: 'Bạn không có quyền phản hồi ý kiến đánh giá' });
      }
    }

    // Resolve teacher data to guarantee avatar and name belong to the teacher
    let teacherObj = null;
    if (fb.teacherRef) {
      teacherObj = await Teacher.findById(fb.teacherRef);
    } else if (fb.teacherId) {
      teacherObj = await Teacher.findOne({ id: fb.teacherId });
    }

    const tName = teacherObj?.hoTen || teacherObj?.name || fb.teacherName || 'Giảng viên';
    const tAvatar =
      (typeof teacherObj?.avatar === 'string' ? teacherObj.avatar : teacherObj?.avatar?.url) ||
      fb.teacherAvatar ||
      '';

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const respondedAt = `${pad(now.getHours())}:${pad(now.getMinutes())} ${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;

    const respondedByName =
      (isTeacherRole(authenticatedUser?.role) ? (authenticatedUser.hoTen || authenticatedUser.name) : '') ||
      tName;
    const respondedByAvatar =
      (isTeacherRole(authenticatedUser?.role) ? (authenticatedUser.avatar?.url || authenticatedUser.avatar) : '') ||
      tAvatar;

    const tGender = teacherObj?.gender || '';
    if (!fb.teacherGender && tGender) {
      fb.teacherGender = tGender;
    }

    fb.response = response.trim();
    fb.respondedAt = respondedAt;
    fb.respondedByName = respondedByName;
    fb.respondedByAvatar = respondedByAvatar;
    fb.respondedByRole = authenticatedUser?.role || 'teacher';
    fb.respondedByRef = authenticatedUser?._id || (teacherObj ? teacherObj._id : null);
    if (!fb.teacherAvatar && tAvatar) {
      fb.teacherAvatar = tAvatar;
    }
    await fb.save();

    res.json({
      success: true,
      message: 'Đã gửi phản hồi thành công!',
      feedback: {
        ...fb.toObject(),
        teacherName: tName,
        teacherGender: fb.teacherGender || tGender,
        teacherAvatar: tAvatar,
        respondedByName,
        respondedByAvatar,
      },
    });
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

