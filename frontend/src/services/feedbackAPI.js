import apiClient, { getDefaultFeedbacksData } from './api';

const feedbackAPI = {
  async getFeedbacks(params = {}) {
    return apiClient.getFeedbacks(params);
  },

  async submitFeedback(payload) {
    return apiClient.submitFeedback(payload);
  },

  async respondFeedback(id, response) {
    return apiClient.respondFeedback(id, response);
  },

  async deleteFeedback(id) {
    return apiClient.deleteFeedback(id);
  },

  async resetSeedFeedbacks() {
    try {
      const res = await apiClient.fetchJson('/feedbacks/seed', { method: 'POST' });
      if (res && res.list) {
        apiClient.saveStoredFeedbacks(res.list);
        window.dispatchEvent(new CustomEvent('edumin_feedback_updated'));
      }
      return res;
    } catch {
      const def = getDefaultFeedbacksData();
      apiClient.saveStoredFeedbacks(def);
      window.dispatchEvent(new CustomEvent('edumin_feedback_updated'));
      return { success: true, list: def };
    }
  },
};

export default feedbackAPI;
