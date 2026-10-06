import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from './helpers/testApp.js';
import { createUser, authHeader } from './helpers/factories.js';
import { ROLES } from '../src/lib/roles.js';
import { hashPassword } from '../src/lib/password.js';
import { signToken } from '../src/lib/jwt.js';
import { User } from '../src/modules/auth/user.model.js';
import { Student } from '../src/modules/students/student.model.js';
import { Tuition } from '../src/modules/tuition/tuition.model.js';

async function makeStudent(idNum, className = '20DTH01') {
  const email = `sv${idNum}@edu.vn`;
  const user = await User.create({ email, passwordHash: await hashPassword('x'), role: ROLES.STUDENT, hoTen: `SV ${idNum}` });
  const student = await Student.create({ userId: user._id, id: idNum, email, hoTen: `SV ${idNum}`, className, department: 'CNTT' });
  user.student = student._id;
  await user.save();
  return { token: signToken(user), student };
}

describe('Tuition & Finance Module', () => {
  let adminToken;
  let accountantToken;
  let student1;
  let student2;

  beforeEach(async () => {
    const admin = await createUser({ role: ROLES.ADMIN });
    adminToken = admin.token;

    const accountantUser = await User.create({
      email: 'ketoan.test@edu.vn',
      passwordHash: await hashPassword('x'),
      role: ROLES.ACCOUNTANT,
      hoTen: 'Kế toán viên',
      status: 'Active',
    });
    accountantToken = signToken(accountantUser);

    student1 = await makeStudent(101, '20DTH01');
    student2 = await makeStudent(102, '20DTH02');

    await Tuition.create([
      {
        student: student1.student._id,
        studentId: student1.student.id,
        studentName: student1.student.hoTen,
        studentEmail: student1.student.email,
        className: '20DTH01',
        department: 'CNTT',
        semester: 'HK1 (2026-2027)',
        amount: 4500000,
        amountPaid: 0,
        amountDue: 4500000,
        status: 'Chưa đóng',
      },
      {
        student: student2.student._id,
        studentId: student2.student.id,
        studentName: student2.student.hoTen,
        studentEmail: student2.student.email,
        className: '20DTH02',
        department: 'CNTT',
        semester: 'HK1 (2026-2027)',
        amount: 5000000,
        amountPaid: 2000000,
        amountDue: 3000000,
        status: 'Đang nợ',
      },
    ]);
  });

  it('allows accountant to list tuitions and filter by class', async () => {
    const res = await request(app)
      .get('/api/tuition?className=20DTH01')
      .set(authHeader(accountantToken));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].studentId).toBe(101);
  });

  it('returns tuition statistics correctly', async () => {
    const res = await request(app)
      .get('/api/tuition/stats')
      .set(authHeader(accountantToken));
    expect(res.status).toBe(200);
    expect(res.body.totalCount).toBe(2);
    expect(res.body.totalAmount).toBe(9500000);
    expect(res.body.totalPaid).toBe(2000000);
    expect(res.body.totalDue).toBe(7500000);
    expect(res.body.unpaidCount).toBe(1);
    expect(res.body.debtCount).toBe(1);
  });

  it('records a payment and updates balances & transaction log', async () => {
    const listRes = await request(app).get('/api/tuition').set(authHeader(accountantToken));
    const target = listRes.body.data.find((t) => t.studentId === 101);

    const payRes = await request(app)
      .post(`/api/tuition/${target._id}/pay`)
      .set(authHeader(accountantToken))
      .send({
        amount: 2500000,
        paymentMethod: 'Chuyển khoản',
        transactionCode: 'TEST-TX-101',
        note: 'Đóng học phí đợt 1',
      });
    expect(payRes.status).toBe(200);
    expect(payRes.body.amountPaid).toBe(2500000);
    expect(payRes.body.amountDue).toBe(2000000);
    expect(payRes.body.status).toBe('Đang nợ');
    expect(payRes.body.transactions).toHaveLength(1);
    expect(payRes.body.transactions[0].transactionCode).toBe('TEST-TX-101');
  });

  it('bulk updates tuition status to Đã đóng', async () => {
    const listRes = await request(app).get('/api/tuition').set(authHeader(accountantToken));
    const ids = listRes.body.data.map((t) => t._id);

    const bulkRes = await request(app)
      .patch('/api/tuition/bulk-status')
      .set(authHeader(accountantToken))
      .send({
        ids,
        status: 'Đã đóng',
        note: 'Xác nhận thu từ ngân hàng',
      });
    expect(bulkRes.status).toBe(200);
    expect(bulkRes.body.updatedCount).toBe(2);

    const checkRes = await request(app).get('/api/tuition').set(authHeader(accountantToken));
    expect(checkRes.body.data.every((t) => t.status === 'Đã đóng')).toBe(true);
    expect(checkRes.body.data.every((t) => t.amountDue === 0)).toBe(true);
  });

  it('allows student to view their own tuition and forbids access to management', async () => {
    // Student self-service
    const meRes = await request(app)
      .get('/api/tuition/me')
      .set(authHeader(student1.token));
    expect(meRes.status).toBe(200);
    expect(meRes.body.student.id).toBe(101);
    expect(meRes.body.data).toHaveLength(1);
    expect(meRes.body.summary.totalDue).toBe(4500000);

    // Student forbidden from accountant/admin list
    const forbidRes = await request(app)
      .get('/api/tuition')
      .set(authHeader(student1.token));
    expect(forbidRes.status).toBe(403);
  });

  it('imports tuition rows from Excel data', async () => {
    const rows = [
      { MaSV: '101', SoTien: 4500000, TrangThai: 'Đã đóng', MaGiaoDich: 'BANK-IMP-01', GhiChu: 'Sao kê VCB' },
    ];

    const importRes = await request(app)
      .post('/api/tuition/import')
      .set(authHeader(accountantToken))
      .send({ rows });
    expect(importRes.status).toBe(200);
    expect(importRes.body.updated).toBe(1);

    const docRes = await request(app).get('/api/tuition?search=101').set(authHeader(accountantToken));
    expect(docRes.body.data[0].status).toBe('Đã đóng');
    expect(docRes.body.data[0].amountDue).toBe(0);
  });
});
