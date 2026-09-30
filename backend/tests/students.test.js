import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from './helpers/testApp.js';
import { createUser, authHeader } from './helpers/factories.js';
import { ROLES } from '../src/lib/roles.js';
import { Department } from '../src/modules/departments/department.model.js';
import { Student } from '../src/modules/students/student.model.js';

vi.mock('../src/lib/files.service.js', () => ({
  uploadBuffer: vi.fn(async () => ({ publicId: 'p', url: 'u', resourceType: 'image', bytes: 1, format: 'png', access: 'public' })),
  destroy: vi.fn(async () => {}),
  signedUrl: vi.fn(() => 'signed'),
}));

let adminToken;
beforeEach(async () => {
  const { token } = await createUser({ role: ROLES.ADMIN });
  adminToken = token;
});

describe('Students CRUD', () => {
  it('creates a student with SV counter id', async () => {
    await Department.create({ id: 'CNTT', name: 'CNTT' });
    const res = await request(app)
      .post('/api/students')
      .set(authHeader(adminToken))
      .send({ hoTen: 'Trần B', email: 'sv1@edu.vn', departmentId: 'CNTT', className: 'K18' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe(1);
    expect(res.body.className).toBe('K18');
  });

  it('lets a teacher read but not create students', async () => {
    const { token } = await createUser({ role: ROLES.TEACHER });
    const list = await request(app).get('/api/students').set(authHeader(token));
    expect(list.status).toBe(200);
    const create = await request(app).post('/api/students').set(authHeader(token)).send({ hoTen: 'X', email: 'x@edu.vn' });
    expect(create.status).toBe(403);
  });
});

describe('Student self-registration', () => {
  it('lists registration options (public)', async () => {
    await Department.create({ id: 'CNTT', name: 'CNTT' });
    const res = await request(app).get('/api/auth/registration-options');
    expect(res.status).toBe(200);
    expect(res.body.departments).toHaveLength(1);
  });

  it('registers a student and returns a working token', async () => {
    await Department.create({ id: 'CNTT', name: 'CNTT' });
    const res = await request(app)
      .post('/api/auth/register')
      .send({ hoTen: 'Sinh Viên Mới', email: 'new@edu.vn', password: 'Passw0rd', departmentId: 'CNTT' });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.role).toBe(ROLES.STUDENT);

    const me = await request(app).get('/api/auth/me').set(authHeader(res.body.token));
    expect(me.status).toBe(200);
    expect(me.body.profile.hoTen).toBe('Sinh Viên Mới');
  });

  it('rejects duplicate email on register (no orphan)', async () => {
    await Department.create({ id: 'CNTT', name: 'CNTT' });
    await createUser({ email: 'dup@edu.vn' });
    const res = await request(app)
      .post('/api/auth/register')
      .send({ hoTen: 'Trùng', email: 'dup@edu.vn', password: 'Passw0rd', departmentId: 'CNTT' });
    expect(res.status).toBe(409);
    expect(await Student.countDocuments()).toBe(0);
  });

  it('rejects an unknown department', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ hoTen: 'Không Khoa', email: 'nk@edu.vn', password: 'Passw0rd', departmentId: 'ZZZ' });
    expect(res.status).toBe(400);
  });
});
