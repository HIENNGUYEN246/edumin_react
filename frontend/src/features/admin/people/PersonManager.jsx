import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader, SearchInput } from '../../../components/ui/PageHeader.jsx';
import { DataTable } from '../../../components/ui/DataTable.jsx';
import { Pagination } from '../../../components/ui/Pagination.jsx';
import { Modal } from '../../../components/ui/Modal.jsx';
import { FormField, inputClass } from '../../../components/ui/FormField.jsx';
import { Avatar } from '../../../components/ui/Avatar.jsx';
import { useToast } from '../../../app/providers/ToastProvider.jsx';
import { useConfirm } from '../../../app/providers/ConfirmProvider.jsx';
import { useDebounce } from '../../../lib/useDebounce.js';
import { useDepartments } from '../departments/useDepartments.js';
import { usePeople, usePeopleMutations } from './usePeople.js';
import { PersonFormModal } from './PersonFormModal.jsx';
import { readSheet, exportSheet } from '../../../lib/excel.js';
import { accountsApi } from '../../../api/accountsApi.js';

const LOCK_REASONS = ['Vi phạm quy định', 'Nghỉ học/nghỉ dạy', 'Yêu cầu từ quản lý', 'Khác'];

/**
 * Config-driven manager shared by teachers and students.
 * config: { queryKey, api, title, subtitle, formatCode, columns(fmt), fields, emptyForm, exportName, enableClassFilter }
 */
