import { http } from './http.js';
import { qs } from './departmentsApi.js';

export const notificationsApi = {
  list: (params) => http.get(`/notifications${qs(params)}`),
  markRead: (id) => http.patch(`/notifications/${id}/read`),
  markAllRead: () => http.patch('/notifications/mark-all-read'),
  remove: (id) => http.delete(`/notifications/${id}`),
  bulkDelete: (ids) => http.post('/notifications/bulk-delete', { ids }),
};

export default notificationsApi;
