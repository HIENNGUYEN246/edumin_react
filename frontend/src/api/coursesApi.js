import { http } from './http.js';
import { qs } from './departmentsApi.js';

export const coursesApi = {
  list: (params) => http.get(`/courses${qs(params)}`),
  get: (id) => http.get(`/courses/${id}`),
  create: (payload) => http.post('/courses', payload),
  update: (id, payload) => http.patch(`/courses/${id}`, payload),
  remove: (id) => http.delete(`/courses/${id}`),
  bulkDelete: (ids) => http.post('/courses/bulk-delete', { ids }),
  importRows: (rows) => http.post('/courses/import', { rows }),
};

export default coursesApi;
