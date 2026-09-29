import express from 'express';
import mongoose from 'mongoose';
import { User, Teacher, Student, Department, Course, OpenRegistration, StudentRegistration, Assignment, Document } from '../models/index.js';

const router = express.Router();

const getAuthData = async () => {
  const [users, teachers, students, departments, courses, openRegistrations, studentRegistrations, assignments, documents] =
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
    ]);

  // Normalize student registrations: add studentId and courseId from populated references
  const normalizedStudentRegs = studentRegistrations.map((reg) => {
    const normalized = { ...reg };
    if (reg.studentRef && typeof reg.studentRef === 'object' && reg.studentRef.id) {
      normalized.studentId = reg.studentRef.id;
    }
    if (reg.courseRef && typeof reg.courseRef === 'object' && reg.courseRef.id) {
      normalized.courseId = reg.courseRef.id;
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
  for (const dept of departmentDocs) {
    if (!dept || !dept.head) continue;
    const teacher = await resolveTeacherReference(dept.head);
    if (teacher) {
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
    const d = { ...doc };
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
        if (!d.departmentRef && (d.department || d.departmentId)) {
          const dept = await resolveDepartment(d.department, d.departmentId || d.department);
          if (dept) d.departmentRef = dept._id;
        }
        break;
      }
      case 'Course': {
        delete d.teacherId;
        delete d.teacherRef;

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

        if (d.courseId) {
          const course = await resolveCourseById(d.courseId);
          if (course) {
            d.courseRef = course._id;
            d.department = d.department || course.department || '';
            d.credits = Number.isFinite(Number(d.credits)) ? Number(d.credits) : Number.isFinite(Number(course.credits)) ? Number(course.credits) : 0;
            d.fee = Number.isFinite(Number(d.fee)) ? Number(d.fee) : Number.isFinite(Number(course.fee)) ? Number(course.fee) : 0;
          }
        }
        if (d.teacherId != null) {
          const teacher = await resolveTeacherById(d.teacherId);
          if (teacher) d.teacherRef = teacher._id;
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
        // Resolve references FIRST before deleting fields
        if (!d.studentRef && d.studentId != null) {
          const student = await resolveStudentById(d.studentId);
          if (student) d.studentRef = student._id;
        }
        if (!d.courseRef && d.courseId) {
          const course = await resolveCourseById(d.courseId);
          if (course) d.courseRef = course._id;
        }
        // Then delete unused fields
        delete d.id;
        delete d.studentId;
        delete d.courseId;
        delete d.courseName;
        delete d.studentName;
        delete d.department;
        // Skip if missing required regId
        if (!d.regId) {
          d = null;
        }
        break;
      }
      case 'Assignment':
      case 'Document': {
        if (d.courseId) {
          const course = await resolveCourseById(d.courseId);
          if (course) d.courseRef = course._id;
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
  if (!Array.isArray(docs)) {
    throw new TypeError(`${Model.modelName} data must be an array`);
  }

  // Resolve and validate the complete replacement before touching live rows.
  // This prevents malformed payloads from emptying a collection.
  const mapped = docs.length ? await prepareDocumentsForModel(Model, docs) : [];
  for (const item of mapped) {
    await new Model(item).validate();
  }

  await Model.deleteMany({});
  if (mapped.length === 0) return;
  const inserted = await Model.insertMany(mapped);

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
};

const collectionModels = [
  ['departmentsData', Department],
  ['users', User],
  ['teachersData', Teacher],
  ['studentsData', Student],
  ['subjectsData', Course],
  ['openRegistrationsData', OpenRegistration],
  ['studentRegistrationsData', StudentRegistration],
  ['assignmentsData', Assignment],
  ['documentsData', Document],
];

let initializationPromise = null;

const ensureAuthInitialized = () => {
  if (!initializationPromise) {
    initializationPromise = (async () => {
      const [userCount, studentCount, departmentCount] = await Promise.all([
        User.estimatedDocumentCount(),
        Student.estimatedDocumentCount(),
        Department.estimatedDocumentCount(),
      ]);
      const isEmpty = userCount === 0 && studentCount === 0 && departmentCount === 0;

      if (isEmpty) {
        await replaceCollection(User, defaultAuthData.users);
        await replaceCollection(Department, defaultAuthData.departmentsData);
      }

      // Seed/migration work is intentionally executed once per backend process,
      // never on every GET request.
      await ensureSeedAccounts();
      await cleanupLegacyFields();
    })().catch((error) => {
      initializationPromise = null;
      throw error;
    });
  }
  return initializationPromise;
};

router.post('/login', async (req, res) => {
  try {
    await ensureAuthInitialized();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!email || !password) {
      return res.status(400).json({ error: 'Email và mật khẩu là bắt buộc' });
    }

    const user = await User.findOne({ email, password }).lean();
    if (!user) {
      return res.status(401).json({ error: 'Email hoặc mật khẩu không chính xác' });
    }

    let profile = null;
    if (user.role === 'giao-vien') {
      profile = await Teacher.findOne({ $or: [{ userId: user._id }, { email }] }).lean();
    } else if (user.role === 'sinh-vien') {
      profile = await Student.findOne({ $or: [{ userId: user._id }, { email }] }).lean();
    }

    res.json({ user, profile });
  } catch (error) {
    console.error('POST /api/auth/login error:', error);
    res.status(500).json({ error: 'Lỗi khi đăng nhập' });
  }
});

router.get('/status', async (req, res) => {
  try {
    await ensureAuthInitialized();
    const email = String(req.query.email || '').trim().toLowerCase();
    const role = String(req.query.role || '').trim();
    if (!email || !role) {
      return res.status(400).json({ error: 'Email và vai trò là bắt buộc' });
    }

    const account = await User.findOne({ email, role })
      .select('email role status lockReason')
      .lean();
    res.json({ account });
  } catch (error) {
    console.error('GET /api/auth/status error:', error);
    res.status(500).json({ error: 'Lỗi khi kiểm tra trạng thái tài khoản' });
  }
});

let collectionUpdateQueue = Promise.resolve();

// Update only the collections supplied by the client. This keeps the legacy
// normalization rules while avoiding a full read + replacement of all data.
router.put('/collections', async (req, res) => {
  try {
    const body = req.body || {};
    const updates = collectionModels.filter(([field]) => Object.prototype.hasOwnProperty.call(body, field));
    if (!updates.length) {
      return res.status(400).json({ error: 'Không có collection hợp lệ để cập nhật' });
    }

    const invalidField = updates.find(([field]) => !Array.isArray(body[field]));
    if (invalidField) {
      return res.status(400).json({ error: `${invalidField[0]} phải là một mảng` });
    }

    // Serialize replacements across all clients so delete/insert phases cannot
    // overlap and produce transient duplicate-key errors or empty reads.
    const operation = collectionUpdateQueue
      .catch(() => undefined)
      .then(async () => {
        for (const [field, Model] of updates) {
          await replaceCollection(Model, body[field]);
        }

        if (updates.some(([field]) => field === 'teachersData' || field === 'studentsData')) {
          await cleanupOrphanAccounts();
        }
        if (updates.some(([field]) => field === 'users')) {
          await ensureSeedAccounts();
        }
      });
    collectionUpdateQueue = operation;
    await operation;

    res.json({ success: true, updatedFields: updates.map(([field]) => field) });
  } catch (error) {
    console.error('PUT /api/auth/collections error:', error);
    res.status(500).json({ error: 'Lỗi khi cập nhật dữ liệu' });
  }
});

router.get('/', async (req, res) => {
  try {
    await ensureAuthInitialized();
    // GET is now read-only and scans each collection exactly once.
    res.json(await getAuthData());
  } catch (error) {
    console.error('GET /api/auth error:', error);
    res.status(500).json({ error: 'Lỗi khi tải dữ liệu xác thực' });
  }
});

// Kept for backward compatibility. New frontend writes use /collections.
router.put('/', async (req, res) => {
  try {
    const body = req.body || {};
    await replaceCollection(Department, body.departmentsData || []);
    await replaceCollection(User, body.users || []);
    await replaceCollection(Teacher, body.teachersData || []);
    await replaceCollection(Student, body.studentsData || []);
    await replaceCollection(Course, body.subjectsData || []);
    await replaceCollection(OpenRegistration, body.openRegistrationsData || []);
    await replaceCollection(StudentRegistration, body.studentRegistrationsData || []);
    await replaceCollection(Assignment, body.assignmentsData || []);
    await replaceCollection(Document, body.documentsData || []);
    await cleanupOrphanAccounts();
    await cleanupLegacyFields();
    await ensureSeedAccounts();
    res.json(await getAuthData());
  } catch (error) {
    console.error('PUT /api/auth error:', error);
    res.status(500).json({ error: 'Lỗi khi lưu dữ liệu xác thực' });
  }
});

export default router;
