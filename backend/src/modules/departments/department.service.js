import mongoose from 'mongoose';
import { AppError } from '../../lib/AppError.js';
import { parseListQuery, paginate, searchFilter } from '../../lib/pagination.js';
import { Department } from './department.model.js';

/** Resolve a head value (teacher ObjectId string) to an ObjectId or null. */
function normalizeHead(head) {
  if (!head) return null;
  if (mongoose.Types.ObjectId.isValid(head)) return new mongoose.Types.ObjectId(head);
  return null;
}

/** Populate `head` only once the Teacher model exists (added in a later module). */
const headPopulate = () =>
  mongoose.modelNames().includes('Teacher')
    ? { path: 'head', select: 'id hoTen avatar email department' }
    : undefined;

export async function listDepartments(query) {
  const { page, limit, skip, sort, search } = parseListQuery(query, { defaultSort: 'name' });
  const filter = searchFilter(search, ['id', 'name']);
  return paginate(Department, { filter, page, limit, skip, sort, populate: headPopulate() });
}

export async function getDepartment(id) {
  let queryBuilder = Department.findById(id);
  const populate = headPopulate();
  if (populate) queryBuilder = queryBuilder.populate(populate);
  const dept = await queryBuilder.lean();
  if (!dept) throw AppError.notFound('Không tìm thấy khoa');
  return dept;
}

export async function createDepartment(payload) {
  const exists = await Department.findOne({ id: payload.id });
  if (exists) throw AppError.conflict('Mã khoa đã tồn tại');
  const dept = await Department.create({
    id: payload.id,
    name: payload.name,
    head: normalizeHead(payload.head),
  });
  return dept.toObject();
}

export async function updateDepartment(id, payload) {
  const update = {};
  if (payload.name !== undefined) update.name = payload.name;
  if (payload.head !== undefined) {
    update.head = normalizeHead(payload.head);
    if (update.head && mongoose.modelNames().includes('Teacher')) {
      const currentDept = await Department.findById(id);
      if (currentDept) {
        await mongoose.model('Teacher').updateOne(
          { _id: update.head },
          { $set: { department: currentDept.name, departmentRef: currentDept._id } }
        );
      }
    }
  }

  let queryBuilder = Department.findByIdAndUpdate(id, update, { new: true, runValidators: true });
  const populate = headPopulate();
  if (populate) queryBuilder = queryBuilder.populate(populate);
  const dept = await queryBuilder.lean();
  if (!dept) throw AppError.notFound('Không tìm thấy khoa');
  return dept;
}

/**
 * Delete a department and detach every reference to it.
 * Teacher/Student/Course models are looked up lazily so this works before
 * those modules exist and stays correct after they do.
 */
export async function deleteDepartment(id) {
  const dept = await Department.findById(id);
  if (!dept) throw AppError.notFound('Không tìm thấy khoa');

  const models = mongoose.modelNames();
  // Detach department references from any collection that has them.
  if (models.includes('Teacher')) {
    await mongoose
      .model('Teacher')
      .updateMany({ departmentRef: dept._id }, { $set: { departmentRef: null, department: '' } });
  }
  if (models.includes('Student')) {
    await mongoose
      .model('Student')
      .updateMany({ departmentRef: dept._id }, { $set: { departmentRef: null, department: '' } });
  }
  if (models.includes('Course')) {
    await mongoose
      .model('Course')
      .updateMany({ departmentRef: dept._id }, { $set: { departmentRef: null } });
  }
  await Department.deleteOne({ _id: dept._id });

  return { success: true };
}
