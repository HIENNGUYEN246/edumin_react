import apiClient from './api';
import { normalizeStudent } from '../utils/studentUtils';

const studentAPI = {
  async getAllStudents({ fresh = false } = {}) {
    const list = fresh ? await apiClient.getStudentsFresh() : await apiClient.getStudents();
    return list.map(normalizeStudent).filter(Boolean);
  },

  async saveAllStudents(students) {
    await apiClient.saveStudentsData(students);
    return students;
  },

  async updateStudentPassword(email, newPassword) {
    const emailKey = email?.trim().toLowerCase();
    if (!emailKey) {
      throw new Error('Email không hợp lệ');
    }

    const students = await this.getAllStudents({ fresh: true });
    const index = students.findIndex((s) => s.email?.trim().toLowerCase() === emailKey);
    if (index === -1) {
      throw new Error('Không tìm thấy tài khoản sinh viên');
    }

    const updated = students.map((s, i) =>
      i === index ? { ...s, password: newPassword } : s
    );
    await this.saveAllStudents(updated);
    return updated[index];
  },
};

export default studentAPI;
