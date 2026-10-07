import { http } from './http.js';

const qs = (params) => {
  const search = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') search.set(k, v);
  });
  const str = search.toString();
  return str ? `?${str}` : '';
};

export const departmentsApi = {
  list: (params) => http.get(`/departments${qs(params)}`),
  create: (payload) => http.post('/departments', payload),
  update: (id, payload) => http.patch(`/departments/${id}`, payload),
  remove: (id) => http.delete(`/departments/${id}`),
  bulkDelete: (ids) => http.post('/departments/bulk-delete', { ids }),
};


export { qs };
export default departmentsApi;
