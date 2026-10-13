import { http } from './http.js';
import { qs } from './departmentsApi.js';

export const profileRequestsApi = {
  list: (params) => http.get(`/profile-requests${qs(params)}`),
  myLatest: () => http.get('/profile-requests/my-latest'),
  approve: (id) => http.put(`/profile-requests/${id}/approve`),
  reject: (id, reason) => http.put(`/profile-requests/${id}/reject`, { reason }),
  bulkApprove: (ids) => http.post('/profile-requests/bulk-approve', { ids }),
  bulkReject: (ids, reason) => http.post('/profile-requests/bulk-reject', { ids, reason }),
  bulkDelete: (ids) => http.post('/profile-requests/bulk-delete', { ids }),
  getAiCriteria: () => http.get('/ai/admin-criteria'),
  setAiCriteria: (rawCriteriaText) => http.post('/ai/admin-criteria', { rawCriteriaText }),
  clearAiCriteria: () => http.delete('/ai/admin-criteria'),
};

export default profileRequestsApi;

