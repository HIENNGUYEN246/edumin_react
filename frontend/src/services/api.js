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

  async login(email, password) {
    return this.fetchJson('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async getAccountStatus(email, role) {
    const query = new URLSearchParams({ email: email || '', role: role || '' });
    const result = await this.fetchJson(`/auth/status?${query.toString()}`);
    return result.account || null;
  }

  async getUsers({ fresh = false } = {}) {
    const { authData } = await this.ensureAuthContext({ fresh });
    return authData.users;
  }

  async getUsersFresh() {
    return this.getUsers({ fresh: true });
  }

  async saveAuthData(authData) {
    const cleanedData = {
      ...authData,
      studentRegistrationsData: this.cleanStudentRegistrations(authData.studentRegistrationsData),
    };
    const payload = this.normalizeAuthPayload(cleanedData);
    await this.fetchJson('/auth', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    this._authCache = payload;
    this._authCacheAt = Date.now();
    return payload;
  }

  cleanStudentRegistrations(registrations) {
    return ensureArray(registrations).map((reg) => {
      const cleaned = {};
      if (reg.regId) cleaned.regId = reg.regId;
      if (reg.studentId != null) cleaned.studentId = reg.studentId;
      if (reg.courseId) cleaned.courseId = reg.courseId;
      if (reg.studentRef) cleaned.studentRef = reg.studentRef;
      if (reg.courseRef) cleaned.courseRef = reg.courseRef;
      return cleaned;
    });
  }

  async loadOrInitAuthData() {
    const { authData } = await this.ensureAuthContext();
    return { authData, initialized: false };
  }

  async ensureAuthContext({ fresh = false } = {}) {
    // Reuse only a request that is currently in flight. An explicit fresh read
    // after it completes always reaches the server.
    if (this._authCache && !fresh) {
      return { authData: this._authCache };
    }

    if (fresh && !this._authRequest) {
      this.clearAuthCache();
    }

    if (!this._authRequest) {
      this._authRequest = this.getAuthData()
        .then((authData) => {
          this._authCache = authData;
          this._authCacheAt = Date.now();
          return { authData };
        })
        .finally(() => {
          this._authRequest = null;
        });
    }

    return this._authRequest;
  }

  clearAuthCache() {
    this._authCache = null;
    this._authCacheAt = 0;
  }

  async updateAuthCollections(changes) {
    const updates = Object.fromEntries(
      Object.entries(changes || {}).map(([field, value]) => [
        field,
        field === 'studentRegistrationsData'
          ? this.cleanStudentRegistrations(value)
          : ensureArray(value),
      ])
    );

    const operation = (this._authSaveRequest || Promise.resolve())
      .catch(() => undefined)
      .then(async () => {
        await this.fetchJson('/auth/collections', {
          method: 'PUT',
          body: JSON.stringify(updates),
        });
        // A partial write cannot prove that the untouched collections are
        // current, so invalidate the aggregate cache instead of blessing it.
        this.clearAuthCache();
        return null;
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

  async updateAuthCollection(field, value) {
    return this.updateAuthCollections({ [field]: value });
  }

  async getTeachers({ fresh = false } = {}) {
    const { authData } = await this.ensureAuthContext({ fresh });
    return authData.teachersData;
  }

  async getTeachersFresh() {
    return this.getTeachers({ fresh: true });
  }

  async saveTeachersData(teachers) {
    return this.updateAuthCollection('teachersData', teachers);
  }

  async getStudents({ fresh = false } = {}) {
    const { authData } = await this.ensureAuthContext({ fresh });
    return authData.studentsData;
  }

  async getStudentsFresh() {
    return this.getStudents({ fresh: true });
  }

  async saveStudentsData(students) {
    return this.updateAuthCollection('studentsData', students);
  }

  async getDepartments({ fresh = false } = {}) {
    const { authData } = await this.ensureAuthContext({ fresh });
    return authData.departmentsData;
  }

  async getDepartmentsFresh() {
    return this.getDepartments({ fresh: true });
  }

  async saveDepartmentsData(departments) {
    return this.updateAuthCollection('departmentsData', departments);
  }

  async getCourses({ fresh = false } = {}) {
    const { authData } = await this.ensureAuthContext({ fresh });
    return authData.subjectsData;
  }

  async getCoursesFresh() {
    return this.getCourses({ fresh: true });
  }

  async saveCoursesData(courses) {
    return this.updateAuthCollection('subjectsData', courses);
  }

  async getOpenRegistrations({ fresh = false } = {}) {
    const { authData } = await this.ensureAuthContext({ fresh });
    return authData.openRegistrationsData;
  }

  async getOpenRegistrationsFresh() {
    return this.getOpenRegistrations({ fresh: true });
  }

  async saveOpenRegistrationsData(registrations) {
    return this.updateAuthCollection('openRegistrationsData', registrations);
  }

  async getStudentRegistrations({ fresh = false } = {}) {
    const { authData } = await this.ensureAuthContext({ fresh });
    return authData.studentRegistrationsData;
  }

  async getStudentRegistrationsFresh() {
    return this.getStudentRegistrations({ fresh: true });
  }

  async saveStudentRegistrationsData(enrollments) {
    return this.updateAuthCollection('studentRegistrationsData', enrollments);
  }

  async getAssignments({ fresh = false } = {}) {
    const { authData } = await this.ensureAuthContext({ fresh });
    return authData.assignmentsData;
  }

  async getAssignmentsFresh() {
    return this.getAssignments({ fresh: true });
  }

  async saveAssignmentsData(assignments) {
    return this.updateAuthCollection('assignmentsData', assignments);
  }

  async getDocuments({ fresh = false } = {}) {
    const { authData } = await this.ensureAuthContext({ fresh });
    return authData.documentsData;
  }

  async getDocumentsFresh() {
    return this.getDocuments({ fresh: true });
  }

  async saveDocumentsData(documents) {
    return this.updateAuthCollection('documentsData', documents);
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
