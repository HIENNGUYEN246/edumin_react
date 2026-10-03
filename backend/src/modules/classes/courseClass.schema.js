import { z } from 'zod';

const scheduleSlot = z.object({
  dayId: z.string().trim().min(1),
  shiftId: z.string().trim().min(1),
});

const CLASS_STATUS = ['Nháp', 'Đang mở', 'Đã đóng', 'Đã hủy'];

export const baseClassSchema = z.object({
  id: z.string().trim().max(40).optional().default(''),
  courseId: z.string().trim().min(1, 'Chọn học phần'),
  teacherId: z.coerce.number().int().positive().optional().nullable(),
  room: z.string().trim().optional().default(''),
  capacity: z.coerce.number().int().min(0).optional().default(0),
  schedules: z.array(scheduleSlot).min(1, 'Cần ít nhất một buổi học'),
  studyStart: z.string().trim().optional().default(''),
  studyEnd: z.string().trim().optional().default(''),
  status: z.enum(CLASS_STATUS).optional().default('Nháp'),
});

const check15Weeks = (data) => {
  if (data.studyStart && data.studyEnd) {
    const [sy, sm, sd] = data.studyStart.split('-').map(Number);
    const [ey, em, ed] = data.studyEnd.split('-').map(Number);
    if (sy && sm && sd && ey && em && ed) {
      const minEnd = new Date(sy, sm - 1, sd);
      minEnd.setDate(minEnd.getDate() + 15 * 7);
      const end = new Date(ey, em - 1, ed);
      return end >= minEnd;
    }
  }
  return true;
};

export const createClassSchema = baseClassSchema.refine(check15Weeks, {
  message: 'Ngày kết thúc bắt buộc phải diễn ra sau ít nhất 15 tuần kể từ ngày bắt đầu học phần',
  path: ['studyEnd'],
});

export const updateClassSchema = baseClassSchema
  .partial()
  .omit({ id: true })
  .refine(check15Weeks, {
    message: 'Ngày kết thúc bắt buộc phải diễn ra sau ít nhất 15 tuần kể từ ngày bắt đầu học phần',
    path: ['studyEnd'],
  });

export const changeStatusSchema = z.object({
  status: z.enum(CLASS_STATUS),
});
