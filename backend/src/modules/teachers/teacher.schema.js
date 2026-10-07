import { z } from 'zod';

const PERSON_NAME_PATTERN = /^[\p{L}\p{M}]+(?: [\p{L}\p{M}]+)*$/u;
const ADDRESS_PATTERN = /^[\p{L}\p{M}\p{N}]+(?:[./-][\p{L}\p{M}\p{N}]+)*(?:(?: |, )[\p{L}\p{M}\p{N}]+(?:[./-][\p{L}\p{M}\p{N}]+)*)*$/u;

function isValidAdultBirthDate(value) {
  if (!value) return false;
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

const teacherEmail = z
  .string()
  .refine((v) => !/\s/.test(v), { message: 'Email không được chứa khoảng trắng' })
  .transform((v) => (v.includes('@') ? v.toLowerCase() : `${v.toLowerCase()}@university.edu.vn`))
  .pipe(
    z
      .string()
      .email('Email không hợp lệ')
      .refine(
        (e) => e.endsWith('@university.edu.vn') || e.endsWith('@edu.vn'),
        { message: 'Email giáo viên phải có đuôi @university.edu.vn' }
      )
  );

const base = {
  hoTen: z
    .string()
    .min(2, 'Họ tên phải có ít nhất 2 ký tự')
    .max(100, 'Họ tên tối đa 100 ký tự')
    .regex(PERSON_NAME_PATTERN, 'Họ tên chỉ gồm chữ và một khoảng trắng giữa các từ'),
  email: teacherEmail,
  dob: z.string().min(1, 'Ngày sinh là bắt buộc').refine(isValidAdultBirthDate, 'Ngày sinh không hợp lệ').optional(),
  gender: z.union([z.enum(['Nam', 'Nữ', 'Khác']), z.null(), z.undefined(), z.literal('')]).transform((v) => v || 'Nam'),
  address: z.string().max(200, 'Địa chỉ tối đa 200 ký tự').regex(ADDRESS_PATTERN, 'Địa chỉ không hợp lệ').optional(),
  phone: z.string().regex(/^0\d{9}$/, 'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0').optional(),
  education: z.string().min(2, 'Trình độ phải có ít nhất 2 ký tự').max(80, 'Trình độ tối đa 80 ký tự').regex(PERSON_NAME_PATTERN, 'Trình độ chỉ gồm chữ và một khoảng trắng giữa các từ').optional(),
  departmentId: z.string().min(1, 'Khoa là bắt buộc').refine((value) => value === value.trim(), 'Khoa không hợp lệ').optional(),
};

export const createTeacherSchema = z.object({
  ...base,
  password: z.string().optional().default('123'),
});

export const updateTeacherSchema = z.object({
  hoTen: base.hoTen.optional(),
  dob: base.dob,
  gender: base.gender.optional(),
  address: base.address,
  phone: base.phone,
  education: base.education,
  departmentId: base.departmentId,
});

export const importTeachersSchema = z.object({
  rows: z.array(z.record(z.any())).min(1, 'Danh sách rỗng'),
});
