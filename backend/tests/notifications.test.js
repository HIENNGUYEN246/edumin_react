import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { seed } from '../src/scripts/seed.js';
import { User } from '../src/modules/auth/user.model.js';
import { Student } from '../src/modules/students/student.model.js';
import { CourseClass } from '../src/modules/classes/courseClass.model.js';
import { Enrollment } from '../src/modules/enrollments/enrollment.model.js';
import { Notification } from '../src/modules/notifications/notification.model.js';
import { signToken } from '../src/lib/jwt.js';

describe('Notifications & Targeted Schedule Workflow API', () => {
  let app;
  let adminToken;
  let teacherToken;
  let student1Token;
  let student2Token;
  let student1User;
  let student2User;
  let teacherUser;
  let adminUser;
  let testClass;

  beforeEach(async () => {
    app = createApp();
    await seed({ withSamples: true });

    adminUser = await User.findOne({ role: 'dao-tao' });
    teacherUser = await User.findOne({ role: 'giao-vien' });
    const students = await Student.find({}).limit(2);
    student1User = await User.findById(students[0].userId);
    student2User = await User.findById(students[1].userId);

    adminToken = signToken(adminUser);
    teacherToken = signToken(teacherUser);
    student1Token = signToken(student1User);
    student2Token = signToken(student2User);

    testClass = await CourseClass.findOne({});
    // Ensure student1 is enrolled in testClass and student2 is not
    await Enrollment.deleteMany({ student: students[0]._id, classRef: testClass._id });
    await Enrollment.deleteMany({ student: students[1]._id, classRef: testClass._id });

    await Enrollment.create({
      student: students[0]._id,
      classRef: testClass._id,
      classId: testClass.id,
    });
  });

  it('allows teacher or admin to broadcast a targeted schedule change notification to a specific class', async () => {
    const payload = {
      targetType: 'class',
      targetClassId: testClass.id,
      title: `[${testClass.id}] Thông báo dời phòng học`,
      message: 'Lớp chuyển sang phòng B2-405 do phòng cũ bảo trì máy lạnh.',
      metadata: {
        changeType: 'room_change',
        classCode: testClass.id,
        className: testClass.className,
        date: '2026-10-25',
        oldRoom: testClass.room || 'A101',
        newRoom: 'B2-405',
        oldShift: 'Sáng (Tiết 1 - 3)',
        newShift: 'Sáng (Tiết 1 - 3)',
        reason: 'Bảo trì máy lạnh',
      },
    };

    const res = await request(app)
      .post('/api/notifications/schedule-change')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.targetClassId).toBe(testClass.id);
    expect(res.body.recipientCount).toBeGreaterThanOrEqual(1);

    // Enrolled student (student1) should see this notification
    const student1List = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${student1Token}`);

    expect(student1List.status).toBe(200);
    const received = student1List.body.items.find(
      (n) => n.targetClassId === testClass.id && n.type === 'schedule_change'
    );
    expect(received).toBeTruthy();
    expect(received.metadata.newRoom).toBe('B2-405');
    expect(received.isRead).toBe(false);

    // Non-enrolled student (student2) should NOT receive this class-scoped notification
    const student2List = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${student2Token}`);

    expect(student2List.status).toBe(200);
    const nonReceived = student2List.body.items.find(
      (n) => n.targetClassId === testClass.id && n.type === 'schedule_change'
    );
    expect(nonReceived).toBeUndefined();
  });

  it('allows targeted notifications to individual users', async () => {
    const payload = {
      targetType: 'individual',
      targetIds: [String(student2User._id)],
      title: 'Nhắc nhở nộp bài tập cá nhân',
      message: 'Bạn chưa nộp bài tập số 2, vui lòng nộp trước 23:59 hôm nay.',
      type: 'assignment',
    };

    const res = await request(app)
      .post('/api/notifications/targeted')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.recipientCount).toBe(1);

    // Student 2 receives it
    const s2Res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${student2Token}`);
    const found = s2Res.body.items.find((n) => n.title === 'Nhắc nhở nộp bài tập cá nhân');
    expect(found).toBeTruthy();

    // Student 1 does not receive it
    const s1Res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${student1Token}`);
    const notFound = s1Res.body.items.find((n) => n.title === 'Nhắc nhở nộp bài tập cá nhân');
    expect(notFound).toBeUndefined();
  });

  it('marks a notification as read and supports markAllRead', async () => {
    // Create a notification for student1
    const notif = await Notification.create({
      recipientUser: student1User._id,
      recipientRole: 'sinh-vien',
      type: 'schedule_change',
      title: 'Đổi tiết học ngày mai',
      message: 'Tiết 1-3 đổi sang tiết 4-6',
      isRead: false,
    });

    // Mark as read
    const patchRes = await request(app)
      .patch(`/api/notifications/${notif._id}/read`)
      .set('Authorization', `Bearer ${student1Token}`);

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.isRead).toBe(true);

    // Check count
    const listRes = await request(app)
      .get('/api/notifications?unreadOnly=true')
      .set('Authorization', `Bearer ${student1Token}`);
    expect(listRes.body.items.find((n) => n._id === String(notif._id))).toBeUndefined();
  });

  it('filters notifications by classId query parameter', async () => {
    await Notification.create({
      recipientUser: student1User._id,
      recipientRole: 'sinh-vien',
      type: 'schedule_change',
      targetClassId: 'CNTT999-01',
      title: 'Thông báo lớp CNTT999',
      message: 'Học bù phòng C101',
    });

    const filtered = await request(app)
      .get('/api/notifications?classId=CNTT999-01')
      .set('Authorization', `Bearer ${student1Token}`);

    expect(filtered.status).toBe(200);
    expect(filtered.body.items.length).toBeGreaterThan(0);
    expect(filtered.body.items.every((n) => n.targetClassId === 'CNTT999-01')).toBe(true);
  });
});
