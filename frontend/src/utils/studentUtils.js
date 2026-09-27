import {
  parseExcelDate,
  defaultAvatar,
  formatDisplayDate,
  fetchDepartments,
  compressAvatarFile,
} from './teacherUtils';

export { parseExcelDate, defaultAvatar, formatDisplayDate, fetchDepartments, compressAvatarFile };

export function ensureStudentAccountFields(student) {
  if (!student) return student;
  return {
    ...student,
    name: student.name || student.hoTen || '',
    email: student.email || '',
    password: student.password || '123',
    status: student.status || 'Active',
    lockReason: student.lockReason || '',
    className: student.className || '',
  };
}

export function normalizeStudent(student) {
  if (!student) return null;
  const name = student.name || student.hoTen || '';
  const base = {
    id: Number(student.id),
    name,
    className: student.className || '',
    dob: student.dob || student.ngaySinh || '',
    address: student.address || student.diaChi || '',
    gender: student.gender || student.gioiTinh || 'Nam',
    phone: student.phone || student.dienThoai || '',
    email: student.email || '',
    department: student.department || student.khoa || '',
    education: student.education || student.heDaoTao || '',
    avatar: student.avatar || defaultAvatar(name),
    password: student.password || '123',
    status: student.status || 'Active',
    lockReason: student.lockReason || '',
  };
  return ensureStudentAccountFields(base);
}

export function formatStudentId(id) {
  return `SV-${String(id).padStart(3, '0')}`;
}

export function getMaxDobForStudent() {
  const today = new Date();
  const maxYear = today.getFullYear() - 18;
  return new Date(maxYear, today.getMonth(), today.getDate()).toISOString().split('T')[0];
}
