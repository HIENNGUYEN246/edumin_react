import { useEffect, useMemo, useState } from 'react';
import { PageHeader, SearchInput } from '../../../components/ui/PageHeader.jsx';
import { DataTable } from '../../../components/ui/DataTable.jsx';
import { Pagination } from '../../../components/ui/Pagination.jsx';
import { Modal } from '../../../components/ui/Modal.jsx';
import { FormField, inputClass } from '../../../components/ui/FormField.jsx';
import { Avatar } from '../../../components/ui/Avatar.jsx';
import { useToast } from '../../../app/providers/ToastProvider.jsx';
import { useConfirm } from '../../../app/providers/ConfirmProvider.jsx';
import { useDebounce } from '../../../lib/useDebounce.js';
import { useAccounts, useAccountMutations } from './useAccounts.js';

const LOCK_REASONS = ['Vi phạm quy định', 'Nghỉ học/nghỉ dạy', 'Yêu cầu từ quản lý', 'Khác'];

/**
 * Shared account manager for teacher/student roles.
 * config: { role, title, subtitle, formatCode }
 */
export function AccountManager({ config }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [page, setPage] = useState(1);
  const [searchText, setSearchText] = useState('');
  const search = useDebounce(searchText);
  const [lockTarget, setLockTarget] = useState(null);
  const [lockReason, setLockReason] = useState(LOCK_REASONS[0]);
  const [customReason, setCustomReason] = useState('');
  const [tempPassword, setTempPassword] = useState(null);

  const params = useMemo(() => ({ role: config.role, page, limit: 10, search }), [config.role, page, search]);
  const { data, isLoading } = useAccounts(params);
  const { updateStatus, resetPassword, remove, bulkDelete } = useAccountMutations();
  const [selectedIds, setSelectedIds] = useState([]);
  const [lastClickedIndex, setLastClickedIndex] = useState(null);

  useEffect(() => {
    setSelectedIds([]);
    setLastClickedIndex(null);
  }, [page, search]);

  const rows = data?.data || [];
  const meta = data?.meta || { page: 1, pages: 1, total: 0 };
  const tableRows = config.showSerialNumber
    ? rows.map((account, index) => ({ ...account, serialNumber: (meta.page - 1) * meta.limit + index + 1 }))
    : rows;

  const isStudentRole = config.role === 'sinh-vien';
  const isTeacherRole = config.role === 'giao-vien';
  const hideAvatar = Boolean(config.hideAvatar || isStudentRole || isTeacherRole);
  const allCurrentRowIds = rows.map((r) => r._id);
  const isAllSelected = rows.length > 0 && allCurrentRowIds.every((id) => selectedIds.includes(id));
  const isSomeSelected = rows.length > 0 && allCurrentRowIds.some((id) => selectedIds.includes(id)) && !isAllSelected;

  const handleSelectAll = () => {
    setLastClickedIndex(null);
    if (isAllSelected) {
      setSelectedIds((prev) => prev.filter((id) => !allCurrentRowIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...allCurrentRowIds])));
    }
  };

  const handleRowCheckboxClick = (e, account, rowIndex) => {
    e.stopPropagation();

    if (e.shiftKey) {
      window.getSelection?.()?.removeAllRanges?.();
    }

    const index = typeof rowIndex === 'number' ? rowIndex : tableRows.findIndex((r) => r._id === account._id);
    const isCurrentlyChecked = selectedIds.includes(account._id);
    const targetChecked = !isCurrentlyChecked;

    if (e.shiftKey && lastClickedIndex !== null && lastClickedIndex !== index && index >= 0) {
      const start = Math.min(lastClickedIndex, index);
      const end = Math.max(lastClickedIndex, index);
      const rangeRows = tableRows.slice(start, end + 1);
      const rangeIds = rangeRows.map((r) => r._id);

      if (targetChecked) {
        setSelectedIds((prev) => Array.from(new Set([...prev, ...rangeIds])));
      } else {
        setSelectedIds((prev) => prev.filter((id) => !rangeIds.includes(id)));
      }
    } else {
      if (targetChecked) {
        setSelectedIds((prev) => (prev.includes(account._id) ? prev : [...prev, account._id]));
      } else {
        setSelectedIds((prev) => prev.filter((id) => id !== account._id));
      }
    }

    setLastClickedIndex(index >= 0 ? index : null);
  };

  const doLock = async () => {
    const reason = lockReason === 'Khác' ? customReason.trim() : lockReason;
    try {
      await updateStatus.mutateAsync({ id: lockTarget._id, status: 'Locked', lockReason: reason });
      toast.success('Đã khóa tài khoản');
      setLockTarget(null);
      setCustomReason('');
    } catch (error) {
      toast.error(error.message);
    }
  };

  const doUnlock = async (account) => {
    try {
      await updateStatus.mutateAsync({ id: account._id, status: 'Active' });
      toast.success('Đã mở khóa tài khoản');
    } catch (error) {
      toast.error(error.message);
    }
  };

  const doReset = async (account) => {
    const ok = await confirm({
      title: 'Đặt lại mật khẩu',
      message: `Cấp mật khẩu mới ngẫu nhiên cho ${account.hoTen || account.email}? Phiên đăng nhập hiện tại của họ sẽ bị đăng xuất.`,
      confirmText: 'Đặt lại',
      tone: 'primary',
    });
    if (!ok) return;
    try {
      const result = await resetPassword.mutateAsync(account._id);
      setTempPassword({ email: account.email, password: result.tempPassword });
    } catch (error) {
      toast.error(error.message);
    }
  };

  const doDelete = async (account) => {
    const ok = await confirm({
      title: 'Xóa tài khoản',
      message: `Xóa tài khoản ${account.email}? Hồ sơ liên quan cũng sẽ bị xóa.`,
      confirmText: 'Xóa',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(account._id);
      setSelectedIds((prev) => prev.filter((id) => id !== account._id));
      toast.success('Đã xóa tài khoản');
    } catch (error) {
      toast.error(error.message);
    }
  };

  const onBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const ok = await confirm({
      title: 'Xóa nhiều tài khoản đã chọn',
      message: `Bạn có chắc muốn xóa ${selectedIds.length} tài khoản đã chọn? Hồ sơ liên quan cũng sẽ bị xóa.`,
      confirmText: `Xóa ${selectedIds.length} tài khoản`,
      tone: 'danger',
    });
    if (!ok) return;
    try {
      if (bulkDelete) {
        await bulkDelete.mutateAsync(selectedIds);
      } else {
        await Promise.all(selectedIds.map((id) => remove.mutateAsync(id)));
      }
      toast.success(`Đã xóa ${selectedIds.length} tài khoản`);
      setSelectedIds([]);
      setLastClickedIndex(null);
    } catch (error) {
      toast.error(error.message || 'Lỗi khi xóa tài khoản');
    }
  };

  const selectionColumn = {
    key: 'selection',
    header: (
      <div className="flex items-center justify-center">
        <input
          type="checkbox"
          checked={isAllSelected}
          ref={(el) => {
            if (el) el.indeterminate = isSomeSelected;
          }}
          onChange={handleSelectAll}
          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
          title="Chọn tất cả"
          aria-label="Chọn tất cả"
        />
      </div>
    ),
    className: 'w-10 text-center px-2',
    render: (account, rowIndex) => (
      <div className="flex items-center justify-center select-none" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={selectedIds.includes(account._id)}
          onChange={() => {}}
          onClick={(e) => handleRowCheckboxClick(e, account, rowIndex)}
          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
          aria-label={`Chọn ${account.hoTen || account.email}`}
        />
      </div>
    ),
  };

  const codeHeader = isStudentRole ? 'Mã SV' : isTeacherRole ? 'Mã GV' : 'Mã';

  const baseColumns = [
    ...(config.showSerialNumber ? [{ key: 'serialNumber', header: 'STT', className: 'w-16 text-center' }] : []),
    ...(!hideAvatar
      ? [
          {
            key: 'avatar',
            header: '',
            className: 'w-12 text-center',
            render: (a) => {
              const profile = a[config.role === 'giao-vien' ? 'teacher' : 'student'];
              const avatarSrc = profile?.avatar?.url || profile?.avatar || a?.avatar?.url || a?.avatar;
              return <Avatar src={avatarSrc} name={a.hoTen} size={36} />;
            },
          },
        ]
      : []),
    {
      key: 'code',
      header: codeHeader,
      className: 'font-semibold text-gray-800 whitespace-nowrap',
      render: (a) => {
        const profile = a[config.role === 'giao-vien' ? 'teacher' : 'student'];
        const val = profile?.id != null ? profile.id : a?.id;
        return val != null ? config.formatCode(val) : '—';
      },
    },
    { key: 'hoTen', header: 'Họ tên', className: 'font-bold text-gray-900', render: (a) => a.hoTen || '—' },
    { key: 'email', header: 'Email' },
    {
      key: 'status',
      header: 'Trạng thái',
      render: (a) =>
        a.status === 'Locked' ? (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2.5 py-1 rounded-full">
            <i className="fas fa-lock" /> Đã khóa
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
            <i className="fas fa-circle-check" /> Hoạt động
          </span>
        ),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right w-40',
      render: (a) => (
        <div className="flex justify-end gap-2">
          {a.status === 'Locked' ? (
            <button type="button" onClick={() => doUnlock(a)} className="w-8 h-8 rounded-lg text-emerald-600 hover:bg-emerald-50" title="Mở khóa" aria-label="Mở khóa">
              <i className="fas fa-unlock" />
            </button>
          ) : (
            <button type="button" onClick={() => setLockTarget(a)} className="w-8 h-8 rounded-lg text-amber-600 hover:bg-amber-50" title="Khóa" aria-label="Khóa">
              <i className="fas fa-lock" />
            </button>
          )}
          <button type="button" onClick={() => doReset(a)} className="w-8 h-8 rounded-lg text-indigo-600 hover:bg-indigo-50" title="Đặt lại mật khẩu" aria-label="Đặt lại mật khẩu">
            <i className="fas fa-key" />
          </button>
          <button type="button" onClick={() => doDelete(a)} className="w-8 h-8 rounded-lg text-red-600 hover:bg-red-50" title="Xóa" aria-label="Xóa">
            <i className="fas fa-trash-alt" />
          </button>
        </div>
      ),
    },
  ];

  const columns = [selectionColumn, ...baseColumns];

  return (
    <div>
      <PageHeader
        title={config.title}
        subtitle={config.subtitle}
        actions={
          <SearchInput
            value={searchText}
            onChange={(v) => {
              setSearchText(v);
              setSelectedIds([]);
              setLastClickedIndex(null);
              setPage(1);
            }}
          />
        }
      />

      {selectedIds.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/90 px-4 py-3 shadow-xs">
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-xs font-bold text-white shadow-xs">
              {selectedIds.length}
            </span>
            <span className="text-sm font-medium text-indigo-950">
              Đang chọn <strong className="text-indigo-700">{selectedIds.length}</strong> tài khoản
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSelectedIds([]);
                setLastClickedIndex(null);
              }}
              className="rounded-xl border border-gray-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 shadow-2xs transition"
            >
              Bỏ chọn
            </button>
            <button
              type="button"
              onClick={onBulkDelete}
              disabled={bulkDelete?.isPending}
              className="flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-red-700 disabled:opacity-50 transition"
            >
              <i className="fas fa-trash-alt text-[11px]" />
              <span>{bulkDelete?.isPending ? 'Đang xóa...' : `Xóa ${selectedIds.length} tài khoản đã chọn`}</span>
            </button>
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={tableRows}
        isLoading={isLoading}
        emptyText="Chưa có tài khoản"
        rowClassName={(account) => (selectedIds.includes(account._id) ? 'bg-indigo-50/40' : '')}
      />
      <Pagination
        page={meta.page}
        pages={meta.pages}
        total={meta.total}
        onPageChange={(p) => {
          setSelectedIds([]);
          setLastClickedIndex(null);
          setPage(p);
        }}
      />

      <Modal open={Boolean(lockTarget)} onClose={() => setLockTarget(null)} title="Khóa tài khoản" size="sm">
        <div className="space-y-4">
          <FormField label="Lý do khóa">
            <select className={inputClass} value={lockReason} onChange={(e) => setLockReason(e.target.value)}>
              {LOCK_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </FormField>
          {lockReason === 'Khác' && (
            <FormField label="Nhập lý do">
              <input className={inputClass} value={customReason} onChange={(e) => setCustomReason(e.target.value)} />
            </FormField>
          )}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setLockTarget(null)} className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200">
              Hủy
            </button>
            <button type="button" onClick={doLock} disabled={updateStatus.isPending} className="px-4 py-2 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-60">
              Khóa
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(tempPassword)} onClose={() => setTempPassword(null)} title="Mật khẩu tạm thời" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Đã đặt lại mật khẩu cho <span className="font-semibold">{tempPassword?.email}</span>. Hãy sao chép và gửi cho
            người dùng — mật khẩu này chỉ hiển thị một lần.
          </p>
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
            <code className="flex-1 font-mono text-indigo-700 text-lg">{tempPassword?.password}</code>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(tempPassword.password);
                toast.success('Đã sao chép');
              }}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700"
            >
              <i className="fas fa-copy mr-1" /> Sao chép
            </button>
          </div>
          <div className="flex justify-end">
            <button type="button" onClick={() => setTempPassword(null)} className="px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700">
              Đóng
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default AccountManager;
