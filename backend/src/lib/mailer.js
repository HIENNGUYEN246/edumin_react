/**
 * Email notification service for EduMin system.
 * Handles automatic email dispatch for account creation, course class assignment, etc.
 * Uses Gmail SMTP when configured and a memory queue in tests/local development.
 */
import nodemailer from 'nodemailer';
import { config } from '../config/env.js';

const sentEmails = [];
let gmailTransport;

export function isEmailConfigured() {
  const user = String(config.GMAIL_USER || 'huynguyen1001002@gmail.com').trim();
  const pass = String(config.GMAIL_APP_PASSWORD || 'efzp cuxx zbmq ktak').trim();
  return !config.isTest && Boolean(user && pass);
}

function getGmailTransport() {
  if (!gmailTransport) {
    const user = String(config.GMAIL_USER || 'huynguyen1001002@gmail.com').trim();
    const pass = String(config.GMAIL_APP_PASSWORD || 'efzp cuxx zbmq ktak').replace(/\s+/g, '');
    gmailTransport = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user,
        pass,
      },
    });
  }
  return gmailTransport;
}

/**
 * Low-level email sending function.
 */
export async function sendEmail({ to, subject, html, text, metadata = {} }) {
  if (!to) {
    return { success: false, error: 'Recipient email is required' };
  }

  const mailRecord = {
    to,
    subject,
    html: html || '',
    text: text || '',
    metadata,
    sentAt: new Date().toISOString(),
  };

  if (isEmailConfigured()) {
    try {
      const result = await getGmailTransport().sendMail({
        from: `"EduMin" <${config.GMAIL_USER}>`,
        to,
        subject,
        html: html || undefined,
        text: text || undefined,
      });
      mailRecord.messageId = result.messageId;
      sentEmails.push(mailRecord);
      if (sentEmails.length > 500) sentEmails.shift();
      console.log(`[EMAIL SENT] To: ${to} | Subject: "${subject}"`);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('[EMAIL ERROR]:', error?.message || error);
      return { success: false, error: error?.message || 'Failed to send email' };
    }
  }

  sentEmails.push(mailRecord);

  // Keep a maximum of 500 recent email logs in memory
  if (sentEmails.length > 500) {
    sentEmails.shift();
  }

  // Structured logging for visibility
  console.log(`[EMAIL DISPATCH] To: ${to} | Subject: "${subject}"`);

  return {
    success: true,
    messageId: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  };
}

/**
 * Get in-memory history of sent emails (for debugging / tests).
 */
export function getSentEmails() {
  return [...sentEmails];
}

/**
 * Clear in-memory history of sent emails.
 */
export function clearSentEmails() {
  sentEmails.length = 0;
}

/**
 * Trigger (1): Gửi email thông báo tự động khi tài khoản mới được khởi tạo.
 */
