import { z } from 'zod';

const scheduleSlot = z.object({
  dayId: z.string().trim().min(1),
  shiftId: z.string().trim().min(1),
});

const CLASS_STATUS = ['Nháp', 'Đang mở', 'Đã đóng', 'Đã hủy'];
const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
  }, 'Ngày không hợp lệ');
const registrationDateTime = z.string().refine((value) => {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return false;
  const [date, time] = value.split('T');
  const parsedDate = new Date(`${date}T00:00:00.000Z`);
  const [hour, minute] = time.split(':').map(Number);
  return (
    !Number.isNaN(parsedDate.valueOf()) &&
    parsedDate.toISOString().slice(0, 10) === date &&
    hour <= 23 &&
    minute <= 59
  );
}, 'Ngày giờ không hợp lệ');

export const baseClassSchema = z.object({
  id: z.string().trim().max(40).optional().default(''),
  courseId: z.string().trim().min(1, 'Chọn học phần'),
  className: z.string().trim().min(1, 'Nhập tên lớp học phần').max(120, 'Tên lớp học phần không vượt quá 120 ký tự'),
  teacherId: z.coerce.number().int().positive({ message: 'Chọn giáo viên phụ trách' }),
  room: z.string().trim().min(1, 'Nhập phòng học'),
  capacity: z.number().int().min(10, 'Sĩ số tối đa phải lớn hơn hoặc bằng 10'),
  schedules: z.array(scheduleSlot)
    .min(1, 'Cần ít nhất một buổi học')
    .refine((slots) => new Set(slots.map((slot) => `${slot.dayId}:${slot.shiftId}`)).size === slots.length, 'Lịch học không được trùng buổi'),
  studyStart: dateOnly,
  studyEnd: dateOnly,
  registrationStart: registrationDateTime,
  registrationEnd: registrationDateTime,
  status: z.enum(CLASS_STATUS),
});

function studyPeriodIsValid(data) {
  const [sy, sm, sd] = data.studyStart.split('-').map(Number);
  const [ey, em, ed] = data.studyEnd.split('-').map(Number);
  if (![sy, sm, sd, ey, em, ed].every(Boolean)) return true;
  const minimumEnd = new Date(sy, sm - 1, sd);
  minimumEnd.setDate(minimumEnd.getDate() + 15 * 7);
  return new Date(ey, em - 1, ed) >= minimumEnd;
}

function updateStudyPeriodIsValid(data) {
  if (!data.studyStart || !data.studyEnd) return true;
  return studyPeriodIsValid(data);
}

export const createClassSchema = baseClassSchema
  .refine((data) => data.registrationEnd > data.registrationStart, {
  message: 'Thời gian kết thúc đăng ký phải sau thời gian bắt đầu đăng ký',
  path: ['registrationEnd'],
  })
  .refine(studyPeriodIsValid, {
  message: 'Ngày kết thúc bắt buộc phải diễn ra sau ít nhất 15 tuần kể từ ngày bắt đầu học phần',
  path: ['studyEnd'],
  });

export const updateClassSchema = baseClassSchema
  .partial()
  .omit({ id: true })
  .refine((data) => !(data.registrationStart && data.registrationEnd) || data.registrationEnd > data.registrationStart, {
    message: 'Thời gian kết thúc đăng ký phải sau thời gian bắt đầu đăng ký',
    path: ['registrationEnd'],
  })
  .refine(updateStudyPeriodIsValid, {
    message: 'Ngày kết thúc bắt buộc phải diễn ra sau ít nhất 15 tuần kể từ ngày bắt đầu học phần',
    path: ['studyEnd'],
  });

export const changeStatusSchema = z.object({
  status: z.enum(CLASS_STATUS),
});

const manualGrade = z.coerce.number().min(0).max(10).nullable().optional();

export const updateStudentGradesSchema = z.object({
  grades: z.object({
    attendance: manualGrade,
    midterm: manualGrade,
    assignment: manualGrade,
    presentation: manualGrade,
    practical: manualGrade,
    final: manualGrade,
  }).strict().refine((grades) => Object.keys(grades).length > 0, 'Nhập ít nhất một điểm'),
});
