import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from './helpers/testApp.js';
import { createUser, authHeader } from './helpers/factories.js';
import { ROLES } from '../src/lib/roles.js';
import { hashPassword } from '../src/lib/password.js';
import { signToken } from '../src/lib/jwt.js';
import { User } from '../src/modules/auth/user.model.js';
import { Student } from '../src/modules/students/student.model.js';
import { Course } from '../src/modules/courses/course.model.js';
import { CourseClass } from '../src/modules/classes/courseClass.model.js';
import { Enrollment } from '../src/modules/enrollments/enrollment.model.js';
import { todayDateString } from '../src/lib/dateOnly.js';

// Build a student account linked to a Student profile and return a token.
async function makeStudent(idNum = 1, email = `sv${idNum}@edu.vn`) {
  const user = await User.create({
    email,
    passwordHash: await hashPassword('Passw0rd'),
    role: ROLES.STUDENT,
    hoTen: `SV ${idNum}`,
  });
  const student = await Student.create({ userId: user._id, id: idNum, email, hoTen: `SV ${idNum}` });
  user.student = student._id;
  await user.save();
  return { token: signToken(user), student };
}

function addDays(date, days) {
  const result = new Date(`${date}T00:00:00.000Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

const openWindow = {
  status: 'Đang mở',
  registrationStart: todayDateString(),
  registrationEnd: addDays(todayDateString(), 30),
};

async function makeClass(id, slots, overrides = {}) {
  const courseId = overrides.courseId || 'IT101';
  const course = await Course.findOne({ id: courseId });
  const { courseId: _c, ...rest } = overrides;
  void _c;
  return CourseClass.create({
    id,
    courseRef: course._id,
    courseId: course.id,
    courseName: course.name,
    schedules: slots,
    studyStart: '2026-01-01',
    studyEnd: '2026-06-01',
    ...openWindow,
    ...rest,
  });
}

let adminToken;
beforeEach(async () => {
  const { token } = await createUser({ role: ROLES.ADMIN });
  adminToken = token;
  await Course.create({ id: 'IT101', name: 'Lập trình' });
  await Course.create({ id: 'IT202', name: 'Cấu trúc dữ liệu' });
});

describe('Enrollments', () => {
  it('enrolls a student into an open class', async () => {
    const { token } = await makeStudent();
    const cls = await makeClass('IT101-01', [{ dayId: '2', shiftId: 'S1' }]);
    const res = await request(app).post('/api/enrollments').set(authHeader(token)).send({ classId: cls._id });
    expect(res.status).toBe(201);
    expect(res.body.classId).toBe('IT101-01');
  });

  it('rejects a duplicate enrollment', async () => {
    const { token } = await makeStudent();
    const cls = await makeClass('IT101-01', [{ dayId: '2', shiftId: 'S1' }]);
    await request(app).post('/api/enrollments').set(authHeader(token)).send({ classId: cls._id });
    const res = await request(app).post('/api/enrollments').set(authHeader(token)).send({ classId: cls._id });
    expect(res.status).toBe(409);
  });

  it('rejects enrolling into a class that is not open', async () => {
    const { token } = await makeStudent();
    const cls = await makeClass('IT101-01', [{ dayId: '2', shiftId: 'S1' }], { status: 'Đã đóng' });
    const res = await request(app).post('/api/enrollments').set(authHeader(token)).send({ classId: cls._id });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/không mở đăng ký/);
  });

  it('rejects enrolling before the registration window starts', async () => {
    const { token } = await makeStudent();
    const cls = await makeClass('IT101-01', [{ dayId: '2', shiftId: 'S1' }], {
      registrationStart: addDays(todayDateString(), 1),
    });
    const res = await request(app).post('/api/enrollments').set(authHeader(token)).send({ classId: cls._id });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/Chưa đến thời gian đăng ký/);
  });

  it('rejects a schedule clash with an existing enrollment (different courses, same slot)', async () => {
    const { token } = await makeStudent();
    const a = await makeClass('IT101-01', [{ dayId: '2', shiftId: 'S1' }]);
    const b = await makeClass('IT202-01', [{ dayId: '2', shiftId: 'S1' }], { courseId: 'IT202' });
    await request(app).post('/api/enrollments').set(authHeader(token)).send({ classId: a._id });
    const res = await request(app).post('/api/enrollments').set(authHeader(token)).send({ classId: b._id });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/trùng lịch/);
  });

  it('rejects a second class of the same course (one class per course)', async () => {
    const { token } = await makeStudent();
    const a = await makeClass('IT101-01', [{ dayId: '2', shiftId: 'S1' }]);
    const b = await makeClass('IT101-02', [{ dayId: '3', shiftId: 'C1' }]); // no slot clash
    await request(app).post('/api/enrollments').set(authHeader(token)).send({ classId: a._id });
    const res = await request(app).post('/api/enrollments').set(authHeader(token)).send({ classId: b._id });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/một lớp của học phần/);
  });

  it('rejects enrolling into a full class', async () => {
    const full = await makeClass('IT101-01', [{ dayId: '2', shiftId: 'S1' }], { capacity: 1 });
    const first = await makeStudent(1);
    await request(app).post('/api/enrollments').set(authHeader(first.token)).send({ classId: full._id });

    const second = await makeStudent(2);
    const res = await request(app).post('/api/enrollments').set(authHeader(second.token)).send({ classId: full._id });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/đủ sĩ số/);
  });

  it('lists my enrollments and lets me cancel', async () => {
    const { token } = await makeStudent();
    const cls = await makeClass('IT101-01', [{ dayId: '2', shiftId: 'S1' }]);
    await request(app).post('/api/enrollments').set(authHeader(token)).send({ classId: cls._id });

    const list = await request(app).get('/api/enrollments/me').set(authHeader(token));
    expect(list.body.data).toHaveLength(1);

    const cancel = await request(app).delete(`/api/enrollments/${cls._id}`).set(authHeader(token));
    expect(cancel.status).toBe(200);

    const after = await request(app).get('/api/enrollments/me').set(authHeader(token));
    expect(after.body.data).toHaveLength(0);
  });

  it('does not allow cancelling after registration closes', async () => {
    const { token, student } = await makeStudent();
    const cls = await makeClass('IT101-01', [{ dayId: '2', shiftId: 'S1' }], {
      registrationEnd: addDays(todayDateString(), -1),
    });
    await Enrollment.create({ student: student._id, classRef: cls._id, classId: cls.id });
    const res = await request(app).delete(`/api/enrollments/${cls._id}`).set(authHeader(token));
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/đóng đăng ký/);
    expect(await Enrollment.countDocuments({ classRef: cls._id })).toBe(1);
  });

  it('forbids a non-student from enrolling', async () => {
    void adminToken;
    const res = await request(app).post('/api/enrollments').set(authHeader(adminToken)).send({ classId: 'x' });
    expect(res.status).toBe(403);
  });
});
