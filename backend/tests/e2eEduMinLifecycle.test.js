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
import { Assignment, Submission } from '../src/modules/assignments/assignment.model.js';

vi.mock('../src/lib/files.service.js', () => ({
  uploadBuffer: vi.fn(async () => ({
    publicId: 'edumin/documents/lifecycle_doc',
    url: 'https://cdn.edumin.test/lifecycle_doc.pdf',
    resourceType: 'raw',
    bytes: 2048,
    format: 'pdf',
    access: 'authenticated',
  })),
  destroy: vi.fn(async () => {}),
  signedUrl: vi.fn(() => 'https://cdn.edumin.test/signed_lifecycle_doc'),
}));

async function createTeacher(idNum, email = `gv${idNum}@edu.vn`, name = `GV Nguyễn Văn ${idNum}`) {
  const user = await User.create({
    email,
    passwordHash: await hashPassword('password123'),
    role: ROLES.TEACHER,
    hoTen: name,
  });
  const teacher = await Teacher.create({
    userId: user._id,
    id: idNum,
    email,
    hoTen: name,
  });
  user.teacher = teacher._id;
  await user.save();
  return { token: signToken(user), user, teacher };
}

async function createStudent(idNum, email = `sv${idNum}@edu.vn`, name = `SV Lê Thị ${idNum}`) {
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

describe('End-to-End EduMin Lifecycle: Teacher Upload -> AI Quiz -> Class Assignment -> Student Take & AI Summary', () => {
  let course;
  let courseClass;
  let teacher;
  let enrolledStudent;
  let nonEnrolledStudent;

  beforeEach(async () => {
    await createUser({ role: ROLES.ADMIN });
    course = await Course.create({ id: 'CNTT202', name: 'Lập trình Nâng Cao & RAG' });
    teacher = await createTeacher(1, 'gv.nguyenvan@edu.vn', 'ThS. Nguyễn Văn Thầy');
    enrolledStudent = await createStudent(101, 'sv.lethihocsinh@edu.vn', 'Lê Thị Học Sinh');
    nonEnrolledStudent = await createStudent(102, 'sv.nguyenkhaclop@edu.vn', 'Nguyễn Khác Lớp');

    courseClass = await CourseClass.create({
      id: 'CNTT202-01',
      className: 'Lập trình Nâng Cao - Nhóm 1',
      courseRef: course._id,
      courseId: 'CNTT202',
      teacherRef: teacher.teacher._id,
      teacherId: teacher.teacher.id,
      schedules: [{ dayId: 'T3', shiftId: 'S2', room: 'B1-302' }],
    });

    await Enrollment.create({
      student: enrolledStudent.student._id,
      classRef: courseClass._id,
      classId: courseClass.id,
    });
  });

  it('Flow 1: Teacher uploads document without mongoose crash and persists file + link', async () => {
    const rawContent = Buffer.from(
      'Chương 1: Kiến trúc Client-Server & RAG AI\n1. Khái niệm cốt lõi: Vector Database, Prompt Engineering, và Embeddings.\n2. Công thức tính Cosine Similarity: cos(theta) = (A . B) / (||A|| * ||B||).\n3. Lưu ý then chốt: Luôn kiểm tra phân quyền truy cập trước khi nhúng dữ liệu vào prompt.'
    );

    const res = await request(app)
      .post('/api/documents')
      .set(authHeader(teacher.token))
      .field('courseId', 'CNTT202')
      .field('classId', 'CNTT202-01')
      .field('name', 'Giáo trình Kiến trúc RAG và Vector Search')
      .field('link', 'https://edumin.edu.vn/resources/rag-architecture')
      .field('status', 'Công khai')
      .attach('file', rawContent, { filename: 'giao_trinh_rag.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Giáo trình Kiến trúc RAG và Vector Search');
    expect(res.body.link).toBe('https://edumin.edu.vn/resources/rag-architecture');
    expect(res.body.courseId).toBe('CNTT202');
    expect(res.body.classId).toBe('CNTT202-01');
    expect(res.body.hasFile).toBe(true);

    // Verify database persistence
    const savedDoc = await Document.findById(res.body._id);
    expect(savedDoc).toBeTruthy();
    expect(savedDoc.name).toBe('Giáo trình Kiến trúc RAG và Vector Search');
    expect(savedDoc.link).toBe('https://edumin.edu.vn/resources/rag-architecture');
    expect(savedDoc.file.publicId).toBe('edumin/documents/lifecycle_doc');
  });

  it('Flow 2 & 3: Teacher generates AI quiz from document and publishes directly as class Assignment', async () => {
    // 1. Prepare Document in DB
    const doc = await Document.create({
      courseRef: course._id,
      courseId: 'CNTT202',
      classRef: courseClass._id,
      classId: 'CNTT202-01',
      name: 'Giáo trình Kiến trúc RAG và Vector Search',
      status: 'Công khai',
      extractedText:
        'Chương 1: Kiến trúc Client-Server & RAG AI\n1. Khái niệm cốt lõi: Vector Database, Prompt Engineering, và Embeddings.\n2. Công thức tính Cosine Similarity: cos(theta) = (A . B) / (||A|| * ||B||).\n3. Lưu ý then chốt: Luôn kiểm tra phân quyền truy cập trước khi nhúng dữ liệu vào prompt.',
    });

    // 2. Teacher requests AI quiz via chatbot
    const aiRes = await request(app)
      .post('/api/ai/query')
      .set(authHeader(teacher.token))
      .send({
        message: 'Tạo cho tôi 5 câu hỏi quiz trắc nghiệm từ tài liệu Giáo trình Kiến trúc RAG',
        currentPath: '/teacher/documents',
        pageContext: {
          documentId: String(doc._id),
          documentName: doc.name,
          courseId: 'CNTT202',
          classId: 'CNTT202-01',
        },
      });

    expect(aiRes.status).toBe(200);
    expect(aiRes.body.success).toBe(true);
    expect(aiRes.body.intent).toBe('DOC_QUIZ_GENERATE');
    expect(aiRes.body.quizData).toBeDefined();
    expect(aiRes.body.quizData.questions).toHaveLength(5);

    const generatedQuestions = aiRes.body.quizData.questions;
    // Verify question structure
    generatedQuestions.forEach((q) => {
      expect(q.text || q.question).toBeTruthy();
      expect(q.options).toHaveLength(4);
      expect(typeof q.correctIndex).toBe('number');
      expect(q.explanation).toBeTruthy();
    });

    // 3. Teacher publishes the quiz as a class Assignment
    const publishRes = await request(app)
      .post('/api/assignments')
      .set(authHeader(teacher.token))
      .send({
        courseId: 'CNTT202',
        classId: 'CNTT202-01',
        type: 'quiz',
        title: 'Quiz 1: Kiến trúc RAG và Vector Search',
        description: 'Bộ câu hỏi trắc nghiệm ôn tập do AI biên soạn từ giáo trình.',
        dueDate: '2026-12-31',
        status: 'Công khai',
        questions: generatedQuestions.map((q, idx) => ({
          id: `q_${idx + 1}`,
          text: q.question || q.text,
          options: q.options,
          correctIndex: q.correctIndex,
          explanation: q.explanation,
        })),
      });

    expect(publishRes.status).toBe(201);
    expect(publishRes.body._id).toBeDefined();
    expect(publishRes.body.title).toBe('Quiz 1: Kiến trúc RAG và Vector Search');
    expect(publishRes.body.questions).toHaveLength(5);

    // Verify stored in Assignment MongoDB collection
    const savedAssignment = await Assignment.findById(publishRes.body._id);
    expect(savedAssignment).toBeTruthy();
    expect(savedAssignment.classId).toBe('CNTT202-01');
    expect(savedAssignment.questions[0].correctIndex).toBe(generatedQuestions[0].correctIndex);
  });

  it('Flow 4, 5 & 6: Student views assignment without leaked answers, takes quiz, receives 0-10 grade, and requests AI study summary', async () => {
    // 1. Create document and published assignment
    const doc = await Document.create({
      courseRef: course._id,
      courseId: 'CNTT202',
      classRef: courseClass._id,
      classId: 'CNTT202-01',
      name: 'Giáo trình Kiến trúc RAG và Vector Search',
      status: 'Công khai',
      extractedText:
        'Chương 1: Kiến trúc Client-Server & RAG AI\n1. Khái niệm cốt lõi: Vector Database, Prompt Engineering, và Embeddings.\n2. Công thức tính Cosine Similarity: cos(theta) = (A . B) / (||A|| * ||B||).\n3. Lưu ý then chốt: Luôn kiểm tra phân quyền truy cập trước khi nhúng dữ liệu vào prompt.',
    });

    const questionsData = [
      { id: 'q_1', text: 'Vector Database dùng để làm gì?', options: ['Lưu trữ vector embeddings', 'Gửi email', 'Vẽ biểu đồ', 'Tạo tài khoản'], correctIndex: 0, explanation: 'Vector Database tối ưu hóa tìm kiếm tương đồng vector.' },
      { id: 'q_2', text: 'Công thức Cosine Similarity tính gì?', options: ['Góc giữa 2 vector', 'Độ lệch chuẩn', 'Tổng bình phương', 'Ma trận nghịch đảo'], correctIndex: 0, explanation: 'Cosine similarity đo độ tương đồng góc giữa hai vector embeddings.' },
      { id: 'q_3', text: 'Prompt Engineering là gì?', options: ['Kỹ thuật tối ưu hóa câu lệnh cho LLM', 'Sửa chữa phần cứng máy tính', 'Lập trình vi điều khiển', 'Cài đặt hệ điều hành'], correctIndex: 0, explanation: 'Prompt engineering là thiết kế câu lệnh chuẩn xác cho AI.' },
      { id: 'q_4', text: 'RAG viết tắt của từ gì?', options: ['Retrieval-Augmented Generation', 'Rapid Application Guide', 'Random Access Graph', 'Reactive Async Gateway'], correctIndex: 0, explanation: 'RAG là viết tắt của Retrieval-Augmented Generation.' },
      { id: 'q_5', text: 'Lưu ý then chốt về bảo mật trong RAG là gì?', options: ['Kiểm tra phân quyền truy cập dữ liệu', 'Tắt tường lửa', 'Công khai toàn bộ token', 'Xóa log hệ thống'], correctIndex: 0, explanation: 'Phải đảm bảo người dùng chỉ được RAG trên tài liệu họ được cấp quyền.' },
    ];

    const assignment = await Assignment.create({
      courseRef: course._id,
      courseId: 'CNTT202',
      classRef: courseClass._id,
      classId: 'CNTT202-01',
      type: 'quiz',
      title: 'Quiz 1: Kiến trúc RAG và Vector Search',
      description: 'Bộ câu hỏi trắc nghiệm ôn tập do AI biên soạn từ giáo trình.',
      dueDate: '2026-12-31',
      status: 'Công khai',
      questions: questionsData,
      createdBy: teacher.teacher.hoTen,
    });

    // 2. Enrolled Student fetches assignment list
    const studentListRes = await request(app)
      .get('/api/assignments?courseId=CNTT202')
      .set(authHeader(enrolledStudent.token));

    expect(studentListRes.status).toBe(200);
    expect(studentListRes.body.data).toHaveLength(1);
    const studentQuizItem = studentListRes.body.data[0];
    expect(studentQuizItem.title).toBe('Quiz 1: Kiến trúc RAG và Vector Search');
    // SECURITY CHECK: ensure correctIndex is stripped!
    expect(studentQuizItem.questions[0].correctIndex).toBeUndefined();
    expect(studentQuizItem.questions[0].options).toHaveLength(4);

    // 3. Non-enrolled student is blocked/cannot see
    const nonEnrolledList = await request(app)
      .get('/api/assignments?courseId=CNTT202')
      .set(authHeader(nonEnrolledStudent.token));
    expect(nonEnrolledList.status).toBe(200);
    expect(nonEnrolledList.body.data).toHaveLength(0);

    // 4. Student takes quiz and submits answers
    // Answers: 4 correct (q_1=0, q_2=0, q_3=0, q_4=0) and 1 incorrect (q_5=1 instead of 0)
    const submitRes = await request(app)
      .post(`/api/assignments/${assignment._id}/submissions`)
      .set(authHeader(enrolledStudent.token))
      .send({
        answers: {
          q_1: 0,
          q_2: 0,
          q_3: 0,
          q_4: 0,
          q_5: 1, // incorrect
        },
      });

    expect(submitRes.status).toBe(201);
    // 4/5 correct -> 8.0 / 10
    expect(submitRes.body.score).toBe(8);
    expect(submitRes.body.correctCount).toBe(4);
    expect(submitRes.body.total).toBe(5);
    expect(submitRes.body.answerKey).toHaveLength(5);
    expect(submitRes.body.answerKey[0].correctIndex).toBe(0);
    expect(submitRes.body.answerKey[0].explanation).toContain('Vector Database tối ưu hóa');

    // Verify submission is saved in database
    const savedSub = await Submission.findOne({ assignmentRef: assignment._id, student: enrolledStudent.student._id });
    expect(savedSub).toBeTruthy();
    expect(savedSub.score).toBe(8);

    // 5. Subsequent student list shows mySubmission score
    const updatedListRes = await request(app)
      .get('/api/assignments?courseId=CNTT202')
      .set(authHeader(enrolledStudent.token));
    expect(updatedListRes.body.data[0].mySubmission).toEqual({ score: 8 });

    // 6. Teacher can review student submissions
    const teacherSubmissionsRes = await request(app)
      .get(`/api/assignments/${assignment._id}/submissions`)
      .set(authHeader(teacher.token));
    expect(teacherSubmissionsRes.status).toBe(200);
    expect(teacherSubmissionsRes.body.data).toHaveLength(1);
    expect(teacherSubmissionsRes.body.data[0].studentName).toBe('Lê Thị Học Sinh');
    expect(teacherSubmissionsRes.body.data[0].score).toBe(8);

    // 7. Student requests AI Document Summarization
    const aiSummaryRes = await request(app)
      .post('/api/ai/query')
      .set(authHeader(enrolledStudent.token))
      .send({
        message: 'Tóm tắt giúp tôi các khái niệm cốt lõi, công thức và ý chính bài học của tài liệu Kiến trúc RAG',
        currentPath: '/student/documents',
        pageContext: {
          documentId: String(doc._id),
          documentName: doc.name,
          courseId: 'CNTT202',
          classId: 'CNTT202-01',
        },
      });

    expect(aiSummaryRes.status).toBe(200);
    expect(aiSummaryRes.body.success).toBe(true);
    expect(aiSummaryRes.body.intent).toBe('DOC_SUMMARIZE');
    expect(aiSummaryRes.body.cards[0].type).toBe('document_summary');
    expect(aiSummaryRes.body.summaryData).toBeDefined();

    const summaryMarkdown = aiSummaryRes.body.summaryData.summaryMarkdown;
    expect(summaryMarkdown).toBeTruthy();
    // Must contain structured Markdown sections
    expect(summaryMarkdown).toMatch(/Khái niệm/i);
    expect(summaryMarkdown).toMatch(/Lưu ý|Khái quát/i);
  });
});

