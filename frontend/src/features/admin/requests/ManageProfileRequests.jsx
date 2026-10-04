import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader, SearchInput } from '../../../components/ui/PageHeader.jsx';
import { DataTable } from '../../../components/ui/DataTable.jsx';
import { Pagination } from '../../../components/ui/Pagination.jsx';
import { Modal } from '../../../components/ui/Modal.jsx';
import { Avatar } from '../../../components/ui/Avatar.jsx';
import { FormField, inputClass } from '../../../components/ui/FormField.jsx';
import { useToast } from '../../../app/providers/ToastProvider.jsx';
import { useConfirm } from '../../../app/providers/ConfirmProvider.jsx';
import { useDebounce } from '../../../lib/useDebounce.js';
import { profileRequestsApi } from '../../../api/profileRequestsApi.js';
import { formatStudentCode, formatTeacherCode } from '../../../lib/format.js';

export function ManageProfileRequests() {
  const toast = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'approved' | 'rejected' | 'all'
  const [filterRole, setFilterRole] = useState('all'); // 'all' | 'giao-vien' | 'sinh-vien'
  const [page, setPage] = useState(1);
  const [searchText, setSearchText] = useState('');
  const search = useDebounce(searchText);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkApproveModalOpen, setBulkApproveModalOpen] = useState(false);

  // Reject Modal
  const [rejectModal, setRejectModal] = useState({ isOpen: false, targetId: null, isBulk: false, reason: '' });

  useEffect(() => {
    setSelectedIds([]);
  }, [activeTab, filterRole, page, search]);

  const params = useMemo(() => {
    const p = { page, limit: 10, search };
    if (activeTab !== 'all') p.status = activeTab;
    if (filterRole !== 'all') p.requesterRole = filterRole;
    return p;
  }, [activeTab, filterRole, page, search]);

  const { data, isLoading } = useQuery({
    queryKey: ['profile-requests', params],
    queryFn: () => profileRequestsApi.list(params),
    refetchInterval: 15000,
  });

  const rows = data?.data || [];
  const meta = data?.meta || { page: 1, pages: 1, total: 0 };
  const pendingCount = data?.pendingCount ?? 0;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['profile-requests'] });
    queryClient.invalidateQueries({ queryKey: ['teachers'] });
    queryClient.invalidateQueries({ queryKey: ['students'] });
    queryClient.invalidateQueries({ queryKey: ['accounts'] });
  };

  const approveMutation = useMutation({
    mutationFn: (id) => profileRequestsApi.approve(id),
    onSuccess: () => {
      invalidate();
      toast.success('Đã phê duyệt yêu cầu thay đổi');
    },
    onError: (err) => toast.error(err.message || 'Lỗi khi phê duyệt'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }) => profileRequestsApi.reject(id, reason),
    onSuccess: () => {
      invalidate();
      toast.success('Đã từ chối yêu cầu thay đổi');
      setRejectModal({ isOpen: false, targetId: null, isBulk: false, reason: '' });
    },
    onError: (err) => toast.error(err.message || 'Lỗi khi từ chối'),
  });

  const bulkApproveMutation = useMutation({
    mutationFn: (ids) => profileRequestsApi.bulkApprove(ids),
    onSuccess: (res) => {
      invalidate();
      toast.success(`Đã phê duyệt thành công ${res.approvedCount || selectedIds.length} yêu cầu`);
      setSelectedIds([]);
      setBulkApproveModalOpen(false);
    },
    onError: (err) => toast.error(err.message || 'Lỗi khi phê duyệt hàng loạt'),
  });

  const bulkRejectMutation = useMutation({
    mutationFn: ({ ids, reason }) => profileRequestsApi.bulkReject(ids, reason),
    onSuccess: (res) => {
      invalidate();
      toast.success(`Đã từ chối ${res.rejectedCount || selectedIds.length} yêu cầu`);
      setSelectedIds([]);
      setRejectModal({ isOpen: false, targetId: null, isBulk: false, reason: '' });
    },
    onError: (err) => toast.error(err.message || 'Lỗi khi từ chối hàng loạt'),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids) => profileRequestsApi.bulkDelete(ids),
    onSuccess: () => {
      invalidate();
      toast.success(`Đã xóa ${selectedIds.length} bản ghi yêu cầu`);
      setSelectedIds([]);
    },
    onError: (err) => toast.error(err.message || 'Lỗi khi xóa bản ghi'),
  });

  const handleApprove = async (req) => {
    const ok = await confirm({
      title: 'Phê duyệt thay đổi',
      message: `Bạn có chắc muốn duyệt thay đổi cho ${req.requesterRole === 'giao-vien' ? 'Giảng viên' : 'Sinh viên'} "${req.requesterName}"? Thông tin mới sẽ được áp dụng ngay lập tức.`,
      confirmText: 'Phê duyệt',
      tone: 'primary',
    });
    if (!ok) return;
    approveMutation.mutate(req._id);
  };

  const handleRejectPrompt = (req) => {
    setRejectModal({
      isOpen: true,
      targetId: req._id,
      isBulk: false,
      reason: '',
    });
  };

  const handleBulkApprove = () => {
    if (selectedIds.length === 0) return;
    setBulkApproveModalOpen(true);
  };

  const handleBulkRejectPrompt = () => {
    if (selectedIds.length === 0) return;
    setRejectModal({
      isOpen: true,
      targetId: null,
      isBulk: true,
      reason: '',
    });
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const ok = await confirm({
      title: 'Xóa yêu cầu đã chọn',
      message: `Xóa ${selectedIds.length} bản ghi yêu cầu đã chọn khỏi danh sách?`,
      confirmText: `Xóa ${selectedIds.length} mục`,
      tone: 'danger',
    });
    if (!ok) return;
    bulkDeleteMutation.mutate(selectedIds);
  };

  const handleConfirmReject = () => {
    if (rejectModal.isBulk) {
      bulkRejectMutation.mutate({ ids: selectedIds, reason: rejectModal.reason.trim() });
    } else if (rejectModal.targetId) {
      rejectMutation.mutate({ id: rejectModal.targetId, reason: rejectModal.reason.trim() });
    }
  };

  const columns = [
    {
      key: 'requester',
      header: 'Người gửi yêu cầu',
      className: 'min-w-[220px]',
      render: (r) => {
        const isGV = r.requesterRole === 'giao-vien';
        const formattedCode =
          r.requesterCode != null
            ? isGV
              ? formatTeacherCode(r.requesterCode)
              : formatStudentCode(r.requesterCode)
            : '—';
        const avatarUrl = r.currentData?.avatar?.url || r.currentData?.avatar;

        return (
          <div className="flex items-center gap-3">
            <Avatar src={avatarUrl} name={r.requesterName} size={42} />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-900 text-sm">{r.requesterName || 'Người dùng'}</span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    isGV ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                  }`}
                >
                  {isGV ? 'Giáo viên' : 'Sinh viên'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                <span className="font-semibold text-gray-700">{formattedCode}</span>
                <span>•</span>
                <span>{r.requesterEmail}</span>
              </div>
            </div>
          </div>
        );
      },
    },
    {
      key: 'type',
      header: 'Loại thay đổi',
      className: 'w-32',
      render: (r) => {
        if (r.type === 'avatar') {
          return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-purple-50 text-purple-700 text-xs font-semibold border border-purple-100">
              <i className="fas fa-image" /> Ảnh đại diện
            </span>
          );
        }
        if (r.type === 'profile') {
          return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-100">
              <i className="fas fa-id-card" /> Thông tin cá nhân
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-50 text-amber-700 text-xs font-semibold border border-amber-100">
            <i className="fas fa-user-pen" /> Ảnh & Thông tin
          </span>
        );
      },
    },
    {
      key: 'comparison',
      header: 'Chi tiết thay đổi đề xuất',
      className: 'min-w-[280px]',
      render: (r) => {
        const reqAvt = r.requestedData?.avatar?.url || r.requestedData?.avatar;
        const curAvt = r.currentData?.avatar?.url || r.currentData?.avatar;
        // Chỉ hiển thị đúng những thông tin có thay đổi thực sự so với dữ liệu hiện tại
        const reqFields = Object.entries(r.requestedData || {}).filter(([k, v]) => {
          if (k === 'avatar' || v === undefined || v === null || v === '') return false;
          const oldVal = r.currentData?.[k] ?? '';
          return String(v).trim() !== String(oldVal).trim();
        });

        return (
          <div className="space-y-2 py-1">
            {reqAvt && (
              <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-xl border border-gray-100">
                <div className="text-center">
                  <Avatar src={curAvt} name={r.requesterName} size={36} />
                  <span className="text-[10px] text-gray-400 block mt-0.5">Hiện tại</span>
                </div>
                <div className="text-gray-400 text-xs">
                  <i className="fas fa-arrow-right" />
                </div>
                <div className="text-center">
                  <div className="relative inline-block ring-2 ring-indigo-500 rounded-full">
                    <Avatar src={reqAvt} name={r.requesterName} size={36} />
                  </div>
                  <span className="text-[10px] font-bold text-indigo-600 block mt-0.5">Ảnh mới</span>
                </div>
              </div>
            )}

            {reqFields.length > 0 ? (
              <div className="text-xs space-y-1">
                {reqFields.map(([k, val]) => {
                  const labels = {
                    hoTen: 'Họ tên',
                    phone: 'SĐT',
                    address: 'Địa chỉ',
                    dob: 'Ngày sinh',
                    gender: 'Giới tính',
                    education: r.requesterRole === 'giao-vien' ? 'Trình độ học vị' : 'Hệ đào tạo',
                  };
                  const oldVal = r.currentData?.[k] || '—';
                  return (
                    <div key={k} className="flex items-center gap-1.5 text-gray-700">
                      <span className="font-semibold text-gray-500">{labels[k] || k}:</span>
                      <span className="line-through text-gray-400">{oldVal}</span>
                      <i className="fas fa-arrow-right text-[10px] text-indigo-500" />
                      <span className="font-bold text-indigo-700">{val}</span>
                    </div>
                  );
                })}
              </div>
            ) : !reqAvt ? (
              <span className="text-xs text-gray-400 italic">Không có thay đổi thông tin</span>
            ) : null}
          </div>
        );
      },
    },
    {
      key: 'createdAt',
      header: 'Thời gian',
      className: 'w-28 text-xs text-gray-500',
      render: (r) => (
        <div>
          <p className="font-medium text-gray-700">
            {new Date(r.createdAt).toLocaleDateString('vi-VN')}
          </p>
          <p className="text-[11px] text-gray-400">
            {new Date(r.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      className: 'w-28',
      render: (r) => {
        if (r.status === 'pending') {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
              <i className="fas fa-clock text-[10px]" /> Chờ duyệt
            </span>
          );
        }
        if (r.status === 'approved') {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <i className="fas fa-check text-[10px]" /> Đã duyệt
            </span>
          );
        }
        return (
          <div title={r.adminNote || 'Đã từ chối'}>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
              <i className="fas fa-times text-[10px]" /> Bị từ chối
            </span>
            {r.adminNote && (
              <p className="text-[11px] text-red-500 italic mt-0.5 truncate max-w-[120px]" title={r.adminNote}>
                {r.adminNote}
              </p>
            )}
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right w-36',
      render: (r) => (
        <div className="flex items-center justify-end gap-1.5">
          {r.status === 'pending' && (
            <>
              <button
                type="button"
                onClick={() => handleApprove(r)}
                disabled={approveMutation.isPending}
                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition flex items-center gap-1"
                title="Duyệt yêu cầu này"
              >
                <i className="fas fa-check" />
                <span>Duyệt</span>
              </button>
              <button
                type="button"
                onClick={() => handleRejectPrompt(r)}
                disabled={rejectMutation.isPending}
                className="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold transition flex items-center gap-1"
                title="Từ chối yêu cầu"
              >
                <i className="fas fa-times" />
                <span>Từ chối</span>
              </button>
            </>
          )}
          {r.status !== 'pending' && (
            <button
              type="button"
              onClick={async () => {
                const ok = await confirm({
                  title: 'Xóa bản ghi',
                  message: 'Xóa bản ghi lịch sử yêu cầu này khỏi hệ thống?',
                  confirmText: 'Xóa',
                  tone: 'danger',
                });
                if (ok) bulkDeleteMutation.mutate([r._id]);
              }}
              className="w-8 h-8 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
              title="Xóa lịch sử"
            >
              <i className="fas fa-trash-alt text-xs" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Duyệt Yêu Cầu Thay Đổi Thông Tin & Avatar"
        subtitle="Quản lý và phê duyệt các yêu cầu cập nhật hồ sơ cá nhân và ảnh đại diện từ Giảng viên & Sinh viên"
        actions={
          <div className="flex items-center gap-3">
            <SearchInput
              value={searchText}
              onChange={(v) => {
                setSearchText(v);
                setPage(1);
              }}
              placeholder="Tìm theo tên, email, mã số..."
            />
          </div>
        }
      />

      {/* Tabs & Role filter bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-3 rounded-2xl border border-gray-100 shadow-xs">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => {
              setActiveTab('pending');
              setPage(1);
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'pending'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
          >
            <i className="fas fa-clock" />
            <span>Chờ duyệt</span>
            {pendingCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-white text-amber-600 font-extrabold text-[10px]">
                {pendingCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('approved');
              setPage(1);
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'approved'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
          >
            <i className="fas fa-check-circle" />
            <span>Đã duyệt</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('rejected');
              setPage(1);
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'rejected'
                ? 'bg-red-600 text-white shadow-xs'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
          >
            <i className="fas fa-times-circle" />
            <span>Đã từ chối</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('all');
              setPage(1);
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'all'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
          >
            Tất cả
          </button>
        </div>

        {/* Role Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 font-medium">Đối tượng:</span>
          <select
            className="px-3 py-1.5 text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={filterRole}
            onChange={(e) => {
              setFilterRole(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">Tất cả vai trò</option>
            <option value="giao-vien">Chỉ Giảng viên</option>
            <option value="sinh-vien">Chỉ Sinh viên</option>
          </select>
        </div>
      </div>

      {/* Main Table with Bulk actions */}
      <DataTable
        columns={columns}
        rows={rows}
        isLoading={isLoading}
        emptyText={
          activeTab === 'pending'
            ? 'Không có yêu cầu nào đang chờ duyệt'
            : 'Không tìm thấy yêu cầu nào phù hợp'
        }
        selectable
        selectedKeys={selectedIds}
        onSelectKey={(key) =>
          setSelectedIds((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
        }
        onSelectAll={(allKeys) =>
          setSelectedIds((prev) =>
            allKeys.every((k) => prev.includes(k))
              ? prev.filter((k) => !allKeys.includes(k))
              : Array.from(new Set([...prev, ...allKeys]))
          )
        }
        bulkActions={
          <>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="px-3 py-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50"
            >
              Bỏ chọn
            </button>
            <button
              type="button"
              onClick={handleBulkApprove}
              disabled={bulkApproveMutation.isPending}
              className="px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 shadow-xs flex items-center gap-1.5 transition"
              title="Duyệt tất cả các mục đã chọn"
            >
              <i className="fas fa-check-double" />
              <span>Duyệt tất cả (Bulk Approve)</span>
            </button>
            <button
              type="button"
              onClick={handleBulkRejectPrompt}
              disabled={bulkRejectMutation.isPending}
              className="px-3 py-1.5 text-xs font-bold text-white bg-amber-600 rounded-xl hover:bg-amber-700 shadow-xs flex items-center gap-1.5"
            >
              <i className="fas fa-ban" />
              <span>Từ chối {selectedIds.length} yêu cầu</span>
            </button>
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={bulkDeleteMutation.isPending}
              className="px-3 py-1.5 text-xs font-bold text-white bg-red-600 rounded-xl hover:bg-red-700 shadow-xs flex items-center gap-1.5"
            >
              <i className="fas fa-trash-alt" />
              <span>Xóa {selectedIds.length} mục</span>
            </button>
          </>
        }
      />

      <Pagination page={meta.page} pages={meta.pages} total={meta.total} onPageChange={setPage} />

      {/* Modal Popup xác nhận Duyệt hàng loạt */}
      {bulkApproveModalOpen && (
        <Modal
          open={bulkApproveModalOpen}
          onClose={() => !bulkApproveMutation.isPending && setBulkApproveModalOpen(false)}
          title="Xác nhận duyệt hàng loạt"
          size="sm"
        >
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-2xl border border-emerald-100">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-lg shrink-0">
                <i className="fas fa-check-double" />
              </div>
              <div>
                <p className="font-bold text-gray-900 text-sm">
                  Duyệt hàng loạt (Bulk Approval)
                </p>
                <p className="text-xs text-emerald-700 font-medium">
                  Đã chọn {selectedIds.length} mục
                </p>
              </div>
            </div>

            <p className="text-sm text-gray-800 font-semibold leading-relaxed">
              Bạn có chắc chắn muốn duyệt {selectedIds.length} mục này không?
            </p>

            <p className="text-xs text-gray-500 leading-normal">
              Sau khi xác nhận, toàn bộ ảnh đại diện và thông tin đề xuất của các mục đã chọn sẽ được áp dụng ngay vào hệ thống và gửi thông báo đến người dùng.
            </p>

            <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setBulkApproveModalOpen(false)}
                disabled={bulkApproveMutation.isPending}
                className="px-4 py-2 text-sm font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => bulkApproveMutation.mutate(selectedIds)}
                disabled={bulkApproveMutation.isPending}
                className="px-4 py-2 text-sm font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 shadow-xs transition flex items-center gap-2"
              >
                {bulkApproveMutation.isPending ? (
                  <>
                    <i className="fas fa-spinner fa-spin" />
                    <span>Đang duyệt...</span>
                  </>
                ) : (
                  <>
                    <i className="fas fa-check" />
                    <span>Xác nhận duyệt</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Reject Modal */}
      {rejectModal.isOpen && (
        <Modal
          open
          onClose={() => setRejectModal({ isOpen: false, targetId: null, isBulk: false, reason: '' })}
          title={rejectModal.isBulk ? `Từ chối ${selectedIds.length} yêu cầu` : 'Từ chối yêu cầu thay đổi'}
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Bạn có thể nhập lý do từ chối (tùy chọn) để gửi kèm thông báo giải thích cho người dùng:
            </p>
            <FormField label="Lý do từ chối">
              <textarea
                className={`${inputClass} min-h-[90px]`}
                placeholder="VD: Ảnh không rõ mặt, vi phạm quy định chuẩn ảnh thẻ..."
                value={rejectModal.reason}
                onChange={(e) => setRejectModal((prev) => ({ ...prev, reason: e.target.value }))}
              />
            </FormField>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRejectModal({ isOpen: false, targetId: null, isBulk: false, reason: '' })}
                className="px-4 py-2 text-sm font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={rejectMutation.isPending || bulkRejectMutation.isPending}
                className="px-4 py-2 text-sm font-bold text-white bg-red-600 rounded-xl hover:bg-red-700 shadow-xs flex items-center gap-1.5"
              >
                <i className="fas fa-times" />
                <span>Xác nhận từ chối</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default ManageProfileRequests;

