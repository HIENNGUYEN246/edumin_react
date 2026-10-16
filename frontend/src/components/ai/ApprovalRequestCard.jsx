import React, { useState } from 'react';

/**
 * Approval Request Card / Table for EduMin AI Chatbot (Admin Role).
 * Renders dedicated interactive UI for permission & profile change requests with:
 * - Requester info, role badge, permission/request content.
 * - Interactive action buttons [Phê duyệt / Accept] (green) and [Từ chối / Reject] (red).
 * - Instant background API execution and inline status update without page reload.
 */
export function ApprovalRequestCard({
  card,
  onApprove,
  onReject,
  onNavigate,
  actionLoading = {},
}) {
  // If card has multiple items/requests, we treat it as a batch or table
  const rawRequests = Array.isArray(card.requests) && card.requests.length > 0
    ? card.requests
    : [card];

  // Local state to track item statuses if updated inside this card
  const [localStatuses, setLocalStatuses] = useState({});

  const getStatus = (req) => {
    const id = req.requestId || req.id;
    return localStatuses[id] || req.status || 'pending';
  };

  const handleApprove = async (req) => {
    const id = req.requestId || req.id;
    const title = req.title || req.requesterName || 'người dùng';
    if (onApprove) {
      await onApprove(id, title);
    }
    setLocalStatuses((prev) => ({ ...prev, [id]: 'approved' }));
  };

  const handleReject = async (req) => {
    const id = req.requestId || req.id;
    const title = req.title || req.requesterName || 'người dùng';
    if (onReject) {
      await onReject(id, title);
    }
    setLocalStatuses((prev) => ({ ...prev, [id]: 'rejected' }));
  };

  const isMulti = rawRequests.length > 1 || card.viewMode === 'table';

  return (
    <div className="bg-slate-50/95 rounded-2xl p-3.5 sm:p-4 border border-indigo-100 shadow-sm space-y-3.5 text-slate-800 transition-all">
      {/* Card / Table Header */}
      <div className="flex items-start justify-between gap-2 border-b border-slate-200/70 pb-3">
        <div className="flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-800 text-white flex items-center justify-center shrink-0 shadow-2xs">
            <i className="fas fa-user-shield text-xs" />
          </div>
          <div>
            <h4 className="font-bold text-xs sm:text-[13px] text-slate-900 leading-snug">
              {card.title || 'Duyệt yêu cầu & Phân quyền hệ thống'}
            </h4>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {card.subtitle || `${rawRequests.length} yêu cầu cần xét duyệt trực tiếp`}
            </p>
          </div>
        </div>

        {card.code && (
          <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 whitespace-nowrap">
            {card.code}
          </span>
        )}
      </div>

      {/* Render Mode 1: Table view if multiple requests */}
      {isMulti ? (
        <div className="overflow-x-auto custom-scrollbar rounded-xl border border-slate-200/80 bg-white">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200/80">
              <tr>
                <th className="px-3 py-2.5">Người yêu cầu & Vai trò</th>
                <th className="px-3 py-2.5">Nội dung xin cấp quyền</th>
                <th className="px-3 py-2.5 text-center">Trạng thái</th>
                <th className="px-3 py-2.5 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rawRequests.map((req, idx) => {
                const reqId = req.requestId || req.id || idx;
                const status = getStatus(req);
                const isLoading = Boolean(actionLoading[reqId]);
                const role = req.requesterRole || req.role || 'sinh-vien';
                const roleBadgeClass =
                  role === 'giao-vien' || role === 'teacher'
                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                    : 'bg-blue-50 text-blue-700 border-blue-200';
                const roleLabel =
                  role === 'giao-vien' || role === 'teacher' ? 'Giảng viên' : 'Sinh viên';

                return (
                  <tr key={reqId} className="hover:bg-slate-50/70 transition-colors">
                    {/* Requester Info */}
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs shrink-0 border border-slate-200">
                          {(req.title || req.requesterName || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 text-xs truncate max-w-[140px]">
                            {req.title || req.requesterName || 'Người dùng'}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`px-1.5 py-0.2 text-[9px] font-semibold rounded border ${roleBadgeClass}`}>
                              {roleLabel}
                            </span>
                            {req.requesterCode && (
                              <span className="text-[10px] font-mono text-slate-400">
                                {req.requesterCode}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Content / Permission */}
                    <td className="px-3 py-3">
                      <div className="max-w-[200px]">
                        <p className="font-semibold text-slate-800 text-xs truncate">
                          {req.permission || req.subtitle || req.type || 'Xin cấp quyền / Đổi thông tin'}
                        </p>
                        {req.meta && (
                          <p className="text-[10px] text-slate-500 truncate mt-0.5">
                            {req.meta}
                          </p>
                        )}
                        {req.reason && (
                          <p className="text-[10px] text-slate-500 italic truncate mt-0.5">
                            Lý do: {req.reason}
                          </p>
                        )}
                      </div>
                    </td>

                    {/* Status badge */}
                    <td className="px-3 py-3 text-center whitespace-nowrap">
                      {status === 'approved' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <i className="fas fa-check" />
                          <span>Đã phê duyệt thành công</span>
                        </span>
                      ) : status === 'rejected' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-md bg-rose-100 text-rose-800 border border-rose-200">
                          <i className="fas fa-ban" />
                          <span>Đã từ chối yêu cầu</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-md bg-amber-100 text-amber-800 border border-amber-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                          <span>Chờ duyệt</span>
                        </span>
                      )}
                    </td>

                    {/* Action buttons */}
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      {status === 'pending' ? (
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Accept Button (Green) */}
                          <button
                            type="button"
                            disabled={isLoading}
                            onClick={() => handleApprove(req)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 rounded-lg shadow-2xs transition disabled:opacity-50 cursor-pointer"
                            title="Phê duyệt yêu cầu này"
                            aria-label="Xác nhận duyệt nhanh"
                          >
                            {isLoading ? (
                              <i className="fas fa-spinner fa-spin text-[10px]" />
                            ) : (
                              <i className="fas fa-check text-[10px]" />
                            )}
                            <span>✓ Phê duyệt / Accept</span>
                          </button>

                          {/* Reject Button (Red) */}
                          <button
                            type="button"
                            disabled={isLoading}
                            onClick={() => handleReject(req)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:scale-95 rounded-lg shadow-2xs transition disabled:opacity-50 cursor-pointer"
                            title="Từ chối yêu cầu này"
                            aria-label="Từ chối yêu cầu"
                          >
                            <i className="fas fa-xmark text-[10px]" />
                            <span>✗ Từ chối / Reject</span>
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] font-medium text-slate-400 italic">
                          Đã hoàn tất
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* Render Mode 2: Single or Detailed Card UI */
        <div className="space-y-3">
          {rawRequests.map((req, idx) => {
            const reqId = req.requestId || req.id || idx;
            const status = getStatus(req);
            const isLoading = Boolean(actionLoading[reqId]);
            const role = req.requesterRole || req.role || 'sinh-vien';
            const roleLabel =
              role === 'giao-vien' || role === 'teacher' ? 'Giảng viên' : 'Sinh viên';
            const roleBadgeClass =
              role === 'giao-vien' || role === 'teacher'
                ? 'bg-purple-100 text-purple-800 border-purple-200'
                : 'bg-blue-100 text-blue-800 border-blue-200';

            return (
              <div
                key={reqId}
                className="bg-white rounded-xl p-3 sm:p-3.5 border border-slate-200/90 shadow-2xs space-y-2.5 transition-all"
              >
                {/* Person Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-sm shrink-0 border border-slate-200">
                      {(req.title || req.requesterName || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h5 className="font-bold text-xs sm:text-[13px] text-slate-900 leading-tight">
                          {req.title || req.requesterName || 'Người yêu cầu'}
                        </h5>
                        <span className={`px-2 py-0.2 text-[10px] font-bold rounded-md border ${roleBadgeClass}`}>
                          {roleLabel}
                        </span>
                      </div>
                      {req.meta && (
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {req.meta}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Status Indicator */}
                  <div>
                    {status === 'approved' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <i className="fas fa-check" />
                        <span>Đã phê duyệt</span>
                      </span>
                    ) : status === 'rejected' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-md bg-rose-100 text-rose-800 border border-rose-200">
                        <i className="fas fa-ban" />
                        <span>Đã từ chối</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-md bg-amber-100 text-amber-800 border border-amber-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                        <span>Chờ duyệt</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Content / Permission Request Details */}
                <div className="bg-slate-50/80 p-2.5 rounded-lg border border-slate-200/70 text-xs space-y-1">
                  <div className="flex items-start gap-1.5 text-slate-700">
                    <i className="fas fa-key text-indigo-500 mt-0.5 text-[11px] shrink-0" />
                    <div>
                      <strong className="font-bold text-slate-900">Nội dung xin cấp quyền / thay đổi:</strong>
                      <p className="text-slate-800 mt-0.5">
                        {req.permission || req.subtitle || req.type || 'Xin cấp quyền / Cập nhật hồ sơ'}
                      </p>
                    </div>
                  </div>
                  {req.reason && (
                    <p className="text-[11px] text-slate-600 pl-4 italic">
                      Lý do: &quot;{req.reason}&quot;
                    </p>
                  )}
                </div>

                {/* Details Grid if provided */}
                {Array.isArray(req.details) && req.details.length > 0 && (
                  <div className="grid grid-cols-2 gap-1.5 py-0.5 text-[11px]">
                    {req.details.map((detail, dIdx) => (
                      <div
                        key={dIdx}
                        className="bg-white px-2 py-1 rounded-md border border-slate-200/60 flex flex-col"
                      >
                        <span className="text-slate-400 text-[10px]">{detail.label}</span>
                        <span className="font-semibold text-slate-800 truncate">
                          {detail.value}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Status Banners / Action Buttons */}
                <div className="pt-1">
                  {status === 'approved' ? (
                    <div className="flex items-center gap-1.5 text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl text-xs font-semibold">
                      <i className="fas fa-circle-check text-emerald-600" />
                      <span>✓ Đã phê duyệt thành công (Hệ thống đã cập nhật phân quyền)</span>
                    </div>
                  ) : status === 'rejected' ? (
                    <div className="flex items-center gap-1.5 text-rose-800 bg-rose-50 border border-rose-200 px-3 py-2 rounded-xl text-xs font-semibold">
                      <i className="fas fa-circle-xmark text-rose-600" />
                      <span>✗ Đã từ chối yêu cầu cấp quyền này</span>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Green Accept Button */}
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => handleApprove(req)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 rounded-lg shadow-2xs transition disabled:opacity-50 cursor-pointer"
                        title="Phê duyệt yêu cầu này"
                        aria-label="Xác nhận duyệt nhanh"
                      >
                        {isLoading ? (
                          <>
                            <i className="fas fa-spinner fa-spin text-xs" />
                            <span>Đang xử lý...</span>
                          </>
                        ) : (
                          <>
                            <i className="fas fa-check text-xs" />
                            <span>✓ Phê duyệt / Accept (Xác nhận duyệt nhanh)</span>
                          </>
                        )}
                      </button>

                      {/* Red Reject Button */}
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => handleReject(req)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:scale-95 rounded-lg shadow-2xs transition disabled:opacity-50 cursor-pointer"
                        title="Từ chối yêu cầu này"
                        aria-label="✗ Từ chối"
                      >
                        <i className="fas fa-xmark text-xs" />
                        <span>✗ Từ chối / Reject</span>
                      </button>

                      {/* Detail navigation */}
                      {onNavigate && (
                        <button
                          type="button"
                          onClick={() => onNavigate(card.action?.path || '/admin/profile-requests')}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition cursor-pointer ml-auto"
                        >
                          <span>Xem chi tiết</span>
                          <i className="fas fa-arrow-right text-[10px]" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer Navigation */}
      {onNavigate && (
        <div className="pt-1 flex items-center justify-between text-xs border-t border-slate-200/70">
          <span className="text-[11px] text-slate-500">
            Hành động duyệt sẽ áp dụng trực tiếp lên hệ thống và gửi thông báo tới người dùng.
          </span>
          <button
            type="button"
            onClick={() => onNavigate(card.action?.path || '/admin/profile-requests')}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:text-indigo-900 bg-white hover:bg-indigo-50 border border-indigo-200 rounded-lg transition cursor-pointer shrink-0"
          >
            <span>Mở trang Quản lý duyệt</span>
            <i className="fas fa-arrow-up-right-from-square text-[10px]" />
          </button>
        </div>
      )}
    </div>
  );
}

export default ApprovalRequestCard;
