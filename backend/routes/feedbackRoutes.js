import express from 'express';
import { Feedback, Student, Teacher, Course, OpenRegistration } from '../models/index.js';

const router = express.Router();

const parseTeacherId = (val) => {
  if (val === null || val === undefined || val === '') return null;
  const num = Number(val);
  if (!Number.isNaN(num)) return num;
  return String(val);
};

// Seed sample feedbacks if DB collection is empty
const seedFeedbacks = async () => {
  try {
    const count = await Feedback.countDocuments();
    if (count > 0) return;

    const [students, teachers, courses, openRegs] = await Promise.all([
      Student.find({}).lean(),
      Teacher.find({}).lean(),
      Course.find({}).lean(),
      OpenRegistration.find({}).lean(),
    ]);

    const student1 = students.find((s) => s.id === 1 || s.hoTen?.includes('Văn A')) || students[0];
    const student2 = students.find((s) => s.id === 2 || s.hoTen?.includes('Huế Trân')) || students[1] || student1;
    const teacher1 = teachers.find((t) => t.id === 1 || t.hoTen?.includes('Nguyễn Văn')) || teachers[0];
    const teacher2 = teachers.find((t) => t.id === 2 || t.hoTen?.includes('Trần Đình')) || teachers[1] || teacher1;

    const s1Avatar = student1?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150';
    const s2Avatar = student2?.avatar || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150';

    const defaultList = [
      {
        id: 'FB_1790620000001_1',
        studentId: student1?.id || 1,
        studentRef: student1?._id || null,
        studentName: student1?.hoTen || student1?.name || 'Trần Văn A',
        studentEmail: student1?.email || 'vana@student.edu.vn',
        studentAvatar: s1Avatar,
        teacherId: teacher1?.id || 1,
        teacherRef: teacher1?._id || null,
        teacherName: teacher1?.hoTen || teacher1?.name || 'Nguyễn Văn',
        courseId: 'CNTT101',
        courseName: 'Lập trình Web Cơ bản',
        regId: '1790619993288',
        rating: 5,
        courseQuality: 'Tốt',
        feedbackText: 'Thầy giảng dạy rất nhiệt tình, code mẫu trực quan và giải thích cặn kẽ từng dòng lệnh CSS Flexbox và React Hook. Em tiếp thu bài rất nhanh ạ!',
        isAnonymous: false,
        response: 'Cảm ơn em Văn A đã tích cực tham gia phát biểu trong giờ học! Hãy tiếp tục duy trì tinh thần tự học nhé.',
        respondedAt: '09:30 28/09/2026',
        timestamp: Date.now() - 3 * 86400000,
      },
      {
        id: 'FB_1790620000002_2',
        studentId: student2?.id || 2,
        studentRef: student2?._id || null,
        studentName: student2?.hoTen || student2?.name || 'Quyền Huế Trân',
        studentEmail: student2?.email || 'quyen@student.edu.vn',
        studentAvatar: s2Avatar,
        teacherId: teacher2?.id || 2,
        teacherRef: teacher2?._id || null,
        teacherName: teacher2?.hoTen || teacher2?.name || 'Trần Đình',
        courseId: 'TA1',
        courseName: 'Tiếng Anh 1',
        regId: '1790626183631',
        rating: 5,
        courseQuality: 'Tốt',
        feedbackText: 'Thầy phát âm tiếng Anh cực chuẩn, không khí lớp học vui vẻ và có nhiều hoạt động luyện nói nhóm rất bổ ích.',
        isAnonymous: false,
        response: 'Thank you Trân! Keep practicing speaking every day to improve your fluency.',
        respondedAt: '16:00 29/09/2026',
        timestamp: Date.now() - 2 * 86400000,
      },
      {
        id: 'FB_1790620000003_1',
        studentId: student1?.id || 1,
        studentRef: student1?._id || null,
        studentName: student1?.hoTen || student1?.name || 'Trần Văn A',
        studentEmail: student1?.email || 'vana@student.edu.vn',
        studentAvatar: s1Avatar,
        teacherId: teacher1?.id || 1,
        teacherRef: teacher1?._id || null,
        teacherName: teacher1?.hoTen || teacher1?.name || 'Nguyễn Văn',
        courseId: 'CNTT102',
        courseName: 'Cơ sở dữ liệu',
        regId: '1790619993289',
        rating: 4,
        courseQuality: 'Ổn',
        feedbackText: 'Bài tập SQL truy vấn nâng cao hơi khó một chút, mong thầy dành thêm 15 phút cuối giờ để giải đáp các câu lệnh JOIN phức tạp ạ.',
        isAnonymous: false,
        response: 'Thầy ghi nhận ý kiến của em nhé. Tiết học tới thầy sẽ dành 30 phút để ôn tập lại phần Subquery và Multiple JOIN cho cả lớp.',
        respondedAt: '11:00 29/09/2026',
        timestamp: Date.now() - 1.5 * 86400000,
      },
      {
        id: 'FB_1790620000004_2',
        studentId: student2?.id || 2,
        studentRef: student2?._id || null,
        studentName: student2?.hoTen || student2?.name || 'Quyền Huế Trân',
        studentEmail: student2?.email || 'quyen@student.edu.vn',
        studentAvatar: '',
        teacherId: teacher1?.id || 1,
        teacherRef: teacher1?._id || null,
        teacherName: teacher1?.hoTen || teacher1?.name || 'Nguyễn Văn',
        courseId: 'CNTT101',
        courseName: 'Lập trình Web Cơ bản',
        regId: '1790619993288',
        rating: 4,
        courseQuality: 'Tốt',
        feedbackText: 'Slide bài giảng của thầy rất đẹp và chi tiết, nếu có thêm video ghi hình lại buổi học để xem lại lúc ôn thi thì tuyệt vời hơn nữa ạ.',
        isAnonymous: true,
        response: '',
        respondedAt: '',
        timestamp: Date.now() - 1 * 86400000,
      },
      {
        id: 'FB_1790620000005_1',
        studentId: student1?.id || 1,
        studentRef: student1?._id || null,
        studentName: student1?.hoTen || student1?.name || 'Trần Văn A',
        studentEmail: student1?.email || 'vana@student.edu.vn',
        studentAvatar: s1Avatar,
        teacherId: teacher2?.id || 2,
        teacherRef: teacher2?._id || null,
        teacherName: teacher2?.hoTen || teacher2?.name || 'Trần Đình',
        courseId: 'TA1',
        courseName: 'Tiếng Anh 1',
        regId: '1790626183631',
        rating: 3,
        courseQuality: 'Cần cải thiện',
        feedbackText: 'Phần bài nghe audio ở phòng máy đôi khi bị rè loa, mong thầy và bộ phận kỹ thuật kiểm tra lại thiết bị âm thanh để sinh viên nghe rõ hơn ạ.',
        isAnonymous: false,
        response: 'Thầy đã báo ngay cho phòng kỹ thuật kiểm tra lại hệ thống loa phòng Lab 203 rồi em nhé, cảm ơn em đã phản ánh kịp thời!',
        respondedAt: '15:20 29/09/2026',
        timestamp: Date.now() - 0.5 * 86400000,
      },
    ];

    await Feedback.insertMany(defaultList);
    console.log('Đã tạo thành công dữ liệu mẫu cho feedbacks trong MongoDB');
  } catch (err) {
    console.error('Lỗi khi seed feedbacks:', err);
  }
};

