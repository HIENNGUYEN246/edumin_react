import { describe, it, expect, vi, beforeEach } from 'vitest';
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

const destroyMock = vi.fn(async () => {});
vi.mock('../src/lib/files.service.js', () => ({
  uploadBuffer: vi.fn(async () => ({ publicId: 'edumin/documents/x', url: 'u', resourceType: 'raw', bytes: 10, format: 'pdf', access: 'authenticated' })),
  destroy: (...args) => destroyMock(...args),
  signedUrl: vi.fn(() => 'https://cdn.test/signed'),
}));

async function makeTeacher(idNum, email = `gv${idNum}@edu.vn`) {
  const user = await User.create({ email, passwordHash: await hashPassword('x'), role: ROLES.TEACHER, hoTen: `GV ${idNum}` });
  const teacher = await Teacher.create({ userId: user._id, id: idNum, email, hoTen: `GV ${idNum}` });
  user.teacher = teacher._id;
  await user.save();
  return { token: signToken(user), teacher };
}
async function makeStudent(idNum, email = `sv${idNum}@edu.vn`) {
  const user = await User.create({ email, passwordHash: await hashPassword('x'), role: ROLES.STUDENT, hoTen: `SV ${idNum}` });
  const student = await Student.create({ userId: user._id, id: idNum, email, hoTen: `SV ${idNum}` });
  user.student = student._id;
  await user.save();
  return { token: signToken(user), student };
}

let course;
beforeEach(async () => {
  destroyMock.mockClear();
  await createUser({ role: ROLES.ADMIN });
  course = await Course.create({ id: 'IT101', name: 'Lập trình' });
});

async function classForTeacher(teacher) {
  return CourseClass.create({ id: `IT101-${teacher.id}`, courseRef: course._id, courseId: 'IT101', teacherRef: teacher._id, teacherId: teacher.id, schedules: [{ dayId: '2', shiftId: 'S1' }] });
}

describe('Documents', () => {
  it('lets the course teacher upload a document', async () => {
    const { token, teacher } = await makeTeacher(1);
    await classForTeacher(teacher);
    const res = await request(app)
      .post('/api/documents')
      .set(authHeader(token))
      .field('courseId', 'IT101')
      .field('name', 'Slide 1')
      .attach('file', Buffer.from('pdf'), { filename: 's.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Slide 1');
    expect(res.body.file).toBeUndefined(); // raw file meta stripped
  });

  it('forbids a teacher uploading to a course they do not teach', async () => {
    const { token } = await makeTeacher(2); // no class for this teacher
    const res = await request(app)
      .post('/api/documents')
      .set(authHeader(token))
      .field('courseId', 'IT101')
      .attach('file', Buffer.from('pdf'), { filename: 's.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(403);
  });

  it('gives an enrolled student a signed download URL', async () => {
    const { teacher } = await makeTeacher(1);
    const cls = await classForTeacher(teacher);
    const { student } = await makeStudent(1);
    const svUser = await User.findOne({ email: 'sv1@edu.vn' });
    await Enrollment.create({ student: student._id, classRef: cls._id, classId: cls.id });

    // Upload via the owning teacher.
    const ownerToken = signToken(await User.findOne({ email: 'gv1@edu.vn' }));
    const created = await request(app)
      .post('/api/documents')
      .set(authHeader(ownerToken))
      .field('courseId', 'IT101')
      .field('name', 'Bài giảng')
      .attach('file', Buffer.from('pdf'), { filename: 's.pdf', contentType: 'application/pdf' });

    const studentToken = signToken(svUser);
    const dl = await request(app).get(`/api/documents/${created.body._id}/download`).set(authHeader(studentToken));
    expect(dl.status).toBe(200);
    expect(dl.body.url).toBe('https://cdn.test/signed');
  });

  it('forbids a non-enrolled student from downloading', async () => {
    const { teacher } = await makeTeacher(1);
    await classForTeacher(teacher);
    const ownerToken = signToken(await User.findOne({ email: 'gv1@edu.vn' }));
    const created = await request(app)
      .post('/api/documents')
      .set(authHeader(ownerToken))
      .field('courseId', 'IT101')
      .attach('file', Buffer.from('pdf'), { filename: 's.pdf', contentType: 'application/pdf' });

    const { token } = await makeStudent(9);
    const dl = await request(app).get(`/api/documents/${created.body._id}/download`).set(authHeader(token));
    expect(dl.status).toBe(403);
  });

  it('deletes a document and destroys the Cloudinary asset', async () => {
    const { token, teacher } = await makeTeacher(1);
    await classForTeacher(teacher);
    const created = await request(app)
      .post('/api/documents')
      .set(authHeader(token))
      .field('courseId', 'IT101')
      .attach('file', Buffer.from('pdf'), { filename: 's.pdf', contentType: 'application/pdf' });

    const res = await request(app).delete(`/api/documents/${created.body._id}`).set(authHeader(token));
    expect(res.status).toBe(200);
    expect(destroyMock).toHaveBeenCalled();
  });
});
