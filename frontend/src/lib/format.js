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
