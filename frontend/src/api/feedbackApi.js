import { http } from './http.js';
import { qs } from './departmentsApi.js';

export const feedbackApi = {
  list: (params) => http.get(`/feedbacks${qs(params)}`),
  submit: (payload) => http.post('/feedbacks', payload),
  respond: (id, response) => http.post(`/feedbacks/${id}/reply`, { response }),
  remove: (id) => http.delete(`/feedbacks/${id}`),
  bulkDelete: (ids) => http.post('/feedbacks/bulk-delete', { ids }),
};

export default feedbackApi;

