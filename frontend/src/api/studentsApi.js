import { http } from './http.js';
import { qs } from './departmentsApi.js';

function extractId(idOrEntity) {
  if (!idOrEntity) return '';
  if (typeof idOrEntity === 'object') {
    return String(idOrEntity._id || idOrEntity.id || '').trim();
  }
  return String(idOrEntity).trim();
}

export const studentsApi = {
  list: (params) => http.get(`/students${qs(params)}`),
  get: (id) => http.get(`/students/${encodeURIComponent(extractId(id))}`),
  create: (payload) => http.post('/students', payload),
  update: (id, payload) => http.patch(`/students/${encodeURIComponent(extractId(id))}`, payload),
  remove: (id) => http.delete(`/students/${encodeURIComponent(extractId(id))}`),
  bulkDelete: (ids) => http.post('/students/bulk-delete', { ids }),
  importRows: (rows) => http.post('/students/import', { rows }),
  uploadAvatar: (idOrEntity, file) => {
    const id = extractId(idOrEntity);
    const form = new FormData();
    form.append('file', file);
    if (id) {
      form.append('id', id);
      form.append('_id', id);
    }
    return http.put(`/students/${encodeURIComponent(id)}/avatar`, form);
  },
};

export default studentsApi;
