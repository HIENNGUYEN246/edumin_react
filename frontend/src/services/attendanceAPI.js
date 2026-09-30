import apiClient from './api';

const attendanceAPI = {
  async getAllAttendances(params = {}) {
    return apiClient.getAttendances(params);
  },

  async checkIn(payload) {
    return apiClient.checkInAttendance(payload);
  },

  async recordAndEvaluate(payload) {
    return apiClient.recordAndEvaluateAttendance(payload);
  },

  async saveBulk(payload) {
    return apiClient.saveBulkAttendance(payload);
  },

  async getByStudent(studentId) {
    return apiClient.getAttendanceByStudent(studentId);
  },

  async deleteAttendance(id) {
    return apiClient.fetchJson(`/attendance/${id}`, {
      method: 'DELETE',
    });
  },
};

export default attendanceAPI;
