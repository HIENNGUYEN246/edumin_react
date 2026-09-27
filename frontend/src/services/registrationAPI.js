import apiClient from './api';

const registrationAPI = {
  async getOpenRegistrations({ fresh = false } = {}) {
    return fresh
      ? await apiClient.getOpenRegistrationsFresh()
      : await apiClient.getOpenRegistrations();
  },

  async saveOpenRegistrations(registrations) {
    await apiClient.saveOpenRegistrationsData(registrations);
    return registrations;
  },

  async getStudentRegistrations({ fresh = false } = {}) {
    return fresh
      ? await apiClient.getStudentRegistrationsFresh()
      : await apiClient.getStudentRegistrations();
  },

  async saveStudentRegistrations(enrollments) {
    await apiClient.saveStudentRegistrationsData(enrollments);
    return enrollments;
  },
};

export default registrationAPI;
