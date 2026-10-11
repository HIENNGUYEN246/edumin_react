import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { seed } from '../src/scripts/seed.js';
import { User } from '../src/modules/auth/user.model.js';
import { ProfileRequest } from '../src/modules/profileRequests/profileRequest.model.js';
import { Feedback } from '../src/modules/feedback/feedback.model.js';
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
    expect(res.body.reply).toContain('Quản lý khoa');
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
    expect(res.body.quickLinks.some((l) => l.label === 'Quản lý bảng điểm')).toBe(true);
  });

  it('routes Admin to /admin/gradebook when asking about "bảng điểm" or "xem điểm" without rejection', async () => {
    const adminUser = await User.findOne({ role: ROLES.ADMIN });
    const token = signToken(adminUser);

    const gradeQueries = ['Cho tôi xem bảng điểm', 'Xem điểm sinh viên', 'Sổ điểm'];
    for (const msg of gradeQueries) {
      const res = await request(app)
        .post('/api/ai/query')
        .set('Authorization', `Bearer ${token}`)
        .send({ message: msg });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.intent).toBe('NAV_ADMIN_GRADEBOOK');
      expect(res.body.quickLinks.some((l) => l.path === '/admin/gradebook')).toBe(true);
      expect(res.body.quickLinks.some((l) => l.label === 'Quản lý bảng điểm')).toBe(true);
      expect(res.body.reply).not.toContain('chưa hỗ trợ tính năng này');
    }
  });

  it('correctly maps all 11 Admin interface menu items in backend without out-of-scope false rejection', async () => {
    const adminUser = await User.findOne({ role: ROLES.ADMIN });
    const token = signToken(adminUser);

    const testCases = [
      { msg: 'Thống kê tổng quan hệ thống', expectedIntent: 'QUERY_ADMIN_STATS', expectedPath: '/admin' },
      { msg: 'Quản lý khoa đào tạo', expectedIntent: 'NAV_DEPARTMENTS', expectedPath: '/admin/departments' },
      { msg: 'Quản lý môn học và học phần', expectedIntent: 'NAV_COURSES', expectedPath: '/admin/courses' },
      { msg: 'Quản lý lớp học phần', expectedIntent: 'NAV_CLASSES', expectedPath: '/admin/classes' },
      { msg: 'Quản lý giáo viên toàn trường', expectedIntent: 'NAV_TEACHERS', expectedPath: '/admin/teachers' },
      { msg: 'Tài khoản giáo viên', expectedIntent: 'NAV_TEACHER_ACCOUNTS', expectedPath: '/admin/teacher-accounts' },
      { msg: 'Quản lý sinh viên toàn trường', expectedIntent: 'NAV_STUDENTS', expectedPath: '/admin/students' },
      { msg: 'Tài khoản sinh viên', expectedIntent: 'NAV_STUDENT_ACCOUNTS', expectedPath: '/admin/student-accounts' },
      { msg: 'Ý kiến & phản hồi từ sinh viên', expectedIntent: 'NAV_ADMIN_FEEDBACKS', expectedPath: '/admin/feedbacks' },
      { msg: 'Duyệt yêu cầu cập nhật hồ sơ', expectedIntent: 'QUERY_PENDING_REQUESTS', expectedPath: '/admin/profile-requests' },
      { msg: 'Quản lý bảng điểm', expectedIntent: 'NAV_ADMIN_GRADEBOOK', expectedPath: '/admin/gradebook' },
    ];

    for (const tc of testCases) {
      const res = await request(app)
        .post('/api/ai/query')
        .set('Authorization', `Bearer ${token}`)
        .send({ message: tc.msg });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.intent, `Failed for message: "${tc.msg}"`).toBe(tc.expectedIntent);
      expect(res.body.quickLinks.some((l) => l.path === tc.expectedPath), `Missing path ${tc.expectedPath} for "${tc.msg}"`).toBe(true);
      expect(res.body.reply).not.toContain('chưa hỗ trợ');
    }
  });

  it('handles student search query returning student cards', async () => {
    const adminUser = await User.findOne({ role: ROLES.ADMIN });
    const token = signToken(adminUser);

    const res = await request(app)
      .post('/api/ai/query')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Tìm sinh viên Nguyễn Văn An' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.intent).toBe('SEARCH_STUDENT');
    expect(Array.isArray(res.body.cards)).toBe(true);
    expect(res.body.cards.length).toBeGreaterThan(0);
    expect(res.body.cards[0].type).toBe('student');
    expect(res.body.cards[0].action.path).toBe('/admin/students');
  });

  it('handles class filtering query returning class cards', async () => {
    const adminUser = await User.findOne({ role: ROLES.ADMIN });
    const token = signToken(adminUser);

    const res = await request(app)
      .post('/api/ai/query')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Lọc lớp CNTT' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.intent).toBe('FILTER_CLASS');
    expect(Array.isArray(res.body.cards)).toBe(true);
    expect(res.body.cards.length).toBeGreaterThan(0);
    expect(res.body.cards[0].type).toBe('class');
    expect(res.body.cards[0].action.path).toBe('/admin/classes');
  });

  it('handles specific student grade lookup returning grade cards', async () => {
    const adminUser = await User.findOne({ role: ROLES.ADMIN });
    const token = signToken(adminUser);

    const res = await request(app)
      .post('/api/ai/query')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Xem điểm của sinh viên Nguyễn Văn An' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.intent).toBe('SEARCH_STUDENT_GRADES');
    expect(Array.isArray(res.body.cards)).toBe(true);
    expect(res.body.cards.length).toBeGreaterThan(0);
    expect(res.body.cards[0].type).toBe('grade');
    expect(res.body.cards[0].action.path).toBe('/admin/gradebook');
  });

  it('returns profile approval cards with quick action for pending requests', async () => {
    const adminUser = await User.findOne({ role: ROLES.ADMIN });
    const token = signToken(adminUser);

    const studentUser = await User.findOne({ email: 'an.nguyen@edu.vn' });
    await ProfileRequest.create({
      userId: studentUser._id,
      targetModel: 'Student',
      targetId: studentUser._id,
      requesterRole: 'sinh-vien',
      requesterName: 'Nguyễn Văn An',
      requesterEmail: 'an.nguyen@edu.vn',
      type: 'avatar',
      status: 'pending',
    });

    const res = await request(app)
      .post('/api/ai/query')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Có yêu cầu nào mới không?' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.intent).toBe('QUERY_PENDING_REQUESTS');
    expect(Array.isArray(res.body.cards)).toBe(true);
    expect(res.body.cards.length).toBeGreaterThan(0);
    expect(res.body.cards[0].type).toBe('approval');
    expect(res.body.cards[0].actions.some((a) => a.actionType === 'APPROVE_REQUEST')).toBe(true);
  });

  it('returns feedback cards with 3 response templates for feedbacks inquiry', async () => {
    const adminUser = await User.findOne({ role: ROLES.ADMIN });
    const token = signToken(adminUser);

    await Feedback.create({
      studentId: 101,
      studentName: 'Nguyễn Văn An',
      studentEmail: 'an.nguyen@edu.vn',
      courseName: 'Lập trình Web',
      rating: 5,
      feedbackText: 'Thầy dạy rất tận tâm, bài giảng trực quan.',
      response: '',
    });

    const res = await request(app)
      .post('/api/ai/query')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Xem ý kiến phản hồi chưa đọc' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.intent).toBe('NAV_ADMIN_FEEDBACKS');
    expect(Array.isArray(res.body.cards)).toBe(true);
    expect(res.body.cards.length).toBeGreaterThan(0);
    expect(res.body.cards[0].type).toBe('feedback');
    expect(Array.isArray(res.body.cards[0].templates)).toBe(true);
    expect(res.body.cards[0].templates.length).toBe(3);
  });

  it('returns suggestion chips and links to 6 core admin modules on fallback', async () => {
    const adminUser = await User.findOne({ role: ROLES.ADMIN });
    const token = signToken(adminUser);

    const res = await request(app)
      .post('/api/ai/query')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'yêu cầu lạ hoắc không nằm trong các bộ nhận diện' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.intent).toBe('ADMIN_FALLBACK_SUGGESTIONS');
    expect(Array.isArray(res.body.suggestions)).toBe(true);
    expect(res.body.suggestions.length).toBeGreaterThan(0);
    expect(res.body.quickLinks.length).toBe(6);
  });
});

