import apiClient from './api';

const assignmentAPI = {
  async getAllAssignments({ fresh = false } = {}) {
    return fresh ? await apiClient.getAssignmentsFresh() : await apiClient.getAssignments();
  },

  async saveAllAssignments(assignments) {
    await apiClient.saveAssignmentsData(assignments);
    return assignments;
  },
};

export default assignmentAPI;
