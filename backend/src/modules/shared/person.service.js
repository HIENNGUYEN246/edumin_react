import mongoose from 'mongoose';
import { AppError } from '../../lib/AppError.js';
import { hashPassword } from '../../lib/password.js';
import { nextSequence } from '../../lib/counters.js';
import { User } from '../auth/user.model.js';
import { Department } from '../departments/department.model.js';

/** Resolve a department by id or name to its document (or null). */
export async function resolveDepartment({ departmentId, department } = {}) {
  if (!departmentId && !department) return null;
  const or = [];
  if (departmentId) or.push({ id: departmentId });
  if (department) or.push({ name: department });
  return Department.findOne({ $or: or });
}

/**
 * Create a User account plus its role profile (Teacher/Student) sequentially.
 * On any failure after user creation, the user is deleted so no orphan account remains.
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
}) {
  const email = String(profileData.email || '').trim().toLowerCase();
  if (!email) throw AppError.badRequest('Email là bắt buộc');

  const existing = await User.findOne({ email });
  if (existing) throw AppError.conflict('Email đã được sử dụng');

  const passwordHash = await hashPassword(password || '123');
  const user = await User.create({
    email,
    passwordHash,
    role,
    hoTen: profileData.hoTen || '',
    status: 'Active',
  });

  try {
    const nextId = await nextSequence(counterKey, null, { model: ProfileModel, field: 'id' });
    const dept = await resolveDepartment(profileData);

    const profile = await ProfileModel.create({
      ...profileData,
      email,
      id: nextId,
      userId: user._id,
      department: dept?.name || profileData.department || '',
      departmentRef: dept?._id || null,
    });

    user[userLink] = profile._id;
    await user.save();
    return { user, profile };
  } catch (err) {
    // Manual rollback: delete the created user so no orphan account remains
    await User.deleteOne({ _id: user._id }).catch(() => {});
    throw err;
  }
}
