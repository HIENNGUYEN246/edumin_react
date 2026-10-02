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

async function makeTeacher(idNum, department = 'CNTT') {
  const email = `gv${idNum}@edu.vn`;
  const user = await User.create({ email, passwordHash: await hashPassword('x'), role: ROLES.TEACHER, hoTen: `GV ${idNum}` });
  const teacher = await Teacher.create({ userId: user._id, id: idNum, email, hoTen: `GV ${idNum}`, department });
  user.teacher = teacher._id;
  await user.save();
  return { token: signToken(user), teacher };
}

async function makeStudent(idNum, className = '20DTH01', department = 'CNTT') {
  const email = `sv${idNum}@edu.vn`;
  const user = await User.create({ email, passwordHash: await hashPassword('x'), role: ROLES.STUDENT, hoTen: `SV ${idNum}` });
  const student = await Student.create({ userId: user._id, id: idNum, email, hoTen: `SV ${idNum}`, className, department });
  user.student = student._id;
  await user.save();
  return { token: signToken(user), student };
}

describe('Class & Department Scoping', () => {
  let adminToken;
  let itTeacher;
  let econTeacher;
  let course;
  let class1;
  let class2;
  let student1;
  let student2;

  beforeEach(async () => {
    const admin = await createUser({ role: ROLES.ADMIN });
    adminToken = admin.token;

    course = await Course.create({ id: 'IT101', name: 'Lập trình Cơ bản', department: 'CNTT' });

    itTeacher = await makeTeacher(10, 'CNTT');
    econTeacher = await makeTeacher(20, 'Kinh Tế');

    class1 = await CourseClass.create({
      id: 'IT101-01',
      courseRef: course._id,
      courseId: 'IT101',
      teacherRef: itTeacher.teacher._id,
      teacherId: 10,
      schedules: [{ dayId: '2', shiftId: 'S1' }],
    });

    class2 = await CourseClass.create({
      id: 'IT101-02',
      courseRef: course._id,
      courseId: 'IT101',
      teacherRef: itTeacher.teacher._id,
      teacherId: 10,
      schedules: [{ dayId: '3', shiftId: 'S2' }],
    });

    student1 = await makeStudent(101, '20DTH01', 'CNTT');
    student2 = await makeStudent(102, '20DTH02', 'CNTT');

    await Enrollment.create({ student: student1.student._id, classRef: class1._id, classId: 'IT101-01' });
    await Enrollment.create({ student: student2.student._id, classRef: class2._id, classId: 'IT101-02' });
  });

  describe('Teacher department scoping', () => {
    it('allows teacher in the same department to create assignments', async () => {
      const res = await request(app)
        .post('/api/assignments')
        .set(authHeader(itTeacher.token))
        .send({
          courseId: 'IT101',
          type: 'quiz',
          title: 'Quiz CNTT',
          questions: [{ id: 'q1', text: '1+1?', options: ['1', '2'], correctIndex: 1 }],
        });
      expect(res.status).toBe(201);
    });

    it('denies teacher from a different department from creating assignments', async () => {
      const res = await request(app)
        .post('/api/assignments')
        .set(authHeader(econTeacher.token))
        .send({
          courseId: 'IT101',
          type: 'quiz',
          title: 'Quiz Hack',
          questions: [{ id: 'q1', text: '1+1?', options: ['1', '2'], correctIndex: 1 }],
        });
      expect(res.status).toBe(403);
    });

    it('denies teacher from a different department from creating documents', async () => {
      const res = await request(app)
        .post('/api/documents')
        .set(authHeader(econTeacher.token))
        .send({
          courseId: 'IT101',
          name: 'Tài liệu không hợp lệ',
          link: 'https://example.com/doc.pdf',
        });
      expect(res.status).toBe(403);
    });
  });

  describe('Assignment class scoping', () => {
    it('scopes assignments to specific class for students', async () => {
      // Create assignment scoped to class1 (IT101-01)
      const resCreate = await request(app)
        .post('/api/assignments')
        .set(authHeader(itTeacher.token))
        .send({
          courseId: 'IT101',
          classId: 'IT101-01',
          type: 'quiz',
          title: 'Quiz riêng lớp 01',
          questions: [{ id: 'q1', text: '1+1?', options: ['1', '2'], correctIndex: 1 }],
        });
      expect(resCreate.status).toBe(201);
      const assignmentId = resCreate.body._id;

      // Student 1 (in IT101-01) lists assignments -> can see it
      const resList1 = await request(app)
        .get('/api/assignments?courseId=IT101')
        .set(authHeader(student1.token));
      expect(resList1.status).toBe(200);
      expect(resList1.body.data.some((a) => a._id === assignmentId)).toBe(true);

      // Student 2 (in IT101-02) lists assignments -> cannot see it
      const resList2 = await request(app)
        .get('/api/assignments?courseId=IT101')
        .set(authHeader(student2.token));
      expect(resList2.status).toBe(200);
      expect(resList2.body.data.some((a) => a._id === assignmentId)).toBe(false);

      // Student 2 directly accessing the assignment receives 403
      const resGet2 = await request(app)
        .get(`/api/assignments/${assignmentId}`)
        .set(authHeader(student2.token));
      expect(resGet2.status).toBe(403);

      // Student 2 submitting quiz receives 403
      const resSub2 = await request(app)
        .post(`/api/assignments/${assignmentId}/submissions`)
        .set(authHeader(student2.token))
        .send({ answers: { q1: 1 } });
      expect(resSub2.status).toBe(403);
    });

    it('allows all enrolled students to see course-wide assignments (no classId)', async () => {
      const resCreate = await request(app)
        .post('/api/assignments')
        .set(authHeader(itTeacher.token))
        .send({
          courseId: 'IT101',
          type: 'quiz',
          title: 'Quiz chung cả môn',
          questions: [{ id: 'q1', text: '1+1?', options: ['1', '2'], correctIndex: 1 }],
        });
      expect(resCreate.status).toBe(201);
      const assignmentId = resCreate.body._id;

      const res1 = await request(app).get(`/api/assignments/${assignmentId}`).set(authHeader(student1.token));
      expect(res1.status).toBe(200);

      const res2 = await request(app).get(`/api/assignments/${assignmentId}`).set(authHeader(student2.token));
      expect(res2.status).toBe(200);
    });
  });

  describe('Document class scoping', () => {
    it('scopes documents to specific class for students', async () => {
      const resCreate = await request(app)
        .post('/api/documents')
        .set(authHeader(itTeacher.token))
        .send({
          courseId: 'IT101',
          classId: 'IT101-01',
          name: 'Tài liệu lớp 01',
          link: 'https://example.com/doc1.pdf',
        });
      expect(resCreate.status).toBe(201);
      const docId = resCreate.body._id;

      // Student 1 can list it
      const resList1 = await request(app)
        .get('/api/documents?courseId=IT101')
        .set(authHeader(student1.token));
      expect(resList1.status).toBe(200);
      expect(resList1.body.data.some((d) => d._id === docId)).toBe(true);

      // Student 2 cannot list it
      const resList2 = await request(app)
        .get('/api/documents?courseId=IT101')
        .set(authHeader(student2.token));
      expect(resList2.status).toBe(200);
      expect(resList2.body.data.some((d) => d._id === docId)).toBe(false);

      // Student 2 cannot download
      const resDown2 = await request(app)
        .get(`/api/documents/${docId}/download`)
        .set(authHeader(student2.token));
      expect(resDown2.status).toBe(403);
    });
  });

  describe('Student groups aggregation endpoint', () => {
    it('returns administrative student classes summary', async () => {
      const res = await request(app)
        .get('/api/classes/student-groups')
        .set(authHeader(adminToken));
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);

      const class20DTH01 = res.body.data.find((g) => g.className === '20DTH01');
      expect(class20DTH01).toBeDefined();
      expect(class20DTH01.studentCount).toBe(1);
      expect(class20DTH01.department).toBe('CNTT');
      expect(class20DTH01.students).toHaveLength(1);
      expect(class20DTH01.students[0].hoTen).toBe('SV 101');
    });
  });
});

