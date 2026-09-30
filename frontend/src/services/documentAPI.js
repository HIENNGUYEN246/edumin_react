import apiClient from './api';

const documentAPI = {
  async getAllDocuments({ fresh = false } = {}) {
    return fresh ? await apiClient.getDocumentsFresh() : await apiClient.getDocuments();
  },

  async saveAllDocuments(documents, options = {}) {
    await apiClient.saveDocumentsData(documents, options);
    return documents;
  },
};

export default documentAPI;
