import { http } from './http.js';

export const statsApi = {
  overview: () => http.get('/stats/overview'),
};

export default statsApi;
