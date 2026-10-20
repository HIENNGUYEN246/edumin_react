import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/db.js';

async function cleanTestData() {
  console.log('[CLEANUP] Connecting to MongoDB...');
  const conn = await connectDatabase();
  const db = conn.db;

  console.log('[CLEANUP] Connected successfully. Starting cleanup...');

  // 1. Clean users: keep only Admin (role: 'dao-tao' or 'admin')
  const userDeleteResult = await db.collection('users').deleteMany({
    role: { $nin: ['dao-tao', 'admin'] }
  });
  console.log(`[CLEANUP] Deleted ${userDeleteResult.deletedCount} non-admin users from 'users'.`);

  // 2. Clean teachers
  const teacherDeleteResult = await db.collection('teachers').deleteMany({});
  console.log(`[CLEANUP] Deleted ${teacherDeleteResult.deletedCount} documents from 'teachers'.`);

  // 3. Clean students
  const studentDeleteResult = await db.collection('students').deleteMany({});
  console.log(`[CLEANUP] Deleted ${studentDeleteResult.deletedCount} documents from 'students'.`);

  // 4. Clean classes
  const classDeleteResult = await db.collection('courseclasses').deleteMany({});
  console.log(`[CLEANUP] Deleted ${classDeleteResult.deletedCount} documents from 'courseclasses'.`);

  // 5. Clean enrollments
  const enrollmentDeleteResult = await db.collection('enrollments').deleteMany({});
  console.log(`[CLEANUP] Deleted ${enrollmentDeleteResult.deletedCount} documents from 'enrollments'.`);

  // 6. Clean assignments
  const assignmentDeleteResult = await db.collection('assignments').deleteMany({});
  console.log(`[CLEANUP] Deleted ${assignmentDeleteResult.deletedCount} documents from 'assignments'.`);

  // 7. Clean submissions
  const submissionDeleteResult = await db.collection('submissions').deleteMany({});
  console.log(`[CLEANUP] Deleted ${submissionDeleteResult.deletedCount} documents from 'submissions'.`);

  // 8. Clean documents
  const documentDeleteResult = await db.collection('documents').deleteMany({});
  console.log(`[CLEANUP] Deleted ${documentDeleteResult.deletedCount} documents from 'documents'.`);

  // 9. Clean attendances
  const attendanceDeleteResult = await db.collection('attendances').deleteMany({});
  console.log(`[CLEANUP] Deleted ${attendanceDeleteResult.deletedCount} documents from 'attendances'.`);

  // 10. Clean tuitions
  const tuitionDeleteResult = await db.collection('tuitions').deleteMany({});
  console.log(`[CLEANUP] Deleted ${tuitionDeleteResult.deletedCount} documents from 'tuitions'.`);

  // 11. Clean notifications & feedbacks
  await db.collection('notifications').deleteMany({});
  await db.collection('feedbacks').deleteMany({});
  await db.collection('profile_requests').deleteMany({});
  await db.collection('grade_audit_logs').deleteMany({});
  await db.collection('user_desires').deleteMany({});
  console.log(`[CLEANUP] Cleaned notifications, feedbacks, profile_requests, grade_audit_logs, user_desires.`);

  // 12. Reset department heads to null (since teachers were removed)
  await db.collection('departments').updateMany({}, { $set: { head: null } });
  console.log(`[CLEANUP] Reset department heads to null.`);

  // 13. Reset counters for teachers and students
  await db.collection('counters').deleteMany({});
  console.log(`[CLEANUP] Reset counters.`);

  console.log('\n--- VERIFICATION OF REMAINING DATA ---');
  const cols = await db.listCollections().toArray();
  for (const c of cols) {
    const count = await db.collection(c.name).countDocuments();
    console.log(`${c.name}: ${count}`);
  }

  const remainingUsers = await db.collection('users').find({}).toArray();
  console.log('\nRemaining Users in Database:');
  remainingUsers.forEach((u) => {
    console.log(`- [${u.role}] ${u.hoTen} (${u.email}) | Status: ${u.status}`);
  });

  await disconnectDatabase();
  console.log('\n[CLEANUP] Finished successfully!');
}

cleanTestData().catch((err) => {
  console.error('[CLEANUP ERROR]', err);
  process.exit(1);
});