// GET /api/feedbacks
// Filter by teacherId, studentId, courseId, regId
router.get('/', async (req, res, next) => {
  try {
    // Check and seed if collection is empty
    await seedFeedbacks();

    const { teacherId, studentId, courseId, regId } = req.query;
    const filter = {};

    if (teacherId) {
      const parsedTeacherId = parseTeacherId(teacherId);
      filter.$or = [{ teacherId: parsedTeacherId }, { teacherId: String(teacherId) }];
    }
    if (studentId) {
      filter.studentId = Number(studentId);
    }
    if (courseId) {
      filter.courseId = String(courseId);
    }
    if (regId) {
      filter.regId = String(regId);
    }

    const records = await Feedback.find(filter)
      .populate('studentRef', 'id hoTen name email avatar')
      .populate('teacherRef', 'id hoTen name email avatar')
      .sort({ createdAt: -1 })
      .lean();

    const formatted = records.map((f) => {
      const sAvatar = f.studentAvatar || f.studentRef?.avatar || '';
      const pad = (n) => String(n).padStart(2, '0');
      let createdFormatted = '';
      if (f.createdAt) {
        const d = new Date(f.createdAt);
        createdFormatted = `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
      } else if (f.timestamp) {
        const d = new Date(f.timestamp);
        createdFormatted = `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
      }

      return {
        ...f,
        studentAvatar: f.isAnonymous ? '' : sAvatar,
        displayName: f.isAnonymous ? 'Sinh viên ẩn danh' : (f.studentName || f.studentRef?.hoTen || f.studentRef?.name || 'Sinh viên'),
        createdAtFormatted: createdFormatted,
      };
    });

    res.json(formatted);
  } catch (error) {
    next(error);
  }
});

