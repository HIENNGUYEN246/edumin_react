import mongoose from 'mongoose';
import { AppError } from '../../lib/AppError.js';
import { hashPassword } from '../../lib/password.js';
import { nextSequence } from '../../lib/counters.js';
import { User } from '../auth/user.model.js';
import { Department } from '../departments/department.model.js';

/** Resolve a department by id or name to its document (or null). */
export async function resolveDepartment({ departmentId, department, departmentRef } = {}) {
  if (!departmentId && !department && !departmentRef) return null;
  const or = [];
  if (departmentId) {
    or.push({ id: departmentId });
    if (mongoose.Types.ObjectId.isValid(departmentId)) {
      or.push({ _id: departmentId });
    }
  }
  if (departmentRef && mongoose.Types.ObjectId.isValid(departmentRef)) {
    or.push({ _id: departmentRef });
  }
  if (department) {
    or.push({ name: department }, { id: department });
  }
  return Department.findOne({ $or: or });
}

/**
 * Create a User account plus its role profile (Teacher/Student) sequentially.
 * On any failure after user creation, cleans up any created user account so no orphan remains.
 *
 * @param {object} params
 * @param {'giao-vien'|'sinh-vien'} params.role
 * @param {import('mongoose').Model} params.ProfileModel
 * @param {string} params.counterKey  e.g. 'teacherId'
 * @param {'teacher'|'student'} params.userLink  field on User pointing to profile
 * @param {object} params.profileData
 * @param {string} params.password
 */
export async function createPersonWithAccount({
  role,
  ProfileModel,
  counterKey,
  userLink,
  profileData,
  password,
  precomputedPasswordHash,
  profileId,
}) {
  const email = String(profileData.email || '').trim().toLowerCase();
  if (!email) throw AppError.badRequest('Email là bắt buộc');

  const existing = await User.findOne({ email });
  if (existing) throw AppError.conflict('Email đã được sử dụng');

  let user = null;
  try {
    const passwordHash = precomputedPasswordHash || (await hashPassword(password || '123'));
    user = await User.create({
      email,
      passwordHash,
      role,
      hoTen: profileData.hoTen || '',
      status: 'Active',
    });

    const nextId = await nextSequence(counterKey, { model: ProfileModel, field: 'id' });
    const dept = await resolveDepartment(profileData);

    const profile = await ProfileModel.create({
      ...profileData,
      email,
      id: profileId ?? nextId,
      userId: user._id,
      department: dept?.name || profileData.department || '',
      departmentRef: dept?._id || null,
    });

    user[userLink] = profile._id;
    await user.save();

    return { user, profile };
  } catch (err) {
    if (user?._id) {
      await User.deleteOne({ _id: user._id }).catch(() => {});
    }
    throw err;
  }
}
