import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const mailerMocks = vi.hoisted(() => ({
  isEmailConfigured: vi.fn(),
  sendAccountCreatedEmail: vi.fn(),
}));

vi.mock('../src/lib/mailer.js', () => mailerMocks);

import { app } from './helpers/testApp.js';
import { createUser, authHeader } from './helpers/factories.js';
import { ROLES } from '../src/lib/roles.js';
import { Department } from '../src/modules/departments/department.model.js';
import { createTeacher } from '../src/modules/teachers/teacher.service.js';
import { createStudent } from '../src/modules/students/student.service.js';
import { Teacher } from '../src/modules/teachers/teacher.model.js';

let adminToken;
let teacher;

beforeEach(async () => {
  vi.clearAllMocks();
  mailerMocks.isEmailConfigured.mockReturnValue(true);
  mailerMocks.sendAccountCreatedEmail.mockResolvedValue({
    success: true,
    messageId: 'test-message',
  });
  const { token } = await createUser({ role: ROLES.ADMIN });
  adminToken = token;
  const department = await Department.create({ id: 'CNTT', name: 'Công nghệ thông tin' });
  teacher = await createTeacher({
    hoTen: 'Nguyễn Giáo Viên',
    email: 'teacher@edu.vn',
    departmentId: department.id,
    dob: '1980-01-01',
    phone: '0900000001',
    address: 'TP HCM',
    education: 'Thạc sĩ',
  });
  await createStudent({
    hoTen: 'Trần Sinh Viên',
    email: 'student@edu.vn',
    departmentId: department.id,
    dob: '2004-01-01',
    phone: '0900000002',
    address: 'TP HCM',
  });
  vi.clearAllMocks();
});

