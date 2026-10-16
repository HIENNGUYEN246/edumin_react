import mongoose from 'mongoose';
import { config } from '../config/env.js';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { hashPassword } from '../lib/password.js';
import { ROLES } from '../lib/roles.js';
import { User } from '../modules/auth/user.model.js';
import { Department } from '../modules/departments/department.model.js';
import { Counter } from '../modules/shared/counter.model.js';
import { Course } from '../modules/courses/course.model.js';
import { CourseClass } from '../modules/classes/courseClass.model.js';
import { Enrollment } from '../modules/enrollments/enrollment.model.js';
import { createTeacher } from '../modules/teachers/teacher.service.js';
import { createStudent } from '../modules/students/student.service.js';
import { Tuition } from '../modules/tuition/tuition.model.js';

const DEFAULT_DEPARTMENTS = [
  { id: 'CNTT', name: 'Khoa Công Nghệ Thông Tin' },
  { id: 'NNA', name: 'Khoa Ngôn Ngữ Anh' },
  { id: 'CNTP', name: 'Khoa Công Nghiệp Thực Phẩm' },
];

const SAMPLE_TEACHERS = [
  { hoTen: 'Trần Minh Quân', email: 'quan.tran@edu.vn', departmentId: 'CNTT', phone: '0901000001', education: 'Tiến sĩ' },
  { hoTen: 'Lê Thu Hà', email: 'ha.le@edu.vn', departmentId: 'NNA', phone: '0901000002', education: 'Thạc sĩ' },
];

const SAMPLE_STUDENTS = [
  { hoTen: 'Nguyễn Văn An', email: 'an.nguyen@edu.vn', departmentId: 'CNTT', className: 'CNTT-K18' },
  { hoTen: 'Phạm Thị Bình', email: 'binh.pham@edu.vn', departmentId: 'CNTT', className: 'CNTT-K18' },
  { hoTen: 'Đỗ Quốc Cường', email: 'cuong.do@edu.vn', departmentId: 'NNA', className: 'NNA-K19' },
];

const SAMPLE_COURSES = [
  { id: 'IT101', name: 'Nhập môn lập trình', credits: 3, fee: 1500000, departmentId: 'CNTT' },
  { id: 'IT202', name: 'Cấu trúc dữ liệu và giải thuật', credits: 4, fee: 2000000, departmentId: 'CNTT' },
  { id: 'EN101', name: 'Tiếng Anh cơ bản', credits: 2, fee: 1000000, departmentId: 'NNA' },
];

async function resetCollections() {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
  await Counter.deleteMany({});
}

const SEED_PASSWORD = 'Edu@123456';

