import express from 'express';
import mongoose from 'mongoose';
import { User, Teacher, Student, Department, Course, OpenRegistration, StudentRegistration, Assignment, Document, Attendance } from '../models/index.js';

const router = express.Router();

const getAuthData = async () => {
  const [users, teachers, students, departments, courses, openRegistrations, studentRegistrations, assignments, documents, attendances] =
    await Promise.all([
      User.find({}).lean(),
      Teacher.find({}).lean(),
      Student.find({}).lean(),
      Department.find({}).lean(),
      Course.find({}).lean(),
      OpenRegistration.find({}).lean(),
      StudentRegistration.find({}).populate('studentRef courseRef').lean(),
      Assignment.find({}).lean(),
      Document.find({}).lean(),
      Attendance.find({}).lean(),
    ]);

  const openRegsById = new Map(openRegistrations.map((o) => [String(o.id), o]));
  const openRegsByCourseId = new Map(openRegistrations.map((o) => [String(o.courseId), o]));

  // Normalize student registrations: add studentId, courseId, and rich metadata from populated references & openRegistrations
  const normalizedStudentRegs = studentRegistrations.map((reg) => {
    const normalized = { ...reg };
    if (reg.studentRef && typeof reg.studentRef === 'object') {
      if (reg.studentRef.id != null) normalized.studentId = reg.studentRef.id;
      if (reg.studentRef.hoTen || reg.studentRef.name) normalized.studentName = reg.studentRef.hoTen || reg.studentRef.name;
    }
    if (reg.courseRef && typeof reg.courseRef === 'object') {
      if (reg.courseRef.id) normalized.courseId = reg.courseRef.id;
      if (reg.courseRef.name) normalized.courseName = reg.courseRef.name;
      if (reg.courseRef.department) normalized.department = reg.courseRef.department;
    }
    const matchedOpen = openRegsById.get(String(reg.regId)) || (normalized.courseId && openRegsByCourseId.get(String(normalized.courseId)));
    if (matchedOpen) {
      if (!normalized.courseName && matchedOpen.courseName) normalized.courseName = matchedOpen.courseName;
      if (!normalized.department && matchedOpen.department) normalized.department = matchedOpen.department;
      normalized.teacher = matchedOpen.teacher || normalized.teacher || '';
      normalized.teacherId = matchedOpen.teacherId ?? normalized.teacherId ?? null;
      normalized.room = matchedOpen.room || normalized.room || '';
      normalized.studyStart = matchedOpen.studyStart || normalized.studyStart || '';
      normalized.studyEnd = matchedOpen.studyEnd || normalized.studyEnd || '';
      normalized.schedules = Array.isArray(matchedOpen.schedules) ? matchedOpen.schedules : (normalized.schedules || []);
      normalized.credits = matchedOpen.credits ?? normalized.credits ?? 0;
      normalized.fee = matchedOpen.fee ?? normalized.fee ?? 0;
    }
    if (reg.createdAt && !normalized.enrolledDate) {
      try {
        normalized.enrolledDate = new Date(reg.createdAt).toLocaleString('vi-VN');
      } catch {}
    }
    return normalized;
  });

  // Resolve department head references to a readable string when possible
  const teacherByObjectId = new Map(teachers.map((t) => [String(t._id), t]));
  const teacherByNumericId = new Map(teachers.map((t) => [String(t.id), t]));

  const resolvedDepartments = departments.map((d) => {
    try {
      if (!d || !d.head) return d;
      const headVal = d.head;
      // If head is an ObjectId (stored), try to resolve to teacher
      const byOid = teacherByObjectId.get(String(headVal));
      if (byOid) {
        return { ...d, head: `${byOid.hoTen || byOid.name} (GV-${String(byOid.id).padStart(3, '0')})` };
      }
      // If head is numeric id or matches teacher id
      const byNum = teacherByNumericId.get(String(headVal));
      if (byNum) {
        return { ...d, head: `${byNum.hoTen || byNum.name} (GV-${String(byNum.id).padStart(3, '0')})` };
      }
      // Otherwise leave as-is (might already be formatted string)
      return d;
    } catch (err) {
      return d;
    }
  });

  return {
    users,
    teachersData: teachers,
    studentsData: students,
    departmentsData: resolvedDepartments,
    subjectsData: courses,
    openRegistrationsData: openRegistrations,
    studentRegistrationsData: normalizedStudentRegs,
    assignmentsData: assignments,
    documentsData: documents,
    attendancesData: attendances,
  };
};

