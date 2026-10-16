import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from './helpers/testApp.js';
import { createUser, authHeader } from './helpers/factories.js';
import { ROLES } from '../src/lib/roles.js';
import { Department } from '../src/modules/departments/department.model.js';
import { Course } from '../src/modules/courses/course.model.js';
import { CourseClass } from '../src/modules/classes/courseClass.model.js';

let adminToken;
beforeEach(async () => {
  const { token } = await createUser({ role: ROLES.ADMIN });
  adminToken = token;
  await Department.create({ id: 'CNTT', name: 'CNTT' });
});

describe('Courses', () => {
  it('creates a course linked to a department', async () => {
    const res = await request(app)
      .post('/api/courses')
      .set(authHeader(adminToken))
      .send({ id: 'IT101', name: 'Nhập môn lập trình', credits: 3, fee: 1500000, departmentId: 'CNTT' });
    expect(res.status).toBe(201);
    expect(res.body.department).toBe('CNTT');
    expect(res.body.credits).toBe(3);
  });

  it('rejects a duplicate course id', async () => {
    await Course.create({ id: 'IT101', name: 'A' });
    const res = await request(app).post('/api/courses').set(authHeader(adminToken)).send({ id: 'IT101', name: 'B' });
    expect(res.status).toBe(409);
  });

  it('forbids a non-admin from creating', async () => {
    const { token } = await createUser({ role: ROLES.STUDENT });
    const res = await request(app).post('/api/courses').set(authHeader(token)).send({ id: 'X', name: 'X' });
    expect(res.status).toBe(403);
  });

  it('lets any authenticated user read courses', async () => {
    await Course.create({ id: 'IT101', name: 'A' });
    const { token } = await createUser({ role: ROLES.STUDENT });
    const res = await request(app).get('/api/courses').set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('filters courses by department', async () => {
    await Course.create([
      { id: 'IT101', name: 'Lập trình', department: 'CNTT' },
      { id: 'ENG101', name: 'Tiếng Anh', department: 'Ngoại ngữ' },
    ]);

    const res = await request(app)
      .get('/api/courses?department=CNTT')
      .set(authHeader(adminToken));

    expect(res.status).toBe(200);
    expect(res.body.data.map((course) => course.id)).toEqual(['IT101']);
  });

  it('deletes a course with no classes', async () => {
    const course = await Course.create({ id: 'IT101', name: 'A' });
    const res = await request(app).delete(`/api/courses/${course._id}`).set(authHeader(adminToken));
    expect(res.status).toBe(200);
    expect(await Course.countDocuments()).toBe(0);
  });

  it('updates course details cached on its linked classes', async () => {
    const course = await Course.create({
      id: 'IT101',
      name: 'Nhập môn lập trình',
      credits: 3,
      fee: 1500000,
      department: 'CNTT',
    });
    const courseClass = await CourseClass.create({
      id: 'IT101-01',
      courseRef: course._id,
      courseId: course.id,
      courseName: course.name,
      credits: course.credits,
      fee: course.fee,
      department: course.department,
    });

    const res = await request(app)
      .patch(`/api/courses/${course._id}`)
      .set(authHeader(adminToken))
      .send({ name: 'Lập trình nâng cao', credits: 4, fee: 2000000 });

    expect(res.status).toBe(200);
    const syncedClass = await CourseClass.findById(courseClass._id).lean();
    expect(syncedClass).toMatchObject({
      courseId: 'IT101',
      courseName: 'Lập trình nâng cao',
      credits: 4,
      fee: 2000000,
      department: 'CNTT',
    });
  });

  it('imports rows with per-row failures', async () => {
    const res = await request(app)
      .post('/api/courses/import')
      .set(authHeader(adminToken))
      .send({ rows: [{ id: 'IT102', name: 'OK' }, { id: '', name: 'Bad' }] });
    expect(res.status).toBe(200);
    expect(res.body.created).toBe(1);
    expect(res.body.failed).toHaveLength(1);
  });

  it('imports the MaHP/TenHP/TinChi/HocPhi course template', async () => {
    await Department.create({ id: 'CNTT-01', name: 'Khoa Công Nghệ Thông Tin' });
    const res = await request(app)
      .post('/api/courses/import')
      .set(authHeader(adminToken))
      .send({ rows: [
        {
          MaHP: 'CTDLGT1',
          TenHP: 'Cấu trúc dữ liệu và giải thuật 1',
          TinChi: 3,
          HocPhi: 3000000,
          Khoa: 'Khoa Công Nghệ Thông Tin',
        },
      ] });

    expect(res.status).toBe(200);
    expect(res.body.created).toBe(1);
    expect(res.body.failed).toHaveLength(0);
    const course = await Course.findOne({ id: 'CTDLGT1' });
    expect(course).toMatchObject({
      name: 'Cấu trúc dữ liệu và giải thuật 1',
      credits: 3,
      fee: 3000000,
      department: 'Khoa Công Nghệ Thông Tin',
    });
  });
});
