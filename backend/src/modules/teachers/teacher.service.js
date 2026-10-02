import mongoose from 'mongoose';
import { AppError } from '../../lib/AppError.js';
import { parseListQuery, paginate, searchFilter } from '../../lib/pagination.js';
import { generateTempPassword } from '../../lib/password.js';
import * as filesService from '../../lib/files.service.js';
import { User } from '../auth/user.model.js';
import { Teacher } from './teacher.model.js';
import { createPersonWithAccount, resolveDepartment } from '../shared/person.service.js';
import { ROLES } from '../../lib/roles.js';

const POPULATE = [
  { path: 'departmentRef', select: 'id name' },
  { path: 'userId', select: '_id status lockReason email role' },
];

export async function listTeachers(query) {
  const { page, limit, skip, sort, search } = parseListQuery(query, { defaultSort: 'id' });
  const filter = searchFilter(search, ['hoTen', 'email', 'department', 'phone']);
  return paginate(Teacher, { filter, page, limit, skip, sort, populate: POPULATE });
}

/**
 * Resolves a given raw ID (ObjectId string or numeric teacher code)
 * to a verified ObjectId string of an existing Teacher document.
 * Validates with mongoose.Types.ObjectId.isValid before database operations.
 */
async function resolveTeacherObjectId(rawId) {
  const id = typeof rawId === 'object' && rawId !== null ? (rawId._id || rawId.id) : rawId;
  const idStr = String(id ?? '').trim();

  if (!idStr || idStr === 'undefined' || idStr === 'null' || idStr === '[object Object]') {
    throw AppError.badRequest('Mã giáo viên không được để trống hoặc sai định dạng');
  }

  // 1. If it's already a valid ObjectId
  if (mongoose.Types.ObjectId.isValid(idStr)) {
    return idStr;
  }

  // 2. Fallback: try finding by numeric teacher code (e.g. 1, 2, "GV-001")
  const numericCode = Number(idStr.replace(/\D/g, ''));
  if (!isNaN(numericCode) && numericCode > 0) {
    const found = await Teacher.findOne({ id: numericCode }).select('_id').lean();
    if (found?._id && mongoose.Types.ObjectId.isValid(found._id)) {
      return String(found._id);
    }
  }

  // If not valid and cannot resolve to an ObjectId
  throw AppError.badRequest(`Giá trị không hợp lệ cho trường _id: ${idStr}`);
}

export async function getTeacher(rawId) {
  const teacherObjectId = await resolveTeacherObjectId(rawId);
  const teacher = await Teacher.findById(teacherObjectId).populate(POPULATE).lean();
  if (!teacher) throw AppError.notFound('Không tìm thấy giáo viên');
  return teacher;
}

/** The teacher profile linked to the authenticated user. */
export async function getMyTeacher(user) {
  const teacher = await Teacher.findById(user.teacher).populate(POPULATE).lean();
  if (!teacher) throw AppError.notFound('Không tìm thấy hồ sơ giáo viên');
  return teacher;
}

export async function createTeacher(payload) {
  const { password, ...profileData } = payload;
  const { profile } = await createPersonWithAccount({
    role: ROLES.TEACHER,
    ProfileModel: Teacher,
    counterKey: 'teacherId',
    userLink: 'teacher',
    profileData,
    password: password || '123',
  });
  return Teacher.findById(profile._id).populate(POPULATE).lean();
}

export async function updateTeacher(rawId, payload) {
  const teacherObjectId = await resolveTeacherObjectId(rawId);
  if (!mongoose.Types.ObjectId.isValid(teacherObjectId)) {
    throw AppError.badRequest(`Giá trị không hợp lệ cho trường _id: ${teacherObjectId}`);
  }

  const existing = await Teacher.findById(teacherObjectId);
  if (!existing) throw AppError.notFound('Không tìm thấy giáo viên');

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

  const updated = await Teacher.findByIdAndUpdate(
    teacherObjectId,
    { $set: updateDoc },
    { new: true }
  ).populate(POPULATE).lean();

  // Keep the linked account's display name in sync.
  if (rest.hoTen) {
    await User.updateOne({ _id: existing.userId }, { $set: { hoTen: rest.hoTen } });
  }
  return updated;
}

