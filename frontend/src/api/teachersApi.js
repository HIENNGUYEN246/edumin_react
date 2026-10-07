import { http } from './http.js';
import { qs } from './departmentsApi.js';

export const TEACHER_EDUCATION_LEVELS = [
  { value: 'Thạc sĩ', label: 'Thạc sĩ (ThS)' },
  { value: 'Tiến sĩ', label: 'Tiến sĩ (TS / Ph.D)' },
  { value: 'Phó Giáo sư - Tiến sĩ', label: 'Phó Giáo sư - Tiến sĩ (PGS.TS)' },
  { value: 'Giáo sư - Tiến sĩ', label: 'Giáo sư - Tiến sĩ (GS.TS)' },
  { value: 'Tiến sĩ Khoa học', label: 'Tiến sĩ Khoa học (TSKH)' },
  { value: 'Cử nhân', label: 'Cử nhân (Đại học)' },
  { value: 'Kỹ sư', label: 'Kỹ sư (Đại học)' },
  { value: 'Bác sĩ chuyên khoa', label: 'Bác sĩ chuyên khoa (BS.CK)' },
];

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
  bulkRemove: (ids) => http.post('/teachers/bulk-delete', { ids }),
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
