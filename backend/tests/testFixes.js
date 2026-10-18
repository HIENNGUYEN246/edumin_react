import mongoose from 'mongoose';
import express from 'express';
import dotenv from 'dotenv';
import authRoutes from '../routes/authRoutes.js';
import registerCollection from '../routes/collectionRoutes.js';
import {
  User,
  Teacher,
  Student,
  Department,
  Course,
  OpenRegistration,
  StudentRegistration,
  Assignment,
  Document,
} from '../models/index.js';

dotenv.config();

const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/edumin';

async function runTests() {
  console.log('--- STARTING VERIFICATION TESTS ---');
  await mongoose.connect(uri);
  console.log('1. Connected to MongoDB successfully.');

  const app = express();
  app.use(express.json({ limit: '50mb' }));
  app.use('/api/auth', authRoutes);

  const server = app.listen(4001, () => {
    console.log('2. Test server running on http://localhost:4001');
  });

  try {
    // Test 1: GET /api/auth
    console.log('\n--- Test 1: GET /api/auth ---');
    const getRes = await fetch('http://localhost:4001/api/auth');
    const authData = await getRes.json();
    console.log('Users count:', authData.users?.length);
    console.log('Departments count:', authData.departmentsData?.length);
    if (!authData.users?.length || !authData.departmentsData?.length) {
      throw new Error('Default seed failed!');
    }
    console.log('PASS: GET /api/auth initialized default data.');

    // Test 2: Add an assignment
    console.log('\n--- Test 2: Add an assignment via PUT /api/auth ---');
    const sampleAssignment = {
      id: 'QUIZ_TEST_1',
      courseId: 'CNTT101',
      type: 'quiz',
      name: 'Bài tập trắc nghiệm số 1',
      title: 'Bài tập trắc nghiệm số 1',
      dueDate: '2026-10-15',
      questions: [
        {
          id: 'q1',
          text: 'HTML là gì?',
          options: ['HyperText Markup Language', 'High Text ML', 'None', 'All'],
          correctIndex: 0,
        },
      ],
      submissions: [],
    };

    const putRes1 = await fetch('http://localhost:4001/api/auth', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assignmentsData: [sampleAssignment],
      }),
    });
    if (!putRes1.ok) {
      const err = await putRes1.text();
      throw new Error('PUT assignments failed: ' + err);
    }
    const authDataAfterQuiz = await putRes1.json();
    console.log('Assignments count after PUT:', authDataAfterQuiz.assignmentsData?.length);
    if (authDataAfterQuiz.assignmentsData?.length !== 1) {
      throw new Error('Assignment was not saved!');
    }
    console.log('PASS: Assignment saved successfully.');

    // Test 3: Import courses without wiping assignments!
    console.log('\n--- Test 3: Import courses and verify assignments are NOT wiped ---');
    const sampleCourses = [
      {
        id: 'CNTT101',
        name: 'Lập trình Web Cơ bản',
        credits: 3,
        fee: 1350000,
        department: 'Khoa Công Nghệ Thông Tin',
        deptId: 'CNTT',
        classId: 'CNTT101_01',
        className: 'Lập trình Web Cơ bản - Lớp 01',
      },
      {
        id: 'CNTT102',
        name: 'Cơ sở dữ liệu',
        credits: 4,
        fee: 1800000,
        department: 'Khoa Công Nghệ Thông Tin',
        deptId: 'CNTT',
        classId: 'CNTT102_01',
        className: 'Cơ sở dữ liệu - Lớp 01',
      },
    ];

    const putRes2 = await fetch('http://localhost:4001/api/auth', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subjectsData: sampleCourses,
        // Notice assignmentsData is NOT passed here!
      }),
    });
    if (!putRes2.ok) {
      const err = await putRes2.text();
      throw new Error('PUT subjects failed: ' + err);
    }
    const authDataAfterCourses = await putRes2.json();
    console.log('Courses count:', authDataAfterCourses.subjectsData?.length);
    console.log('Assignments count:', authDataAfterCourses.assignmentsData?.length);

    if (authDataAfterCourses.subjectsData?.length !== 2) {
      throw new Error('Courses were not saved properly!');
    }
    if (authDataAfterCourses.assignmentsData?.length !== 1) {
      throw new Error('CRITICAL BUG: Assignments WERE WIPED when saving courses!');
    }
    console.log('PASS: Courses saved AND assignments were PRESERVED!');

    // Test 4: Student takes quiz (submission)
    console.log('\n--- Test 4: Submit quiz answer and verify score ---');
    const submission = {
      studentId: 1,
      studentName: 'Lê Văn Sinh Viên',
      score: 10,
      submittedAt: new Date().toLocaleString('vi-VN'),
      answers: { q1: 0 },
    };
    const updatedAssignments = [
      {
        ...sampleAssignment,
        submissions: [submission],
      },
    ];
    const putRes3 = await fetch('http://localhost:4001/api/auth', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assignmentsData: updatedAssignments,
      }),
    });
    if (!putRes3.ok) {
      const err = await putRes3.text();
      throw new Error('PUT submissions failed: ' + err);
    }
    const authDataAfterSub = await putRes3.json();
    const quizSubmissions = authDataAfterSub.assignmentsData?.[0]?.submissions;
    console.log('Quiz submissions count:', quizSubmissions?.length);
    console.log('Quiz score:', quizSubmissions?.[0]?.score);
    if (quizSubmissions?.length !== 1 || quizSubmissions[0].score !== 10) {
      throw new Error('Quiz submission failed!');
    }
    console.log('PASS: Quiz submission saved and score recorded!');

    // Test 5: Teacher creates assignments, logout/login cycle, accidental empty payload protection
    console.log('\n--- Test 5: Assignment persistence across logout and accidental empty payload ---');
    const teacherAssignment1 = {
      id: 'QUIZ_TEACHER_LOGOUT_TEST',
      courseId: 'CNTT101',
      type: 'quiz',
      name: 'Kiểm tra 15 phút Lập trình Web',
      title: 'Kiểm tra 15 phút Lập trình Web',
      dueDate: '2026-11-01',
      modifiedBy: 'Nguyễn Văn',
      status: 'Công khai',
      questions: [
        { id: 'q1', text: 'React là gì?', options: ['Library', 'Framework', 'OS', 'Browser'], correctIndex: 0 }
      ],
      submissions: []
    };
    const teacherAssignment2 = {
      id: 'ASN_TEACHER_FILE_TEST',
      courseId: 'CNTT101',
      type: 'file',
      name: 'de_cuong_on_tap.pdf',
      title: 'de_cuong_on_tap.pdf',
      dueDate: '2026-11-10',
      modifiedBy: 'Nguyễn Văn',
      status: 'Công khai',
      size: '2.5 MB',
      content: 'data:application/pdf;base64,JVBERi0xLjQK...',
    };

    // Save assignments
    const putResTeacher = await fetch('http://localhost:4001/api/auth', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assignmentsData: [teacherAssignment1, teacherAssignment2],
      }),
    });
    if (!putResTeacher.ok) {
      throw new Error('Failed to save teacher assignments!');
    }
    const dataWithTeacher = await putResTeacher.json();
    console.log('Assignments count after adding teacher assignments:', dataWithTeacher.assignmentsData?.length);
    if (!dataWithTeacher.assignmentsData?.some((a) => a.id === 'QUIZ_TEACHER_LOGOUT_TEST')) {
      throw new Error('Teacher quiz not found in assignmentsData!');
    }

    // Now test accidental empty payload: PUT with assignmentsData: [] (e.g. from getDefaultAuthData or partial client sync)
    console.log('Submitting PUT with assignmentsData: [] (simulating auth initialization / partial update)...');
    const putEmptyRes = await fetch('http://localhost:4001/api/auth', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assignmentsData: [],
      }),
    });
    const dataAfterEmpty = await putEmptyRes.json();
    console.log('Assignments count after empty array PUT:', dataAfterEmpty.assignmentsData?.length);
    if (!dataAfterEmpty.assignmentsData || dataAfterEmpty.assignmentsData.length === 0) {
      throw new Error('CRITICAL BUG: Empty array wiped existing assignments!');
    }
    console.log('PASS: Empty array payload did NOT wipe assignments!');

    // Simulate Teacher Logout and Login:
    // When teacher logs back in, client calls GET /api/auth
    console.log('Simulating lecturer re-login and fetching /api/auth...');
    const reLoginRes = await fetch('http://localhost:4001/api/auth');
    const reLoginData = await reLoginRes.json();
    const foundQuiz = reLoginData.assignmentsData?.find((a) => a.id === 'QUIZ_TEACHER_LOGOUT_TEST');
    const foundFile = reLoginData.assignmentsData?.find((a) => a.id === 'ASN_TEACHER_FILE_TEST');

    if (!foundQuiz || !foundFile) {
      throw new Error('CRITICAL BUG: Teacher assignments missing after login fetch!');
    }
    console.log('PASS: Teacher assignments 100% intact after logout and re-login:', {
      quiz: foundQuiz.name,
      file: foundFile.name
    });

    console.log('\nALL 5 TEST SUITES PASSED SUCCESSFULLY! Everything is working correctly.');
  } finally {
    server.close();
    await mongoose.disconnect();
  }
}

runTests().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
