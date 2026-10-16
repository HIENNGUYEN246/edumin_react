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

async function makeStudent(idNum, department = 'CNTT') {
  const email = `sv${idNum}@edu.vn`;
  const user = await User.create({ email, passwordHash: await hashPassword('x'), role: ROLES.STUDENT, hoTen: `SV ${idNum}` });
  const student = await Student.create({ userId: user._id, id: idNum, email, hoTen: `SV ${idNum}`, department });
  user.student = student._id;
  await user.save();
  return { token: signToken(user), student };
}

describe('Course & Department Scoping for Assignments and Documents', () => {
  let itTeacher;
  let econTeacher;
  let course;
  let enrolledStudent1;
  let enrolledStudent2;
  let nonEnrolledStudent;

  beforeEach(async () => {
    await createUser({ role: ROLES.ADMIN });

    course = await Course.create({ id: 'IT101', name: 'Lập trình Cơ bản', department: 'CNTT' });

    itTeacher = await makeTeacher(10, 'CNTT');
    econTeacher = await makeTeacher(20, 'Kinh Tế');

    const class1 = await CourseClass.create({
      id: 'IT101-01',
      courseRef: course._id,
      courseId: 'IT101',
      teacherRef: itTeacher.teacher._id,
      teacherId: 10,
      schedules: [{ dayId: '2', shiftId: 'S1' }],
    });

    const class2 = await CourseClass.create({
      id: 'IT101-02',
      courseRef: course._id,
      courseId: 'IT101',
      teacherRef: itTeacher.teacher._id,
      teacherId: 10,
      schedules: [{ dayId: '3', shiftId: 'S2' }],
    });

    enrolledStudent1 = await makeStudent(101, 'CNTT');
    enrolledStudent2 = await makeStudent(102, 'CNTT');
    nonEnrolledStudent = await makeStudent(103, 'CNTT');

    await Enrollment.create({ student: enrolledStudent1.student._id, classRef: class1._id, classId: 'IT101-01' });
    await Enrollment.create({ student: enrolledStudent2.student._id, classRef: class2._id, classId: 'IT101-02' });
  });

  describe('Teacher department scoping', () => {
    it('allows teacher in the course department to create assignments', async () => {
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

  describe('Course-level student access to assignments', () => {
    it('allows any student enrolled in the course to see and submit assignments, blocking non-enrolled students', async () => {
      const resCreate = await request(app)
        .post('/api/assignments')
        .set(authHeader(itTeacher.token))
        .send({
          courseId: 'IT101',
          type: 'quiz',
          title: 'Quiz Môn Lập Trình',
          questions: [{ id: 'q1', text: '1+1?', options: ['1', '2'], correctIndex: 1 }],
        });
      expect(resCreate.status).toBe(201);
      const assignmentId = resCreate.body._id;

      // Both enrolled students can see the assignment in their course
      const resList1 = await request(app)
        .get('/api/assignments?courseId=IT101')
        .set(authHeader(enrolledStudent1.token));
      expect(resList1.status).toBe(200);
      expect(resList1.body.data.some((a) => a._id === assignmentId)).toBe(true);

      const resList2 = await request(app)
        .get('/api/assignments?courseId=IT101')
        .set(authHeader(enrolledStudent2.token));
      expect(resList2.status).toBe(200);
      expect(resList2.body.data.some((a) => a._id === assignmentId)).toBe(true);

      // Non-enrolled student cannot see it in course list
      const resList3 = await request(app)
        .get('/api/assignments?courseId=IT101')
        .set(authHeader(nonEnrolledStudent.token));
      expect(resList3.status).toBe(200);
      expect(resList3.body.data.some((a) => a._id === assignmentId)).toBe(false);

      // Non-enrolled student cannot get the assignment directly
      const resGet3 = await request(app)
        .get(`/api/assignments/${assignmentId}`)
        .set(authHeader(nonEnrolledStudent.token));
      expect(resGet3.status).toBe(403);

      // Non-enrolled student cannot submit
      const resSub3 = await request(app)
        .post(`/api/assignments/${assignmentId}/submissions`)
        .set(authHeader(nonEnrolledStudent.token))
        .send({ answers: { q1: 1 } });
      expect(resSub3.status).toBe(403);

      // Enrolled student can submit successfully
      const resSub1 = await request(app)
        .post(`/api/assignments/${assignmentId}/submissions`)
        .set(authHeader(enrolledStudent1.token))
        .send({ answers: { q1: 1 } });
      expect(resSub1.status).toBe(201);
      expect(resSub1.body.score).toBe(10);
    });
  });

  describe('Course-level student access to documents', () => {
    it('allows any student enrolled in the course to list and download documents, blocking non-enrolled students', async () => {
      const resCreate = await request(app)
        .post('/api/documents')
        .set(authHeader(itTeacher.token))
        .send({
          courseId: 'IT101',
          name: 'Bài giảng Lập Trình',
          link: 'https://example.com/slide.pdf',
        });
      expect(resCreate.status).toBe(201);
      const docId = resCreate.body._id;

      // Both enrolled students can see the document
      const resList1 = await request(app)
        .get('/api/documents?courseId=IT101')
        .set(authHeader(enrolledStudent1.token));
      expect(resList1.status).toBe(200);
      expect(resList1.body.data.some((d) => d._id === docId)).toBe(true);

      const resList2 = await request(app)
        .get('/api/documents?courseId=IT101')
        .set(authHeader(enrolledStudent2.token));
      expect(resList2.status).toBe(200);
      expect(resList2.body.data.some((d) => d._id === docId)).toBe(true);

      // Non-enrolled student cannot see the document
      const resList3 = await request(app)
        .get('/api/documents?courseId=IT101')
        .set(authHeader(nonEnrolledStudent.token));
      expect(resList3.status).toBe(200);
      expect(resList3.body.data.some((d) => d._id === docId)).toBe(false);

      // Non-enrolled student cannot download
      const resDown3 = await request(app)
        .get(`/api/documents/${docId}/download`)
        .set(authHeader(nonEnrolledStudent.token));
      expect(resDown3.status).toBe(403);

      // Enrolled student can download
      const resDown1 = await request(app)
        .get(`/api/documents/${docId}/download`)
        .set(authHeader(enrolledStudent1.token));
      expect(resDown1.status).toBe(200);
      expect(resDown1.body.url).toBe('https://example.com/slide.pdf');
    });
  });
});
