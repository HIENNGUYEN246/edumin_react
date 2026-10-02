import { http } from './http.js';
import { qs } from './departmentsApi.js';

function extractId(idOrEntity) {
  if (!idOrEntity) return '';
  if (typeof idOrEntity === 'object') {
    return String(idOrEntity._id || idOrEntity.id || '').trim();
  }
  return String(idOrEntity).trim();
}

export const teachersApi = {
  list: (params) => http.get(`/teachers${qs(params)}`),
  me: () => http.get('/teachers/me'),
  get: (id) => http.get(`/teachers/${encodeURIComponent(extractId(id))}`),
  create: (payload) => http.post('/teachers', payload),
  update: (id, payload) => http.patch(`/teachers/${encodeURIComponent(extractId(id))}`, payload),
  remove: (id) => http.delete(`/teachers/${encodeURIComponent(extractId(id))}`),
  bulkDelete: (ids) => http.post('/teachers/bulk-delete', { ids }),
  importRows: (rows) => http.post('/teachers/import', { rows }),
  uploadAvatar: (idOrEntity, file) => {
    const id = extractId(idOrEntity);
    const form = new FormData();
    form.append('file', file);
    if (id) {
      form.append('id', id);
      form.append('_id', id);
    }
    return http.put(`/teachers/${encodeURIComponent(id)}/avatar`, form);
  },
};

export default teachersApi;
