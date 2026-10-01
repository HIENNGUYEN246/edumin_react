import mongoose from 'mongoose';
import { AppError } from '../../lib/AppError.js';
import { parseListQuery, paginate, searchFilter } from '../../lib/pagination.js';
import { generateTempPassword } from '../../lib/password.js';
import * as filesService from '../../lib/files.service.js';
import { User } from '../auth/user.model.js';
import { Teacher } from './teacher.model.js';
import { createPersonWithAccount, resolveDepartment } from '../shared/person.service.js';
import { ROLES } from '../../lib/roles.js';

const POPULATE = { path: 'departmentRef', select: 'id name' };

export async function listTeachers(query) {
  const { page, limit, skip, sort, search } = parseListQuery(query, { defaultSort: 'id' });
  const filter = searchFilter(search, ['hoTen', 'email', 'department', 'phone']);
  return paginate(Teacher, { filter, page, limit, skip, sort, populate: POPULATE });
}

export async function getTeacher(id) {
  const teacher = await Teacher.findById(id).populate(POPULATE).lean();
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

export async function updateTeacher(id, payload) {
  const teacher = await Teacher.findById(id);
  if (!teacher) throw AppError.notFound('Không tìm thấy giáo viên');

  const { departmentId, ...rest } = payload;
  Object.assign(teacher, rest);

  if (departmentId !== undefined) {
    const dept = await resolveDepartment({ departmentId });
    teacher.department = dept?.name || '';
    teacher.departmentRef = dept?._id || null;
  }

  await teacher.save();
  // Keep the linked account's display name in sync.
  if (rest.hoTen) await User.updateOne({ _id: teacher.userId }, { $set: { hoTen: rest.hoTen } });
  return Teacher.findById(teacher._id).populate(POPULATE).lean();
}

export async function deleteTeacher(id) {
  const teacher = await Teacher.findById(id);
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

export async function setTeacherAvatar(id, file) {
  const teacher = await Teacher.findById(id);
  if (!teacher) throw AppError.notFound('Không tìm thấy giáo viên');
  if (!file) throw AppError.badRequest('Thiếu tệp ảnh');

  const uploaded = await filesService.uploadBuffer(file.buffer, {
    folder: 'avatars',
    resourceType: 'image',
    access: 'public',
  });

  const previous = teacher.avatar?.publicId;
  teacher.avatar = uploaded;
  await teacher.save();

  // Also sync avatar to linked User account
  await User.findOneAndUpdate(
    { $or: [{ teacher: teacher._id }, { teacherId: teacher._id }, { email: teacher.email }] },
    { avatar: uploaded }
  ).catch(() => {});

  if (previous && previous !== uploaded.publicId) {
    await filesService.destroy(previous, { resourceType: 'image' }).catch(() => {});
  }
  return Teacher.findById(teacher._id).populate(POPULATE).lean();
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