// POST /api/feedbacks/seed (Force seed data)
router.post('/seed', async (req, res, next) => {
  try {
    await Feedback.deleteMany({});
    await seedFeedbacks();
    const list = await Feedback.find({}).sort({ createdAt: -1 }).lean();
    res.json({ success: true, message: 'Đã khởi tạo thành công dữ liệu mẫu feedback!', list });
  } catch (error) {
    next(error);
  }
});

// POST /api/feedbacks
router.post('/', async (req, res, next) => {
  try {
    const {
      studentId,
      studentName,
      studentEmail,
      studentAvatar,
      teacherId,
      teacherName,
      courseId = '',
      courseName = '',
      regId = '',
      rating = 5,
      courseQuality = 'Tốt',
      feedbackText,
      isAnonymous = false,
    } = req.body;

    if (!studentId || !feedbackText || !feedbackText.trim()) {
      return res.status(400).json({ error: 'Thiếu thông tin phản hồi (studentId, feedbackText)' });
    }

    const numStudentId = Number(studentId);
    const parsedTeacher = parseTeacherId(teacherId);

    const student = await Student.findOne({ id: numStudentId });
    const teacher = parsedTeacher ? await Teacher.findOne({ id: parsedTeacher }) : null;

    const sAvatar = studentAvatar || student?.avatar || '';
    const sName = studentName || student?.hoTen || student?.name || 'Sinh viên';
    const sEmail = studentEmail || student?.email || '';

    const id = `FB_${Date.now()}_${numStudentId}`;

    const newFeedback = await Feedback.create({
      id,
      studentId: numStudentId,
      studentRef: student ? student._id : null,
      studentName: sName,
      studentEmail: sEmail,
      studentAvatar: sAvatar,
      teacherId: parsedTeacher,
      teacherRef: teacher ? teacher._id : null,
      teacherName: teacherName || teacher?.hoTen || teacher?.name || 'Giảng viên',
      courseId,
      courseName,
      regId,
      rating: Math.min(5, Math.max(1, Number(rating) || 5)),
      courseQuality: courseQuality || 'Tốt',
      feedbackText: feedbackText.trim(),
      isAnonymous: Boolean(isAnonymous),
      timestamp: Date.now(),
    });

    res.status(201).json({
      success: true,
      message: 'Gửi phản hồi thành công! Cảm ơn bạn đã đóng góp ý kiến.',
      feedback: newFeedback,
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/feedbacks/:id/respond (Giảng viên / Admin phản hồi lại sinh viên)
router.patch('/:id/respond', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { response } = req.body;

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const respondedAt = `${pad(now.getHours())}:${pad(now.getMinutes())} ${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;

    let item = await Feedback.findOne({ id });
    if (!item && id.match(/^[0-9a-fA-F]{24}$/)) {
      item = await Feedback.findById(id);
    }

    if (!item) {
      return res.status(404).json({ error: 'Không tìm thấy phản hồi' });
    }

    item.response = response || '';
    item.respondedAt = respondedAt;
    await item.save();

    res.json({ success: true, message: 'Đã gửi phản hồi tới sinh viên!', feedback: item });
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

    if (!deleted) {
      return res.status(404).json({ error: 'Không tìm thấy phản hồi để xóa' });
    }

    res.json({ success: true, message: 'Đã xóa phản hồi thành công', deleted });
  } catch (error) {
    next(error);
  }
});

export default router;

