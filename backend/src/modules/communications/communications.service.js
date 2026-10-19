import { AppError } from '../../lib/AppError.js';
import { paginate, parseListQuery, searchFilter } from '../../lib/pagination.js';
import { isEmailConfigured, sendAccountCreatedEmail } from '../../lib/mailer.js';
import { comparePassword } from '../../lib/password.js';
import { Teacher } from '../teachers/teacher.model.js';
import { Student } from '../students/student.model.js';
import { ROLES } from '../../lib/roles.js';

const DIRECTORY_MODELS = {
  'giao-vien': { Model: Teacher, role: ROLES.TEACHER },
  'sinh-vien': { Model: Student, role: ROLES.STUDENT },
};

const RECIPIENT_FIELDS = 'id hoTen email emailNhanThongBao department className userId';
const USER_POPULATE = { path: 'userId', select: '_id email role status' };
const USER_POPULATE_WITH_CREDENTIALS = {
  path: 'userId',
  select: '_id email role status +passwordHash +password',
};

export async function listRecipients(query) {
  const { Model } = DIRECTORY_MODELS[query.role];
  const { page, limit, skip, sort, search } = parseListQuery(query, {
    maxLimit: 100,
    defaultSort: 'id',
  });
  const filter = searchFilter(search, [
    'hoTen',
    'email',
    'emailNhanThongBao',
    'department',
    'className',
  ]);
  const result = await paginate(Model, {
    filter,
    page,
    limit,
    skip,
    sort,
    select: RECIPIENT_FIELDS,
    populate: USER_POPULATE,
  });

  return {
    data: result.data.map(
      ({ _id, id, hoTen, email, emailNhanThongBao, department, className, userId }) => ({
        _id,
        id,
        hoTen,
        email,
        emailNhanThongBao: emailNhanThongBao || '',
        department,
        className,
        accountActive:
          userId?.status === 'Active' &&
          userId?.role === DIRECTORY_MODELS[query.role].role &&
          userId?.email === email,
      })
    ),
    meta: result.meta,
    emailConfigured: isEmailConfigured(),
  };
}

export async function sendAccountCredentials(recipients) {
  if (!isEmailConfigured()) {
    throw AppError.serviceUnavailable(
      'Chưa cấu hình Gmail. Vui lòng thiết lập GMAIL_USER và GMAIL_APP_PASSWORD trên máy chủ.'
    );
  }

  const groupedEmails = new Map();
  for (const recipient of recipients) {
    const accountEmail = recipient.accountEmail.trim().toLowerCase();
    const group = groupedEmails.get(recipient.role) || [];
    group.push(accountEmail);
    groupedEmails.set(recipient.role, group);
  }

  const profilesByKey = new Map();
  await Promise.all(
    [...groupedEmails.entries()].map(async ([role, emails]) => {
      const { Model } = DIRECTORY_MODELS[role];
      const profiles = await Model.find({ email: { $in: emails } })
        .select(RECIPIENT_FIELDS)
        .populate(USER_POPULATE_WITH_CREDENTIALS)
        .lean();
      for (const profile of profiles) {
        profilesByKey.set(`${role}:${profile.email.toLowerCase()}`, profile);
      }
    })
  );

  const results = [];
  for (const { role, accountEmail, recipientEmail } of recipients) {
    const normalizedAccountEmail = accountEmail.trim().toLowerCase();
    const profile = profilesByKey.get(`${role}:${normalizedAccountEmail}`);
    const normalizedRecipientEmail = (recipientEmail || profile?.emailNhanThongBao || '').trim().toLowerCase();
    if (
      !profile ||
      !profile.userId ||
      profile.userId.role !== DIRECTORY_MODELS[role].role ||
      profile.userId.status !== 'Active' ||
      profile.userId.email !== profile.email
    ) {
      results.push({
        id: profile ? String(profile._id) : null,
        role,
        accountEmail: normalizedAccountEmail,
        recipientEmail: normalizedRecipientEmail,
        status: 'failed',
        message: 'Không tìm thấy tài khoản đang hoạt động với email đăng nhập và vai trò đã chọn.',
      });
      continue;
    }

    const user = profile.userId;
    const hasDefaultPassword = user.passwordHash
      ? await comparePassword('123', user.passwordHash).catch(() => false)
      : String(user.password || '') === '123';
    if (!hasDefaultPassword) {
      results.push({
        id: String(profile._id),
        role,
        accountEmail: profile.email,
        recipientEmail: normalizedRecipientEmail,
        hoTen: profile.hoTen,
        status: 'skipped',
        message:
          'Mật khẩu tài khoản đã khác mật khẩu mặc định 123 nên không gửi thông tin đăng nhập cũ.',
      });
      continue;
    }

    try {
      await sendAccountCreatedEmail({
        email: profile.email,
        toEmail: normalizedRecipientEmail,
        hoTen: profile.hoTen,
        role,
        password: '123',
        id: profile.id,
      });

      // Synchronize recipient email to profile if missing or changed
      if (profile && normalizedRecipientEmail && profile.emailNhanThongBao !== normalizedRecipientEmail) {
        const { Model } = DIRECTORY_MODELS[role];
        await Model.updateOne(
          { _id: profile._id },
          {
            $set: { emailNhanThongBao: normalizedRecipientEmail },
            $push: { emailHistory: { email: normalizedRecipientEmail, updatedAt: new Date() } },
          }
        ).catch(() => {});
      }

      results.push({
        id: String(profile._id),
        role,
        accountEmail: profile.email,
        recipientEmail: normalizedRecipientEmail,
        hoTen: profile.hoTen,
        status: 'sent',
      });
    } catch (error) {
      console.error(`[ACCOUNT EMAIL ERROR] Recipient ${profile.email}:`, error);
      results.push({
        id: String(profile._id),
        role,
        accountEmail: profile.email,
        recipientEmail: normalizedRecipientEmail,
        hoTen: profile.hoTen,
        status: 'failed',
        message: 'Không gửi được email này. Vui lòng kiểm tra cấu hình Gmail hoặc thử lại.',
      });
    }
  }

  return {
    total: results.length,
    sent: results.filter(({ status }) => status === 'sent').length,
    failed: results.filter(({ status }) => status === 'failed').length,
    skipped: results.filter(({ status }) => status === 'skipped').length,
    results,
  };
}
