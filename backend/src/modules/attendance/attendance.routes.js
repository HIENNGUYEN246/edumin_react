import { Router } from 'express';
import { Attendance } from './attendance.model.js';
import { Student } from '../students/student.model.js';
import { CourseClass } from '../classes/courseClass.model.js';

const router = Router();

const parseTeacherId = (val) => {
  if (val === null || val === undefined || val === '') return null;
  const num = Number(val);
  if (!Number.isNaN(num)) return num;
  return String(val);
};

<<<<<<< HEAD
const getTodayStr = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

=======
>>>>>>> 4e8ffb5c0a056164b568d493668162ccf16b4bd5
// GET /api/attendance
router.get('/', async (req, res, next) => {
  try {
    const { regId, classId, studentId, date, courseId, teacherId } = req.query;
    const filter = {};
    const targetClass = regId || classId;
    if (targetClass) {
      filter.$or = [{ regId: String(targetClass) }, { classRef: targetClass }];
    }
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
      const sAvatar =
        r.studentAvatar ||
        r.avatar ||
        (typeof r.studentRef?.avatar === 'string' ? r.studentRef?.avatar : r.studentRef?.avatar?.url) ||
        '';
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

// POST /api/attendance/check-in (Student self check-in)
router.post('/check-in', async (req, res, next) => {
  try {
    const {
      regId,
      classId,
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
      checkInTime = '',
    } = req.body;

    const classCode = regId || classId;
    if (!classCode || !studentId || !date) {
      return res.status(400).json({ error: 'Thiếu thông tin điểm danh (classId/regId, studentId, date)' });
    }

    const numericStudentId = Number(studentId);
    const regIdStr = String(classCode);
    const dateStr = String(date);
    const shiftIdStr = String(shiftId);

<<<<<<< HEAD
    const todayStr = getTodayStr();
    if (dateStr > todayStr) {
      return res.status(400).json({ error: 'Không thể điểm danh cho ngày trong tương lai' });
    }

=======
>>>>>>> 4e8ffb5c0a056164b568d493668162ccf16b4bd5
    const student = await Student.findOne({
      $or: [{ id: numericStudentId }, { email: studentEmail }],
    });
    const classObj = await CourseClass.findOne({
      $or: [{ id: regIdStr }, { _id: classCode.match(/^[0-9a-fA-F]{24}$/) ? classCode : null }],
    });

    const studentAvatarResolved =
      studentAvatar ||
      avatar ||
      (typeof student?.avatar === 'string' ? student?.avatar : student?.avatar?.url) ||
      '';

    let record = await Attendance.findOne({
      regId: regIdStr,
      studentId: numericStudentId,
      date: dateStr,
      shiftId: shiftIdStr,
    });

    if (record) {
      record.status = status || 'Có mặt';
      record.checkInTime = checkInTime || record.checkInTime || new Date().toLocaleTimeString('vi-VN');
      record.checkedBy = 'student';
      if (studentAvatarResolved) {
        record.studentAvatar = studentAvatarResolved;
        record.avatar = studentAvatarResolved;
      }
      if (classObj && !record.classRef) record.classRef = classObj._id;
      if (student && !record.studentRef) record.studentRef = student._id;
      record.timestamp = Date.now();
      await record.save();
      return res.json({ success: true, message: 'Điểm danh thành công!', record });
    }

    const id = `ATT_${Date.now()}_${numericStudentId}`;
    record = await Attendance.create({
      id,
      regId: regIdStr,
      classRef: classObj?._id || null,
      courseId: courseId || classObj?.courseId || '',
      courseName: courseName || classObj?.courseName || '',
      studentId: numericStudentId,
      studentRef: student ? student._id : null,
      studentName: studentName || student?.hoTen || 'Sinh viên',
      studentEmail: studentEmail || student?.email || '',
      studentAvatar: studentAvatarResolved,
      avatar: studentAvatarResolved,
      date: dateStr,
      shiftId: shiftIdStr,
      shiftLabel: shiftLabel || '',
      status: status || 'Có mặt',
      checkInTime: checkInTime || new Date().toLocaleTimeString('vi-VN'),
      checkedBy: 'student',
      timestamp: Date.now(),
    });

    res.status(201).json({ success: true, message: 'Điểm danh thành công!', record });
  } catch (error) {
    next(error);
  }
});

// POST /api/attendance/record (Teacher/Admin single record & evaluation)
router.post('/record', async (req, res, next) => {
  try {
    const {
      regId,
      classId,
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

    const classCode = regId || classId;
    if (!classCode || !studentId || !date) {
      return res.status(400).json({ error: 'Thiếu thông tin ghi nhận (regId/classId, studentId, date)' });
    }

    const numericStudentId = Number(studentId);
    const regIdStr = String(classCode);
    const dateStr = String(date);
    const shiftIdStr = String(shiftId);

<<<<<<< HEAD
    const todayStr = getTodayStr();
    if (dateStr > todayStr) {
      return res.status(400).json({ error: 'Không thể điểm danh cho ngày trong tương lai' });
    }

=======
>>>>>>> 4e8ffb5c0a056164b568d493668162ccf16b4bd5
    const student = await Student.findOne({
      $or: [{ id: numericStudentId }, { email: studentEmail }],
    });
    const classObj = await CourseClass.findOne({
      $or: [{ id: regIdStr }, { _id: classCode.match(/^[0-9a-fA-F]{24}$/) ? classCode : null }],
    });

    const resolvedAvatar =
      studentAvatar ||
      avatar ||
      (typeof student?.avatar === 'string' ? student?.avatar : student?.avatar?.url) ||
      '';

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
      if (classObj && !record.classRef) record.classRef = classObj._id;
      if (student && !record.studentRef) record.studentRef = student._id;
      await record.save();
      return res.json({ success: true, message: 'Đã lưu đánh giá và điểm danh!', record });
    }

    const id = `ATT_${Date.now()}_${numericStudentId}`;
    record = await Attendance.create({
      id,
      regId: regIdStr,
      classRef: classObj?._id || null,
      courseId: courseId || classObj?.courseId || '',
      courseName: courseName || classObj?.courseName || '',
      studentId: numericStudentId,
      studentRef: student ? student._id : null,
      studentName: studentName || student?.hoTen || 'Sinh viên',
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

// POST /api/attendance/bulk (Teacher/Admin bulk saves attendance & evaluations for class)
router.post('/bulk', async (req, res, next) => {
  try {
    const {
      regId,
      classId,
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

    const classCode = regId || classId;
    if (!classCode || !date || !Array.isArray(records)) {
      return res.status(400).json({ error: 'Dữ liệu không hợp lệ (cần classId/regId, date, records)' });
    }

    const regIdStr = String(classCode);
    const dateStr = String(date);
    const shiftIdStr = String(shiftId);

<<<<<<< HEAD
    const todayStr = getTodayStr();
    if (dateStr > todayStr) {
      return res.status(400).json({ error: 'Không thể điểm danh cho ngày trong tương lai' });
    }

=======
>>>>>>> 4e8ffb5c0a056164b568d493668162ccf16b4bd5
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const evaluatedAt = `${pad(now.getHours())}:${pad(now.getMinutes())} ${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;

    const classObj = await CourseClass.findOne({
      $or: [{ id: regIdStr }, { _id: classCode.match(/^[0-9a-fA-F]{24}$/) ? classCode : null }],
    });

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

      const student = await Student.findOne({
        $or: [{ id: numericStudentId }, { email: item.studentEmail }],
      });
      const resolvedAvatar =
        item.studentAvatar ||
        item.avatar ||
        (typeof student?.avatar === 'string' ? student?.avatar : student?.avatar?.url) ||
        '';

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
        if (classObj && !record.classRef) record.classRef = classObj._id;
        if (student && !record.studentRef) record.studentRef = student._id;
        await record.save();
        savedRecords.push(record);
      } else {
        const id = `ATT_${Date.now()}_${numericStudentId}_${Math.floor(Math.random() * 1000)}`;
        const created = await Attendance.create({
          id,
          regId: regIdStr,
          classRef: classObj?._id || null,
          courseId: courseId || item.courseId || classObj?.courseId || '',
          courseName: courseName || item.courseName || classObj?.courseName || '',
          studentId: numericStudentId,
          studentRef: student ? student._id : null,
          studentName: item.studentName || student?.hoTen || 'Sinh viên',
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
      const sAvatar =
        r.studentAvatar ||
        r.avatar ||
        (typeof r.studentRef?.avatar === 'string' ? r.studentRef?.avatar : r.studentRef?.avatar?.url) ||
        '';
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

