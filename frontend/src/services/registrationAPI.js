import apiClient from './api';

const registrationAPI = {
  async getOpenRegistrations({ fresh = false } = {}) {
    return fresh
      ? await apiClient.getOpenRegistrationsFresh()
      : await apiClient.getOpenRegistrations();
  },

  async saveOpenRegistrations(registrations, options = {}) {
    await apiClient.saveOpenRegistrationsData(registrations, options);
    return registrations;
  },

  async getStudentRegistrations({ fresh = false } = {}) {
    return fresh
      ? await apiClient.getStudentRegistrationsFresh()
      : await apiClient.getStudentRegistrations();
  },

  async saveStudentRegistrations(enrollments, options = {}) {
    await apiClient.saveStudentRegistrationsData(enrollments, options);
    return enrollments;
  },
};

export default registrationAPI;
