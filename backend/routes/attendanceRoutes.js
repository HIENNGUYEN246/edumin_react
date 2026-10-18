import express from 'express';
import { Attendance, Student, OpenRegistration, User } from '../models/index.js';

const router = express.Router();

const parseTeacherId = (val) => {
  if (val === null || val === undefined || val === '') return null;
  const num = Number(val);
  if (!Number.isNaN(num)) return num;
  return String(val);
};

// GET /api/attendance
// Filter by regId, studentId, date, courseId, teacherId
router.get('/', async (req, res, next) => {
  try {
    const { regId, studentId, date, courseId, teacherId } = req.query;
    const filter = {};
    if (regId) filter.regId = String(regId);
    if (studentId) filter.studentId = Number(studentId);
    if (date) filter.date = String(date);
    if (courseId) filter.courseId = String(courseId);
    if (teacherId) {
      const parsedTeacherId = parseTeacherId(teacherId);
      filter.$or = [{ teacherId: parsedTeacherId }, { teacherId: String(teacherId) }];
    }

    const records = await Attendance.find(filter)
      .populate('studentRef', 'id hoTen name email avatar')
      .sort({ date: -1, shiftId: 1 })
      .lean();

    const formatted = records.map((r) => {
      const sAvatar = r.studentAvatar || r.avatar || r.studentRef?.avatar || '';
      return {
        ...r,
        studentAvatar: sAvatar,
        avatar: sAvatar,
      };
    });

    res.json(formatted);
  } catch (error) {
    next(error);
  }
});

// POST /api/attendance/check-in (Sinh viên điểm danh)
router.post('/check-in', async (req, res, next) => {
  try {
    const {
      regId,
      courseId,
      courseName,
      studentId,
      studentName,
      studentEmail,
      studentAvatar,
      avatar,
      date,
      shiftId = '1',
      shiftLabel = '',
      note = '',
    } = req.body;

    if (!regId || !studentId || !date) {
      return res.status(400).json({ error: 'Thiếu thông tin điểm danh (regId, studentId, date)' });
    }

    const numericStudentId = Number(studentId);
    const regIdStr = String(regId);
    const dateStr = String(date);
    const shiftIdStr = String(shiftId);

    // Tìm thông tin sinh viên liên kết
    const student = await Student.findOne({ id: numericStudentId });
    const resolvedAvatar = studentAvatar || avatar || student?.avatar || '';

    // Kiểm tra xem sinh viên đã điểm danh ca này hôm nay chưa
    const existing = await Attendance.findOne({
      regId: regIdStr,
      studentId: numericStudentId,
      date: dateStr,
      shiftId: shiftIdStr,
    });

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const checkInTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

    if (existing) {
      if (resolvedAvatar && !existing.studentAvatar) {
        existing.studentAvatar = resolvedAvatar;
        existing.avatar = resolvedAvatar;
      }
      existing.timestamp = Date.now();
      if (existing.status === 'Có mặt') {
        await existing.save();
        return res.status(200).json({
          success: true,
          message: 'Bạn đã điểm danh cho buổi học này rồi!',
          record: existing,
          alreadyCheckedIn: true,
        });
      }
      existing.status = 'Có mặt';
      existing.checkInTime = existing.checkInTime || checkInTime;
      existing.checkedBy = 'student';
      if (note) existing.note = note;
      if (student && !existing.studentRef) existing.studentRef = student._id;
      await existing.save();
      return res.json({ success: true, message: 'Điểm danh thành công!', record: existing });
    }

    const id = `ATT_${Date.now()}_${numericStudentId}`;
    const record = await Attendance.create({
      id,
      regId: regIdStr,
      courseId: courseId || '',
      courseName: courseName || '',
      studentId: numericStudentId,
      studentRef: student ? student._id : null,
      studentName: studentName || student?.hoTen || student?.name || 'Sinh viên',
      studentEmail: studentEmail || student?.email || '',
      studentAvatar: resolvedAvatar,
      avatar: resolvedAvatar,
      date: dateStr,
      shiftId: shiftIdStr,
      shiftLabel: shiftLabel || '',
      status: 'Có mặt',
      checkInTime,
      checkedBy: 'student',
      note,
      timestamp: Date.now(),
    });

    res.status(201).json({ success: true, message: 'Điểm danh thành công!', record });
  } catch (error) {
    next(error);
  }
});

