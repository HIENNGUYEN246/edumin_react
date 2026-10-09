import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from './helpers/testApp.js';
import { createUser, authHeader } from './helpers/factories.js';
import { ROLES } from '../src/lib/roles.js';
import { Course } from '../src/modules/courses/course.model.js';
import { Teacher } from '../src/modules/teachers/teacher.model.js';
import { User } from '../src/modules/auth/user.model.js';
import { CourseClass } from '../src/modules/classes/courseClass.model.js';
import { currentDateTimeString, todayDateString } from '../src/lib/dateOnly.js';

let adminToken;
beforeEach(async () => {
  const { token } = await createUser({ role: ROLES.ADMIN });
  adminToken = token;
  await Course.create({ id: 'IT101', name: 'Lập trình', credits: 3, fee: 1000000, department: 'CNTT' });
  const teacherUser = await User.create({
    email: 'gv.default@edu.vn',
    passwordHash: 'x',
    role: ROLES.TEACHER,
    hoTen: 'GV mặc định',
  });
  await Teacher.create({
    userId: teacherUser._id,
    id: 96,
    email: 'gv.default@edu.vn',
    hoTen: 'GV mặc định',
    department: 'CNTT',
  });
  const secondTeacherUser = await User.create({
    email: 'gv.second@edu.vn',
    passwordHash: 'x',
    role: ROLES.TEACHER,
    hoTen: 'GV thứ hai',
  });
  await Teacher.create({
    userId: secondTeacherUser._id,
    id: 95,
    email: 'gv.second@edu.vn',
    hoTen: 'GV thứ hai',
    department: 'CNTT',
  });
});

const baseClass = (overrides = {}) => {
  const registrationStart = overrides.registrationStart || addMinutes(currentDateTimeString(), 5);
  const registrationEnd = overrides.registrationEnd || addDays(registrationStart, 5);
  const studyStart = overrides.studyStart || addCalendarDays(registrationEnd.slice(0, 10), 1);
  const studyEnd = overrides.studyEnd || addCalendarDays(studyStart, 105);
  return {
    id: 'IT101-01',
    courseId: 'IT101',
    className: 'Lớp lập trình cơ bản',
    teacherId: 96,
    room: 'A1',
    capacity: 10,
    schedules: [{ dayId: '2', shiftId: 'S1' }],
    studyStart,
    studyEnd,
    registrationStart,
    registrationEnd,
    status: 'Đang mở',
    ...overrides,
  };
};

