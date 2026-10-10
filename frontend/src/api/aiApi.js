import { http } from './http.js';

export const aiApi = {
  /**
   * Send natural language prompt to AI assistant
   * @param {string} message
   */
  query: (message) => http.post('/ai/query', { message }),

  /**
   * Fetch contextual query suggestion chips based on the user's role
   */
  suggestions: () => http.get('/ai/suggestions'),
};

export default aiApi;

