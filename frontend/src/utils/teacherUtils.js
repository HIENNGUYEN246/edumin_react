import * as XLSX from 'xlsx';

export function parseExcelDate(dateValue) {
  if (!dateValue) return '';
  if (typeof dateValue === 'number') {
    const date = XLSX.SSF.parse_date_code(dateValue);
    return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
  }
  const dateStr = dateValue.toString().trim();
  const parts = dateStr.split(/[/\-.]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }
    if (parts[2].length === 4) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  return dateStr;
}

export function defaultAvatar(name) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'GV')}&background=random&color=fff`;
}

/** Đảm bảo mỗi GV có tài khoản đăng nhập (đồng bộ danh sách ↔ tài khoản) */
export function ensureTeacherAccountFields(teacher) {
  if (!teacher) return teacher;
  return {
    ...teacher,
    email: teacher.email || '',
    password: teacher.password || '123',
    status: teacher.status || 'Active',
    lockReason: teacher.lockReason || '',
  };
}

export function normalizeTeacher(teacher) {
  if (!teacher) return null;
  let base;
  if (teacher.name) {
    base = {
      id: Number(teacher.id),
      name: teacher.name || '',
      dob: teacher.dob || '',
      address: teacher.address || '',
      gender: teacher.gender || 'Nam',
      phone: teacher.phone || '',
      email: teacher.email || '',
      department: teacher.department || '',
      education: teacher.education || '',
      avatar: teacher.avatar || defaultAvatar(teacher.name),
      password: teacher.password || '123',
      status: teacher.status || 'Active',
      lockReason: teacher.lockReason || '',
    };
  } else {
    base = {
      id: Number(teacher.id),
      name: teacher.hoTen || '',
      dob: teacher.ngaySinh || '',
      address: teacher.diaChi || '',
      gender: teacher.gioiTinh || 'Nam',
      phone: teacher.dienThoai || '',
      email: teacher.email || '',
      department: teacher.khoa || '',
      education: teacher.trinhDo || '',
      avatar: teacher.avatar || defaultAvatar(teacher.hoTen),
      password: teacher.password || '123',
      status: teacher.status || 'Active',
      lockReason: teacher.lockReason || '',
    };
  }
  return ensureTeacherAccountFields(base);
}

export function formatDisplayDate(dob) {
  if (dob && typeof dob === 'string' && dob.includes('-')) {
    return dob.split('-').reverse().join('/');
  }
  return dob || 'N/A';
}

export { fetchDepartments } from './departmentUtils';

/** Nén ảnh trước khi gửi API — tránh payload base64 quá lớn làm PUT chậm */
export function compressAvatarFile(file, maxSize = 160) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Không đọc được file ảnh'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Ảnh không hợp lệ'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

export function getMaxDobForTeacher() {
  const today = new Date();
  const maxYear = today.getFullYear() - 24;
  return new Date(maxYear, today.getMonth(), today.getDate()).toISOString().split('T')[0];
}
