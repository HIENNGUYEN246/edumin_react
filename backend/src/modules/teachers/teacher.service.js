import mongoose from 'mongoose';
import { AppError } from '../../lib/AppError.js';
import { parseListQuery, paginate, searchFilter } from '../../lib/pagination.js';
import { generateTempPassword, hashPassword } from '../../lib/password.js';
import * as filesService from '../../lib/files.service.js';
import { User } from '../auth/user.model.js';
import { Teacher } from './teacher.model.js';
import { createPersonWithAccount, resolveDepartment } from '../shared/person.service.js';
import { ROLES } from '../../lib/roles.js';
import { createTeacherSchema } from './teacher.schema.js';

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
  const { password, passwordHash, id, ...profileData } = payload;
  const department = await resolveDepartment({ departmentId: profileData.departmentId, department: profileData.department });
  if (!department) throw AppError.badRequest('Khoa không hợp lệ');
  profileData.departmentId = department.id;
  const { profile } = await createPersonWithAccount({
    role: ROLES.TEACHER,
    ProfileModel: Teacher,
    counterKey: 'teacherId',
    userLink: 'teacher',
    profileData,
    password: password || generateTempPassword(),
    precomputedPasswordHash: passwordHash,
    profileId: id,
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
    if (!dept) throw AppError.badRequest('Khoa không hợp lệ');
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

  if (previous && previous !== uploaded.publicId) {
    await filesService.destroy(previous, { resourceType: 'image' }).catch(() => {});
  }
  return Teacher.findById(teacher._id).populate(POPULATE).lean();
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
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
    return String(value).padStart(10, '0');
  }
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

function teacherImportPayload(row) {
  const values = new Map(Object.entries(row).map(([key, value]) => [normalizeImportHeader(key), value]));
  const get = (...keys) => {
    for (const key of keys) {
      const value = values.get(key);
      if (value !== undefined && value !== null && String(value) !== '') return value;
    }
    return '';
  };
  return {
    id: get('magv', 'teacherid', 'id'),
    hoTen: String(get('hoten', 'hovaten', 'fullname', 'name')),
    education: String(get('trinhdo', 'education', 'degree')),
    dob: importDate(get('ngaysinh', 'dob', 'dateofbirth')),
    gender: String(get('gioitinh', 'gender') || 'Nam'),
    department: String(get('khoa', 'department', 'departmentname')),
    phone: importPhone(get('sdt', 'sodienthoai', 'phone', 'phonenumber')),
    email: String(get('email', 'emailnoibo')),
    address: String(get('diachi', 'diachicutru', 'address')),
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

/**
 * Bulk import from parsed spreadsheet rows. Each row is validated and created
 * independently; failures are reported per-row instead of aborting the batch.
 */
export async function importTeachers(rows) {
  const results = { created: 0, failed: [] };
  const preparedRows = await mapWithConcurrency(rows, 8, async (row, index) => {
    const imported = teacherImportPayload(row);
    const email = imported.email;
    try {
      let importedId;
      if (imported.id !== '') {
        importedId = Number(imported.id);
        if (!Number.isSafeInteger(importedId) || importedId < 1) {
          throw AppError.badRequest('MaGV phải là số nguyên dương');
        }
      }
      const department = await resolveDepartment({ departmentId: imported.department, department: imported.department });
      if (!department) throw AppError.badRequest('Khoa không tồn tại');
      const parsed = createTeacherSchema.safeParse({ ...imported, departmentId: department.id });
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
      await createTeacher({ ...item.payload, password: item.password, passwordHash: item.passwordHash });
      results.created += 1;
    } catch (error) {
      results.failed.push({ row: item.row, email: item.email, message: error.message });
    }
  }
  return results;
}

export async function bulkDeleteTeachers(ids) {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw AppError.badRequest('Danh sách id không hợp lệ');
  }

  const teachers = await Teacher.find({ _id: { $in: ids } }).select('_id userId avatar').lean();
  if (teachers.length === 0) {
    return { success: true, deletedCount: 0 };
  }

  const teacherIds = teachers.map((t) => t._id);
  const userIds = teachers.map((t) => t.userId).filter(Boolean);

  if (mongoose.modelNames().includes('Department')) {
    await mongoose
      .model('Department')
      .updateMany({ head: { $in: teacherIds } }, { $set: { head: null } });
  }

  if (userIds.length > 0) {
    await User.deleteMany({ _id: { $in: userIds } });
  }

  const result = await Teacher.deleteMany({ _id: { $in: teacherIds } });

  for (const t of teachers) {
    if (t.avatar?.publicId) {
      filesService
        .destroy(t.avatar.publicId, { resourceType: t.avatar.resourceType || 'image' })
        .catch(() => {});
    }
  }

  return { success: true, deletedCount: result.deletedCount };
}
