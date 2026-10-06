export const ROLES = {
  ADMIN: 'dao-tao',
  TEACHER: 'giao-vien',
  STUDENT: 'sinh-vien',
  ACCOUNTANT: 'ke-toan',
};

export const ROLE_LABEL = {
  [ROLES.ADMIN]: 'Phòng Đào Tạo',
  [ROLES.TEACHER]: 'Giáo viên',
  [ROLES.STUDENT]: 'Sinh viên',
  [ROLES.ACCOUNTANT]: 'Phòng Kế Toán',
};

/** Sidebar navigation per role. `end` marks exact-match links. */
export const NAV_BY_ROLE = {
  [ROLES.ADMIN]: [
    { to: '/admin', label: 'Tổng quan', icon: 'fa-gauge-high', end: true },
    { to: '/admin/teachers', label: 'Quản lý giáo viên', icon: 'fa-chalkboard-user' },
    { to: '/admin/students', label: 'Quản lý sinh viên', icon: 'fa-user-graduate' },
    { to: '/admin/departments', label: 'Quản lý khoa', icon: 'fa-building-columns' },
    { to: '/admin/courses', label: 'Quản lý môn học', icon: 'fa-book-bookmark' },
    { to: '/admin/classes', label: 'Quản lý lớp học phần', icon: 'fa-shapes' },
    { to: '/admin/attendance', label: 'Điểm danh & Chuyên cần', icon: 'fa-clipboard-user' },
    { to: '/admin/tuition', label: 'Quản lý học phí', icon: 'fa-money-bill-wave' },
    { to: '/admin/feedbacks', label: 'Ý kiến & Phản hồi', icon: 'fa-comments' },
    { to: '/admin/profile-requests', label: 'Duyệt yêu cầu', icon: 'fa-user-check' },
  ],
  [ROLES.ACCOUNTANT]: [
    { to: '/accountant', label: 'Tổng quan tài chính', icon: 'fa-chart-pie', end: true },
    { to: '/accountant/tuition', label: 'Quản lý học phí', icon: 'fa-money-bill-wave' },
  ],
  [ROLES.TEACHER]: [
    { to: '/teacher', label: 'Tổng quan', icon: 'fa-gauge-high', end: true },
    { to: '/teacher/schedule', label: 'Lịch dạy', icon: 'fa-calendar-days' },
    { to: '/teacher/classes', label: 'Lớp học phần', icon: 'fa-users' },
    { to: '/teacher/attendance', label: 'Điểm danh & Đánh giá', icon: 'fa-clipboard-user' },
    { to: '/teacher/assignments', label: 'Bài tập', icon: 'fa-file-pen' },
    { to: '/teacher/documents', label: 'Tài liệu', icon: 'fa-folder-open' },
  ],
  [ROLES.STUDENT]: [
    { to: '/student', label: 'Tổng quan', icon: 'fa-gauge-high', end: true },
    { to: '/student/course-registration', label: 'Đăng ký học phần', icon: 'fa-calendar-plus' },
    { to: '/student/timetable', label: 'Thời khóa biểu', icon: 'fa-calendar-days' },
    { to: '/student/attendance', label: 'Điểm danh & Chuyên cần', icon: 'fa-clipboard-check' },
    { to: '/student/assignments', label: 'Bài tập', icon: 'fa-file-pen' },
    { to: '/student/documents', label: 'Tài liệu', icon: 'fa-folder-open' },
    { to: '/student/tuition', label: 'Học phí & Tài chính', icon: 'fa-wallet' },
  ],
};

export function roleHome(role) {
  if (role === ROLES.ADMIN) return '/admin';
  if (role === ROLES.ACCOUNTANT) return '/accountant';
  if (role === ROLES.TEACHER) return '/teacher';
  if (role === ROLES.STUDENT) return '/student';
  return '/login';
}
