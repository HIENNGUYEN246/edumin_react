// API Service - Kết nối backend MongoDB mới
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const API_URL = `${API_BASE_URL}/api`;

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

export function getDefaultAuthData() {
  return {
    users: [
      {
        email: 'admin1@edu.vn',
        password: '123456',
        role: 'dao-tao',
        hoTen: 'Nguyễn Thế Hiển',
      },
    ],
    teachersData: [],
    studentsData: [],
    departmentsData: [
      { id: 'CNTT', name: 'Khoa Công Nghệ Thông Tin' },
      { id: 'NNA', name: 'Khoa Ngôn Ngữ Anh' },
      { id: 'CNTP', name: 'Khoa Công Nghiệp Thực Phẩm' },
    ],
    subjectsData: [],
    openRegistrationsData: [],
    studentRegistrationsData: [],
    assignmentsData: [],
    documentsData: [],
  };
}

class APIClient {
  constructor() {
    this.baseURL = API_URL;
    this._authCache = null;
    this._authRequest = null;
    this._authSaveRequest = null;
  }

  async fetchJson(path, options = {}) {
    const response = await fetch(`${this.baseURL}${path}`, {
      headers: {
        'Content-Type': 'application/json',
      },
      ...options,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text}`);
    }

    return response.json();
  }

  normalizeAuthPayload(payload) {
    if (!payload || typeof payload !== 'object') {
      return getDefaultAuthData();
    }

    // Normalize teacher/student records to be backwards-compatible with older field names
    const normalizePerson = (item) => {
      if (!item || typeof item !== 'object') return item;
      const out = { ...item };
      // prefer modern `name`, but keep `hoTen` for older UI usage
      if (out.name && !out.hoTen) out.hoTen = out.name;
      if (out.hoTen && !out.name) out.name = out.hoTen;
      // ensure avatar exists (empty string is harmless — UI will fallback to ui-avatars)
      if (!Object.prototype.hasOwnProperty.call(out, 'avatar')) out.avatar = '';
      return out;
    };

    const normalizeOpenRegistration = (item) => {
      const normalized = { ...item };
      normalized.courseId = normalized.courseId || '';
      normalized.courseName = normalized.courseName || '';
      normalized.department = normalized.department || '';
      normalized.credits = Number.isFinite(Number(normalized.credits)) ? Number(normalized.credits) : 0;
      normalized.fee = Number.isFinite(Number(normalized.fee)) ? Number(normalized.fee) : 0;
      normalized.studyStart = normalized.studyStart || '';
      normalized.studyEnd = normalized.studyEnd || '';
      normalized.start = normalized.start || '';
      normalized.end = normalized.end || '';
      normalized.schedules = Array.isArray(normalized.schedules) ? normalized.schedules : [];
      normalized.teacherId = Number.isFinite(Number(normalized.teacherId)) ? Number(normalized.teacherId) : null;
      normalized.teacher = normalized.teacher || '';
      normalized.status = normalized.status || 'Đang mở';
      normalized.room = normalized.room || '';
      const legacyId = normalized.id != null ? normalized.id : normalized.regId != null ? normalized.regId : normalized.groupId;
      normalized.id = legacyId != null ? String(legacyId) : '';
      delete normalized.regId;
      delete normalized.groupId;
      return normalized;
    };

    const normalizeStudentRegistration = (item) => {
      if (!item || typeof item !== 'object') return item;
      const normalized = { ...item };
      // Keep only essential fields: regId, studentRef, courseRef, and helper fields for compatibility
      normalized.regId = normalized.regId || '';
      normalized.studentId = Number.isFinite(Number(normalized.studentId)) ? Number(normalized.studentId) : null;
      normalized.courseId = normalized.courseId || '';
      // Keep populated references if available, extract id from them
      if (normalized.studentRef && typeof normalized.studentRef === 'object' && normalized.studentRef.id) {
        normalized.studentId = normalized.studentRef.id;
      }
      if (normalized.courseRef && typeof normalized.courseRef === 'object' && normalized.courseRef.id) {
        normalized.courseId = normalized.courseRef.id;
      }
      return normalized;
    };

    return {
      users: ensureArray(payload.users),
      teachersData: ensureArray(payload.teachersData).map(normalizePerson),
      studentsData: ensureArray(payload.studentsData).map(normalizePerson),
      departmentsData: ensureArray(payload.departmentsData),
      subjectsData: ensureArray(payload.subjectsData),
      openRegistrationsData: ensureArray(payload.openRegistrationsData).map(normalizeOpenRegistration),
      studentRegistrationsData: ensureArray(payload.studentRegistrationsData).map(normalizeStudentRegistration),
      assignmentsData: ensureArray(payload.assignmentsData),
      documentsData: ensureArray(payload.documentsData),
    };
  }

  async getAuthData() {
    try {
      const body = await this.fetchJson('/auth');
      return this.normalizeAuthPayload(body);
    } catch (error) {
      console.error('Error getting auth data:', error);
      throw error;
    }
  }

  async getUsers({ fresh = false } = {}) {
    if (fresh) this.clearAuthCache();
    const { authData } = await this.ensureAuthContext();
    return authData.users;
  }

  async getUsersFresh() {
    return this.getUsers({ fresh: true });
  }

  async saveAuthData(authData) {
    // Clean up student registrations before saving - keep only essential fields
    const cleanedData = {
      ...authData,
      studentRegistrationsData: (authData.studentRegistrationsData || []).map((reg) => {
        const cleaned = {};
        if (reg.regId) cleaned.regId = reg.regId;
        // Frontend sends studentId/courseId, backend expects studentRef/courseRef
        // Keep frontend format (studentId/courseId) so backend can resolve them
        if (reg.studentId != null) cleaned.studentId = reg.studentId;
        if (reg.courseId) cleaned.courseId = reg.courseId;
        if (reg.studentRef) cleaned.studentRef = reg.studentRef;
        if (reg.courseRef) cleaned.courseRef = reg.courseRef;
        return cleaned;
      }),
    };
    const payload = this.normalizeAuthPayload(cleanedData);
    await this.fetchJson('/auth', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    this._authCache = payload;
    return payload;
  }

  async loadOrInitAuthData() {
    try {
      const authData = await this.getAuthData();

      if (!authData.users.length) {
        const defaultData = getDefaultAuthData();
        await this.saveAuthData(defaultData);
        return { authData: defaultData, initialized: true };
      }

      this._authCache = authData;
      return { authData, initialized: false };
    } catch (error) {
      console.error('Error loading auth data:', error);
      throw error;
    }
  }

  async ensureAuthContext() {
    if (this._authCache) {
      return { authData: this._authCache };
    }

    if (!this._authRequest) {
      this._authRequest = this.loadOrInitAuthData()
        .finally(() => {
          this._authRequest = null;
        });
    }

    const result = await this._authRequest;
    return { authData: result.authData };
  }

  clearAuthCache() {
    this._authCache = null;
  }

  async updateAuthCollection(field, value) {
    const operation = (this._authSaveRequest || Promise.resolve())
      .catch(() => undefined)
      .then(async () => {
        // Read the latest complete document so updating one collection cannot
        // overwrite changes made by another screen.
        const latestAuthData = await this.getAuthData();
        return this.saveAuthData({
          ...latestAuthData,
          [field]: ensureArray(value),
        });
      });

    this._authSaveRequest = operation;
    try {
      return await operation;
    } finally {
      if (this._authSaveRequest === operation) {
        this._authSaveRequest = null;
      }
    }
  }

  async getTeachers({ fresh = false } = {}) {
    if (fresh) this.clearAuthCache();
    const { authData } = await this.ensureAuthContext();
    return authData.teachersData;
  }

  async getTeachersFresh() {
    return this.getTeachers({ fresh: true });
  }

  async saveTeachersData(teachers) {
    return this.updateAuthCollection('teachersData', teachers);
  }

  async getStudents({ fresh = false } = {}) {
    if (fresh) this.clearAuthCache();
    const { authData } = await this.ensureAuthContext();
    return authData.studentsData;
  }

  async getStudentsFresh() {
    return this.getStudents({ fresh: true });
  }

  async saveStudentsData(students) {
    return this.updateAuthCollection('studentsData', students);
  }

  async getDepartments({ fresh = false } = {}) {
    if (fresh) this.clearAuthCache();
    const { authData } = await this.ensureAuthContext();
    return authData.departmentsData;
  }

  async getDepartmentsFresh() {
    return this.getDepartments({ fresh: true });
  }

  async saveDepartmentsData(departments) {
    return this.updateAuthCollection('departmentsData', departments);
  }

  async getCourses({ fresh = false } = {}) {
    if (fresh) this.clearAuthCache();
    const { authData } = await this.ensureAuthContext();
    return authData.subjectsData;
  }

  async getCoursesFresh() {
    return this.getCourses({ fresh: true });
  }

  async saveCoursesData(courses) {
    return this.updateAuthCollection('subjectsData', courses);
  }

  async getOpenRegistrations({ fresh = false } = {}) {
    if (fresh) this.clearAuthCache();
    const { authData } = await this.ensureAuthContext();
    return authData.openRegistrationsData;
  }

  async getOpenRegistrationsFresh() {
    return this.getOpenRegistrations({ fresh: true });
  }

  async saveOpenRegistrationsData(registrations) {
    return this.updateAuthCollection('openRegistrationsData', registrations);
  }

  async getStudentRegistrations({ fresh = false } = {}) {
    if (fresh) this.clearAuthCache();
    const { authData } = await this.ensureAuthContext();
    return authData.studentRegistrationsData;
  }

  async getStudentRegistrationsFresh() {
    return this.getStudentRegistrations({ fresh: true });
  }

  async saveStudentRegistrationsData(enrollments) {
    return this.updateAuthCollection('studentRegistrationsData', enrollments);
  }

  async getAssignments({ fresh = false } = {}) {
    if (fresh) this.clearAuthCache();
    const { authData } = await this.ensureAuthContext();
    return authData.assignmentsData;
  }

  async getAssignmentsFresh() {
    return this.getAssignments({ fresh: true });
  }

  async saveAssignmentsData(assignments) {
    return this.updateAuthCollection('assignmentsData', assignments);
  }

  async getDocuments({ fresh = false } = {}) {
    if (fresh) this.clearAuthCache();
    const { authData } = await this.ensureAuthContext();
    return authData.documentsData;
  }

  async getDocumentsFresh() {
    return this.getDocuments({ fresh: true });
  }

  async saveDocumentsData(documents) {
    return this.updateAuthCollection('documentsData', documents);
  }

  async getUsers() {
    const { authData } = await this.ensureAuthContext();
    return authData.users;
  }

  async isAvailable() {
    try {
      await this.fetchJson('/auth');
      return true;
    } catch {
      return false;
    }
  }
}

const apiClient = new APIClient();
export default apiClient;
