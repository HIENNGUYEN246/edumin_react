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

export const MATRIX_STATUS_MAP = {
  'Có mặt': {
    label: 'Có mặt',
    icon: 'fa-check',
    color: 'text-emerald-700 bg-emerald-50 border-emerald-300 hover:bg-emerald-100',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    symbol: '✓',
  },
  'Đi muộn': {
    label: 'Đi muộn',
    icon: 'fa-clock',
    color: 'text-amber-700 bg-amber-50 border-amber-300 hover:bg-amber-100',
    badge: 'bg-amber-100 text-amber-800 border-amber-200',
    symbol: '⏰',
  },
  'Vắng có phép': {
    label: 'Vắng có phép',
    icon: 'fa-envelope-open-text',
    color: 'text-blue-700 bg-blue-50 border-blue-300 hover:bg-blue-100',
    badge: 'bg-blue-100 text-blue-800 border-blue-200',
    symbol: 'P',
  },
  'Vắng mặt': {
    label: 'Vắng không phép',
    icon: 'fa-xmark',
    color: 'text-rose-700 bg-rose-50 border-rose-300 hover:bg-rose-100',
    badge: 'bg-rose-100 text-rose-800 border-rose-200',
    symbol: '✕',
  },
  'Chưa điểm danh': {
    label: 'Chưa điểm danh',
    icon: 'fa-minus',
    color: 'text-slate-400 bg-slate-50/80 border-slate-200 hover:bg-slate-100',
    badge: 'bg-slate-100 text-slate-500 border-slate-200',
    symbol: '-',
  },
};

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

export const DAY_ID_TO_WEEKDAY = {
  '2': 1, // Thứ 2 = Monday
  '3': 2, // Thứ 3 = Tuesday
  '4': 3, // Thứ 4 = Wednesday
  '5': 4, // Thứ 5 = Thursday
  '6': 5, // Thứ 6 = Friday
  '7': 6, // Thứ 7 = Saturday
  'CN': 0, // Chủ Nhật = Sunday
  '8': 0,
  'cn': 0,
  '0': 0,
};

export const WEEKDAY_TO_DAY_ID = {
  1: '2',
  2: '3',
  3: '4',
  4: '5',
  5: '6',
  6: '7',
  0: 'CN',
};

export const WEEKDAY_LABELS = {
  '2': { label: 'Thứ 2', short: 'T2' },
  '3': { label: 'Thứ 3', short: 'T3' },
  '4': { label: 'Thứ 4', short: 'T4' },
  '5': { label: 'Thứ 5', short: 'T5' },
  '6': { label: 'Thứ 6', short: 'T6' },
  '7': { label: 'Thứ 7', short: 'T7' },
  'CN': { label: 'Chủ Nhật', short: 'CN' },
};

/**
 * Generate sessions strictly synchronized with the class's weekly schedule (Timetable).
 * Solves the issue where independent/misaligned date generation causes students to be falsely marked absent.
 *
 * @param {Object} classItem - The course class object with { schedules, studyStart, studyEnd, room }
 * @param {Array} existingRecords - Any attendance records already stored in database
 * @returns {Array} Array of sessions sorted chronologically: [{ sessionNumber, date, shortDate, dayId, dayShort, dayName, shiftId, shiftLabel, isScheduled, isMakeUp }]
 */
