import registrationAPI from '../services/registrationAPI';

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

export const OPEN_REGISTRATIONS_UPDATED_EVENT = 'edumin:openRegistrationsUpdated';
export const STUDENT_REGISTRATIONS_UPDATED_EVENT = 'edumin:studentRegistrationsUpdated';

export function dispatchOpenRegistrationsUpdated() {
  window.dispatchEvent(new CustomEvent(OPEN_REGISTRATIONS_UPDATED_EVENT));
}

export function dispatchStudentRegistrationsUpdated() {
  window.dispatchEvent(new CustomEvent(STUDENT_REGISTRATIONS_UPDATED_EVENT));
}

export function isRegistrationExpired(reg, now = new Date()) {
  if (!reg?.start || !reg?.end) return true;
  const start = new Date(reg.start);
  const end = new Date(reg.end);
  if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf())) return true;
  return now > end || now < start;
}

export function getRegistrationStatusLabel(reg, now = new Date()) {
  return isRegistrationExpired(reg, now) ? 'Hết hạn/Chưa mở' : 'Đang mở';
}

export function checkCourseExists(existingRegs, courseId) {
  return existingRegs.some((reg) => reg.courseId === courseId);
}

export function checkConflict(existingRegs, teacherId, room, newSchedules) {
  for (const reg of existingRegs) {
    for (const newSched of newSchedules) {
      for (const oldSched of reg.schedules || []) {
        if (newSched.dayId === oldSched.dayId && newSched.shiftId === oldSched.shiftId) {
          if (reg.teacherId == teacherId) {
            return `Giảng viên có mã ${teacherId} (${reg.teacher}) trùng lịch dạy (${newSched.dayLabel}, ${newSched.shiftLabel}) tại lớp ${reg.courseName}.`;
          }
          if (reg.room === room) {
            return `Phòng ${room} đã bận (${newSched.dayLabel}, ${newSched.shiftLabel}) bởi lớp ${reg.courseName}.`;
          }
        }
      }
    }
  }
  return null;
}

export function checkInternalConflict(teacherId, room, schedules, batch) {
  for (const item of batch) {
    for (const newS of schedules) {
      for (const oldS of item.schedules || []) {
        if (newS.dayId === oldS.dayId && newS.shiftId === oldS.shiftId) {
          if (item.teacherId == teacherId) {
            return `Lỗi: Giảng viên mã ${teacherId} bị trùng lịch giữa các lớp đang chọn!`;
          }
          if (item.room === room) {
            return `Lỗi: Phòng ${room} bị trùng lịch sử dụng giữa các lớp đang chọn!`;
          }
        }
      }
    }
  }
  return null;
}

export function getSessionFromShiftId(shiftId) {
  return SHIFTS.find((s) => s.id === shiftId)?.group || null;
}

export function padTeacherID(id) {
  if (id == null || id === '') return 'N/A';
  return `GV-${String(id).padStart(3, '0')}`;
}

export async function fetchOpenRegistrations({ fresh = false } = {}) {
  return registrationAPI.getOpenRegistrations({ fresh });
}

export async function saveOpenRegistrations(regs) {
  const saved = await registrationAPI.saveOpenRegistrations(regs);
  dispatchOpenRegistrationsUpdated();
  return saved;
}

export async function fetchStudentRegistrations({ fresh = false } = {}) {
  return registrationAPI.getStudentRegistrations({ fresh });
}

export async function saveStudentRegistrations(enrollments) {
  const saved = await registrationAPI.saveStudentRegistrations(enrollments);
  dispatchStudentRegistrationsUpdated();
  return saved;
}
