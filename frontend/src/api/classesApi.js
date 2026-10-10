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
  updateStudentGrades: (classId, studentId, grades, reason) =>
    http.patch(`/classes/${classId}/students/${studentId}/grades`, { grades, reason }),
  adminGradebookOverview: (params) => http.get(`/classes/admin/gradebook-overview${qs(params)}`),
  toggleGradeLock: (classId, payload) => http.patch(`/classes/${classId}/grade-lock`, payload),
  lockAllGrades: (payload) => http.post('/classes/admin/lock-all-grades', payload),
  auditLogs: (classId) => http.get(`/classes/${classId}/audit-logs`),
  allAuditLogs: () => http.get('/classes/audit-logs/all'),
  updateGradeConfig: (classId, config) =>
    http.patch(`/classes/${classId}/grade-config`, config),
  studentGroups: () => http.get('/classes/student-groups'),
  nextCode: (courseId) => http.get(`/classes/next-code${courseId ? `?courseId=${encodeURIComponent(courseId)}` : ''}`),
};

export const CLASS_STATUSES = ['Nháp', 'Đang mở', 'Đã đóng', 'Đã hủy'];

export default classesApi;
