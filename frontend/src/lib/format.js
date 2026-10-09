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
  void isEnd;
  if (!value) return '—';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
  }
  const [date, time] = String(value).split('T');
  const [year, month, day] = date.split('-');
  return time ? `${day}/${month}/${year} ${time.slice(0, 5)}` : `${day}/${month}/${year}`;
}

export function registrationDateTimeInput(value, isEnd = false) {
  void isEnd;
  if (!value) return '';
  return String(value).slice(0, 10);
}

export function getNextDate(dateStr) {
  if (!dateStr) return '';
  const [year, month, day] = String(dateStr).slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return '';
  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dt = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dt}`;
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

export function addDaysToDate(dateStr, days = 7) {
  if (!dateStr) return '';
  const [year, month, day] = String(dateStr).slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return '';
  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dt = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dt}`;
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

export const DEFAULT_GRADE_WEIGHTS = {
  attendance: 10,
  homework: 10,
  midterm: 30,
  final: 50,
  presentation: 0,
};

export const GRADE_COMPONENTS = [
  { key: 'attendance', label: 'Điểm chuyên cần', shortLabel: 'Chuyên cần' },
  { key: 'homework', label: 'Điểm bài tập / Quiz', shortLabel: 'Bài tập' },
  { key: 'midterm', label: 'Điểm thi giữa kỳ', shortLabel: 'Giữa kỳ' },
  { key: 'presentation', label: 'Điểm thuyết trình', shortLabel: 'Thuyết trình' },
  { key: 'final', label: 'Điểm thi cuối kỳ', shortLabel: 'Cuối kỳ' },
];

export function calculateGpa(grades, weights = DEFAULT_GRADE_WEIGHTS) {
  if (!grades) return null;
  const currentWeights = { ...DEFAULT_GRADE_WEIGHTS, ...weights };
  let totalWeightedScore = 0;
  let totalWeight = 0;
  let hasAnyScore = false;

  for (const { key } of GRADE_COMPONENTS) {
    const weight = Number(currentWeights[key] ?? 0);
    if (weight <= 0) continue;
    const rawVal = grades[key];
    if (rawVal !== null && rawVal !== undefined && rawVal !== '') {
      const score = Number(rawVal);
      if (!Number.isNaN(score)) {
        totalWeightedScore += score * weight;
        totalWeight += weight;
        hasAnyScore = true;
      }
    }
  }

  if (!hasAnyScore || totalWeight <= 0) return null;
  const gpa = totalWeightedScore / totalWeight;
  return Number(gpa.toFixed(2));
}

export function getGpaClassification(gpa) {
  if (gpa == null) return { text: 'Chưa có điểm', tone: 'neutral' };
  if (gpa >= 8.5) return { text: 'Giỏi', tone: 'success', letter: 'A' };
  if (gpa >= 7.0) return { text: 'Khá', tone: 'primary', letter: 'B' };
  if (gpa >= 5.5) return { text: 'Trung bình', tone: 'warning', letter: 'C' };
  if (gpa >= 4.0) return { text: 'Yếu', tone: 'caution', letter: 'D' };
  return { text: 'Kém', tone: 'danger', letter: 'F' };
}