export async function seed({ withSamples = true } = {}) {
  await resetCollections();

  const admin = await User.create({
    email: config.SEED_ADMIN_EMAIL,
    passwordHash: await hashPassword(config.SEED_ADMIN_PASSWORD),
    role: ROLES.ADMIN,
    hoTen: 'Quản trị viên',
    status: 'Active',
  });

  const accountant = await User.create({
    email: 'ketoan@edu.vn',
    passwordHash: await hashPassword(SEED_PASSWORD),
    role: ROLES.ACCOUNTANT,
    hoTen: 'Võ Thị Kế Toán',
    status: 'Active',
  });

  await Department.insertMany(DEFAULT_DEPARTMENTS);

  if (!withSamples) {
    return { adminEmail: admin.email, accountantEmail: accountant.email, departments: DEFAULT_DEPARTMENTS.length };
  }

  const teachers = [];
  for (const t of SAMPLE_TEACHERS) {
    teachers.push(await createTeacher({ ...t, password: SEED_PASSWORD }));
  }
  const students = [];
  for (const s of SAMPLE_STUDENTS) {
    students.push(await createStudent({ ...s, password: SEED_PASSWORD }));
  }
  for (const c of SAMPLE_COURSES) {
    const dept = await Department.findOne({ id: c.departmentId });
    const course = new Course({ id: c.id, name: c.name, credits: c.credits, fee: c.fee });
    if (dept) {
      course.department = dept.name;
      course.departmentRef = dept._id;
    }
    await course.save();
  }

  // Helper to build a class from a course + teacher.
  const [teacher1, teacher2] = teachers;
  const makeClass = async (courseCode, suffix, teacher, schedules, extra = {}) => {
    const course = await Course.findOne({ id: courseCode });
    return CourseClass.create({
      id: `${courseCode}-${suffix}`,
      courseRef: course._id,
      courseId: course.id,
      courseName: course.name,
      department: course.department,
      credits: course.credits,
      fee: course.fee,
      teacherRef: teacher?._id || null,
      teacherId: teacher?.id ?? null,
      teacher: teacher?.hoTen || '',
      schedules,
      capacity: 40,
      studyStart: '2026-01-06',
      studyEnd: '2026-05-30',
      status: 'Đang mở',
      ...extra,
    });
  };

  // IT101: two open classes (A/B). IT202: one open + one draft. EN101: one open.
  const classes = await Promise.all([
    makeClass('IT101', '01', teacher1, [{ dayId: '2', shiftId: 'S1' }], { room: 'A101' }),
    makeClass('IT101', '02', teacher2, [{ dayId: '4', shiftId: 'S2' }], { room: 'A102' }),
    makeClass('IT202', '01', teacher1, [{ dayId: '3', shiftId: 'C1' }], { room: 'B201' }),
    makeClass('IT202', '02', teacher2, [{ dayId: '6', shiftId: 'C2' }], { room: 'B202', status: 'Nháp' }),
    makeClass('EN101', '01', teacher2, [{ dayId: '5', shiftId: 'S1' }], { room: 'C301' }),
  ]);

  // Enroll the first student into IT101-01.
  const student1 = students[0];
  await Enrollment.create({ student: student1._id, classRef: classes[0]._id, classId: classes[0].id });

  // Seed sample tuitions
  await Tuition.create([
    {
      student: students[0]._id,
      studentId: students[0].id,
      studentName: students[0].hoTen,
      studentEmail: students[0].email,
      className: students[0].className,
      department: students[0].department,
      semester: 'HK1 (2026-2027)',
      academicYear: '2026-2027',
      totalCredits: 3,
      amount: 4500000,
      discount: 500000,
      amountPaid: 4000000,
      amountDue: 0,
      status: 'Đã đóng',
      paidAt: new Date('2026-02-10'),
      paymentMethod: 'Chuyển khoản',
      transactions: [
        {
          transactionCode: 'VCB-20260210-001',
          amount: 4000000,
          paymentMethod: 'Chuyển khoản',
          paidAt: new Date('2026-02-10'),
          recordedBy: 'Võ Thị Kế Toán',
          note: 'Chuyển khoản VCB học phí HK1',
        },
      ],
    },
    {
      student: students[1]._id,
      studentId: students[1].id,
      studentName: students[1].hoTen,
      studentEmail: students[1].email,
      className: students[1].className,
      department: students[1].department,
      semester: 'HK1 (2026-2027)',
      academicYear: '2026-2027',
      totalCredits: 4,
      amount: 4500000,
      discount: 0,
      amountPaid: 2000000,
      amountDue: 2500000,
      status: 'Đang nợ',
      paidAt: new Date('2026-02-15'),
      paymentMethod: 'Chuyển khoản',
      transactions: [
        {
          transactionCode: 'TCB-20260215-089',
          amount: 2000000,
          paymentMethod: 'Chuyển khoản',
          paidAt: new Date('2026-02-15'),
          recordedBy: 'Võ Thị Kế Toán',
          note: 'Đóng đợt 1',
        },
      ],
    },
    {
      student: students[2]._id,
      studentId: students[2].id,
      studentName: students[2].hoTen,
      studentEmail: students[2].email,
      className: students[2].className,
      department: students[2].department,
      semester: 'HK1 (2026-2027)',
      academicYear: '2026-2027',
      totalCredits: 2,
      amount: 3500000,
      discount: 0,
      amountPaid: 0,
      amountDue: 3500000,
      status: 'Chưa đóng',
    },
  ]);

  return {
    adminEmail: admin.email,
    departments: DEFAULT_DEPARTMENTS.length,
    teachers: teachers.length,
    students: students.length,
    courses: SAMPLE_COURSES.length,
    classes: classes.length,
    samplePassword: SEED_PASSWORD,
  };
}

// Only run when invoked directly (not when imported by tests).
const isDirectRun = process.argv[1] && process.argv[1].endsWith('seed.js');
if (isDirectRun) {
  const force = process.argv.includes('--force');
  if (config.isProduction && !force) {
    console.error('Refusing to seed in production without --force.');
    process.exit(1);
  }
  connectDatabase()
    .then(async () => {
      const result = await seed({ withSamples: !process.argv.includes('--minimal') });
      console.log('Seed complete:', result);
      console.log(`\nAdmin login: ${config.SEED_ADMIN_EMAIL} / ${config.SEED_ADMIN_PASSWORD}`);
      if (result.samplePassword) {
        console.log(`Sample teacher/student password: ${result.samplePassword}`);
      }
    })
    .catch((error) => {
      console.error('Seed failed:', error);
      process.exitCode = 1;
    })
    .finally(() => disconnectDatabase());
}

export default seed;
