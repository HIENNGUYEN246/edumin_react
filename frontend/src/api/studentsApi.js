import { http } from './http.js';
import { qs } from './departmentsApi.js';

export const STUDENT_EDUCATION_LEVELS = [
  { value: 'Chính quy', label: 'Đại học Chính quy' },
  { value: 'Chất lượng cao', label: 'Chương trình Chất lượng cao' },
  { value: 'Liên thông', label: 'Liên thông Đại học' },
  { value: 'Vừa làm vừa học', label: 'Vừa làm vừa học (Tại chức)' },
  { value: 'Đào tạo từ xa', label: 'Đào tạo từ xa (E-Learning)' },
  { value: 'Văn bằng 2', label: 'Văn bằng 2 Chính quy' },
  { value: 'Liên kết quốc tế', label: 'Chương trình Quốc tế / Liên kết' },
];

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
  bulkRemove: (ids) => http.post('/students/bulk-delete', { ids }),
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
  classes: () => http.get('/students/classes'),
};

export default studentsApi;
