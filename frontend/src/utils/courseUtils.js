import courseAPI from '../services/courseAPI';

export function dedupeCoursesById(courses) {
  const map = new Map();
  for (const course of courses || []) {
    const key = course?.id?.trim().toUpperCase();
    if (key) map.set(key, course);
  }
  return [...map.values()];
}

/** Đồng bộ deptId/department theo danh sách khoa từ API */
export function syncCoursesWithDepartments(courses, departments) {
  if (!Array.isArray(courses) || !Array.isArray(departments)) return courses;
  return courses.map((course) => {
    const departmentName = course.department || course.dept || '';
    const deptId = course.deptId || course.departmentId || '';
    const foundDept =
      departments.find((d) => d.id === deptId) ||
      departments.find((d) => d.name === departmentName);

    const normalized = {
      ...course,
      department: foundDept ? foundDept.name : departmentName,
      deptId: foundDept ? foundDept.id : deptId,
    };

    if (foundDept && normalized.deptRef !== foundDept._id) {
      normalized.deptRef = foundDept._id;
    }

    delete normalized.dept;
    delete normalized.departmentId;

    return normalized;
  });
}

/** Tải học phần từ API (đã gộp & khử trùng) */
export async function fetchCourses({ fresh = false } = {}) {
  const list = await courseAPI.getAllCourses({ fresh });
  return dedupeCoursesById(Array.isArray(list) ? list : []);
}

/** Lưu học phần lên API và trả về bản ghi sau khi lưu */
export async function saveCourses(courses) {
  const payload = dedupeCoursesById(courses);
  await courseAPI.saveAllCourses(payload);
  return payload;
}

export async function fetchCoursesByDepartment(deptName) {
  const courses = await fetchCourses({ fresh: true });
  return courses.filter((c) => c.department === deptName || c.deptId === deptName);
}

export function formatCurrency(amount) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);
}
