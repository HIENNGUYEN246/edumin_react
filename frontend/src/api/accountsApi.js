import { http } from './http.js';
import { qs } from './departmentsApi.js';

export const accountsApi = {
  list: (params) => http.get(`/accounts${qs(params)}`),
  updateStatus: (id, payload) => http.patch(`/accounts/${id}/status`, payload),
  resetPassword: (id) => http.post(`/accounts/${id}/reset-password`),
  remove: (id) => http.delete(`/accounts/${id}`),
  bulkDelete: (ids) => http.post('/accounts/bulk-delete', { ids }),
};

export default accountsApi;
