export const SHIFTS = [
  { id: 'S1', label: 'Tiết 1 - 3 ( 7:00 - 9:15 )', group: 'sang' },
  { id: 'S2', label: 'Tiết 4 - 6 ( 9:30 - 11:45 )', group: 'sang' },
  { id: 'C1', label: 'Tiết 7 - 9 ( 12:30 - 14:45 )', group: 'chieu' },
  { id: 'C2', label: 'Tiết 10 - 12 ( 15:00 - 17:15 )', group: 'chieu' },
  { id: 'T1', label: 'Tiết 13 - 15 ( 18:00 - 20:15 )', group: 'toi' },
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

const SHIFT_IDS = new Set(SHIFTS.map((s) => s.id));
const DAY_IDS = new Set(DAYS.map((d) => d.id));

/** True when two schedule slots occupy the same day + shift. */
export function slotsClash(a, b) {
  return a.dayId === b.dayId && a.shiftId === b.shiftId;
}

/** True when two date ranges [aStart,aEnd] and [bStart,bEnd] overlap. */
export function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  const as = new Date(aStart).valueOf();
  const ae = new Date(aEnd).valueOf();
  const bs = new Date(bStart).valueOf();
  const be = new Date(bEnd).valueOf();
  if ([as, ae, bs, be].some(Number.isNaN)) return true; // be conservative
  return as <= be && bs <= ae;
}

/** Validate a schedules array against known day/shift ids. */
export function validateSchedules(schedules = []) {
  return schedules.every(
    (s) => s && DAY_IDS.has(String(s.dayId)) && SHIFT_IDS.has(String(s.shiftId))
  );
}

export function dayLabel(id) {
  return DAYS.find((d) => d.id === String(id))?.label || String(id);
}

export function shiftLabel(id) {
  return SHIFTS.find((s) => s.id === id)?.label || String(id);
}

/**
 * Find the first conflict between a candidate class and existing classes.
 * A conflict occurs when they share a day+shift AND overlap in study dates
 * AND share the same teacher or the same room.
 * @returns {string|null} human-readable reason or null when clear.
 */
export function findScheduleConflict(candidate, existingClasses) {
  for (const existing of existingClasses) {
    if (!rangesOverlap(candidate.studyStart, candidate.studyEnd, existing.studyStart, existing.studyEnd)) {
      continue;
    }
    for (const cSlot of candidate.schedules || []) {
      for (const eSlot of existing.schedules || []) {
        if (!slotsClash(cSlot, eSlot)) continue;
        const when = `${dayLabel(cSlot.dayId)}, ${shiftLabel(cSlot.shiftId)}`;
        if (candidate.teacherId != null && String(existing.teacherId) === String(candidate.teacherId)) {
          return `Giáo viên ${candidate.teacher || ''} trùng lịch dạy (${when}) với lớp học phần "${existing.className || existing.courseName || existing.id}".`.trim();
        }
        if (
          candidate.room &&
          String(existing.room || '').trim().toLowerCase() === String(candidate.room).trim().toLowerCase()
        ) {
          return `Phòng ${candidate.room} đã được sử dụng (${when}) bởi lớp học phần "${existing.className || existing.courseName || existing.id}" do giáo viên "${existing.teacher || 'chưa phân công'}" phụ trách.`;
        }
      }
    }
  }
  return null;
}
