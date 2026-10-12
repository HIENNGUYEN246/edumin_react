import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { seed } from '../src/scripts/seed.js';
import { User } from '../src/modules/auth/user.model.js';
import { ProfileRequest } from '../src/modules/profileRequests/profileRequest.model.js';
import { Feedback } from '../src/modules/feedback/feedback.model.js';
import { ROLES } from '../src/lib/roles.js';
import { signToken } from '../src/lib/jwt.js';
import { createTeacher } from '../src/modules/teachers/teacher.service.js';
import { createStudent } from '../src/modules/students/student.service.js';
import { detectIntent, findStudentByName, BUSINESS_RESERVED_WORDS } from '../src/modules/ai/ai.service.js';

describe('AI Assistant API', () => {
  let app;

  beforeEach(async () => {
    app = createApp();
    await seed({ withSamples: true });
    await createTeacher({ hoTen: 'Trần Đình', email: 'dinh.tran@edu.vn', departmentId: 'NNA', password: 'Password123!' });
    await createStudent({ hoTen: 'Quyền Huế Trân', email: 'quyen@student.edu.vn', departmentId: 'NNA', className: '13A1', password: 'Password123!' });
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

  it('answers class student count query for teacher or student', async () => {
    const teacherUser = await User.findOne({ email: 'quan.tran@edu.vn' });
    const token = signToken(teacherUser);

    const res = await request(app)
      .post('/api/ai/query')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Sĩ số của lớp IT101-01 là bao nhiêu?' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.intent).toBe('QUERY_CLASS_STUDENT_COUNT');
    expect(res.body.reply).toContain('IT101-01');
    expect(res.body.reply).toContain('Sĩ số hiện tại');
  });

  it('answers teacher info and schedule query', async () => {
    const studentUser = await User.findOne({ email: 'an.nguyen@edu.vn' });
    const token = signToken(studentUser);

    const res = await request(app)
      .post('/api/ai/query')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Thầy Trần Minh Quân dạy môn gì?' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.intent).toBe('QUERY_TEACHER_INFO');
    expect(res.body.reply).toContain('Trần Minh Quân');
  });

  it('answers room and timetable query for a specific class', async () => {
    const studentUser = await User.findOne({ email: 'an.nguyen@edu.vn' });
    const token = signToken(studentUser);

    const res = await request(app)
      .post('/api/ai/query')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Lớp IT101-01 học ở phòng nào?' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.intent).toBe('QUERY_CLASS_ROOM_SCHEDULE');
    expect(res.body.reply).toContain('Phòng học:');
    expect(res.body.reply).toContain('A101');
  });

  it('suggests available courses for student based on major and enrollment status', async () => {
    const studentUser = await User.findOne({ email: 'an.nguyen@edu.vn' });
    const token = signToken(studentUser);

    const res = await request(app)
      .post('/api/ai/query')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Gợi ý các môn học tôi nên đăng ký' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.intent).toBe('SUGGEST_COURSES');
    expect(res.body.reply).toContain('Gợi ý học phần');
  });

  it('checks schedule clash for enrolled classes', async () => {
    const studentUser = await User.findOne({ email: 'an.nguyen@edu.vn' });
    const token = signToken(studentUser);

    const res = await request(app)
      .post('/api/ai/query')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Kiểm tra xem lịch học của tôi có bị trùng lịch không' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.intent).toBe('CHECK_SCHEDULE_CONFLICT');
    expect(res.body.reply).toBeDefined();
  });

  it('handles natural conversational student query for "Quyền Huế Trân"', async () => {
    const adminUser = await User.findOne({ role: ROLES.ADMIN });
    const token = signToken(adminUser);

    const res = await request(app)
      .post('/api/ai/query')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'có thông tin gì về bạn Quyền Huế Trân không ?' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.intent).toBe('SEARCH_STUDENT');
    expect(Array.isArray(res.body.cards)).toBe(true);
    expect(res.body.cards.length).toBeGreaterThan(0);
    expect(res.body.cards[0].title).toBe('Quyền Huế Trân');
    expect(res.body.cards[0].type).toBe('student');
    expect(res.body.cards[0].details.some((d) => d.label === 'MSSV')).toBe(true);
  });

  it('handles natural conversational teacher query for "thầy Đình"', async () => {
    const adminUser = await User.findOne({ role: ROLES.ADMIN });
    const token = signToken(adminUser);

    const res = await request(app)
      .post('/api/ai/query')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'bạn tìm giùm mình thầy Đình nha' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.intent).toBe('SEARCH_TEACHER');
    expect(Array.isArray(res.body.cards)).toBe(true);
    expect(res.body.cards.length).toBeGreaterThan(0);
    expect(res.body.cards[0].title).toBe('Trần Đình');
    expect(res.body.cards[0].type).toBe('teacher');
    expect(res.body.cards[0].details.some((d) => d.label === 'Mã GV')).toBe(true);
  });

  it('handles direct personnel lookup for raw name "Huê Trân" with real-time status and card details', async () => {
    const adminUser = await User.findOne({ role: ROLES.ADMIN });
    const token = signToken(adminUser);

    const res = await request(app)
      .post('/api/ai/query')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Huê Trân' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.intent).toBe('SEARCH_STUDENT');
    expect(Array.isArray(res.body.cards)).toBe(true);
    expect(res.body.cards[0].title).toBe('Quyền Huế Trân');
    expect(res.body.cards[0].details.some((d) => d.label === 'Trạng thái')).toBe(true);
  });

  it('integrates real-time pageContext to search on-screen personnel records', async () => {
    const adminUser = await User.findOne({ role: ROLES.ADMIN });
    const token = signToken(adminUser);

    const res = await request(app)
      .post('/api/ai/query')
      .set('Authorization', `Bearer ${token}`)
      .send({
        message: 'Lê Văn Test',
        pageContext: {
          students: [
            {
              id: 99,
              hoTen: 'Lê Văn Test',
              code: 'SV-099',
              className: 'CNTT-K20',
              department: 'Khoa CNTT',
              email: 'test@student.edu.vn',
              status: 'Đang học',
            },
          ],
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.intent).toBe('SEARCH_STUDENT');
    expect(res.body.cards[0].title).toBe('Lê Văn Test');
    expect(res.body.cards[0].code).toBe('SV-099');
  });

  it('handles conversational student grade inquiry for "cho mình xem tình hình điểm của em Trân được không?" with full in-chat summary', async () => {
    const adminUser = await User.findOne({ role: ROLES.ADMIN });
    const token = signToken(adminUser);

    const res = await request(app)
      .post('/api/ai/query')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'cho mình xem tình hình điểm của em Trân được không?' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.intent).toBe('SEARCH_STUDENT_GRADES');
    expect(res.body.reply).toContain('Quyền Huế Trân');
    expect(res.body.reply).toContain('Chuyên cần');
    expect(res.body.reply).toContain('Bài tập');
    expect(res.body.reply).toContain('Giữa kỳ');
    expect(res.body.reply).toContain('Cuối kỳ');
    expect(res.body.reply).toContain('Điểm tổng kết (GPA)');
    expect(res.body.reply).toContain('Trạng thái');

    expect(Array.isArray(res.body.cards)).toBe(true);
    expect(res.body.cards.length).toBeGreaterThan(0);
    expect(res.body.cards[0].type).toBe('grade');
    expect(res.body.cards[0].subtitle).toContain('Quyền Huế Trân');
    expect(res.body.cards[0].details.some((d) => d.label === 'Chuyên cần')).toBe(true);
    expect(res.body.cards[0].details.some((d) => d.label === 'Bài tập')).toBe(true);
    expect(res.body.cards[0].details.some((d) => d.label === 'Giữa kỳ')).toBe(true);
    expect(res.body.cards[0].details.some((d) => d.label === 'Cuối kỳ')).toBe(true);
    expect(res.body.cards[0].details.some((d) => d.label === 'Điểm tổng kết (GPA)')).toBe(true);
    expect(res.body.cards[0].details.some((d) => d.label === 'Trạng thái')).toBe(true);
  });

  it('handles conversational student grade inquiry by student code "bạn ơi cho mình xin kết quả học tập của SV-002 với nha"', async () => {
    const adminUser = await User.findOne({ role: ROLES.ADMIN });
    const token = signToken(adminUser);

    const res = await request(app)
      .post('/api/ai/query')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'bạn ơi cho mình xin kết quả học tập của SV-002 với nha' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.intent).toBe('SEARCH_STUDENT_GRADES');
    expect(res.body.reply).toContain('SV-002');
    expect(res.body.cards[0].subtitle).toContain('SV-002');
  });

  it('resolves on-screen student grades from pageContext when querying grades', async () => {
    const adminUser = await User.findOne({ role: ROLES.ADMIN });
    const token = signToken(adminUser);

    const res = await request(app)
      .post('/api/ai/query')
      .set('Authorization', `Bearer ${token}`)
      .send({
        message: 'xem điểm của bạn Đặng Gia Huy',
        pageContext: {
          currentClass: { id: 'ENG201-01', courseName: 'Tiếng Anh Thương Mại' },
          students: [
            {
              id: 77,
              hoTen: 'Đặng Gia Huy',
              code: 'SV-077',
              attendance: 10,
              homework: 9.5,
              midterm: 9.0,
              final: 9.2,
              finalScore: 9.3,
              status: 'Đạt',
            },
          ],
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.intent).toBe('SEARCH_STUDENT_GRADES');
    expect(res.body.reply).toContain('Đặng Gia Huy');
    expect(res.body.cards[0].title).toBe('Tiếng Anh Thương Mại');
    expect(res.body.cards[0].details.find((d) => d.label === 'Điểm tổng kết (GPA)').value).toBe('9.3');
  });

  it('handles natural grade filtering and sorting query "lọc cho mình những môn có điểm cao nhất đi"', async () => {
    const studentUser = await User.findOne({ email: 'an.nguyen@edu.vn' });
    const token = signToken(studentUser);

    const res = await request(app)
      .post('/api/ai/query')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'lọc cho mình những môn có điểm cao nhất đi' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.intent).toBe('FILTER_SORT_GRADES');
    expect(res.body.actionTrigger).toBeDefined();
    expect(res.body.actionTrigger.action).toBe('filter_grades');
    expect(res.body.actionTrigger.direction).toBe('desc');
    expect(res.body.reply).toContain('| STT | Mã HP | Tên học phần |');
    expect(res.body.reply).toContain('GPA');
    expect(Array.isArray(res.body.suggestions)).toBe(true);
  });

  it('handles natural query for courses grade summary "xem điểm các môn"', async () => {
    const studentUser = await User.findOne({ email: 'an.nguyen@edu.vn' });
    const token = signToken(studentUser);

    const res = await request(app)
      .post('/api/ai/query')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'xem điểm các môn' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.intent).toBe('COURSE_GRADES_SUMMARY');
    expect(res.body.reply).toContain('| STT | Mã HP | Tên học phần |');
    expect(res.body.reply).toContain('GPA');
    expect(res.body.quickLinks).toBeDefined();
  });

  it('handles natural tuition inquiry "học phí của tôi" with in-chat fee table', async () => {
    const studentUser = await User.findOne({ email: 'an.nguyen@edu.vn' });
    const token = signToken(studentUser);

    const res = await request(app)
      .post('/api/ai/query')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'học phí của tôi' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.intent).toBe('TUITION_INQUIRY');
    expect(res.body.reply).toContain('| Khoản mục |');
    expect(res.body.reply).toContain('Học phí');
    expect(res.body.reply).toContain('Đã thanh toán');
  });

  it('handles conversational student search "tìm bạn Huê Trân" without matching full sentence string', async () => {
    const adminUser = await User.findOne({ role: ROLES.ADMIN });
    const token = signToken(adminUser);

    const res = await request(app)
      .post('/api/ai/query')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'tìm bạn Huê Trân' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.intent).toBe('SEARCH_STUDENT');
    expect(Array.isArray(res.body.cards)).toBe(true);
    expect(res.body.cards[0].title).toBe('Quyền Huế Trân');
    expect(res.body.cards[0].type).toBe('student');
  });

  it('detects intents correctly via detectIntent and guards operational queries from student lookup', () => {
    expect(detectIntent('nhập lại điểm Quiz')).toBe('GRADE_MANAGEMENT');
    expect(detectIntent('cấu hình quiz')).toBe('GRADE_MANAGEMENT');
    expect(detectIntent('bảng điểm các môn')).toBe('GRADE_MANAGEMENT');
    expect(detectIntent('duyệt hồ sơ')).toBe('ADMIN_APPROVAL');
    expect(detectIntent('có yêu cầu thay đổi nào cần duyệt không?')).toBe('ADMIN_APPROVAL');
    expect(detectIntent('tìm giảng viên')).toBe('TEACHER_SEARCH');
    expect(detectIntent('thông tin thầy Đình')).toBe('TEACHER_SEARCH');
    expect(detectIntent('tìm sinh viên Nguyễn Văn An')).toBe('STUDENT_SEARCH');
    expect(detectIntent('tìm bạn Huê Trân')).toBe('STUDENT_SEARCH');
    expect(detectIntent('thời tiết hôm nay ra sao?')).toBe('GENERAL_FALLBACK');
  });

  it('safely guards findStudentByName against business reserved words', async () => {
    expect(await findStudentByName('nhập lại điểm Quiz')).toBeNull();
    expect(await findStudentByName('duyệt hồ sơ')).toBeNull();
    expect(await findStudentByName('tìm giảng viên')).toBeNull();
    expect(await findStudentByName('giảng viên')).toBeNull();
    expect(await findStudentByName('quiz')).toBeNull();
    expect(await findStudentByName('')).toBeNull();

    // Valid student search
    const found = await findStudentByName('Huê Trân');
    expect(found).not.toBeNull();
    expect(found.hoTen).toBe('Quyền Huế Trân');
  });

  it('handles "nhập lại điểm Quiz" without falling into student lookup or returning student error', async () => {
    const teacherUser = await User.findOne({ email: 'quan.tran@edu.vn' });
    const token = signToken(teacherUser);

    const res = await request(app)
      .post('/api/ai/query')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'nhập lại điểm Quiz' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.intent).toBe('NAV_GRADE_CONFIG');
    expect(res.body.reply).not.toContain('Không tìm thấy sinh viên');
  });

  it('handles "tìm giảng viên" routing to NAV_TEACHERS without returning empty teacher error', async () => {
    const adminUser = await User.findOne({ role: ROLES.ADMIN });
    const token = signToken(adminUser);

    const res = await request(app)
      .post('/api/ai/query')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'tìm giảng viên' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.intent).toBe('NAV_TEACHERS');
    expect(res.body.reply).not.toContain('Không tìm thấy');
    expect(res.body.quickLinks[0].path).toBe('/admin/teachers');
  });

  it('handles "duyệt hồ sơ" routing to QUERY_PENDING_REQUESTS without student lookup error', async () => {
    const adminUser = await User.findOne({ role: ROLES.ADMIN });
    const token = signToken(adminUser);

    const res = await request(app)
      .post('/api/ai/query')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'duyệt hồ sơ' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.intent).toBe('QUERY_PENDING_REQUESTS');
    expect(res.body.reply).not.toContain('Không tìm thấy sinh viên');
  });
});


