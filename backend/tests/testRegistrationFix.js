import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User, Teacher, Student, Department, Course, OpenRegistration, StudentRegistration } from '../models/index.js';

dotenv.config();

const API_BASE = 'http://localhost:4000/api';

async function run() {
  console.log('--- STARTING REGISTRATION FIX VERIFICATION ---');

  // Step 1: Query GET /api/auth
  const getRes = await fetch(`${API_BASE}/auth`);
  if (!getRes.ok) throw new Error(`GET /api/auth failed: ${getRes.status}`);
  const initialAuth = await getRes.json();
  console.log(`✓ Fetched auth data: ${initialAuth.studentsData.length} students, ${initialAuth.openRegistrationsData.length} open courses, ${initialAuth.studentRegistrationsData.length} student registrations.`);

  const student = initialAuth.studentsData[0];
  const openReg = initialAuth.openRegistrationsData[0];

  if (!student || !openReg) {
    console.error('Missing student or open course in DB to test with.');
    process.exit(1);
  }

  console.log(`Testing with student: ${student.hoTen || student.name} (id: ${student.id}, email: ${student.email})`);
  console.log(`Testing with open course: ${openReg.courseName} (id: ${openReg.id}, courseId: ${openReg.courseId}, teacher: ${openReg.teacher}, teacherId: ${openReg.teacherId})`);

  // Step 2: Register student for open course
  const newRegistration = {
    regId: String(openReg.id),
    studentId: student.id,
    courseName: openReg.courseName,
    courseId: openReg.courseId,
    teacher: openReg.teacher,
    teacherId: openReg.teacherId,
    schedules: openReg.schedules || [],
    studyStart: openReg.studyStart || '',
    studyEnd: openReg.studyEnd || '',
    room: openReg.room || '',
    department: openReg.department || '',
    enrolledDate: new Date().toLocaleString('vi-VN'),
  };

  const currentRegs = initialAuth.studentRegistrationsData || [];
  // Filter out if already registered
  const filteredRegs = currentRegs.filter((r) => !(String(r.regId) === String(openReg.id) && String(r.studentId) === String(student.id)));
  const updatedRegs = [...filteredRegs, newRegistration];

  console.log(`Sending PUT /api/auth with ${updatedRegs.length} student registrations...`);
  const putRes = await fetch(`${API_BASE}/auth`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      studentRegistrationsData: updatedRegs,
    }),
  });
  if (!putRes.ok) throw new Error(`PUT /api/auth failed: ${putRes.status}`);
  const putData = await putRes.json();
  console.log(`✓ PUT response has ${putData.studentRegistrationsData.length} student registrations.`);

  // Step 3: Verify enrichment in GET /api/auth
  const verifyRes = await fetch(`${API_BASE}/auth`);
  const verifyData = await verifyRes.json();
  const registered = verifyData.studentRegistrationsData.find(
    (r) => String(r.regId) === String(openReg.id) && String(r.studentId) === String(student.id)
  );

  if (!registered) {
    throw new Error('FAILED: Registered student enrollment was not found in GET /api/auth!');
  }
  console.log('✓ Found registered student in GET /api/auth:');
  console.log(`  - regId: ${registered.regId}`);
  console.log(`  - studentId: ${registered.studentId}`);
  console.log(`  - studentName: ${registered.studentName}`);
  console.log(`  - courseId: ${registered.courseId}`);
  console.log(`  - courseName: ${registered.courseName}`);
  console.log(`  - teacher: ${registered.teacher}`);
  console.log(`  - teacherId: ${registered.teacherId}`);
  console.log(`  - schedules: ${JSON.stringify(registered.schedules)}`);
  console.log(`  - room: ${registered.room}`);

  if (!registered.courseName || !registered.studentId) {
    throw new Error('FAILED: Metadata enrichment failed (missing courseName or studentId)');
  }

  // Step 4: Verify protection against accidental empty-array wipe
  console.log('\nTesting empty studentRegistrationsData protection: sending PUT with empty studentRegistrationsData...');
  const wipeAttemptRes = await fetch(`${API_BASE}/auth`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      studentRegistrationsData: [],
    }),
  });
  const afterWipeAttempt = await wipeAttemptRes.json();
  const stillThere = afterWipeAttempt.studentRegistrationsData.find(
    (r) => String(r.regId) === String(openReg.id) && String(r.studentId) === String(student.id)
  );
  if (!stillThere) {
    throw new Error('FAILED: Registrations were wiped by empty studentRegistrationsData payload!');
  }
  console.log('✓ SUCCESS: Empty payload was properly guarded and registrations were NOT wiped.');

  // Step 5: Verify Teacher Class matching
  console.log('\nTesting Teacher Class List matching...');
  const teacher = initialAuth.teachersData.find(
    (t) => String(t.id) === String(openReg.teacherId) || t.name === openReg.teacher || t.hoTen === openReg.teacher
  );
  if (teacher) {
    console.log(`Teacher for course: ${teacher.hoTen || teacher.name} (id: ${teacher.id})`);
    // Filter enrollments for this teacher's class
    const matchingEnrollments = afterWipeAttempt.studentRegistrationsData.filter(
      (r) => String(r.regId) === String(openReg.id) || String(r.courseId) === String(openReg.courseId)
    );
    console.log(`✓ Teacher class ${openReg.courseName} has ${matchingEnrollments.length} enrolled student(s).`);
    const studentInClass = matchingEnrollments.find((r) => String(r.studentId) === String(student.id));
    if (!studentInClass) {
      throw new Error('FAILED: Student is missing from teacher class list!');
    }
    console.log(`✓ Student ${studentInClass.studentName || studentInClass.studentId} correctly displays in class.`);
  }

  console.log('\n--- ALL VERIFICATION TESTS PASSED SUCCESSFULLY! ---');
  process.exit(0);
}

run().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