function addCalendarDays(date, days) {
  const result = new Date(`${date}T00:00:00.000Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const result = new Date(`${date.slice(0, 10)}T00:00:00.000Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return `${result.toISOString().slice(0, 10)}T${date.slice(11, 16)}`;
}

function addMinutes(date, minutes) {
  const result = new Date(`${date.slice(0, 16)}:00Z`);
  result.setUTCMinutes(result.getUTCMinutes() + minutes);
  return result.toISOString().slice(0, 16);
}

describe('Course classes', () => {
  it('creates a class from a course', async () => {
    const payload = baseClass();
    const res = await request(app).post('/api/classes').set(authHeader(adminToken)).send(payload);
    expect(res.status).toBe(201);
    expect(res.body.courseName).toBe('Lập trình');
    expect(res.body.className).toBe(payload.className);
    expect(res.body.credits).toBe(3);
    expect(res.body.registrationStart).toBe(payload.registrationStart);
    expect(res.body.registrationEnd).toBe(payload.registrationEnd);
  });

  it('rejects a room conflict with 409', async () => {
    await request(app).post('/api/classes').set(authHeader(adminToken)).send(baseClass());
    const res = await request(app)
      .post('/api/classes')
      .set(authHeader(adminToken))
      .send(baseClass({ id: 'IT101-02', room: 'a1', teacherId: 95 }));
    expect(res.status).toBe(409);
    expect(res.body.error.message).toContain('Lớp lập trình cơ bản');
    expect(res.body.error.message).toContain('GV mặc định');
  });

  it('rejects a required class field when it is missing or blank', async () => {
    const payload = baseClass();
    delete payload.teacherId;
    delete payload.className;
    payload.room = '  ';
    const missingTeacher = await request(app)
      .post('/api/classes')
      .set(authHeader(adminToken))
      .send(payload);
    expect(missingTeacher.status).toBe(400);
    expect(missingTeacher.body.error.details).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'teacherId' }),
      expect.objectContaining({ path: 'className' }),
      expect.objectContaining({ path: 'room' }),
    ]));
  });

  it('rejects a maximum capacity below 10', async () => {
    const res = await request(app)
      .post('/api/classes')
      .set(authHeader(adminToken))
      .send(baseClass({ capacity: 9 }));
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'capacity' }),
    ]));
  });

  it('rejects a teacher conflict on the same schedule slot', async () => {
    const user = await User.create({
      email: 'gv.lichday@edu.vn',
      passwordHash: 'x',
      role: ROLES.TEACHER,
      hoTen: 'GV Lịch Dạy',
    });
    const teacher = await Teacher.create({
      userId: user._id,
      id: 97,
      email: 'gv.lichday@edu.vn',
      hoTen: 'GV Lịch Dạy',
      department: 'CNTT',
    });
    await request(app).post('/api/classes').set(authHeader(adminToken)).send(baseClass({ teacherId: teacher.id }));
    const res = await request(app)
      .post('/api/classes')
      .set(authHeader(adminToken))
      .send(baseClass({ id: 'IT101-02', room: 'B2', teacherId: teacher.id }));
    expect(res.status).toBe(409);
    expect(res.body.error.message).toContain('GV Lịch Dạy');
    expect(res.body.error.message).toContain('Lớp lập trình cơ bản');
  });

  it('allows a second class in a different room/slot', async () => {
    await request(app).post('/api/classes').set(authHeader(adminToken)).send(baseClass());
    const res = await request(app)
      .post('/api/classes')
      .set(authHeader(adminToken))
      .send(baseClass({ id: 'IT101-02', room: 'B2', schedules: [{ dayId: '3', shiftId: 'C1' }] }));
    expect(res.status).toBe(201);
  });

  it('lists open classes within the registration window', async () => {
    const created = await request(app).post('/api/classes').set(authHeader(adminToken)).send(baseClass());
    await CourseClass.findByIdAndUpdate(created.body._id, {
      registrationStart: addMinutes(currentDateTimeString(), -1),
    });
    const { token } = await createUser({ role: ROLES.STUDENT });
    const res = await request(app).get('/api/classes/open').set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('does not list a class before registration starts', async () => {
    const regStart = addDays(addMinutes(currentDateTimeString(), 5), 1);
    const regEnd = addDays(regStart, 5);
    const studyStart = addCalendarDays(regEnd.slice(0, 10), 1);
    await request(app).post('/api/classes').set(authHeader(adminToken)).send(baseClass({
      registrationStart: regStart,
      registrationEnd: regEnd,
      studyStart,
      studyEnd: addCalendarDays(studyStart, 105),
    }));
    const { token } = await createUser({ role: ROLES.STUDENT });
    const res = await request(app).get('/api/classes/open').set(authHeader(token));
    expect(res.body.data).toHaveLength(0);
  });

  it('closes an open class after its registration end date', async () => {
    const created = await request(app).post('/api/classes').set(authHeader(adminToken)).send(baseClass());
    expect(created.status).toBe(201);
    await CourseClass.findByIdAndUpdate(created.body._id, {
      registrationStart: '2026-10-01T06:00',
      registrationEnd: '2026-10-08T08:00',
    });
    const { token } = await createUser({ role: ROLES.STUDENT });
    const res = await request(app).get('/api/classes/open').set(authHeader(token));
    expect(res.body.data).toHaveLength(0);
    const closed = await request(app).get(`/api/classes/${created.body._id}`).set(authHeader(adminToken));
    expect(closed.body.status).toBe('Đã đóng');
  });

  it('rejects invalid registration date ranges', async () => {
    const res = await request(app).post('/api/classes').set(authHeader(adminToken)).send(baseClass({
      registrationStart: addDays(addMinutes(currentDateTimeString(), 5), 2),
      registrationEnd: addDays(addMinutes(currentDateTimeString(), 5), 1),
    }));
    expect(res.status).toBe(400);
  });

  it('rejects registration windows with the same start and end time', async () => {
    const start = addMinutes(currentDateTimeString(), 5);
    const res = await request(app).post('/api/classes').set(authHeader(adminToken)).send(baseClass({
      registrationStart: start,
      registrationEnd: start,
    }));
    expect(res.status).toBe(400);
  });

  it('rejects impossible calendar dates', async () => {
    const res = await request(app).post('/api/classes').set(authHeader(adminToken)).send(baseClass({
      registrationStart: '2026-02-30T06:00',
    }));
    expect(res.status).toBe(400);
  });

  it('rejects an invalid registration time', async () => {
    const res = await request(app).post('/api/classes').set(authHeader(adminToken)).send(baseClass({
      registrationStart: '2026-10-10T25:90',
      registrationEnd: '2026-10-11T08:00',
    }));
    expect(res.status).toBe(400);
  });

  it('rejects a registration start time in the past', async () => {
    const res = await request(app).post('/api/classes').set(authHeader(adminToken)).send(baseClass({
      registrationStart: '2026-10-01T06:00',
      registrationEnd: '2026-10-10T08:00',
    }));
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/không được ở quá khứ/);
  });

  it('forbids a student from creating a class', async () => {
    const { token } = await createUser({ role: ROLES.STUDENT });
    const res = await request(app).post('/api/classes').set(authHeader(token)).send(baseClass());
    expect(res.status).toBe(403);
  });

  it('validates schedules are present', async () => {
    const res = await request(app)
      .post('/api/classes')
      .set(authHeader(adminToken))
      .send(baseClass({ schedules: [] }));
    expect(res.status).toBe(400);
  });

  it('hides draft (Nháp) classes from the open list', async () => {
    await request(app).post('/api/classes').set(authHeader(adminToken)).send(baseClass({ status: 'Nháp' }));
    const { token } = await createUser({ role: ROLES.STUDENT });
    const res = await request(app).get('/api/classes/open').set(authHeader(token));
    expect(res.body.data).toHaveLength(0);
  });

  it('changes class status via PATCH /:id/status', async () => {
    const created = await request(app).post('/api/classes').set(authHeader(adminToken)).send(baseClass({ status: 'Nháp' }));
    const res = await request(app)
      .patch(`/api/classes/${created.body._id}/status`)
      .set(authHeader(adminToken))
      .send({ status: 'Đang mở' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('Đang mở');
  });

  it('lists classes of a course with enrolledCount and capacity', async () => {
    await request(app).post('/api/classes').set(authHeader(adminToken)).send(baseClass({ capacity: 40 }));
    const res = await request(app).get('/api/classes/by-course/IT101').set(authHeader(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].capacity).toBe(40);
    expect(res.body.data[0].enrolledCount).toBe(0);
  });

  it('auto-generates class id when id is omitted', async () => {
    const res1 = await request(app)
      .post('/api/classes')
      .set(authHeader(adminToken))
      .send(baseClass({ id: undefined, room: 'C10' }));
    expect(res1.status).toBe(201);
    expect(res1.body.id).toBe('IT101-01');

    const res2 = await request(app)
      .post('/api/classes')
      .set(authHeader(adminToken))
      .send(baseClass({ id: undefined, room: 'C20', schedules: [{ dayId: '3', shiftId: 'C1' }] }));
    expect(res2.status).toBe(201);
    expect(res2.body.id).toBe('IT101-02');
  });

  it('provides next auto-generated code via GET /api/classes/next-code', async () => {
    await request(app).post('/api/classes').set(authHeader(adminToken)).send(baseClass());
    const res = await request(app)
      .get('/api/classes/next-code?courseId=IT101')
      .set(authHeader(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.data.nextCode).toBe('IT101-02');
  });

  it('rejects class creation when studyEnd is less than 15 weeks from studyStart', async () => {
    const registrationStart = addMinutes(currentDateTimeString(), 5);
    const registrationEnd = addDays(registrationStart, 2);
    const studyStart = addCalendarDays(registrationEnd.slice(0, 10), 1);
    const res = await request(app)
      .post('/api/classes')
      .set(authHeader(adminToken))
      .send(baseClass({
        registrationStart,
        registrationEnd,
        studyStart,
        studyEnd: addCalendarDays(studyStart, 14),
      }));
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'studyEnd' }),
    ]));
  });

  it('rejects class creation when studyStart is on or before registrationEnd', async () => {
    const registrationStart = addMinutes(currentDateTimeString(), 5);
    const registrationEnd = addDays(registrationStart, 5);
    // On the same date
    const resSame = await request(app)
      .post('/api/classes')
      .set(authHeader(adminToken))
      .send(baseClass({
        registrationStart,
        registrationEnd,
        studyStart: registrationEnd.slice(0, 10),
      }));
    expect(resSame.status).toBe(400);
    expect(resSame.body.error.details).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'studyStart' }),
    ]));

    // Before registrationEnd
    const resBefore = await request(app)
      .post('/api/classes')
      .set(authHeader(adminToken))
      .send(baseClass({
        registrationStart,
        registrationEnd,
        studyStart: registrationStart.slice(0, 10),
      }));
    expect(resBefore.status).toBe(400);
    expect(resBefore.body.error.details).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'studyStart' }),
    ]));
  });

  it('accepts date-only format (YYYY-MM-DD) for registrationStart and registrationEnd', async () => {
    const today = todayDateString();
    const regStart = today;
    const regEnd = addCalendarDays(today, 5);
    const studyStart = addCalendarDays(regEnd, 1);
    const res = await request(app)
      .post('/api/classes')
      .set(authHeader(adminToken))
      .send(baseClass({
        id: 'IT101-09',
        room: 'D10',
        registrationStart: regStart,
        registrationEnd: regEnd,
        studyStart,
        studyEnd: addCalendarDays(studyStart, 105),
      }));
    expect(res.status).toBe(201);
    expect(res.body.registrationStart).toBe(regStart);
    expect(res.body.registrationEnd).toBe(regEnd);
  });

  it('rejects assigning a teacher from a different department to the course class', async () => {
    // IT101 has department: 'CNTT'
    const user = await User.create({ email: 'gv.kinhte@edu.vn', passwordHash: 'x', role: ROLES.TEACHER, hoTen: 'GV Kinh Tế' });
    const teacher = await Teacher.create({ userId: user._id, id: 99, email: 'gv.kinhte@edu.vn', hoTen: 'GV Kinh Tế', department: 'Kinh tế' });

    const res = await request(app)
      .post('/api/classes')
      .set(authHeader(adminToken))
      .send(baseClass({ teacherId: teacher.id }));
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/không thuộc khoa/);
  });

  it('allows assigning a teacher from the same department', async () => {
    const user = await User.create({ email: 'gv.cntt@edu.vn', passwordHash: 'x', role: ROLES.TEACHER, hoTen: 'GV CNTT' });
    const teacher = await Teacher.create({ userId: user._id, id: 98, email: 'gv.cntt@edu.vn', hoTen: 'GV CNTT', department: 'CNTT' });

    const res = await request(app)
      .post('/api/classes')
      .set(authHeader(adminToken))
      .send(baseClass({ teacherId: teacher.id }));
    expect(res.status).toBe(201);
    expect(res.body.teacher).toBe('GV CNTT');
  });

  it('rejects creating class if gradeWeights sum does not equal 100%', async () => {
    const res = await request(app)
      .post('/api/classes')
      .set(authHeader(adminToken))
      .send(baseClass({
        id: 'IT101-99',
        room: 'D99',
        gradeWeights: {
          attendance: 10,
          homework: 10,
          midterm: 20,
          presentation: 0,
          final: 50, // sum is 90%
        },
      }));
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path: 'gradeWeights',
        message: expect.stringMatching(/Tổng tỷ lệ phần trăm trọng số điểm phải bằng đúng 100%/),
      }),
    ]));
  });

  it('accepts and stores custom gradeWeights that sum to 100%', async () => {
    const customWeights = {
      attendance: 15,
      homework: 15,
      midterm: 20,
      presentation: 10,
      final: 40,
    };
    const res = await request(app)
      .post('/api/classes')
      .set(authHeader(adminToken))
      .send(baseClass({
        id: 'IT101-88',
        room: 'D88',
        gradeWeights: customWeights,
      }));
    expect(res.status).toBe(201);
    expect(res.body.gradeWeights).toMatchObject(customWeights);
  });
});
