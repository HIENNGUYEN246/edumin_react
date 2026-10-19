import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from './helpers/testApp.js';
import { createUser } from './helpers/factories.js';
import { createStudent } from '../src/modules/students/student.service.js';
import { createTeacher } from '../src/modules/teachers/teacher.service.js';
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

  describe('Trường hợp KHÔNG nhập Email cá nhân', () => {
    it('Sinh viên: khôi phục mật khẩu thành công và trả về thông điệp chính xác, không gửi email', async () => {
      const student = await createStudent({
        hoTen: 'Nguyễn Văn Test',
        email: 'test.student@student.edu.vn',
        departmentId: department.id,
      });
      clearSentEmails();

      const res = await request(app).post('/api/auth/forgot-password').send({
        hoTen: 'Nguyễn Văn Test',
        identifier: `SV-${String(student.id).padStart(3, '0')}`,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.hasEmail).toBe(false);
      expect(res.body.message).toBe('Khôi phục mật khẩu thành công! Mật khẩu mới của bạn là: 123');

      // Tuyệt đối không gửi email
      expect(getSentEmails()).toHaveLength(0);

      // Đăng nhập lại thành công với mật khẩu 123
      const loginRes = await request(app).post('/api/auth/login').send({
        email: 'test.student@student.edu.vn',
        password: '123',
      });
      expect(loginRes.status).toBe(200);
      expect(loginRes.body.token).toBeDefined();
    });

    it('Giảng viên: khôi phục mật khẩu với mã GV-xxx và Họ tên', async () => {
      const teacher = await createTeacher({
        hoTen: 'Lê Hoàng Giảng Viên',
        email: 'lehoang.gv@edu.vn',
        departmentId: department.id,
      });
      clearSentEmails();

      const res = await request(app).post('/api/auth/forgot-password').send({
        hoTen: 'Lê Hoàng Giảng Viên',
        identifier: `GV-${String(teacher.id).padStart(3, '0')}`,
        role: 'teacher',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.role).toBe(ROLES.TEACHER);
      expect(res.body.message).toBe('Khôi phục mật khẩu thành công! Mật khẩu mới của bạn là: 123');
      expect(getSentEmails()).toHaveLength(0);

      // Đăng nhập lại với mật khẩu 123
      const loginRes = await request(app).post('/api/auth/login').send({
        email: 'lehoang.gv@edu.vn',
        password: '123',
      });
      expect(loginRes.status).toBe(200);
    });
  });

  describe('Trường hợp CÓ nhập Email cá nhân', () => {
    it('trả về tên đăng nhập, mật khẩu 123 và gửi email tự động vào email cá nhân', async () => {
      const student = await createStudent({
        hoTen: 'Trần Văn Sinh Viên',
        email: 'sv.tranvan@student.edu.vn',
        departmentId: department.id,
      });
      clearSentEmails();

      const personalEmail = 'tranvan.personal@gmail.com';
      const res = await request(app).post('/api/auth/forgot-password').send({
        hoTen: 'Trần Văn Sinh Viên',
        identifier: `SV-${String(student.id).padStart(3, '0')}`,
        email: personalEmail,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.hasEmail).toBe(true);
      expect(res.body.username).toBe('sv.tranvan@student.edu.vn');
      expect(res.body.message).toContain('Tên đăng nhập của bạn là:');
      expect(res.body.message).toContain('123');
      expect(res.body.message).toContain('kiểm tra email');

      // Đã gửi email tự động vào email cá nhân
      const sentEmails = getSentEmails();
      expect(sentEmails.length).toBeGreaterThanOrEqual(1);
      const emailSent = sentEmails.find((m) => m.to === personalEmail);
      expect(emailSent).toBeDefined();
      expect(emailSent.subject).toContain('Khôi phục thông tin tài khoản');
      expect(emailSent.text).toContain('sv.tranvan@student.edu.vn');
      expect(emailSent.text).toContain('123');
    });

    it('Giảng viên có nhập email cá nhân: nhận email có thông tin vai trò Giảng viên', async () => {
      const teacher = await createTeacher({
        hoTen: 'Đỗ Quốc Thầy',
        email: 'doquoc.gv@edu.vn',
        departmentId: department.id,
      });
      clearSentEmails();

      const personalEmail = 'doquoc.teacher@gmail.com';
      const res = await request(app).post('/api/auth/forgot-password').send({
        hoTen: 'Đỗ Quốc Thầy',
        identifier: `GV-${String(teacher.id).padStart(3, '0')}`,
        email: personalEmail,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.role).toBe(ROLES.TEACHER);
      expect(res.body.username).toBe('doquoc.gv@edu.vn');

      const sentEmails = getSentEmails();
      const emailSent = sentEmails.find((m) => m.to === personalEmail);
      expect(emailSent).toBeDefined();
      expect(emailSent.subject).toContain('Giảng viên');
      expect(emailSent.text).toContain('doquoc.gv@edu.vn');
      expect(emailSent.text).toContain('123');
    });

    it('Kịch bản "Tôi quên tên tài khoản": tra cứu theo Họ tên và Email cá nhân, bắt buộc gửi email', async () => {
      const personalEmail = 'student.forgotuser@gmail.com';
      const student = await createStudent({
        hoTen: 'Hoàng Kim Chi',
        email: personalEmail,
        departmentId: department.id,
      });
      clearSentEmails();

      const res = await request(app).post('/api/auth/forgot-password').send({
        type: 'username',
        hoTen: 'Hoàng Kim Chi',
        email: personalEmail,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.type).toBe('username');
      expect(res.body.username).toBe(personalEmail);
      expect(res.body.message).toContain('Tên đăng nhập của bạn là:');
      expect(res.body.message).toContain('123');
      expect(res.body.message).toContain('kiểm tra email');

      const sentEmails = getSentEmails();
      expect(sentEmails.length).toBeGreaterThanOrEqual(1);
      const emailSent = sentEmails.find((m) => m.to === personalEmail);
      expect(emailSent).toBeDefined();
      expect(emailSent.text).toContain(personalEmail);
      expect(emailSent.text).toContain('123');
    });
  });

  describe('Kiểm tra xác thực danh tính & xử lý lỗi', () => {
    it('báo lỗi 400 khi Họ và tên không khớp với thông tin tài khoản', async () => {
      const student = await createStudent({
        hoTen: 'Nguyễn Văn Đúng Tên',
        email: 'dungten@student.edu.vn',
        departmentId: department.id,
      });

      const res = await request(app).post('/api/auth/forgot-password').send({
        hoTen: 'Trần Sai Tên',
        identifier: `SV-${String(student.id).padStart(3, '0')}`,
      });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Họ và tên không khớp');
    });

    it('báo lỗi 404 khi không tìm thấy tài khoản', async () => {
      const res = await request(app).post('/api/auth/forgot-password').send({
        hoTen: 'Người Không Tồn Tại',
        identifier: 'SV-999999',
      });

      expect(res.status).toBe(404);
      expect(res.body.error.message).toContain('Không tìm thấy tài khoản');
    });
  });
});
