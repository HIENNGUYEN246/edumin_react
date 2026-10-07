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
  const { password, passwordHash, id, ...profileData } = payload;
  if (profileData.departmentId || profileData.department) {
    const department = await resolveDepartment({ departmentId: profileData.departmentId, department: profileData.department });
    if (!department) throw AppError.badRequest('Khoa không hợp lệ');
    profileData.departmentId = department.id;
  }
  const { profile } = await createPersonWithAccount({
    role: ROLES.TEACHER,
    ProfileModel: Teacher,
    counterKey: 'teacherId',
    userLink: 'teacher',
    profileData,
    password: password || '123',
    precomputedPasswordHash: passwordHash,
    profileId: id,
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
    let email = String(imported.email || '').trim().toLowerCase();
    if (email && !email.includes('@')) {
      email = `${email}@university.edu.vn`;
    }
    imported.email = email;
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
