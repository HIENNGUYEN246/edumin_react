import apiClient from './api';
import { normalizeTeacher } from '../utils/teacherUtils';

const ensureArray = (value) => (Array.isArray(value) ? value : []);

const teacherAPI = {
  async getAllTeachers({ fresh = false } = {}) {
    const list = fresh
      ? await apiClient.getTeachersFresh()
      : await apiClient.getTeachers();
    return list.map(normalizeTeacher).filter(Boolean);
  },

  async saveAllTeachers(teachers) {
    await apiClient.saveTeachersData(teachers);
    return teachers;
  },

  async updateTeacherPassword(email, newPassword) {
    const emailKey = email?.trim().toLowerCase();
    if (!emailKey) {
      throw new Error('Email không hợp lệ');
    }

    const authData = await apiClient.getAuthData();
    const users = ensureArray(authData.users);
    const teachers = ensureArray(authData.teachersData);

    const userIndex = users.findIndex((u) => u.email?.trim().toLowerCase() === emailKey);
    if (userIndex === -1) {
      throw new Error('Không tìm thấy tài khoản giáo viên');
    }

    const teacherIndex = teachers.findIndex((t) => t.email?.trim().toLowerCase() === emailKey);

    const updatedUsers = users.map((u, i) =>
      i === userIndex ? { ...u, password: newPassword } : u
    );
    const updatedTeachers = teachers.map((t, i) =>
      i === teacherIndex ? { ...t, password: newPassword } : t
    );

    await apiClient.updateAuthCollections({
      users: updatedUsers,
      teachersData: updatedTeachers,
    });

    return updatedTeachers[teacherIndex] || updatedUsers[userIndex];
  },
};

export default teacherAPI;
