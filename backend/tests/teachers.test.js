import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from './helpers/testApp.js';
import { createUser, authHeader } from './helpers/factories.js';
import { ROLES } from '../src/lib/roles.js';
import { Department } from '../src/modules/departments/department.model.js';
import { User } from '../src/modules/auth/user.model.js';
import { Teacher } from '../src/modules/teachers/teacher.model.js';

// Mock Cloudinary so avatar tests never hit the network.
vi.mock('../src/lib/files.service.js', () => ({
  uploadBuffer: vi.fn(async () => ({
    publicId: 'edumin/avatars/mock',
    url: 'https://cdn.test/mock.png',
    resourceType: 'image',
    bytes: 100,
    format: 'png',
    access: 'public',
  })),
  destroy: vi.fn(async () => {}),
  signedUrl: vi.fn(() => 'https://cdn.test/signed'),
}));

let adminToken;
beforeEach(async () => {
  const { token } = await createUser({ role: ROLES.ADMIN });
  adminToken = token;
});

describe('Teachers', () => {
  it('creates a teacher with a User account and a GV counter id', async () => {
    await Department.create({ id: 'CNTT', name: 'CNTT' });
    const res = await request(app)
      .post('/api/teachers')
      .set(authHeader(adminToken))
      .send({ hoTen: 'Nguyễn Văn A', email: 'gv1@edu.vn', departmentId: 'CNTT', password: 'Passw0rd' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(1);
    expect(res.body.department).toBe('CNTT');
    expect(res.body.passwordHash).toBeUndefined();

    const user = await User.findOne({ email: 'gv1@edu.vn' });
    expect(user.role).toBe(ROLES.TEACHER);
    expect(String(user.teacher)).toBe(String(res.body._id));
  });

  it('rolls back when the email already exists (no orphan teacher)', async () => {
    await createUser({ email: 'dup@edu.vn' });
    const res = await request(app)
      .post('/api/teachers')
      .set(authHeader(adminToken))
      .send({ hoTen: 'Trùng Email', email: 'dup@edu.vn' });
    expect(res.status).toBe(409);
    expect(await Teacher.countDocuments()).toBe(0);
  });

  it('assigns incrementing ids', async () => {
    await request(app).post('/api/teachers').set(authHeader(adminToken)).send({ hoTen: 'GV Một', email: 'a@edu.vn' });
    const second = await request(app)
      .post('/api/teachers')
      .set(authHeader(adminToken))
      .send({ hoTen: 'GV Hai', email: 'b@edu.vn' });
    expect(second.body.id).toBe(2);
  });

  it('uploads an avatar via the mocked service', async () => {
    const created = await request(app)
      .post('/api/teachers')
      .set(authHeader(adminToken))
      .send({ hoTen: 'GV Avatar', email: 'av@edu.vn' });
    const res = await request(app)
      .put(`/api/teachers/${created.body._id}/avatar`)
      .set(authHeader(adminToken))
      .attach('file', Buffer.from('fake-image'), { filename: 'a.png', contentType: 'image/png' });
    expect(res.status).toBe(200);
    expect(res.body.avatar.url).toBe('https://cdn.test/mock.png');
  });

  it('imports rows and reports per-row failures', async () => {
    const res = await request(app)
      .post('/api/teachers/import')
      .set(authHeader(adminToken))
      .send({
        rows: [
          { hoTen: 'Hợp Lệ', email: 'ok@edu.vn' },
          { hoTen: 'X', email: 'bad-email' },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.created).toBe(1);
    expect(res.body.failed).toHaveLength(1);
    expect(res.body.failed[0].row).toBe(2);
  });

  it('forbids a non-admin from creating a teacher', async () => {
    const { token } = await createUser({ role: ROLES.TEACHER });
    const res = await request(app).post('/api/teachers').set(authHeader(token)).send({ hoTen: 'Nope', email: 'n@edu.vn' });
    expect(res.status).toBe(403);
  });

  it('deletes a teacher and its account', async () => {
    const created = await request(app)
      .post('/api/teachers')
      .set(authHeader(adminToken))
      .send({ hoTen: 'GV Xóa', email: 'del@edu.vn' });
    const res = await request(app).delete(`/api/teachers/${created.body._id}`).set(authHeader(adminToken));
    expect(res.status).toBe(200);
    expect(await Teacher.countDocuments()).toBe(0);
    expect(await User.findOne({ email: 'del@edu.vn' })).toBeNull();
  });

  it('clears department head when the head teacher is deleted', async () => {
    const created = await request(app)
      .post('/api/teachers')
      .set(authHeader(adminToken))
      .send({ hoTen: 'Trưởng Khoa', email: 'head@edu.vn' });
    const dept = await Department.create({ id: 'CNTT', name: 'CNTT', head: created.body._id });
    await request(app).delete(`/api/teachers/${created.body._id}`).set(authHeader(adminToken));
    const after = await Department.findById(dept._id);
    expect(after.head).toBeNull();
  });
});
