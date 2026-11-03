import React, { useState, useEffect } from 'react';
import { Modal } from '../../../components/ui/Modal.jsx';

export function CriteriaSettingsModal({
  isOpen,
  onClose,
  activeCriteria,
  pendingCount = 0,
  onSave,
  onClear,
  isLoading = false,
}) {
  const [requirePhone10, setRequirePhone10] = useState(true);
  const [requireCccd12, setRequireCccd12] = useState(true);
  const [requireReason, setRequireReason] = useState(true);
  const [avatarMode, setAvatarMode] = useState('human_single'); // 'human_single' | 'no_avatar' | 'unrestricted'
  const [requireName, setRequireName] = useState(false);
  const [requireAddress, setRequireAddress] = useState(false);
  const [customText, setCustomText] = useState('');
  const [autoProcessPending, setAutoProcessPending] = useState(true);

  useEffect(() => {
    if (isOpen) {
      if (activeCriteria && activeCriteria.rules) {
        const rules = activeCriteria.rules;
        setRequirePhone10(Boolean(rules.requirePhone10));
        setRequireCccd12(Boolean(rules.requireCccd12));
        setRequireReason(Boolean(rules.requireReason));
        setRequireName(Boolean(rules.requireName));
        setRequireAddress(Boolean(rules.requireAddress));
        if (rules.noAvatar) {
          setAvatarMode('no_avatar');
        } else if (rules.requireHumanSingleAvatar) {
          setAvatarMode('human_single');
        } else {
          setAvatarMode('unrestricted');
        }
        setCustomText(activeCriteria.rawCriteriaText || '');
      } else {
        setRequirePhone10(true);
        setRequireCccd12(true);
        setRequireReason(true);
        setAvatarMode('human_single');
        setRequireName(false);
        setRequireAddress(false);
        setCustomText('');
      }
      setAutoProcessPending(true);
    }
  }, [isOpen, activeCriteria]);

  const handleApplyPreset = (preset) => {
    if (preset === 'basic') {
      setRequirePhone10(true);
      setRequireCccd12(false);
      setRequireReason(true);
      setAvatarMode('human_single');
      setRequireName(false);
      setRequireAddress(false);
    } else if (preset === 'strict') {
      setRequirePhone10(true);
      setRequireCccd12(true);
      setRequireReason(true);
      setAvatarMode('human_single');
      setRequireName(true);
      setRequireAddress(false);
    } else if (preset === 'no_avatar') {
      setRequirePhone10(true);
      setRequireCccd12(false);
      setRequireReason(true);
      setAvatarMode('no_avatar');
      setRequireName(false);
      setRequireAddress(false);
    } else if (preset === 'reset') {
      setRequirePhone10(false);
      setRequireCccd12(false);
      setRequireReason(false);
      setAvatarMode('unrestricted');
      setRequireName(false);
      setRequireAddress(false);
      setCustomText('');
    }
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    const rules = {
      requirePhone10,
      requireCccd12,
      requireReason,
      requireName,
      requireAddress,
      requireHumanSingleAvatar: avatarMode === 'human_single',
      requireHumanAvatar: avatarMode === 'human_single',
      requireSinglePersonAvatar: avatarMode === 'human_single',
      noAvatar: avatarMode === 'no_avatar',
    };

    const summaries = [];
    if (requirePhone10) summaries.push('SĐT đủ 10 số');
    if (requireCccd12) summaries.push('CCCD đủ 12 số');
    if (requireReason) summaries.push('Có lý do rõ ràng');
    if (requireName) summaries.push('Họ tên đầy đủ');
    if (requireAddress) summaries.push('Địa chỉ hợp lệ');
    if (avatarMode === 'human_single') {
      summaries.push('Avatar ảnh người thật 1 người');
    } else if (avatarMode === 'no_avatar') {
      summaries.push('Khóa cập nhật Avatar');
    }
    if (customText.trim()) summaries.push(customText.trim());

    const summaryStr = summaries.join(' • ');

    onSave({
      rawCriteriaText: customText.trim() || summaryStr || 'Tiêu chuẩn kiểm duyệt cơ bản',
      rules: {
        ...rules,
        customSummary: summaryStr,
      },
      autoProcessPending,
    });
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Thiết lập Tiêu chí Kiểm duyệt Tự động"
      icon="fas fa-sliders-h"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Intro */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 text-base shadow-xs">
            <i className="fas fa-shield-halved" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Cơ chế kiểm duyệt đón đầu tự động
            </h4>
            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
              Các yêu cầu cập nhật hồ sơ và ảnh đại diện gửi lên từ Giảng viên & Sinh viên sẽ được đối soát theo bộ tiêu chuẩn dưới đây:
              Tự động phê duyệt ngay nếu đạt chuẩn, hoặc giữ lại danh sách Chờ duyệt nếu chưa đạt để Admin xem xét thủ công.
            </p>
          </div>
        </div>

        {/* Presets Toolbar */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <i className="fas fa-wand-magic-sparkles text-amber-500" />
            <span>Mẫu thiết lập nhanh (Presets):</span>
          </label>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => handleApplyPreset('basic')}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 transition flex items-center gap-1.5 shadow-2xs cursor-pointer hover:border-indigo-300"
            >
              <i className="fas fa-bolt text-amber-500 text-[11px]" />
              <span>Tiêu chuẩn cơ bản (SĐT + Lý do)</span>
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('strict')}
              className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-xs font-bold text-indigo-700 transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <i className="fas fa-shield text-indigo-600 text-[11px]" />
              <span>Toàn diện (Khuyên dùng)</span>
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('no_avatar')}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 transition flex items-center gap-1.5 shadow-2xs cursor-pointer hover:border-rose-300"
            >
              <i className="fas fa-ban text-rose-500 text-[11px]" />
              <span>Chỉ duyệt thông tin (Khóa avatar)</span>
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('reset')}
              className="px-2.5 py-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 text-xs font-medium transition cursor-pointer"
            >
              Làm trống
            </button>
          </div>
        </div>

        {/* 1. Core Profile Fields Criteria */}
        <div className="space-y-3">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <i className="fas fa-list-check text-indigo-600" />
            <span>1. Tiêu chí kiểm tra thông tin cá nhân:</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Phone Check */}
            <label className={`p-3 rounded-2xl border transition cursor-pointer flex items-start gap-3 ${
              requirePhone10
                ? 'border-indigo-400 bg-indigo-50/50 shadow-2xs'
                : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}>
              <input
                type="checkbox"
                checked={requirePhone10}
                onChange={(e) => setRequirePhone10(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-indigo-600 rounded cursor-pointer"
              />
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <i className="fas fa-phone text-indigo-600 text-xs" />
                  <span className="text-xs font-bold text-slate-800">SĐT chuẩn 10 chữ số</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Bắt buộc số điện thoại có đúng 10 chữ số hợp lệ (ví dụ: 0912345678).
                </p>
              </div>
            </label>

            {/* CCCD Check */}
            <label className={`p-3 rounded-2xl border transition cursor-pointer flex items-start gap-3 ${
              requireCccd12
                ? 'border-indigo-400 bg-indigo-50/50 shadow-2xs'
                : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}>
              <input
                type="checkbox"
                checked={requireCccd12}
                onChange={(e) => setRequireCccd12(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-indigo-600 rounded cursor-pointer"
              />
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <i className="fas fa-id-card text-indigo-600 text-xs" />
                  <span className="text-xs font-bold text-slate-800">CCCD chuẩn 12 chữ số</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Xác thực CCCD 12 số (sẵn sàng, không ràng buộc nếu hồ sơ chưa nhập CCCD).
                </p>
              </div>
            </label>

            {/* Reason Check */}
            <label className={`p-3 rounded-2xl border transition cursor-pointer flex items-start gap-3 ${
              requireReason
                ? 'border-indigo-400 bg-indigo-50/50 shadow-2xs'
                : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}>
              <input
                type="checkbox"
                checked={requireReason}
                onChange={(e) => setRequireReason(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-indigo-600 rounded cursor-pointer"
              />
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <i className="fas fa-file-pen text-indigo-600 text-xs" />
                  <span className="text-xs font-bold text-slate-800">Bắt buộc có lý do thay đổi</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Yêu cầu người gửi phải ghi chú rõ ràng lý do cập nhật thông tin.
                </p>
              </div>
            </label>

            {/* Name & Address Check */}
            <label className={`p-3 rounded-2xl border transition cursor-pointer flex items-start gap-3 ${
              requireName
                ? 'border-indigo-400 bg-indigo-50/50 shadow-2xs'
                : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}>
              <input
                type="checkbox"
                checked={requireName}
                onChange={(e) => setRequireName(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-indigo-600 rounded cursor-pointer"
              />
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <i className="fas fa-user-check text-indigo-600 text-xs" />
                  <span className="text-xs font-bold text-slate-800">Bắt buộc Họ và tên đầy đủ</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Không chấp nhận để trống hoặc bỏ ngỏ trường họ tên.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* 2. Avatar Policy */}
        <div className="space-y-3">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <i className="fas fa-camera text-indigo-600" />
            <span>2. Tiêu chuẩn kiểm duyệt ảnh đại diện (Avatar):</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Human & 1 Person */}
            <label className={`p-3.5 rounded-2xl border transition cursor-pointer flex flex-col justify-between ${
              avatarMode === 'human_single'
                ? 'border-indigo-600 bg-indigo-50/70 shadow-2xs ring-2 ring-indigo-500/20'
                : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}>
              <div className="flex items-start gap-2.5">
                <input
                  type="radio"
                  name="avatarMode"
                  value="human_single"
                  checked={avatarMode === 'human_single'}
                  onChange={() => setAvatarMode('human_single')}
                  className="mt-1 text-indigo-600 cursor-pointer"
                />
                <div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold text-slate-800">Ảnh người thật (1 người)</span>
                    <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[9px] font-extrabold rounded">
                      Chuẩn
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Bắt buộc chân dung/ảnh thẻ 1 người. Chặn tự động duyệt ảnh con vật, đồ vật, anime hoặc nhóm đông người.
                  </p>
                </div>
              </div>
            </label>

            {/* Lock Avatar */}
            <label className={`p-3.5 rounded-2xl border transition cursor-pointer flex flex-col justify-between ${
              avatarMode === 'no_avatar'
                ? 'border-rose-500 bg-rose-50/70 shadow-2xs ring-2 ring-rose-500/20'
                : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}>
              <div className="flex items-start gap-2.5">
                <input
                  type="radio"
                  name="avatarMode"
                  value="no_avatar"
                  checked={avatarMode === 'no_avatar'}
                  onChange={() => setAvatarMode('no_avatar')}
                  className="mt-1 text-rose-600 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-bold text-slate-800">Khóa đổi Avatar</span>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Chính sách không duyệt đổi avatar: Tạm giữ lại toàn bộ yêu cầu đổi ảnh đại diện để xem xét thủ công.
                  </p>
                </div>
              </div>
            </label>

            {/* Unrestricted */}
            <label className={`p-3.5 rounded-2xl border transition cursor-pointer flex flex-col justify-between ${
              avatarMode === 'unrestricted'
                ? 'border-slate-600 bg-slate-50 shadow-2xs ring-2 ring-slate-400/20'
                : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}>
              <div className="flex items-start gap-2.5">
                <input
                  type="radio"
                  name="avatarMode"
                  value="unrestricted"
                  checked={avatarMode === 'unrestricted'}
                  onChange={() => setAvatarMode('unrestricted')}
                  className="mt-1 text-slate-600 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-bold text-slate-800">Không ràng buộc Avatar</span>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Chấp nhận ảnh theo mặc định của hệ thống mà không kiểm tra số lượng người.
                  </p>
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* 3. Custom Text / Extra Note */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <i className="fas fa-pencil text-slate-500" />
              <span>Ghi chú quy chuẩn / Mô tả tùy chỉnh (Tùy chọn):</span>
            </span>
            <span className="text-[11px] text-slate-400 font-normal">Hiển thị làm thông điệp tiêu chuẩn</span>
          </label>
          <input
            type="text"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            placeholder="Ví dụ: SĐT 10 số, CCCD 12 số, avatar là ảnh thẻ 1 người rõ mặt..."
            className="w-full px-3.5 py-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
          />
        </div>

        {/* Auto Process Pending Toggle */}
        <div className="p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-2xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 text-sm shadow-xs">
              <i className="fas fa-bolt" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">
                Tự động kiểm tra và duyệt ngay danh sách chờ ({pendingCount} yêu cầu)
              </p>
              <p className="text-[11px] text-slate-500">
                Khi lưu tiêu chí, hệ thống sẽ tự động đối soát và duyệt ngay các hồ sơ hợp lệ đang chờ.
              </p>
            </div>
          </div>
          <input
            type="checkbox"
            checked={autoProcessPending}
            onChange={(e) => setAutoProcessPending(e.target.checked)}
            className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
          />
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <div>
            {activeCriteria && (
              <button
                type="button"
                onClick={onClear}
                disabled={isLoading}
                className="px-3.5 py-2 rounded-xl text-rose-600 hover:bg-rose-50 border border-rose-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <i className="fas fa-power-off text-rose-500" />
                <span>Tắt quy chuẩn</span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md hover:shadow-indigo-500/20 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <i className="fas fa-spinner fa-spin" />
                  <span>Đang lưu...</span>
                </>
              ) : (
                <>
                  <i className="fas fa-check" />
                  <span>Lưu & Kích hoạt</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

export default CriteriaSettingsModal;

