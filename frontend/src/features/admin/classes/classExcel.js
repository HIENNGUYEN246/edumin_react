const HEADERS = {
  id: ['malhp', 'malophocphan', 'malop', 'classcode'],
  courseId: ['mahp', 'mahocphan', 'mamonhoc', 'coursecode'],
  className: ['tenlhp', 'tenlophocphan', 'tenlop', 'classname'],
  teacher: ['magv', 'magiaovien', 'giangvien', 'giaovien', 'teacher'],
  room: ['phonghoc', 'phong', 'room'],
  capacity: ['sisotoida', 'siso', 'capacity'],
  schedules: ['lichhoc', 'lichhocthutiet', 'schedule'],
  days: ['thu', 'thuhoctrongtuan', 'days'],
  shifts: ['ca', 'cahoctrongtuan', 'shifts'],
  registrationStart: ['batdaudk', 'batdaudangky', 'thoigianbatdaudangky', 'registrationstart'],
  registrationEnd: ['ketthucdk', 'ketthucdangky', 'thoigianketthucdangky', 'registrationend'],
  studyStart: ['batdauhoc', 'ngaybatdauhoc', 'studystart'],
  studyEnd: ['ketthuchoc', 'ngayketthuchoc', 'studyend'],
  status: ['trangthai', 'status'],
};

function normalizeHeader(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]/g, '');
}

function rowValues(row) {
  return new Map(Object.entries(row).map(([key, value]) => [normalizeHeader(key), value]));
}

function valueFor(values, aliases) {
  const key = aliases.find((alias) => values.has(alias));
  return key ? values.get(key) : '';
}

function cellString(value) {
  return value == null ? '' : String(value).trim();
}

function formatDateParts(year, month, day) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseDateCell(value, field, includeTime) {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    const date = formatDateParts(value.getFullYear(), value.getMonth() + 1, value.getDate());
    if (!includeTime) return date;
    return `${date}T${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const minutesSinceEpoch = Math.round(value * 24 * 60);
    const date = new Date(Date.UTC(1899, 11, 30) + minutesSinceEpoch * 60_000);
    const dateString = formatDateParts(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
    if (!includeTime) return dateString;
    return `${dateString}T${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
  }

  const text = cellString(value);
  if (!text) throw new Error(`Thiếu ${field}`);

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?$/);
  if (iso) {
    if (includeTime && (iso[4] === undefined || iso[5] === undefined)) {
      throw new Error(`${field} cần có cả ngày và giờ (VD: 2026-10-10 08:00)`);
    }
    return includeTime ? `${iso[1]}-${iso[2]}-${iso[3]}T${iso[4]}:${iso[5]}` : `${iso[1]}-${iso[2]}-${iso[3]}`;
  }

  const vietnamese = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (vietnamese) {
    if (includeTime && (vietnamese[4] === undefined || vietnamese[5] === undefined)) {
      throw new Error(`${field} cần có cả ngày và giờ (VD: 10/10/2026 08:00)`);
    }
    const date = formatDateParts(vietnamese[3], vietnamese[2], vietnamese[1]);
    return includeTime ? `${date}T${vietnamese[4].padStart(2, '0')}:${vietnamese[5]}` : date;
  }

  throw new Error(`${field} không đúng định dạng ngày${includeTime ? ' giờ' : ''}`);
}

function parseCapacity(value) {
  const capacity = Number(value);
  if (!Number.isInteger(capacity) || capacity < 10) {
    throw new Error('Sĩ số tối đa phải là số nguyên lớn hơn hoặc bằng 10');
  }
  return capacity;
}

function parseTeacherId(value, teachers) {
  const text = cellString(value);
  if (!text) throw new Error('Thiếu mã giáo viên (VD: GV-001)');
  const match = text.match(/^(?:GV-?)?(\d+)$/i);
  const teacher = match
    ? teachers.find((item) => Number(item.id) === Number(match[1]))
    : teachers.find((item) => item.hoTen?.trim().toLowerCase() === text.toLowerCase());
  if (!teacher) throw new Error(`Không tìm thấy giáo viên "${text}"`);
  return teacher.id;
}

