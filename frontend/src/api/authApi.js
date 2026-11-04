import { http, tokenStore } from './http.js';

export const authApi = {
  async login(email, password) {
    const result = await http.post('/auth/login', { email, password });
    const token = result?.token || result?.data?.token;
    if (token) tokenStore.set(token);
    return result;
  },
  me() {
    return http.get('/auth/me');
  },
  async changePassword({ oldPassword, newPassword }) {
    return http.patch('/auth/me/password', { oldPassword, newPassword });
  },
  registrationOptions() {
    return http.get('/auth/registration-options');
  },
  updateAvatar(file) {
    const form = new FormData();
    form.append('file', file);
    return http.put('/auth/me/avatar', form);
  },
  updateProfile(data) {
    return http.put('/auth/me/profile', data);
  },
  async register(payload) {
    const result = await http.post('/auth/register', payload);
    const regToken = result?.token || result?.data?.token;
    if (regToken) tokenStore.set(regToken);
    return result;
  },
  forgotPassword(payload) {
    return http.post('/auth/forgot-password', payload);
  },
  logout() {
    tokenStore.clear();
  },
};

export default authApi;
