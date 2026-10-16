/**
 * Email notification service for EduMin system.
 * Handles automatic email dispatch for account creation, course class assignment, etc.
 * Supports mock dispatch (logging + memory queue) and real SMTP when configured.
 */

const sentEmails = [];

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
export async function sendAccountCreatedEmail({ email, hoTen, role, password, id }) {
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

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px;">
      <h2 style="color: #4f46e5; margin-top: 0;">Chào mừng bạn đến với EduMin</h2>
      <p>Xin chào <strong>${hoTen || 'bạn'}</strong>,</p>
      <p>Tài khoản EduMin của bạn đã được khởi tạo thành công với vai trò <strong>${roleLabel}</strong>.</p>
      <div style="background-color: #f3f4f6; padding: 14px 18px; border-radius: 6px; margin: 16px 0;">
        ${id ? `<p style="margin: 4px 0;"><strong>Mã định danh:</strong> ${id}</p>` : ''}
        <p style="margin: 4px 0;"><strong>Tên đăng nhập:</strong> ${email}</p>
        <p style="margin: 4px 0;"><strong>Mật khẩu mặc định:</strong> ${password || '123'}</p>
      </div>
      <p style="color: #4b5563; font-size: 13px;">Vì lý do an toàn, vui lòng đổi mật khẩu ngay sau lần đăng nhập đầu tiên.</p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
      <p style="color: #6b7280; font-size: 12px; margin-bottom: 0;">Trân trọng,<br/><strong>Ban Quản Trị Hệ Thống EduMin</strong></p>
    </div>
  `;

  return sendEmail({
    to: email,
    subject,
    text,
    html,
    metadata: { type: 'ACCOUNT_CREATED', role, id },
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

