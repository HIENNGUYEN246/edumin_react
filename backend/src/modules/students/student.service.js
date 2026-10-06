import mongoose from 'mongoose';
import { AppError } from '../../lib/AppError.js';
import { parseListQuery, paginate, searchFilter } from '../../lib/pagination.js';
import { generateTempPassword, hashPassword } from '../../lib/password.js';
import { signToken } from '../../lib/jwt.js';
import * as filesService from '../../lib/files.service.js';
import { User } from '../auth/user.model.js';
import { Student } from './student.model.js';
import { createPersonWithAccount, resolveDepartment } from '../shared/person.service.js';
import { ROLES } from '../../lib/roles.js';
import { createStudentSchema } from './student.schema.js';

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
  const { password, passwordHash, id, ...profileData } = payload;
  const department = await resolveDepartment({ departmentId: profileData.departmentId, department: profileData.department });
  if (!department) throw AppError.badRequest('Khoa không hợp lệ');
  profileData.departmentId = department.id;
  const { profile } = await createPersonWithAccount({
    role: ROLES.STUDENT,
    ProfileModel: Student,
    counterKey: 'studentId',
    userLink: 'student',
    profileData,
    password: password || '123',
    precomputedPasswordHash: passwordHash,
    profileId: id,
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
      if (!dept) throw AppError.badRequest('Khoa không hợp lệ');
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

function normalizeImportHeader(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]/g, '');
}

function importPhone(value) {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) return String(value).padStart(10, '0');
  return String(value ?? '');
}

function importDate(value) {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 86400000);
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  }
  const text = String(value ?? '');
  const isoDate = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
  if (isoDate) return `${isoDate[1]}-${isoDate[2].padStart(2, '0')}-${isoDate[3].padStart(2, '0')}`;
  const localizedDate = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(text);
  if (localizedDate) return `${localizedDate[3]}-${localizedDate[2].padStart(2, '0')}-${localizedDate[1].padStart(2, '0')}`;
  return text;
}

function studentImportPayload(row) {
  const values = new Map(Object.entries(row).map(([key, value]) => [normalizeImportHeader(key), value]));
  const get = (...keys) => {
    for (const key of keys) {
      const value = values.get(key);
      if (value !== undefined && value !== null && String(value) !== '') return value;
    }
    return '';
  };
  return {
    id: get('masv', 'studentid', 'id'),
    hoTen: String(get('hoten', 'hovaten', 'fullname', 'name')),
    dob: importDate(get('ngaysinh', 'dob', 'dateofbirth')),
    gender: String(get('gioitinh', 'gender') || 'Nam'),
    phone: importPhone(get('sdt', 'sodienthoai', 'phone', 'phonenumber')),
    email: String(get('email', 'emailnoibo')),
    address: String(get('diachi', 'diachicutru', 'address')),
    department: String(get('khoa', 'department', 'departmentname')),
    className: String(get('lop', 'classname', 'class')),
  };
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function importStudents(rows) {
  const results = { created: 0, failed: [] };
  const preparedRows = await mapWithConcurrency(rows, 8, async (row, index) => {
    const imported = studentImportPayload(row);
    let email = String(imported.email || '').trim().toLowerCase();
    if (email && !email.includes('@')) {
      email = `${email}@student.edu.vn`;
    }
    imported.email = email;
    try {
      let importedId;
      if (imported.id !== '') {
        importedId = Number(imported.id);
        if (!Number.isSafeInteger(importedId) || importedId < 1) throw AppError.badRequest('MaSV phải là số nguyên dương');
      }
      const department = await resolveDepartment({ departmentId: imported.department, department: imported.department });
      if (!department) throw AppError.badRequest('Khoa không tồn tại');
      const parsed = createStudentSchema.safeParse({ ...imported, departmentId: department.id });
      if (!parsed.success) throw AppError.badRequest(parsed.error.issues[0].message);
      return { row: index + 1, email, payload: { ...parsed.data, id: importedId } };
    } catch (error) {
      return { row: index + 1, email, error };
    }
  });

  const validRows = preparedRows.filter((item) => !item.error);
  await mapWithConcurrency(validRows, 4, async (item) => {
    item.password = generateTempPassword();
    item.passwordHash = await hashPassword(item.password);
  });

  for (const item of preparedRows) {
    if (item.error) {
      results.failed.push({ row: item.row, email: item.email, message: item.error.message });
      continue;
    }
    try {
      await createStudent({ ...item.payload, password: item.password, passwordHash: item.passwordHash });
      results.created += 1;
    } catch (error) {
      results.failed.push({ row: item.row, email: item.email, message: error.message });
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