function parseSchedules(value, daysValue, shiftsValue) {
  if (daysValue !== undefined || shiftsValue !== undefined) {
    const days = cellString(daysValue).split(',').map((day) => day.trim()).filter(Boolean);
    const shifts = cellString(shiftsValue).split(',').map((shift) => shift.trim()).filter(Boolean);
    if (!days.length || !shifts.length) throw new Error('Thiếu Thứ hoặc Ca');
    if (days.length !== shifts.length) throw new Error('Số giá trị trong cột Thứ và Ca phải bằng nhau');
    const slots = days.map((day, index) => {
      const normalizedDay = normalizeHeader(day);
      const dayId = /^\d+$/.test(day) ? day : new Map([
        ['t2', '2'], ['thu2', '2'],
        ['t3', '3'], ['thu3', '3'],
        ['t4', '4'], ['thu4', '4'],
        ['t5', '5'], ['thu5', '5'],
        ['t6', '6'], ['thu6', '6'],
        ['t7', '7'], ['thu7', '7'],
        ['cn', 'CN'], ['chunhat', 'CN'],
      ]).get(normalizedDay);
      const shiftId = shifts[index].toUpperCase();
      if (!['2', '3', '4', '5', '6', '7', 'CN'].includes(dayId)) {
        throw new Error(`Thứ "${day}" không hợp lệ`);
      }
      if (!['S1', 'S2', 'C1', 'C2', 'T1'].includes(shiftId)) {
        throw new Error(`Ca "${shifts[index]}" không hợp lệ`);
      }
      return { dayId, shiftId };
    });
    if (new Set(slots.map(({ dayId, shiftId }) => `${dayId}:${shiftId}`)).size !== slots.length) {
      throw new Error('Lịch học bị lặp buổi');
    }
    return slots;
  }

  const text = cellString(value);
  if (!text) throw new Error('Thiếu lịch học (VD: T2-S1;T4-C1)');
  const dayIds = new Map([
    ['t2', '2'], ['thu2', '2'],
    ['t3', '3'], ['thu3', '3'],
    ['t4', '4'], ['thu4', '4'],
    ['t5', '5'], ['thu5', '5'],
    ['t6', '6'], ['thu6', '6'],
    ['t7', '7'], ['thu7', '7'],
    ['cn', 'CN'], ['chunhat', 'CN'],
  ]);
  const slots = text.split(/[;,|]/).map((entry) => {
    const match = entry.trim().match(/^([a-zA-Z0-9À-ỹ ]+?)\s*[-:]\s*(S1|S2|C1|C2|T1)$/i);
    if (!match) throw new Error(`Lịch học "${entry}" không hợp lệ; dùng dạng T2-S1;T4-C1`);
    const day = normalizeHeader(match[1]);
    const dayId = dayIds.get(day);
    const shiftId = match[2].toUpperCase();
    if (!dayId) throw new Error(`Thứ "${match[1]}" không hợp lệ`);
    return { dayId, shiftId };
  });
  if (new Set(slots.map(({ dayId, shiftId }) => `${dayId}:${shiftId}`)).size !== slots.length) {
    throw new Error('Lịch học bị lặp buổi');
  }
  return slots;
}

export function classImportPayload(row, courseId, teachers) {
  const values = rowValues(row);
  const importedCourseId = cellString(valueFor(values, HEADERS.courseId));
  if (importedCourseId && importedCourseId.toLowerCase() !== courseId.toLowerCase()) {
    throw new Error(`Mã học phần phải là ${courseId}`);
  }

  const className = cellString(valueFor(values, HEADERS.className));
  const room = cellString(valueFor(values, HEADERS.room));
  const status = cellString(valueFor(values, HEADERS.status));
  if (!className) throw new Error('Thiếu tên lớp học phần');
  if (!room) throw new Error('Thiếu phòng học');
  if (status && !['Nháp', 'Đang mở', 'Đã đóng', 'Đã hủy'].includes(status)) {
    throw new Error('Trạng thái phải là Nháp, Đang mở, Đã đóng hoặc Đã hủy');
  }

  const teacherValue = cellString(valueFor(values, HEADERS.teacher))
    || cellString(valueFor(values, ['giangvien', 'giaovien', 'teacher']));
  const hasScheduleDays = HEADERS.days.some((alias) => values.has(alias));
  const hasScheduleShifts = HEADERS.shifts.some((alias) => values.has(alias));
  return {
    id: cellString(valueFor(values, HEADERS.id)),
    courseId,
    className,
    teacherId: parseTeacherId(teacherValue, teachers),
    room,
    capacity: parseCapacity(valueFor(values, HEADERS.capacity)),
    schedules: parseSchedules(
      valueFor(values, HEADERS.schedules),
      hasScheduleDays ? valueFor(values, HEADERS.days) : undefined,
      hasScheduleShifts ? valueFor(values, HEADERS.shifts) : undefined,
    ),
    registrationStart: parseDateCell(valueFor(values, HEADERS.registrationStart), 'Thời gian bắt đầu đăng ký', true),
    registrationEnd: parseDateCell(valueFor(values, HEADERS.registrationEnd), 'Thời gian kết thúc đăng ký', true),
    studyStart: parseDateCell(valueFor(values, HEADERS.studyStart), 'Ngày bắt đầu học', false),
    studyEnd: parseDateCell(valueFor(values, HEADERS.studyEnd), 'Ngày kết thúc học', false),
    status: status || 'Nháp',
  };
}

export function classExportRow(cls) {
  const formatDate = (value, includeTime = false) => {
    if (!value) return '';
    const text = String(value);
    return includeTime ? text.slice(0, 16).replace('T', ' ') : text.slice(0, 10);
  };
  const teacherCode = cls.teacherId
    ? `GV-${String(cls.teacherId).replace(/^GV-?/i, '').padStart(3, '0')}`
    : '';
  return {
    MaHP: cls.courseId || '',
    MaLHP: cls.id || '',
    TenLHP: cls.className || '',
    Siso: cls.capacity ?? '',
    NgayBatDauHoc: formatDate(cls.studyStart),
    NgayKetThucHoc: formatDate(cls.studyEnd),
    BatDauDK: formatDate(cls.registrationStart, true),
    KetThucDK: formatDate(cls.registrationEnd, true),
    MaGV: teacherCode,
    GiangVien: cls.teacher || '',
    Phong: cls.room || '',
    Thu: (cls.schedules || []).map(({ dayId }) => dayId).join(','),
    Ca: (cls.schedules || []).map(({ shiftId }) => shiftId).join(','),
  };
}