export async function sendAccountCreatedEmail({
  email,
  toEmail = email,
  hoTen,
  role,
  password,
  id,
}) {
  if (!email) return null;

  const roleLabel =
    role === 'giao-vien'
      ? 'Giảng viên'
      : role === 'sinh-vien'
        ? 'Sinh viên'
        : role === 'ke-toan'
          ? 'Kế toán'
          : 'Người dùng';

  const subject = `[EduMin] Thông tin tài khoản mới - ${hoTen || email}`;
  const codeInfo = id ? `\n- Mã định danh: ${id}` : '';
  const text = `Xin chào ${hoTen || 'bạn'},\n\nTài khoản EduMin của bạn đã được khởi tạo thành công với vai trò ${roleLabel}.${codeInfo}\n- Email / Tên đăng nhập: ${email}\n- Mật khẩu khởi tạo: ${password || '123'}\n\nVui lòng đăng nhập hệ thống và đổi mật khẩu để bảo mật tài khoản.\n\nTrân trọng,\nBan Quản Trị EduMin`;
  const escapeHtml = (value) =>
    String(value ?? '').replace(
      /[&<>"']/g,
      (char) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        })[char]
    );

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px;">
          <h2 style="color: #4f46e5; margin-top: 0;">Chào mừng bạn đến với EduMin</h2>
          <p>Xin chào <strong>${escapeHtml(hoTen || 'bạn')}</strong>,</p>
          <p>Tài khoản EduMin của bạn đã được khởi tạo thành công với vai trò <strong>${roleLabel}</strong>.</p>
          <div style="background-color: #f3f4f6; padding: 14px 18px; border-radius: 6px; margin: 16px 0;">
            ${id ? `<p style="margin: 4px 0;"><strong>Mã định danh:</strong> ${escapeHtml(id)}</p>` : ''}
            <p style="margin: 4px 0;"><strong>Tên đăng nhập:</strong> ${escapeHtml(email)}</p>
            <p style="margin: 4px 0;"><strong>Mật khẩu mặc định:</strong> ${escapeHtml(password || '123')}</p>
          </div>
          <p style="color: #4b5563; font-size: 13px;">Mật khẩu mặc định chỉ đăng nhập được nếu bạn chưa đổi mật khẩu. Vì lý do an toàn, vui lòng đổi mật khẩu sau khi đăng nhập.</p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
      <p style="color: #6b7280; font-size: 12px; margin-bottom: 0;">Trân trọng,<br/><strong>Ban Quản Trị Hệ Thống EduMin</strong></p>
    </div>
  `;

  return sendEmail({
    to: toEmail,
    subject,
    text,
    html,
    metadata: { type: 'ACCOUNT_CREATED', role, id, accountEmail: email },
  });
}

/**
 * Trigger (2): Gửi email thông báo tự động khi Giáo viên được phân công hoặc Sinh viên được thêm vào lớp học phần.
 */
export async function sendClassAssignedEmail({
  email,
  hoTen,
  role,
  classId,
  className,
  courseId,
  courseName,
  schedules = [],
  room = '',
}) {
  if (!email) return null;

  const isTeacher = role === 'giao-vien';
  const roleTitle = isTeacher ? 'Giảng viên' : 'Sinh viên';
  const actionTitle = isTeacher ? 'Phân công giảng dạy' : 'Đăng ký học phần thành công';
  const subject = `[EduMin] ${actionTitle} - Lớp ${className || classId} (${courseId})`;

  const scheduleText =
    (schedules || [])
      .map((s) => `Thứ ${s.dayId ? Number(s.dayId) + 1 : '?'}, Ca ${s.shiftId}`)
      .join('; ') || 'Theo thông báo đào tạo';

  const text = `Xin chào ${hoTen || roleTitle},\n\nBạn đã được ${isTeacher ? 'phân công phụ trách' : 'thêm/đăng ký vào'} lớp học phần:\n- Mã học phần: ${courseId}\n- Tên học phần: ${courseName || '—'}\n- Mã lớp học phần: ${classId}\n- Tên lớp học phần: ${className || '—'}\n- Lịch học: ${scheduleText}\n- Phòng: ${room || 'Đang cập nhật'}\n\nVui lòng kiểm tra thời khóa biểu trên hệ thống để biết thêm chi tiết.\n\nTrân trọng,\nPhòng Đào Tạo EduMin`;

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px;">
      <h2 style="color: #4f46e5; margin-top: 0;">Thông báo ${actionTitle}</h2>
      <p>Xin chào <strong>${hoTen || roleTitle}</strong>,</p>
      <p>Bạn đã được ${isTeacher ? 'phân công giảng dạy' : 'ghi danh tham gia'} lớp học phần sau:</p>
      <div style="background-color: #f3f4f6; padding: 14px 18px; border-radius: 6px; margin: 16px 0;">
        <p style="margin: 4px 0;"><strong>Mã học phần:</strong> ${courseId}</p>
        <p style="margin: 4px 0;"><strong>Tên học phần:</strong> ${courseName || '—'}</p>
        <p style="margin: 4px 0;"><strong>Mã lớp học phần:</strong> ${classId}</p>
        <p style="margin: 4px 0;"><strong>Tên lớp học phần:</strong> ${className || '—'}</p>
        <p style="margin: 4px 0;"><strong>Lịch học:</strong> ${scheduleText}</p>
        <p style="margin: 4px 0;"><strong>Phòng học:</strong> ${room || 'Đang cập nhật'}</p>
      </div>
      <p style="color: #4b5563; font-size: 13px;">Vui lòng đăng nhập EduMin để theo dõi lịch học và chi tiết lớp.</p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
      <p style="color: #6b7280; font-size: 12px; margin-bottom: 0;">Trân trọng,<br/><strong>Phòng Đào Tạo EduMin</strong></p>
    </div>
  `;

  return sendEmail({
    to: email,
    subject,
    text,
    html,
    metadata: { type: 'CLASS_ASSIGNED', role, classId, courseId },
  });
}

