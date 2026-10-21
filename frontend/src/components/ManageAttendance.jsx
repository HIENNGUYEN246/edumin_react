import React, { useState, useEffect, useMemo, useCallback } from 'react';
import * as XLSX from 'xlsx';
import Swal from 'sweetalert2';
import PDLayout from '../layouts/PDLayout';
import registrationAPI from '../services/registrationAPI';
import attendanceAPI from '../services/attendanceAPI';
import studentAPI from '../services/studentAPI';
import teacherAPI from '../services/teacherAPI';
import {
  formatAttendanceDate,
  getShiftLabel,
  getStatusBadgeClass,
  getStatusIcon,
  ATTENDANCE_STATUSES,
} from '../utils/attendanceUtils';

export default function ManageAttendance() {
  const [loading, setLoading] = useState(true);
  const [attendances, setAttendances] = useState([]);
  const [openRegs, setOpenRegs] = useState([]);
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);

  // Filters
  const [filterCourse, setFilterCourse] = useState('all');
  const [filterDate, setFilterDate] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Detail / Edit Modal for Admin
  const [detailModal, setDetailModal] = useState({
    isOpen: false,
    record: null,
    status: 'Có mặt',
    score: '',
    evaluation: '',
    note: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [atts, regs, stds, tchs] = await Promise.all([
        attendanceAPI.getAllAttendances(),
        registrationAPI.getOpenRegistrations({ fresh: true }),
        studentAPI.getAllStudents({ fresh: true }),
        teacherAPI.getAllTeachers({ fresh: true }),
      ]);
      setAttendances(Array.isArray(atts) ? atts : []);
      setOpenRegs(Array.isArray(regs) ? regs : []);
      setStudents(Array.isArray(stds) ? stds : []);
      setTeachers(Array.isArray(tchs) ? tchs : []);
    } catch (err) {
      console.error('Lỗi khi tải dữ liệu điểm danh admin:', err);
      Swal.fire('Lỗi', 'Không thể tải dữ liệu điểm danh.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtered attendance records with enriched student avatar
  const filteredRecords = useMemo(() => {
    return attendances
      .filter((r) => {
        // Course filter
        if (filterCourse !== 'all') {
          if (String(r.regId) !== String(filterCourse) && String(r.courseId) !== String(filterCourse)) {
            return false;
          }
        }
        // Date filter
        if (filterDate && r.date !== filterDate) {
          return false;
        }
        // Status filter
        if (filterStatus !== 'all' && r.status !== filterStatus) {
          return false;
        }
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const sName = (r.studentName || '').toLowerCase();
          const sId = String(r.studentId || '');
          const cName = (r.courseName || '').toLowerCase();
          const cId = (r.courseId || '').toLowerCase();
          const tName = (r.teacherName || '').toLowerCase();
          const matches =
            sName.includes(q) ||
            sId.includes(q) ||
            cName.includes(q) ||
            cId.includes(q) ||
            tName.includes(q);
          if (!matches) return false;
        }
        return true;
      })
      .map((r) => {
        const sObj = students.find(
          (s) =>
            String(s.id) === String(r.studentId) ||
            (r.studentEmail && s.email && s.email.toLowerCase() === r.studentEmail.toLowerCase())
        );
        const resolvedAvatar =
          r.studentAvatar ||
          r.avatar ||
          sObj?.avatar ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(r.studentName || 'SV')}&background=6366f1&color=fff`;

        return {
          ...r,
          studentAvatar: resolvedAvatar,
          avatar: resolvedAvatar,
        };
      });
  }, [attendances, filterCourse, filterDate, filterStatus, searchQuery, students]);

  // Overall Statistics
  const stats = useMemo(() => {
    const total = attendances.length;
    const present = attendances.filter((r) => r.status === 'Có mặt').length;
    const late = attendances.filter((r) => r.status === 'Đi muộn').length;
    const absent = attendances.filter((r) => r.status === 'Vắng mặt').length;
    const excused = attendances.filter((r) => r.status === 'Vắng có phép').length;

    const evaluated = attendances.filter((r) => r.score !== null && r.score !== undefined);
    const avgScore =
      evaluated.length > 0
        ? (evaluated.reduce((s, r) => s + Number(r.score), 0) / evaluated.length).toFixed(1)
        : null;

    const rate = total > 0 ? Math.round(((present + late * 0.5) / total) * 100) : 100;

    return { total, present, late, absent, excused, avgScore, rate };
  }, [attendances]);

  // Export to Excel
  const handleExportExcel = () => {
    if (filteredRecords.length === 0) {
      Swal.fire('Chú ý', 'Không có dữ liệu điểm danh để xuất!', 'info');
      return;
    }

    const exportData = filteredRecords.map((r, index) => ({
      STT: index + 1,
      'Mã SV': `SV-${String(r.studentId).padStart(3, '0')}`,
      'Họ và tên': r.studentName || '',
      Email: r.studentEmail || '',
      'Mã HP': r.courseId || '',
      'Tên học phần': r.courseName || '',
      'Ngày học': formatAttendanceDate(r.date),
      'Ca học': r.shiftLabel || getShiftLabel(r.shiftId),
      'Trạng thái': r.status,
      'Giờ check-in': r.checkInTime || '',
      'Người ghi nhận': r.checkedBy === 'student' ? 'Sinh viên' : 'Giảng viên/Admin',
      'Điểm số': r.score !== null && r.score !== undefined ? r.score : '',
      'Nhận xét đánh giá': r.evaluation || '',
      'Giảng viên đánh giá': r.teacherName || '',
      'Thời gian đánh giá': r.evaluatedAt || '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'DiemDanh_DanhGia');
    XLSX.writeFile(workbook, `BaoCao_DiemDanh_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Download Biểu Mẫu template based on actual students & courses
  const handleDownloadTemplate = () => {
    try {
      const sample1 = students[0];
      const sample2 = students[1] || sample1;
      const sampleCourse = courses[0];

      const templateRows = [
        {
          STT: 1,
          'Mã SV': sample1?.id ? `SV-${String(sample1.id).padStart(3, '0')}` : 'SV-1001',
          'Họ và tên': sample1?.hoTen || 'Nguyễn Văn An',
          Email: sample1?.email || 'an.nguyen@student.edu.vn',
          'Mã HP': sampleCourse?.id || 'IT101',
          'Tên học phần': sampleCourse?.name || 'Lập trình căn bản',
          'Ngày học': new Date().toISOString().slice(0, 10),
          'Ca học': 'Ca 1 (Tiết 1-3)',
          'Trạng thái': 'Có mặt',
          'Điểm số': 10,
          'Nhận xét đánh giá': 'Tích cực tham gia phát biểu và làm bài tập',
        },
        {
          STT: 2,
          'Mã SV': sample2?.id ? `SV-${String(sample2.id).padStart(3, '0')}` : 'SV-1002',
          'Họ và tên': sample2?.hoTen || 'Trần Thị Mai',
          Email: sample2?.email || 'mai.tran@student.edu.vn',
          'Mã HP': sampleCourse?.id || 'IT101',
          'Tên học phần': sampleCourse?.name || 'Lập trình căn bản',
          'Ngày học': new Date().toISOString().slice(0, 10),
          'Ca học': 'Ca 1 (Tiết 1-3)',
          'Trạng thái': 'Đi muộn',
          'Điểm số': 7,
          'Nhận xét đánh giá': 'Vào lớp trễ 15 phút',
        },
      ];

      const guideRows = [
        { 'Trường dữ liệu': 'Mã SV', 'Quy tắc': 'Bắt buộc khớp với Mã SV trong hệ thống (SV-001, SV-1001...)' },
        { 'Trường dữ liệu': 'Mã HP', 'Quy tắc': 'Bắt buộc khớp với Mã học phần thực tế (IT101, CS102...)' },
        { 'Trường dữ liệu': 'Trạng thái', 'Quy tắc': 'Có mặt, Đi muộn, Vắng có phép hoặc Vắng không phép' },
        { 'Trường dữ liệu': 'Điểm số', 'Quy tắc': 'Thang điểm 0 - 10' },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(templateRows), 'BieuMau_DiemDanh');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(guideRows), 'HuongDan_QuyDinh');
      XLSX.writeFile(wb, 'bieu-mau-diem-danh-toan-truong.xlsx');
      Swal.fire('Thành công', 'Đã tải xuống biểu mẫu Excel điểm danh!', 'success');
    } catch {
      Swal.fire('Lỗi', 'Không tạo được file biểu mẫu Excel.', 'error');
    }
  };

  // Open detail / edit modal
  const openDetailModal = (record) => {
    setDetailModal({
      isOpen: true,
      record,
      status: record.status || 'Có mặt',
      score: record.score !== null && record.score !== undefined ? record.score : '',
      evaluation: record.evaluation || '',
      note: record.note || '',
    });
  };

  const closeDetailModal = () => {
    setDetailModal({ isOpen: false, record: null, status: 'Có mặt', score: '', evaluation: '', note: '' });
  };

  // Save update from Admin modal
  const handleSaveDetailModal = async () => {
    const { record, status, score, evaluation, note } = detailModal;
    if (!record) return;

    let numScore = null;
    if (score !== '' && score !== null && score !== undefined) {
      numScore = Number(score);
      if (Number.isNaN(numScore) || numScore < 0 || numScore > 10) {
        Swal.fire('Lỗi', 'Điểm đánh giá phải từ 0 đến 10!', 'warning');
        return;
      }
    }

    try {
      const payload = {
        regId: String(record.regId),
        courseId: record.courseId,
        courseName: record.courseName,
        studentId: Number(record.studentId),
        studentName: record.studentName,
        studentEmail: record.studentEmail,
        date: record.date,
        shiftId: record.shiftId,
        shiftLabel: record.shiftLabel,
        status,
        score: numScore,
        evaluation: evaluation.trim(),
        note: note.trim(),
        teacherId: record.teacherId,
        teacherName: record.teacherName,
        checkedBy: 'admin',
      };

      await attendanceAPI.recordAndEvaluate(payload);
      await loadData();
      closeDetailModal();
      Swal.fire('Thành công', 'Đã cập nhật tình trạng điểm danh & đánh giá!', 'success');
    } catch (err) {
      console.error(err);
      Swal.fire('Lỗi', 'Không thể cập nhật bản ghi điểm danh.', 'error');
    }
  };

  return (
    <PDLayout>
      <div className="p-4 md:p-8 max-w-7xl mx-auto font-poppins">
        {/* Title Header */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2.5">
              <i className="fas fa-clipboard-check text-indigo-600" />
              Tình trạng Điểm danh & Đánh giá sinh viên
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Theo dõi chi tiết tình trạng điểm danh hai phía (Sinh viên tự check-in & Giảng viên ghi nhận/đánh giá) trên toàn trường.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-sm font-semibold shadow-xs transition flex items-center gap-2 cursor-pointer"
              title="Tải biểu mẫu Excel điểm danh chuẩn hệ thống"
            >
              <i className="fas fa-file-excel text-emerald-600" />
              <span>Biểu mẫu</span>
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-sm transition flex items-center gap-2 cursor-pointer"
            >
              <i className="fas fa-file-excel" />
              <span>Xuất Excel</span>
            </button>
            <button
              type="button"
              onClick={loadData}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold transition flex items-center gap-2"
            >
              <i className="fas fa-sync-alt" />
              <span>Làm mới</span>
            </button>
          </div>
        </div>

        {/* Overview Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm text-center">
            <span className="text-xs font-bold text-gray-400 uppercase">Tổng lượt</span>
            <div className="text-2xl font-bold text-gray-800 mt-2">{stats.total}</div>
            <div className="text-[11px] text-gray-400 mt-1">Lượt ghi nhận</div>
          </div>

          <div className="bg-emerald-50/70 p-5 rounded-2xl border border-emerald-100 shadow-sm text-center">
            <span className="text-xs font-bold text-emerald-600 uppercase">Có mặt</span>
            <div className="text-2xl font-bold text-emerald-700 mt-2">{stats.present}</div>
            <div className="text-[11px] text-emerald-600 mt-1">{stats.rate}% chuyên cần</div>
          </div>

          <div className="bg-amber-50/70 p-5 rounded-2xl border border-amber-100 shadow-sm text-center">
            <span className="text-xs font-bold text-amber-600 uppercase">Đi muộn</span>
            <div className="text-2xl font-bold text-amber-700 mt-2">{stats.late}</div>
            <div className="text-[11px] text-amber-600 mt-1">Lượt đến trễ</div>
          </div>

          <div className="bg-rose-50/70 p-5 rounded-2xl border border-rose-100 shadow-sm text-center">
            <span className="text-xs font-bold text-rose-600 uppercase">Vắng mặt</span>
            <div className="text-2xl font-bold text-rose-700 mt-2">{stats.absent}</div>
            <div className="text-[11px] text-rose-600 mt-1">Không phép</div>
          </div>

          <div className="bg-blue-50/70 p-5 rounded-2xl border border-blue-100 shadow-sm text-center">
            <span className="text-xs font-bold text-blue-600 uppercase">Có phép</span>
            <div className="text-2xl font-bold text-blue-700 mt-2">{stats.excused}</div>
            <div className="text-[11px] text-blue-600 mt-1">Đã xin phép</div>
          </div>

          <div className="bg-purple-50/70 p-5 rounded-2xl border border-purple-100 shadow-sm text-center">
            <span className="text-xs font-bold text-purple-600 uppercase">Điểm TB</span>
            <div className="text-2xl font-bold text-purple-700 mt-2">
              {stats.avgScore !== null ? `${stats.avgScore}/10` : '-'}
            </div>
            <div className="text-[11px] text-purple-600 mt-1">Đánh giá chung</div>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Lớp học phần</label>
              <select
                value={filterCourse}
                onChange={(e) => setFilterCourse(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-800 outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">-- Tất cả học phần --</option>
                {openRegs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.courseId} - {c.courseName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Ngày học</label>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-800 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Trạng thái</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-800 outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">-- Tất cả trạng thái --</option>
                {ATTENDANCE_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Tìm kiếm</label>
              <div className="relative">
                <i className="fas fa-search absolute left-3 top-2.5 text-gray-400 text-xs" />
                <input
                  type="text"
                  placeholder="Tên SV, Mã SV, Tên HP, GV..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-800 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">
              Hiển thị <strong className="text-indigo-600">{filteredRecords.length}</strong> bản ghi điểm danh
            </span>
          </div>

          {loading ? (
            <div className="text-center py-20 text-gray-400">
              <i className="fas fa-spinner fa-spin text-3xl mb-2 text-indigo-500" />
              <p className="text-sm">Đang tải danh sách điểm danh...</p>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <i className="fas fa-clipboard-list text-5xl mb-3 text-gray-200" />
              <p className="text-base font-semibold text-gray-600">Không tìm thấy dữ liệu điểm danh</p>
              <p className="text-xs text-gray-400 mt-1">Hãy thử thay đổi điều kiện lọc ở trên.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-[11px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                    <th className="px-6 py-4 w-12 text-center">STT</th>
                    <th className="px-6 py-4">Sinh viên</th>
                    <th className="px-6 py-4">Học phần</th>
                    <th className="px-6 py-4">Buổi học</th>
                    <th className="px-6 py-4 text-center">Trạng thái</th>
                    <th className="px-6 py-4">Ghi nhận</th>
                    <th className="px-6 py-4 text-center">Điểm số</th>
                    <th className="px-6 py-4">Đánh giá của GV</th>
                    <th className="px-6 py-4 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-sm">
                  {filteredRecords.map((r, idx) => (
                    <tr key={r._id || r.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-6 py-4 text-center font-medium text-gray-400">{idx + 1}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={r.studentAvatar}
                            alt={r.studentName}
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(r.studentName || 'SV')}&background=6366f1&color=fff`;
                            }}
                            className="w-10 h-10 rounded-xl object-cover border border-gray-100 shadow-sm shrink-0"
                          />
                          <div>
                            <div className="font-semibold text-gray-800">{r.studentName || 'Sinh viên'}</div>
                            <div className="text-[11px] text-gray-400 font-mono">
                              MSV: SV-{String(r.studentId).padStart(3, '0')}
                              {r.studentEmail && ` • ${r.studentEmail}`}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-800">{r.courseName || 'Học phần'}</div>
                        <div className="text-[11px] text-gray-400 font-mono">{r.courseId}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-700">{formatAttendanceDate(r.date)}</div>
                        <div className="text-xs text-gray-500">{r.shiftLabel || getShiftLabel(r.shiftId)}</div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border ${getStatusBadgeClass(
                            r.status
                          )}`}
                        >
                          <i className={`fas ${getStatusIcon(r.status)} text-[10px]`} />
                          {r.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-600">
                        {r.checkInTime ? (
                          <div className="font-mono text-emerald-600 font-medium">
                            <i className="fas fa-check-circle mr-1" />
                            {r.checkInTime} (SV tự check)
                          </div>
                        ) : (
                          <span className="text-gray-400">GV ghi nhận</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {r.score !== null && r.score !== undefined ? (
                          <span className="px-2.5 py-1 bg-amber-50 text-amber-800 font-bold rounded-lg text-xs border border-amber-200">
                            {r.score}/10
                          </span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 max-w-xs">
                        {r.evaluation ? (
                          <div className="text-xs text-gray-700" title={r.evaluation}>
                            <div className="truncate font-medium">{r.evaluation}</div>
                            {r.teacherName && (
                              <div className="text-[10px] text-gray-400 mt-0.5">
                                GV: {r.teacherName} {r.evaluatedAt && `(${r.evaluatedAt})`}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-300 italic">Chưa đánh giá</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          type="button"
                          onClick={() => openDetailModal(r)}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                          title="Xem chi tiết & Điều chỉnh"
                        >
                          <i className="fas fa-eye" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Admin Detail & Adjustment Modal */}
        {detailModal.isOpen && detailModal.record && (
          <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <div className="bg-white rounded-3xl shadow-2xl border border-slate-100/80 w-full max-w-md my-auto overflow-hidden animate-fadeIn">
              <div className="bg-indigo-600 p-5 text-white flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-base">Chi tiết & Điều chỉnh điểm danh</h3>
                  <p className="text-xs text-indigo-200 mt-0.5">
                    {detailModal.record.courseName} - {formatAttendanceDate(detailModal.record.date)}
                  </p>
                </div>
                <button type="button" onClick={closeDetailModal} className="text-white/80 hover:text-white">
                  <i className="fas fa-times text-lg" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <img
                    src={
                      detailModal.record.studentAvatar ||
                      detailModal.record.avatar ||
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(detailModal.record.studentName || 'SV')}&background=6366f1&color=fff`
                    }
                    alt={detailModal.record.studentName}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(detailModal.record.studentName || 'SV')}&background=6366f1&color=fff`;
                    }}
                    className="w-12 h-12 rounded-xl object-cover border border-gray-200 shadow-sm shrink-0"
                  />
                  <div>
                    <div className="font-bold text-gray-800 text-sm">{detailModal.record.studentName}</div>
                    <div className="text-xs text-gray-500 font-mono mt-0.5">
                      MSV: SV-{String(detailModal.record.studentId).padStart(3, '0')}
                      {detailModal.record.studentEmail && ` • ${detailModal.record.studentEmail}`}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Trạng thái điểm danh</label>
                  <select
                    value={detailModal.status}
                    onChange={(e) => setDetailModal((p) => ({ ...p, status: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {ATTENDANCE_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Điểm đánh giá (0-10)</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.5"
                    value={detailModal.score}
                    onChange={(e) => setDetailModal((p) => ({ ...p, score: e.target.value }))}
                    placeholder="Chưa cho điểm"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Lời nhận xét / Đánh giá</label>
                  <textarea
                    rows="3"
                    value={detailModal.evaluation}
                    onChange={(e) => setDetailModal((p) => ({ ...p, evaluation: e.target.value }))}
                    placeholder="Nhận xét của giảng viên..."
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Ghi chú bổ sung</label>
                  <input
                    type="text"
                    value={detailModal.note}
                    onChange={(e) => setDetailModal((p) => ({ ...p, note: e.target.value }))}
                    placeholder="Ghi chú nội bộ..."
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeDetailModal}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-xl font-medium transition"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={handleSaveDetailModal}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md transition"
                >
                  Lưu thay đổi
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PDLayout>
  );
}
