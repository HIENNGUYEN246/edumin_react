import { http } from './http.js';
import { qs } from './departmentsApi.js';

export const feedbackApi = {
  list: (params) => http.get(`/feedbacks${qs(params)}`),
  submit: (payload) => http.post('/feedbacks', payload),
  respond: (id, response) => http.post(`/feedbacks/${id}/reply`, { response }),
  remove: (id) => http.delete(`/feedbacks/${id}`),
};

export default feedbackApi;

