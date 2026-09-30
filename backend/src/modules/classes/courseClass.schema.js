import { z } from 'zod';

const scheduleSlot = z.object({
  dayId: z.string().trim().min(1),
  shiftId: z.string().trim().min(1),
});

const CLASS_STATUS = ['Nháp', 'Đang mở', 'Đã đóng', 'Đã hủy'];

export const createClassSchema = z.object({
  id: z.string().trim().min(1, 'Mã lớp là bắt buộc').max(40),
  courseId: z.string().trim().min(1, 'Chọn học phần'),
  teacherId: z.coerce.number().int().positive().optional().nullable(),
  room: z.string().trim().optional().default(''),
  capacity: z.coerce.number().int().min(0).optional().default(0),
  schedules: z.array(scheduleSlot).min(1, 'Cần ít nhất một buổi học'),
  studyStart: z.string().trim().optional().default(''),
  studyEnd: z.string().trim().optional().default(''),
  status: z.enum(CLASS_STATUS).optional().default('Nháp'),
});

export const updateClassSchema = createClassSchema.partial().omit({ id: true });

export const changeStatusSchema = z.object({
  status: z.enum(CLASS_STATUS),
});
