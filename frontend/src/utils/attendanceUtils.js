export const ATTENDANCE_STATUSES = ['Có mặt', 'Đi muộn', 'Vắng mặt', 'Vắng có phép'];

export const EVALUATION_QUICK_TAGS = [
  'Tiếp thu tốt',
  'Hăng hái phát biểu',
  'Đi học đúng giờ',
  'Đi muộn',
  'Làm bài tốt',
  'Cần tập trung hơn',
  'Vắng không phép',
  'Nghỉ có phép',
];

export const SHIFT_OPTIONS = [
  { id: '1', label: 'Ca 1 (07:00 - 09:15)' },
  { id: '2', label: 'Ca 2 (09:30 - 11:45)' },
  { id: '3', label: 'Ca 3 (13:00 - 15:15)' },
  { id: '4', label: 'Ca 4 (15:30 - 17:45)' },
  { id: '5', label: 'Ca 5 (18:00 - 20:15)' },
];

export function getTodayDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatAttendanceDate(dateStr) {
  if (!dateStr) return '';
  const parts = String(dateStr).split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

export function getShiftLabel(shiftId) {
  const found = SHIFT_OPTIONS.find((s) => String(s.id) === String(shiftId));
  return found ? found.label : `Ca ${shiftId}`;
}

export function getStatusBadgeClass(status) {
  switch (status) {
    case 'Có mặt':
      return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
    case 'Đi muộn':
      return 'bg-amber-100 text-amber-700 border border-amber-200';
    case 'Vắng có phép':
      return 'bg-blue-100 text-blue-700 border border-blue-200';
    case 'Vắng mặt':
      return 'bg-rose-100 text-rose-700 border border-rose-200';
    default:
      return 'bg-gray-100 text-gray-700 border border-gray-200';
  }
}

export function getStatusIcon(status) {
  switch (status) {
    case 'Có mặt':
      return 'fa-check-circle text-emerald-500';
    case 'Đi muộn':
      return 'fa-clock text-amber-500';
    case 'Vắng có phép':
      return 'fa-envelope-open-text text-blue-500';
    case 'Vắng mặt':
      return 'fa-times-circle text-rose-500';
    default:
      return 'fa-question-circle text-gray-400';
  }
}

export function calculateStudentAttendanceStats(records = [], studentId = null) {
  const studentRecords = studentId
    ? records.filter((r) => String(r.studentId) === String(studentId))
    : records;

  const total = studentRecords.length;
  const present = studentRecords.filter((r) => r.status === 'Có mặt').length;
  const late = studentRecords.filter((r) => r.status === 'Đi muộn').length;
  const excused = studentRecords.filter((r) => r.status === 'Vắng có phép').length;
  const absent = studentRecords.filter((r) => r.status === 'Vắng mặt').length;

  const rate = total > 0 ? Math.round(((present + late * 0.5) / total) * 100) : 100;

  const evaluatedRecords = studentRecords.filter((r) => r.score !== null && r.score !== undefined);
  const avgScore =
    evaluatedRecords.length > 0
      ? (evaluatedRecords.reduce((sum, r) => sum + Number(r.score), 0) / evaluatedRecords.length).toFixed(1)
      : null;

  return {
    total,
    present,
    late,
    excused,
    absent,
    rate,
    avgScore,
  };
}

