import { z } from 'zod';
import { gradeWeightsSchema } from '../classes/courseClass.schema.js';

export const createCourseSchema = z.object({
  id: z.string().trim().min(1, 'Mã học phần là bắt buộc').max(30),
  name: z.string().trim().min(1, 'Tên học phần là bắt buộc').max(200),
  credits: z.coerce.number().min(0).max(20).optional().default(0),
  fee: z.coerce.number().min(0).optional().default(0),
  departmentId: z.string().trim().optional().default(''),
  courseType: z.enum(['LT', 'TH', 'LT_TH']).optional().default('LT_TH'),
  theoryPeriods: z.coerce.number().min(0).optional().default(0),
  practicePeriods: z.coerce.number().min(0).optional().default(0),
  prerequisites: z.string().trim().optional().default(''),
  description: z.string().trim().optional().default(''),
  gradeWeights: gradeWeightsSchema.optional(),
});

export const updateCourseSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  credits: z.coerce.number().min(0).max(20).optional(),
  fee: z.coerce.number().min(0).optional(),
  departmentId: z.string().trim().optional(),
  courseType: z.enum(['LT', 'TH', 'LT_TH']).optional(),
  theoryPeriods: z.coerce.number().min(0).optional(),
  practicePeriods: z.coerce.number().min(0).optional(),
  prerequisites: z.string().trim().optional(),
  description: z.string().trim().optional(),
  gradeWeights: gradeWeightsSchema.optional(),
});

export const importCoursesSchema = z.object({
  rows: z.array(z.record(z.any())).min(1, 'Danh sách rỗng'),
});
