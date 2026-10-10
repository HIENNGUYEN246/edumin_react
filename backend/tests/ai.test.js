import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { seed } from '../src/scripts/seed.js';
import { User } from '../src/modules/auth/user.model.js';
import { ROLES } from '../src/lib/roles.js';
import { signToken } from '../src/lib/jwt.js';

describe('AI Assistant API', () => {
  let app;

  beforeEach(async () => {
    app = createApp();
    await seed({ withSamples: true });
  });

  it('rejects query without token with 401', async () => {
    const res = await request(app).post('/api/ai/query').send({ message: 'Làm sao để cấu hình điểm?' });
    expect(res.status).toBe(401);
  });

  it('handles navigation query for grade configuration as teacher', async () => {
    const teacherUser = await User.findOne({ email: 'quan.tran@edu.vn' });
    const token = signToken(teacherUser);

    const res = await request(app)
      .post('/api/ai/query')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Làm sao để cấu hình điểm giữa kỳ và quiz?' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.intent).toBe('NAV_GRADE_CONFIG');
    expect(res.body.reply).toContain('Cấu hình Quiz');
    expect(res.body.quickLinks).toBeDefined();
    expect(res.body.quickLinks.some((l) => l.path === '/teacher/classes')).toBe(true);
  });

  it('handles schedule query for student', async () => {
    const studentUser = await User.findOne({ email: 'an.nguyen@edu.vn' });
    const token = signToken(studentUser);

    const res = await request(app)
      .post('/api/ai/query')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Xem thời khóa biểu ở đâu?' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.intent).toBe('QUERY_STUDENT_SCHEDULE');
    expect(res.body.quickLinks.some((l) => l.path === '/student/timetable')).toBe(true);
  });

  it('handles admin system stats query', async () => {
    const adminUser = await User.findOne({ role: ROLES.ADMIN });
    const token = signToken(adminUser);

    const res = await request(app)
      .post('/api/ai/query')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Thống kê hệ thống hiện tại' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.intent).toBe('QUERY_ADMIN_STATS');
    expect(res.body.data.teacherCount).toBeGreaterThan(0);
    expect(res.body.data.studentCount).toBeGreaterThan(0);
  });

  it('returns role-based suggestions from GET /api/ai/suggestions', async () => {
    const teacherUser = await User.findOne({ email: 'quan.tran@edu.vn' });
    const token = signToken(teacherUser);

    const res = await request(app)
      .get('/api/ai/suggestions')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.suggestions)).toBe(true);
    expect(res.body.suggestions.length).toBeGreaterThan(0);
  });
});

