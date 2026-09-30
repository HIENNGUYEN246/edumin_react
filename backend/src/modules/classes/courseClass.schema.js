import { z } from 'zod';

const scheduleSlot = z.object({
  dayId: z.string().trim().min(1),
  shiftId: z.string().trim().min(1),
});

export const createClassSchema = z.object({
  id: z.string().trim().min(1, 'Mã lớp là bắt buộc').max(40),
  courseId: z.string().trim().min(1, 'Chọn học phần'),
  teacherId: z.coerce.number().int().positive().optional().nullable(),
  room: z.string().trim().optional().default(''),
  schedules: z.array(scheduleSlot).min(1, 'Cần ít nhất một buổi học'),
  studyStart: z.string().trim().optional().default(''),
  studyEnd: z.string().trim().optional().default(''),
  start: z.string().trim().optional().default(''),
  end: z.string().trim().optional().default(''),
  status: z.enum(['Đang mở', 'Đã đóng']).optional().default('Đang mở'),
});

export const updateClassSchema = createClassSchema.partial().omit({ id: true });