export async function deleteTeacher(rawId) {
  const teacherObjectId = await resolveTeacherObjectId(rawId);
  const teacher = await Teacher.findById(teacherObjectId);
  if (!teacher) throw AppError.notFound('Không tìm thấy giáo viên');

  // A teacher removed from the system must not remain a department head.
  await mongoose
    .model('Department')
    .updateMany({ head: teacher._id }, { $set: { head: null } });
  await User.deleteOne({ _id: teacher.userId });
  await Teacher.deleteOne({ _id: teacher._id });

  // Best-effort avatar cleanup outside the transaction.
  if (teacher.avatar?.publicId) {
    await filesService
      .destroy(teacher.avatar.publicId, { resourceType: teacher.avatar.resourceType })
      .catch(() => {});
  }
  return { success: true };
}

export async function bulkDeleteTeachers(ids) {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw AppError.badRequest('Danh sách mã giáo viên không hợp lệ');
  }
  let deletedCount = 0;
  for (const id of ids) {
    try {
      await deleteTeacher(id);
      deletedCount += 1;
    } catch {
      // Continue next
    }
  }
  return { deletedCount };
}

export async function setTeacherAvatar(rawId, file) {
  const teacherObjectId = await resolveTeacherObjectId(rawId);
  if (!mongoose.Types.ObjectId.isValid(teacherObjectId)) {
    throw AppError.badRequest(`Giá trị không hợp lệ cho trường _id: ${teacherObjectId}`);
  }

  const existing = await Teacher.findById(teacherObjectId);
  if (!existing) throw AppError.notFound('Không tìm thấy giáo viên');
  if (!file) throw AppError.badRequest('Thiếu tệp ảnh');

  const uploaded = await filesService.uploadBuffer(file.buffer, {
    folder: 'avatars',
    resourceType: 'image',
    access: 'public',
  });

  const previous = existing.avatar?.publicId;

  const updatedTeacher = await Teacher.findByIdAndUpdate(
    teacherObjectId,
    { $set: { avatar: uploaded } },
    { new: true }
  ).populate(POPULATE).lean();

  // Also sync avatar to linked User account
  await User.findOneAndUpdate(
    { $or: [{ teacher: existing._id }, { teacherId: existing._id }, { email: existing.email }, { _id: existing.userId }] },
    { $set: { avatar: uploaded } }
  ).catch(() => {});

  if (previous && previous !== uploaded.publicId) {
    await filesService.destroy(previous, { resourceType: 'image' }).catch(() => {});
  }
  return updatedTeacher;
}

/**
 * Bulk import from parsed spreadsheet rows. Each row is validated and created
 * independently; failures are reported per-row instead of aborting the batch.
 */
export async function importTeachers(rows) {
  const results = { created: 0, failed: [] };
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const hoTen = String(row.hoTen || row.name || row['Họ tên'] || '').trim();
    const email = String(row.email || row.Email || '').trim().toLowerCase();
    try {
      if (hoTen.length < 2) throw AppError.badRequest('Họ tên không hợp lệ');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw AppError.badRequest('Email không hợp lệ');
      await createTeacher({
        hoTen,
        email,
        phone: String(row.phone || row['Số điện thoại'] || '').trim(),
        department: String(row.department || row.Khoa || '').trim(),
        departmentId: String(row.departmentId || '').trim(),
        education: String(row.education || row['Trình độ'] || '').trim(),
      });
      results.created += 1;
    } catch (error) {
      results.failed.push({ row: i + 1, email, message: error.message });
    }
  }
  return results;
}
