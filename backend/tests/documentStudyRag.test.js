import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { app } from './helpers/testApp.js';
import { createUser, authHeader } from './helpers/factories.js';
import { ROLES } from '../src/lib/roles.js';
import { hashPassword } from '../src/lib/password.js';
import { signToken } from '../src/lib/jwt.js';
import { User } from '../src/modules/auth/user.model.js';
import { Teacher } from '../src/modules/teachers/teacher.model.js';
import { Student } from '../src/modules/students/student.model.js';
import { Course } from '../src/modules/courses/course.model.js';
import { CourseClass } from '../src/modules/classes/courseClass.model.js';
import { Enrollment } from '../src/modules/enrollments/enrollment.model.js';
import { Document } from '../src/modules/documents/document.model.js';
import { extractTextFromFile } from '../src/modules/documents/textExtractor.js';
import {
  summarizeDocument,
  generateQuizFromDocument,
  findRelevantDocument,
} from '../src/modules/documents/documentRag.service.js';

vi.mock('../src/lib/files.service.js', () => ({
  uploadBuffer: vi.fn(async () => ({
    publicId: 'edumin/documents/test_doc',
    url: 'https://cdn.test/doc.pdf',
    resourceType: 'raw',
    bytes: 1024,
    format: 'pdf',
    access: 'authenticated',
  })),
  destroy: vi.fn(async () => {}),
  signedUrl: vi.fn(() => 'https://cdn.test/signed_doc'),
}));

async function createTeacherUser(idNum, email = `gv${idNum}@edu.vn`) {
  const user = await User.create({
    email,
    passwordHash: await hashPassword('x'),
    role: ROLES.TEACHER,
    hoTen: `Giảng viên ${idNum}`,
  });
  const teacher = await Teacher.create({
    userId: user._id,
    id: idNum,
    email,
    hoTen: `Giảng viên ${idNum}`,
  });
  user.teacher = teacher._id;
  await user.save();
  return { token: signToken(user), user, teacher };
}

async function createStudentUser(idNum, email = `sv${idNum}@edu.vn`) {
  const user = await User.create({
    email,
    passwordHash: await hashPassword('x'),
    role: ROLES.STUDENT,
    hoTen: `Sinh viên ${idNum}`,
  });
  const student = await Student.create({
    userId: user._id,
    id: idNum,
    email,
    hoTen: `Sinh viên ${idNum}`,
  });
  user.student = student._id;
  await user.save();
  return { token: signToken(user), user, student };
}

