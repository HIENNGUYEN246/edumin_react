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

export function getCurrentDateTimeLocal(now = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

export function getCurrentDateTimeLocalWithSeconds(now = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${getCurrentDateTimeLocal(now)}:${pad(now.getSeconds())}`;
}

export function formatRegistrationDateTime(value, isEnd = false) {
  if (!value) return '—';
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T${isEnd ? '23:59' : '00:00'}`
    : value;
  const [date, time] = normalized.split('T');
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year} ${time.slice(0, 5)}`;
}

export function registrationDateTimeInput(value, isEnd = false) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return `${value}T${isEnd ? '23:59' : '00:00'}`;
  }
  return value.slice(0, 16);
}

/**
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
 * Add specified number of weeks (default 13 weeks = 91 days) to a date string (YYYY-MM-DD).
 */
export function addWeeksToDate(dateStr, weeks = 13) {
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
