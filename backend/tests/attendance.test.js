import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { seed } from '../src/scripts/seed.js';

describe('Attendance API', () => {
  let app;

  beforeEach(async () => {
    app = createApp();
    await seed({ withSamples: true });
  });

  it('records attendance check-in for a student', async () => {
    const res = await request(app)
      .post('/api/attendance/check-in')
      .send({
        classId: 'IT101-01',
        courseId: 'IT101',
        courseName: 'Nhập môn lập trình',
        studentId: 1,
        studentName: 'Nguyễn Văn An',
        date: '2026-10-01',
        shiftId: '1',
        status: 'Có mặt',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.record.status).toBe('Có mặt');
  });

  it('records and evaluates a student by teacher', async () => {
    const res = await request(app)
      .post('/api/attendance/record')
      .send({
        classId: 'IT101-01',
        studentId: 1,
        date: '2026-10-01',
        shiftId: '1',
        status: 'Có mặt',
        score: 9.5,
        evaluation: 'Hăng hái phát biểu',
        teacherName: 'Trần Minh Quân',
      });

    expect(res.status).toBe(201);
    expect(res.body.record.score).toBe(9.5);
    expect(res.body.record.evaluation).toBe('Hăng hái phát biểu');
  });

  it('fetches student attendance history', async () => {
    await request(app)
      .post('/api/attendance/check-in')
      .send({
        classId: 'IT101-01',
        studentId: 1,
        date: '2026-10-01',
        shiftId: '1',
        status: 'Có mặt',
      });

    const res = await request(app).get('/api/attendance/student/1');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].studentId).toBe(1);
  });
});

