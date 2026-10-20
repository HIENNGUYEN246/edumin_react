export const ROLES = {
  ADMIN: 'dao-tao',
  TEACHER: 'giao-vien',
  STUDENT: 'sinh-vien',
  ACCOUNTANT: 'ke-toan',
};

export const ROLE_LABEL = {
  [ROLES.ADMIN]: 'Phòng Đào Tạo',
  admin: 'Phòng Đào Tạo',
  [ROLES.TEACHER]: 'Giáo viên',
  teacher: 'Giáo viên',
  [ROLES.STUDENT]: 'Sinh viên',
  student: 'Sinh viên',
  [ROLES.ACCOUNTANT]: 'Phòng Kế Toán',
  accountant: 'Phòng Kế Toán',
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
    { to: '/admin/classes', label: 'Quản lý lớp học phần', icon: 'fa-shapes' },
    { to: '/admin/gradebook', label: 'Quản lý bảng điểm', icon: 'fa-clipboard-list' },
    { to: '/admin/feedbacks', label: 'Ý kiến & Phản hồi', icon: 'fa-comments' },
    { to: '/admin/profile-requests', label: 'Duyệt yêu cầu', icon: 'fa-user-check' },
    { to: '/admin/email-notifications', label: 'Gửi thông báo Gmail', icon: 'fa-envelope' },
  ],
  [ROLES.TEACHER]: [
    { to: '/teacher', label: 'Tổng quan', icon: 'fa-gauge-high', end: true },
    { to: '/teacher/schedule', label: 'Lịch dạy', icon: 'fa-calendar-days' },
    { to: '/teacher/classes', label: 'Lớp học phần', icon: 'fa-users' },
    { to: '/teacher/attendance', label: 'Điểm danh', icon: 'fa-clipboard-user' },
    { to: '/teacher/assignments', label: 'Bài tập', icon: 'fa-file-pen' },
    { to: '/teacher/documents', label: 'Tài liệu', icon: 'fa-folder-open' },
  ],
  [ROLES.STUDENT]: [
    { to: '/student', label: 'Tổng quan', icon: 'fa-gauge-high', end: true },
    { to: '/student/course-registration', label: 'Đăng ký học phần', icon: 'fa-calendar-plus' },
    { to: '/student/timetable', label: 'Thời khóa biểu', icon: 'fa-calendar-days' },
    { to: '/student/attendance', label: 'Điểm danh', icon: 'fa-clipboard-check' },
    { to: '/student/assignments', label: 'Bài tập', icon: 'fa-file-pen' },
    { to: '/student/documents', label: 'Tài liệu', icon: 'fa-folder-open' },
  ],
};

export function roleHome(role) {
  if (role === ROLES.ADMIN || role === 'admin') return '/admin';
  if (role === ROLES.ACCOUNTANT || role === 'accountant') return '/accountant';
  if (role === ROLES.TEACHER || role === 'teacher') return '/teacher';
  if (role === ROLES.STUDENT || role === 'student') return '/student';
  return '/login';
}
