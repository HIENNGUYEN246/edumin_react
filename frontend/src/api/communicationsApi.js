import { http } from './http.js';
import { qs } from './departmentsApi.js';

export const communicationsApi = {
  recipients: (params) => http.get(`/communications/recipients${qs(params)}`),
  sendAccountCredentials: (recipients) =>
    http.post('/communications/account-credentials', { recipients }),
};

export default communicationsApi;
