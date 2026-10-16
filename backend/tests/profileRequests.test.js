import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from './helpers/testApp.js';
import { createUser, authHeader } from './helpers/factories.js';
import { ROLES } from '../src/lib/roles.js';
import { Teacher } from '../src/modules/teachers/teacher.model.js';
import { Student } from '../src/modules/students/student.model.js';
import { ProfileRequest } from '../src/modules/profileRequests/profileRequest.model.js';
import { Notification } from '../src/modules/notifications/notification.model.js';

vi.mock('../src/lib/files.service.js', () => ({
  uploadBuffer: vi.fn(async () => ({
    publicId: 'edumin/avatars/mock-req',
    url: 'https://cdn.test/mock-req.png',
    resourceType: 'image',
    bytes: 120,
    format: 'png',
    access: 'public',
  })),
  destroy: vi.fn(async () => {}),
  signedUrl: vi.fn(() => 'https://cdn.test/signed'),
}));

describe('Profile Requests & Approvals', () => {
  let adminToken;
  let teacherToken;
  let teacherUser;
  let teacherProfile;

  beforeEach(async () => {
    const admin = await createUser({ role: ROLES.ADMIN, email: 'admin@edu.vn' });
    adminToken = admin.token;

    const tUser = await createUser({ role: ROLES.TEACHER, email: 'gv.test@edu.vn', hoTen: 'Thầy Test' });
    teacherProfile = await Teacher.create({
      id: 101,
      userId: tUser.user._id,
      hoTen: 'Thầy Test',
      email: 'gv.test@edu.vn',
      phone: '0901234567',
    });
    tUser.user.teacher = teacherProfile._id;
    await tUser.user.save();

    teacherToken = tUser.token;
    teacherUser = tUser.user;
  });

  it('submits avatar change request as teacher and notifies admin', async () => {
    const res = await request(app)
      .put('/api/auth/me/avatar')
      .set(authHeader(teacherToken))
      .attach('file', Buffer.from('fake-image-bytes'), 'avatar.png');

    expect(res.status).toBe(200);
    expect(res.body.pending).toBe(true);

    const pendingReq = await ProfileRequest.findOne({ userId: teacherUser._id, status: 'pending' });
    expect(pendingReq).toBeDefined();
    expect(pendingReq.type).toBe('avatar');
    expect(pendingReq.requestedData.avatar?.url).toBe('https://cdn.test/mock-req.png');

    const adminNotif = await Notification.findOne({ recipientRole: ROLES.ADMIN });
    expect(adminNotif).toBeDefined();
    expect(adminNotif.title).toContain('Yêu cầu duyệt');
  });

  it('submits profile info change request as teacher', async () => {
    const res = await request(app)
      .put('/api/auth/me/profile')
      .set(authHeader(teacherToken))
      .send({ hoTen: 'Thầy Test Mới', phone: '0988776655' });

    expect(res.status).toBe(200);
    expect(res.body.pending).toBe(true);

    const pendingReq = await ProfileRequest.findOne({ userId: teacherUser._id, status: 'pending' });
    expect(pendingReq.type).toBe('profile');
    expect(pendingReq.requestedData.phone).toBe('0988776655');
  });

  it('admin approves a request and user is notified', async () => {
    const reqDoc = await ProfileRequest.create({
      userId: teacherUser._id,
      targetModel: 'Teacher',
      targetId: teacherProfile._id,
      requesterRole: ROLES.TEACHER,
      requesterName: 'Thầy Test',
      requesterEmail: 'gv.test@edu.vn',
      type: 'profile',
      status: 'pending',
      requestedData: { hoTen: 'Thầy Đã Duyệt', phone: '0999999999' },
    });

    const res = await request(app)
      .put(`/api/profile-requests/${reqDoc._id}/approve`)
      .set(authHeader(adminToken));

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('approved');

    const updatedTeacher = await Teacher.findById(teacherProfile._id);
    expect(updatedTeacher.hoTen).toBe('Thầy Đã Duyệt');
    expect(updatedTeacher.phone).toBe('0999999999');

    const userNotif = await Notification.findOne({ recipientUser: teacherUser._id });
    expect(userNotif).toBeDefined();
    expect(userNotif.title).toContain('phê duyệt');
  });

  it('admin bulk approves multiple requests', async () => {
    const req1 = await ProfileRequest.create({
      userId: teacherUser._id,
      targetModel: 'Teacher',
      targetId: teacherProfile._id,
      requesterRole: ROLES.TEACHER,
      type: 'profile',
      status: 'pending',
      requestedData: { phone: '0111111111' },
    });

    const sUser = await createUser({ role: ROLES.STUDENT, email: 'sv.test@edu.vn', hoTen: 'Trò Test' });
    const studentProfile = await Student.create({
      id: 201,
      userId: sUser.user._id,
      hoTen: 'Trò Test',
      email: 'sv.test@edu.vn',
      phone: '0222222222',
    });
    sUser.user.student = studentProfile._id;
    await sUser.user.save();

    const req2 = await ProfileRequest.create({
      userId: sUser.user._id,
      targetModel: 'Student',
      targetId: studentProfile._id,
      requesterRole: ROLES.STUDENT,
      type: 'profile',
      status: 'pending',
      requestedData: { phone: '0333333333' },
    });

    const res = await request(app)
      .post('/api/profile-requests/bulk-approve')
      .set(authHeader(adminToken))
      .send({ ids: [String(req1._id), String(req2._id)] });

    expect(res.status).toBe(200);
    expect(res.body.approvedCount).toBe(2);

    const doc1 = await ProfileRequest.findById(req1._id);
    const doc2 = await ProfileRequest.findById(req2._id);
    expect(doc1.status).toBe('approved');
    expect(doc2.status).toBe('approved');
  });

  it('admin bulk rejects requests with reason', async () => {
    const req1 = await ProfileRequest.create({
      userId: teacherUser._id,
      targetModel: 'Teacher',
      targetId: teacherProfile._id,
      requesterRole: ROLES.TEACHER,
      type: 'avatar',
      status: 'pending',
      requestedData: { avatar: { url: 'https://bad.url' } },
    });

    const res = await request(app)
      .post('/api/profile-requests/bulk-reject')
      .set(authHeader(adminToken))
      .send({ ids: [String(req1._id)], reason: 'Ảnh không đúng quy định' });

    expect(res.status).toBe(200);
    expect(res.body.rejectedCount).toBe(1);

    const doc1 = await ProfileRequest.findById(req1._id);
    expect(doc1.status).toBe('rejected');
    expect(doc1.adminNote).toBe('Ảnh không đúng quy định');
  });
});

