import { z } from 'zod';

const PERSON_NAME_PATTERN = /^[\p{L}\p{M}]+(?: [\p{L}\p{M}]+)*$/u;
const ADDRESS_PATTERN = /^[\p{L}\p{M}\p{N}]+(?:[./-][\p{L}\p{M}\p{N}]+)*(?:(?: |, )[\p{L}\p{M}\p{N}]+(?:[./-][\p{L}\p{M}\p{N}]+)*)*$/u;
const CLASS_PATTERN = /^[\p{L}\p{M}\p{N}]+(?:[-/][\p{L}\p{M}\p{N}]+)*(?: [\p{L}\p{M}\p{N}]+(?:[-/][\p{L}\p{M}\p{N}]+)*)*$/u;

function isValidNonFutureBirthDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const birthDate = new Date(year, month - 1, day);
  if (birthDate.getFullYear() !== year || birthDate.getMonth() !== month - 1 || birthDate.getDate() !== day) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return birthDate <= today;
}

const base = {
  hoTen: z.string().min(2, 'Họ tên phải có ít nhất 2 ký tự').max(100, 'Họ tên tối đa 100 ký tự').regex(PERSON_NAME_PATTERN, 'Họ tên chỉ gồm chữ và một khoảng trắng giữa các từ'),
  email: z.string().email('Email không hợp lệ').regex(/^[^\s@]+@(?:[a-z0-9-]+\.)*edu\.vn$/i, 'Email sinh viên phải có đuôi edu.vn').transform((value) => value.toLowerCase()),
  dob: z.string().min(1, 'Ngày sinh là bắt buộc').refine(isValidNonFutureBirthDate, 'Ngày sinh không hợp lệ'),
  gender: z.enum(['Nam', 'Nữ', 'Khác']).optional().default('Nam'),
  address: z.string().min(1, 'Địa chỉ là bắt buộc').max(200, 'Địa chỉ tối đa 200 ký tự').regex(ADDRESS_PATTERN, 'Địa chỉ chỉ gồm chữ, số, dấu , . / - và khoảng trắng đơn'),
  phone: z.string().regex(/^0\d{9}$/, 'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0'),
  className: z.string().min(2, 'Lớp phải có ít nhất 2 ký tự').max(40, 'Lớp tối đa 40 ký tự').regex(CLASS_PATTERN, 'Tên lớp chỉ gồm chữ, số, dấu gạch nối, dấu / và khoảng trắng đơn'),
  education: z.string().trim().optional().default('Chính quy'),
  departmentId: z.string().min(1, 'Khoa là bắt buộc').refine((value) => value === value.trim(), 'Khoa không hợp lệ'),
};

export const createStudentSchema = z.object({
  ...base,
  password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự').optional(),
});

export const updateStudentSchema = z.object({
  hoTen: base.hoTen.optional(),
  dob: base.dob.optional(),
  gender: base.gender,
  address: base.address,
  phone: base.phone,
  className: base.className,
  education: base.education,
  departmentId: base.departmentId,
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
