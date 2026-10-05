import { useMemo, useState } from 'react';
import { PageHeader, SearchInput } from '../../../components/ui/PageHeader.jsx';
import { DataTable } from '../../../components/ui/DataTable.jsx';
import { Pagination } from '../../../components/ui/Pagination.jsx';
import { Modal } from '../../../components/ui/Modal.jsx';
import { FormField, inputClass } from '../../../components/ui/FormField.jsx';
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
  const { updateStatus, resetPassword, remove } = useAccountMutations();

  const rows = data?.data || [];
  const meta = data?.meta || { page: 1, pages: 1, total: 0 };
  const tableRows = config.showSerialNumber
    ? rows.map((account, index) => ({ ...account, serialNumber: (meta.page - 1) * meta.limit + index + 1 }))
    : rows;

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
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(account._id);
      toast.success('Đã xóa tài khoản');
    } catch (error) {
      toast.error(error.message);
    }
  };

  const columns = [
    ...(config.showSerialNumber ? [{ key: 'serialNumber', header: 'STT', className: 'w-16 text-center' }] : []),
    {
      key: 'code',
      header: 'Mã',
      className: 'font-semibold text-gray-800',
      render: (a) => (a[config.role === 'giao-vien' ? 'teacher' : 'student']?.id != null
        ? config.formatCode(a[config.role === 'giao-vien' ? 'teacher' : 'student'].id)
        : '—'),
    },
    { key: 'hoTen', header: 'Họ tên', render: (a) => a.hoTen || '—' },
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
            <button type="button" onClick={() => doUnlock(a)} className="w-8 h-8 rounded-lg text-emerald-600 hover:bg-emerald-50" title="Mở khóa">
              <i className="fas fa-unlock" />
            </button>
          ) : (
            <button type="button" onClick={() => setLockTarget(a)} className="w-8 h-8 rounded-lg text-amber-600 hover:bg-amber-50" title="Khóa">
              <i className="fas fa-lock" />
            </button>
          )}
          <button type="button" onClick={() => doReset(a)} className="w-8 h-8 rounded-lg text-indigo-600 hover:bg-indigo-50" title="Đặt lại mật khẩu">
            <i className="fas fa-key" />
          </button>
          <button type="button" onClick={() => doDelete(a)} className="w-8 h-8 rounded-lg text-red-600 hover:bg-red-50" title="Xóa">
            <i className="fas fa-trash-alt" />
          </button>
        </div>
      ),
    },
  ];

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
              setPage(1);
            }}
          />
        }
      />

      <DataTable columns={columns} rows={tableRows} isLoading={isLoading} emptyText="Chưa có tài khoản" />
      <Pagination page={meta.page} pages={meta.pages} total={meta.total} onPageChange={setPage} />

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
