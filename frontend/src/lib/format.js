/** Zero-padded teacher code, e.g. 1 -> "GV-001". */
export const formatTeacherCode = (id) => `GV-${String(id ?? '').padStart(3, '0')}`;

/** Zero-padded student code, e.g. 7 -> "SV-007". */
export const formatStudentCode = (id) => `SV-${String(id ?? '').padStart(3, '0')}`;

const currencyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

export const formatCurrency = (value) => currencyFormatter.format(Number(value) || 0);

export function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return String(value);
  return date.toLocaleDateString('vi-VN');
}

/**
<<<<<<< HEAD
 * Return current local date string (YYYY-MM-DD).
 * Uses local calendar date components to prevent UTC timezone shifting.
 */
export function getTodayDate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dt = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dt}`;
}

/**
=======
>>>>>>> 4e8ffb5c0a056164b568d493668162ccf16b4bd5
 * Calculate the maximum allowed date of birth (YYYY-MM-DD) for a given minimum age in years.
 * Prevents selecting dates of birth younger than `minAge` years old relative to today.
 */
export function getMaxBirthDate(minAge) {
  const now = new Date();
  const d = new Date(now.getFullYear() - minAge, now.getMonth(), now.getDate());
  if (d.getMonth() !== now.getMonth()) {
    d.setDate(0);
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
<<<<<<< HEAD
 * Add specified number of weeks (default 13 weeks = 91 days) to a date string (YYYY-MM-DD).
 */
export function addWeeksToDate(dateStr, weeks = 13) {
=======
 * Add specified number of weeks (default 15 weeks = 105 days) to a date string (YYYY-MM-DD).
 */
export function addWeeksToDate(dateStr, weeks = 15) {
>>>>>>> 4e8ffb5c0a056164b568d493668162ccf16b4bd5
  if (!dateStr) return '';
  const [year, month, day] = String(dateStr).split('-').map(Number);
  if (!year || !month || !day) return '';
  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() + weeks * 7);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dt = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dt}`;
}
<<<<<<< HEAD
=======

/**
 * Return current local date string (YYYY-MM-DD).
 * Uses local calendar date components to prevent UTC timezone shifting.
 */
export function getTodayDate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dt = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dt}`;
}
>>>>>>> 4e8ffb5c0a056164b568d493668162ccf16b4bd5
