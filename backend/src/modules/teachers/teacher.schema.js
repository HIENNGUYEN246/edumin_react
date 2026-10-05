import { z } from 'zod';

const PERSON_NAME_PATTERN = /^[\p{L}\p{M}]+(?: [\p{L}\p{M}]+)*$/u;
const ADDRESS_PATTERN = /^[\p{L}\p{M}\p{N}]+(?:[./-][\p{L}\p{M}\p{N}]+)*(?:(?: |, )[\p{L}\p{M}\p{N}]+(?:[./-][\p{L}\p{M}\p{N}]+)*)*$/u;

function isValidAdultBirthDate(value) {
  if (!value) return true;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const birthDate = new Date(year, month - 1, day);
  if (birthDate.getFullYear() !== year || birthDate.getMonth() !== month - 1 || birthDate.getDate() !== day) return false;

  const today = new Date();
  let age = today.getFullYear() - year;
  if (today.getMonth() < month - 1 || (today.getMonth() === month - 1 && today.getDate() < day)) age -= 1;
  return age >= 22;
}

const nameSchema = z.string().min(2, 'Họ tên phải có ít nhất 2 ký tự').max(100, 'Họ tên tối đa 100 ký tự').regex(PERSON_NAME_PATTERN, 'Họ tên chỉ gồm chữ và một khoảng trắng giữa các từ');
const addressSchema = z.string().min(1, 'Địa chỉ là bắt buộc').max(200, 'Địa chỉ tối đa 200 ký tự').regex(ADDRESS_PATTERN, 'Địa chỉ chỉ gồm chữ, số, dấu , . / - và khoảng trắng đơn');
const educationSchema = z.string().min(2, 'Trình độ phải có ít nhất 2 ký tự').max(80, 'Trình độ tối đa 80 ký tự').regex(PERSON_NAME_PATTERN, 'Trình độ chỉ gồm chữ và một khoảng trắng giữa các từ');
const emailSchema = z.string().email('Email không hợp lệ').regex(/^[^\s@]+@(?:[a-z0-9-]+\.)*edu\.vn$/i, 'Email nội bộ phải có đuôi edu.vn').transform((value) => value.toLowerCase());
const birthDateSchema = z.string().min(1, 'Ngày sinh là bắt buộc').refine(isValidAdultBirthDate, 'Ngày sinh không hợp lệ');
const phoneSchema = z.string().regex(/^0\d{9}$/, 'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0');

const base = {
  hoTen: nameSchema,
  email: emailSchema,
  dob: birthDateSchema,
  gender: z.enum(['Nam', 'Nữ', 'Khác']).optional().default('Nam'),
  address: addressSchema,
  phone: phoneSchema,
  education: educationSchema,
  departmentId: z.string().min(1, 'Khoa là bắt buộc').refine((value) => value === value.trim(), 'Khoa không hợp lệ'),
};

export const createTeacherSchema = z.object({
  ...base,
  password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự').optional(),
});

export const updateTeacherSchema = z.object({
  hoTen: nameSchema.optional(),
  dob: birthDateSchema.optional(),
  gender: base.gender.optional(),
  address: addressSchema.optional(),
  phone: phoneSchema.optional(),
  education: educationSchema.optional(),
  departmentId: z.string().min(1, 'Khoa là bắt buộc').refine((value) => value === value.trim(), 'Khoa không hợp lệ').optional(),
});

export const importTeachersSchema = z.object({
  rows: z.array(z.record(z.any())).min(1, 'Danh sách rỗng'),
});
