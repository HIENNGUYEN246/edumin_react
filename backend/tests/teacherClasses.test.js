import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from './helpers/testApp.js';
import { createUser, authHeader } from './helpers/factories.js';
import { ROLES } from '../src/lib/roles.js';
import { hashPassword } from '../src/lib/password.js';
import { signToken } from '../src/lib/jwt.js';
import { User } from '../src/modules/auth/user.model.js';
import { Teacher } from '../src/modules/teachers/teacher.model.js';
import { Student } from '../src/modules/students/student.model.js';
import { Course } from '../src/modules/courses/course.model.js';
import { CourseClass } from '../src/modules/classes/courseClass.model.js';
import { Enrollment } from '../src/modules/enrollments/enrollment.model.js';

async function makeTeacher(idNum, email = `gv${idNum}@edu.vn`) {
  const user = await User.create({ email, passwordHash: await hashPassword('x'), role: ROLES.TEACHER, hoTen: `GV ${idNum}` });
  const teacher = await Teacher.create({ userId: user._id, id: idNum, email, hoTen: `GV ${idNum}` });
  user.teacher = teacher._id;
  await user.save();
  return { token: signToken(user), teacher };
}

let adminToken;
beforeEach(async () => {
  const { token } = await createUser({ role: ROLES.ADMIN });
  adminToken = token;
  await Course.create({ id: 'IT101', name: 'Lập trình' });
});

describe('Teacher class access', () => {
  it('returns the teacher profile at /teachers/me', async () => {
    const { token } = await makeTeacher(1);
    const res = await request(app).get('/api/teachers/me').set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(1);
  });

  it('scopes classes to the teacher with ?teacher=me', async () => {
    const { token, teacher } = await makeTeacher(1);
    const course = await Course.findOne({ id: 'IT101' });
    await CourseClass.create({ id: 'C1', courseRef: course._id, courseId: 'IT101', teacherRef: teacher._id, teacherId: 1, schedules: [{ dayId: '2', shiftId: 'S1' }] });
    await CourseClass.create({ id: 'C2', courseRef: course._id, courseId: 'IT101', schedules: [{ dayId: '3', shiftId: 'S1' }] });

    const res = await request(app).get('/api/classes?teacher=me').set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe('C1');
  });

  it('lets the owning teacher list class students', async () => {
    const { token, teacher } = await makeTeacher(1);
    const course = await Course.findOne({ id: 'IT101' });
    const cls = await CourseClass.create({ id: 'C1', courseRef: course._id, courseId: 'IT101', teacherRef: teacher._id, teacherId: 1, schedules: [{ dayId: '2', shiftId: 'S1' }] });

    const suser = await User.create({ email: 'sv@edu.vn', passwordHash: await hashPassword('x'), role: ROLES.STUDENT });
    const student = await Student.create({ userId: suser._id, id: 1, email: 'sv@edu.vn', hoTen: 'SV A' });
    await Enrollment.create({ student: student._id, classRef: cls._id, classId: 'C1' });

    const res = await request(app).get(`/api/classes/${cls._id}/students`).set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.students).toHaveLength(1);
    expect(res.body.students[0].hoTen).toBe('SV A');
  });

  it('forbids a teacher from viewing another teacher class students', async () => {
    const owner = await makeTeacher(1);
    const other = await makeTeacher(2);
    const course = await Course.findOne({ id: 'IT101' });
    const cls = await CourseClass.create({ id: 'C1', courseRef: course._id, courseId: 'IT101', teacherRef: owner.teacher._id, teacherId: 1, schedules: [{ dayId: '2', shiftId: 'S1' }] });

    const res = await request(app).get(`/api/classes/${cls._id}/students`).set(authHeader(other.token));
    expect(res.status).toBe(403);
  });

  it('lets admin view any class students', async () => {
    const owner = await makeTeacher(1);
    const course = await Course.findOne({ id: 'IT101' });
    const cls = await CourseClass.create({ id: 'C1', courseRef: course._id, courseId: 'IT101', teacherRef: owner.teacher._id, teacherId: 1, schedules: [{ dayId: '2', shiftId: 'S1' }] });
    const res = await request(app).get(`/api/classes/${cls._id}/students`).set(authHeader(adminToken));
    expect(res.status).toBe(200);
  });
});
