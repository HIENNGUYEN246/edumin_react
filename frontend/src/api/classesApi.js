import { http } from './http.js';
import { qs } from './departmentsApi.js';

export const classesApi = {
  list: (params) => http.get(`/classes${qs(params)}`),
  listOpen: () => http.get('/classes/open'),
  get: (id) => http.get(`/classes/${id}`),
  create: (payload) => http.post('/classes', payload),
  update: (id, payload) => http.patch(`/classes/${id}`, payload),
  remove: (id) => http.delete(`/classes/${id}`),
  students: (id) => http.get(`/classes/${id}/students`),
};

export default classesApi;
