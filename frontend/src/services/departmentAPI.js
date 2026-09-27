import apiClient from './api';

const departmentAPI = {
  async getAllDepartments({ fresh = false } = {}) {
    return fresh ? await apiClient.getDepartmentsFresh() : await apiClient.getDepartments();
  },

  async saveAllDepartments(departments) {
    await apiClient.saveDepartmentsData(departments);
    return departments;
  },
};

export default departmentAPI;