/**
 * Trigger (3): Gửi email thông báo khôi phục tài khoản / mật khẩu tự động.
 */
export async function sendAccountRecoveryEmail({
  to,
  username,
  password = '123',
  hoTen = '',
  role = '',
}) {
  if (!to) return null;

  const normalizedRole = String(role || '').toLowerCase();
  const roleLabel =
    normalizedRole === 'teacher' || normalizedRole === 'giao-vien'
      ? 'Giảng viên'
      : normalizedRole === 'student' || normalizedRole === 'sinh-vien'
      ? 'Sinh viên'
      : '';
  const roleText = roleLabel ? ` (${roleLabel})` : '';

  const subject = `[EduMin] Khôi phục thông tin tài khoản${roleText} - ${hoTen || username}`;
  const text = `Xin chào ${hoTen || 'bạn'},\n\nThông tin tài khoản EduMin của bạn${roleLabel ? ` (${roleLabel})` : ''} đã được khôi phục thành công:\n- Tên đăng nhập: ${username}\n- Mật khẩu mặc định: ${password}\n\nVui lòng đăng nhập hệ thống và đổi mật khẩu để bảo mật tài khoản.\n\nTrân trọng,\nBan Quản Trị Hệ Thống EduMin`;

  const escapeHtml = (value) =>
    String(value ?? '').replace(
      /[&<>"']/g,
      (char) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        })[char]
    );

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px;">
      <h2 style="color: #4f46e5; margin-top: 0;">Khôi phục thông tin tài khoản EduMin</h2>
      <p>Xin chào <strong>${escapeHtml(hoTen || 'bạn')}</strong>,</p>
      <p>Bạn (hoặc ai đó) vừa yêu cầu lấy lại thông tin đăng nhập trên hệ thống quản lý đào tạo EduMin${roleLabel ? ` dành cho <strong>${roleLabel}</strong>` : ''}. Dưới đây là thông tin tài khoản của bạn:</p>
      <div style="background-color: #f3f4f6; padding: 14px 18px; border-radius: 6px; margin: 16px 0;">
        <p style="margin: 4px 0;"><strong>Tên đăng nhập:</strong> ${escapeHtml(username)}</p>
        <p style="margin: 4px 0;"><strong>Mật khẩu đã khôi phục:</strong> ${escapeHtml(password)}</p>
        ${roleLabel ? `<p style="margin: 4px 0;"><strong>Đối tượng:</strong> ${escapeHtml(roleLabel)}</p>` : ''}
      </div>
      <p style="color: #4b5563; font-size: 13px;">Vì lý do an toàn bảo mật, vui lòng đăng nhập ngay và đổi mật khẩu mới trong phần cài đặt tài khoản cá nhân.</p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
      <p style="color: #6b7280; font-size: 12px; margin-bottom: 0;">Trân trọng,<br/><strong>Ban Quản Trị Hệ Thống EduMin</strong></p>
    </div>
  `;

  return sendEmail({
    to,
    subject,
    text,
    html,
    metadata: { type: 'ACCOUNT_RECOVERY', username, role },
  });
}

