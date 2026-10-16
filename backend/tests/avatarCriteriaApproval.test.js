import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { app } from './helpers/testApp.js';
import { createUser, authHeader } from './helpers/factories.js';
import { ROLES } from '../src/lib/roles.js';
import { hashPassword } from '../src/lib/password.js';
import { signToken } from '../src/lib/jwt.js';
import { User } from '../src/modules/auth/user.model.js';
import { Student } from '../src/modules/students/student.model.js';
import { ProfileRequest } from '../src/modules/profileRequests/profileRequest.model.js';
import { setAdminCriteria, getAdminCriteria, evaluateRequestAgainstCriteria } from '../src/modules/ai/adminCriteria.store.js';

vi.mock('../src/lib/files.service.js', () => ({
  uploadBuffer: vi.fn(async (buf, opts = {}) => ({
    publicId: 'edumin/avatars/test_avatar_' + Date.now(),
    url: 'https://cdn.edumin.test/avatars/test.jpg',
    resourceType: 'image',
    bytes: 1024,
    format: 'jpg',
    access: 'public',
  })),
  destroy: vi.fn(async () => {}),
  signedUrl: vi.fn(() => 'https://cdn.edumin.test/signed'),
}));

async function makeAdmin() {
  const user = await User.create({
    email: 'admin.avatar@edu.vn',
    passwordHash: await hashPassword('password123'),
    role: ROLES.ADMIN,
    hoTen: 'Quản trị viên Hệ thống',
  });
  return { token: signToken(user), user };
}

async function makeStudent(idNum, name = `SV ${idNum}`) {
  const email = `sv.avatar.${idNum}@edu.vn`;
  const user = await User.create({
    email,
    passwordHash: await hashPassword('password123'),
    role: ROLES.STUDENT,
    hoTen: name,
  });
  const student = await Student.create({
    userId: user._id,
    id: idNum,
    email,
    hoTen: name,
  });
  user.student = student._id;
  await user.save();
  return { token: signToken(user), user, student };
}

