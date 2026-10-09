import mongoose from 'mongoose';
import { AppError } from '../../lib/AppError.js';
import { parseListQuery, paginate, searchFilter } from '../../lib/pagination.js';
import { Course } from './course.model.js';
import { CourseClass } from '../classes/courseClass.model.js';
import { resolveDepartment } from '../shared/person.service.js';
import { createCourseSchema } from './course.schema.js';

const POPULATE = { path: 'departmentRef', select: 'id name' };

export async function listCourses(query) {
  const { page, limit, skip, sort, search } = parseListQuery(query, { defaultSort: 'id' });
  const filter = searchFilter(search, ['id', 'name', 'department']);
  if (query.department) filter.department = query.department;
  return paginate(Course, { filter, page, limit, skip, sort, populate: POPULATE });
}

export async function getCourse(id) {
  const course = await Course.findById(id).populate(POPULATE).lean();
  if (!course) throw AppError.notFound('Không tìm thấy học phần');
  return course;
}

async function applyDepartment(target, departmentId) {
  const value = String(departmentId || '').trim();
  const dept = value ? await resolveDepartment({ departmentId: value, department: value }) : null;
  if (value && !dept) throw AppError.badRequest('Khoa không tồn tại');
  target.department = dept?.name || '';
  target.departmentRef = dept?._id || null;
}

export async function createCourse(payload) {
  const exists = await Course.findOne({ id: payload.id });
  if (exists) throw AppError.conflict('Mã học phần đã tồn tại');

  const course = new Course({
    id: payload.id,
    name: payload.name,
    credits: payload.credits,
    fee: payload.fee,
    gradeWeights: payload.gradeWeights,
  });
  await applyDepartment(course, payload.departmentId);
  await course.save();
  return Course.findById(course._id).populate(POPULATE).lean();
}

export async function updateCourse(id, payload) {
  const course = await Course.findById(id);
  if (!course) throw AppError.notFound('Không tìm thấy học phần');

  const { departmentId, ...rest } = payload;
  Object.assign(course, rest);
  if (departmentId !== undefined) await applyDepartment(course, departmentId);
  await course.save();
  await CourseClass.updateMany(
    { courseRef: course._id },
    {
      $set: {
        courseId: course.id,
        courseName: course.name,
        credits: course.credits,
        fee: course.fee,
        department: course.department,
      },
    }
  );
  return Course.findById(course._id).populate(POPULATE).lean();
}

export async function deleteCourse(id) {
  const course = await Course.findById(id);
  if (!course) throw AppError.notFound('Không tìm thấy học phần');

  // A course that already has opened classes cannot be removed.
  if (mongoose.modelNames().includes('CourseClass')) {
    const classCount = await mongoose.model('CourseClass').countDocuments({ courseRef: course._id });
    if (classCount > 0) {
      throw AppError.conflict('Không thể xóa học phần đang có lớp mở đăng ký');
    }
  }

  await Course.deleteOne({ _id: course._id });
  return { success: true };
}

export async function bulkDeleteCourses(ids) {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw AppError.badRequest('Danh sách mã học phần không hợp lệ');
  }
  let deletedCount = 0;
  for (const id of ids) {
    try {
      await deleteCourse(id);
      deletedCount += 1;
    } catch {
      // Continue next
    }
  }
  return { deletedCount };
}

function normalizeImportHeader(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]/g, '');
}

function importNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  const text = String(value ?? '').trim().replace(/\s/g, '');
  if (!text) return 0;
  if (/^-?\d{1,3}(?:[.,]\d{3})+$/.test(text)) return Number(text.replace(/[.,]/g, ''));
  const normalized = text.replace(',', '.');
  return Number(normalized);
}

function courseImportPayload(row) {
  const values = new Map(Object.entries(row).map(([key, value]) => [normalizeImportHeader(key), value]));
  const get = (...keys) => {
    for (const key of keys) {
      const value = values.get(key);
      if (value !== undefined && value !== null && String(value) !== '') return value;
    }
    return '';
  };
  return {
    id: String(get('mahp', 'id', 'ma')),
    name: String(get('tenhp', 'name', 'ten')),
    credits: importNumber(get('tinchi', 'credits', 'sotinchi')),
    fee: importNumber(get('hocphi', 'fee', 'tuitionfee')),
    departmentId: String(get('khoa', 'department', 'departmentname')),
  };
}

export async function importCourses(rows) {
  const results = { created: 0, failed: [] };
  for (let i = 0; i < rows.length; i += 1) {
    const imported = courseImportPayload(rows[i]);
    const id = imported.id.trim();
    try {
      const department = imported.departmentId.trim()
        ? await resolveDepartment({ departmentId: imported.departmentId.trim(), department: imported.departmentId.trim() })
        : null;
      if (imported.departmentId.trim() && !department) throw AppError.badRequest('Khoa không tồn tại');
      const parsed = createCourseSchema.safeParse({
        ...imported,
        departmentId: department?.id || '',
      });
      if (!parsed.success) throw AppError.badRequest(parsed.error.issues[0].message);
      await createCourse(parsed.data);
      results.created += 1;
    } catch (error) {
      results.failed.push({ row: i + 1, id, message: error.message });
    }
  }
  return results;
}
