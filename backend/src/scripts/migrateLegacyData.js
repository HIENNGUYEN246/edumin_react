import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/edumin';

async function hash(plain) {
  return bcrypt.hash(String(plain), 10);
}

async function migrate() {
  console.log('Connecting to MongoDB:', MONGO_URI);
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;

  console.log('--- 1. Migrating Users ---');
  const users = await db.collection('users').find({}).toArray();
  for (const u of users) {
    const updates = {};
    // If password exists, create passwordHash
    if (u.password && !u.passwordHash) {
      updates.passwordHash = await hash(u.password);
      console.log(`Hashed password for ${u.email}`);
    }
    // If admin1@edu.vn, ensure password is 123456
    if (u.email === 'admin1@edu.vn' && (!u.passwordHash || u.password !== '123456')) {
      updates.password = '123456';
      updates.passwordHash = await hash('123456');
    }

    // Link teacher
    if (u.teacherId && !u.teacher) {
      updates.teacher = u.teacherId;
    }
    if (u.role === 'giao-vien' && (!u.teacher && !u.teacherId)) {
      const teacher = await db.collection('teachers').findOne({
        $or: [{ userId: u._id }, { email: u.email }],
      });
      if (teacher) {
        updates.teacher = teacher._id;
        updates.teacherId = teacher._id;
      }
    }

    // Link student
    if (u.studentId && !u.student) {
      updates.student = u.studentId;
    }
    if (u.role === 'sinh-vien' && (!u.student && !u.studentId)) {
      const student = await db.collection('students').findOne({
        $or: [{ userId: u._id }, { email: u.email }],
      });
      if (student) {
        updates.student = student._id;
        updates.studentId = student._id;
      }
    }

    if (Object.keys(updates).length > 0) {
      await db.collection('users').updateOne({ _id: u._id }, { $set: updates });
      console.log(`Updated user ${u.email}:`, Object.keys(updates));
    }
  }

  console.log('--- 2. Migrating OpenRegistrations to CourseClasses ---');
  const openRegs = await db.collection('openregistrations').find({}).toArray();
  for (const reg of openRegs) {
    const classCode = reg.classId || (reg.courseId ? `${reg.courseId}-01` : String(reg.id));
    const schedules = (reg.schedules || []).map((s) => ({
      dayId: String(s.dayId || '2'),
      shiftId: String(s.shiftId || 'S1'),
    }));

    const classData = {
      id: classCode,
      courseRef: reg.courseRef,
      courseId: reg.courseId || '',
      courseName: reg.courseName || '',
      department: reg.department || '',
      credits: Number(reg.credits) || 0,
      fee: Number(reg.fee) || 0,
      teacherRef: reg.teacherRef || null,
      teacherId: reg.teacherId != null ? Number(reg.teacherId) : null,
      teacher: reg.teacher || '',
      room: reg.room || '',
      schedules,
      capacity: Number(reg.capacity) || 40,
      studyStart: reg.studyStart || '2026-10-07',
      studyEnd: reg.studyEnd || '2026-11-21',
      status: reg.status === 'Đang mở' ? 'Đang mở' : 'Đang mở',
      createdAt: reg.createdAt || new Date(),
      updatedAt: reg.updatedAt || new Date(),
    };

    const existing = await db.collection('courseclasses').findOne({
      $or: [{ id: classCode }, { _id: reg._id }],
    });

    if (!existing) {
      classData._id = reg._id; // preserve _id so references match!
      await db.collection('courseclasses').insertOne(classData);
      console.log(`Created course class: ${classCode} (${reg.courseName})`);
    } else {
      await db.collection('courseclasses').updateOne({ _id: existing._id }, { $set: classData });
      console.log(`Updated course class: ${classCode}`);
    }
  }

  console.log('--- 3. Migrating StudentRegistrations to Enrollments ---');
  const studentRegs = await db.collection('studentregistrations').find({}).toArray();
  for (const sreg of studentRegs) {
    // Find classRef
    let classDoc = await db.collection('courseclasses').findOne({ _id: sreg.regId });
    if (!classDoc) {
      classDoc = await db.collection('courseclasses').findOne({ courseRef: sreg.courseRef });
    }
    if (!classDoc && sreg.regId) {
      const openReg = await db.collection('openregistrations').findOne({ id: sreg.regId });
      if (openReg) {
        classDoc = await db.collection('courseclasses').findOne({ courseId: openReg.courseId });
      }
    }

    if (classDoc && sreg.studentRef) {
      const existing = await db.collection('enrollments').findOne({
        student: sreg.studentRef,
        classRef: classDoc._id,
      });
      if (!existing) {
        await db.collection('enrollments').insertOne({
          student: sreg.studentRef,
          classRef: classDoc._id,
          classId: classDoc.id,
          createdAt: sreg.createdAt || new Date(),
          updatedAt: sreg.updatedAt || new Date(),
        });
        console.log(`Enrolled student ${sreg.studentRef} into class ${classDoc.id}`);
      }
    }
  }

  console.log('--- 4. Setting Counters ---');
  const maxTeacher = await db.collection('teachers').find({}).sort({ id: -1 }).limit(1).toArray();
  const maxTeacherId = maxTeacher[0]?.id || 0;
  await db.collection('counters').updateOne(
    { _id: 'teacherId' },
    { $set: { value: Math.max(maxTeacherId, 2) } },
    { upsert: true }
  );

  const maxStudent = await db.collection('students').find({}).sort({ id: -1 }).limit(1).toArray();
  const maxStudentId = maxStudent[0]?.id || 0;
  await db.collection('counters').updateOne(
    { _id: 'studentId' },
    { $set: { value: Math.max(maxStudentId, 2) } },
    { upsert: true }
  );
  console.log(`Counters set: teacherId=${Math.max(maxTeacherId, 2)}, studentId=${Math.max(maxStudentId, 2)}`);

  console.log('--- 5. Diagnostics Summary ---');
  const colList = await db.listCollections().toArray();
  for (const c of colList) {
    const count = await db.collection(c.name).countDocuments();
    console.log(`Collection ${c.name}: ${count} records`);
  }

  await mongoose.disconnect();
  console.log('Migration complete!');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