describe('Document Text Extraction & AI Study RAG', () => {
  let course;
  let teacherUser;
  let studentUser;
  let courseClass;

  beforeEach(async () => {
    await createUser({ role: ROLES.ADMIN });
    course = await Course.create({ id: 'CNTT101', name: 'Lập trình Web' });
    teacherUser = await createTeacherUser(10);
    studentUser = await createStudentUser(20);

    courseClass = await CourseClass.create({
      id: 'CNTT101-01',
      className: 'Lập trình Web - Nhóm 1',
      courseRef: course._id,
      courseId: 'CNTT101',
      teacherRef: teacherUser.teacher._id,
      teacherId: teacherUser.teacher.id,
      schedules: [{ dayId: 'T2', shiftId: 'S1', room: 'A1-201' }],
    });

    // Enroll student in CNTT101-01
    await Enrollment.create({
      student: studentUser.student._id,
      classRef: courseClass._id,
      classId: courseClass.id,
    });
  });

  it('extracts text, chapters, and key concepts from text buffer', async () => {
    const rawBuffer = Buffer.from(
      'Chương 1: Khái niệm Virtual DOM và React Hooks\nNội dung bài học về cơ chế render và quản lý state.'
    );
    const result = await extractTextFromFile({
      buffer: rawBuffer,
      mimetype: 'text/plain',
      originalname: 'bai_giang_chuong_1.txt',
      courseName: 'Lập trình Web',
      courseId: 'CNTT101',
    });

    expect(result.extractedText).toContain('Virtual DOM');
    expect(result.summary).toBeTruthy();
    expect(result.chapters.length).toBeGreaterThan(0);
    expect(result.keyConcepts.length).toBeGreaterThan(0);
  });

  it('summarizes an academic document and generates 5 quiz questions with rationales', async () => {
    const doc = await Document.create({
      courseRef: course._id,
      courseId: 'CNTT101',
      classRef: courseClass._id,
      classId: 'CNTT101-01',
      name: 'Bài giảng React & Web nâng cao - Chương 1',
      status: 'Công khai',
      extractedText: 'Chương 1: Giới thiệu Virtual DOM, useState và CSS Flexbox',
    });

    const summary = await summarizeDocument({ document: doc, chapter: 'Chương 1' });
    expect(summary.documentName).toBe('Bài giảng React & Web nâng cao - Chương 1');
    expect(summary.summaryMarkdown).toContain('Khái niệm Cốt lõi');
    expect(summary.coreConcepts.length).toBeGreaterThan(0);

    const quiz = await generateQuizFromDocument({ document: doc, count: 5 });
    expect(quiz.totalQuestions).toBe(5);
    expect(quiz.questions[0].options).toHaveLength(4);
    expect(typeof quiz.questions[0].correctIndex).toBe('number');
    expect(quiz.questions[0].explanation).toContain('Rationale');
  });

  it('allows enrolled student to summarize document and generate quiz via API endpoints', async () => {
    const doc = await Document.create({
      courseRef: course._id,
      courseId: 'CNTT101',
      classRef: courseClass._id,
      classId: 'CNTT101-01',
      name: 'Tài liệu ôn tập Chương 1',
      status: 'Công khai',
    });

    // 1. Summarize endpoint
    const sumRes = await request(app)
      .post(`/api/documents/${doc._id}/summarize`)
      .set(authHeader(studentUser.token))
      .send({ chapter: 'Chương 1' });

    expect(sumRes.status).toBe(200);
    expect(sumRes.body.success).toBe(true);
    expect(sumRes.body.summaryMarkdown).toBeTruthy();

    // 2. Generate Quiz endpoint
    const quizRes = await request(app)
      .post(`/api/documents/${doc._id}/generate-quiz`)
      .set(authHeader(studentUser.token))
      .send({ count: 5 });

    expect(quizRes.status).toBe(200);
    expect(quizRes.body.success).toBe(true);
    expect(quizRes.body.questions).toHaveLength(5);
    expect(quizRes.body.questions[0].options).toHaveLength(4);
  });

  it('forbids a non-enrolled student from summarizing a restricted course document', async () => {
    const otherStudent = await createStudentUser(99);
    const doc = await Document.create({
      courseRef: course._id,
      courseId: 'CNTT101',
      classRef: courseClass._id,
      classId: 'CNTT101-01',
      name: 'Đề thi nội bộ Lập trình Web',
      status: 'Công khai',
    });

    const res = await request(app)
      .post(`/api/documents/${doc._id}/summarize`)
      .set(authHeader(otherStudent.token))
      .send({});

    expect(res.status).toBe(403);
  });

  it('AI Chatbot handles user request: "Tóm tắt giúp tôi các ý chính của tài liệu chương 1 môn Lập trình Web"', async () => {
    await Document.create({
      courseRef: course._id,
      courseId: 'CNTT101',
      classRef: courseClass._id,
      classId: 'CNTT101-01',
      name: 'Giáo trình Chương 1 Lập trình Web',
      status: 'Công khai',
    });

    const res = await request(app)
      .post('/api/ai/query')
      .set(authHeader(studentUser.token))
      .send({
        message: 'Tóm tắt giúp tôi các ý chính của tài liệu chương 1 môn Lập trình Web',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.intent).toBe('DOC_SUMMARIZE');
    expect(res.body.summaryData).toBeDefined();
    expect(res.body.cards[0].type).toBe('document_summary');
  });

  it('AI Chatbot handles user request: "Tạo cho tôi 5 câu quiz trắc nghiệm ôn tập dựa trên file tài liệu buổi học hôm nay"', async () => {
    await Document.create({
      courseRef: course._id,
      courseId: 'CNTT101',
      classRef: courseClass._id,
      classId: 'CNTT101-01',
      name: 'Tài liệu bài giảng buổi học hôm nay',
      status: 'Công khai',
    });

    // 1. Teacher generates quiz for class through AI chatbot
    const res = await request(app)
      .post('/api/ai/query')
      .set(authHeader(teacherUser.token))
      .send({
        message: 'Tạo cho tôi 5 câu quiz trắc nghiệm ôn tập dựa trên file tài liệu buổi học hôm nay',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.intent).toBe('DOC_QUIZ_GENERATE');
    expect(res.body.quizData).toBeDefined();
    expect(res.body.quizData.questions).toHaveLength(5);
    expect(res.body.cards[0].type).toBe('interactive_quiz');
    expect(res.body.cards[0].questions[0].explanation).toContain('Rationale');

    // 2. Student is politely guided to /student/assignments because quiz creation is reserved for Teachers
    const studentRes = await request(app)
      .post('/api/ai/query')
      .set(authHeader(studentUser.token))
      .send({
        message: 'Tạo cho tôi 5 câu quiz trắc nghiệm ôn tập dựa trên file tài liệu buổi học hôm nay',
      });

    expect(studentRes.status).toBe(200);
    expect(studentRes.body.intent).toBe('DOC_QUIZ_GENERATE');
    expect(studentRes.body.reply).toContain('Thông báo phân quyền');
    expect(studentRes.body.quickLinks[0].path).toBe('/student/assignments');
  });

  it('Teacher on /teacher/documents generates quiz without being falsely intercepted by CURRENT_PAGE_ALREADY', async () => {
    const res = await request(app)
      .post('/api/ai/query')
      .set(authHeader(teacherUser.token))
      .send({
        message: 'Gợi ý và tạo bộ 5 câu hỏi quiz trắc nghiệm kèm đáp án và giải thích từ tài liệu Chương 1 môn Lập trình Web để làm tư liệu kiểm tra/bài tập cho lớp',
        currentPath: '/teacher/documents',
        pageContext: {
          courseName: 'Lập trình Web',
          courseId: 'CNTT101',
          classId: 'CNTT101-01',
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.intent).toBe('DOC_QUIZ_GENERATE');
    expect(res.body.intent).not.toBe('CURRENT_PAGE_ALREADY');
    expect(res.body.reply).not.toContain('hiện tại bạn đang ở ngay trang');
    expect(res.body.cards[0].type).toBe('interactive_quiz');
    expect(res.body.cards[0].questions).toHaveLength(5);
  });
});

