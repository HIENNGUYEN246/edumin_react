import mongoose from 'mongoose';
import { AppError } from '../../lib/AppError.js';
import { parseListQuery, paginate, searchFilter } from '../../lib/pagination.js';
import { generateTempPassword } from '../../lib/password.js';
import { signToken } from '../../lib/jwt.js';
import * as filesService from '../../lib/files.service.js';
import { User } from '../auth/user.model.js';
import { Student } from './student.model.js';
import { createPersonWithAccount, resolveDepartment } from '../shared/person.service.js';
import { ROLES } from '../../lib/roles.js';

const POPULATE = { path: 'departmentRef', select: 'id name' };

export async function listStudents(query) {
  const { page, limit, skip, sort, search } = parseListQuery(query, { defaultSort: 'id' });
  const filter = searchFilter(search, ['hoTen', 'email', 'department', 'className', 'phone']);
  return paginate(Student, { filter, page, limit, skip, sort, populate: POPULATE });
}

export async function getStudent(id) {
  const student = await Student.findById(id).populate(POPULATE).lean();
  if (!student) throw AppError.notFound('Không tìm thấy sinh viên');
  return student;
}

export async function createStudent(payload) {
  const { password, ...profileData } = payload;
  const { profile } = await createPersonWithAccount({
    role: ROLES.STUDENT,
    ProfileModel: Student,
    counterKey: 'studentId',
    userLink: 'student',
    profileData,
    password: password || generateTempPassword(),
  });
  return Student.findById(profile._id).populate(POPULATE).lean();
}

export async function updateStudent(id, payload) {
  const student = await Student.findById(id);
  if (!student) throw AppError.notFound('Không tìm thấy sinh viên');

  const { departmentId, ...rest } = payload;
  Object.assign(student, rest);

  if (departmentId !== undefined) {
    const dept = await resolveDepartment({ departmentId });
    student.department = dept?.name || '';
    student.departmentRef = dept?._id || null;
  }

  await student.save();
  if (rest.hoTen) await User.updateOne({ _id: student.userId }, { $set: { hoTen: rest.hoTen } });
  return Student.findById(student._id).populate(POPULATE).lean();
}

export async function deleteStudent(id) {
  const student = await Student.findById(id);
  if (!student) throw AppError.notFound('Không tìm thấy sinh viên');

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      // Remove the student's enrollments if that collection exists yet.
      if (mongoose.modelNames().includes('Enrollment')) {
        await mongoose.model('Enrollment').deleteMany({ student: student._id }, { session });
      }
      await User.deleteOne({ _id: student.userId }, { session });
      await Student.deleteOne({ _id: student._id }, { session });
    });
  } finally {
    await session.endSession();
  }

  if (student.avatar?.publicId) {
    await filesService.destroy(student.avatar.publicId, { resourceType: 'image' }).catch(() => {});
  }
  return { success: true };
}

export async function setStudentAvatar(id, file) {
  const student = await Student.findById(id);
  if (!student) throw AppError.notFound('Không tìm thấy sinh viên');
  if (!file) throw AppError.badRequest('Thiếu tệp ảnh');

  const uploaded = await filesService.uploadBuffer(file.buffer, {
    folder: 'avatars',
    resourceType: 'image',
    access: 'public',
  });
  const previous = student.avatar?.publicId;
  student.avatar = uploaded;
  await student.save();

  // Also sync avatar to linked User account
  await User.findOneAndUpdate(
    { $or: [{ student: student._id }, { studentId: student._id }, { email: student.email }] },
    { avatar: uploaded }
  ).catch(() => {});

  if (previous && previous !== uploaded.publicId) {
    await filesService.destroy(previous, { resourceType: 'image' }).catch(() => {});
  }
  return Student.findById(student._id).populate(POPULATE).lean();
}

export async function importStudents(rows) {
  const results = { created: 0, failed: [] };
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const hoTen = String(row.hoTen || row.name || row['Họ tên'] || '').trim();
    const email = String(row.email || row.Email || '').trim().toLowerCase();
    try {
      if (hoTen.length < 2) throw AppError.badRequest('Họ tên không hợp lệ');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw AppError.badRequest('Email không hợp lệ');
      await createStudent({
        hoTen,
        email,
        phone: String(row.phone || row['Số điện thoại'] || '').trim(),
        className: String(row.className || row.Lop || row['Lớp'] || '').trim(),
        department: String(row.department || row.Khoa || '').trim(),
        departmentId: String(row.departmentId || '').trim(),
      });
      results.created += 1;
    } catch (error) {
      results.failed.push({ row: i + 1, email, message: error.message });
    }
  }
  return results;
}

/** Public self-registration for students. Returns a token so they land logged in. */
export async function registerStudent(payload) {
  const dept = await resolveDepartment({ departmentId: payload.departmentId });
  if (!dept) throw AppError.badRequest('Khoa đã chọn không tồn tại');

  const { user, profile } = await createPersonWithAccount({
    role: ROLES.STUDENT,
    ProfileModel: Student,
    counterKey: 'studentId',
    userLink: 'student',
    profileData: {
      hoTen: payload.hoTen,
      email: payload.email,
      className: payload.className || '',
      departmentId: payload.departmentId,
      education: 'Chính quy',
    },
    password: payload.password,
  });

  const token = signToken(user);
  const populated = await Student.findById(profile._id).populate(POPULATE).lean();
  return { token, user: user.toPublic(), profile: populated };
}
