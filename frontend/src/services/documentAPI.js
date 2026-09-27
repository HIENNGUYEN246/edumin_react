import apiClient from './api';

const documentAPI = {
  async getAllDocuments({ fresh = false } = {}) {
    return fresh ? await apiClient.getDocumentsFresh() : await apiClient.getDocuments();
  },

  async saveAllDocuments(documents) {
    await apiClient.saveDocumentsData(documents);
    return documents;
  },
};

export default documentAPI;
