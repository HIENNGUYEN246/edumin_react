import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from './helpers/testApp.js';
import { createUser, authHeader } from './helpers/factories.js';
import { ROLES } from '../src/lib/roles.js';
import { Department } from '../src/modules/departments/department.model.js';
import { Teacher } from '../src/modules/teachers/teacher.model.js';
import { User } from '../src/modules/auth/user.model.js';
import { hashPassword } from '../src/lib/password.js';

vi.mock('../src/lib/files.service.js', () => ({
  uploadBuffer: vi.fn(async () => ({ publicId: 'p', url: 'u', resourceType: 'image', bytes: 1, format: 'png', access: 'public' })),
  destroy: vi.fn(async () => {}),
  signedUrl: vi.fn(() => 'signed'),
}));

let adminToken;
beforeEach(async () => {
  const { token } = await createUser({ role: ROLES.ADMIN });
  adminToken = token;
  await Department.create({ id: 'CNTT', name: 'CNTT' });
});

describe('counter self-heal', () => {
  it('assigns a non-colliding id when the counter is behind existing data', async () => {
    // Simulate drift: a teacher with id=5 exists but the counter is empty.
    const u = await User.create({ email: 'seed@edu.vn', passwordHash: await hashPassword('x'), role: ROLES.TEACHER, hoTen: 'Seed' });
    await Teacher.create({ userId: u._id, id: 5, email: 'seed@edu.vn', hoTen: 'Seed' });

    const res = await request(app)
      .post('/api/teachers')
      .set(authHeader(adminToken))
      .send({ hoTen: 'Người Mới', email: 'moi@edu.vn' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(6); // reconciled to max(5)+1, not a duplicate
  });
});
