import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from './helpers/testApp.js';
import { createUser, authHeader } from './helpers/factories.js';
import { ROLES } from '../src/lib/roles.js';
import { Teacher } from '../src/modules/teachers/teacher.model.js';
import { Student } from '../src/modules/students/student.model.js';

vi.mock('../src/lib/files.service.js', () => ({
  uploadBuffer: vi.fn(async () => ({ publicId: 'p', url: 'u', resourceType: 'image', bytes: 1, format: 'png', access: 'public' })),
  destroy: vi.fn(async () => {}),
  signedUrl: vi.fn(() => 'signed'),
}));

let adminToken;
let admin;
beforeEach(async () => {
  const res = await createUser({ role: ROLES.ADMIN });
  adminToken = res.token;
  admin = res.user;
});

describe('Accounts', () => {
  it('lists accounts filtered by role without password hashes', async () => {
    await createUser({ role: ROLES.STUDENT });
    const res = await request(app).get('/api/accounts?role=sinh-vien').set(authHeader(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.data.every((u) => u.role === ROLES.STUDENT)).toBe(true);
    expect(res.body.data[0].passwordHash).toBeUndefined();
  });

  it('sorts teacher accounts by teacher code before pagination', async () => {
    for (const id of [4, 2, 3, 1]) {
      const { user } = await createUser({ role: ROLES.TEACHER, email: `teacher${id}@edu.vn` });
      const teacher = await Teacher.create({ userId: user._id, id, email: user.email, hoTen: `GV ${id}` });
      user.teacher = teacher._id;
      await user.save();
    }

    const res = await request(app)
      .get('/api/accounts?role=giao-vien&page=1&limit=3')
      .set(authHeader(adminToken));

    expect(res.status).toBe(200);
    expect(res.body.data.map((account) => account.teacher.id)).toEqual([1, 2, 3]);
    expect(res.body.meta.total).toBe(4);
  });

  it('sorts student accounts by student code before pagination', async () => {
    for (const id of [4, 2, 3, 1]) {
      const { user } = await createUser({ role: ROLES.STUDENT, email: `student${id}@edu.vn` });
      const student = await Student.create({ userId: user._id, id, email: user.email, hoTen: `SV ${id}` });
      user.student = student._id;
      await user.save();
    }

    const res = await request(app)
      .get('/api/accounts?role=sinh-vien&page=1&limit=3')
      .set(authHeader(adminToken));

    expect(res.status).toBe(200);
    expect(res.body.data.map((account) => account.student.id)).toEqual([1, 2, 3]);
    expect(res.body.meta.total).toBe(4);
  });

  it('forbids non-admins', async () => {
    const { token } = await createUser({ role: ROLES.TEACHER });
    const res = await request(app).get('/api/accounts').set(authHeader(token));
    expect(res.status).toBe(403);
  });

  it('locks an account and revokes its token (423 on next request)', async () => {
    const { user, token } = await createUser({ role: ROLES.TEACHER });
    const lock = await request(app)
      .patch(`/api/accounts/${user._id}/status`)
      .set(authHeader(adminToken))
      .send({ status: 'Locked', lockReason: 'Vi phạm' });
    expect(lock.status).toBe(200);
    expect(lock.body.status).toBe('Locked');

    // The victim's existing token is now invalid.
    const me = await request(app).get('/api/auth/me').set(authHeader(token));
    expect([401, 423]).toContain(me.status);
  });

  it('prevents an admin from locking themselves', async () => {
    const res = await request(app)
      .patch(`/api/accounts/${admin._id}/status`)
      .set(authHeader(adminToken))
      .send({ status: 'Locked' });
    expect(res.status).toBe(400);
  });

  it('resets a password and returns a temp password once', async () => {
    const { user } = await createUser({ role: ROLES.STUDENT, password: 'OldPass1' });
    const res = await request(app).post(`/api/accounts/${user._id}/reset-password`).set(authHeader(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.tempPassword).toBeTruthy();

    const relogin = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: res.body.tempPassword });
    expect(relogin.status).toBe(200);
  });

  it('deletes an account and its profile', async () => {
    const dept = await import('../src/modules/departments/department.model.js');
    await dept.Department.create({ id: 'CNTT', name: 'CNTT' });
    const created = await request(app)
      .post('/api/students')
      .set(authHeader(adminToken))
      .send({
        hoTen: 'SV Xóa',
        email: 'svdel@edu.vn',
        departmentId: 'CNTT',
        className: 'CNTT-K18',
        dob: '2005-06-15',
        phone: '0901234567',
        address: 'Quận 3, TP.HCM',
      });
    const { User } = await import('../src/modules/auth/user.model.js');
    const account = await User.findOne({ email: 'svdel@edu.vn' });

    const res = await request(app).delete(`/api/accounts/${account._id}`).set(authHeader(adminToken));
    expect(res.status).toBe(200);

    const { Student } = await import('../src/modules/students/student.model.js');
    expect(await Student.findById(created.body._id)).toBeNull();
    expect(await User.findById(account._id)).toBeNull();
  });
});
