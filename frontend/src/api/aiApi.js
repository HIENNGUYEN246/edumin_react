import { http } from './http.js';

export const aiApi = {
  /**
   * Send natural language prompt to AI assistant with contextual path
   * @param {string} message
   * @param {object} [context]
   */
  query: (message, context = {}) =>
    http.post('/ai/query', {
      message,
      currentPath: typeof context === 'string' ? context : (context?.currentPath || ''),
    }),

  /**
   * Fetch contextual query suggestion chips based on the user's role
   */
  suggestions: () => http.get('/ai/suggestions'),
};

export default aiApi;

