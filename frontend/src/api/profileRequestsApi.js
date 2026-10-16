import { http } from './http.js';
import { qs } from './departmentsApi.js';

export const profileRequestsApi = {
  list: (params) => http.get(`/admin/requests${qs(params)}`).catch(() => http.get(`/profile-requests${qs(params)}`)),
  myLatest: () => http.get('/profile-requests/my-latest'),
  approve: (id) => http.put(`/admin/requests/${id}/approve`).catch(() => http.put(`/profile-requests/${id}/approve`)),
  reject: (id, reason) => http.put(`/admin/requests/${id}/reject`, { reason }).catch(() => http.put(`/profile-requests/${id}/reject`, { reason })),
  bulkApprove: (ids) => http.post('/admin/requests/bulk-approve', { ids }).catch(() => http.post('/profile-requests/bulk-approve', { ids })),
  bulkReject: (ids, reason) => http.post('/admin/requests/bulk-reject', { ids, reason }).catch(() => http.post('/profile-requests/bulk-reject', { ids, reason })),
  bulkDelete: (ids) => http.post('/admin/requests/bulk-delete', { ids }).catch(() => http.post('/profile-requests/bulk-delete', { ids })),
  getAiCriteria: () => http.get('/ai/admin-criteria'),
  setAiCriteria: (rawCriteriaText) => http.post('/ai/admin-criteria', { rawCriteriaText }),
  clearAiCriteria: () => http.delete('/ai/admin-criteria'),
};

export default profileRequestsApi;

