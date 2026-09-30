import { http } from './http.js';
import { qs } from './departmentsApi.js';

export const studentsApi = {
  list: (params) => http.get(`/students${qs(params)}`),
  get: (id) => http.get(`/students/${id}`),
  create: (payload) => http.post('/students', payload),
  update: (id, payload) => http.patch(`/students/${id}`, payload),
  remove: (id) => http.delete(`/students/${id}`),
  importRows: (rows) => http.post('/students/import', { rows }),
  uploadAvatar: (id, file) => {
    const form = new FormData();
    form.append('file', file);
    return http.put(`/students/${id}/avatar`, form);
  },
};

export default studentsApi;
