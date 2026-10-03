import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from './helpers/testApp.js';
import { createUser, authHeader } from './helpers/factories.js';
import { ROLES } from '../src/lib/roles.js';
import { Course } from '../src/modules/courses/course.model.js';

let adminToken;
beforeEach(async () => {
  const { token } = await createUser({ role: ROLES.ADMIN });
  adminToken = token;
  await Course.create({ id: 'IT101', name: 'Lập trình', credits: 3, fee: 1000000, department: 'CNTT' });
});

const baseClass = (overrides = {}) => ({
  id: 'IT101-01',
  courseId: 'IT101',
  room: 'A1',
  schedules: [{ dayId: '2', shiftId: 'S1' }],
  studyStart: '2026-01-01',
  studyEnd: '2026-06-01',
  status: 'Đang mở',
  ...overrides,
});

describe('Course classes', () => {
  it('creates a class from a course', async () => {
    const res = await request(app).post('/api/classes').set(authHeader(adminToken)).send(baseClass());
    expect(res.status).toBe(201);
    expect(res.body.courseName).toBe('Lập trình');
    expect(res.body.credits).toBe(3);
  });

  it('rejects a room conflict with 409', async () => {
    await request(app).post('/api/classes').set(authHeader(adminToken)).send(baseClass());
    const res = await request(app)
      .post('/api/classes')
      .set(authHeader(adminToken))
      .send(baseClass({ id: 'IT101-02', room: 'A1' }));
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/Phòng/);
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
    await request(app).post('/api/classes').set(authHeader(adminToken)).send(baseClass());
    const { token } = await createUser({ role: ROLES.STUDENT });
    const res = await request(app).get('/api/classes/open').set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
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
    const res = await request(app)
      .post('/api/classes')
      .set(authHeader(adminToken))
      .send(baseClass({ studyStart: '2026-01-01', studyEnd: '2026-02-01' }));
    expect(res.status).toBe(400);
  });
});