// POST /api/attendance/record-and-evaluate (Giáo viên / Admin ghi nhận & đánh giá 1 sinh viên)
router.post('/record-and-evaluate', async (req, res, next) => {
  try {
    const {
      regId,
      courseId,
      courseName,
      studentId,
      studentName,
      studentEmail,
      studentAvatar,
      avatar,
      date,
      shiftId = '1',
      shiftLabel = '',
      status = 'Có mặt',
      score = null,
      evaluation = '',
      teacherId = null,
      teacherName = '',
      note = '',
      checkedBy = 'teacher',
    } = req.body;

    if (!regId || !studentId || !date) {
      return res.status(400).json({ error: 'Thiếu thông tin ghi nhận (regId, studentId, date)' });
    }

    const numericStudentId = Number(studentId);
    const regIdStr = String(regId);
    const dateStr = String(date);
    const shiftIdStr = String(shiftId);

    const student = await Student.findOne({ id: numericStudentId });
    const resolvedAvatar = studentAvatar || avatar || student?.avatar || '';

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const evaluatedAt = `${pad(now.getHours())}:${pad(now.getMinutes())} ${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;

    let record = await Attendance.findOne({
      regId: regIdStr,
      studentId: numericStudentId,
      date: dateStr,
      shiftId: shiftIdStr,
    });

    if (record) {
      record.status = status || record.status || 'Có mặt';
      if (score !== null && score !== undefined && score !== '') {
        record.score = Number(score);
      }
      if (evaluation !== undefined) {
        record.evaluation = evaluation || '';
      }
      if (note !== undefined) {
        record.note = note || '';
      }
      if (resolvedAvatar) {
        record.studentAvatar = resolvedAvatar;
        record.avatar = resolvedAvatar;
      }
      record.teacherId = teacherId != null ? parseTeacherId(teacherId) : record.teacherId;
      record.teacherName = teacherName || record.teacherName || '';
      record.evaluatedAt = evaluatedAt;
      record.checkedBy = checkedBy || 'teacher';
      record.timestamp = Date.now();
      if (student && !record.studentRef) record.studentRef = student._id;
      await record.save();
      return res.json({ success: true, message: 'Đã lưu đánh giá và điểm danh!', record });
    }

    const id = `ATT_${Date.now()}_${numericStudentId}`;
    record = await Attendance.create({
      id,
      regId: regIdStr,
      courseId: courseId || '',
      courseName: courseName || '',
      studentId: numericStudentId,
      studentRef: student ? student._id : null,
      studentName: studentName || student?.hoTen || student?.name || 'Sinh viên',
      studentEmail: studentEmail || student?.email || '',
      studentAvatar: resolvedAvatar,
      avatar: resolvedAvatar,
      date: dateStr,
      shiftId: shiftIdStr,
      shiftLabel: shiftLabel || '',
      status: status || 'Có mặt',
      checkedBy: checkedBy || 'teacher',
      score: score !== null && score !== undefined && score !== '' ? Number(score) : null,
      evaluation: evaluation || '',
      teacherId: teacherId != null ? parseTeacherId(teacherId) : null,
      teacherName: teacherName || '',
      evaluatedAt,
      note: note || '',
      timestamp: Date.now(),
    });

    res.status(201).json({ success: true, message: 'Đã lưu đánh giá và điểm danh!', record });
  } catch (error) {
    next(error);
  }
});

// POST /api/attendance/bulk (Giáo viên / Admin lưu điểm danh & đánh giá cả lớp)
router.post('/bulk', async (req, res, next) => {
  try {
    const {
      regId,
      courseId = '',
      courseName = '',
      date,
      shiftId = '1',
      shiftLabel = '',
      teacherId = null,
      teacherName = '',
      records = [],
      checkedBy = 'teacher',
    } = req.body;

    if (!regId || !date || !Array.isArray(records)) {
      return res.status(400).json({ error: 'Dữ liệu không hợp lệ (cần regId, date, records)' });
    }

    const regIdStr = String(regId);
    const dateStr = String(date);
    const shiftIdStr = String(shiftId);

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const evaluatedAt = `${pad(now.getHours())}:${pad(now.getMinutes())} ${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;

    const savedRecords = [];

    for (const item of records) {
      if (!item.studentId) continue;
      const numericStudentId = Number(item.studentId);

      let record = await Attendance.findOne({
        regId: regIdStr,
        studentId: numericStudentId,
        date: dateStr,
        shiftId: shiftIdStr,
      });

      const student = await Student.findOne({ id: numericStudentId });
      const resolvedAvatar = item.studentAvatar || item.avatar || student?.avatar || '';

      if (record) {
        record.status = item.status || record.status || 'Có mặt';
        if (item.score !== undefined && item.score !== null && item.score !== '') {
          record.score = Number(item.score);
        }
        if (item.evaluation !== undefined) {
          record.evaluation = item.evaluation;
        }
        if (item.note !== undefined) {
          record.note = item.note;
        }
        if (resolvedAvatar) {
          record.studentAvatar = resolvedAvatar;
          record.avatar = resolvedAvatar;
        }
        record.teacherId = teacherId != null ? parseTeacherId(teacherId) : record.teacherId;
        record.teacherName = teacherName || record.teacherName || '';
        record.evaluatedAt = evaluatedAt;
        record.checkedBy = checkedBy || 'teacher';
        record.timestamp = Date.now();
        if (student && !record.studentRef) record.studentRef = student._id;
        await record.save();
        savedRecords.push(record);
      } else {
        const id = `ATT_${Date.now()}_${numericStudentId}_${Math.floor(Math.random() * 1000)}`;
        const created = await Attendance.create({
          id,
          regId: regIdStr,
          courseId: courseId || item.courseId || '',
          courseName: courseName || item.courseName || '',
          studentId: numericStudentId,
          studentRef: student ? student._id : null,
          studentName: item.studentName || student?.hoTen || student?.name || 'Sinh viên',
          studentEmail: item.studentEmail || student?.email || '',
          studentAvatar: resolvedAvatar,
          avatar: resolvedAvatar,
          date: dateStr,
          shiftId: shiftIdStr,
          shiftLabel: shiftLabel || item.shiftLabel || '',
          status: item.status || 'Có mặt',
          checkedBy: checkedBy || 'teacher',
          score: item.score !== undefined && item.score !== null && item.score !== '' ? Number(item.score) : null,
          evaluation: item.evaluation || '',
          teacherId: teacherId != null ? parseTeacherId(teacherId) : null,
          teacherName: teacherName || '',
          evaluatedAt,
          note: item.note || '',
          timestamp: Date.now(),
        });
        savedRecords.push(created);
      }
    }

    res.json({
      success: true,
      message: `Đã lưu ghi nhận điểm danh và đánh giá cho ${savedRecords.length} sinh viên!`,
      records: savedRecords,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/attendance/student/:studentId
router.get('/student/:studentId', async (req, res, next) => {
  try {
    const studentId = Number(req.params.studentId);
    const records = await Attendance.find({ studentId })
      .populate('studentRef', 'id hoTen name email avatar')
      .sort({ date: -1, shiftId: 1 })
      .lean();

    const formatted = records.map((r) => {
      const sAvatar = r.studentAvatar || r.avatar || r.studentRef?.avatar || '';
      return {
        ...r,
        studentAvatar: sAvatar,
        avatar: sAvatar,
      };
    });

    res.json(formatted);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/attendance/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    let deleted = null;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      deleted = await Attendance.findByIdAndDelete(id);
    }
    if (!deleted) {
      deleted = await Attendance.findOneAndDelete({ id });
    }
    res.json({ success: true, message: 'Đã xóa bản ghi điểm danh', deleted });
  } catch (error) {
    next(error);
  }
});

export default router;
