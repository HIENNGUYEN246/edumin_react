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
    attendancesData: [],
  };
}

export function getDefaultFeedbacksData() {
  const now = Date.now();
  return [
    {
      id: 'FB_1790620000001_1',
      studentId: 1,
      studentName: 'Trần Văn A',
      studentEmail: 'vana@student.edu.vn',
      studentAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
      displayName: 'Trần Văn A',
      teacherId: 1,
      teacherName: 'Nguyễn Văn',
      courseId: 'CNTT101',
      courseName: 'Lập trình Web Cơ bản',
      regId: '1790619993288',
      rating: 5,
      courseQuality: 'Tốt',
      feedbackText: 'Thầy giảng dạy rất nhiệt tình, code mẫu trực quan và giải thích cặn kẽ từng dòng lệnh CSS Flexbox và React Hook. Em tiếp thu bài rất nhanh ạ!',
      isAnonymous: false,
      response: 'Cảm ơn em Văn A đã tích cực tham gia phát biểu trong giờ học! Hãy tiếp tục duy trì tinh thần tự học nhé.',
      respondedAt: '09:30 28/09/2026',
      createdAtFormatted: '14:20 27/09/2026',
      timestamp: now - 3 * 86400000,
    },
    {
      id: 'FB_1790620000002_2',
      studentId: 2,
      studentName: 'Quyền Huế Trân',
      studentEmail: 'quyen@student.edu.vn',
      studentAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
      displayName: 'Quyền Huế Trân',
      teacherId: 2,
      teacherName: 'Trần Đình',
      courseId: 'TA1',
      courseName: 'Tiếng Anh 1',
      regId: '1790626183631',
      rating: 5,
      courseQuality: 'Tốt',
      feedbackText: 'Thầy phát âm tiếng Anh cực chuẩn, không khí lớp học vui vẻ và có nhiều hoạt động luyện nói nhóm rất bổ ích.',
      isAnonymous: false,
      response: 'Thank you Trân! Keep practicing speaking every day to improve your fluency.',
      respondedAt: '16:00 29/09/2026',
      createdAtFormatted: '10:15 28/09/2026',
      timestamp: now - 2 * 86400000,
    },
    {
      id: 'FB_1790620000003_1',
      studentId: 1,
      studentName: 'Trần Văn A',
      studentEmail: 'vana@student.edu.vn',
      studentAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
      displayName: 'Trần Văn A',
      teacherId: 1,
      teacherName: 'Nguyễn Văn',
      courseId: 'CNTT102',
      courseName: 'Cơ sở dữ liệu',
      regId: '1790619993289',
      rating: 4,
      courseQuality: 'Ổn',
      feedbackText: 'Bài tập SQL truy vấn nâng cao hơi khó một chút, mong thầy dành thêm 15 phút cuối giờ để giải đáp các câu lệnh JOIN phức tạp ạ.',
      isAnonymous: false,
      response: 'Thầy ghi nhận ý kiến của em nhé. Tiết học tới thầy sẽ dành 30 phút để ôn tập lại phần Subquery và Multiple JOIN cho cả lớp.',
      respondedAt: '11:00 29/09/2026',
      createdAtFormatted: '16:45 28/09/2026',
      timestamp: now - 1.5 * 86400000,
    },
    {
      id: 'FB_1790620000004_2',
      studentId: 2,
      studentName: 'Quyền Huế Trân',
      studentEmail: 'quyen@student.edu.vn',
      studentAvatar: '',
      displayName: 'Sinh viên ẩn danh',
      teacherId: 1,
      teacherName: 'Nguyễn Văn',
      courseId: 'CNTT101',
      courseName: 'Lập trình Web Cơ bản',
      regId: '1790619993288',
      rating: 4,
      courseQuality: 'Tốt',
      feedbackText: 'Slide bài giảng của thầy rất đẹp và chi tiết, nếu có thêm video ghi hình lại buổi học để xem lại lúc ôn thi thì tuyệt vời hơn nữa ạ.',
      isAnonymous: true,
      response: '',
      respondedAt: '',
      createdAtFormatted: '08:30 29/09/2026',
      timestamp: now - 1 * 86400000,
    },
    {
      id: 'FB_1790620000005_1',
      studentId: 1,
      studentName: 'Trần Văn A',
      studentEmail: 'vana@student.edu.vn',
      studentAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
      displayName: 'Trần Văn A',
      teacherId: 2,
      teacherName: 'Trần Đình',
      courseId: 'TA1',
      courseName: 'Tiếng Anh 1',
      regId: '1790626183631',
      rating: 3,
      courseQuality: 'Cần cải thiện',
      feedbackText: 'Phần bài nghe audio ở phòng máy đôi khi bị rè loa, mong thầy và bộ phận kỹ thuật kiểm tra lại thiết bị âm thanh để sinh viên nghe rõ hơn ạ.',
      isAnonymous: false,
      response: 'Thầy đã báo ngay cho phòng kỹ thuật kiểm tra lại hệ thống loa phòng Lab 203 rồi em nhé, cảm ơn em đã phản ánh kịp thời!',
      respondedAt: '15:20 29/09/2026',
      createdAtFormatted: '14:10 29/09/2026',
      timestamp: now - 0.5 * 86400000,
    },
  ];
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
      attendancesData: ensureArray(payload.attendancesData),
      ...(payload.forceWipeOpenRegistrations ? { forceWipeOpenRegistrations: true } : {}),
      ...(payload.forceWipeStudentRegistrations ? { forceWipeStudentRegistrations: true } : {}),
      ...(payload.forceWipeAssignments ? { forceWipeAssignments: true } : {}),
      ...(payload.forceWipeDocuments ? { forceWipeDocuments: true } : {}),
      ...(payload.forceWipeAttendances ? { forceWipeAttendances: true } : {}),
    };
  }

  async getAuthData() {
    try {
      const body = await this.fetchJson('/auth');
      const normalized = this.normalizeAuthPayload(body);
      try {
        const cacheSafePayload = {
          ...normalized,
          assignmentsData: (normalized.assignmentsData || []).map((a) => (a.content && a.content.length > 50000 ? { ...a, content: '' } : a)),
          documentsData: (normalized.documentsData || []).map((d) => (d.content && d.content.length > 50000 ? { ...d, content: '' } : d)),
        };
        localStorage.setItem('edumin_auth_cache', JSON.stringify(cacheSafePayload));
      } catch {}
      return normalized;
    } catch (error) {
      console.warn('API error, attempting localStorage fallback:', error);
      try {
        const local = localStorage.getItem('edumin_auth_cache');
        if (local) {
          return this.normalizeAuthPayload(JSON.parse(local));
        }
      } catch {}
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
        if (reg.studentId != null) cleaned.studentId = reg.studentId;
        if (reg.courseId) cleaned.courseId = reg.courseId;
        if (reg.studentRef) {
          cleaned.studentRef = typeof reg.studentRef === 'object' && reg.studentRef._id ? reg.studentRef._id : reg.studentRef;
        }
        if (reg.courseRef) {
          cleaned.courseRef = typeof reg.courseRef === 'object' && reg.courseRef._id ? reg.courseRef._id : reg.courseRef;
        }
        return cleaned;
      }),
    };
    const payload = this.normalizeAuthPayload(cleanedData);
    try {
      const cacheSafePayload = {
        ...payload,
        assignmentsData: (payload.assignmentsData || []).map((a) => (a.content && a.content.length > 50000 ? { ...a, content: '' } : a)),
        documentsData: (payload.documentsData || []).map((d) => (d.content && d.content.length > 50000 ? { ...d, content: '' } : d)),
      };
      localStorage.setItem('edumin_auth_cache', JSON.stringify(cacheSafePayload));
    } catch {}

    try {
      await this.fetchJson('/auth', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.error('Failed to sync auth data to backend API:', err);
      // Even if network fails, we still updated cache and local storage so work is not lost
      throw err;
    }
    this._authCache = payload;
    return payload;
  }

  async loadOrInitAuthData() {
    try {
      const authData = await this.getAuthData();

      if (!authData.users.length) {
        const defaultData = {
          ...getDefaultAuthData(),
          openRegistrationsData: Array.isArray(authData.openRegistrationsData) && authData.openRegistrationsData.length > 0 ? authData.openRegistrationsData : [],
          studentRegistrationsData: Array.isArray(authData.studentRegistrationsData) && authData.studentRegistrationsData.length > 0 ? authData.studentRegistrationsData : [],
          assignmentsData: Array.isArray(authData.assignmentsData) && authData.assignmentsData.length > 0 ? authData.assignmentsData : [],
          documentsData: Array.isArray(authData.documentsData) && authData.documentsData.length > 0 ? authData.documentsData : [],
        };
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

  async saveOpenRegistrationsData(registrations, { forceWipe = false } = {}) {
    const operation = (this._authSaveRequest || Promise.resolve())
      .catch(() => undefined)
      .then(async () => {
        const latestAuthData = await this.getAuthData();
        const nextData = {
          ...latestAuthData,
          openRegistrationsData: ensureArray(registrations),
        };
        if (forceWipe) {
          nextData.forceWipeOpenRegistrations = true;
        }
        return this.saveAuthData(nextData);
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

  async getStudentRegistrations({ fresh = false } = {}) {
    if (fresh) this.clearAuthCache();
    const { authData } = await this.ensureAuthContext();
    return authData.studentRegistrationsData;
  }

  async getStudentRegistrationsFresh() {
    return this.getStudentRegistrations({ fresh: true });
  }

  async saveStudentRegistrationsData(enrollments, { forceWipe = false } = {}) {
    const operation = (this._authSaveRequest || Promise.resolve())
      .catch(() => undefined)
      .then(async () => {
        const latestAuthData = await this.getAuthData();
        const nextData = {
          ...latestAuthData,
          studentRegistrationsData: ensureArray(enrollments),
        };
        if (forceWipe) {
          nextData.forceWipeStudentRegistrations = true;
        }
        return this.saveAuthData(nextData);
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

  async getAssignments({ fresh = false } = {}) {
    if (fresh) this.clearAuthCache();
    const { authData } = await this.ensureAuthContext();
    return authData.assignmentsData;
  }

  async getAssignmentsFresh() {
    return this.getAssignments({ fresh: true });
  }

  async saveAssignmentsData(assignments, { forceWipe = false } = {}) {
    const operation = (this._authSaveRequest || Promise.resolve())
      .catch(() => undefined)
      .then(async () => {
        const latestAuthData = await this.getAuthData();
        const nextData = {
          ...latestAuthData,
          assignmentsData: ensureArray(assignments),
        };
        if (forceWipe) {
          nextData.forceWipeAssignments = true;
        }
        return this.saveAuthData(nextData);
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

  async getDocuments({ fresh = false } = {}) {
    if (fresh) this.clearAuthCache();
    const { authData } = await this.ensureAuthContext();
    return authData.documentsData;
  }

  async getDocumentsFresh() {
    return this.getDocuments({ fresh: true });
  }

  async saveDocumentsData(documents, { forceWipe = false } = {}) {
    const operation = (this._authSaveRequest || Promise.resolve())
      .catch(() => undefined)
      .then(async () => {
        const latestAuthData = await this.getAuthData();
        const nextData = {
          ...latestAuthData,
          documentsData: ensureArray(documents),
        };
        if (forceWipe) {
          nextData.forceWipeDocuments = true;
        }
        return this.saveAuthData(nextData);
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

  async getUsers() {
    const { authData } = await this.ensureAuthContext();
    return authData.users;
  }

  getStoredAttendances() {
    try {
      const data = localStorage.getItem('edumin_attendances');
      if (data) return JSON.parse(data);
      const cache = localStorage.getItem('edumin_auth_cache');
      if (cache) {
        const parsed = JSON.parse(cache);
        if (Array.isArray(parsed.attendancesData)) return parsed.attendancesData;
      }
      return [];
    } catch {
      return [];
    }
  }

  saveStoredAttendances(attendances) {
    try {
      localStorage.setItem('edumin_attendances', JSON.stringify(attendances));
      const cache = localStorage.getItem('edumin_auth_cache');
      if (cache) {
        const parsed = JSON.parse(cache);
        parsed.attendancesData = attendances;
        localStorage.setItem('edumin_auth_cache', JSON.stringify(parsed));
      }
    } catch {}
  }

  async getAttendances(params = {}) {
    let list = [];
    try {
      const query = new URLSearchParams();
      if (params.regId) query.set('regId', params.regId);
      if (params.studentId) query.set('studentId', params.studentId);
      if (params.date) query.set('date', params.date);
      if (params.courseId) query.set('courseId', params.courseId);
      if (params.teacherId) query.set('teacherId', params.teacherId);
      const queryString = query.toString() ? `?${query.toString()}` : '';
      const apiResult = await this.fetchJson(`/attendance${queryString}`);
      if (Array.isArray(apiResult)) {
        list = apiResult;
        const local = this.getStoredAttendances();
        const mergedMap = new Map();
        local.forEach((item) => {
          const k = `${item.studentId}-${item.regId || item.courseId}-${item.date || ''}-${item.shiftId || ''}`;
          mergedMap.set(k, item);
        });
        list.forEach((item) => {
          const k = `${item.studentId}-${item.regId || item.courseId}-${item.date || ''}-${item.shiftId || ''}`;
          const existing = mergedMap.get(k);
          if (existing) {
            const existingTime = Number(existing.timestamp) || (existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0);
            const itemTime = Number(item.timestamp) || (item.updatedAt ? new Date(item.updatedAt).getTime() : 0);
            if (existingTime > itemTime) {
              mergedMap.set(k, { ...item, ...existing });
            } else {
              mergedMap.set(k, { ...existing, ...item });
            }
          } else {
            mergedMap.set(k, item);
          }
        });
        const combined = Array.from(mergedMap.values());
        this.saveStoredAttendances(combined);
        return combined;
      }
    } catch {
      // Backend offline or error -> use localStorage fallback
    }

    const stored = this.getStoredAttendances();
    return stored.filter((item) => {
      if (params.regId && String(item.regId) !== String(params.regId)) return false;
      if (params.studentId && String(item.studentId) !== String(params.studentId)) return false;
      if (params.date && String(item.date) !== String(params.date)) return false;
      if (params.courseId && String(item.courseId).toLowerCase() !== String(params.courseId).toLowerCase()) return false;
      if (params.teacherId && String(item.teacherId) !== String(params.teacherId)) return false;
      return true;
    });
  }

  async checkInAttendance(payload) {
    const numericStudentId = Number(payload.studentId);
    const regIdStr = String(payload.regId || payload.courseId || '');
    const dateStr = String(payload.date || new Date().toISOString().split('T')[0]);
    const shiftIdStr = String(payload.shiftId || '1');

    const local = this.getStoredAttendances();
    const idx = local.findIndex(
      (a) =>
        String(a.studentId) === String(numericStudentId) &&
        String(a.regId || a.courseId || '') === regIdStr &&
        String(a.date) === dateStr &&
        String(a.shiftId || '1') === shiftIdStr
    );

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const checkedAt = `${pad(now.getHours())}:${pad(now.getMinutes())} ${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;

    let updatedRecord;
    if (idx >= 0) {
      updatedRecord = {
        ...local[idx],
        ...payload,
        studentId: numericStudentId,
        status: payload.status || 'Có mặt',
        checkedAt,
        timestamp: Date.now(),
        updatedAt: now.toISOString(),
      };
      local[idx] = updatedRecord;
    } else {
      updatedRecord = {
        id: `ATT_${Date.now()}_${numericStudentId}`,
        ...payload,
        studentId: numericStudentId,
        status: payload.status || 'Có mặt',
        checkedAt,
        timestamp: Date.now(),
        updatedAt: now.toISOString(),
      };
      local.push(updatedRecord);
    }

    this.saveStoredAttendances(local);
    this.clearAuthCache();
    window.dispatchEvent(new CustomEvent('edumin_attendance_updated', { detail: updatedRecord }));

    try {
      const res = await this.fetchJson('/attendance/check-in', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return res;
    } catch {
      return { success: true, message: 'Đã điểm danh (offline)', record: updatedRecord };
    }
  }

  async recordAndEvaluateAttendance(payload) {
    const numericStudentId = Number(payload.studentId);
    const regIdStr = String(payload.regId || payload.courseId || '');
    const dateStr = String(payload.date || new Date().toISOString().split('T')[0]);
    const shiftIdStr = String(payload.shiftId || '1');

    const local = this.getStoredAttendances();
    const idx = local.findIndex(
      (a) =>
        String(a.studentId) === String(numericStudentId) &&
        String(a.regId || a.courseId || '') === regIdStr &&
        String(a.date) === dateStr &&
        String(a.shiftId || '1') === shiftIdStr
    );

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const evaluatedAt = `${pad(now.getHours())}:${pad(now.getMinutes())} ${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;

    let updatedRecord;
    if (idx >= 0) {
      updatedRecord = {
        ...local[idx],
        ...payload,
        studentId: numericStudentId,
        score: payload.score !== null && payload.score !== undefined && payload.score !== '' ? Number(payload.score) : local[idx].score,
        evaluation: payload.evaluation !== undefined ? payload.evaluation : local[idx].evaluation,
        note: payload.note !== undefined ? payload.note : local[idx].note,
        status: payload.status || local[idx].status || 'Có mặt',
        studentAvatar: payload.studentAvatar || payload.avatar || local[idx].studentAvatar || local[idx].avatar || '',
        avatar: payload.studentAvatar || payload.avatar || local[idx].avatar || local[idx].studentAvatar || '',
        evaluatedAt,
        timestamp: Date.now(),
        updatedAt: now.toISOString(),
      };
      local[idx] = updatedRecord;
    } else {
      updatedRecord = {
        id: `ATT_${Date.now()}_${numericStudentId}`,
        ...payload,
        studentId: numericStudentId,
        score: payload.score !== null && payload.score !== undefined && payload.score !== '' ? Number(payload.score) : null,
        evaluation: payload.evaluation || '',
        note: payload.note || '',
        status: payload.status || 'Có mặt',
        studentAvatar: payload.studentAvatar || payload.avatar || '',
        avatar: payload.studentAvatar || payload.avatar || '',
        evaluatedAt,
        timestamp: Date.now(),
        updatedAt: now.toISOString(),
      };
      local.push(updatedRecord);
    }

    this.saveStoredAttendances(local);
    this.clearAuthCache();
    window.dispatchEvent(new CustomEvent('edumin_attendance_updated', { detail: updatedRecord }));

    try {
      const res = await this.fetchJson('/attendance/record-and-evaluate', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return res;
    } catch {
      return { success: true, message: 'Đã lưu đánh giá (offline)', record: updatedRecord };
    }
  }

  async saveBulkAttendance(payload) {
    const list = Array.isArray(payload.records) ? payload.records : [];
    const local = this.getStoredAttendances();
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const dateFormatted = `${pad(now.getHours())}:${pad(now.getMinutes())} ${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;

    list.forEach((rec) => {
      const sId = Number(rec.studentId);
      const regStr = String(payload.regId || rec.courseId || '');
      const dStr = String(payload.date || new Date().toISOString().split('T')[0]);
      const shStr = String(payload.shiftId || '1');

      const idx = local.findIndex(
        (a) =>
          String(a.studentId) === String(sId) &&
          String(a.regId || a.courseId || '') === regStr &&
          String(a.date) === dStr &&
          String(a.shiftId || '1') === shStr
      );

      const entry = {
        regId: regStr,
        courseId: payload.courseId || '',
        courseName: payload.courseName || '',
        studentId: sId,
        date: dStr,
        shiftId: shStr,
        status: rec.status || 'Có mặt',
        score: rec.score !== '' && rec.score != null ? Number(rec.score) : null,
        evaluation: rec.evaluation || '',
        note: rec.note || '',
        studentAvatar: rec.studentAvatar || rec.avatar || (idx >= 0 ? local[idx].studentAvatar || local[idx].avatar : ''),
        avatar: rec.studentAvatar || rec.avatar || (idx >= 0 ? local[idx].avatar || local[idx].studentAvatar : ''),
        evaluatedAt: dateFormatted,
        timestamp: Date.now(),
      };

      if (idx >= 0) {
        local[idx] = { ...local[idx], ...entry };
      } else {
        local.push({ id: `ATT_${Date.now()}_${sId}`, ...entry });
      }
    });

    this.saveStoredAttendances(local);
    this.clearAuthCache();
    window.dispatchEvent(new CustomEvent('edumin_attendance_updated'));

    try {
      const res = await this.fetchJson('/attendance/bulk', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return res;
    } catch {
      return { success: true, message: 'Đã lưu điểm danh hàng loạt (offline)' };
    }
  }

  async getAttendanceByStudent(studentId) {
    try {
      return await this.fetchJson(`/attendance/student/${studentId}`);
    } catch {
      const stored = this.getStoredAttendances();
      return stored.filter((a) => String(a.studentId) === String(studentId));
    }
  }

  getStoredFeedbacks() {
    try {
      const raw = localStorage.getItem('edumin_feedbacks');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
      const initial = getDefaultFeedbacksData();
      localStorage.setItem('edumin_feedbacks', JSON.stringify(initial));
      return initial;
    } catch {
      return getDefaultFeedbacksData();
    }
  }

  saveStoredFeedbacks(feedbacks) {
    try {
      localStorage.setItem('edumin_feedbacks', JSON.stringify(feedbacks));
    } catch {}
  }

  async getFeedbacks(params = {}) {
    let list = [];
    try {
      const query = new URLSearchParams();
      if (params.teacherId) query.set('teacherId', params.teacherId);
      if (params.studentId) query.set('studentId', params.studentId);
      if (params.courseId) query.set('courseId', params.courseId);
      if (params.regId) query.set('regId', params.regId);
      const queryString = query.toString() ? `?${query.toString()}` : '';
      const apiResult = await this.fetchJson(`/feedbacks${queryString}`);
      if (Array.isArray(apiResult)) {
        list = apiResult;
        const local = this.getStoredFeedbacks();
        const map = new Map();
        local.forEach((item) => map.set(String(item.id || item._id), item));
        list.forEach((item) => {
          const key = String(item.id || item._id);
          const existing = map.get(key);
          if (existing) {
            map.set(key, { ...existing, ...item });
          } else {
            map.set(key, item);
          }
        });
        const combined = Array.from(map.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        this.saveStoredFeedbacks(combined);
        return combined.filter((f) => {
          if (params.teacherId && String(f.teacherId) !== String(params.teacherId)) return false;
          if (params.studentId && String(f.studentId) !== String(params.studentId)) return false;
          if (params.courseId && String(f.courseId) !== String(params.courseId)) return false;
          if (params.regId && String(f.regId) !== String(params.regId)) return false;
          return true;
        });
      }
    } catch {
      // offline fallback
    }

    const stored = this.getStoredFeedbacks();
    return stored.filter((f) => {
      if (params.teacherId && String(f.teacherId) !== String(params.teacherId)) return false;
      if (params.studentId && String(f.studentId) !== String(params.studentId)) return false;
      if (params.courseId && String(f.courseId) !== String(params.courseId)) return false;
      if (params.regId && String(f.regId) !== String(params.regId)) return false;
      return true;
    }).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }

  async submitFeedback(payload) {
    const numStudentId = Number(payload.studentId);
    const feedbackId = `FB_${Date.now()}_${numStudentId}`;
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const createdAtStr = `${pad(now.getHours())}:${pad(now.getMinutes())} ${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;

    const newRecord = {
      id: feedbackId,
      ...payload,
      studentId: numStudentId,
      rating: Math.min(5, Math.max(1, Number(payload.rating) || 5)),
      courseQuality: payload.courseQuality || 'Tốt',
      feedbackText: (payload.feedbackText || '').trim(),
      isAnonymous: Boolean(payload.isAnonymous),
      studentAvatar: payload.isAnonymous ? '' : (payload.studentAvatar || ''),
      displayName: payload.isAnonymous ? 'Sinh viên ẩn danh' : (payload.studentName || 'Sinh viên'),
      createdAt: now.toISOString(),
      createdAtFormatted: createdAtStr,
      timestamp: Date.now(),
    };

    const local = this.getStoredFeedbacks();
    local.unshift(newRecord);
    this.saveStoredFeedbacks(local);
    window.dispatchEvent(new CustomEvent('edumin_feedback_updated', { detail: newRecord }));

    try {
      const res = await this.fetchJson('/feedbacks', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return res;
    } catch {
      return {
        success: true,
        message: 'Gửi phản hồi thành công! (Lưu cục bộ)',
        feedback: newRecord,
      };
    }
  }

  async respondFeedback(id, response) {
    const local = this.getStoredFeedbacks();
    const idx = local.findIndex((f) => String(f.id) === String(id) || String(f._id) === String(id));
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const respondedAt = `${pad(now.getHours())}:${pad(now.getMinutes())} ${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;

    if (idx >= 0) {
      local[idx] = {
        ...local[idx],
        response,
        respondedAt,
      };
      this.saveStoredFeedbacks(local);
      window.dispatchEvent(new CustomEvent('edumin_feedback_updated', { detail: local[idx] }));
    }

    try {
      const res = await this.fetchJson(`/feedbacks/${id}/respond`, {
        method: 'PATCH',
        body: JSON.stringify({ response }),
      });
      return res;
    } catch {
      return { success: true, message: 'Đã phản hồi ý kiến sinh viên (offline)' };
    }
  }

  async deleteFeedback(id) {
    const local = this.getStoredFeedbacks();
    const filtered = local.filter((f) => String(f.id) !== String(id) && String(f._id) !== String(id));
    this.saveStoredFeedbacks(filtered);
    window.dispatchEvent(new CustomEvent('edumin_feedback_updated', { detail: { id } }));

    try {
      const res = await this.fetchJson(`/feedbacks/${id}`, {
        method: 'DELETE',
      });
      return res;
    } catch {
      return { success: true, message: 'Đã xóa phản hồi thành công (offline)' };
    }
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
