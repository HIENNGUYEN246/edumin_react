import { http, API_URL, tokenStore } from './http.js';
import { qs } from './departmentsApi.js';

export const documentsApi = {
  list: (params) => http.get(`/documents${qs(params)}`),
  getById: (id) => http.get(`/documents/${id}`),
  getFileUrl: (id, { download = false } = {}) => {
    const token = tokenStore.get();
    const tokenParam = token ? `token=${encodeURIComponent(token)}` : '';
    const dlParam = download ? 'download=1' : '';
    const query = [tokenParam, dlParam].filter(Boolean).join('&');
    return `${API_URL}/documents/${id}/file${query ? `?${query}` : ''}`;
  },
  create: ({ courseId, classId, name, status, file, files, link }) => {
    const form = new FormData();
    form.append('courseId', courseId);
    if (classId) form.append('classId', classId);
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
  update: (id, payload) => {
    if (payload instanceof FormData) {
      return http.patch(`/documents/${id}`, payload);
    }
    const { file, files, ...rest } = payload || {};
    if (file || (files && files.length)) {
      const form = new FormData();
      Object.entries(rest).forEach(([k, v]) => {
        if (v !== undefined && v !== null) form.append(k, v);
      });
      if (file) form.append('file', file);
      if (files && files.length) {
        for (const f of files) {
          form.append('files', f);
        }
      }
      return http.patch(`/documents/${id}`, form);
    }
    return http.patch(`/documents/${id}`, payload);
  },
  remove: (id) => http.delete(`/documents/${id}`),
  download: (id) => http.get(`/documents/${id}/download`),
  summarize: (id, payload) => http.post(`/documents/${id}/summarize`, payload),
  generateQuiz: (id, payload) => http.post(`/documents/${id}/generate-quiz`, payload),
  studyQuery: (payload) => http.post('/documents/study/query', payload),
};

export default documentsApi;