export function generateScheduleAlignedSessions(classItem, existingRecords = []) {
  const sessionMap = new Map();
  const schedules = Array.isArray(classItem?.schedules) ? classItem.schedules : [];

  // Parse schedules into target days of week
  const targetDays = schedules
    .map((s) => {
      const rawDay = String(s.dayId || s.dayOfWeek || '').trim();
      const dayOfWeek = DAY_ID_TO_WEEKDAY[rawDay];
      if (dayOfWeek === undefined) return null;
      return {
        dayOfWeek,
        dayId: rawDay.toUpperCase() === 'CN' ? 'CN' : rawDay,
        shiftId: String(s.shiftId || '1'),
      };
    })
    .filter(Boolean);

  // If class has no schedule defined, fallback to target days present in existing records
  if (targetDays.length === 0 && Array.isArray(existingRecords) && existingRecords.length > 0) {
    const presentWeekdays = new Set();
    existingRecords.forEach((r) => {
      if (!r?.date) return;
      const d = new Date(`${String(r.date).slice(0, 10)}T12:00:00`);
      if (!isNaN(d.getTime())) {
        presentWeekdays.add(d.getDay());
      }
    });

    if (presentWeekdays.size > 0) {
      presentWeekdays.forEach((dayOfWeek) => {
        const dayId = WEEKDAY_TO_DAY_ID[dayOfWeek] || '2';
        targetDays.push({
          dayOfWeek,
          dayId,
          shiftId: '1',
        });
      });
    }
  }

  // Determine study date range
  const now = new Date();
  let startDate = classItem?.studyStart ? new Date(`${String(classItem.studyStart).slice(0, 10)}T00:00:00`) : null;
  let endDate = classItem?.studyEnd ? new Date(`${String(classItem.studyEnd).slice(0, 10)}T23:59:59`) : null;

  // Fallback date window if not defined: 4 weeks before today up to 4 weeks after today
  if (!startDate || isNaN(startDate.getTime())) {
    startDate = new Date(now);
    startDate.setDate(now.getDate() - 28);
  }
  if (!endDate || isNaN(endDate.getTime())) {
    endDate = new Date(now);
    endDate.setDate(now.getDate() + 28);
  }

  // Cap generation at a max of 20 scheduled sessions to avoid overflow
  const MAX_SCHEDULED_SESSIONS = 20;
  let scheduledCount = 0;

  if (targetDays.length > 0) {
    const cur = new Date(startDate);
    while (cur <= endDate && scheduledCount < MAX_SCHEDULED_SESSIONS) {
      const dayOfWeek = cur.getDay();
      const matchingTargets = targetDays.filter((t) => t.dayOfWeek === dayOfWeek);

      matchingTargets.forEach((target) => {
        const yyyy = cur.getFullYear();
        const mm = String(cur.getMonth() + 1).padStart(2, '0');
        const dd = String(cur.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;
        const shortDate = `${dd}/${mm}`;
        const dayInfo = WEEKDAY_LABELS[target.dayId] || { label: `Thứ ${target.dayId}`, short: `T${target.dayId}` };

        if (!sessionMap.has(dateStr)) {
          sessionMap.set(dateStr, {
            date: dateStr,
            shortDate,
            dayId: target.dayId,
            dayOfWeek: target.dayOfWeek,
            dayName: dayInfo.label,
            dayShort: dayInfo.short,
            shiftId: target.shiftId,
            shiftLabel: getShiftLabel(target.shiftId),
            isScheduled: true,
          });
          scheduledCount += 1;
        }
      });

      cur.setDate(cur.getDate() + 1);
    }
  }

  // Step 2: Merge in any existing attendance records that occurred outside regular schedules (e.g., make-up classes)
  if (Array.isArray(existingRecords)) {
    existingRecords.forEach((r) => {
      if (!r?.date) return;
      const rawDate = String(r.date).slice(0, 10);
      if (!sessionMap.has(rawDate)) {
        const d = new Date(`${rawDate}T12:00:00`);
        if (!isNaN(d.getTime())) {
          const dayOfWeek = d.getDay();
          const dayId = WEEKDAY_TO_DAY_ID[dayOfWeek] || '2';
          const dayInfo = WEEKDAY_LABELS[dayId] || { label: 'Buổi học', short: 'BH' };
          const dd = String(d.getDate()).padStart(2, '0');
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const shiftId = String(r.shiftId || '1');

          sessionMap.set(rawDate, {
            date: rawDate,
            shortDate: `${dd}/${mm}`,
            dayId,
            dayOfWeek,
            dayName: `${dayInfo.label} (Bù)`,
            dayShort: dayInfo.short,
            shiftId,
            shiftLabel: getShiftLabel(shiftId, r.shiftLabel),
            isScheduled: false,
            isMakeUp: true,
          });
        }
      }
    });
  }

  // Step 3: If still completely empty (no schedule, no records), generate default placeholder session for today
  if (sessionMap.size === 0) {
    const todayStr = getTodayDateString();
    const d = new Date(`${todayStr}T12:00:00`);
    const dayOfWeek = d.getDay();
    const dayId = WEEKDAY_TO_DAY_ID[dayOfWeek] || '2';
    const dayInfo = WEEKDAY_LABELS[dayId] || { label: 'Hôm nay', short: 'HN' };
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');

    sessionMap.set(todayStr, {
      date: todayStr,
      shortDate: `${dd}/${mm}`,
      dayId,
      dayOfWeek,
      dayName: dayInfo.label,
      dayShort: dayInfo.short,
      shiftId: '1',
      shiftLabel: getShiftLabel('1'),
      isScheduled: true,
    });

    // Add 4 more weekly sessions ahead
    for (let i = 1; i <= 4; i++) {
      const nextDate = new Date(d);
      nextDate.setDate(d.getDate() + i * 7);
      const yyyy = nextDate.getFullYear();
      const mm = String(nextDate.getMonth() + 1).padStart(2, '0');
      const dd = String(nextDate.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;
      sessionMap.set(dateStr, {
        date: dateStr,
        shortDate: `${dd}/${mm}`,
        dayId: '2',
        dayOfWeek: 1,
        dayName: 'Thứ 2',
        dayShort: 'T2',
        shiftId: '1',
        shiftLabel: getShiftLabel('1'),
        isScheduled: true,
      });
    }
  }

  // Step 4: Sort sessions chronologically and assign stable session numbers (#1, #2,...)
  const sortedSessions = Array.from(sessionMap.values()).sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return sortedSessions.map((s, idx) => ({
    ...s,
    sessionNumber: idx + 1,
  }));
}
