import { Router } from 'express';
import mongoose from 'mongoose';
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

const getTodayStr = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const normalizeShiftLabel = (sId, sLabel) => {
  if (sLabel && /\(\d{2}:\d{2}\s*-\s*\d{2}:\d{2}\)/.test(sLabel)) return sLabel;
  const norm = String(sId || sLabel || '').trim().toLowerCase();
  if (norm === 's1' || norm === 'si' || norm === '1' || norm === 'ca si' || norm === 'ca s1') return 'Ca 1 (07:00 - 09:15)';
  if (norm === 's2' || norm === 'sii' || norm === '2' || norm === 'ca sii' || norm === 'ca s2') return 'Ca 2 (09:30 - 11:45)';
  if (norm === 'c1' || norm === 'ci' || norm === '3' || norm === 'ca ci' || norm === 'ca c1') return 'Ca 3 (12:30 - 14:45)';
  if (norm === 'c2' || norm === 'cii' || norm === '4' || norm === 'ca cii' || norm === 'ca c2') return 'Ca 4 (15:00 - 17:15)';
  if (norm === 't1' || norm === 'ti' || norm === '5' || norm === 'ca ti' || norm === 'ca t1') return 'Ca 5 (18:00 - 20:15)';
  return sLabel || (sId ? `Ca ${sId}` : '');
};

const formatAttendanceRecords = async (records) => {
  const unlinkedClassCodes = [
    ...new Set(
      records
        .filter((r) => !r.classRef && r.regId)
        .map((r) => String(r.regId))
    ),
  ];

  const classMapById = new Map();
  if (unlinkedClassCodes.length > 0) {
    const objectIds = unlinkedClassCodes.filter((c) => mongoose.isValidObjectId(c));
    const stringCodes = unlinkedClassCodes.filter((c) => !mongoose.isValidObjectId(c));
    const orClauses = [];
    if (objectIds.length > 0) orClauses.push({ _id: { $in: objectIds } });
    if (stringCodes.length > 0) orClauses.push({ id: { $in: stringCodes } });

    if (orClauses.length > 0) {
      const foundClasses = await CourseClass.find({ $or: orClauses }).lean();
      for (const cls of foundClasses) {
        classMapById.set(String(cls._id), cls);
        classMapById.set(String(cls.id), cls);
      }
    }
  }

  return records.map((r) => {
    const sAvatar =
      r.studentAvatar ||
      r.avatar ||
      (typeof r.studentRef?.avatar === 'string' ? r.studentRef?.avatar : r.studentRef?.avatar?.url) ||
      '';
    const classObj = r.classRef || classMapById.get(String(r.regId)) || null;
    const isMongoId = mongoose.isValidObjectId(String(r.regId || ''));
    const resolvedClassCode =
      classObj?.id ||
      (!isMongoId ? r.regId : '') ||
      '';
    const resolvedClassName = classObj?.className || '';
    const resolvedCourseName = r.courseName || classObj?.courseName || '';
    const resolvedCourseId = r.courseId || classObj?.courseId || '';
    const resolvedShift = normalizeShiftLabel(r.shiftId, r.shiftLabel);

    return {
      ...r,
      classRef: classObj,
      classId: resolvedClassCode || r.regId,
      classCode: resolvedClassCode,
      className: resolvedClassName,
      courseId: resolvedCourseId,
      courseName: resolvedCourseName,
      regId: resolvedClassCode || r.regId,
      shiftLabel: resolvedShift,
      studentAvatar: sAvatar,
      avatar: sAvatar,
    };
  });
};

