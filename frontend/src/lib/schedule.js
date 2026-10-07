export const SHIFTS = [
  {
    id: 'S1',
    label: 'Tiết 1 - 3 (07:00 - 09:15)',
    lessons: 'Tiết 1 - 3',
    time: '07:00 - 09:15',
    group: 'sang',
    groupLabel: 'Ca Sáng',
    icon: 'fa-sun text-amber-500',
    colorBadge: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  {
    id: 'S2',
    label: 'Tiết 4 - 6 (09:30 - 11:45)',
    lessons: 'Tiết 4 - 6',
    time: '09:30 - 11:45',
    group: 'sang',
    groupLabel: 'Ca Sáng',
    icon: 'fa-sun text-amber-500',
    colorBadge: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  {
    id: 'C1',
    label: 'Tiết 7 - 9 (12:30 - 14:45)',
    lessons: 'Tiết 7 - 9',
    time: '12:30 - 14:45',
    group: 'chieu',
    groupLabel: 'Ca Chiều',
    icon: 'fa-cloud-sun text-orange-500',
    colorBadge: 'bg-orange-50 text-orange-700 border-orange-200',
  },
  {
    id: 'C2',
    label: 'Tiết 10 - 12 (15:00 - 17:15)',
    lessons: 'Tiết 10 - 12',
    time: '15:00 - 17:15',
    group: 'chieu',
    groupLabel: 'Ca Chiều',
    icon: 'fa-cloud-sun text-orange-500',
    colorBadge: 'bg-orange-50 text-orange-700 border-orange-200',
  },
  {
    id: 'T1',
    label: 'Tiết 13 - 15 (18:00 - 20:15)',
    lessons: 'Tiết 13 - 15',
    time: '18:00 - 20:15',
    group: 'toi',
    groupLabel: 'Ca Tối',
    icon: 'fa-moon text-indigo-500',
    colorBadge: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
];

export const DAYS = [
  { id: '2', label: 'Thứ 2', short: 'T2', badgeBg: 'bg-indigo-600 text-white', lightBg: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { id: '3', label: 'Thứ 3', short: 'T3', badgeBg: 'bg-blue-600 text-white', lightBg: 'bg-blue-50 text-blue-700 border-blue-200' },
  { id: '4', label: 'Thứ 4', short: 'T4', badgeBg: 'bg-cyan-600 text-white', lightBg: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  { id: '5', label: 'Thứ 5', short: 'T5', badgeBg: 'bg-teal-600 text-white', lightBg: 'bg-teal-50 text-teal-700 border-teal-200' },
  { id: '6', label: 'Thứ 6', short: 'T6', badgeBg: 'bg-emerald-600 text-white', lightBg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { id: '7', label: 'Thứ 7', short: 'T7', badgeBg: 'bg-amber-600 text-white', lightBg: 'bg-amber-50 text-amber-700 border-amber-200' },
  { id: 'CN', label: 'Chủ Nhật', short: 'CN', badgeBg: 'bg-rose-600 text-white', lightBg: 'bg-rose-50 text-rose-700 border-rose-200' },
];

export const dayLabel = (id) => DAYS.find((d) => d.id === String(id))?.label || String(id);
export const dayShort = (id) => DAYS.find((d) => d.id === String(id))?.short || String(id);
export const dayInfo = (id) =>
  DAYS.find((d) => d.id === String(id)) || {
    id: String(id),
    label: String(id),
    short: String(id),
    badgeBg: 'bg-gray-600 text-white',
    lightBg: 'bg-gray-50 text-gray-700 border-gray-200',
  };

export const shiftLabel = (id) => SHIFTS.find((s) => s.id === id)?.label || String(id);
export const shiftInfo = (id) =>
  SHIFTS.find((s) => s.id === id) || {
    id: String(id),
    label: String(id),
    lessons: String(id),
    time: '',
    groupLabel: '',
    icon: 'fa-clock text-gray-400',
    colorBadge: 'bg-gray-50 text-gray-700 border-gray-200',
  };

/** Turn schedules into a readable string like "Thứ 2 · Tiết 1-3, Thứ 4 · ...". */
export function describeSchedules(schedules = []) {
  return schedules.map((s) => `${dayLabel(s.dayId)} · ${shiftLabel(s.shiftId)}`).join('; ');
}
