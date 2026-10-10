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
const registrationDateOrDateTime = z.string().refine((value) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    const [date, time] = value.split('T');
    const parsedDate = new Date(`${date}T00:00:00.000Z`);
    const [hour, minute] = time.split(':').map(Number);
    return (
      !Number.isNaN(parsedDate.valueOf()) &&
      parsedDate.toISOString().slice(0, 10) === date &&
      hour <= 23 &&
      minute <= 59
    );
  }
  return false;
}, 'Ngày giờ không hợp lệ');

export const gradeWeightsSchema = z.object({
  attendance: z.coerce.number().min(0).max(100).default(10),
  homework: z.coerce.number().min(0).max(100).default(10),
  midterm: z.coerce.number().min(0).max(100).default(30),
  presentation: z.coerce.number().min(0).max(100).default(0),
  final: z.coerce.number().min(0).max(100).default(50),
}).refine(
  (weights) => {
    const sum = (Number(weights.attendance) || 0) +
      (Number(weights.homework) || 0) +
      (Number(weights.midterm) || 0) +
      (Number(weights.presentation) || 0) +
      (Number(weights.final) || 0);
    return Math.abs(sum - 100) < 0.01;
  },
  { message: 'Tổng tỷ lệ phần trăm trọng số điểm phải bằng đúng 100%' }
);

export const baseClassSchema = z.object({
  id: z.string().trim().max(40).optional().default(''),
  courseId: z.string().trim().min(1, 'Chọn học phần'),
  className: z.string().trim().min(1, 'Nhập tên lớp học phần').max(120, 'Tên lớp học phần không vượt quá 120 ký tự'),
  teacherId: z.coerce.number().int().positive({ message: 'Chọn giáo viên phụ trách' }),
  room: z.string().trim().min(1, 'Nhập phòng học'),
  capacity: z.number().int().min(10, 'Sĩ số tối đa phải lớn hơn hoặc bằng 10'),
  fee: z.coerce.number().min(0).optional(),
  schedules: z.array(scheduleSlot)
    .min(1, 'Cần ít nhất một buổi học')
    .refine((slots) => new Set(slots.map((slot) => `${slot.dayId}:${slot.shiftId}`)).size === slots.length, 'Lịch học không được trùng buổi'),
  studyStart: dateOnly,
  studyEnd: dateOnly,
  registrationStart: registrationDateOrDateTime,
  registrationEnd: registrationDateOrDateTime,
  gradeWeights: gradeWeightsSchema.optional().default({
    attendance: 10,
    homework: 10,
    midterm: 30,
    presentation: 0,
    final: 50,
  }),
  midtermQuizId: z.string().nullable().optional(),
  finalQuizId: z.string().nullable().optional(),
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

function studyStartAfterRegistrationEnd(data) {
  if (!data.studyStart || !data.registrationEnd) return true;
  return data.studyStart.slice(0, 10) > data.registrationEnd.slice(0, 10);
}

function registrationPeriodIsValid(data) {
  if (!data.registrationStart || !data.registrationEnd) return true;
  return data.registrationEnd > data.registrationStart;
}

export const createClassSchema = baseClassSchema
  .refine(registrationPeriodIsValid, {
    message: 'Thời gian kết thúc đăng ký phải sau thời gian bắt đầu đăng ký',
    path: ['registrationEnd'],
  })
  .refine(studyStartAfterRegistrationEnd, {
    message: 'Thời điểm bắt đầu học bắt buộc phải diễn ra sau thời điểm kết thúc đăng ký',
    path: ['studyStart'],
  })
  .refine(studyPeriodIsValid, {
    message: 'Ngày kết thúc bắt buộc phải diễn ra sau ít nhất 15 tuần kể từ ngày bắt đầu học phần',
    path: ['studyEnd'],
  });

export const updateClassSchema = baseClassSchema
  .partial()
  .omit({ id: true })
  .refine(registrationPeriodIsValid, {
    message: 'Thời gian kết thúc đăng ký phải sau thời gian bắt đầu đăng ký',
    path: ['registrationEnd'],
  })
  .refine(studyStartAfterRegistrationEnd, {
    message: 'Thời điểm bắt đầu học bắt buộc phải diễn ra sau thời điểm kết thúc đăng ký',
    path: ['studyStart'],
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
  reason: z.string().trim().optional(),
});

export const updateGradeConfigSchema = z
  .object({
    midtermQuizId: z.union([z.string().trim(), z.null()]).optional(),
    finalQuizId: z.union([z.string().trim(), z.null()]).optional(),
  })
  .refine(
    (data) => !data.midtermQuizId || !data.finalQuizId || data.midtermQuizId !== data.finalQuizId,
    {
      message: 'Không thể chọn cùng một bài Quiz cho cả Giữa kỳ và Cuối kỳ',
      path: ['finalQuizId'],
    }
  );
