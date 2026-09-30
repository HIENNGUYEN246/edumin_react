export const ROLES = {
  ADMIN: 'dao-tao',
  TEACHER: 'giao-vien',
  STUDENT: 'sinh-vien',
};

export const ROLE_LABEL = {
  [ROLES.ADMIN]: 'Phòng Đào Tạo',
  [ROLES.TEACHER]: 'Giáo viên',
  [ROLES.STUDENT]: 'Sinh viên',
};

/** Sidebar navigation per role. `end` marks exact-match links. */
export const NAV_BY_ROLE = {
  [ROLES.ADMIN]: [
    { to: '/admin', label: 'Tổng quan', icon: 'fa-gauge-high', end: true },
    { to: '/admin/teachers', label: 'Quản lý giáo viên', icon: 'fa-chalkboard-user' },
    { to: '/admin/teacher-accounts', label: 'Tài khoản giáo viên', icon: 'fa-user-shield' },
    { to: '/admin/students', label: 'Quản lý sinh viên', icon: 'fa-user-graduate' },
    { to: '/admin/student-accounts', label: 'Tài khoản sinh viên', icon: 'fa-id-card' },
    { to: '/admin/departments', label: 'Quản lý khoa', icon: 'fa-building-columns' },
    { to: '/admin/courses', label: 'Quản lý học phần', icon: 'fa-book' },
    { to: '/admin/classes', label: 'Quản lý đăng ký', icon: 'fa-calendar-check' },
  ],
  [ROLES.TEACHER]: [
    { to: '/teacher', label: 'Tổng quan', icon: 'fa-gauge-high', end: true },
    { to: '/teacher/schedule', label: 'Lịch dạy', icon: 'fa-calendar-days' },
    { to: '/teacher/classes', label: 'Lớp học phần', icon: 'fa-users' },
    { to: '/teacher/assignments', label: 'Bài tập', icon: 'fa-file-pen' },
    { to: '/teacher/documents', label: 'Tài liệu', icon: 'fa-folder-open' },
  ],
  [ROLES.STUDENT]: [
    { to: '/student', label: 'Tổng quan', icon: 'fa-gauge-high', end: true },
    { to: '/student/course-registration', label: 'Đăng ký học phần', icon: 'fa-calendar-plus' },
    { to: '/student/timetable', label: 'Thời khóa biểu', icon: 'fa-calendar-days' },
    { to: '/student/assignments', label: 'Bài tập', icon: 'fa-file-pen' },
    { to: '/student/documents', label: 'Tài liệu', icon: 'fa-folder-open' },
  ],
};

export function roleHome(role) {
  if (role === ROLES.ADMIN) return '/admin';
  if (role === ROLES.TEACHER) return '/teacher';
  if (role === ROLES.STUDENT) return '/student';
  return '/login';
}
