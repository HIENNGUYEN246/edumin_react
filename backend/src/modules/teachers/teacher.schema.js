import { z } from 'zod';

const base = {
  hoTen: z.string().trim().min(2, 'Họ tên phải có ít nhất 2 ký tự').max(120),
  email: z.string().trim().toLowerCase().email('Email không hợp lệ'),
  dob: z.string().trim().optional().default(''),
  gender: z.enum(['Nam', 'Nữ', 'Khác']).optional().default('Nam'),
  address: z.string().trim().optional().default(''),
  phone: z.string().trim().optional().default(''),
  education: z.string().trim().optional().default(''),
  departmentId: z.string().trim().optional().default(''),
};

export const createTeacherSchema = z.object({
  ...base,
  password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự').optional(),
});

export const updateTeacherSchema = z.object({
  hoTen: base.hoTen.optional(),
  dob: base.dob,
  gender: base.gender,
  address: base.address,
  phone: base.phone,
  education: base.education,
  departmentId: base.departmentId,
});

export const importTeachersSchema = z.object({
  rows: z.array(z.record(z.any())).min(1, 'Danh sách rỗng'),
});
