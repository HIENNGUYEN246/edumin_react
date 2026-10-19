import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Email hoặc tên đăng nhập là bắt buộc'),
  password: z.string().min(1, 'Mật khẩu là bắt buộc'),
});

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, 'Mật khẩu cũ là bắt buộc'),
  newPassword: z.string().min(6, 'Mật khẩu mới phải có ít nhất 6 ký tự'),
});

export const forgotPasswordSchema = z
  .object({
    type: z.enum(['password', 'username', 'forgot-password', 'forgot-username']).default('password'),
    hoTen: z.string().trim().optional(),
    identifier: z.string().trim().optional(),
    email: z.string().trim().optional(),
    role: z.enum(['all', 'teacher', 'student', 'all_roles']).optional(),
  })
  .refine(
    (data) => {
      const isUsername = data.type === 'username' || data.type === 'forgot-username';
      if (isUsername) {
        return Boolean(data.email);
      }
      return Boolean(data.identifier || data.email || data.hoTen);
    },
    { message: 'Vui lòng nhập đầy đủ thông tin yêu cầu' }
  );

