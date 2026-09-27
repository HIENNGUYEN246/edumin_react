import teacherAPI from '../services/teacherAPI';
import studentAPI from '../services/studentAPI';
import departmentAPI from '../services/departmentAPI';
import { fetchCourses, saveCourses } from './courseUtils';

export const DEPARTMENTS_UPDATED_EVENT = 'departments-updated';

const DEFAULT_DEPARTMENTS = [
  { id: 'CNTT', name: 'Công nghệ thông tin', head: '' },
  { id: 'KT', name: 'Kinh tế', head: '' },
  { id: 'NN', name: 'Ngoại ngữ', head: '' },
];

export function notifyDepartmentsUpdated() {
  window.dispatchEvent(new CustomEvent(DEPARTMENTS_UPDATED_EVENT));
}

/** @deprecated Dùng fetchDepartments() — chỉ giữ để tránh lỗi import cũ */
export async function getDepartments() {
  return fetchDepartments();
}

/** Tải danh sách khoa từ API */
export async function fetchDepartments({ fresh = false } = {}) {
  let list = await departmentAPI.getAllDepartments({ fresh });
  if (!Array.isArray(list) || list.length === 0) {
    list = DEFAULT_DEPARTMENTS.map((d) => ({ ...d }));
    await departmentAPI.saveAllDepartments(list);
    list = await departmentAPI.getAllDepartments({ fresh: true });
  }
  return list;
}

/** Lưu khoa lên API */
export async function saveDepartments(departments) {
  await departmentAPI.saveAllDepartments(departments);
  notifyDepartmentsUpdated();
  return departments;
}

export function formatTeacherCode(id) {
  return `GV-${String(id).padStart(3, '0')}`;
}

export function parseTeacherHeadInfo(str) {
  if (!str) return { name: 'Chưa cập nhật', id: '' };
  if (typeof str === 'object' && str !== null) {
    const teacherName = str.name || str.hoTen || '';
    const teacherId = str.id ? formatTeacherCode(str.id) : '';
    return {
      name: teacherName || 'Chưa cập nhật',
      id: teacherId,
    };
  }
  const match = String(str).match(/(.+) \((GV-\d+)\)/);
  if (match) return { name: match[1], id: match[2] };
  return { name: String(str), id: '' };
}

/** Đồng bộ tên khoa lên API (giáo viên, sinh viên, học phần) */
export async function syncDepartmentReferences(oldName, newName, isDelete = false) {
  const targetValue = isDelete ? 'Chưa xác định' : newName;

  try {
    const teachers = await teacherAPI.getAllTeachers({ fresh: true });
    if (teachers.some((t) => t.department === oldName)) {
      const updated = teachers.map((t) =>
        t.department === oldName ? { ...t, department: targetValue } : t
      );
      await teacherAPI.saveAllTeachers(updated);
    }
  } catch (err) {
    console.warn('syncDepartmentReferences teachers:', err);
  }

  try {
    const students = await studentAPI.getAllStudents({ fresh: true });
    if (students.some((s) => s.department === oldName)) {
      const updated = students.map((s) =>
        s.department === oldName ? { ...s, department: targetValue } : s
      );
      await studentAPI.saveAllStudents(updated);
    }
  } catch (err) {
    console.warn('syncDepartmentReferences students:', err);
  }

  try {
    const courses = await fetchCourses({ fresh: true });
    if (courses.some((c) => c.department === oldName || c.dept === oldName)) {
      const updated = courses.map((c) => {
        if (c.department === oldName || c.dept === oldName) {
          return {
            ...c,
            department: targetValue,
            deptId: isDelete ? '' : c.deptId,
          };
        }
        return c;
      });
      await saveCourses(updated);
    }
  } catch (err) {
    console.warn('syncDepartmentReferences courses:', err);
  }

  notifyDepartmentsUpdated();
}
