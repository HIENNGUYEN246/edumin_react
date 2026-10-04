import { z } from 'zod';

const stringOrEmpty = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => (v ?? '').trim());

const base = {
  hoTen: z.string().trim().min(2, 'Họ tên phải có ít nhất 2 ký tự').max(120),
  email: z.string().trim().toLowerCase().email('Email không hợp lệ'),
  dob: stringOrEmpty,
  gender: z.union([z.enum(['Nam', 'Nữ', 'Khác']), z.null(), z.undefined(), z.literal('')]).transform((v) => v || 'Nam'),
  address: stringOrEmpty,
  phone: stringOrEmpty,
  className: stringOrEmpty,
  education: z.union([z.string(), z.null(), z.undefined()]).transform((v) => (v ? v.trim() : 'Chính quy')),
  departmentId: stringOrEmpty,
};

export const createStudentSchema = z.object({
  ...base,
  password: z.string().optional().default('123'),
});

export const updateStudentSchema = z.object({
  hoTen: base.hoTen.optional(),
  dob: base.dob.optional(),
  gender: base.gender.optional(),
  address: base.address.optional(),
  phone: base.phone.optional(),
  className: base.className.optional(),
  education: base.education.optional(),
  departmentId: base.departmentId.optional(),
});

export const importStudentsSchema = z.object({
  rows: z.array(z.record(z.any())).min(1, 'Danh sách rỗng'),
});

export const registerSchema = z.object({
  hoTen: z.string().trim().min(2, 'Họ tên phải có ít nhất 2 ký tự').max(120),
  email: z.string().trim().toLowerCase().email('Email không hợp lệ'),
  password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự'),
  departmentId: z.string().trim().min(1, 'Vui lòng chọn khoa'),
  className: z.string().trim().optional().default(''),
});
