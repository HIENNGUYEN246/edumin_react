import { http } from './http.js';
import { qs } from './departmentsApi.js';

export const teachersApi = {
  list: (params) => http.get(`/teachers${qs(params)}`),
  me: () => http.get('/teachers/me'),
  get: (id) => http.get(`/teachers/${id}`),
  create: (payload) => http.post('/teachers', payload),
  update: (id, payload) => http.patch(`/teachers/${id}`, payload),
  remove: (id) => http.delete(`/teachers/${id}`),
  importRows: (rows) => http.post('/teachers/import', { rows }),
  uploadAvatar: (id, file) => {
    const form = new FormData();
    form.append('file', file);
    return http.put(`/teachers/${id}/avatar`, form);
  },
};

export default teachersApi;
