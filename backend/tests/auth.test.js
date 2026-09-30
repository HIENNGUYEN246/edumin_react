import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from './helpers/testApp.js';
import { createUser, authHeader } from './helpers/factories.js';
import { ROLES } from '../src/lib/roles.js';

describe('POST /api/auth/login', () => {
  it('logs in with correct credentials and never returns the hash', async () => {
    await createUser({ email: 'admin@edu.vn', password: 'Secret123' });
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@edu.vn', password: 'Secret123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe('admin@edu.vn');
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('rejects wrong password', async () => {
    await createUser({ email: 'admin@edu.vn', password: 'Secret123' });
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@edu.vn', password: 'nope' });
    expect(res.status).toBe(401);
  });

  it('rejects a locked account with 423', async () => {
    await createUser({ email: 'locked@edu.vn', password: 'Secret123', status: 'Locked', lockReason: 'Vi phạm' });
    const res = await request(app).post('/api/auth/login').send({ email: 'locked@edu.vn', password: 'Secret123' });
    expect(res.status).toBe(423);
  });

  it('validates the payload', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/auth/me', () => {
  it('returns the current user without hash', async () => {
    const { token } = await createUser({ role: ROLES.ADMIN });
    const res = await request(app).get('/api/auth/me').set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe(ROLES.ADMIN);
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('rejects a missing token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/auth/me/password', () => {
  it('changes the password and revokes old tokens', async () => {
    const { token } = await createUser({ email: 'p@edu.vn', password: 'OldPass1' });

    const change = await request(app)
      .patch('/api/auth/me/password')
      .set(authHeader(token))
      .send({ oldPassword: 'OldPass1', newPassword: 'NewPass2' });
    expect(change.status).toBe(200);
    expect(change.body.token).toBeTruthy();

    // The old token now carries a stale tokenVersion.
    const stale = await request(app).get('/api/auth/me').set(authHeader(token));
    expect(stale.status).toBe(401);

    // The freshly issued token works.
    const fresh = await request(app).get('/api/auth/me').set(authHeader(change.body.token));
    expect(fresh.status).toBe(200);

    // New password logs in.
    const relogin = await request(app).post('/api/auth/login').send({ email: 'p@edu.vn', password: 'NewPass2' });
    expect(relogin.status).toBe(200);
  });

  it('rejects a wrong old password', async () => {
    const { token } = await createUser({ password: 'OldPass1' });
    const res = await request(app)
      .patch('/api/auth/me/password')
      .set(authHeader(token))
      .send({ oldPassword: 'wrong', newPassword: 'NewPass2' });
    expect(res.status).toBe(400);
  });
});