const resolveUserByEmail = async (email) => {
  if (!email) return null;
  return User.findOne({ email: email.trim().toLowerCase() });
};

const resolveDepartment = async (department, deptId) => {
  if (!department && !deptId) return null;
  const query = [];
  if (deptId) query.push({ id: deptId });
  if (department) query.push({ name: department });
  return Department.findOne({ $or: query });
};

const resolveTeacherById = async (teacherId) => {
  if (teacherId == null) return null;
  return Teacher.findOne({ id: Number(teacherId) });
};

const resolveStudentById = async (studentId) => {
  if (studentId == null) return null;
  return Student.findOne({ id: Number(studentId) });
};

const resolveCourseById = async (courseId) => {
  if (!courseId) return null;
  return Course.findOne({ id: courseId });
};

const resolveTeacherReference = async (head) => {
  if (!head) return null;
  const rawValue = String(head).trim();
  if (!rawValue) return null;

  const query = [];
  const idMatch = rawValue.match(/(?:\((GV-?\d+)\)|\b(GV-?\d+)\b)/i);
  if (idMatch) {
    const teacherId = Number((idMatch[1] || idMatch[2] || '').replace(/^GV-?/i, ''));
    if (Number.isFinite(teacherId)) {
      query.push({ id: teacherId });
    }
  }

  const nameOnly = rawValue.replace(/\s*\((GV-?\d+)\)\s*$/i, '').trim();
  if (nameOnly) {
    query.push({ hoTen: nameOnly }, { name: nameOnly });
  }

  if (mongoose.Types.ObjectId.isValid(rawValue)) {
    query.push({ _id: rawValue });
  }

  if (!query.length) {
    query.push({ id: Number(rawValue) || -1 });
  }

  return Teacher.findOne({ $or: query });
};

const updateDepartmentHeadRefs = async (departmentDocs) => {
  if (!Array.isArray(departmentDocs)) return;
  const clean = (s) => (s || '').toLowerCase().replace(/^(khoa|viện|bộ môn)\s+/i, '').replace(/\s+/g, ' ').trim();

  for (const dept of departmentDocs) {
    if (!dept || !dept.head) {
      await Department.updateOne(
        { id: dept?.id || dept?.name },
        { head: null }
      );
      continue;
    }
    const teacher = await resolveTeacherReference(dept.head);
    if (teacher) {
      const teacherDept = (teacher.department || '').trim().toLowerCase();
      const targetName = (dept.name || '').trim().toLowerCase();
      const targetId = (dept.id || '').trim().toLowerCase();

      const isMatch =
        teacherDept === targetName ||
        (targetId && teacherDept === targetId) ||
        (clean(teacherDept) && clean(targetName) && clean(teacherDept) === clean(targetName)) ||
        (clean(teacherDept) && clean(targetId) && clean(teacherDept) === clean(targetId));

      if (isMatch) {
        await Department.updateOne(
          { id: dept.id || dept.name },
          { head: teacher._id }
        );
      } else {
        await Department.updateOne(
          { id: dept.id || dept.name },
          { head: null }
        );
      }
    } else {
      await Department.updateOne(
        { id: dept.id || dept.name },
        { head: null }
      );
    }
  }
};

const normalizePersonFields = (d) => {
  if (d.name && !d.hoTen) d.hoTen = d.name;
  if (d.hoTen && !d.name) d.name = d.hoTen;
  if (!Object.prototype.hasOwnProperty.call(d, 'avatar')) d.avatar = d.avatar || '';
  return d;
};

const stripAccountFields = (doc) => {
  const normalized = { ...doc };
  delete normalized.password;
  delete normalized.pass;
  delete normalized.status;
  delete normalized.lockReason;
  return normalized;
};

const upsertAccountForPerson = async ({ email, hoTen, role, password, status, lockReason, personId, personIdField }) => {
  const normalizedEmail = (email || '').trim().toLowerCase();
  const accountPassword = password || '123';
  const payload = {
    email: normalizedEmail,
    password: accountPassword,
    role,
    hoTen: hoTen || '',
    status: status || 'Active',
    lockReason: lockReason || '',
  };

  if (personIdField) {
    payload[personIdField] = personId || null;
  }

  let user = normalizedEmail ? await User.findOne({ email: normalizedEmail }) : null;
  if (!user && personId) {
    user = await User.findOne({ [personIdField]: personId });
  }

  if (user) {
    const updatePayload = { ...payload };
    if (role === 'giao-vien') {
      updatePayload.studentId = null;
    }
    if (role === 'sinh-vien') {
      updatePayload.teacherId = null;
    }
    await User.updateOne({ _id: user._id }, { $set: updatePayload });
    return User.findById(user._id).lean();
  }

  return User.create(payload);
};

