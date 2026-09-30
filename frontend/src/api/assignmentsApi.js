import { http } from './http.js';
import { qs } from './departmentsApi.js';

export const assignmentsApi = {
  list: (params) => http.get(`/assignments${qs(params)}`),
  create: (payload) => http.post('/assignments', payload),
  update: (id, payload) => http.patch(`/assignments/${id}`, payload),
  remove: (id) => http.delete(`/assignments/${id}`),
  submissions: (id) => http.get(`/assignments/${id}/submissions`),
  submit: (id, answers) => http.post(`/assignments/${id}/submissions`, { answers }),
  mySubmission: (id) => http.get(`/assignments/${id}/my-submission`),
};

export default assignmentsApi;
