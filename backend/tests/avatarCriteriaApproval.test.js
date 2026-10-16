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
import { inspectImageHeuristics, evaluateAvatarDeterministicRule } from '../src/modules/ai/avatarVision.service.js';

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
    expect(uploadRes.body.approved).toBe(false);
    expect(uploadRes.body.isValid).toBe(false);
    expect(uploadRes.body.pending).toBe(true);
    expect(uploadRes.body.autoApproved).toBeFalsy();
    expect(uploadRes.body.message).toContain('Ảnh không hợp lệ: Yêu cầu bắt buộc phải có đúng 1 người trong khung hình!');

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
    expect(uploadRes.body.approved).toBe(false);
    expect(uploadRes.body.isValid).toBe(false);
    expect(uploadRes.body.pending).toBe(true);
    expect(uploadRes.body.autoApproved).toBeFalsy();
    expect(uploadRes.body.message).toContain('Ảnh không hợp lệ: Yêu cầu bắt buộc phải có đúng 1 người trong khung hình!');

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
    expect(uploadRes.body.approved).toBe(true);
    expect(uploadRes.body.isValid).toBe(true);
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

  it('strictly rejects arbitrary/generic images without portrait proof when criteria is active', async () => {
    await setAdminCriteria('Tiêu chuẩn duyệt: Avatar phải là hình người và chỉ 1 người', admin.user);

    const fakeFile = Buffer.from('fake image without clear portrait');
    const uploadRes = await request(app)
      .patch('/api/auth/me/avatar')
      .set(authHeader(student.token))
      .attach('file', fakeFile, { filename: 'screenshot_unspecified.png', contentType: 'image/png' });

    expect(uploadRes.status).toBe(200);
    expect(uploadRes.body.approved).toBe(false);
    expect(uploadRes.body.isValid).toBe(false);
    expect(uploadRes.body.pending).toBe(true);
    expect(uploadRes.body.message).toContain('Ảnh không hợp lệ: Yêu cầu bắt buộc phải có đúng 1 người trong khung hình!');
  });

  it('inspectImageHeuristics strictly identifies non-human, multi-person, ambiguous, and valid portraits', () => {
    // 1. Non-human (animal, anime, scenery, etc.)
    const cat = inspectImageHeuristics({ originalname: 'cute_cat.jpg' });
    expect(cat.isValid).toBe(false);
    expect(cat.approved).toBe(false);
    expect(cat.isHuman).toBe(false);
    expect(cat.reason).toContain('Ảnh không hợp lệ: Yêu cầu bắt buộc phải có đúng 1 người trong khung hình!');

    const anime = inspectImageHeuristics({ originalname: 'naruto_shippuden.png' });
    expect(anime.isValid).toBe(false);
    expect(anime.isHuman).toBe(false);

    // 2. Multi-person / group
    const group = inspectImageHeuristics({ originalname: 'team_building_trip.jpg' });
    expect(group.isValid).toBe(false);
    expect(group.isSinglePerson).toBe(false);
    expect(group.personCount).toBeGreaterThan(1);
    expect(group.reason).toContain('Ảnh không hợp lệ: Yêu cầu bắt buộc phải có đúng 1 người trong khung hình!');

    // 3. Ambiguous / generic filename (NEVER defaults to true)
    const generic = inspectImageHeuristics({ originalname: 'file_unlabeled.png' });
    expect(generic.isValid).toBe(false);
    expect(generic.approved).toBe(false);
    expect(generic.reason).toBe('Ảnh không hợp lệ: Yêu cầu bắt buộc phải có đúng 1 người trong khung hình!');

    // 4. Valid single person portrait
    const valid = inspectImageHeuristics({ originalname: 'anh_the_sinh_vien.jpg' });
    expect(valid.isValid).toBe(true);
    expect(valid.approved).toBe(true);
    expect(valid.isHuman).toBe(true);
    expect(valid.personCount).toBe(1);
    expect(valid.isSinglePerson).toBe(true);
    expect(valid.reason).toBe('');
  });

  it('evaluateRequestAgainstCriteria strictly requires isValid === true and isHuman === true and personCount === 1', () => {
    const rules = { requireHumanSingleAvatar: true };

    // Case A: AI returned isValid: false
    const evalA = evaluateRequestAgainstCriteria(
      { type: 'avatar', requestedData: { avatar: { analysis: { isValid: false, reason: 'Ảnh không hợp lệ: Yêu cầu bắt buộc phải có đúng 1 người trong khung hình!' } } } },
      rules
    );
    expect(evalA.pass).toBe(false);
    expect(evalA.fails[0]).toContain('Ảnh không hợp lệ');

    // Case B: AI returned isValid: true but personCount is 2 (inconsistency guard)
    const evalB = evaluateRequestAgainstCriteria(
      { type: 'avatar', requestedData: { avatar: { analysis: { isValid: true, isHuman: true, personCount: 2 } } } },
      rules
    );
    expect(evalB.pass).toBe(false);
    expect(evalB.fails[0]).toContain('tiêu chuẩn chỉ cho phép đúng 1 người');

    // Case C: AI returned isValid: true but isHuman is false
    const evalC = evaluateRequestAgainstCriteria(
      { type: 'avatar', requestedData: { avatar: { analysis: { isValid: true, isHuman: false, personCount: 1 } } } },
      rules
    );
    expect(evalC.pass).toBe(false);
    expect(evalC.fails[0]).toContain('Avatar không phải hình người');

    // Case D: AI strictly satisfies isValid === true, isHuman === true, personCount === 1
    const evalD = evaluateRequestAgainstCriteria(
      { type: 'avatar', requestedData: { avatar: { analysis: { isValid: true, isHuman: true, personCount: 1 } } } },
      rules
    );
    expect(evalD.pass).toBe(true);
    expect(evalD.fails.length).toBe(0);
  });

  it('permits and auto-approves upload when AI Vision returns isValid: true (1 person) without false rejection', async () => {
    const fakePortrait = Buffer.from('portrait 1 person binary');
    const uploadRes = await request(app)
      .patch('/api/auth/me/avatar')
      .set(authHeader(student.token))
      .attach('file', fakePortrait, { filename: 'my_avatar.jpg', contentType: 'image/jpeg' });

    expect(uploadRes.status).toBe(200);
    expect(uploadRes.body.approved).toBe(true);
    expect(uploadRes.body.isValid).toBe(true);
    expect(uploadRes.body.pending).toBe(false);
    expect(uploadRes.body.autoApproved).toBe(true);
    expect(uploadRes.body.message).toContain('EduMin AI đã tự động phê duyệt');

    // User record is immediately updated with the avatar
    const updatedUser = await User.findById(student.user._id);
    expect(updatedUser.avatar?.url).toBeTruthy();
  });

  it('Admin Chatbox: "Admin yêu cầu avatar phải là hình người và chỉ 1 người, hãy duyệt giùm tôi" sets criteria and auto-approves qualifying pending requests immediately', async () => {
    // 1. Setup pending requests: 1 valid student portrait and 1 invalid non-human cat avatar
    const validReq = await ProfileRequest.create({
      userId: student.user._id,
      targetModel: 'Student',
      targetId: student.student._id,
      requesterRole: 'sinh-vien',
      requesterName: 'Nguyễn Văn An',
      requesterEmail: 'an.nguyen@edu.vn',
      type: 'avatar',
      status: 'pending',
      requestedData: {
        avatar: {
          url: 'https://cloudinary.com/user_portrait_1person.jpg',
          originalName: 'user_portrait_1person.jpg',
          analysis: { isValid: true, isHuman: true, personCount: 1, reason: '' },
        },
      },
    });

    const student2 = await makeStudent(102, 'Trần Đình');
    const invalidReq = await ProfileRequest.create({
      userId: student2.user._id,
      targetModel: 'Student',
      targetId: student2.student._id,
      requesterRole: 'sinh-vien',
      requesterName: 'Trần Đình',
      requesterEmail: 'dinh.tran@edu.vn',
      type: 'avatar',
      status: 'pending',
      requestedData: {
        avatar: {
          url: 'https://cloudinary.com/cat_kitten.jpg',
          originalName: 'cat_kitten.jpg',
          analysis: { isValid: false, isHuman: false, personCount: 0, reason: 'Ảnh không hợp lệ: Yêu cầu bắt buộc phải có đúng 1 người trong khung hình! (Avatar không phải hình người (phát hiện con mèo (động vật)))' },
        },
      },
    });

    // 2. Admin issues criteria and approval instruction in chatbox
    const chatRes = await request(app)
      .post('/api/ai/query')
      .set(authHeader(admin.token))
      .send({ message: 'Admin yêu cầu: Avatar phải là hình người và chỉ 1 người, hãy duyệt giùm tôi' });

    expect(chatRes.status).toBe(200);
    expect(chatRes.body.intent).toBe('ADMIN_SET_CRITERIA');
    expect(chatRes.body.reply).toContain('ĐÃ TỰ ĐỘNG DUYỆT NGAY');
    expect(chatRes.body.reply).toContain('Nguyễn Văn An');
    expect(chatRes.body.reply).toContain('Trần Đình');
    expect(chatRes.body.actionTrigger).toBeDefined();
    expect(chatRes.body.actionTrigger.action).toBe('criteria_approval_processed');
    expect(chatRes.body.actionTrigger.autoApprovedCount).toBeGreaterThanOrEqual(1);

    // 3. Verify database state: valid request is approved, invalid request remains pending
    const checkValid = await ProfileRequest.findById(validReq._id);
    expect(checkValid.status).toBe('approved');

    const checkInvalid = await ProfileRequest.findById(invalidReq._id);
    expect(checkInvalid.status).toBe('pending');
  });

  it('Admin Chatbox: strictly refuses to approve requests with non-human avatars (scenery, objects, animals) and keeps them in pending', async () => {
    // 1. Student uploads a scenery/car/non-human image
    const nonHumanReq = await ProfileRequest.create({
      userId: student.user._id,
      targetModel: 'Student',
      targetId: student.student._id,
      requesterRole: 'sinh-vien',
      requesterName: 'Lê Thị Thu Thảo',
      requesterEmail: 'thao@student.edu.vn',
      type: 'avatar',
      status: 'pending',
      requestedData: {
        avatar: {
          url: 'https://cloudinary.com/scenery_nature_beach.jpg',
          originalName: 'scenery_nature_beach.jpg',
        },
      },
    });

    // 2. Admin enters in chatbox: "Phê duyệt" or "Duyệt ảnh đại diện nhanh"
    const chatRes = await request(app)
      .post('/api/ai/query')
      .set(authHeader(admin.token))
      .send({ message: 'Duyệt ảnh đại diện nhanh' });

    expect(chatRes.status).toBe(200);
    // Must NOT be approved!
    expect(chatRes.body.reply).toContain('HỒ SƠ KHÔNG ĐẠT TIÊU CHUẨN');
    expect(chatRes.body.reply).toContain('Avatar không phải hình người');

    const reloaded = await ProfileRequest.findById(nonHumanReq._id);
    expect(reloaded.status).toBe('pending');
  });

  it('Admin Chatbox: handles query "duyệt hình không có người" by activating guard and keeping all non-human avatars pending', async () => {
    const chatRes = await request(app)
      .post('/api/ai/query')
      .set(authHeader(admin.token))
      .send({ message: 'Khắc phục duyệt hình không có người' });

    expect(chatRes.status).toBe(200);
    expect(chatRes.body.intent).toBe('ADMIN_NON_HUMAN_AVATAR_GUARD');
    expect(chatRes.body.reply).toContain('Tuyệt đối KHÔNG tự động duyệt hình không có người');
    expect(chatRes.body.reply).toContain('Bắt buộc giữ lại Chờ duyệt');
  });

  describe('Deterministic Rule Engine & Controller Sync (Strict Zero-Tolerance Moderation)', () => {
    it('Deterministic Rule: approved: true strictly only when count === 1 and isHuman === true without text/scenery/objects', () => {
      // 1. Pass: count === 1, isHuman: true
      const pass = evaluateAvatarDeterministicRule({ count: 1, isHuman: true });
      expect(pass.status).toBe('approved');
      expect(pass.approved).toBe(true);
      expect(pass.isValid).toBe(true);
      expect(pass.count).toBe(1);
      expect(pass.message).toContain('Ảnh hợp lệ: Đã xác thực chính xác 1 người trong khung hình.');

      // 2. Reject: count === 0
      const zero = evaluateAvatarDeterministicRule({ count: 0, isHuman: false });
      expect(zero.status).toBe('rejected');
      expect(zero.approved).toBe(false);
      expect(zero.isValid).toBe(false);
      expect(zero.count).toBe(0);
      expect(zero.message).toContain('Ảnh không hợp lệ: Yêu cầu bắt buộc phải có đúng 1 người trong khung hình!');

      // 3. Reject: count > 1
      const multi = evaluateAvatarDeterministicRule({ count: 3, isHuman: true });
      expect(multi.status).toBe('rejected');
      expect(multi.approved).toBe(false);
      expect(multi.count).toBe(3);
      expect(multi.message).toContain('tiêu chuẩn chỉ cho phép đúng 1 người');

      // 4. Reject: text/screenshot
      const textOnly = evaluateAvatarDeterministicRule({ count: 1, isHuman: true, hasTextOnly: true });
      expect(textOnly.status).toBe('rejected');
      expect(textOnly.approved).toBe(false);
      expect(textOnly.message).toContain('tài liệu, văn bản hoặc ảnh chụp màn hình');

      // 5. Reject: scenery
      const scenery = evaluateAvatarDeterministicRule({ count: 0, isHuman: false, isScenery: true });
      expect(scenery.status).toBe('rejected');
      expect(scenery.approved).toBe(false);
      expect(scenery.message).toContain('phong cảnh thiên nhiên');

      // 6. Reject: object / animal / anime
      const object = evaluateAvatarDeterministicRule({ count: 0, isHuman: false, isObject: true, subject: 'con mèo (động vật)' });
      expect(object.status).toBe('rejected');
      expect(object.approved).toBe(false);
      expect(object.message).toContain('Avatar không phải hình người');
    });

    it('Backend Controller returns exact standardized JSON structure { success, approved, status, message }', async () => {
      const fakeCat = Buffer.from('cat binary');
      const res = await request(app)
        .patch('/api/auth/me/avatar')
        .set(authHeader(student.token))
        .attach('file', fakeCat, { filename: 'cat_meow.jpg', contentType: 'image/jpeg' });

      expect(res.status).toBe(200);
      expect(typeof res.body.success).toBe('boolean');
      expect(typeof res.body.approved).toBe('boolean');
      expect(typeof res.body.message).toBe('string');
      expect(res.body.success).toBe(false);
      expect(res.body.approved).toBe(false);
      expect(res.body.status).toBe('rejected');
      expect(res.body.message).toContain('Ảnh không hợp lệ: Yêu cầu bắt buộc phải có đúng 1 người trong khung hình!');
    });
  });
});

