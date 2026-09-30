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

  await Department.insertMany(DEFAULT_DEPARTMENTS);

  if (!withSamples) {
    return { adminEmail: admin.email, departments: DEFAULT_DEPARTMENTS.length };
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

  // Open one class with a wide registration window so enrollment is testable.
  const it101 = await Course.findOne({ id: 'IT101' });
  const teacher1 = teachers[0];
  const openClass = await CourseClass.create({
    id: 'IT101-01',
    courseRef: it101._id,
    courseId: it101.id,
    courseName: it101.name,
    department: it101.department,
    credits: it101.credits,
    fee: it101.fee,
    teacherRef: teacher1._id,
    teacherId: teacher1.id,
    teacher: teacher1.hoTen,
    room: 'A101',
    schedules: [{ dayId: '2', shiftId: 'S1' }],
    studyStart: '2026-01-06',
    studyEnd: '2026-05-30',
    start: '2020-01-01',
    end: '2030-01-01',
    status: 'Đang mở',
  });

  // Enroll the first student.
  const student1 = students[0];
  await Enrollment.create({ student: student1._id, classRef: openClass._id, classId: openClass.id });

  return {
    adminEmail: admin.email,
    departments: DEFAULT_DEPARTMENTS.length,
    teachers: teachers.length,
    students: students.length,
    courses: SAMPLE_COURSES.length,
    classes: 1,
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