describe('Admin account email communications', () => {
  it('requires an authenticated training administrator', async () => {
    const response = await request(app).get('/api/communications/recipients?role=giao-vien');
    expect(response.status).toBe(401);

    const { token } = await createUser({ role: ROLES.TEACHER });
    const forbidden = await request(app)
      .get('/api/communications/recipients?role=giao-vien')
      .set(authHeader(token));
    expect(forbidden.status).toBe(403);
  });

  it('lists recipients separately by role without exposing password data', async () => {
    const response = await request(app)
      .get('/api/communications/recipients?role=giao-vien')
      .set(authHeader(adminToken));

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toMatchObject({
      _id: String(teacher._id),
      hoTen: 'Nguyễn Giáo Viên',
      email: 'teacher@edu.vn',
      accountActive: true,
    });
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
  });

  it('sends one account email or a selected batch with the correct default credentials', async () => {
    const response = await request(app)
      .post('/api/communications/account-credentials')
      .set(authHeader(adminToken))
      .send({
        recipients: [
          {
            role: ROLES.TEACHER,
            accountEmail: 'teacher@edu.vn',
            recipientEmail: 'teacher.personal@gmail.com',
          },
          {
            role: ROLES.STUDENT,
            accountEmail: 'student@edu.vn',
            recipientEmail: 'student.personal@gmail.com',
          },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ total: 2, sent: 2, failed: 0, skipped: 0 });
    expect(response.body.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          accountEmail: 'teacher@edu.vn',
          recipientEmail: 'teacher.personal@gmail.com',
          status: 'sent',
        }),
        expect.objectContaining({
          accountEmail: 'student@edu.vn',
          recipientEmail: 'student.personal@gmail.com',
          status: 'sent',
        }),
      ])
    );
    expect(mailerMocks.sendAccountCreatedEmail).toHaveBeenCalledTimes(2);
    expect(mailerMocks.sendAccountCreatedEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'teacher@edu.vn',
        toEmail: 'teacher.personal@gmail.com',
        role: ROLES.TEACHER,
        password: '123',
      })
    );
    expect(mailerMocks.sendAccountCreatedEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'student@edu.vn',
        toEmail: 'student.personal@gmail.com',
        role: ROLES.STUDENT,
        password: '123',
      })
    );
  });

  it('does not send a stale default password after an account password was changed', async () => {
    await createTeacher({
      hoTen: 'Giáo viên đã đổi mật khẩu',
      email: 'changed@edu.vn',
      departmentId: 'CNTT',
      dob: '1980-01-01',
      phone: '0900000003',
      address: 'TP HCM',
      education: 'Thạc sĩ',
      password: 'NewPassword!123',
    });
    mailerMocks.sendAccountCreatedEmail.mockClear();

    const response = await request(app)
      .post('/api/communications/account-credentials')
      .set(authHeader(adminToken))
      .send({
        recipients: [
          {
            role: ROLES.TEACHER,
            accountEmail: 'changed@edu.vn',
            recipientEmail: 'personal@gmail.com',
          },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ total: 1, sent: 0, skipped: 1 });
    expect(response.body.results[0].status).toBe('skipped');
    expect(mailerMocks.sendAccountCreatedEmail).not.toHaveBeenCalled();
  });

  it('reports partial delivery when one of the selected messages fails', async () => {
    mailerMocks.sendAccountCreatedEmail.mockImplementation(async ({ toEmail }) => {
      if (toEmail === 'student.personal@gmail.com') throw new Error('SMTP rejected recipient');
      return { success: true, messageId: 'test-message' };
    });

    const response = await request(app)
      .post('/api/communications/account-credentials')
      .set(authHeader(adminToken))
      .send({
        recipients: [
          {
            role: ROLES.TEACHER,
            accountEmail: 'teacher@edu.vn',
            recipientEmail: 'teacher.personal@gmail.com',
          },
          {
            role: ROLES.STUDENT,
            accountEmail: 'student@edu.vn',
            recipientEmail: 'student.personal@gmail.com',
          },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ total: 2, sent: 1, failed: 1, skipped: 0 });
    expect(
      response.body.results.find(({ accountEmail }) => accountEmail === 'student@edu.vn').status
    ).toBe('failed');
  });

  it('requires Gmail configuration and validates recipient roles and batch size', async () => {
    mailerMocks.isEmailConfigured.mockReturnValue(false);
    const notConfigured = await request(app)
      .post('/api/communications/account-credentials')
      .set(authHeader(adminToken))
      .send({
        recipients: [
          {
            role: ROLES.TEACHER,
            accountEmail: 'teacher@edu.vn',
            recipientEmail: 'teacher.personal@gmail.com',
          },
        ],
      });
    expect(notConfigured.status).toBe(503);

    mailerMocks.isEmailConfigured.mockReturnValue(true);
    const wrongRole = await request(app)
      .post('/api/communications/account-credentials')
      .set(authHeader(adminToken))
      .send({
        recipients: [
          {
            role: ROLES.STUDENT,
            accountEmail: 'teacher@edu.vn',
            recipientEmail: 'teacher.personal@gmail.com',
          },
        ],
      });
    expect(wrongRole.status).toBe(200);
    expect(wrongRole.body).toMatchObject({ sent: 0, failed: 1 });

    const tooMany = await request(app)
      .post('/api/communications/account-credentials')
      .set(authHeader(adminToken))
      .send({
        recipients: Array.from({ length: 101 }, (_, index) => ({
          role: ROLES.TEACHER,
          accountEmail: `teacher${index}@edu.vn`,
          recipientEmail: `teacher${index}@gmail.com`,
        })),
      });
    expect(tooMany.status).toBe(400);
    expect(mailerMocks.sendAccountCreatedEmail).not.toHaveBeenCalled();
  });

  it('rejects non-Gmail recipients and addresses matching the account email', async () => {
    const nonGmail = await request(app)
      .post('/api/communications/account-credentials')
      .set(authHeader(adminToken))
      .send({
        recipients: [
          {
            role: ROLES.TEACHER,
            accountEmail: 'teacher@edu.vn',
            recipientEmail: 'teacher.personal@university.edu.vn',
          },
        ],
      });
    expect(nonGmail.status).toBe(400);

    const sameAddress = await request(app)
      .post('/api/communications/account-credentials')
      .set(authHeader(adminToken))
      .send({
        recipients: [
          {
            role: ROLES.TEACHER,
            accountEmail: 'teacher.personal@gmail.com',
            recipientEmail: 'teacher.personal@gmail.com',
          },
        ],
      });
    expect(sameAddress.status).toBe(400);
    expect(mailerMocks.sendAccountCreatedEmail).not.toHaveBeenCalled();
  });

  it('does not prefill a stored account email as the personal Gmail recipient', async () => {
    await Teacher.updateOne(
      { _id: teacher._id },
      { $set: { emailNhanThongBao: teacher.email } }
    );

    const response = await request(app)
      .get('/api/communications/recipients?role=giao-vien')
      .set(authHeader(adminToken));

    expect(response.status).toBe(200);
    expect(response.body.data[0].emailNhanThongBao).toBe('');
  });
});
