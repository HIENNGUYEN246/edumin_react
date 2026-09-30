import mongoose from 'mongoose';
import { AppError } from '../../lib/AppError.js';
import { parseListQuery, paginate, searchFilter } from '../../lib/pagination.js';
import { Course } from './course.model.js';
import { resolveDepartment } from '../shared/person.service.js';

const POPULATE = { path: 'departmentRef', select: 'id name' };

export async function listCourses(query) {
  const { page, limit, skip, sort, search } = parseListQuery(query, { defaultSort: 'id' });
  const filter = searchFilter(search, ['id', 'name', 'department']);
  return paginate(Course, { filter, page, limit, skip, sort, populate: POPULATE });
}

export async function getCourse(id) {
  const course = await Course.findById(id).populate(POPULATE).lean();
  if (!course) throw AppError.notFound('Không tìm thấy học phần');
  return course;
}

async function applyDepartment(target, departmentId) {
  const dept = await resolveDepartment({ departmentId });
  target.department = dept?.name || '';
  target.departmentRef = dept?._id || null;
}

export async function createCourse(payload) {
  const exists = await Course.findOne({ id: payload.id });
  if (exists) throw AppError.conflict('Mã học phần đã tồn tại');

  const course = new Course({ id: payload.id, name: payload.name, credits: payload.credits, fee: payload.fee });
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

export async function importCourses(rows) {
  const results = { created: 0, failed: [] };
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const id = String(row.id || row.Ma || row['Mã'] || '').trim();
    const name = String(row.name || row.Ten || row['Tên'] || '').trim();
    try {
      if (!id) throw AppError.badRequest('Thiếu mã học phần');
      if (!name) throw AppError.badRequest('Thiếu tên học phần');
      await createCourse({
        id,
        name,
        credits: Number(row.credits || row.SoTinChi || 0) || 0,
        fee: Number(row.fee || row.HocPhi || 0) || 0,
        departmentId: String(row.departmentId || row.Khoa || '').trim(),
      });
      results.created += 1;
    } catch (error) {
      results.failed.push({ row: i + 1, id, message: error.message });
    }
  }
  return results;
}
