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
  education: stringOrEmpty,
  departmentId: stringOrEmpty,
};

export const createTeacherSchema = z.object({
  ...base,
  password: z.string().optional().default('123'),
});

export const updateTeacherSchema = z.object({
  hoTen: base.hoTen.optional(),
  dob: base.dob.optional(),
  gender: base.gender.optional(),
  address: base.address.optional(),
  phone: base.phone.optional(),
  education: base.education.optional(),
  departmentId: base.departmentId.optional(),
});

export const importTeachersSchema = z.object({
  rows: z.array(z.record(z.any())).min(1, 'Danh sách rỗng'),
});
