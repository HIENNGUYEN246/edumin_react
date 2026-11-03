import { http } from './http.js';

const qs = (params) => {
  const search = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') search.set(k, v);
  });
  const str = search.toString();
  return str ? `?${str}` : '';
};

export const chatApi = {
  getChannels: () => http.get('/chat/channels'),
  getContacts: (params) => http.get(`/chat/contacts${qs(params)}`),
  getMessages: (params) => http.get(`/chat/messages${qs(params)}`),
  sendMessage: (payload) => http.post('/chat/messages', payload),
};

export default chatApi;

