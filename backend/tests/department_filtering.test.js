import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from './helpers/testApp.js';
import { createUser, authHeader } from './helpers/factories.js';
import { ROLES } from '../src/lib/roles.js';
import { hashPassword } from '../src/lib/password.js';
import { signToken } from '../src/lib/jwt.js';
import { User } from '../src/modules/auth/user.model.js';
import { Student } from '../src/modules/students/student.model.js';
import { Department } from '../src/modules/departments/department.model.js';
import { Course } from '../src/modules/courses/course.model.js';
import { CourseClass } from '../src/modules/classes/courseClass.model.js';
import { todayDateString } from '../src/lib/dateOnly.js';

function addDays(date, days) {
  const result = new Date(`${date}T00:00:00.000Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

async function makeStudent(idNum, departmentName, deptDoc = null) {
  const email = `sv${idNum}@edu.vn`;
  const user = await User.create({
    email,
    passwordHash: await hashPassword('Passw0rd123'),
    role: ROLES.STUDENT,
    hoTen: `Sinh Viên ${idNum}`,
    department: departmentName,
    khoa: departmentName,
  });
  const student = await Student.create({
    userId: user._id,
    id: idNum,
    email,
    hoTen: `Sinh Viên ${idNum}`,
    department: departmentName,
    departmentRef: deptDoc?._id || null,
  });
  user.student = student._id;
  await user.save();
  return { token: signToken(user), user, student };
}

describe('Department Filtering for Open Classes and Enrollments', () => {
  let adminToken;
  let deptHoa;
  let deptNna;
  let studentHoa;
  let studentNna;
  let classHoa;
  let classNna;

  beforeEach(async () => {
    const admin = await createUser({ role: ROLES.ADMIN });
    adminToken = admin.token;

    deptHoa = await Department.create({ id: 'HOA', name: 'Khoa Hóa Học' });
    deptNna = await Department.create({ id: 'NNA', name: 'Khoa Ngôn Ngữ Anh' });

    studentHoa = await makeStudent(201, 'Khoa Hóa Học', deptHoa);
    studentNna = await makeStudent(202, 'Khoa Ngôn Ngữ Anh', deptNna);

    const courseHoa = await Course.create({
      id: 'HOA101',
      name: 'Hóa Đại Cương',
      credits: 3,
      department: 'Khoa Hóa Học',
      departmentRef: deptHoa._id,
    });

    const courseNna = await Course.create({
      id: 'ENG101',
      name: 'Tiếng Anh Thương Mại',
      credits: 3,
      department: 'Khoa Ngôn Ngữ Anh',
      departmentRef: deptNna._id,
    });

    const window = {
      status: 'Đang mở',
      registrationStart: todayDateString(),
      registrationEnd: addDays(todayDateString(), 15),
      studyStart: '2026-02-01',
      studyEnd: '2026-06-01',
    };

    classHoa = await CourseClass.create({
      id: 'HOA101-01',
      courseRef: courseHoa._id,
      courseId: courseHoa.id,
      courseName: courseHoa.name,
      department: 'Khoa Hóa Học',
      schedules: [{ dayId: '2', shiftId: 'S1' }],
      ...window,
    });

    classNna = await CourseClass.create({
      id: 'ENG101-01',
      courseRef: courseNna._id,
      courseId: courseNna.id,
      courseName: courseNna.name,
      department: 'Khoa Ngôn Ngữ Anh',
      schedules: [{ dayId: '3', shiftId: 'S2' }],
      ...window,
    });
  });

  describe('GET /api/classes/open department filtering', () => {
    it('only returns classes belonging to the student department for Chemistry student', async () => {
      const res = await request(app).get('/api/classes/open').set(authHeader(studentHoa.token));
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].id).toBe('HOA101-01');
      expect(res.body.data[0].department).toBe('Khoa Hóa Học');
    });

    it('only returns classes belonging to the student department for English student', async () => {
      const res = await request(app).get('/api/classes/open').set(authHeader(studentNna.token));
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].id).toBe('ENG101-01');
      expect(res.body.data[0].department).toBe('Khoa Ngôn Ngữ Anh');
    });

    it('returns all open classes for Admin regardless of department', async () => {
      const res = await request(app).get('/api/classes/open').set(authHeader(adminToken));
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      const classIds = res.body.data.map((c) => c.id);
      expect(classIds).toContain('HOA101-01');
      expect(classIds).toContain('ENG101-01');
    });
  });

  describe('POST /api/enrollments department guard', () => {
    it('blocks student from registering for a class of another department with 400', async () => {
      const res = await request(app)
        .post('/api/enrollments')
        .set(authHeader(studentHoa.token))
        .send({ classId: classNna._id });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/thuộc khoa của mình/);
    });

    it('allows student to register for a class belonging to their own department', async () => {
      const res = await request(app)
        .post('/api/enrollments')
        .set(authHeader(studentHoa.token))
        .send({ classId: classHoa._id });

      expect(res.status).toBe(201);
      expect(res.body.classId).toBe('HOA101-01');
    });
  });

  describe('User department and khoa fields in auth', () => {
    it('returns user.department and user.khoa on /api/auth/me', async () => {
      const res = await request(app).get('/api/auth/me').set(authHeader(studentHoa.token));
      expect(res.status).toBe(200);
      expect(res.body.user.department).toBe('Khoa Hóa Học');
      expect(res.body.user.khoa).toBe('Khoa Hóa Học');
      expect(res.body.profile.department).toBe('Khoa Hóa Học');
    });
  });
});