export function PersonManager({ config }) {
  const toast = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const fileRef = useRef(null);

  const [page, setPage] = useState(1);
  const [searchText, setSearchText] = useState('');
  const search = useDebounce(searchText);
  const [selectedClass, setSelectedClass] = useState('');
  const [modal, setModal] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [lastClickedIndex, setLastClickedIndex] = useState(null);

  // Account management state
  const [lockTarget, setLockTarget] = useState(null);
  const [lockReason, setLockReason] = useState(LOCK_REASONS[0]);
  const [customReason, setCustomReason] = useState('');
  const [tempPassword, setTempPassword] = useState(null);
  const [locking, setLocking] = useState(false);
  const [resettingId, setResettingId] = useState(null);
  const showAccountActions = config.showAccountActions !== false;

  useEffect(() => {
    setSelectedIds([]);
  }, [page, search, selectedClass]);

  const params = useMemo(
    () => ({ page, limit: 10, search, className: selectedClass || undefined }),
    [page, search, selectedClass]
  );
  const { data, isLoading } = usePeople(config.queryKey, config.api, params);
  const mutations = usePeopleMutations(config.queryKey, config.api);
  const { data: deptData } = useDepartments({ limit: 100 });

  const { data: classesData } = useQuery({
    queryKey: [config.queryKey, 'classes-filter'],
    queryFn: async () => {
      const res = await config.api.classes?.();
      return res?.data || [];
    },
    enabled: Boolean(config.enableClassFilter && config.api?.classes),
  });

  const rows = data?.data || [];
  const meta = data?.meta || { page: 1, pages: 1, total: 0 };
  const departments = deptData?.data || [];
  const tableRows = config.showSerialNumber
    ? rows.map((person, index) => ({ ...person, serialNumber: (meta.page - 1) * params.limit + index + 1 }))
    : rows;

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

  const handleRowCheckboxClick = (e, person, rowIndex) => {
    e.stopPropagation();

    // Prevent text selection in browser when holding Shift
    if (e.shiftKey) {
      window.getSelection?.()?.removeAllRanges?.();
    }

    const index = typeof rowIndex === 'number' ? rowIndex : tableRows.findIndex((r) => r._id === person._id);
    const isCurrentlyChecked = selectedIds.includes(person._id);
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
        setSelectedIds((prev) => (prev.includes(person._id) ? prev : [...prev, person._id]));
      } else {
        setSelectedIds((prev) => prev.filter((id) => id !== person._id));
      }
    }

    setLastClickedIndex(index >= 0 ? index : null);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const count = selectedIds.length;
    const ok = await confirm({
      title: 'Xóa hàng loạt',
      message: `Bạn có chắc chắn muốn xóa ${count} ${config.entityLabel} đã chọn? Tài khoản đăng nhập tương ứng cũng sẽ bị xóa.`,
      confirmText: `Xóa ${count} bản ghi`,
    });
    if (!ok) return;

    try {
      await mutations.bulkRemove.mutateAsync(selectedIds);
      toast.success(`Đã xóa thành công ${count} ${config.entityLabel}`);
      setSelectedIds([]);
      setLastClickedIndex(null);
    } catch (error) {
      toast.error(error.message || 'Lỗi khi xóa hàng loạt');
    }
  };

  const doUnlock = async (person) => {
    const targetId = person.userId?._id || person.userId || person._id;
    try {
      await accountsApi.updateStatus(targetId, { status: 'Active' });
      toast.success('Đã mở khóa tài khoản');
      queryClient.invalidateQueries({ queryKey: [config.queryKey] });
    } catch (error) {
      toast.error(error.message || 'Lỗi khi mở khóa tài khoản');
    }
  };

  const doLock = async () => {
    if (!lockTarget) return;
    const reason = lockReason === 'Khác' ? customReason.trim() : lockReason;
    const targetId = lockTarget.userId?._id || lockTarget.userId || lockTarget._id;
    try {
      setLocking(true);
      await accountsApi.updateStatus(targetId, { status: 'Locked', lockReason: reason });
      toast.success('Đã khóa tài khoản');
      setLockTarget(null);
      setCustomReason('');
      queryClient.invalidateQueries({ queryKey: [config.queryKey] });
    } catch (error) {
      toast.error(error.message || 'Lỗi khi khóa tài khoản');
    } finally {
      setLocking(false);
    }
  };

  const doReset = async (person) => {
    const ok = await confirm({
      title: 'Đặt lại mật khẩu',
      message: `Cấp mật khẩu mới ngẫu nhiên cho ${person.hoTen || person.email}? Phiên đăng nhập hiện tại của họ sẽ bị đăng xuất.`,
      confirmText: 'Đặt lại',
      tone: 'primary',
    });
    if (!ok) return;
    const targetId = person.userId?._id || person.userId || person._id;
    try {
      setResettingId(targetId);
      const result = await accountsApi.resetPassword(targetId);
      setTempPassword({ email: person.email, password: result.tempPassword });
      toast.success('Đã tạo mật khẩu mới');
      queryClient.invalidateQueries({ queryKey: [config.queryKey] });
    } catch (error) {
      toast.error(error.message || 'Lỗi khi đặt lại mật khẩu');
    } finally {
      setResettingId(null);
    }
  };

  const openCreate = () => setModal({ mode: 'create', initial: { ...config.emptyForm } });
  const openEdit = (person) => {
    const currentDeptId =
      person.departmentRef?.id ||
      departments.find((d) => d.id === person.department || d.name === person.department)?._id ||
      departments.find((d) => d.id === person.department || d.name === person.department)?.id ||
      '';

    setModal({
      mode: 'edit',
      person,
      initial: {
        ...config.emptyForm,
        ...person,
        dob: person.dob || '',
        phone: person.phone || '',
        address: person.address || '',
        className: person.className || '',
        education: person.education || '',
        departmentId: currentDeptId,
        avatarPreview: person.avatar?.url || '',
      },
    });
  };

  const handleSubmit = async (form, setErrors) => {
    try {
      const avatarFile = form.avatarFile;
      const allowedFields = config.fields.map((field) => field.name);
      if (modal.mode === 'create') allowedFields.push('password');
      const payload = Object.fromEntries(
        allowedFields.filter((key) => Object.hasOwn(form, key)).map((key) => [key, form[key]])
      );
      let person;
      if (modal.mode === 'create') {
        person = await mutations.create.mutateAsync(payload);
      } else {
        const targetId =
          modal?.person?._id ||
          modal?.person?.id ||
          modal?.initial?._id ||
          modal?.initial?.id ||
          form?._id ||
          form?.id;

        // Clean up payload: exclude internal MongoDB fields and email/password
        const {
          _id,
          id: _idVal,
          userId: _userId,
          departmentRef: _deptRef,
          department: _dept,
          avatar: _avatar,
          createdAt: _createdAt,
          updatedAt: _updatedAt,
          __v,
          email: _email,
          password: _password,
          ...rest
        } = form;

        // Normalize string fields, converting null or undefined to empty string
        const cleaned = {};
        for (const [k, v] of Object.entries(rest)) {
          cleaned[k] = v === null || v === undefined ? '' : v;
        }

        person = await mutations.update.mutateAsync({ id: targetId, ...cleaned });
        toast.success('Đã cập nhật');
      }
      if (avatarFile) {
        try {
          await mutations.uploadAvatar.mutateAsync({ id: person._id, file: avatarFile });
        } catch (error) {
          setModal(null);
          toast.error(`Đã lưu hồ sơ nhưng tải ảnh thất bại: ${error.message}`, 5000);
          return;
        }
      }
      toast.success(modal.mode === 'create' ? 'Đã thêm thành công' : 'Đã cập nhật');
      setModal(null);
    } catch (error) {
      if (error.code === 'CONFLICT' || error.code === 'DUPLICATE_KEY') {
        setErrors({ email: error.message });
      } else if (error.details && Array.isArray(error.details)) {
        const fieldErrors = {};
        error.details.forEach((d) => {
          if (d.path) fieldErrors[d.path] = d.message;
        });
        setErrors(fieldErrors);
        toast.error(error.message || 'Dữ liệu không hợp lệ');
      } else {
        toast.error(error.message || 'Lỗi khi lưu dữ liệu');
      }
    }
  };

  const onDelete = async (person) => {
    const ok = await confirm({
      title: 'Xóa',
      message: `Xóa "${person.hoTen}"? Tài khoản đăng nhập cũng sẽ bị xóa.`,
      confirmText: 'Xóa',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await mutations.remove.mutateAsync(person._id);
      setSelectedIds((prev) => prev.filter((id) => id !== person._id));
      toast.success('Đã xóa');
    } catch (error) {
      toast.error(error.message);
    }
  };

  const onAvatar = async (person, file) => {
    if (!file) return;
    try {
      const targetId =
        (typeof person === 'string' ? person : null) ||
        person?._id ||
        person?.id ||
        modal?.person?._id ||
        modal?.person?.id ||
        modal?.initial?._id ||
        modal?.initial?.id;
      if (!targetId) {
        toast.error('Không tìm thấy mã định danh để cập nhật ảnh đại diện');
        return;
      }
      const res = await mutations.uploadAvatar.mutateAsync({ id: targetId, file });
      toast.success('Đã cập nhật ảnh đại diện');
      return res;
    } catch (error) {
      toast.error(error.message);
      throw error;
    }
  };

  const onImport = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const sheetRows = await readSheet(file);
      const result = await mutations.importRows.mutateAsync(sheetRows);
      const failed = result.failed?.length || 0;
      if (failed) {
        const details = result.failed.slice(0, 3).map((item) => `Dòng ${item.row}: ${item.message}`).join(' · ');
        toast.error(`Đã nhập ${result.created} bản ghi, ${failed} lỗi. ${details}`, 8000);
      } else {
        toast.success(`Đã nhập ${result.created} bản ghi`);
      }
    } catch (error) {
      toast.error(error.message || 'Không đọc được tệp Excel');
    }
  };

  const onExport = async () => {
    try {
      const all = await config.api.list({ page: 1, limit: 1000 });
      const exportRows = config.exportRows
        ? config.exportRows(all.data || [])
        : (all.data || []).map((p) => ({
          Ma: config.formatCode(p.id),
          HoTen: p.hoTen,
          Email: p.email,
          Khoa: p.department || '',
          SoDienThoai: p.phone || '',
        }));
      await exportSheet(exportRows, { fileName: config.exportName, sheetName: config.exportSheetName });
    } catch (error) {
      toast.error(error.message || 'Không xuất được Excel');
    }
  };

  const renderStatus = (person) => {
    const userObj = person.userId;
    const isLocked =
      (typeof userObj === 'object' && userObj?.status === 'Locked') ||
      person.accountStatus === 'Locked';
    const lockMsg = typeof userObj === 'object' && userObj?.lockReason ? userObj.lockReason : null;

    return isLocked && showAccountActions ? (
      <button
        type="button"
        className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full hover:bg-red-100 transition-colors"
        title={lockMsg ? `Lý do: ${lockMsg} (Bấm để mở khóa)` : 'Đã khóa (Bấm để mở khóa)'}
        onClick={() => doUnlock(person)}
      >
        <i className="fas fa-lock" /> Đã khóa
      </button>
    ) : isLocked ? (
      <span
        className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full"
        title={lockMsg ? `Lý do: ${lockMsg}` : 'Đã khóa'}
      >
        <i className="fas fa-lock" /> Đã khóa
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
        <i className="fas fa-circle-check" /> Hoạt động
      </span>
    );
  };

  const baseColumns = config.columns({
    formatCode: config.formatCode,
    renderAvatar: (person) => (
      <Avatar src={person.avatar?.url || person.avatar} name={person.hoTen} size={38} />
    ),
    renderStatus,
    actions: (person) => {
      const userObj = person.userId;
      const isLocked =
        (typeof userObj === 'object' && userObj?.status === 'Locked') ||
        person.accountStatus === 'Locked';
      const personId = person.userId?._id || person._id;

      return (
        <div className="flex justify-end items-center gap-1.5">
          {showAccountActions &&
            (isLocked ? (
              <button
                type="button"
                onClick={() => doUnlock(person)}
                className="w-8 h-8 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors flex items-center justify-center"
                title="Mở khóa tài khoản"
                aria-label="Mở khóa tài khoản"
              >
                <i className="fas fa-unlock" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setLockTarget(person);
                  setLockReason(LOCK_REASONS[0]);
                  setCustomReason('');
                }}
                className="w-8 h-8 rounded-lg text-amber-600 hover:bg-amber-50 transition-colors flex items-center justify-center"
                title="Khóa tài khoản"
                aria-label="Khóa tài khoản"
              >
                <i className="fas fa-lock" />
              </button>
            ))}
          {showAccountActions && (
            <button
              type="button"
              onClick={() => doReset(person)}
              disabled={resettingId === personId}
              className="w-8 h-8 rounded-lg text-indigo-600 hover:bg-indigo-50 transition-colors flex items-center justify-center disabled:opacity-50"
              title="Đặt lại mật khẩu"
              aria-label="Đặt lại mật khẩu"
            >
              <i className="fas fa-key" />
            </button>
          )}
          <button
            type="button"
            onClick={() => openEdit(person)}
            className="w-8 h-8 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors flex items-center justify-center"
            title="Sửa thông tin"
            aria-label="Sửa"
          >
            <i className="fas fa-pen" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(person)}
            className="w-8 h-8 rounded-lg text-red-600 hover:bg-red-50 transition-colors flex items-center justify-center"
            title="Xóa"
            aria-label="Xóa"
          >
            <i className="fas fa-trash-alt" />
          </button>
        </div>
      );
    },
  });

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
    render: (person, rowIndex) => (
      <div className="flex items-center justify-center select-none" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={selectedIds.includes(person._id)}
          onChange={() => {}}
          onClick={(e) => handleRowCheckboxClick(e, person, rowIndex)}
          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
          aria-label={`Chọn ${person.hoTen}`}
        />
      </div>
    ),
  };

  const columns = [selectionColumn, ...baseColumns];

  return (
    <div>
      <PageHeader
        title={config.title}
        subtitle={config.subtitle}
        actions={
          <>
            <SearchInput
              value={searchText}
              onChange={(v) => {
                setSearchText(v);
                setSelectedIds([]);
                setLastClickedIndex(null);
                setPage(1);
              }}
            />
            {config.enableClassFilter && (
              <select
                className="bg-white border border-slate-200 text-xs font-semibold px-3 py-2 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 shadow-2xs hover:border-slate-300 transition"
                value={selectedClass}
                onChange={(e) => {
                  setSelectedClass(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Tất cả lớp sinh hoạt</option>
                {(classesData || []).map((cls) => (
                  <option key={cls} value={cls}>
                    Lớp {cls}
                  </option>
                ))}
              </select>
            )}
            <button type="button" onClick={() => fileRef.current?.click()} className="px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 shadow-xs hover:shadow transition active:scale-[0.98]">
              <i className="fas fa-file-import mr-1.5" /> Nhập
            </button>
            <button type="button" onClick={onExport} className="px-3.5 py-2 rounded-xl bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700 shadow-xs hover:shadow transition active:scale-[0.98]">
              <i className="fas fa-file-export mr-1.5" /> Xuất
            </button>
            <button type="button" onClick={openCreate} className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 shadow-xs hover:shadow transition active:scale-[0.98] whitespace-nowrap">
              <i className="fas fa-plus mr-1.5" /> Thêm {config.entityLabel || ''}
            </button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={onImport} />
          </>
        }
      />

      {selectedIds.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/90 px-4 py-3 shadow-xs">
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-xs font-bold text-white shadow-xs">
              {selectedIds.length}
            </span>
            <span className="text-sm font-medium text-indigo-950">
              Đang chọn <strong className="text-indigo-700">{selectedIds.length}</strong> {config.entityLabel}
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
              onClick={handleBulkDelete}
              disabled={mutations.bulkRemove.isPending}
              className="flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-red-700 disabled:opacity-50 transition"
            >
              <i className="fas fa-trash-alt text-[11px]" />
              <span>{mutations.bulkRemove.isPending ? 'Đang xóa...' : `Xóa ${selectedIds.length} đã chọn`}</span>
            </button>
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={tableRows}
        isLoading={isLoading}
        emptyText="Chưa có dữ liệu"
        rowClassName={(person) => (selectedIds.includes(person._id) ? 'bg-indigo-50/40' : '')}
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

      {modal && (
        <PersonFormModal
          open
          mode={modal.mode}
          title={modal.mode === 'create' ? config.createTitle || `Thêm ${config.entityLabel}` : config.editTitle || `Sửa ${config.entityLabel}`}
          initial={modal.initial}
          fields={config.fields}
          departments={departments}
          profilePanel={config.profilePanel}
          formatCode={config.formatCode}
          entityLabel={config.entityLabel}
          profileCodeLabel={config.profileCodeLabel}
          profileDetailField={config.profileDetailField}
          profileDetailFallback={config.profileDetailFallback}
          onClose={() => setModal(null)}
          onSubmit={handleSubmit}
          saving={mutations.create.isPending || mutations.update.isPending || mutations.uploadAvatar.isPending}
          onAvatar={
            (modal.mode === 'edit' && (modal.person?._id || modal.person?.id || modal.initial?._id || modal.initial?.id))
              ? (file) => onAvatar(modal.person || modal.initial, file)
              : undefined
          }
        />
      )}

      {showAccountActions && <>
      {/* Modal khóa tài khoản */}
      <Modal open={Boolean(lockTarget)} onClose={() => setLockTarget(null)} title="Khóa tài khoản" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Khóa tài khoản của <span className="font-semibold text-gray-900">{lockTarget?.hoTen || lockTarget?.email}</span>. Người dùng sẽ bị đăng xuất ngay lập tức.
          </p>
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
              <input
                className={inputClass}
                placeholder="Nhập lý do cụ thể..."
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
              />
            </FormField>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setLockTarget(null)}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={doLock}
              disabled={locking}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
            >
              {locking ? 'Đang khóa...' : 'Xác nhận khóa'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal hiển thị mật khẩu tạm thời */}
      <Modal open={Boolean(tempPassword)} onClose={() => setTempPassword(null)} title="Mật khẩu tạm thời" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Đã đặt lại mật khẩu cho <span className="font-semibold text-gray-900">{tempPassword?.email}</span>. Hãy sao chép và gửi cho người dùng — mật khẩu này chỉ hiển thị một lần.
          </p>
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
            <code className="flex-1 font-mono text-indigo-700 font-bold text-lg">{tempPassword?.password}</code>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(tempPassword.password);
                toast.success('Đã sao chép vào bộ nhớ tạm');
              }}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 flex items-center gap-1.5"
            >
              <i className="fas fa-copy" /> Sao chép
            </button>
          </div>
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => setTempPassword(null)}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700"
            >
              Đóng
            </button>
          </div>
        </div>
      </Modal>
      </>}
    </div>
  );
}

export default PersonManager;
