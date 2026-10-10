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

  it('correctly prioritizes NAV_GRADES over NAV_STUDENTS for "phần điểm sinh viên"', async () => {
    const teacherUser = await User.findOne({ email: 'quan.tran@edu.vn' });
    const token = signToken(teacherUser);

    const res = await request(app)
      .post('/api/ai/query')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Làm sao để vào phần điểm sinh viên?' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.intent).toBe('NAV_GRADES');
    expect(res.body.reply).toContain('bảng điểm');
    expect(res.body.quickLinks.some((l) => l.path === '/teacher/classes')).toBe(true);
  });

  it('honestly responds to out-of-scope queries with exact graceful fallback message', async () => {
    const studentUser = await User.findOne({ email: 'an.nguyen@edu.vn' });
    const token = signToken(studentUser);

    const res = await request(app)
      .post('/api/ai/query')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Hệ thống có cho đăng ký ký túc xá và mượn sách thư viện không?' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.intent).toBe('OUT_OF_SCOPE');
    expect(res.body.reply).toContain(
      'Dạ, hiện tại hệ thống EduMin chưa hỗ trợ tính năng này hoặc không có mục đó trong phần quản lý của bạn.'
    );
  });

  it('detects currentPath and responds friendly with CURRENT_PAGE_ALREADY without useless redirects', async () => {
    const adminUser = await User.findOne({ role: ROLES.ADMIN });
    const token = signToken(adminUser);

    const res = await request(app)
      .post('/api/ai/query')
      .set('Authorization', `Bearer ${token}`)
      .send({
        message: 'Làm sao để quản lý các khoa đào tạo?',
        currentPath: '/admin/departments',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.intent).toBe('CURRENT_PAGE_ALREADY');
    expect(res.body.reply).toContain('Quản lý khoa đào tạo');
    expect(res.body.reply).toContain('hiện tại bạn đang ở ngay trang');
  });

  it('routes Admin to /admin/gradebook when asking about lock or gradebook management', async () => {
    const adminUser = await User.findOne({ role: ROLES.ADMIN });
    const token = signToken(adminUser);

    const res = await request(app)
      .post('/api/ai/query')
      .set('Authorization', `Bearer ${token}`)
      .send({
        message: 'Làm sao để chốt sổ bảng điểm và khóa điểm toàn trường?',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.intent).toBe('NAV_ADMIN_GRADEBOOK');
    expect(res.body.quickLinks.some((l) => l.path === '/admin/gradebook')).toBe(true);
  });
});

