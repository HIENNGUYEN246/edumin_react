import apiClient from './api';

const assignmentAPI = {
  async getAllAssignments({ fresh = false } = {}) {
    return fresh ? await apiClient.getAssignmentsFresh() : await apiClient.getAssignments();
  },

  async saveAllAssignments(assignments, options = {}) {
    await apiClient.saveAssignmentsData(assignments, options);
    return assignments;
  },
};

export default assignmentAPI;
