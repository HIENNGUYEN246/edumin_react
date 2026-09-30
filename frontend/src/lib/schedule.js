export const SHIFTS = [
  { id: 'S1', label: 'Tiết 1 - 3 (7:00 - 9:15)', group: 'sang' },
  { id: 'S2', label: 'Tiết 4 - 6 (9:30 - 11:45)', group: 'sang' },
  { id: 'C1', label: 'Tiết 7 - 9 (12:30 - 14:45)', group: 'chieu' },
  { id: 'C2', label: 'Tiết 10 - 12 (15:00 - 17:15)', group: 'chieu' },
  { id: 'T1', label: 'Tiết 13 - 15 (18:00 - 20:15)', group: 'toi' },
];

export const DAYS = [
  { id: '2', label: 'Thứ 2' },
  { id: '3', label: 'Thứ 3' },
  { id: '4', label: 'Thứ 4' },
  { id: '5', label: 'Thứ 5' },
  { id: '6', label: 'Thứ 6' },
  { id: '7', label: 'Thứ 7' },
  { id: 'CN', label: 'Chủ Nhật' },
];

export const dayLabel = (id) => DAYS.find((d) => d.id === String(id))?.label || String(id);
export const shiftLabel = (id) => SHIFTS.find((s) => s.id === id)?.label || String(id);

/** Turn schedules into a readable string like "Thứ 2 · Tiết 1-3, Thứ 4 · ...". */
export function describeSchedules(schedules = []) {
  return schedules.map((s) => `${dayLabel(s.dayId)} · ${shiftLabel(s.shiftId)}`).join('; ');
}
