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

const POPULATE = [
  { path: 'departmentRef', select: 'id name' },
  { path: 'userId', select: '_id status lockReason email role' },
];

export async function listStudents(query) {
  const { page, limit, skip, sort, search } = parseListQuery(query, { defaultSort: 'id' });
  const filter = searchFilter(search, ['hoTen', 'email', 'department', 'className', 'phone']);
  if (query.className) {
    filter.className = query.className;
  }
  return paginate(Student, { filter, page, limit, skip, sort, populate: POPULATE });
}

export async function listStudentClasses() {
  const classes = await Student.distinct('className');
  return { data: classes.filter((c) => c && String(c).trim() !== '').sort() };
}

/**
 * Resolves a given raw ID (ObjectId string or numeric student code)
 * to a verified ObjectId string of an existing Student document.
 * Validates with mongoose.Types.ObjectId.isValid before database operations.
 */
async function resolveStudentObjectId(rawId) {
  const id = typeof rawId === 'object' && rawId !== null ? (rawId._id || rawId.id) : rawId;
  const idStr = String(id ?? '').trim();

  if (!idStr || idStr === 'undefined' || idStr === 'null') {
    throw AppError.badRequest('Mã sinh viên không được để trống hoặc sai định dạng');
  }

  // 1. If it's already a valid ObjectId
  if (mongoose.Types.ObjectId.isValid(idStr)) {
    return idStr;
  }

  // 2. Fallback: try finding by numeric student code (e.g. 1, 2, "SV-001")
  const numericCode = Number(idStr.replace(/\D/g, ''));
  if (!isNaN(numericCode) && numericCode > 0) {
    const found = await Student.findOne({ id: numericCode }).select('_id').lean();
    if (found?._id && mongoose.Types.ObjectId.isValid(found._id)) {
      return String(found._id);
    }
  }

  // If not valid and cannot resolve to an ObjectId
  throw AppError.badRequest(`Giá trị không hợp lệ cho trường _id: ${idStr}`);
}

export async function getStudent(rawId) {
  const studentObjectId = await resolveStudentObjectId(rawId);
  const student = await Student.findById(studentObjectId).populate(POPULATE).lean();
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
    password: password || '123',
  });
  return Student.findById(profile._id).populate(POPULATE).lean();
}

export async function updateStudent(rawId, payload) {
  const studentObjectId = await resolveStudentObjectId(rawId);
  if (!mongoose.Types.ObjectId.isValid(studentObjectId)) {
    throw AppError.badRequest(`Giá trị không hợp lệ cho trường _id: ${studentObjectId}`);
  }

  const existing = await Student.findById(studentObjectId);
  if (!existing) throw AppError.notFound('Không tìm thấy sinh viên');

  const { departmentId, ...rest } = payload;
  const updateDoc = { ...rest };

  if (departmentId !== undefined) {
    if (departmentId) {
      const dept = await resolveDepartment({ departmentId });
      updateDoc.department = dept?.name || '';
      updateDoc.departmentRef = dept?._id || null;
    } else {
      updateDoc.department = '';
      updateDoc.departmentRef = null;
    }
  }

  delete updateDoc._id;
  delete updateDoc.id;
  delete updateDoc.userId;
  delete updateDoc.createdAt;
  delete updateDoc.updatedAt;
  delete updateDoc.__v;

  const updated = await Student.findByIdAndUpdate(
    studentObjectId,
    { $set: updateDoc },
    { new: true }
  ).populate(POPULATE).lean();

  if (rest.hoTen) {
    await User.updateOne({ _id: existing.userId }, { $set: { hoTen: rest.hoTen } });
  }
  return updated;
}

export async function deleteStudent(rawId) {
  const studentObjectId = await resolveStudentObjectId(rawId);
  const student = await Student.findById(studentObjectId);
  if (!student) throw AppError.notFound('Không tìm thấy sinh viên');

  // Remove the student's enrollments if that collection exists yet.
  if (mongoose.modelNames().includes('Enrollment')) {
    await mongoose.model('Enrollment').deleteMany({ student: student._id });
  }
  await User.deleteOne({ _id: student.userId });
  await Student.deleteOne({ _id: student._id });

  if (student.avatar?.publicId) {
    await filesService.destroy(student.avatar.publicId, { resourceType: 'image' }).catch(() => {});
  }
  return { success: true };
}

export async function bulkDeleteStudents(ids) {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw AppError.badRequest('Danh sách mã sinh viên không hợp lệ');
  }
  let deletedCount = 0;
  for (const id of ids) {
    try {
      await deleteStudent(id);
      deletedCount += 1;
    } catch {
      // Continue next
    }
  }
  return { deletedCount };
}

export async function setStudentAvatar(rawId, file) {
  const studentObjectId = await resolveStudentObjectId(rawId);

  if (!mongoose.Types.ObjectId.isValid(studentObjectId)) {
    throw AppError.badRequest(`Giá trị không hợp lệ cho trường _id: ${studentObjectId}`);
  }

  const existing = await Student.findById(studentObjectId);
  if (!existing) throw AppError.notFound('Không tìm thấy sinh viên');
  if (!file) throw AppError.badRequest('Thiếu tệp ảnh');

  const uploaded = await filesService.uploadBuffer(file.buffer, {
    folder: 'avatars',
    resourceType: 'image',
    access: 'public',
  });
  const previous = existing.avatar?.publicId;

  // Use findByIdAndUpdate on database
  const updatedStudent = await Student.findByIdAndUpdate(
    studentObjectId,
    { $set: { avatar: uploaded } },
    { new: true }
  ).populate(POPULATE).lean();

  // Also sync avatar to linked User account
  await User.findOneAndUpdate(
    { $or: [{ student: existing._id }, { studentId: existing._id }, { email: existing.email }, { _id: existing.userId }] },
    { $set: { avatar: uploaded } }
  ).catch(() => {});

  if (previous && previous !== uploaded.publicId) {
    await filesService.destroy(previous, { resourceType: 'image' }).catch(() => {});
  }
  return updatedStudent;
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
