import { http } from './http.js';
import { qs } from './departmentsApi.js';

export const tuitionApi = {
  list: (params) => http.get(`/tuition${qs(params)}`),
  stats: (params) => http.get(`/tuition/stats${qs(params)}`),
  get: (id) => http.get(`/tuition/${encodeURIComponent(id)}`),
  classes: () => http.get('/tuition/classes'),
  semesters: () => http.get('/tuition/semesters'),
  recordPayment: (id, payload) => http.post(`/tuition/${encodeURIComponent(id)}/pay`, payload),
  bulkStatus: (payload) => http.post('/tuition/bulk-status', payload),
  importRows: (rows) => http.post('/tuition/import', { rows }),
  generate: (payload) => http.post('/tuition/generate', typeof payload === 'string' ? { semester: payload } : payload),
  myTuition: () => http.get('/tuition/me'),
};

export default tuitionApi;
