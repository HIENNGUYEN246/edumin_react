import { useState, useMemo, useEffect, useCallback } from 'react';
import { PageHeader, SearchInput } from '../../../components/ui/PageHeader.jsx';
import { Spinner } from '../../../components/ui/Spinner.jsx';
import { Modal } from '../../../components/ui/Modal.jsx';
import { useToast } from '../../../app/providers/ToastProvider.jsx';
import { useConfirm } from '../../../app/providers/ConfirmProvider.jsx';
import { useDebounce } from '../../../lib/useDebounce.js';
import { formatStudentCode } from '../../../lib/format.js';
import { Avatar } from '../../../components/ui/Avatar.jsx';
import { attendanceApi } from '../../../api/attendanceApi.js';
import { classesApi } from '../../../api/classesApi.js';
import {
  formatAttendanceDate,
  getShiftLabel,
  getStatusBadgeClass,
  getStatusIcon,
  ATTENDANCE_STATUSES,
} from '../../../utils/attendanceUtils.js';

export function ManageAttendance() {
  const toast = useToast();
  const confirm = useConfirm();
  const [loading, setLoading] = useState(true);
  const [attendances, setAttendances] = useState([]);
  const [classes, setClasses] = useState([]);

  // Filters
  const [filterClass, setFilterClass] = useState('all');
  const [filterDate, setFilterDate] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchText, setSearchText] = useState('');
  const search = useDebounce(searchText);

  // Edit / Details Modal
  const [detailModal, setDetailModal] = useState({
    isOpen: false,
    record: null,
    status: 'Có mặt',
    score: '',
    evaluation: '',
    note: '',
  });
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [attList, classRes] = await Promise.all([
        attendanceApi.getAll(),
        classesApi.list({ limit: 100 }).catch(() => ({ data: [] })),
      ]);
      setAttendances(Array.isArray(attList) ? attList : attList?.data || []);
      setClasses(classRes?.data || []);
    } catch {
      toast.error('Không thể tải dữ liệu điểm danh');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtered rows
  const filteredList = useMemo(() => {
    return attendances.filter((item) => {
      if (filterClass !== 'all' && item.regId !== filterClass && item.courseId !== filterClass) {
        return false;
      }
      if (filterDate && item.date !== filterDate) {
        return false;
      }
      if (filterStatus !== 'all' && item.status !== filterStatus) {
        return false;
      }
      if (search) {
        const q = search.toLowerCase();
        const sName = (item.studentName || '').toLowerCase();
        const sCode = String(item.studentId || '').toLowerCase();
        const cName = (item.courseName || '').toLowerCase();
        const cCode = (item.courseId || item.regId || '').toLowerCase();
        if (!sName.includes(q) && !sCode.includes(q) && !cName.includes(q) && !cCode.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [attendances, filterClass, filterDate, filterStatus, search]);

  // Statistics
  const stats = useMemo(() => {
    const total = attendances.length;
    const present = attendances.filter((a) => a.status === 'Có mặt').length;
    const late = attendances.filter((a) => a.status === 'Đi muộn').length;
    const excused = attendances.filter((a) => a.status === 'Vắng có phép').length;
    const absent = attendances.filter((a) => a.status === 'Vắng mặt').length;
    const rate = total > 0 ? Math.round(((present + late * 0.5) / total) * 100) : 100;
    return { total, present, late, excused, absent, rate };
  }, [attendances]);

  const openEdit = (record) => {
    setDetailModal({
      isOpen: true,
      record,
      status: record.status || 'Có mặt',
      score: record.score != null ? String(record.score) : '',
      evaluation: record.evaluation || '',
      note: record.note || '',
    });
  };

  const handleSaveModal = async () => {
    if (!detailModal.record) return;
    try {
      setSaving(true);
      await attendanceApi.recordAndEvaluate({
        regId: detailModal.record.regId,
        studentId: detailModal.record.studentId,
        date: detailModal.record.date,
        shiftId: detailModal.record.shiftId,
        status: detailModal.status,
        score: detailModal.score !== '' ? Number(detailModal.score) : null,
        evaluation: detailModal.evaluation,
        note: detailModal.note,
        checkedBy: 'admin',
      });
      toast.success('Đã cập nhật bản ghi chuyên cần');
      setDetailModal({ isOpen: false, record: null, status: 'Có mặt', score: '', evaluation: '', note: '' });
      await loadData();
    } catch {
      toast.error('Lỗi khi lưu bản ghi');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (record) => {
    const ok = await confirm({
      title: 'Xóa bản ghi điểm danh',
      message: `Bạn có chắc muốn xóa điểm danh ngày ${formatAttendanceDate(record.date)} của sinh viên ${record.studentName}?`,
      confirmText: 'Xác nhận xóa',
      danger: true,
    });
    if (!ok) return;

    try {
      await attendanceApi.remove(record._id || record.id);
      toast.success('Đã xóa bản ghi điểm danh');
      await loadData();
    } catch {
      toast.error('Không thể xóa bản ghi');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quản lý Điểm danh & Chuyên cần"
        description="Theo dõi tình hình tham gia lớp học, điểm danh và đánh giá sinh viên trên toàn hệ thống"
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs">
          <p className="text-xs font-semibold text-gray-400 uppercase">Tổng lượt</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{stats.total}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs">
          <p className="text-xs font-semibold text-emerald-600 uppercase">Có mặt</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.present}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs">
          <p className="text-xs font-semibold text-amber-600 uppercase">Đi muộn</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{stats.late}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs">
          <p className="text-xs font-semibold text-blue-600 uppercase">Có phép</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{stats.excused}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs">
          <p className="text-xs font-semibold text-rose-600 uppercase">Vắng mặt</p>
          <p className="text-2xl font-bold text-rose-600 mt-1">{stats.absent}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs">
          <p className="text-xs font-semibold text-indigo-600 uppercase">Tỷ lệ chuyên cần</p>
          <p className="text-2xl font-bold text-indigo-600 mt-1">{stats.rate}%</p>
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={filterClass}
            onChange={(e) => setFilterClass(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
          >
            <option value="all">Tất cả lớp học phần</option>
            {classes.map((c) => (
              <option key={c._id} value={c.id}>
                {c.id} - {c.courseName}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
          />

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
          >
            <option value="all">Tất cả trạng thái</option>
            {ATTENDANCE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          {(filterClass !== 'all' || filterDate || filterStatus !== 'all' || searchText) && (
            <button
              type="button"
              onClick={() => {
                setFilterClass('all');
                setFilterDate('');
                setFilterStatus('all');
                setSearchText('');
              }}
              className="text-xs text-rose-600 font-semibold hover:underline"
            >
              Đặt lại bộ lọc
            </button>
          )}
        </div>

        <div className="w-full sm:w-64">
          <SearchInput
            value={searchText}
            onChange={setSearchText}
            placeholder="Tìm theo sinh viên, môn..."
          />
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12">
            <Spinner />
          </div>
        ) : filteredList.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <i className="far fa-clipboard text-4xl mb-3 block text-gray-300" />
            <p className="font-semibold text-gray-600 text-sm">Chưa có dữ liệu điểm danh nào</p>
            <p className="text-xs text-gray-400 mt-1">Các lượt điểm danh sẽ xuất hiện tại đây khi giáo viên hoặc sinh viên thực hiện ghi nhận.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-700">
              <thead className="bg-gray-50/75 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3">Sinh viên</th>
                  <th className="px-5 py-3">Lớp / Học phần</th>
                  <th className="px-5 py-3">Ngày & Ca</th>
                  <th className="px-5 py-3">Trạng thái</th>
                  <th className="px-5 py-3">Điểm & Đánh giá</th>
                  <th className="px-5 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredList.map((row) => (
                  <tr key={row._id || row.id} className="hover:bg-indigo-50/20 transition">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar
                          src={row.studentAvatar}
                          name={row.studentName || 'SV'}
                          size={38}
                        />
                        <div>
                          <p className="font-bold text-gray-900">{row.studentName || 'Sinh viên'}</p>
                          <p className="text-xs text-gray-400 font-mono">
                            {formatStudentCode(row.studentId)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-gray-800">{row.courseName || row.courseId}</p>
                      <p className="text-xs text-indigo-600 font-mono">{row.regId}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-gray-800">{formatAttendanceDate(row.date)}</p>
                      <p className="text-xs text-gray-400">
                        {row.shiftLabel || getShiftLabel(row.shiftId)}
                      </p>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${getStatusBadgeClass(row.status)}`}>
                        <i className={`fas ${getStatusIcon(row.status)}`} />
                        {row.status}
                      </span>
                      {row.checkInTime && (
                        <p className="text-[10px] text-gray-400 mt-1">Giờ vào: {row.checkInTime}</p>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {row.score != null ? (
                        <span className="inline-block bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded text-xs border border-emerald-200">
                          {row.score}đ
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs italic">Chưa chấm</span>
                      )}
                      {row.evaluation && (
                        <p className="text-xs text-gray-600 mt-1 italic line-clamp-1 max-w-xs">
                          "{row.evaluation}"
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(row)}
                          className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                          title="Chỉnh sửa bản ghi"
                        >
                          <i className="fas fa-pen text-xs" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(row)}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition"
                          title="Xóa bản ghi"
                        >
                          <i className="fas fa-trash text-xs" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit modal */}
      {detailModal.isOpen && (
        <Modal
          open
          onClose={() => setDetailModal({ isOpen: false, record: null, status: 'Có mặt', score: '', evaluation: '', note: '' })}
          title={`Chi tiết điểm danh - ${detailModal.record?.studentName || 'Sinh viên'}`}
        >
          <div className="space-y-4">
            {detailModal.record && (
              <div className="flex items-center gap-3 p-3 bg-indigo-50/60 rounded-2xl border border-indigo-100">
                <Avatar
                  src={detailModal.record.studentAvatar}
                  name={detailModal.record.studentName || 'SV'}
                  size={46}
                />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-gray-900 text-sm">{detailModal.record.studentName}</p>
                    <span className="text-[10px] font-mono font-bold bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">
                      {formatStudentCode(detailModal.record.studentId)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {detailModal.record.courseName || detailModal.record.courseId} • Lớp: <span className="font-mono text-indigo-600 font-semibold">{detailModal.record.regId}</span>
                  </p>
                </div>
              </div>
            )}
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                Trạng thái chuyên cần
              </label>
              <select
                value={detailModal.status}
                onChange={(e) => setDetailModal((p) => ({ ...p, status: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
              >
                {ATTENDANCE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                Điểm số tiết học (Thang điểm 10)
              </label>
              <input
                type="number"
                min="0"
                max="10"
                step="0.5"
                value={detailModal.score}
                onChange={(e) => setDetailModal((p) => ({ ...p, score: e.target.value }))}
                placeholder="VD: 9.5"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                Nhận xét đánh giá
              </label>
              <textarea
                rows={2}
                value={detailModal.evaluation}
                onChange={(e) => setDetailModal((p) => ({ ...p, evaluation: e.target.value }))}
                placeholder="VD: Hăng hái phát biểu, hoàn thành tốt bài lab"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                Ghi chú nội bộ
              </label>
              <input
                type="text"
                value={detailModal.note}
                onChange={(e) => setDetailModal((p) => ({ ...p, note: e.target.value }))}
                placeholder="Ghi chú thêm nếu có..."
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setDetailModal({ isOpen: false, record: null, status: 'Có mặt', score: '', evaluation: '', note: '' })}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl font-medium"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveModal}
                disabled={saving}
                className="px-5 py-2 text-sm bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition disabled:opacity-50"
              >
                {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default ManageAttendance;

