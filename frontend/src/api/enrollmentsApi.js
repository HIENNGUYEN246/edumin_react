import { http } from './http.js';

export const enrollmentsApi = {
  mine: () => http.get('/enrollments/me'),
  enroll: (classId) => http.post('/enrollments', { classId }),
  cancel: (classId) => http.delete(`/enrollments/${classId}`),
};

export default enrollmentsApi;
