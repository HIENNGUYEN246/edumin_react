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

export function isTeacherInDept(teacher, deptName, deptId) {
  if (!teacher) return false;
  const teacherDept = (teacher.department || teacher.dept || '').trim().toLowerCase();
  if (!teacherDept) return false;

  const targetName = (deptName || '').trim().toLowerCase();
  const targetId = (deptId || '').trim().toLowerCase();

  const clean = (str) =>
    (str || '')
      .toLowerCase()
      .replace(/^(khoa|viện|bộ môn)\s+/i, '')
      .replace(/\s+/g, ' ')
      .trim();

  const cTeacherDept = clean(teacherDept);
  const cTargetName = clean(targetName);
  const cTargetId = clean(targetId);

  if (teacherDept === targetName || (targetId && teacherDept === targetId)) {
    return true;
  }
  if (cTeacherDept && cTargetName && cTeacherDept === cTargetName) {
    return true;
  }
  if (cTeacherDept && cTargetId && cTeacherDept === cTargetId) {
    return true;
  }
  return false;
}

export function findTeacherFromHeadString(headStr, teachers = []) {
  if (!headStr) return null;
  const raw = String(headStr).trim();
  const match = raw.match(/\((GV-\d+)\)/i);
  if (match) {
    const targetId = parseInt(match[1].replace(/GV-/i, ''), 10);
    const found = teachers.find((t) => Number(t.id) === targetId);
    if (found) return found;
  }
  const codeMatch = raw.match(/^GV-(\d+)$/i);
  if (codeMatch) {
    const targetId = parseInt(codeMatch[1], 10);
    const found = teachers.find((t) => Number(t.id) === targetId);
    if (found) return found;
  }
  const nameOnly = raw.replace(/\s*\((GV-\d+)\)\s*$/i, '').trim().toLowerCase();
  return teachers.find(
    (t) =>
      (t.name || t.hoTen || '').trim().toLowerCase() === nameOnly ||
      formatTeacherCode(t.id).toLowerCase() === raw.toLowerCase()
  );
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
