import mongoose from 'mongoose';
import { inspectImageHeuristics } from './avatarVision.service.js';

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
      requireName: { type: Boolean, default: false },
      requireAddress: { type: Boolean, default: false },
      requireHumanSingleAvatar: { type: Boolean, default: false },
      requireHumanAvatar: { type: Boolean, default: false },
      requireSinglePersonAvatar: { type: Boolean, default: false },
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

  const hasAvatarKeyword =
    norm.includes('avatar') ||
    norm.includes('anh dai dien') ||
    norm.includes('hinh dai dien') ||
    norm.includes('anh the') ||
    norm.includes('hinh the');

  const mentionsHuman =
    norm.includes('hinh nguoi') ||
    norm.includes('anh nguoi') ||
    norm.includes('nguoi that') ||
    norm.includes('la nguoi') ||
    norm.includes('khuon mat') ||
    norm.includes('mat ro') ||
    norm.includes('ro mat') ||
    norm.includes('chan dung') ||
    norm.includes('anh the') ||
    norm.includes('khong phai con vat') ||
    norm.includes('khong con vat') ||
    norm.includes('khong anime') ||
    norm.includes('khong hoat hinh') ||
    norm.includes('khong do vat') ||
    (hasAvatarKeyword && (norm.includes('nguoi') || norm.includes('human') || norm.includes('person')));

  const mentionsSinglePerson =
    norm.includes('1 nguoi') ||
    norm.includes('mot nguoi') ||
    norm.includes('chi 1') ||
    norm.includes('chi mot') ||
    norm.includes('duy nhat 1') ||
    norm.includes('don le') ||
    norm.includes('chinh chu') ||
    norm.includes('khong chup chung') ||
    norm.includes('khong nhieu nguoi');

  const requireHumanSingleAvatar =
    (hasAvatarKeyword && mentionsHuman && mentionsSinglePerson) ||
    norm.includes('avatar phai la hinh nguoi va chi 1 nguoi') ||
    norm.includes('hinh nguoi va chi 1 nguoi') ||
    norm.includes('hinh nguoi va 1 nguoi') ||
    norm.includes('nguoi that va chi 1 nguoi') ||
    norm.includes('chan dung 1 nguoi') ||
    norm.includes('avatar 1 nguoi') ||
    norm.includes('avatar chi 1 nguoi') ||
    norm.includes('anh 1 nguoi') ||
    norm.includes('anh dai dien 1 nguoi');

  const requireHumanAvatar = requireHumanSingleAvatar || (hasAvatarKeyword && mentionsHuman);
  const requireSinglePersonAvatar = requireHumanSingleAvatar || (hasAvatarKeyword && mentionsSinglePerson);

  const summaries = [];
  if (requirePhone10) summaries.push('SĐT đủ 10 số');
  if (requireCccd12) summaries.push('CCCD đủ 12 số (sẵn sàng, không ràng buộc)');
  if (requireReason) summaries.push('Có lý do thay đổi rõ ràng');
  if (requireName) summaries.push('Họ tên đầy đủ');
  if (requireAddress) summaries.push('Địa chỉ hợp lệ');
  if (noAvatar) summaries.push('Không duyệt đổi avatar');
  if (requireHumanSingleAvatar) {
    summaries.push('Avatar phải là hình người và chỉ 1 người');
  } else {
    if (requireHumanAvatar) summaries.push('Avatar phải là hình người thật');
    if (requireSinglePersonAvatar) summaries.push('Avatar chỉ được có đúng 1 người');
  }
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
      requireHumanSingleAvatar,
      requireHumanAvatar,
      requireSinglePersonAvatar,
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

  const avatarRaw = reqData.avatar || reqData.avatarUrl || curData.avatar || curData.avatarUrl;
  const isAvatarChange = Boolean(reqData.avatar || reqData.avatarUrl) || r.type === 'avatar';

  if (isAvatarChange && avatarRaw) {
    const avatarObj = typeof avatarRaw === 'object' && avatarRaw !== null ? avatarRaw : { url: String(avatarRaw || '') };
    if (rules?.noAvatar) {
      fails.push('Chính sách tạm dừng đổi avatar');
    }
    if (rules?.requireHumanSingleAvatar || rules?.requireHumanAvatar || rules?.requireSinglePersonAvatar) {
      // Check if this request was already flagged/held back during upload
      const hasPriorFailure =
        r.adminNote &&
        (r.adminNote.includes('Chưa đạt tiêu chí') ||
          r.adminNote.includes('Ảnh không hợp lệ') ||
          r.adminNote.includes('không phải hình người') ||
          r.adminNote.includes('bắt buộc phải có đúng 1 người'));

      let analysis = avatarObj.analysis;
      if (!analysis) {
        const cleanPublicId = String(avatarObj.publicId || '').replace(/^.*[\\/]/, '');
        const urlFilename = String(avatarObj.url || '').split('?')[0].split('/').pop() || '';
        const nameToInspect = avatarObj.originalName || avatarObj.originalname || cleanPublicId || urlFilename || '';
        analysis = inspectImageHeuristics({ originalname: nameToInspect, publicId: cleanPublicId });
      }

      if (hasPriorFailure) {
        fails.push(r.adminNote);
      } else if (rules?.requireHumanSingleAvatar) {
        // STRICT: Only approve if isValid === true and isHuman === true and personCount is 1
        const isStrictValid =
          analysis?.isValid === true &&
          analysis?.isHuman === true &&
          (analysis?.personCount === undefined || analysis?.personCount === 1);
        if (!isStrictValid) {
          const detailMsg =
            analysis?.rejectReason ||
            analysis?.reason ||
            (analysis?.isHuman === false
              ? 'Avatar không phải hình người (phát hiện con vật/đồ vật/anime/phong cảnh)'
              : analysis?.personCount !== 1
              ? `Avatar phát hiện ${analysis?.personCount ?? 'nhiều'} người, tiêu chuẩn chỉ cho phép đúng 1 người`
              : 'Ảnh không hợp lệ: Yêu cầu bắt buộc phải có đúng 1 người trong khung hình!');
          fails.push(detailMsg);
        }
      } else {
        if (rules?.requireHumanAvatar) {
          const isHuman = analysis?.isValid === true && analysis?.isHuman === true;
          if (!isHuman) {
            fails.push(analysis?.reason || analysis?.rejectReason || 'Avatar không phải hình người thật');
          }
        }
        if (rules?.requireSinglePersonAvatar) {
          const isSingle = (analysis?.isValid === true || analysis?.isSinglePerson === true) && analysis?.personCount === 1;
          if (!isSingle) {
            fails.push(analysis?.reason || analysis?.rejectReason || `Avatar phát hiện ${analysis?.personCount ?? 'nhiều'} người, tiêu chuẩn chỉ cho phép đúng 1 người`);
          }
        }
      }
    }
  }

  // Pure avatar request (only modifies avatar, no profile fields present)
  const isPureAvatar =
    (r.type === 'avatar' || Boolean(reqData.avatar)) &&
    reqData.phone === undefined &&
    reqData.hoTen === undefined &&
    reqData.cccd === undefined &&
    reqData.address === undefined;

  if (isPureAvatar) {
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
