import { http } from './http.js';
import { qs } from './departmentsApi.js';

export const documentsApi = {
  list: (params) => http.get(`/documents${qs(params)}`),
  create: ({ courseId, name, status, file, files, link }) => {
    const form = new FormData();
    form.append('courseId', courseId);
    if (name) form.append('name', name);
    if (status) form.append('status', status);
    if (link) form.append('link', link);
    if (file) form.append('file', file);
    if (files && files.length) {
      for (const f of files) {
        form.append('files', f);
      }
    }
    return http.post('/documents', form);
  },
  update: (id, payload) => http.patch(`/documents/${id}`, payload),
  remove: (id) => http.delete(`/documents/${id}`),
  download: (id) => http.get(`/documents/${id}/download`),
};

export default documentsApi;
