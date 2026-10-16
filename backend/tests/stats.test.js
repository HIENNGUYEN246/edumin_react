import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from './helpers/testApp.js';
import { createUser, authHeader } from './helpers/factories.js';
import { ROLES } from '../src/lib/roles.js';
import { Department } from '../src/modules/departments/department.model.js';
import { Course } from '../src/modules/courses/course.model.js';

let adminToken;
beforeEach(async () => {
  const { token } = await createUser({ role: ROLES.ADMIN });
  adminToken = token;
});

describe('Stats overview', () => {
  it('returns counts for admin', async () => {
    await Department.create({ id: 'CNTT', name: 'CNTT' });
    await Course.create({ id: 'IT101', name: 'A' });
    const res = await request(app).get('/api/stats/overview').set(authHeader(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.departments).toBe(1);
    expect(res.body.courses).toBe(1);
    expect(res.body).toHaveProperty('lockedAccounts');
  });

  it('forbids non-admins', async () => {
    const { token } = await createUser({ role: ROLES.STUDENT });
    const res = await request(app).get('/api/stats/overview').set(authHeader(token));
    expect(res.status).toBe(403);
  });
});
