import { http } from './http.js';
import { qs } from './departmentsApi.js';

export const classesApi = {
  list: (params) => http.get(`/classes${qs(params)}`),
  listOpen: () => http.get('/classes/open'),
  byCourse: (courseId) => http.get(`/classes/by-course/${courseId}`),
  get: (id) => http.get(`/classes/${id}`),
  create: (payload) => http.post('/classes', payload),
  update: (id, payload) => http.patch(`/classes/${id}`, payload),
  changeStatus: (id, status) => http.patch(`/classes/${id}/status`, { status }),
  remove: (id) => http.delete(`/classes/${id}`),
  students: (id) => http.get(`/classes/${id}/students`),
  studentGroups: () => http.get('/classes/student-groups'),
  nextCode: (courseId) => http.get(`/classes/next-code${courseId ? `?courseId=${encodeURIComponent(courseId)}` : ''}`),
};

export const CLASS_STATUSES = ['Nháp', 'Đang mở', 'Đã đóng', 'Đã hủy'];

export default classesApi;
