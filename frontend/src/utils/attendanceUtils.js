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

export const SHIFT_NORMALIZATION_MAP = {
  // Ca 1 / Sáng 1
  '1': { label: 'Ca 1 (07:00 - 09:15)', time: '07:00 - 09:15', name: 'Ca 1' },
  's1': { label: 'Ca 1 (07:00 - 09:15)', time: '07:00 - 09:15', name: 'Ca 1' },
  'si': { label: 'Ca 1 (07:00 - 09:15)', time: '07:00 - 09:15', name: 'Ca 1' },
  'ca 1': { label: 'Ca 1 (07:00 - 09:15)', time: '07:00 - 09:15', name: 'Ca 1' },
  'ca s1': { label: 'Ca 1 (07:00 - 09:15)', time: '07:00 - 09:15', name: 'Ca 1' },
  'ca si': { label: 'Ca 1 (07:00 - 09:15)', time: '07:00 - 09:15', name: 'Ca 1' },
  'tiết 1 - 3': { label: 'Ca 1 (07:00 - 09:15)', time: '07:00 - 09:15', name: 'Ca 1' },

  // Ca 2 / Sáng 2
  '2': { label: 'Ca 2 (09:30 - 11:45)', time: '09:30 - 11:45', name: 'Ca 2' },
  's2': { label: 'Ca 2 (09:30 - 11:45)', time: '09:30 - 11:45', name: 'Ca 2' },
  'sii': { label: 'Ca 2 (09:30 - 11:45)', time: '09:30 - 11:45', name: 'Ca 2' },
  'ca 2': { label: 'Ca 2 (09:30 - 11:45)', time: '09:30 - 11:45', name: 'Ca 2' },
  'ca s2': { label: 'Ca 2 (09:30 - 11:45)', time: '09:30 - 11:45', name: 'Ca 2' },
  'ca sii': { label: 'Ca 2 (09:30 - 11:45)', time: '09:30 - 11:45', name: 'Ca 2' },
  'tiết 4 - 6': { label: 'Ca 2 (09:30 - 11:45)', time: '09:30 - 11:45', name: 'Ca 2' },

  // Ca 3 / Chiều 1
  '3': { label: 'Ca 3 (13:00 - 15:15)', time: '13:00 - 15:15', name: 'Ca 3' },
  'c1': { label: 'Ca 3 (13:00 - 15:15)', time: '13:00 - 15:15', name: 'Ca 3' },
  'ci': { label: 'Ca 3 (13:00 - 15:15)', time: '13:00 - 15:15', name: 'Ca 3' },
  'ca 3': { label: 'Ca 3 (13:00 - 15:15)', time: '13:00 - 15:15', name: 'Ca 3' },
  'ca c1': { label: 'Ca 3 (13:00 - 15:15)', time: '13:00 - 15:15', name: 'Ca 3' },
  'ca ci': { label: 'Ca 3 (13:00 - 15:15)', time: '13:00 - 15:15', name: 'Ca 3' },
  'tiết 7 - 9': { label: 'Ca 3 (13:00 - 15:15)', time: '13:00 - 15:15', name: 'Ca 3' },

  // Ca 4 / Chiều 2
  '4': { label: 'Ca 4 (15:30 - 17:45)', time: '15:30 - 17:45', name: 'Ca 4' },
  'c2': { label: 'Ca 4 (15:30 - 17:45)', time: '15:30 - 17:45', name: 'Ca 4' },
  'cii': { label: 'Ca 4 (15:30 - 17:45)', time: '15:30 - 17:45', name: 'Ca 4' },
  'ca 4': { label: 'Ca 4 (15:30 - 17:45)', time: '15:30 - 17:45', name: 'Ca 4' },
  'ca c2': { label: 'Ca 4 (15:30 - 17:45)', time: '15:30 - 17:45', name: 'Ca 4' },
  'ca cii': { label: 'Ca 4 (15:30 - 17:45)', time: '15:30 - 17:45', name: 'Ca 4' },
  'tiết 10 - 12': { label: 'Ca 4 (15:30 - 17:45)', time: '15:30 - 17:45', name: 'Ca 4' },

  // Ca 5 / Tối 1
  '5': { label: 'Ca 5 (18:00 - 20:15)', time: '18:00 - 20:15', name: 'Ca 5' },
  't1': { label: 'Ca 5 (18:00 - 20:15)', time: '18:00 - 20:15', name: 'Ca 5' },
  'ti': { label: 'Ca 5 (18:00 - 20:15)', time: '18:00 - 20:15', name: 'Ca 5' },
  'ca 5': { label: 'Ca 5 (18:00 - 20:15)', time: '18:00 - 20:15', name: 'Ca 5' },
  'ca t1': { label: 'Ca 5 (18:00 - 20:15)', time: '18:00 - 20:15', name: 'Ca 5' },
  'ca ti': { label: 'Ca 5 (18:00 - 20:15)', time: '18:00 - 20:15', name: 'Ca 5' },
  'tiết 13 - 15': { label: 'Ca 5 (18:00 - 20:15)', time: '18:00 - 20:15', name: 'Ca 5' },
};

export function getTodayDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatAttendanceDate(dateStr) {
  if (!dateStr) return 'Chưa cập nhật';
  const parts = String(dateStr).split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

export function getShiftInfo(shiftId, shiftLabel = '') {
  const normLabel = String(shiftLabel || '').trim();
  if (normLabel && /\(\d{2}:\d{2}\s*-\s*\d{2}:\d{2}\)/.test(normLabel)) {
    return { label: normLabel };
  }

  const key1 = String(shiftId || '').trim().toLowerCase();
  const key2 = normLabel.toLowerCase();

  const found =
    SHIFT_NORMALIZATION_MAP[key1] ||
    SHIFT_NORMALIZATION_MAP[key2] ||
    SHIFT_OPTIONS.find((s) => String(s.id).toLowerCase() === key1);

  if (found) {
    return found;
  }

  if (/^s[1i]$/i.test(key1) || /^s[1i]$/i.test(key2)) {
    return SHIFT_NORMALIZATION_MAP['s1'];
  }
  if (/^s[2]|sii$/i.test(key1) || /^s[2]|sii$/i.test(key2)) {
    return SHIFT_NORMALIZATION_MAP['s2'];
  }
  if (/^c[1i]$/i.test(key1) || /^c[1i]$/i.test(key2)) {
    return SHIFT_NORMALIZATION_MAP['c1'];
  }
  if (/^c[2]|cii$/i.test(key1) || /^c[2]|cii$/i.test(key2)) {
    return SHIFT_NORMALIZATION_MAP['c2'];
  }
  if (/^t[1i]$/i.test(key1) || /^t[1i]$/i.test(key2)) {
    return SHIFT_NORMALIZATION_MAP['t1'];
  }

  return { label: normLabel || (shiftId ? `Ca ${shiftId}` : 'Chưa xếp ca') };
}

export function getShiftLabel(shiftId, shiftLabel = '') {
  return getShiftInfo(shiftId, shiftLabel).label;
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

