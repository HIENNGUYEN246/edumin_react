import { http } from './http.js';
import { qs } from './departmentsApi.js';

export const coursesApi = {
  list: (params) => http.get(`/courses${qs(params)}`),
  create: (payload) => http.post('/courses', payload),
  update: (id, payload) => http.patch(`/courses/${id}`, payload),
  remove: (id) => http.delete(`/courses/${id}`),
  importRows: (rows) => http.post('/courses/import', { rows }),
};

export default coursesApi;
