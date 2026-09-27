import apiClient from './api';

const courseAPI = {
  async getAllCourses({ fresh = false } = {}) {
    return fresh ? await apiClient.getCoursesFresh() : await apiClient.getCourses();
  },

  async saveAllCourses(courses) {
    await apiClient.saveCoursesData(courses);
    return courses;
  },
};

export default courseAPI;
