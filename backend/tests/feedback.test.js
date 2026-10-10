import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { seed } from '../src/scripts/seed.js';
import { User } from '../src/modules/auth/user.model.js';
import { signToken } from '../src/lib/jwt.js';

describe('Feedback API', () => {
  let app;

  beforeEach(async () => {
    app = createApp();
    await seed({ withSamples: true });
  });

  it('submits a new feedback and lists it', async () => {
    const postRes = await request(app)
      .post('/api/feedbacks')
      .send({
        studentId: 1,
        studentName: 'Nguyễn Văn An',
        courseId: 'IT101',
        courseName: 'Nhập môn lập trình',
        feedbackText: 'Thầy giảng rất dễ hiểu',
        rating: 5,
        courseQuality: 'Tốt',
      });

    expect(postRes.status).toBe(201);
    expect(postRes.body.success).toBe(true);

    const getRes = await request(app).get('/api/feedbacks?courseId=IT101');
    expect(getRes.status).toBe(200);
    expect(Array.isArray(getRes.body)).toBe(true);
    expect(getRes.body.length).toBeGreaterThan(0);
    expect(getRes.body[0].feedbackText).toBe('Thầy giảng rất dễ hiểu');
  });

  it('allows teacher or admin to reply to feedback', async () => {
    const postRes = await request(app)
      .post('/api/feedbacks')
      .send({
        studentId: 1,
        studentName: 'Nguyễn Văn An',
        courseId: 'IT101',
        feedbackText: 'Cần thêm bài tập thực hành',
        rating: 4,
      });

    const fbId = postRes.body.feedback._id;
    const replyRes = await request(app)
      .post(`/api/feedbacks/${fbId}/reply`)
      .send({ response: 'Thầy sẽ bổ sung thêm các bài tập nhé' });

    expect(replyRes.status).toBe(200);
    expect(replyRes.body.feedback.response).toBe('Thầy sẽ bổ sung thêm các bài tập nhé');
  });

  it('enforces role authorization on replies: blocks students and allows assigned teacher', async () => {
    const teacherUser = await User.findOne({ email: 'quan.tran@edu.vn' });
    const otherTeacherUser = await User.findOne({ email: 'ha.le@edu.vn' });
    const studentUser = await User.findOne({ email: 'an.nguyen@edu.vn' });

    const teacherToken = signToken(teacherUser);
    const otherTeacherToken = signToken(otherTeacherUser);
    const studentToken = signToken(studentUser);

    const postRes = await request(app)
      .post('/api/feedbacks')
      .send({
        studentId: 1,
        teacherId: teacherUser.teacherId,
        courseId: 'IT101',
        courseName: 'Nhập môn lập trình',
        feedbackText: 'Thầy dạy rất nhiệt tình',
      });

    const fbId = postRes.body.feedback._id;

    // Student attempts to reply -> 403 Forbidden
    const studentReply = await request(app)
      .post(`/api/feedbacks/${fbId}/reply`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ response: 'Em tự trả lời' });
    expect(studentReply.status).toBe(403);

    // Other unassigned teacher attempts to reply -> 403 Forbidden
    const otherTeacherReply = await request(app)
      .post(`/api/feedbacks/${fbId}/reply`)
      .set('Authorization', `Bearer ${otherTeacherToken}`)
      .send({ response: 'Tôi trả lời hộ' });
    expect(otherTeacherReply.status).toBe(403);

    // Assigned teacher replies -> 200 OK with teacher metadata
    const assignedReply = await request(app)
      .post(`/api/feedbacks/${fbId}/reply`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ response: 'Cảm ơn em nhiều nhé!' });
    expect(assignedReply.status).toBe(200);
    expect(assignedReply.body.feedback.response).toBe('Cảm ơn em nhiều nhé!');
    expect(assignedReply.body.feedback.respondedByName).toBe(teacherUser.hoTen);
  });
});

