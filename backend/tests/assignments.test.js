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

async function makeTeacher(idNum) {
  const email = `gv${idNum}@edu.vn`;
  const user = await User.create({ email, passwordHash: await hashPassword('x'), role: ROLES.TEACHER, hoTen: `GV ${idNum}` });
  const teacher = await Teacher.create({ userId: user._id, id: idNum, email, hoTen: `GV ${idNum}` });
  user.teacher = teacher._id;
  await user.save();
  return { token: signToken(user), teacher };
}
async function makeStudent(idNum) {
  const email = `sv${idNum}@edu.vn`;
  const user = await User.create({ email, passwordHash: await hashPassword('x'), role: ROLES.STUDENT, hoTen: `SV ${idNum}` });
  const student = await Student.create({ userId: user._id, id: idNum, email, hoTen: `SV ${idNum}` });
  user.student = student._id;
  await user.save();
  return { token: signToken(user), student };
}

let course;
let teacherToken;
let teacher;
beforeEach(async () => {
  await createUser({ role: ROLES.ADMIN });
  course = await Course.create({ id: 'IT101', name: 'Lập trình' });
  const t = await makeTeacher(1);
  teacherToken = t.token;
  teacher = t.teacher;
  await CourseClass.create({ id: 'IT101-01', courseRef: course._id, courseId: 'IT101', teacherRef: teacher._id, teacherId: 1, schedules: [{ dayId: '2', shiftId: 'S1' }] });
});

async function makeQuiz() {
  const res = await request(app)
    .post('/api/assignments')
    .set(authHeader(teacherToken))
    .send({
      courseId: 'IT101',
      type: 'quiz',
      title: 'Quiz 1',
      questions: [
        { id: 'q1', text: '1+1?', options: ['1', '2', '3'], correctIndex: 1 },
        { id: 'q2', text: '2+2?', options: ['3', '4', '5'], correctIndex: 1 },
      ],
    });
  return res;
}

async function enrolledStudent(idNum) {
  const s = await makeStudent(idNum);
  const cls = await CourseClass.findOne({ id: 'IT101-01' });
  await Enrollment.create({ student: s.student._id, classRef: cls._id, classId: 'IT101-01' });
  return s;
}

describe('Assignments', () => {
  it('creates a quiz as the course teacher', async () => {
    const res = await makeQuiz();
    expect(res.status).toBe(201);
    expect(res.body.questions).toHaveLength(2);
  });

  it('hides correctIndex from the student listing', async () => {
    await makeQuiz();
    const { token } = await enrolledStudent(1);
    const res = await request(app).get('/api/assignments?courseId=IT101').set(authHeader(token));
    expect(res.status).toBe(200);
    const quiz = res.body.data[0];
    expect(quiz.questions[0].correctIndex).toBeUndefined();
    expect(quiz.questions[0].options).toBeDefined();
  });

  it('grades a submission on a 0-10 scale and returns the answer key', async () => {
    const quiz = await makeQuiz();
    const { token } = await enrolledStudent(1);
    const res = await request(app)
      .post(`/api/assignments/${quiz.body._id}/submissions`)
      .set(authHeader(token))
      .send({ answers: { q1: 1, q2: 0 } }); // one correct out of two
    expect(res.status).toBe(201);
    expect(res.body.score).toBe(5);
    expect(res.body.answerKey).toHaveLength(2);
  });

  it('re-submitting overwrites the previous submission', async () => {
    const quiz = await makeQuiz();
    const { token } = await enrolledStudent(1);
    await request(app).post(`/api/assignments/${quiz.body._id}/submissions`).set(authHeader(token)).send({ answers: { q1: 0, q2: 0 } });
    const second = await request(app).post(`/api/assignments/${quiz.body._id}/submissions`).set(authHeader(token)).send({ answers: { q1: 1, q2: 1 } });
    expect(second.body.score).toBe(10);

    const subs = await request(app).get(`/api/assignments/${quiz.body._id}/submissions`).set(authHeader(teacherToken));
    expect(subs.body.data).toHaveLength(1);
    expect(subs.body.data[0].score).toBe(10);
  });

  it('rejects a submission from a non-enrolled student', async () => {
    const quiz = await makeQuiz();
    const { token } = await makeStudent(2); // not enrolled
    const res = await request(app).post(`/api/assignments/${quiz.body._id}/submissions`).set(authHeader(token)).send({ answers: { q1: 1, q2: 1 } });
    expect(res.status).toBe(403);
  });

  it('lets the teacher view submissions but not other teachers', async () => {
    const quiz = await makeQuiz();
    const { token } = await enrolledStudent(1);
    await request(app).post(`/api/assignments/${quiz.body._id}/submissions`).set(authHeader(token)).send({ answers: { q1: 1, q2: 1 } });

    const owner = await request(app).get(`/api/assignments/${quiz.body._id}/submissions`).set(authHeader(teacherToken));
    expect(owner.status).toBe(200);
    expect(owner.body.data).toHaveLength(1);

    const other = await makeTeacher(2);
    const forbidden = await request(app).get(`/api/assignments/${quiz.body._id}/submissions`).set(authHeader(other.token));
    expect(forbidden.status).toBe(403);
  });
});
