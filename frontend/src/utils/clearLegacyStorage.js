/** Xóa cache entity cũ — dữ liệu chỉ lấy từ API */
const LEGACY_ENTITY_KEYS = [
  'departmentsData',
  'coursesData',
  'teachersData',
  'studentsData',
  'classesData',
  'openRegistrations',
  'studentRegistrations',
];

export function clearLegacyEntityStorage() {
  LEGACY_ENTITY_KEYS.forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  });
}
