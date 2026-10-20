import { z } from 'zod';

const recipientRole = z.enum(['giao-vien', 'sinh-vien']);

export const listRecipientsSchema = z.object({
  role: recipientRole,
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().trim().optional(),
});

export const sendAccountCredentialsSchema = z.object({
  recipients: z
    .array(
      z.object({
        role: recipientRole,
        accountEmail: z.string().trim().email('Email tài khoản không hợp lệ'),
        recipientEmail: z
          .string()
          .trim()
          .email('Email Gmail nhận không hợp lệ')
          .regex(/@gmail\.com$/i, 'Chỉ chấp nhận Gmail cá nhân có đuôi @gmail.com'),
      }).refine(
        ({ accountEmail, recipientEmail }) =>
          accountEmail.trim().toLowerCase() !== recipientEmail.trim().toLowerCase(),
        {
          path: ['recipientEmail'],
          message: 'Gmail nhận phải khác email tài khoản',
        }
      )
    )
    .min(1, 'Vui lòng chọn ít nhất một người nhận')
    .max(100, 'Mỗi lần gửi tối đa 100 email')
    .refine(
      (recipients) =>
        new Set(recipients.map(({ role, accountEmail }) => `${role}:${accountEmail.toLowerCase()}`))
          .size === recipients.length,
      'Danh sách người nhận bị trùng'
    ),
});
