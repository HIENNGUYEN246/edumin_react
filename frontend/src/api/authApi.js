import { http, tokenStore } from './http.js';

export const authApi = {
  async login(email, password) {
    const result = await http.post('/auth/login', { email, password });
    if (result?.token) tokenStore.set(result.token);
    return result;
  },
  me() {
    return http.get('/auth/me');
  },
  async changePassword({ oldPassword, newPassword }) {
    const result = await http.patch('/auth/me/password', { oldPassword, newPassword });
    if (result?.token) tokenStore.set(result.token);
    return result;
  },
  registrationOptions() {
    return http.get('/auth/registration-options');
  },
  updateAvatar(file) {
    const form = new FormData();
    form.append('file', file);
    return http.put('/auth/me/avatar', form);
  },
  async register(payload) {
    const result = await http.post('/auth/register', payload);
    if (result?.token) tokenStore.set(result.token);
    return result;
  },
  logout() {
    tokenStore.clear();
  },
};

export default authApi;