const ensureSeedAccounts = async () => {
  const seedAccounts = [
    {
      email: 'admin1@edu.vn',
      password: '123456',
      role: 'dao-tao',
      hoTen: 'Nguyễn Thế Hiển',
      status: 'Active',
      lockReason: '',
    },
  ];

  for (const account of seedAccounts) {
    const emailKey = account.email.trim().toLowerCase();
    const payload = {
      email: emailKey,
      password: account.password || '123',
      role: account.role,
      hoTen: account.hoTen,
      status: account.status || 'Active',
      lockReason: account.lockReason || '',
    };
    const existing = await User.findOne({ email: emailKey });
    if (!existing) {
      await User.create(payload);
    } else {
      await User.updateOne(
        { _id: existing._id },
        { $set: payload }
      );
    }
  }
};

const prepareDocumentsForModel = async (Model, docs) => {
  const mapped = [];
  for (const doc of docs) {
    let d = { ...doc };
    if (!d) continue;

    const coerceEmptyToNull = (field) => {
      if (d[field] === '') d[field] = null;
    };

    if (Model.modelName === 'Department') {
      coerceEmptyToNull('head');
    }
    coerceEmptyToNull('departmentRef');
    coerceEmptyToNull('teacherRef');
    coerceEmptyToNull('studentRef');
    coerceEmptyToNull('courseRef');
    coerceEmptyToNull('modifiedByRef');

    switch (Model.modelName) {
      case 'User':
        if (d.email) d.email = d.email.trim().toLowerCase();
        if (d.name && !d.hoTen) d.hoTen = d.name;
        if (d.hoTen && !d.name) d.name = d.hoTen;
        d.password = d.password || d.pass || '123';
        if (!d.role) d.role = 'dao-tao';
        delete d.pass;
        break;
      case 'Teacher': {
        normalizePersonFields(d);
        if (d.email) d.email = d.email.trim().toLowerCase();
        const teacherAccount = await upsertAccountForPerson({
          email: d.email,
          hoTen: d.hoTen || d.name || '',
          role: 'giao-vien',
          password: d.password || d.pass || '123',
          status: d.status || 'Active',
          lockReason: d.lockReason || '',
          personIdField: 'teacherId',
        });
        d.userId = teacherAccount._id;
        delete d.password;
        delete d.pass;
        delete d.status;
        delete d.lockReason;
        delete d.departmentId;
        if (d.departmentRef && typeof d.departmentRef === 'object' && d.departmentRef._id) {
          d.departmentRef = d.departmentRef._id;
        }
        if (!d.departmentRef && (d.department || d.departmentId)) {
          const dept = await resolveDepartment(d.department, d.departmentId || d.department);
          if (dept) d.departmentRef = dept._id;
        }
        break;
      }
      case 'Student': {
        normalizePersonFields(d);
        if (d.email) d.email = d.email.trim().toLowerCase();
        const studentAccount = await upsertAccountForPerson({
          email: d.email,
          hoTen: d.hoTen || d.name || '',
          role: 'sinh-vien',
          password: d.password || d.pass || '123',
          status: d.status || 'Active',
          lockReason: d.lockReason || '',
          personIdField: 'studentId',
        });
        d.userId = studentAccount._id;
        delete d.password;
        delete d.pass;
        delete d.status;
        delete d.lockReason;
        delete d.className;
        delete d.departmentId;
        if (d.departmentRef && typeof d.departmentRef === 'object' && d.departmentRef._id) {
          d.departmentRef = d.departmentRef._id;
        }
        if (!d.departmentRef && (d.department || d.departmentId)) {
          const dept = await resolveDepartment(d.department, d.departmentId || d.department);
          if (dept) d.departmentRef = dept._id;
        }
        break;
      }
      case 'Course': {
        delete d.teacherId;
        delete d.teacherRef;

        if (d.deptRef && typeof d.deptRef === 'object' && d.deptRef._id) {
          d.deptRef = d.deptRef._id;
        }

        if (!d.department && d.dept) {
          d.department = d.dept;
        }
        if (!d.deptId && d.departmentId) {
          d.deptId = d.departmentId;
        }

        const departmentName = d.department || d.dept || '';
        const deptIdValue = d.deptId || d.departmentId || '';

        if (!d.deptRef && (deptIdValue || departmentName)) {
          const dept = await resolveDepartment(departmentName, deptIdValue);
          if (dept) {
            d.deptRef = dept._id;
            d.deptId = dept.id;
            d.department = dept.name;
          }
        }

        if (!d.classId) {
          d.classId = `${d.id}_01`;
        }
        if (!d.className) {
          d.className = `${d.name || d.id} - Lớp 01`;
        }

        delete d.dept;
        delete d.departmentId;
        break;
      }
      case 'OpenRegistration': {
        if (!d.id) {
          const legacyId = d.regId || d.groupId || null;
          if (legacyId) d.id = String(legacyId);
        }
        delete d.regId;
        delete d.groupId;

        let courseId = d.courseId || (d.courseRef && typeof d.courseRef === 'object' ? d.courseRef.id : '');
        let course = null;
        if (courseId) {
          course = await resolveCourseById(courseId);
        }
        if (!course && d.courseRef) {
          const cid = typeof d.courseRef === 'object' ? d.courseRef._id : d.courseRef;
          if (cid && mongoose.Types.ObjectId.isValid(cid)) {
            course = await Course.findById(cid);
          }
        }
        if (course) {
          d.courseRef = course._id;
          d.courseId = course.id;
          d.courseName = d.courseName || course.name || '';
          d.department = d.department || course.department || '';
          d.credits = Number.isFinite(Number(d.credits)) && Number(d.credits) > 0 ? Number(d.credits) : (course.credits || 0);
          d.fee = Number.isFinite(Number(d.fee)) && Number(d.fee) > 0 ? Number(d.fee) : (course.fee || 0);
          d.classId = d.classId || course.classId || '';
          d.className = d.className || course.className || '';
        } else if (d.courseRef && typeof d.courseRef === 'object' && d.courseRef._id) {
          d.courseRef = d.courseRef._id;
        }

        let teacherId = d.teacherId != null ? d.teacherId : (d.teacherRef && typeof d.teacherRef === 'object' ? d.teacherRef.id : null);
        let teacher = null;
        if (teacherId != null) {
          teacher = await resolveTeacherById(teacherId);
        }
        if (!teacher && d.teacherRef) {
          const tid = typeof d.teacherRef === 'object' ? d.teacherRef._id : d.teacherRef;
          if (tid && mongoose.Types.ObjectId.isValid(tid)) {
            teacher = await Teacher.findById(tid);
          }
        }
        if (!teacher && d.teacher) {
          teacher = await Teacher.findOne({
            $or: [{ hoTen: d.teacher }, { name: d.teacher }]
          });
        }
        if (teacher) {
          d.teacherRef = teacher._id;
          d.teacherId = teacher.id;
          d.teacher = d.teacher || teacher.hoTen || teacher.name || '';
        } else if (d.teacherRef && typeof d.teacherRef === 'object' && d.teacherRef._id) {
          d.teacherRef = d.teacherRef._id;
        }

        d.studyStart = d.studyStart || '';
        d.studyEnd = d.studyEnd || '';
        d.start = d.start || '';
        d.end = d.end || '';
        d.schedules = Array.isArray(d.schedules) ? d.schedules : [];
        d.status = d.status || 'Đang mở';
        break;
      }
      case 'StudentRegistration': {
        let studentId = d.studentId != null ? d.studentId : (d.studentRef && typeof d.studentRef === 'object' ? d.studentRef.id : null);
        let student = null;
        if (studentId != null) {
          student = await resolveStudentById(studentId);
        }
        if (!student && d.studentRef) {
          const sid = typeof d.studentRef === 'object' ? d.studentRef._id : d.studentRef;
          if (sid && mongoose.Types.ObjectId.isValid(sid)) {
            student = await Student.findById(sid);
            if (!student) {
              student = await Student.findOne({ userId: sid });
            }
          }
        }
        if (!student && (d.email || d.studentEmail)) {
          const email = (d.email || d.studentEmail).trim().toLowerCase();
          student = await Student.findOne({ email });
          if (!student) {
            const user = await User.findOne({ email, role: 'sinh-vien' });
            if (user) {
              const maxStudent = await Student.findOne().sort({ id: -1 });
              const nextId = (maxStudent?.id || 0) + 1;
              student = await Student.create({
                userId: user._id,
                id: nextId,
                email: user.email,
                hoTen: user.hoTen || 'Sinh viên',
                department: user.department || '',
              });
              await User.updateOne({ _id: user._id }, { studentId: student._id });
            }
          }
        }
        if (student) {
          d.studentRef = student._id;
        } else if (d.studentRef && typeof d.studentRef === 'object' && d.studentRef._id) {
          d.studentRef = d.studentRef._id;
        }

        let courseId = d.courseId || (d.courseRef && typeof d.courseRef === 'object' ? d.courseRef.id : '');
        let course = null;
        if (courseId) {
          course = await resolveCourseById(courseId);
        }
        if (!course && d.courseRef) {
          const cid = typeof d.courseRef === 'object' ? d.courseRef._id : d.courseRef;
          if (cid && mongoose.Types.ObjectId.isValid(cid)) {
            course = await Course.findById(cid);
          }
        }
        let openReg = null;
        if (d.regId) {
          openReg = await OpenRegistration.findOne({ id: String(d.regId) });
          if (openReg) {
            if (!course && openReg.courseRef && mongoose.Types.ObjectId.isValid(openReg.courseRef)) {
              course = await Course.findById(openReg.courseRef);
            }
            if (!course && openReg.courseId) {
              course = await resolveCourseById(openReg.courseId);
            }
          }
        }
        if (!course && (d.courseId || openReg?.courseId)) {
          const cId = d.courseId || openReg?.courseId;
          const cName = d.courseName || openReg?.courseName || cId;
          course = await Course.create({
            id: cId,
            name: cName,
            credits: openReg?.credits || 0,
            fee: openReg?.fee || 0,
            department: openReg?.department || '',
          });
        }
        if (course) {
          d.courseRef = course._id;
        } else if (d.courseRef && typeof d.courseRef === 'object' && d.courseRef._id) {
          d.courseRef = d.courseRef._id;
        }

        delete d.id;
        delete d.studentId;
        delete d.courseId;
        delete d.courseName;
        delete d.studentName;
        delete d.department;

        if (!d.regId || !d.studentRef || !d.courseRef) {
          d = null;
        }
        break;
      }
      case 'Assignment':
      case 'Document': {
        let courseId = d.courseId || (d.courseRef && typeof d.courseRef === 'object' ? d.courseRef.id : '');
        let course = null;
        if (courseId) {
          course = await resolveCourseById(courseId);
        }
        if (!course && d.courseRef) {
          const cid = typeof d.courseRef === 'object' ? d.courseRef._id : d.courseRef;
          if (cid && mongoose.Types.ObjectId.isValid(cid)) {
            course = await Course.findById(cid);
          }
        }
        if (course) {
          d.courseRef = course._id;
        } else if (d.courseRef && typeof d.courseRef === 'object' && d.courseRef._id && mongoose.Types.ObjectId.isValid(d.courseRef._id)) {
          d.courseRef = d.courseRef._id;
        } else if (d.courseRef && typeof d.courseRef === 'string' && mongoose.Types.ObjectId.isValid(d.courseRef)) {
          // valid ObjectId string
        } else {
          d.courseRef = null;
        }

        if (d.modifiedByRef && typeof d.modifiedByRef === 'object' && d.modifiedByRef._id && mongoose.Types.ObjectId.isValid(d.modifiedByRef._id)) {
          d.modifiedByRef = d.modifiedByRef._id;
        }
        if (d.modifiedBy) {
          const teacher = await Teacher.findOne({
            $or: [
              { hoTen: d.modifiedBy },
              { name: d.modifiedBy },
              { email: d.modifiedBy },
              { id: Number(d.modifiedBy) || -1 },
            ],
          });
          if (teacher) d.modifiedByRef = teacher._id;
        }
        if (d.modifiedByRef && !mongoose.Types.ObjectId.isValid(d.modifiedByRef)) {
          d.modifiedByRef = null;
        }

        if (d._id && !mongoose.Types.ObjectId.isValid(d._id)) {
          delete d._id;
        }
        delete d.__v;

        if (Model.modelName === 'Assignment') {
          if (!d.type) d.type = 'file';
          if (!d.name && d.title) d.name = d.title;
          if (!d.title && d.name) d.title = d.name;
          d.questions = Array.isArray(d.questions) ? d.questions : [];
          d.submissions = Array.isArray(d.submissions) ? d.submissions : [];
        }
        break;
      }
      case 'Department': {
        if (d.head) {
          const teacher = await resolveTeacherReference(d.head);
          if (teacher) d.head = teacher._id;
          else d.head = null;
        }
        break;
      }
      default:
        break;
    }
    if (d != null) mapped.push(d);
  }
  return mapped.filter(item => item != null);
};

