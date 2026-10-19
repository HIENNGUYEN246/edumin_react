import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from './helpers/testApp.js';
import { createUser } from './helpers/factories.js';
import { createStudent } from '../src/modules/students/student.service.js';
import { Department } from '../src/modules/departments/department.model.js';
import { getSentEmails, clearSentEmails } from '../src/lib/mailer.js';
import { ROLES } from '../src/lib/roles.js';

describe('POST /api/auth/forgot-password', () => {
  let department;

  beforeEach(async () => {
    clearSentEmails();
    department = await Department.findOne({ id: 'CNTT' });
    if (!department) {
      department = await Department.create({ id: 'CNTT', name: 'Công nghệ thông tin' });
    }
  });

  describe('Trường hợp 1: Tôi quên mật khẩu', () => {
    it('khôi phục mật khẩu về 123 khi nhập Mã sinh viên (dạng số hoặc mã SV-xxx)', async () => {
      const student = await createStudent({
        hoTen: 'Nguyễn Văn Test',
        email: 'test.student@student.edu.vn',
        departmentId: department.id,
      });
      clearSentEmails();

      // 1. Nhập dạng mã SV-xxx
      const res = await request(app).post('/api/auth/forgot-password').send({
        type: 'password',
        identifier: `SV-${String(student.id).padStart(3, '0')}`,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Mật khẩu của bạn đã được khôi phục về: 123. Vui lòng đăng nhập lại!');

      // Không gửi email trong trường hợp quên mật khẩu
      expect(getSentEmails()).toHaveLength(0);

      // Đăng nhập lại thành công với mật khẩu 123
      const loginRes = await request(app).post('/api/auth/login').send({
        email: 'test.student@student.edu.vn',
        password: '123',
      });
      expect(loginRes.status).toBe(200);
      expect(loginRes.body.token).toBeDefined();
    });

    it('khôi phục mật khẩu về 123 khi nhập Tên đăng nhập / Email', async () => {
      await createUser({
        email: 'user.forgot@edu.vn',
        password: 'OriginalPassword123',
        hoTen: 'Người Dùng Quên Pass',
      });

      const res = await request(app).post('/api/auth/forgot-password').send({
        type: 'password',
        identifier: 'user.forgot@edu.vn',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Mật khẩu của bạn đã được khôi phục về: 123. Vui lòng đăng nhập lại!');

      // Đăng nhập lại với mật khẩu 123
      const loginRes = await request(app).post('/api/auth/login').send({
        email: 'user.forgot@edu.vn',
        password: '123',
      });
      expect(loginRes.status).toBe(200);
    });

    it('khôi phục mật khẩu về 123 khi nhập Mã giảng viên (dạng số hoặc mã GV-xxx)', async () => {
      const { createTeacher } = await import('../src/modules/teachers/teacher.service.js');
      const teacher = await createTeacher({
        hoTen: 'Lê Hoàng Giảng Viên',
        email: 'lehoang.gv@edu.vn',
        departmentId: department.id,
      });
      clearSentEmails();

      // Nhập dạng mã GV-xxx
      const res = await request(app).post('/api/auth/forgot-password').send({
        type: 'password',
        role: 'teacher',
        identifier: `GV-${String(teacher.id).padStart(3, '0')}`,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.role).toBe(ROLES.TEACHER);
      expect(res.body.message).toBe('Mật khẩu của bạn đã được khôi phục về: 123. Vui lòng đăng nhập lại!');

      // Đăng nhập lại với mật khẩu 123
      const loginRes = await request(app).post('/api/auth/login').send({
        email: 'lehoang.gv@edu.vn',
        password: '123',
      });
      expect(loginRes.status).toBe(200);
      expect(loginRes.body.token).toBeDefined();
    });

    it('báo lỗi 404 khi không tìm thấy sinh viên / tài khoản', async () => {
      const res = await request(app).post('/api/auth/forgot-password').send({
        type: 'password',
        identifier: 'SV-999999',
      });

      expect(res.status).toBe(404);
      expect(res.body.error.message).toContain('Không tìm thấy tài khoản');
    });
  });

  describe('Trường hợp 2: Tôi quên tên tài khoản', () => {
    it('tìm thấy tên đăng nhập của Giảng viên khi quét email, reset mật khẩu về 123 và gửi mail tự động', async () => {
      const { createTeacher } = await import('../src/modules/teachers/teacher.service.js');
      const teacherEmail = 'teacher.personal@gmail.com';
      await createTeacher({
        hoTen: 'Phạm Văn Thầy',
        email: teacherEmail,
        departmentId: department.id,
      });
      clearSentEmails();

      const res = await request(app).post('/api/auth/forgot-password').send({
        type: 'username',
        email: teacherEmail,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.username).toBe(teacherEmail);
      expect(res.body.role).toBe(ROLES.TEACHER);
      expect(res.body.message).toContain('123');
      expect(res.body.message).toContain('kiểm tra email');

      const sentEmails = getSentEmails();
      expect(sentEmails.length).toBeGreaterThanOrEqual(1);
      const emailSent = sentEmails.find((m) => m.to === teacherEmail);
      expect(emailSent).toBeDefined();
      expect(emailSent.text).toContain(teacherEmail);
      expect(emailSent.text).toContain('123');
    });

    it('tìm thấy tên đăng nhập, reset mật khẩu về 123 và gửi email tự động vào email cá nhân', async () => {
      const personalEmail = 'student.personal@gmail.com';
      await createUser({
        email: personalEmail,
        password: 'SomeOldPassword123',
        hoTen: 'Trần Văn Sinh Viên',
      });

      const res = await request(app).post('/api/auth/forgot-password').send({
        type: 'username',
        email: personalEmail,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.username).toBe(personalEmail);
      expect(res.body.message).toBe(
        `Tên đăng nhập của bạn là: ${personalEmail} và mật khẩu đã được khôi phục về: 123. Vui lòng kiểm tra email để xem lại thông tin này.`
      );

      // Đã gửi email tự động vào email cá nhân
      const sentEmails = getSentEmails();
      expect(sentEmails.length).toBeGreaterThanOrEqual(1);
      const emailSent = sentEmails.find((m) => m.to === personalEmail);
      expect(emailSent).toBeDefined();
      expect(emailSent.subject).toContain('Khôi phục thông tin tài khoản');
      expect(emailSent.text).toContain(personalEmail);
      expect(emailSent.text).toContain('123');

      // Đăng nhập lại thành công với mật khẩu 123
      const loginRes = await request(app).post('/api/auth/login').send({
        email: personalEmail,
        password: '123',
      });
      expect(loginRes.status).toBe(200);
    });

    it('báo lỗi 404 khi không tìm thấy tài khoản nào khớp với email cá nhân', async () => {
      const res = await request(app).post('/api/auth/forgot-password').send({
        type: 'username',
        email: 'unknown-email@gmail.com',
      });

      expect(res.status).toBe(404);
      expect(res.body.error.message).toContain('Không tìm thấy tài khoản');
    });
  });
});
