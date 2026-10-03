import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Avatar } from '../../components/ui/Avatar.jsx';
import { useToast } from '../../app/providers/ToastProvider.jsx';
import { useConfirm } from '../../app/providers/ConfirmProvider.jsx';
import { useDebounce } from '../../lib/useDebounce.js';
import { tuitionApi } from '../../api/tuitionApi.js';
import { readSheet, exportSheet } from '../../lib/excel.js';
import { formatCurrency, formatDate, formatStudentCode } from '../../lib/format.js';

export function ManageTuition() {
  const toast = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);

  const [page, setPage] = useState(1);
  const [searchText, setSearchText] = useState('');
  const search = useDebounce(searchText);
  const [selectedSemester, setSelectedSemester] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);

  // Modals state
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkPaymentMethod, setBulkPaymentMethod] = useState('Chuyển khoản');
  const [bulkNote, setBulkNote] = useState('Duyệt theo sao kê ngân hàng');
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);

  const [payModal, setPayModal] = useState(null); // tuition object
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('Chuyển khoản');
  const [payNote, setPayNote] = useState('');
  const [isPaying, setIsPaying] = useState(false);

  const [historyModal, setHistoryModal] = useState(null); // tuition object

  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [generateSemester, setGenerateSemester] = useState('HK2-2025-2026');
  const [isGenerating, setIsGenerating] = useState(false);

  // Clear selections when filters change
  useEffect(() => {
    setSelectedIds([]);
  }, [page, search, selectedSemester, selectedClass, selectedStatus]);

  // Query filter options
  const { data: semestersData } = useQuery({
    queryKey: ['tuition', 'semesters'],
    queryFn: tuitionApi.semesters,
  });
  const semesters = semestersData?.data || [];

  const { data: classesData } = useQuery({
    queryKey: ['tuition', 'classes'],
    queryFn: tuitionApi.classes,
  });
  const classes = classesData?.data || [];

  // Query tuition list
  const { data: listData, isLoading, refetch } = useQuery({
    queryKey: ['tuition', 'list', { page, search, selectedSemester, selectedClass, selectedStatus }],
    queryFn: () =>
      tuitionApi.list({
        page,
        limit: 10,
        search: search || undefined,
        semester: selectedSemester || undefined,
        className: selectedClass || undefined,
        status: selectedStatus || undefined,
      }),
  });

  const tuitions = listData?.data || [];
  const meta = listData?.meta || { page: 1, pages: 1, total: 0 };

  // Select all / Select one
  const handleSelectKey = (key) => {
    setSelectedIds((prev) =>
      prev.includes(key) ? prev.filter((id) => id !== key) : [...prev, key]
    );
  };

  const handleSelectAll = (keysOnPage) => {
    const allSelected = keysOnPage.every((k) => selectedIds.includes(k));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((k) => !keysOnPage.includes(k)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...keysOnPage])));
    }
  };

  // Bulk Approve handler
  const handleConfirmBulkApprove = async () => {
    if (selectedIds.length === 0) return;
    try {
      setIsBulkSubmitting(true);
      const res = await tuitionApi.bulkStatus({
        ids: selectedIds,
        status: 'Đã đóng',
        paymentMethod: bulkPaymentMethod,
        note: bulkNote,
      });

      toast.success(res?.message || `Đã duyệt thành công ${selectedIds.length} mục sang trạng thái Đã đóng!`);
      setSelectedIds([]);
      setBulkModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['tuition'] });
    } catch (err) {
      toast.error(err?.message || 'Có lỗi xảy ra khi duyệt hàng loạt');
    } finally {
      setIsBulkSubmitting(false);
    }
  };

  // Bulk Reset to 'Chưa đóng'
  const handleBulkReset = async () => {
    if (selectedIds.length === 0) return;
    const ok = await confirm({
      title: 'Khôi phục trạng thái Chưa đóng',
      message: `Bạn có chắc muốn chuyển ${selectedIds.length} mục đã chọn về trạng thái "Chưa đóng"?`,
      confirmText: 'Chuyển trạng thái',
      tone: 'warning',
    });
    if (!ok) return;

    try {
      await tuitionApi.bulkStatus({
        ids: selectedIds,
        status: 'Chưa đóng',
        note: 'Điều chỉnh bởi kế toán',
      });
      toast.success(`Đã cập nhật ${selectedIds.length} mục về Chưa đóng`);
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ['tuition'] });
    } catch (err) {
      toast.error(err?.message || 'Lỗi khi cập nhật trạng thái');
    }
  };

  // Record Single Payment
  const openPayModal = (item) => {
    setPayModal(item);
    setPayAmount(item.amountDue > 0 ? String(item.amountDue) : String(item.amount));
    setPayMethod('Chuyển khoản');
    setPayNote('Thu học phí');
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!payModal) return;
    const numAmount = Number(payAmount);
    if (!numAmount || numAmount <= 0) {
      toast.error('Vui lòng nhập số tiền hợp lệ lớn hơn 0');
      return;
    }

    try {
      setIsPaying(true);
      await tuitionApi.recordPayment(payModal._id || payModal.id, {
        amount: numAmount,
        paymentMethod: payMethod,
        note: payNote,
      });

      toast.success(`Đã ghi nhận thanh toán ${formatCurrency(numAmount)} thành công!`);
      setPayModal(null);
      queryClient.invalidateQueries({ queryKey: ['tuition'] });
    } catch (err) {
      toast.error(err?.message || 'Lỗi khi ghi nhận nộp tiền');
    } finally {
      setIsPaying(false);
    }
  };

  // Generate Tuitions
  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!generateSemester.trim()) {
      toast.error('Vui lòng nhập tên học kỳ');
      return;
    }

    try {
      setIsGenerating(true);
      const res = await tuitionApi.generate(generateSemester.trim());
      toast.success(res?.message || `Đã sinh học phí cho học kỳ ${generateSemester}!`);
      setGenerateModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['tuition'] });
    } catch (err) {
      toast.error(err?.message || 'Lỗi khi sinh học phí');
    } finally {
      setIsGenerating(false);
    }
  };

  // Import Excel / File
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const rows = await readSheet(file);
      if (!rows || rows.length === 0) {
        toast.error('Tệp rỗng hoặc không có dữ liệu');
        return;
      }

      // Map rows
      const mapped = rows.map((r) => ({
        studentId: r['Mã SV'] || r['MSSV'] || r.studentId || r.MaSV,
        studentName: r['Họ tên'] || r.hoTen || r.studentName,
        className: r['Lớp'] || r['Lớp sinh hoạt'] || r.className,
        semester: r['Học kỳ'] || r.semester || 'HK1-2025-2026',
        amount: r['Học phí'] || r['Số tiền'] || r.amount,
        amountPaid: r['Đã nộp'] || r['Thanh toán'] || r.amountPaid,
        paymentMethod: r['Hình thức'] || r.paymentMethod || 'Chuyển khoản',
        note: r['Ghi chú'] || r.note || 'Import sao kê ngân hàng',
      }));

      const res = await tuitionApi.importRows(mapped);
      const failed = res.failed?.length || 0;
      toast.success(
        `Đã import thành công ${res.imported || 0} bản ghi${failed ? `, ${failed} lỗi` : ''}`,
        failed ? 5000 : 3000
      );

      queryClient.invalidateQueries({ queryKey: ['tuition'] });
    } catch (err) {
      toast.error(err?.message || 'Không thể đọc tệp sao kê / Excel');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Export to Excel
  const handleExport = async () => {
    try {
      const res = await tuitionApi.list({
        page: 1,
        limit: 1000,
        search: search || undefined,
        semester: selectedSemester || undefined,
        className: selectedClass || undefined,
        status: selectedStatus || undefined,
      });

      const exportRows = (res.data || []).map((t) => ({
        'Mã SV': t.student?.id != null ? formatStudentCode(t.student.id) : (t.studentId ? `SV-${t.studentId}` : ''),
        'Họ tên': t.student?.hoTen || '',
        'Lớp sinh hoạt': t.className || '',
        'Học kỳ': t.semester || '',
        'Học phí gốc': t.amount || 0,
        'Miễn giảm': t.discount || 0,
        'Đã thanh toán': t.amountPaid || 0,
        'Còn nợ': t.amountDue || 0,
        'Trạng thái': t.status || '',
        'Hạn nộp': t.dueDate ? formatDate(t.dueDate) : '',
      }));

      await exportSheet(exportRows, { fileName: `hoc-phi-${selectedSemester || 'tat-ca'}.xlsx` });
      toast.success('Đã xuất file Excel thành công');
    } catch (err) {
      toast.error(err?.message || 'Lỗi khi xuất Excel');
    }
  };

  const columns = [
    {
      key: 'student',
      header: 'Sinh viên',
      render: (t) => {
        const s = t.student;
        const code = s?.id != null ? formatStudentCode(s.id) : (t.studentId ? `SV-${t.studentId}` : '-');
        return (
          <div className="flex items-center gap-3">
            <Avatar src={s?.avatar?.url || s?.avatar} name={s?.hoTen || 'SV'} size={36} />
            <div>
              <div className="font-bold text-gray-900 leading-tight">{s?.hoTen || 'Sinh viên'}</div>
              <div className="text-[11px] font-mono text-gray-500 font-semibold">{code}</div>
            </div>
          </div>
        );
      },
    },
    {
      key: 'className',
      header: 'Lớp SH',
      render: (t) => (
        t.className ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            {t.className}
          </span>
        ) : (
          <span className="text-gray-400 text-xs italic">Chưa phân lớp</span>
        )
      ),
    },
    {
      key: 'semester',
      header: 'Học kỳ',
      render: (t) => <span className="font-semibold text-gray-700 text-xs">{t.semester}</span>,
    },
    {
      key: 'amount',
      header: 'Tổng học phí',
      render: (t) => (
        <div>
          <span className="font-semibold text-gray-900 text-xs">{formatCurrency(t.amount)}</span>
          {t.discount > 0 && (
            <div className="text-[10px] text-emerald-600 font-medium">Giảm: {formatCurrency(t.discount)}</div>
          )}
        </div>
      ),
    },
    {
      key: 'amountPaid',
      header: 'Đã đóng',
      render: (t) => (
        <span className="font-bold text-emerald-600 text-xs">{formatCurrency(t.amountPaid || 0)}</span>
      ),
    },
    {
      key: 'amountDue',
      header: 'Còn nợ',
      render: (t) => (
        <span className={`font-bold text-xs ${t.amountDue > 0 ? 'text-rose-600' : 'text-gray-400'}`}>
          {formatCurrency(t.amountDue || 0)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      className: 'text-center',
      render: (t) => (
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
            t.status === 'Đã đóng'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : t.status === 'Đang nợ'
              ? 'bg-amber-50 text-amber-700 border border-amber-200'
              : 'bg-rose-50 text-rose-700 border border-rose-200'
          }`}
        >
          <i
            className={`fas text-[9px] ${
              t.status === 'Đã đóng' ? 'fa-check' : t.status === 'Đang nợ' ? 'fa-clock' : 'fa-times'
            }`}
          />
          {t.status}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Thao tác',
      className: 'text-right',
      render: (t) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={() => openPayModal(t)}
            title="Thu học phí"
            className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-semibold transition flex items-center gap-1 border border-emerald-200"
          >
            <i className="fas fa-hand-holding-dollar text-xs" />
            <span>Thu tiền</span>
          </button>

          <button
            type="button"
            onClick={() => setHistoryModal(t)}
            title="Lịch sử nộp tiền"
            className="w-8 h-8 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 flex items-center justify-center text-xs transition border border-gray-200"
          >
            <i className="fas fa-history" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quản lý Học phí & Thu chi"
        subtitle="Tra cứu công nợ sinh viên, ghi nhận phiếu thu, duyệt thanh toán hàng loạt và import sao kê ngân hàng"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition"
              title="Nhập dữ liệu thu học phí hoặc sao kê ngân hàng từ file Excel"
            >
              <i className="fas fa-file-import text-emerald-600" />
              <span>Import Excel / Sao kê</span>
            </button>

            <button
              type="button"
              onClick={handleExport}
              className="px-3.5 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition"
              title="Xuất danh sách học phí ra file Excel"
            >
              <i className="fas fa-file-excel text-emerald-600" />
              <span>Xuất Excel</span>
            </button>

            <button
              type="button"
              onClick={() => setGenerateModalOpen(true)}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition"
              title="Khởi tạo danh sách học phí cho toàn bộ sinh viên trong kỳ mới"
            >
              <i className="fas fa-plus-circle" />
              <span>Sinh học phí kỳ mới</span>
            </button>
          </div>
        }
      />

      {/* Filters & Search Toolbar */}
      <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-xs flex flex-wrap items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px]">
          <i className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
          <input
            type="text"
            value={searchText}
            onChange={(e) => {
              setSearchText(e.target.value);
              setPage(1);
            }}
            placeholder="Tìm theo tên sinh viên hoặc mã SV..."
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
          />
        </div>

        {/* Dropdown filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Semester */}
          <select
            value={selectedSemester}
            onChange={(e) => {
              setSelectedSemester(e.target.value);
              setPage(1);
            }}
            className="border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            <option value="">-- Tất cả học kỳ --</option>
            {semesters.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {/* Class Filter */}
          <select
            value={selectedClass}
            onChange={(e) => {
              setSelectedClass(e.target.value);
              setPage(1);
            }}
            className="border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            <option value="">-- Tất cả lớp sinh hoạt --</option>
            {classes.map((c) => (
              <option key={c} value={c}>Lớp: {c}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setPage(1);
            }}
            className="border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            <option value="">-- Tất cả trạng thái --</option>
            <option value="Đã đóng">Đã đóng</option>
            <option value="Đang nợ">Đang nợ</option>
            <option value="Chưa đóng">Chưa đóng</option>
          </select>

          <button
            type="button"
            onClick={() => refetch()}
            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold transition"
            title="Tải lại danh sách"
          >
            <i className="fas fa-sync-alt" />
          </button>
        </div>
      </div>

      {/* Main Table with Selectable & Bulk Actions */}
      <DataTable
        columns={columns}
        rows={tuitions}
        rowKey={(t) => t._id || t.id}
        isLoading={isLoading}
        emptyText="Không tìm thấy bản ghi học phí nào phù hợp điều kiện lọc."
        selectable
        selectedKeys={selectedIds}
        onSelectKey={handleSelectKey}
        onSelectAll={handleSelectAll}
        bulkActions={
          <>
            <button
              type="button"
              onClick={() => setBulkModalOpen(true)}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5"
            >
              <i className="fas fa-check-double text-xs" />
              <span>Duyệt Đã đóng ({selectedIds.length})</span>
            </button>

            <button
              type="button"
              onClick={handleBulkReset}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5"
            >
              <i className="fas fa-undo text-xs" />
              <span>Đặt lại Chưa đóng</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-gray-100 text-gray-600 text-xs font-semibold transition border border-gray-200"
            >
              Bỏ chọn
            </button>
          </>
        }
      />

      {/* Pagination */}
      <Pagination
        page={page}
        pages={meta.pages}
        total={meta.total}
        onPageChange={(p) => setPage(p)}
      />

      {/* Modal: Bulk Approval Confirmation */}
      <Modal
        open={bulkModalOpen}
        onClose={() => !isBulkSubmitting && setBulkModalOpen(false)}
        title="Xác nhận duyệt học phí hàng loạt"
        size="md"
      >
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 mt-0.5">
              <i className="fas fa-question text-sm" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-indigo-900">
                Bạn có chắc chắn muốn duyệt {selectedIds.length} mục này sang trạng thái "Đã đóng"?
              </h4>
              <p className="text-xs text-indigo-700/80 mt-1 leading-relaxed">
                Hệ thống sẽ cập nhật trạng thái học phí của các sinh viên được chọn thành đã hoàn thành đủ học phí và tạo biên lai nộp tiền tương ứng.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
              Hình thức thanh toán áp dụng
            </label>
            <select
              value={bulkPaymentMethod}
              onChange={(e) => setBulkPaymentMethod(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="Chuyển khoản">Chuyển khoản ngân hàng</option>
              <option value="Sao kê ngân hàng">Sao kê tài vụ / ngân hàng</option>
              <option value="Tiền mặt">Tiền mặt tại phòng tài vụ</option>
              <option value="Khác">Hình thức khác</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
              Ghi chú duyệt hàng loạt
            </label>
            <input
              type="text"
              value={bulkNote}
              onChange={(e) => setBulkNote(e.target.value)}
              placeholder="Ví dụ: Duyệt theo sao kê ngân hàng BIDV ngày..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              disabled={isBulkSubmitting}
              onClick={() => setBulkModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              disabled={isBulkSubmitting}
              onClick={handleConfirmBulkApprove}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5"
            >
              {isBulkSubmitting ? (
                <>
                  <i className="fas fa-spinner fa-spin text-xs" />
                  <span>Đang xử lý...</span>
                </>
              ) : (
                <>
                  <i className="fas fa-check text-xs" />
                  <span>Xác nhận duyệt ({selectedIds.length})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Single Payment Recording */}
      <Modal
        open={Boolean(payModal)}
        onClose={() => !isPaying && setPayModal(null)}
        title="Lập phiếu thu học phí"
        size="md"
      >
        {payModal && (
          <form onSubmit={handleRecordPayment} className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Sinh viên:</span>
                <span className="font-bold text-gray-900">{payModal.student?.hoTen}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Học kỳ:</span>
                <span className="font-semibold text-gray-800">{payModal.semester}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Lớp sinh hoạt:</span>
                <span className="font-semibold text-blue-700">{payModal.className || 'Chưa phân lớp'}</span>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-2">
                <span className="text-gray-500">Tổng học phí:</span>
                <span className="font-bold text-gray-800">{formatCurrency(payModal.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Đã nộp trước đó:</span>
                <span className="font-bold text-indigo-600">{formatCurrency(payModal.amountPaid || 0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="font-bold text-rose-700">Còn nợ:</span>
                <span className="font-black text-rose-700">{formatCurrency(payModal.amountDue || 0)}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                Số tiền thực thu lần này (VNĐ) *
              </label>
              <input
                type="number"
                min="1000"
                step="1000"
                required
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                placeholder="Nhập số tiền..."
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-emerald-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                Hình thức nộp tiền
              </label>
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <option value="Chuyển khoản">Chuyển khoản ngân hàng</option>
                <option value="Tiền mặt">Tiền mặt tại quầy kế toán</option>
                <option value="Khác">Hình thức khác</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                Ghi chú / Mã biên lai
              </label>
              <input
                type="text"
                value={payNote}
                onChange={(e) => setPayNote(e.target.value)}
                placeholder="Ví dụ: Mã giao dịch BIDV FT1234567..."
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
              <button
                type="button"
                disabled={isPaying}
                onClick={() => setPayModal(null)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition"
              >
                Đóng
              </button>
              <button
                type="submit"
                disabled={isPaying}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5"
              >
                {isPaying ? 'Đang lưu...' : 'Xác nhận thu tiền'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal: View Transaction History */}
      <Modal
        open={Boolean(historyModal)}
        onClose={() => setHistoryModal(null)}
        title="Lịch sử nộp học phí"
        size="lg"
      >
        {historyModal && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 text-xs">
              <div>
                <span className="text-gray-400">Sinh viên: </span>
                <strong className="text-gray-800">{historyModal.student?.hoTen}</strong>
                <span className="text-gray-400 ml-2">({historyModal.className || 'Chưa phân lớp'})</span>
              </div>
              <div>
                <span className="text-gray-400">Học kỳ: </span>
                <strong className="text-indigo-600">{historyModal.semester}</strong>
              </div>
            </div>

            {!historyModal.transactions || historyModal.transactions.length === 0 ? (
              <p className="text-xs text-gray-400 italic text-center py-6">
                Chưa có phiếu thu hoặc giao dịch nào được ghi nhận cho bản ghi này.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="text-gray-400 border-b border-gray-200">
                      <th className="py-2.5 font-semibold">Mã giao dịch</th>
                      <th className="py-2.5 font-semibold">Ngày nộp</th>
                      <th className="py-2.5 font-semibold">Số tiền</th>
                      <th className="py-2.5 font-semibold">Hình thức</th>
                      <th className="py-2.5 font-semibold">Người thu / Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {historyModal.transactions.map((tx, idx) => (
                      <tr key={tx._id || idx} className="text-gray-700">
                        <td className="py-2.5 font-mono text-gray-500 font-medium">
                          {tx.transactionCode || `TX-${String(idx + 1).padStart(4, '0')}`}
                        </td>
                        <td className="py-2.5">{formatDate(tx.paidAt)}</td>
                        <td className="py-2.5 font-bold text-emerald-600">{formatCurrency(tx.amount)}</td>
                        <td className="py-2.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-800">
                            {tx.paymentMethod || 'Chuyển khoản'}
                          </span>
                        </td>
                        <td className="py-2.5 text-gray-500 italic">{tx.note || 'Thu trực tiếp'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setHistoryModal(null)}
                className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-semibold text-gray-700 transition"
              >
                Đóng
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: Generate Tuitions for a new semester */}
      <Modal
        open={generateModalOpen}
        onClose={() => !isGenerating && setGenerateModalOpen(false)}
        title="Sinh học phí học kỳ mới"
        size="md"
      >
        <form onSubmit={handleGenerate} className="space-y-4">
          <p className="text-xs text-gray-600 leading-relaxed">
            Hệ thống sẽ tự động quét danh sách sinh viên đang hoạt động và tạo các bản ghi học phí dự thu cho học kỳ được chỉ định. Nếu sinh viên đã có bản ghi học kỳ đó, hệ thống sẽ bỏ qua không ghi đè.
          </p>

          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
              Tên học kỳ áp dụng *
            </label>
            <input
              type="text"
              required
              value={generateSemester}
              onChange={(e) => setGenerateSemester(e.target.value)}
              placeholder="Ví dụ: HK2-2025-2026"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              disabled={isGenerating}
              onClick={() => setGenerateModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isGenerating}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5"
            >
              {isGenerating ? (
                <>
                  <i className="fas fa-spinner fa-spin text-xs" />
                  <span>Đang khởi tạo...</span>
                </>
              ) : (
                <>
                  <i className="fas fa-play text-xs" />
                  <span>Bắt đầu sinh học phí</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default ManageTuition;
