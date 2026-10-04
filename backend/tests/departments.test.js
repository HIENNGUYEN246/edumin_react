import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from './helpers/testApp.js';
import { createUser, authHeader } from './helpers/factories.js';
import { ROLES } from '../src/lib/roles.js';
import { Department } from '../src/modules/departments/department.model.js';

async function admin() {
  const { token } = await createUser({ role: ROLES.ADMIN });
  return token;
}

describe('Departments', () => {
  it('lists departments for any authenticated user with meta', async () => {
    await Department.create({ id: 'CNTT', name: 'CNTT' });
    const { token } = await createUser({ role: ROLES.STUDENT });
    const res = await request(app).get('/api/departments').set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta.total).toBe(1);
  });

  it('rejects unauthenticated access', async () => {
    const res = await request(app).get('/api/departments');
    expect(res.status).toBe(401);
  });

  it('lets admin create a department', async () => {
    const token = await admin();
    const res = await request(app)
      .post('/api/departments')
      .set(authHeader(token))
      .send({ id: 'KT', name: 'Khoa Kinh tế' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe('KT');
  });

  it('rejects a non-admin creating a department', async () => {
    const { token } = await createUser({ role: ROLES.TEACHER });
    const res = await request(app).post('/api/departments').set(authHeader(token)).send({ id: 'X', name: 'X' });
    expect(res.status).toBe(403);
  });

  it('returns 409 on duplicate id', async () => {
    const token = await admin();
    await Department.create({ id: 'KT', name: 'KT' });
    const res = await request(app).post('/api/departments').set(authHeader(token)).send({ id: 'KT', name: 'Khác' });
    expect(res.status).toBe(409);
  });

  it('updates a department', async () => {
    const token = await admin();
    const dept = await Department.create({ id: 'KT', name: 'Cũ' });
    const res = await request(app)
      .patch(`/api/departments/${dept._id}`)
      .set(authHeader(token))
      .send({ name: 'Mới' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Mới');
  });

  it('deletes a department', async () => {
    const token = await admin();
    const dept = await Department.create({ id: 'KT', name: 'KT' });
    const res = await request(app).delete(`/api/departments/${dept._id}`).set(authHeader(token));
    expect(res.status).toBe(200);
    expect(await Department.countDocuments()).toBe(0);
  });

  it('validates create payload', async () => {
    const token = await admin();
    const res = await request(app).post('/api/departments').set(authHeader(token)).send({ name: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('searches by name', async () => {
    const token = await admin();
    await Department.create([
      { id: 'CNTT', name: 'Công nghệ thông tin' },
      { id: 'KT', name: 'Kinh tế' },
    ]);
    const res = await request(app).get('/api/departments?search=kinh').set(authHeader(token));
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe('KT');
  });
});
