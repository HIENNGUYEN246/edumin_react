import { http } from './http.js';
import { qs } from './departmentsApi.js';

export const attendanceApi = {
  getAll: (params) => http.get(`/attendance${qs(params)}`),
  checkIn: (payload) => http.post('/attendance/check-in', payload),
  recordAndEvaluate: (payload) => http.post('/attendance/record', payload),
  saveBulk: (payload) => http.post('/attendance/bulk', payload),
  getByStudent: (studentId) => http.get(`/attendance/student/${studentId}`),
  remove: (id) => http.delete(`/attendance/${id}`),
};

export default attendanceApi;

