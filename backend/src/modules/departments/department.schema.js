import { z } from 'zod';

export const createDepartmentSchema = z.object({
  id: z.string().trim().min(1, 'Mã khoa là bắt buộc').max(20),
  name: z.string().trim().min(1, 'Tên khoa là bắt buộc').max(200),
  head: z.string().trim().optional().nullable(),
});

export const updateDepartmentSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  head: z.string().trim().nullable().optional(),
});