const cleanupOrphanAccounts = async () => {
  const teachers = await Teacher.find({}, '_id').lean();
  const students = await Student.find({}, '_id').lean();
  const teacherIds = teachers.map((t) => t._id);
  const studentIds = students.map((s) => s._id);

  if (teacherIds.length > 0) {
    await User.deleteMany({ role: 'giao-vien', teacherId: { $nin: teacherIds } });
  } else {
    await User.deleteMany({ role: 'giao-vien' });
  }

  if (studentIds.length > 0) {
    await User.deleteMany({ role: 'sinh-vien', studentId: { $nin: studentIds } });
  } else {
    await User.deleteMany({ role: 'sinh-vien' });
  }
};

const cleanupLegacyFields = async () => {
  await User.updateMany({}, { $unset: { pass: '' } });
  await Teacher.updateMany({}, { $unset: { departmentId: '', password: '', pass: '' } });
  await Student.updateMany({}, { $unset: { className: '', departmentId: '', password: '', pass: '' } });
  await OpenRegistration.updateMany({}, { $unset: { regId: '', groupId: '' } });
  await StudentRegistration.updateMany({}, { $unset: { id: '', studentId: '', courseId: '', courseName: '', studentName: '', department: '' } });
};

const replaceCollection = async (Model, docs) => {
  if (!Array.isArray(docs)) return;

  // Safe non-destructive update for Assignment and Document
  if (Model.modelName === 'Assignment' || Model.modelName === 'Document') {
    const mapped = await prepareDocumentsForModel(Model, docs);
    const deduped = [];
    const seenKeys = new Set();
    for (const item of mapped) {
      if (!item) continue;
      const key = (item.id || '').toString().trim();
      if (key) {
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);
      }
      deduped.push(item);
    }

    const validIds = [];
    for (const item of deduped) {
      if (!item || !item.id) continue;
      validIds.push(item.id);
      const updateData = { ...item };
      delete updateData._id;
      delete updateData.__v;
      await Model.findOneAndUpdate(
        { id: item.id },
        { $set: updateData },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    // Only delete items not in validIds if validIds has at least 1 item
    if (validIds.length > 0) {
      await Model.deleteMany({ id: { $nin: validIds } });
    }
    return;
  }

  const mapped = await prepareDocumentsForModel(Model, docs);

  // Deduplicate before inserting to avoid duplicate key errors
  const deduped = [];
  const seenKeys = new Set();
  for (const item of mapped) {
    if (!item) continue;
    let key = '';
    if (Model.modelName === 'Course') {
      key = (item.id || '').toString().trim().toUpperCase();
    } else if (Model.modelName === 'User') {
      key = (item.email || '').toString().trim().toLowerCase();
    } else if (Model.modelName === 'Teacher') {
      key = item.id != null ? String(item.id) : (item.email || '').toLowerCase();
    } else if (Model.modelName === 'Student') {
      key = item.id != null ? String(item.id) : (item.email || '').toLowerCase();
    } else if (Model.modelName === 'Department') {
      key = (item.id || item.name || '').toString().trim().toLowerCase();
    } else if (Model.modelName === 'OpenRegistration') {
      key = (item.id || `${item.courseId}_${item.teacherId}`).toString().trim();
    } else if (Model.modelName === 'StudentRegistration') {
      key = `${item.regId}_${String(item.studentRef)}`;
    }
    if (key) {
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
    }
    if (Model.modelName === 'StudentRegistration' || Model.modelName === 'OpenRegistration') {
      delete item._id;
    } else if (item._id && !mongoose.Types.ObjectId.isValid(item._id)) {
      delete item._id;
    }
    delete item.__v;
    deduped.push(item);
  }

  await Model.deleteMany({});
  if (deduped.length === 0) return;
  const inserted = await Model.insertMany(deduped);

  if (Model.modelName === 'Teacher') {
    await Promise.all(
      inserted.map(async (teacher) => {
        if (!teacher?.userId) return;
        await User.updateOne({ _id: teacher.userId }, { $set: { teacherId: teacher._id, studentId: null } });
      })
    );
  }

  if (Model.modelName === 'Student') {
    await Promise.all(
      inserted.map(async (student) => {
        if (!student?.userId) return;
        await User.updateOne({ _id: student.userId }, { $set: { studentId: student._id, teacherId: null } });
      })
    );
  }
};

const defaultAuthData = {
  users: [
    {
      email: 'admin1@edu.vn',
      password: '123456',
      role: 'dao-tao',
      hoTen: 'Nguyễn Thế Hiển',
      status: 'Active',
      lockReason: '',
    },
  ],
  teachersData: [],
  studentsData: [],
  departmentsData: [
    { id: 'CNTT', name: 'Khoa Công Nghệ Thông Tin' },
    { id: 'NNA', name: 'Khoa Ngôn Ngữ Anh' },
    { id: 'CNTP', name: 'Khoa Công Nghiệp Thực Phẩm' },
  ],
  subjectsData: [],
  openRegistrationsData: [],
  studentRegistrationsData: [],
  assignmentsData: [],
  documentsData: [],
  attendancesData: [],
};

router.get('/', async (req, res) => {
  try {
    const authData = await getAuthData();
    const isEmpty = !authData.users.length && !authData.studentsData.length && !authData.departmentsData.length;

    if (isEmpty) {
      await replaceCollection(User, defaultAuthData.users);
      await replaceCollection(Teacher, defaultAuthData.teachersData);
      await replaceCollection(Student, defaultAuthData.studentsData);
      await replaceCollection(Department, defaultAuthData.departmentsData);
      await ensureSeedAccounts();
      await cleanupLegacyFields();
      const currentAuthData = await getAuthData();
      return res.json(currentAuthData);
    }

    await ensureSeedAccounts();
    await cleanupLegacyFields();
    const cleanedAuthData = await getAuthData();
    res.json(cleanedAuthData);
  } catch (error) {
    console.error('GET /api/auth error:', error);
    res.status(500).json({ error: 'Lỗi khi tải dữ liệu xác thực' });
  }
});

router.put('/', async (req, res) => {
  try {
    const body = req.body || {};
    if (Array.isArray(body.departmentsData)) await replaceCollection(Department, body.departmentsData);
    if (Array.isArray(body.users)) await replaceCollection(User, body.users);
    if (Array.isArray(body.teachersData)) await replaceCollection(Teacher, body.teachersData);
    if (Array.isArray(body.studentsData)) await replaceCollection(Student, body.studentsData);
    if (Array.isArray(body.subjectsData)) await replaceCollection(Course, body.subjectsData);
    if (Array.isArray(body.openRegistrationsData)) {
      if (body.openRegistrationsData.length > 0 || body.forceWipeOpenRegistrations === true) {
        await replaceCollection(OpenRegistration, body.openRegistrationsData);
      }
    }
    if (Array.isArray(body.studentRegistrationsData)) {
      if (body.studentRegistrationsData.length > 0 || body.forceWipeStudentRegistrations === true) {
        await replaceCollection(StudentRegistration, body.studentRegistrationsData);
      }
    }
    if (Array.isArray(body.assignmentsData)) {
      if (body.assignmentsData.length > 0 || body.forceWipeAssignments === true) {
        await replaceCollection(Assignment, body.assignmentsData);
      }
    }
    if (Array.isArray(body.documentsData)) {
      if (body.documentsData.length > 0 || body.forceWipeDocuments === true) {
        await replaceCollection(Document, body.documentsData);
      }
    }
    if (Array.isArray(body.attendancesData)) {
      if (body.attendancesData.length > 0 || body.forceWipeAttendances === true) {
        await replaceCollection(Attendance, body.attendancesData);
      }
    }
    await cleanupOrphanAccounts();
    await cleanupLegacyFields();
    const authData = await getAuthData();
    await ensureSeedAccounts();
    res.json(authData);
  } catch (error) {
    console.error('PUT /api/auth error:', error);
    res.status(500).json({ error: 'Lỗi khi lưu dữ liệu xác thực', details: error.message });
  }
});

export default router;