// GET /api/attendance
router.get('/', async (req, res, next) => {
  try {
    const { regId, classId, studentId, date, courseId, teacherId } = req.query;
    const filter = {};
    const andConditions = [];

    const targetClass = regId || classId;
    if (targetClass) {
      const targetStr = String(targetClass);
      const isObjectId = mongoose.isValidObjectId(targetStr);
      andConditions.push({
        $or: isObjectId
          ? [{ regId: targetStr }, { classRef: targetStr }]
          : [{ regId: targetStr }],
      });
    }
    if (studentId && !Number.isNaN(Number(studentId))) {
      filter.studentId = Number(studentId);
    }
    if (date) filter.date = String(date);
    if (courseId) filter.courseId = String(courseId);
    if (teacherId) {
      const parsedTeacherId = parseTeacherId(teacherId);
      andConditions.push({
        $or: [{ teacherId: parsedTeacherId }, { teacherId: String(teacherId) }],
      });
    }
    if (andConditions.length > 0) {
      filter.$and = andConditions;
    }

    const records = await Attendance.find(filter)
      .populate('studentRef', 'id hoTen name email avatar')
      .populate('classRef', 'id className courseId courseName schedules room department')
      .sort({ date: -1, shiftId: 1 })
      .lean();

    const formatted = await formatAttendanceRecords(records);

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
    const resolvedStudentId = !Number.isNaN(numericStudentId) ? numericStudentId : String(studentId);
    const regIdStr = String(classCode);
    const dateStr = String(date);
    const shiftIdStr = String(shiftId);

    const todayStr = getTodayStr();
    if (dateStr > todayStr) {
      return res.status(400).json({ error: 'Không thể điểm danh cho ngày trong tương lai' });
    }

    const student = await Student.findOne({
      $or: [
        ...(!Number.isNaN(numericStudentId) ? [{ id: numericStudentId }] : []),
        ...(mongoose.isValidObjectId(String(studentId)) ? [{ _id: studentId }] : []),
        ...(studentEmail ? [{ email: studentEmail }] : []),
      ],
    });
    const classObj = await CourseClass.findOne({
      $or: [
        { id: regIdStr },
        ...(mongoose.isValidObjectId(classCode) ? [{ _id: classCode }] : []),
      ],
    });
    const canonicalRegId = classObj?.id || (mongoose.isValidObjectId(regIdStr) ? '' : regIdStr) || regIdStr;
    const resolvedShiftLabel = normalizeShiftLabel(shiftIdStr, shiftLabel);

    const studentAvatarResolved =
      studentAvatar ||
      avatar ||
      (typeof student?.avatar === 'string' ? student?.avatar : student?.avatar?.url) ||
      '';

    let record = await Attendance.findOne({
      $or: [
        { regId: regIdStr, studentId: resolvedStudentId, date: dateStr, shiftId: shiftIdStr },
        { regId: regIdStr, studentId: String(studentId), date: dateStr, shiftId: shiftIdStr },
        ...(canonicalRegId !== regIdStr ? [
          { regId: canonicalRegId, studentId: resolvedStudentId, date: dateStr, shiftId: shiftIdStr },
          { regId: canonicalRegId, studentId: String(studentId), date: dateStr, shiftId: shiftIdStr }
        ] : []),
        ...(classObj ? [
          { classRef: classObj._id, studentId: resolvedStudentId, date: dateStr, shiftId: shiftIdStr },
          { classRef: classObj._id, studentId: String(studentId), date: dateStr, shiftId: shiftIdStr }
        ] : []),
      ],
    });

    if (record) {
      record.regId = canonicalRegId;
      record.status = status || 'Có mặt';
      record.checkInTime = checkInTime || record.checkInTime || new Date().toLocaleTimeString('vi-VN');
      record.checkedBy = 'student';
      if (resolvedShiftLabel) record.shiftLabel = resolvedShiftLabel;
      if (studentAvatarResolved) {
        record.studentAvatar = studentAvatarResolved;
        record.avatar = studentAvatarResolved;
      }
      if (classObj) {
        record.classRef = classObj._id;
        if (!record.courseId) record.courseId = classObj.courseId || '';
        if (!record.courseName) record.courseName = classObj.courseName || '';
      }
      if (student && !record.studentRef) record.studentRef = student._id;
      record.timestamp = Date.now();
      await record.save();
      return res.json({ success: true, message: 'Điểm danh thành công!', record });
    }

    const id = `ATT_${Date.now()}_${resolvedStudentId}`;
    record = await Attendance.create({
      id,
      regId: canonicalRegId,
      classRef: classObj?._id || null,
      courseId: courseId || classObj?.courseId || '',
      courseName: courseName || classObj?.courseName || '',
      studentId: resolvedStudentId,
      studentRef: student ? student._id : null,
      studentName: studentName || student?.hoTen || 'Sinh viên',
      studentEmail: studentEmail || student?.email || '',
      studentAvatar: studentAvatarResolved,
      avatar: studentAvatarResolved,
      date: dateStr,
      shiftId: shiftIdStr,
      shiftLabel: resolvedShiftLabel,
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
    const resolvedStudentId = !Number.isNaN(numericStudentId) ? numericStudentId : String(studentId);
    const regIdStr = String(classCode);
    const dateStr = String(date);
    const shiftIdStr = String(shiftId);

    const todayStr = getTodayStr();
    if (dateStr > todayStr) {
      return res.status(400).json({ error: 'Không thể điểm danh cho ngày trong tương lai' });
    }

    const student = await Student.findOne({
      $or: [
        ...(!Number.isNaN(numericStudentId) ? [{ id: numericStudentId }] : []),
        ...(mongoose.isValidObjectId(String(studentId)) ? [{ _id: studentId }] : []),
        ...(studentEmail ? [{ email: studentEmail }] : []),
      ],
    });
    const classObj = await CourseClass.findOne({
      $or: [
        { id: regIdStr },
        ...(mongoose.isValidObjectId(classCode) ? [{ _id: classCode }] : []),
      ],
    });
    const canonicalRegId = classObj?.id || (mongoose.isValidObjectId(regIdStr) ? '' : regIdStr) || regIdStr;
    const resolvedShiftLabel = normalizeShiftLabel(shiftIdStr, shiftLabel);

    const resolvedAvatar =
      studentAvatar ||
      avatar ||
      (typeof student?.avatar === 'string' ? student?.avatar : student?.avatar?.url) ||
      '';

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const evaluatedAt = `${pad(now.getHours())}:${pad(now.getMinutes())} ${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;

    let record = await Attendance.findOne({
      $or: [
        { regId: regIdStr, studentId: resolvedStudentId, date: dateStr, shiftId: shiftIdStr },
        { regId: regIdStr, studentId: String(studentId), date: dateStr, shiftId: shiftIdStr },
        ...(canonicalRegId !== regIdStr ? [
          { regId: canonicalRegId, studentId: resolvedStudentId, date: dateStr, shiftId: shiftIdStr },
          { regId: canonicalRegId, studentId: String(studentId), date: dateStr, shiftId: shiftIdStr }
        ] : []),
        ...(classObj ? [
          { classRef: classObj._id, studentId: resolvedStudentId, date: dateStr, shiftId: shiftIdStr },
          { classRef: classObj._id, studentId: String(studentId), date: dateStr, shiftId: shiftIdStr }
        ] : []),
      ],
    });

    if (record) {
      record.regId = canonicalRegId;
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
      if (resolvedShiftLabel) record.shiftLabel = resolvedShiftLabel;
      record.teacherId = teacherId != null ? parseTeacherId(teacherId) : record.teacherId;
      record.teacherName = teacherName || record.teacherName || '';
      record.evaluatedAt = evaluatedAt;
      record.checkedBy = checkedBy || 'teacher';
      record.timestamp = Date.now();
      if (classObj) {
        record.classRef = classObj._id;
        if (!record.courseId) record.courseId = classObj.courseId || '';
        if (!record.courseName) record.courseName = classObj.courseName || '';
      }
      if (student && !record.studentRef) record.studentRef = student._id;
      await record.save();
      return res.json({ success: true, message: 'Đã lưu đánh giá và điểm danh!', record });
    }

    const id = `ATT_${Date.now()}_${resolvedStudentId}`;
    record = await Attendance.create({
      id,
      regId: canonicalRegId,
      classRef: classObj?._id || null,
      courseId: courseId || classObj?.courseId || '',
      courseName: courseName || classObj?.courseName || '',
      studentId: resolvedStudentId,
      studentRef: student ? student._id : null,
      studentName: studentName || student?.hoTen || 'Sinh viên',
      studentEmail: studentEmail || student?.email || '',
      studentAvatar: resolvedAvatar,
      avatar: resolvedAvatar,
      date: dateStr,
      shiftId: shiftIdStr,
      shiftLabel: resolvedShiftLabel,
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

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const evaluatedAt = `${pad(now.getHours())}:${pad(now.getMinutes())} ${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;

    const classObj = await CourseClass.findOne({
      $or: [
        { id: regIdStr },
        ...(mongoose.isValidObjectId(classCode) ? [{ _id: classCode }] : []),
      ],
    });
    const canonicalRegId = classObj?.id || (mongoose.isValidObjectId(regIdStr) ? '' : regIdStr) || regIdStr;
    const resolvedShiftLabel = normalizeShiftLabel(shiftIdStr, shiftLabel);

    const savedRecords = [];

    for (const item of records) {
      if (!item.studentId) continue;
      const numericStudentId = Number(item.studentId);
      const resolvedStudentId = !Number.isNaN(numericStudentId) ? numericStudentId : String(item.studentId);

      let record = await Attendance.findOne({
        $or: [
          { regId: regIdStr, studentId: resolvedStudentId, date: dateStr, shiftId: shiftIdStr },
          { regId: regIdStr, studentId: String(item.studentId), date: dateStr, shiftId: shiftIdStr },
          ...(canonicalRegId !== regIdStr ? [
            { regId: canonicalRegId, studentId: resolvedStudentId, date: dateStr, shiftId: shiftIdStr },
            { regId: canonicalRegId, studentId: String(item.studentId), date: dateStr, shiftId: shiftIdStr }
          ] : []),
          ...(classObj ? [
            { classRef: classObj._id, studentId: resolvedStudentId, date: dateStr, shiftId: shiftIdStr },
            { classRef: classObj._id, studentId: String(item.studentId), date: dateStr, shiftId: shiftIdStr }
          ] : []),
        ],
      });

      const student = await Student.findOne({
        $or: [
          ...(!Number.isNaN(numericStudentId) ? [{ id: numericStudentId }] : []),
          ...(mongoose.isValidObjectId(String(item.studentId)) ? [{ _id: item.studentId }] : []),
          ...(item.studentEmail ? [{ email: item.studentEmail }] : []),
        ],
      });
      const resolvedAvatar =
        item.studentAvatar ||
        item.avatar ||
        (typeof student?.avatar === 'string' ? student?.avatar : student?.avatar?.url) ||
        '';

      if (record) {
        record.regId = canonicalRegId;
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
        if (resolvedShiftLabel) record.shiftLabel = resolvedShiftLabel;
        record.teacherId = teacherId != null ? parseTeacherId(teacherId) : record.teacherId;
        record.teacherName = teacherName || record.teacherName || '';
        record.evaluatedAt = evaluatedAt;
        record.checkedBy = checkedBy || 'teacher';
        record.timestamp = Date.now();
        if (classObj) {
          record.classRef = classObj._id;
          if (!record.courseId) record.courseId = classObj.courseId || '';
          if (!record.courseName) record.courseName = classObj.courseName || '';
        }
        if (student && !record.studentRef) record.studentRef = student._id;
        await record.save();
        savedRecords.push(record);
      } else {
        const id = `ATT_${Date.now()}_${resolvedStudentId}_${Math.floor(Math.random() * 1000)}`;
        const created = await Attendance.create({
          id,
          regId: canonicalRegId,
          classRef: classObj?._id || null,
          courseId: courseId || item.courseId || classObj?.courseId || '',
          courseName: courseName || item.courseName || classObj?.courseName || '',
          studentId: resolvedStudentId,
          studentRef: student ? student._id : null,
          studentName: item.studentName || student?.hoTen || 'Sinh viên',
          studentEmail: item.studentEmail || student?.email || '',
          studentAvatar: resolvedAvatar,
          avatar: resolvedAvatar,
          date: dateStr,
          shiftId: shiftIdStr,
          shiftLabel: resolvedShiftLabel || item.shiftLabel || '',
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
    const rawId = req.params.studentId;
    const numId = Number(rawId);
    const filter = !Number.isNaN(numId)
      ? { $or: [{ studentId: numId }, { studentId: String(rawId) }] }
      : { studentId: String(rawId) };
    const records = await Attendance.find(filter)
      .populate('studentRef', 'id hoTen name email avatar')
      .populate('classRef', 'id className courseId courseName schedules room department')
      .sort({ date: -1, shiftId: 1 })
      .lean();

    const formatted = await formatAttendanceRecords(records);

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