describe('Admin Avatar Criteria Approval Flow & Chatbox Protection', () => {
  let admin;
  let student;

  beforeEach(async () => {
    admin = await makeAdmin();
    student = await makeStudent(101, 'Lê Thị Thu Thảo');
  });

  it('correctly parses criteria: "Tiêu chuẩn duyệt: Avatar phải là hình người và chỉ 1 người"', async () => {
    const res = await request(app)
      .post('/api/ai/query')
      .set(authHeader(admin.token))
      .send({
        message: 'Tiêu chuẩn duyệt: Avatar phải là hình người và chỉ 1 người',
      });

    expect(res.status).toBe(200);
    expect(res.body.intent).toBe('ADMIN_SET_CRITERIA');
    expect(res.body.reply).toContain('Avatar phải là hình người và chỉ 1 người');

    const activeCriteria = await getAdminCriteria();
    expect(activeCriteria.rules.requireHumanSingleAvatar).toBe(true);
    expect(activeCriteria.rules.customSummary).toContain('Avatar phải là hình người và chỉ 1 người');
  });

  it('rejects auto-approval when student uploads non-human avatar (e.g. cat/animal/anime) and keeps it in pending', async () => {
    // 1. Admin sets active criteria
    await setAdminCriteria('Tiêu chuẩn duyệt: Avatar phải là hình người và chỉ 1 người', admin.user);

    // 2. Student uploads a cat picture as avatar
    const fakeCatFile = Buffer.from('fake cat image bytes');
    const uploadRes = await request(app)
      .patch('/api/auth/me/avatar')
      .set(authHeader(student.token))
      .attach('file', fakeCatFile, { filename: 'my_cute_cat.jpg', contentType: 'image/jpeg' });

    expect(uploadRes.status).toBe(200);
    // MUST NOT be auto-approved!
    expect(uploadRes.body.pending).toBe(true);
    expect(uploadRes.body.autoApproved).toBeFalsy();

    // Verify request in DB is kept pending with clear rejection note
    const pendingReq = await ProfileRequest.findOne({ userId: student.user._id, status: 'pending' });
    expect(pendingReq).toBeTruthy();
    expect(pendingReq.type).toBe('avatar');
    expect(pendingReq.status).toBe('pending');
    expect(pendingReq.adminNote).toContain('Chưa đạt tiêu chí: Avatar không phải hình người');
  });

  it('rejects auto-approval when student uploads multi-person group photo and keeps it in pending', async () => {
    // 1. Admin sets active criteria
    await setAdminCriteria('Tiêu chuẩn duyệt: Avatar phải là hình người và chỉ 1 người', admin.user);

    // 2. Student uploads a group photo
    const fakeGroupFile = Buffer.from('fake group photo bytes');
    const uploadRes = await request(app)
      .patch('/api/auth/me/avatar')
      .set(authHeader(student.token))
      .attach('file', fakeGroupFile, { filename: 'group_friends_trip.png', contentType: 'image/png' });

    expect(uploadRes.status).toBe(200);
    expect(uploadRes.body.pending).toBe(true);
    expect(uploadRes.body.autoApproved).toBeFalsy();

    const pendingReq = await ProfileRequest.findOne({ userId: student.user._id, status: 'pending' });
    expect(pendingReq).toBeTruthy();
    expect(pendingReq.adminNote).toContain('tiêu chuẩn chỉ cho phép đúng 1 người');
  });

  it('automatically approves when student uploads valid single-person portrait matching the criteria', async () => {
    // 1. Admin sets active criteria
    await setAdminCriteria('Tiêu chuẩn duyệt: Avatar phải là hình người và chỉ 1 người', admin.user);

    // 2. Student uploads a single-person portrait
    const fakePortraitFile = Buffer.from('fake portrait image bytes');
    const uploadRes = await request(app)
      .patch('/api/auth/me/avatar')
      .set(authHeader(student.token))
      .attach('file', fakePortraitFile, { filename: 'avatar_portrait_le_thi_thu_thao.jpg', contentType: 'image/jpeg' });

    expect(uploadRes.status).toBe(200);
    // Meets criteria: auto-approved!
    expect(uploadRes.body.pending).toBe(false);
    expect(uploadRes.body.autoApproved).toBe(true);

    const approvedReq = await ProfileRequest.findOne({ userId: student.user._id });
    expect(approvedReq.status).toBe('approved');
    expect(approvedReq.adminNote).toContain('Đạt tiêu chí của Admin');
  });

  it('Admin Chatbox query: "Duyệt ảnh đại diện nhanh" detects non-human avatar and keeps it pending without auto-approving', async () => {
    // 1. Admin sets active criteria
    await setAdminCriteria('Tiêu chuẩn duyệt: Avatar phải là hình người và chỉ 1 người', admin.user);

    // 2. Create a pending request with a cat avatar in DB
    const catReq = await ProfileRequest.create({
      userId: student.user._id,
      targetModel: 'Student',
      targetId: student.student._id,
      requesterRole: ROLES.STUDENT,
      requesterName: 'Lê Thị Thu Thảo',
      requesterEmail: student.user.email,
      type: 'avatar',
      status: 'pending',
      requestedData: {
        avatar: {
          publicId: 'edumin/avatars/cat_photo',
          url: 'https://cdn.edumin.test/avatars/cat.jpg',
          originalName: 'cat_meo.jpg',
        },
      },
    });

    // 3. Admin asks AI in Chatbox to duyệt ảnh đại diện nhanh / duyệt theo tiêu chuẩn
    const res = await request(app)
      .post('/api/ai/query')
      .set(authHeader(admin.token))
      .send({
        message: 'Duyệt ảnh đại diện nhanh',
      });

    expect(res.status).toBe(200);
    expect(res.body.intent).toBe('ADMIN_APPLY_CRITERIA_APPROVAL');
    // Must list as NOT meeting criteria
    expect(res.body.reply).toContain('HỒ SƠ KHÔNG ĐẠT TIÊU CHUẨN');
    expect(res.body.reply).toContain('Avatar không phải hình người');
    expect(res.body.reply).toContain('Giữ nguyên ở trạng thái Chờ duyệt để Admin xem xét thủ công');

    // Verify DB record is STILL pending!
    const reloaded = await ProfileRequest.findById(catReq._id);
    expect(reloaded.status).toBe('pending');
  });
});

