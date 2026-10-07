import { useState, useMemo, useEffect, useCallback } from 'react';
import { PageHeader, SearchInput } from '../../../components/ui/PageHeader.jsx';
import { Spinner } from '../../../components/ui/Spinner.jsx';
import { Modal } from '../../../components/ui/Modal.jsx';
import { Avatar } from '../../../components/ui/Avatar.jsx';
import { ScheduleRoomBadge } from '../../../components/schedule/ScheduleBadge.jsx';
import { useToast } from '../../../app/providers/ToastProvider.jsx';
import { useConfirm } from '../../../app/providers/ConfirmProvider.jsx';
import { useDebounce } from '../../../lib/useDebounce.js';
import { formatStudentCode } from '../../../lib/format.js';
import { attendanceApi } from '../../../api/attendanceApi.js';
import { classesApi } from '../../../api/classesApi.js';
import {
  getTodayDateString,
  formatAttendanceDate,
  getShiftLabel,
  getStatusBadgeClass,
  getStatusIcon,
  ATTENDANCE_STATUSES,
  SHIFT_OPTIONS,
} from '../../../utils/attendanceUtils.js';

export function ClassAttendanceDetail({ classItem, onBack }) {
  const toast = useToast();
  const confirm = useConfirm();

  // Active view tab: 'sessions' (theo buổi học) | 'students' (tổng hợp sinh viên)
  const [activeTab, setActiveTab] = useState('sessions');

  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);

  // Session filter state
  const [selectedDate, setSelectedDate] = useState(getTodayDateString());
  const [selectedShift, setSelectedShift] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [searchStudent, setSearchStudent] = useState('');
  const debouncedSearch = useDebounce(searchStudent);

  // Edit / Record Modal
  const [editModal, setEditModal] = useState({
    isOpen: false,
    record: null,
    student: null,
    date: getTodayDateString(),
    shiftId: '1',
    status: 'Có mặt',
    score: '',
    evaluation: '',
    note: '',
  });
  const [savingRecord, setSavingRecord] = useState(false);

  // Student History Modal
  const [historyModal, setHistoryModal] = useState({
    isOpen: false,
    student: null,
  });

  // Bulk marking
  const [bulkMarking, setBulkMarking] = useState(false);

  // Fetch students and attendance for this class
  const loadClassData = useCallback(async () => {
    if (!classItem) return;
    try {
      setLoading(true);
      const [studentsRes, attendanceRes] = await Promise.all([
        classesApi.students(classItem.id).catch(() => ({ students: [] })),
        attendanceApi.getAll({ regId: classItem.id }).catch(() => []),
      ]);

      setStudents(studentsRes?.students || []);
      setAttendanceRecords(Array.isArray(attendanceRes) ? attendanceRes : attendanceRes?.data || []);
    } catch {
      toast.error('Không thể tải dữ liệu điểm danh của lớp');
    } finally {
      setLoading(false);
    }
  }, [classItem, toast]);

  useEffect(() => {
    loadClassData();
  }, [loadClassData]);

  // Overall class statistics
  const classStats = useMemo(() => {
    const totalRecords = attendanceRecords.length;
    const present = attendanceRecords.filter((a) => a.status === 'Có mặt').length;
    const late = attendanceRecords.filter((a) => a.status === 'Đi muộn').length;
    const excused = attendanceRecords.filter((a) => a.status === 'Vắng có phép').length;
    const absent = attendanceRecords.filter((a) => a.status === 'Vắng mặt').length;
    const rate = totalRecords > 0 ? Math.round(((present + late * 0.5) / totalRecords) * 100) : 100;
    return { totalRecords, present, late, excused, absent, rate };
  }, [attendanceRecords]);

  // Map of studentId -> attendance history in this class
  const studentAttendanceMap = useMemo(() => {
    const map = new Map();
    students.forEach((s) => {
      map.set(s.id, []);
    });

    attendanceRecords.forEach((att) => {
      if (map.has(att.studentId)) {
        map.get(att.studentId).push(att);
      } else {
        map.set(att.studentId, [att]);
      }
    });

    return map;
  }, [students, attendanceRecords]);

  // Summary per student for 'students' tab
  const studentSummaries = useMemo(() => {
    return students.map((s) => {
      const history = studentAttendanceMap.get(s.id) || [];
      const total = history.length;
      const present = history.filter((a) => a.status === 'Có mặt').length;
      const late = history.filter((a) => a.status === 'Đi muộn').length;
      const excused = history.filter((a) => a.status === 'Vắng có phép').length;
      const absent = history.filter((a) => a.status === 'Vắng mặt').length;
      const rate = total > 0 ? Math.round(((present + late * 0.5) / total) * 100) : 100;
      const isAtRisk = total > 0 && ((absent + excused) / total >= 0.2 || absent >= 3);

      return {
        ...s,
        total,
        present,
        late,
        excused,
        absent,
        rate,
        isAtRisk,
        history,
      };
    });
  }, [students, studentAttendanceMap]);

  // Filtered student summaries in 'students' tab
  const filteredStudentSummaries = useMemo(() => {
    if (!debouncedSearch) return studentSummaries;
    const q = debouncedSearch.toLowerCase();
    return studentSummaries.filter((s) => {
      const name = (s.hoTen || '').toLowerCase();
      const code = String(s.id || '').toLowerCase();
      const className = (s.className || '').toLowerCase();
      return name.includes(q) || code.includes(q) || className.includes(q);
    });
  }, [studentSummaries, debouncedSearch]);

  // Filtered session records in 'sessions' tab
  const filteredSessionRows = useMemo(() => {
    const recordsOnDate = attendanceRecords.filter((r) => {
      if (selectedDate && r.date !== selectedDate) return false;
      if (selectedShift !== 'all' && String(r.shiftId) !== String(selectedShift)) return false;
      return true;
    });

    const onDateMap = new Map();
    recordsOnDate.forEach((r) => {
      onDateMap.set(r.studentId, r);
    });

    let rows = students.map((s) => {
      const existing = onDateMap.get(s.id);
      return {
        student: s,
        record: existing || null,
        status: existing ? existing.status : 'Chưa điểm danh',
        score: existing?.score,
        evaluation: existing?.evaluation,
        checkInTime: existing?.checkInTime,
        shiftId: existing?.shiftId || (selectedShift !== 'all' ? selectedShift : '1'),
        date: existing?.date || selectedDate,
      };
    });

    if (selectedStatus !== 'all') {
      rows = rows.filter((r) => r.status === selectedStatus);
    }

    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      rows = rows.filter((r) => {
        const name = (r.student.hoTen || '').toLowerCase();
        const code = String(r.student.id || '').toLowerCase();
        const className = (r.student.className || '').toLowerCase();
        return name.includes(q) || code.includes(q) || className.includes(q);
      });
    }

    return rows;
  }, [students, attendanceRecords, selectedDate, selectedShift, selectedStatus, debouncedSearch]);

  // Open Edit Modal for a student/record
  const handleOpenEdit = (item) => {
    const existing = item.record;
    setEditModal({
      isOpen: true,
      record: existing,
      student: item.student,
      date: existing?.date || selectedDate || getTodayDateString(),
      shiftId: existing?.shiftId || (selectedShift !== 'all' ? selectedShift : '1'),
      status: existing?.status || 'Có mặt',
      score: existing?.score != null ? String(existing?.score) : '',
      evaluation: existing?.evaluation || '',
      note: existing?.note || '',
    });
  };

  // Save record from Modal
  const handleSaveEdit = async () => {
    if (!editModal.student) return;
    try {
      setSavingRecord(true);
      await attendanceApi.recordAndEvaluate({
        regId: classItem.id,
        courseId: classItem.courseId,
        studentId: editModal.student.id,
        date: editModal.date,
        shiftId: editModal.shiftId,
        status: editModal.status,
        score: editModal.score !== '' ? Number(editModal.score) : null,
        evaluation: editModal.evaluation,
        note: editModal.note,
        checkedBy: 'admin',
      });

      toast.success(`Đã cập nhật chuyên cần cho sinh viên ${editModal.student.hoTen}`);
      setEditModal((prev) => ({ ...prev, isOpen: false }));
      await loadClassData();
    } catch {
      toast.error('Lỗi khi lưu thông tin điểm danh');
    } finally {
      setSavingRecord(false);
    }
  };

  // Delete attendance record
  const handleDeleteRecord = async (record, studentName) => {
    if (!record?._id && !record?.id) return;
    const ok = await confirm({
      title: 'Xóa bản ghi điểm danh',
      message: `Bạn có chắc muốn xóa bản ghi điểm danh ngày ${formatAttendanceDate(record.date)} của sinh viên ${studentName}?`,
      confirmText: 'Xác nhận xóa',
      danger: true,
    });
    if (!ok) return;

    try {
      await attendanceApi.remove(record._id || record.id);
      toast.success('Đã xóa bản ghi điểm danh');
      await loadClassData();
    } catch {
      toast.error('Không thể xóa bản ghi');
    }
  };

  // Mark all unrecorded students as present for current date & shift
  const handleMarkAllPresent = async () => {
    const unrecorded = filteredSessionRows.filter((r) => !r.record);
    if (unrecorded.length === 0) {
      toast.info('Tất cả sinh viên trong buổi này đã được ghi nhận điểm danh.');
      return;
    }

    const shift = selectedShift !== 'all' ? selectedShift : '1';
    const ok = await confirm({
      title: 'Đánh dấu có mặt hàng loạt',
      message: `Đánh dấu "Có mặt" cho ${unrecorded.length} sinh viên chưa điểm danh trong ngày ${formatAttendanceDate(selectedDate)} (Ca ${shift})?`,
      confirmText: 'Xác nhận điểm danh',
    });
    if (!ok) return;

    try {
      setBulkMarking(true);
      const promises = unrecorded.map((r) =>
        attendanceApi.recordAndEvaluate({
          regId: classItem.id,
          courseId: classItem.courseId,
          studentId: r.student.id,
          date: selectedDate,
          shiftId: shift,
          status: 'Có mặt',
          checkedBy: 'admin',
        })
      );
      await Promise.all(promises);
      toast.success(`Đã ghi nhận có mặt cho ${unrecorded.length} sinh viên`);
      await loadClassData();
    } catch {
      toast.error('Có lỗi xảy ra khi ghi nhận hàng loạt');
    } finally {
      setBulkMarking(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Header Card: Cân đối, không thừa khoảng trắng */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-gray-700 bg-gray-100 hover:bg-indigo-50 hover:text-indigo-700 border border-gray-200 transition"
              title="Quay lại danh sách lớp học phần"
            >
              <i className="fas fa-arrow-left text-xs" />
              <span>Quay lại</span>
            </button>
            <div className="h-6 w-px bg-gray-200 hidden sm:block" />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                  {classItem.id}
                </span>
                <h1 className="text-lg sm:text-xl font-bold text-gray-900 leading-tight">
                  {classItem.courseName}
                </h1>
              </div>
              <div className="text-xs text-gray-500 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>Khoa: <strong className="text-gray-700 font-semibold">{classItem.department || 'Chung'}</strong></span>
                <span>•</span>
                <span>GV: <strong className="text-gray-700 font-semibold">{classItem.teacher || 'Chưa phân công'}</strong></span>
                <span>•</span>
                <span>Sĩ số: <strong className="text-indigo-600 font-semibold">{students.length} SV</strong></span>
                {classItem.room && (
                  <>
                    <span>•</span>
                    <span>Phòng: <strong className="text-gray-700 font-semibold">{classItem.room}</strong></span>
                  </>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={loadClassData}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 transition"
            title="Tải lại dữ liệu điểm danh"
          >
            <i className={`fas fa-rotate-right ${loading ? 'fa-spin text-indigo-600' : ''}`} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* Class Overview Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Sĩ số lớp</p>
          <p className="text-xl font-black text-slate-800 mt-1">{students.length} <span className="text-xs font-normal text-slate-400">SV</span></p>
        </div>
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <p className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wider">Tỷ lệ chuyên cần</p>
          <p className="text-xl font-black text-indigo-600 mt-1">{classStats.rate}%</p>
        </div>
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <p className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">Có mặt</p>
          <p className="text-xl font-black text-emerald-600 mt-1">{classStats.present}</p>
        </div>
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <p className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider">Đi muộn</p>
          <p className="text-xl font-black text-amber-600 mt-1">{classStats.late}</p>
        </div>
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <p className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider">Có phép</p>
          <p className="text-xl font-black text-blue-600 mt-1">{classStats.excused}</p>
        </div>
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <p className="text-[11px] font-semibold text-rose-600 uppercase tracking-wider">Vắng mặt</p>
          <p className="text-xl font-black text-rose-600 mt-1">{classStats.absent}</p>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="flex border-b border-gray-200 gap-8">
        <button
          type="button"
          onClick={() => setActiveTab('sessions')}
          className={`pb-3 font-semibold text-sm transition relative ${
            activeTab === 'sessions'
              ? 'text-indigo-600'
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <i className="fas fa-calendar-check mr-2 text-xs" />
          Điểm danh theo buổi học
          {activeTab === 'sessions' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('students')}
          className={`pb-3 font-semibold text-sm transition relative ${
            activeTab === 'students'
              ? 'text-indigo-600'
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <i className="fas fa-users-viewfinder mr-2 text-xs" />
          Tổng hợp chuyên cần theo sinh viên ({students.length})
          {activeTab === 'students' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full" />
          )}
        </button>
      </div>

      {/* TAB 1: SESSIONS */}
      {activeTab === 'sessions' && (
        <div className="space-y-4">
          {/* Session filter bar: Đã khắc phục hoàn toàn lỗi overlap nút và search input */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="flex flex-wrap items-end justify-between gap-4">
              {/* Cụm bộ lọc ngày/ca/trạng thái */}
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                    Ngày học
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setSelectedDate(getTodayDateString())}
                      className="px-2.5 py-2 rounded-xl border border-gray-200 text-xs font-semibold hover:bg-gray-50 text-indigo-600 transition"
                      title="Chọn hôm nay"
                    >
                      Hôm nay
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                    Ca học
                  </label>
                  <select
                    value={selectedShift}
                    onChange={(e) => setSelectedShift(e.target.value)}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                  >
                    <option value="all">Tất cả ca học</option>
                    {SHIFT_OPTIONS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                    Trạng thái
                  </label>
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                  >
                    <option value="all">Tất cả trạng thái</option>
                    <option value="Chưa điểm danh">Chưa điểm danh</option>
                    {ATTENDANCE_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Cụm hành động: Tìm kiếm + Nút Điểm danh có mặt nhanh (Không bị overlap) */}
              <div className="flex flex-wrap items-end gap-3 w-full lg:w-auto">
                <div className="w-full sm:w-64">
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                    Tìm sinh viên
                  </label>
                  <SearchInput
                    value={searchStudent}
                    onChange={setSearchStudent}
                    placeholder="Mã SV, họ tên..."
                    className="w-full"
                  />
                </div>

                <div className="shrink-0">
                  <button
                    type="button"
                    onClick={handleMarkAllPresent}
                    disabled={bulkMarking || loading || students.length === 0}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition disabled:opacity-50 whitespace-nowrap h-[38px]"
                    title="Đánh dấu có mặt cho các sinh viên chưa được ghi nhận trong buổi này"
                  >
                    <i className={`fas ${bulkMarking ? 'fa-spinner fa-spin' : 'fa-check-double'}`} />
                    <span>Điểm danh có mặt nhanh</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Session Attendance Table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
            {loading ? (
              <div className="p-12 text-center">
                <Spinner />
              </div>
            ) : filteredSessionRows.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                <i className="far fa-clipboard text-4xl mb-3 block text-gray-300" />
                <p className="font-semibold text-gray-600 text-sm">Không có dữ liệu sinh viên nào</p>
                <p className="text-xs text-gray-400 mt-1">Lớp học phần này chưa có sinh viên đăng ký hoặc không khớp với bộ lọc.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-700">
                  <thead className="bg-gray-50/75 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3 w-14 text-center">STT</th>
                      <th className="px-5 py-3">Mã SV</th>
                      <th className="px-5 py-3">Họ tên & Lớp SH</th>
                      <th className="px-5 py-3">Trạng thái</th>
                      <th className="px-5 py-3">Thời gian / Ca</th>
                      <th className="px-5 py-3">Điểm & Đánh giá</th>
                      <th className="px-5 py-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredSessionRows.map((row, idx) => (
                      <tr key={row.student._id || row.student.id} className="hover:bg-indigo-50/20 transition">
                        <td className="px-5 py-3.5 text-center text-xs text-gray-400 font-medium">
                          {idx + 1}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="font-mono text-xs font-bold text-indigo-700 px-2 py-0.5 rounded bg-indigo-50 border border-indigo-100">
                            {formatStudentCode(row.student.id)}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <p className="font-bold text-gray-900 leading-tight">{row.student.hoTen}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {row.student.className ? `Lớp: ${row.student.className}` : row.student.email}
                          </p>
                        </td>
                        <td className="px-5 py-3.5">
                          {row.status === 'Chưa điểm danh' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500 border border-gray-200">
                              <i className="far fa-circle text-[10px]" />
                              Chưa điểm danh
                            </span>
                          ) : (
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${getStatusBadgeClass(row.status)}`}>
                              <i className={`fas ${getStatusIcon(row.status)}`} />
                              {row.status}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <p className="font-medium text-xs text-gray-800">
                            {formatAttendanceDate(row.date)}
                          </p>
                          <p className="text-[11px] text-gray-400">
                            {getShiftLabel(row.shiftId)}
                            {row.checkInTime && ` • Vào lúc: ${row.checkInTime}`}
                          </p>
                        </td>
                        <td className="px-5 py-3.5">
                          {row.score != null ? (
                            <span className="inline-block bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded text-xs border border-emerald-200">
                              {row.score}đ
                            </span>
                          ) : (
                            <span className="text-gray-300 text-xs italic">—</span>
                          )}
                          {row.evaluation && (
                            <p className="text-xs text-gray-600 mt-0.5 italic line-clamp-1 max-w-xs" title={row.evaluation}>
                              "{row.evaluation}"
                            </p>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(row)}
                              className="px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 rounded-lg border border-indigo-200 transition"
                              title="Ghi nhận / Chỉnh sửa điểm danh & đánh giá"
                            >
                              <i className="fas fa-pen mr-1 text-[10px]" />
                              {row.record ? 'Sửa' : 'Điểm danh'}
                            </button>
                            {row.record && (
                              <button
                                type="button"
                                onClick={() => handleDeleteRecord(row.record, row.student.hoTen)}
                                className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition"
                                title="Xóa bản ghi"
                              >
                                <i className="fas fa-trash text-xs" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: STUDENTS SUMMARY */}
      {activeTab === 'students' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-gray-500 font-medium">
              Hiển thị thống kê tổng số buổi tham gia và tỷ lệ chuyên cần của từng sinh viên trong lớp học phần.
            </p>
            <div className="w-full sm:w-64">
              <SearchInput
                value={searchStudent}
                onChange={setSearchStudent}
                placeholder="Tìm mã SV, họ tên..."
                className="w-full"
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
            {loading ? (
              <div className="p-12 text-center">
                <Spinner />
              </div>
            ) : filteredStudentSummaries.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                <p className="font-semibold text-gray-600 text-sm">Không có dữ liệu sinh viên</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-700">
                  <thead className="bg-gray-50/75 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3 w-14 text-center">STT</th>
                      <th className="px-5 py-3">Mã SV</th>
                      <th className="px-5 py-3">Họ tên & Lớp SH</th>
                      <th className="px-5 py-3 text-center">Tổng buổi</th>
                      <th className="px-5 py-3 text-center">Có mặt</th>
                      <th className="px-5 py-3 text-center">Muộn</th>
                      <th className="px-5 py-3 text-center">Vắng</th>
                      <th className="px-5 py-3">Tỷ lệ chuyên cần</th>
                      <th className="px-5 py-3 text-center">Tình trạng</th>
                      <th className="px-5 py-3 text-right">Lịch sử</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredStudentSummaries.map((s, idx) => (
                      <tr key={s._id || s.id} className="hover:bg-indigo-50/20 transition">
                        <td className="px-5 py-3.5 text-center text-xs text-gray-400 font-medium">
                          {idx + 1}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="font-mono text-xs font-bold text-indigo-700 px-2 py-0.5 rounded bg-indigo-50 border border-indigo-100">
                            {formatStudentCode(s.id)}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <p className="font-bold text-gray-900 leading-tight">{s.hoTen}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{s.className || s.email}</p>
                        </td>
                        <td className="px-5 py-3.5 text-center font-bold text-gray-800">
                          {s.total}
                        </td>
                        <td className="px-5 py-3.5 text-center font-bold text-emerald-600">
                          {s.present}
                        </td>
                        <td className="px-5 py-3.5 text-center font-bold text-amber-600">
                          {s.late}
                        </td>
                        <td className="px-5 py-3.5 text-center font-bold text-rose-600">
                          {s.absent + s.excused}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="w-36">
                            <div className="flex justify-between items-center text-xs font-bold mb-1">
                              <span className={s.rate >= 80 ? 'text-emerald-700' : s.rate >= 70 ? 'text-amber-700' : 'text-rose-700'}>
                                {s.rate}%
                              </span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-2 rounded-full transition-all duration-500 ${
                                  s.rate >= 80 ? 'bg-emerald-500' : s.rate >= 70 ? 'bg-amber-500' : 'bg-rose-500'
                                }`}
                                style={{ width: `${s.rate}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          {s.isAtRisk ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              <i className="fas fa-triangle-exclamation text-rose-500" />
                              Nguy cơ cấm thi
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <i className="fas fa-check text-emerald-500" />
                              Đạt yêu cầu
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => setHistoryModal({ isOpen: true, student: s })}
                            className="px-3 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 rounded-lg border border-indigo-200 transition"
                          >
                            Chi tiết
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: Edit / Record Attendance */}
      {editModal.isOpen && (
        <Modal
          open
          onClose={() => setEditModal((prev) => ({ ...prev, isOpen: false }))}
          title={`Ghi nhận chuyên cần - ${editModal.student?.hoTen || 'Sinh viên'}`}
        >
          <div className="space-y-4">
            {editModal.student && (
              <div className="flex items-center gap-3 p-3 bg-indigo-50/60 rounded-2xl border border-indigo-100">
                <Avatar
                  src={editModal.student.avatar?.url || editModal.student.avatar}
                  name={editModal.student.hoTen || 'SV'}
                  size={46}
                />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-gray-900 text-sm">{editModal.student.hoTen}</p>
                    <span className="text-[10px] font-mono font-bold bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">
                      {formatStudentCode(editModal.student.id)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    Lớp: <span className="font-semibold text-gray-700">{editModal.student.className || 'Chưa phân lớp'}</span> • {classItem.courseName}
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                  Ngày điểm danh
                </label>
                <input
                  type="date"
                  value={editModal.date}
                  onChange={(e) => setEditModal((p) => ({ ...p, date: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                  Ca học
                </label>
                <select
                  value={editModal.shiftId}
                  onChange={(e) => setEditModal((p) => ({ ...p, shiftId: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                >
                  {SHIFT_OPTIONS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                Trạng thái chuyên cần
              </label>
              <select
                value={editModal.status}
                onChange={(e) => setEditModal((p) => ({ ...p, status: e.target.value }))}
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
                value={editModal.score}
                onChange={(e) => setEditModal((p) => ({ ...p, score: e.target.value }))}
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
                value={editModal.evaluation}
                onChange={(e) => setEditModal((p) => ({ ...p, evaluation: e.target.value }))}
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
                value={editModal.note}
                onChange={(e) => setEditModal((p) => ({ ...p, note: e.target.value }))}
                placeholder="Ghi chú thêm nếu có..."
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setEditModal((prev) => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl font-medium"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={savingRecord}
                className="px-5 py-2 text-sm bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition disabled:opacity-50"
              >
                {savingRecord ? 'Đang lưu...' : 'Lưu bản ghi'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL 2: Student Attendance History */}
      {historyModal.isOpen && (
        <Modal
          open
          onClose={() => setHistoryModal({ isOpen: false, student: null })}
          title={`Lịch sử điểm danh - ${historyModal.student?.hoTen || 'Sinh viên'}`}
          size="lg"
        >
          <div className="space-y-4">
            {historyModal.student && (
              <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-2xl border border-gray-200">
                <div className="flex items-center gap-3">
                  <Avatar
                    src={historyModal.student.avatar?.url || historyModal.student.avatar}
                    name={historyModal.student.hoTen || 'SV'}
                    size={44}
                  />
                  <div>
                    <p className="font-bold text-gray-900">{historyModal.student.hoTen}</p>
                    <p className="text-xs text-gray-500">
                      Mã SV: <span className="font-mono text-indigo-700 font-bold">{formatStudentCode(historyModal.student.id)}</span> • {historyModal.student.className || 'Chưa phân lớp'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-semibold text-gray-400 block">Tỷ lệ chuyên cần</span>
                  <span className={`text-lg font-black ${
                    historyModal.student.rate >= 80 ? 'text-emerald-600' : historyModal.student.rate >= 70 ? 'text-amber-600' : 'text-rose-600'
                  }`}>
                    {historyModal.student.rate}%
                  </span>
                </div>
              </div>
            )}

            <div className="max-h-96 overflow-y-auto rounded-xl border border-gray-100">
              {historyModal.student?.history?.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">
                  Chưa có lượt điểm danh nào cho sinh viên này trong lớp.
                </div>
              ) : (
                <table className="w-full text-left text-xs text-gray-700">
                  <thead className="bg-gray-50 border-b border-gray-100 font-bold text-gray-500 uppercase">
                    <tr>
                      <th className="px-4 py-2.5">Ngày học</th>
                      <th className="px-4 py-2.5">Ca học</th>
                      <th className="px-4 py-2.5">Trạng thái</th>
                      <th className="px-4 py-2.5">Điểm tiết</th>
                      <th className="px-4 py-2.5">Đánh giá / Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {historyModal.student?.history?.map((rec) => (
                      <tr key={rec._id || rec.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium text-gray-900">
                          {formatAttendanceDate(rec.date)}
                        </td>
                        <td className="px-4 py-2.5 text-gray-500">
                          {getShiftLabel(rec.shiftId)}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[10px] ${getStatusBadgeClass(rec.status)}`}>
                            <i className={`fas ${getStatusIcon(rec.status)}`} />
                            {rec.status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-bold text-gray-800">
                          {rec.score != null ? `${rec.score}đ` : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-gray-600 italic">
                          {rec.evaluation || rec.note || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setHistoryModal({ isOpen: false, student: null })}
                className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-xl font-semibold text-gray-700"
              >
                Đóng
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default ClassAttendanceDetail;
