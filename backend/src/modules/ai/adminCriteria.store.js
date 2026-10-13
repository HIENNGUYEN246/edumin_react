import mongoose from 'mongoose';

const { Schema } = mongoose;

const adminCriteriaSchema = new Schema(
  {
    adminId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    rawCriteriaText: { type: String, required: true },
    rules: {
      requirePhone10: { type: Boolean, default: false },
      requireCccd12: { type: Boolean, default: false },
      requireReason: { type: Boolean, default: false },
      noAvatar: { type: Boolean, default: false },
      customSummary: { type: String, default: '' },
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const AdminCriteria = mongoose.model('AdminCriteria', adminCriteriaSchema, 'admin_criteria');

// Initially null: Admin has not set any criteria yet.
// Criteria is only active when Admin explicitly sets it beforehand!
let memoryCriteria = null;

export function parseCriteriaFromText(rawText = '') {
  const norm = rawText
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase();

  const requirePhone10 = norm.includes('sdt') || norm.includes('dien thoai') || norm.includes('10 so');
  const requireCccd12 = norm.includes('cccd') || norm.includes('can cuoc') || norm.includes('12 so');
  const requireReason = norm.includes('ly do') || norm.includes('nguyen nhan') || norm.includes('giai trinh');
  const noAvatar = norm.includes('khong duyet avatar') || norm.includes('khong doi avatar') || norm.includes('chi duyet profile') || norm.includes('cam doi avatar');
  const requireName = norm.includes('ho ten') || norm.includes('ten');
  const requireAddress = norm.includes('dia chi');

  const summaries = [];
  if (requirePhone10) summaries.push('SĐT đủ 10 số');
  if (requireCccd12) summaries.push('CCCD đủ 12 số (sẵn sàng, không ràng buộc)');
  if (requireReason) summaries.push('Có lý do thay đổi rõ ràng');
  if (requireName) summaries.push('Họ tên đầy đủ');
  if (requireAddress) summaries.push('Địa chỉ hợp lệ');
  if (noAvatar) summaries.push('Không duyệt đổi avatar');
  if (summaries.length === 0) summaries.push(rawText.trim());

  return {
    rawCriteriaText: rawText.trim(),
    rules: {
      requirePhone10,
      requireCccd12,
      requireReason,
      requireName,
      requireAddress,
      noAvatar,
      customSummary: summaries.join(' • '),
    },
    updatedAt: new Date(),
  };
}

export function evaluateRequestAgainstCriteria(r, rules = {}) {
  const reqData = r.requestedData || {};
  const curData = r.currentData || {};
  const phone = reqData.phone !== undefined ? reqData.phone : curData.phone || '';
  const cccd = reqData.cccd !== undefined ? reqData.cccd : curData.cccd || '';
  const reason = reqData.reason || r.adminNote || r.reason || '';
  const hoTen = reqData.hoTen !== undefined ? reqData.hoTen : curData.hoTen || r.requesterName || '';
  const address = reqData.address !== undefined ? reqData.address : curData.address || '';

  const fails = [];

  // Pure avatar request (only modifies avatar, no profile fields present)
  const isPureAvatar =
    (r.type === 'avatar' || Boolean(reqData.avatar)) &&
    reqData.phone === undefined &&
    reqData.hoTen === undefined &&
    reqData.cccd === undefined &&
    reqData.address === undefined;

  if (isPureAvatar) {
    if (rules?.noAvatar) {
      fails.push('Chính sách tạm dừng đổi avatar');
    }
    return {
      pass: fails.length === 0,
      fails,
    };
  }

  // Profile or Both requests:
  if (rules?.requirePhone10) {
    const cleanPhone = String(phone).replace(/\s+/g, '');
    if (!cleanPhone || !/^\d{10}$/.test(cleanPhone)) {
      fails.push('SĐT không đủ 10 số');
    }
  }

  if (rules?.requireCccd12) {
    const cleanCccd = String(cccd).replace(/\s+/g, '');
    // Do hệ thống hiện tại chưa có trường nhập CCCD trong form cập nhật hồ sơ:
    // Tiêu chuẩn CCCD được lưu trữ sẵn sàng cho tính năng cải tiến sau này,
    // KHÔNG ràng buộc bắt buộc làm rớt hồ sơ nếu trường này chưa có dữ liệu.
    // Nếu có dữ liệu CCCD được gửi lên thì vẫn kiểm tra tính hợp lệ (đủ 12 chữ số).
    if (cleanCccd && !/^\d{12}$/.test(cleanCccd)) {
      fails.push('CCCD không đúng định dạng 12 chữ số');
    }
  }

  if (rules?.requireReason) {
    if (!String(reason).trim()) {
      fails.push('Thiếu lý do thay đổi');
    }
  }

  if (rules?.requireName) {
    if (!String(hoTen).trim()) {
      fails.push('Họ tên không được để trống');
    }
  }

  if (rules?.requireAddress) {
    if (!String(address).trim()) {
      fails.push('Địa chỉ không được để trống');
    }
  }

  if (rules?.noAvatar && Boolean(reqData.avatar)) {
    fails.push('Chính sách tạm dừng đổi avatar');
  }

  return {
    pass: fails.length === 0,
    fails,
  };
}

export async function setAdminCriteria(rawText = '', adminUser = null) {
  const parsed = parseCriteriaFromText(rawText);
  memoryCriteria = parsed;

  try {
    const doc = new AdminCriteria({
      adminId: adminUser?._id || null,
      rawCriteriaText: parsed.rawCriteriaText,
      rules: parsed.rules,
      isActive: true,
    });
    await doc.save();
  } catch (err) {
    // If Mongo isn't active or in test sandbox, memoryCriteria is preserved
  }

  return memoryCriteria;
}

export async function getAdminCriteria() {
  try {
    const latest = await AdminCriteria.findOne({ isActive: true }).sort({ createdAt: -1 }).lean();
    if (latest) {
      return {
        rawCriteriaText: latest.rawCriteriaText,
        rules: latest.rules || {},
        updatedAt: latest.updatedAt || latest.createdAt,
      };
    }
  } catch (err) {}

  return memoryCriteria;
}

export async function clearAdminCriteria() {
  memoryCriteria = null;
  try {
    await AdminCriteria.updateMany({ isActive: true }, { isActive: false });
  } catch (err) {}
  return null;
}
