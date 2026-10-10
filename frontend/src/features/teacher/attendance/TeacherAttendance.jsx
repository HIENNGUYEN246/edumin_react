import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader, SearchInput } from '../../../components/ui/PageHeader.jsx';
import { DataTable } from '../../../components/ui/DataTable.jsx';
import { Spinner } from '../../../components/ui/Spinner.jsx';
import { Modal } from '../../../components/ui/Modal.jsx';
import { Avatar } from '../../../components/ui/Avatar.jsx';
import { ScheduleRoomBadge } from '../../../components/schedule/ScheduleBadge.jsx';
import { useToast } from '../../../app/providers/ToastProvider.jsx';
import { useAuth } from '../../../app/providers/AuthProvider.jsx';
import { useDebounce } from '../../../lib/useDebounce.js';
import { useMyTeacherClasses, useClassStudents } from '../useTeacherClasses.js';
import { attendanceApi } from '../../../api/attendanceApi.js';
import { formatStudentCode } from '../../../lib/format.js';
import {
  getTodayDateString,
  formatAttendanceDate,
  getShiftLabel,
  getStatusBadgeClass,
  getStatusIcon,
  ATTENDANCE_STATUSES,
  SHIFT_OPTIONS,
  EVALUATION_QUICK_TAGS,
} from '../../../utils/attendanceUtils.js';

export function TeacherAttendance() {
  const toast = useToast();
  const { user, profile } = useAuth();
  const [searchParams] = useSearchParams();
  const initialClassId = searchParams.get('classId') || '';

  // Tab: 'session' (Điểm danh buổi học) | 'students' (Tổng hợp chuyên cần theo sinh viên)
  const [activeTab, setActiveTab] = useState('session');

  const { data: classData, isLoading: classesLoading } = useMyTeacherClasses();
  const classes = useMemo(() => classData?.data || [], [classData]);

  // Hierarchical view mode: 'list' (Danh sách lớp học phần) | 'detail' (Chi tiết điểm danh sinh viên của lớp)
  const [selectedClassId, setSelectedClassId] = useState(initialClassId);
  const [viewMode, setViewMode] = useState(initialClassId ? 'detail' : 'list');

  // Search filter in class list
  const [classSearch, setClassSearch] = useState('');
  const debouncedClassSearch = useDebounce(classSearch);

  // Overall attendance records across all teacher classes (for class list stats)
  const [allTeacherRecords, setAllTeacherRecords] = useState([]);

  // Session date & shift in detail view
  const [selectedDate, setSelectedDate] = useState(getTodayDateString());
  const [selectedShift, setSelectedShift] = useState('1');

  // Search in students summary tab
  const [searchStudent, setSearchStudent] = useState('');
  const debouncedSearch = useDebounce(searchStudent);

  // Enrolled students in selected class
  const { data: studentsData, isLoading: studentsLoading } = useClassStudents(selectedClassId);
  const students = useMemo(() => studentsData?.students || [], [studentsData]);

  // Map of studentId -> { status, score, evaluation, note } for current session
  const [records, setRecords] = useState({});
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [saving, setSaving] = useState(false);

  // All attendance records for this class (for student summary tab)
  const [classAttendanceRecords, setClassAttendanceRecords] = useState([]);
  const [loadingClassRecords, setLoadingClassRecords] = useState(false);

  // Quick evaluation modal
  const [evalModal, setEvalModal] = useState({
    isOpen: false,
    student: null,
    score: '',
    evaluation: '',
    status: 'Có mặt',
    note: '',
  });

  // Student Attendance History modal
  const [historyModal, setHistoryModal] = useState({
    isOpen: false,
    student: null,
  });

  // Load all attendance records for teacher's overview
  useEffect(() => {
    let active = true;
    const fetchOverview = async () => {
      try {
        const teacherParam = profile?.id || user?._id;
        const res = await attendanceApi.getAll({ teacherId: teacherParam }).catch(() => []);
        if (active) {
          setAllTeacherRecords(Array.isArray(res) ? res : res?.data || []);
        }
      } catch {
        // Ignore
      }
    };
    fetchOverview();
    return () => {
      active = false;
    };
  }, [profile?.id, user?._id]);

  // Load all attendance records for the selected class (for student summary calculations)
  const loadClassAttendance = useCallback(async () => {
    if (!selectedClassId) return;
    try {
      setLoadingClassRecords(true);
      const res = await attendanceApi.getAll({ regId: selectedClassId });
      setClassAttendanceRecords(Array.isArray(res) ? res : res?.data || []);
    } catch {
      // Ignore
    } finally {
      setLoadingClassRecords(false);
    }
  }, [selectedClassId]);

  // Load existing records for selected class + date + shift
  const loadExistingAttendance = useCallback(async () => {
    if (!selectedClassId) return;
    try {
      setLoadingRecords(true);
      const res = await attendanceApi.getAll({
        regId: selectedClassId,
        date: selectedDate,
        shiftId: selectedShift,
      });
      const list = Array.isArray(res) ? res : res?.data || [];
      const map = {};
      list.forEach((item) => {
        map[item.studentId] = {
          status: item.status || 'Có mặt',
          score: item.score != null ? String(item.score) : '',
          evaluation: item.evaluation || '',
          note: item.note || '',
          checkInTime: item.checkInTime || '',
        };
      });
      setRecords(map);
    } catch {
      // Ignore
    } finally {
      setLoadingRecords(false);
    }
  }, [selectedClassId, selectedDate, selectedShift]);

  useEffect(() => {
    if (viewMode === 'detail' && selectedClassId) {
      loadExistingAttendance();
      loadClassAttendance();
    }
  }, [viewMode, selectedClassId, loadExistingAttendance, loadClassAttendance]);

  const selectedClass = useMemo(() => {
    return classes.find((c) => c.id === selectedClassId) || null;
  }, [classes, selectedClassId]);

  // Map attendance rate per class for Class List view
  const classRateMap = useMemo(() => {
    const map = {};
    allTeacherRecords.forEach((att) => {
      const cId = att.regId || att.courseId;
      if (!cId) return;
      if (!map[cId]) map[cId] = { total: 0, present: 0, late: 0 };
      map[cId].total += 1;
      if (att.status === 'Có mặt') map[cId].present += 1;
      else if (att.status === 'Đi muộn') map[cId].late += 1;
    });

    const rates = {};
    Object.keys(map).forEach((cId) => {
      const item = map[cId];
      rates[cId] = item.total > 0 ? Math.round(((item.present + item.late * 0.5) / item.total) * 100) : 100;
    });
    return rates;
  }, [allTeacherRecords]);

  // Filtered classes in list view
  const filteredClasses = useMemo(() => {
    if (!debouncedClassSearch) return classes;
    const q = debouncedClassSearch.toLowerCase();
    return classes.filter(
      (c) =>
        (c.id || '').toLowerCase().includes(q) ||
        (c.courseName || '').toLowerCase().includes(q) ||
        (c.room || '').toLowerCase().includes(q)
    );
  }, [classes, debouncedClassSearch]);

  // Overall attendance statistics for selected class
  const overallStats = useMemo(() => {
    const total = classAttendanceRecords.length;
    const present = classAttendanceRecords.filter((r) => r.status === 'Có mặt').length;
    const late = classAttendanceRecords.filter((r) => r.status === 'Đi muộn').length;
    const absent = classAttendanceRecords.filter((r) => r.status === 'Vắng mặt' || r.status === 'Vắng có phép').length;
    const rate = total > 0 ? Math.round(((present + late * 0.5) / total) * 100) : 100;
    return { total, present, late, absent, rate };
  }, [classAttendanceRecords]);

  // Handle status change
  const handleStatusChange = (studentId, status) => {
    setRecords((prev) => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || {}),
        status,
      },
    }));
  };

  // Mark all present for current session
  const handleMarkAllPresent = () => {
    if (selectedDate > getTodayDateString()) {
      toast.error('Không thể điểm danh cho ngày trong tương lai!');
      return;
    }
    const next = { ...records };
    students.forEach((s) => {
      next[s.id] = {
        ...(next[s.id] || {}),
        status: 'Có mặt',
      };
    });
    setRecords(next);
    toast.success(`Đã đánh dấu có mặt cho ${students.length} sinh viên`);
  };

  // Open evaluation modal
  const openEvaluationModal = (student) => {
    const rec = records[student.id] || {};
    setEvalModal({
      isOpen: true,
      student,
      score: rec.score != null ? String(rec.score) : '',
      evaluation: rec.evaluation || '',
      status: rec.status || 'Có mặt',
      note: rec.note || '',
    });
  };

  // Save quick evaluation modal
  const handleSaveEvalModal = () => {
    if (!evalModal.student) return;
    setRecords((prev) => ({
      ...prev,
      [evalModal.student.id]: {
        ...(prev[evalModal.student.id] || {}),
        score: evalModal.score,
        evaluation: evalModal.evaluation,
        status: evalModal.status,
        note: evalModal.note,
      },
    }));
    setEvalModal({ isOpen: false, student: null, score: '', evaluation: '', status: 'Có mặt', note: '' });
    toast.success(`Đã cập nhật đánh giá cho ${evalModal.student.hoTen}`);
  };

  // Save bulk to server
  const handleSaveBulk = async () => {
    if (!selectedClassId || students.length === 0) {
      toast.error('Chưa có danh sách sinh viên để lưu');
      return;
    }
    if (selectedDate > getTodayDateString()) {
      toast.error('Không thể điểm danh cho ngày trong tương lai!');
      return;
    }

    try {
      setSaving(true);
      const payloadRecords = students.map((s) => {
        const rec = records[s.id] || {};
        return {
          studentId: s.id,
          studentName: s.hoTen,
          studentEmail: s.email,
          studentAvatar: typeof s.avatar === 'string' ? s.avatar : s.avatar?.url || '',
          status: rec.status || 'Có mặt',
          score: rec.score !== '' && rec.score != null ? Number(rec.score) : null,
          evaluation: rec.evaluation || '',
          note: rec.note || '',
        };
      });

      await attendanceApi.saveBulk({
        regId: selectedClassId,
        courseId: selectedClass?.courseId || '',
        courseName: selectedClass?.courseName || '',
        date: selectedDate,
        shiftId: selectedShift,
        shiftLabel: getShiftLabel(selectedShift),
        teacherId: profile?.id || user?._id,
        teacherName: profile?.hoTen || user?.hoTen,
        records: payloadRecords,
      });

      toast.success('Đã lưu điểm danh & đánh giá thành công!');
      await Promise.all([loadExistingAttendance(), loadClassAttendance()]);
      window.dispatchEvent(
        new CustomEvent('edumin_attendance_updated', {
          detail: { courseName: selectedClass?.courseName, status: 'Đã hoàn tất điểm danh' },
        })
      );
    } catch {
      toast.error('Lỗi khi lưu điểm danh');
    } finally {
      setSaving(false);
    }
  };

  // Summary stats for current session
  const sessionStats = useMemo(() => {
    let present = 0;
    let late = 0;
    let excused = 0;
    let absent = 0;
    students.forEach((s) => {
      const st = records[s.id]?.status || 'Có mặt';
      if (st === 'Có mặt') present += 1;
      else if (st === 'Đi muộn') late += 1;
      else if (st === 'Vắng có phép') excused += 1;
      else if (st === 'Vắng mặt') absent += 1;
    });
    return { present, late, excused, absent, total: students.length };
  }, [students, records]);

  // Aggregate attendance per student for the selected class
  const studentAttendanceMap = useMemo(() => {
    const map = {};
    classAttendanceRecords.forEach((att) => {
      const sId = String(att.studentId?._id || att.studentId?.id || att.studentId || '');
      if (!sId) return;
      if (!map[sId]) {
        map[sId] = { total: 0, present: 0, late: 0, excused: 0, absent: 0, scores: [], history: [] };
      }
      map[sId].total += 1;
      map[sId].history.push(att);
      if (att.status === 'Có mặt') map[sId].present += 1;
      else if (att.status === 'Đi muộn') map[sId].late += 1;
      else if (att.status === 'Vắng có phép') map[sId].excused += 1;
      else if (att.status === 'Vắng mặt') map[sId].absent += 1;

      if (att.score !== null && att.score !== undefined) {
        map[sId].scores.push(Number(att.score));
      }
    });
    return map;
  }, [classAttendanceRecords]);

  // Student list enriched with statistics
  const studentSummaries = useMemo(() => {
    return students.map((s) => {
      const sKey = String(s.id ?? s._id ?? '');
      const stat = studentAttendanceMap[sKey] || studentAttendanceMap[s.id] || { total: 0, present: 0, late: 0, excused: 0, absent: 0, scores: [], history: [] };
      const rate = stat.total > 0 ? Math.round(((stat.present + stat.late * 0.5) / stat.total) * 100) : 100;
      const avgScore =
        stat.scores.length > 0
          ? (stat.scores.reduce((a, b) => a + b, 0) / stat.scores.length).toFixed(1)
          : null;
      const absentCount = stat.absent + stat.excused;
      const isAtRisk = stat.total >= 3 && rate < 80;
      const history = (stat.history || []).slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

      return {
        ...s,
        total: stat.total,
        present: stat.present,
        late: stat.late,
        excused: stat.excused,
        absent: stat.absent,
        absentCount,
        rate,
        avgScore,
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

  if (classesLoading) return <Spinner />;

  // ==========================================
  // VIEW 1: CLASS LIST (Danh sách lớp học phần)
  // ==========================================
  if (viewMode === 'list') {
    const classColumns = [
      {
        key: 'id',
        header: 'Mã lớp học phần',
        className: 'w-36 font-mono font-bold text-indigo-700',
        render: (c) => (
          <span className="px-2.5 py-1 rounded-md bg-indigo-50 border border-indigo-200/80">
            {c.id}
          </span>
        ),
      },
      {
        key: 'courseId',
        header: 'Mã học phần',
        className: 'w-28 font-mono font-semibold text-gray-700',
      },
      {
        key: 'courseName',
        header: 'Tên học phần',
        render: (c) => (
          <div>
            <p className="font-bold text-gray-900 leading-tight">{c.courseName}</p>
            <p className="text-xs text-gray-400 mt-0.5">Khoa: {c.department || 'Chung'}</p>
          </div>
        ),
      },
      {
        key: 'className',
        header: 'Tên lớp học phần',
        className: 'font-medium text-gray-800',
        render: (c) => c.className || '—',
      },
      {
        key: 'schedules',
        header: 'Lịch học & Phòng',
        render: (c) => (
          <ScheduleRoomBadge
            schedules={c.schedules}
            room={c.room}
            studyStart={c.studyStart}
            studyEnd={c.studyEnd}
          />
        ),
      },
      {
        key: 'enrolledCount',
        header: 'Sĩ số',
        className: 'text-center font-bold text-gray-800 w-24',
        render: (c) => (
          <span>
            {c.enrolledCount ?? 0}
            {c.capacity ? <span className="text-gray-400 font-normal text-xs">/{c.capacity}</span> : ''}
          </span>
        ),
      },
      {
        key: 'attendanceRate',
        header: 'Chuyên cần',
        className: 'w-36',
        render: (c) => {
          const rate = classRateMap[c.id] ?? 100;
          return (
            <div>
              <div className="flex justify-between items-center text-xs font-bold mb-1">
                <span className={rate >= 80 ? 'text-emerald-700' : rate >= 70 ? 'text-amber-700' : 'text-rose-700'}>
                  {rate}%
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${
                    rate >= 80 ? 'bg-emerald-500' : rate >= 70 ? 'bg-amber-500' : 'bg-rose-500'
                  }`}
                  style={{ width: `${rate}%` }}
                />
              </div>
            </div>
          );
        },
      },
      {
        key: 'action',
        header: '',
        className: 'text-right w-44',
        render: (c) => (
          <button
            type="button"
            onClick={() => {
              setSelectedClassId(c.id);
              setViewMode('detail');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition shadow-2xs"
          >
            <i className="fas fa-clipboard-user text-[11px]" />
            <span>Điểm danh & Quản lý</span>
          </button>
        ),
      },
    ];

    const totalEnrolled = classes.reduce((sum, c) => sum + (c.enrolledCount || 0), 0);
    const avgTeacherRate =
      classes.length > 0
        ? Math.round(
            classes.reduce((sum, c) => sum + (classRateMap[c.id] ?? 100), 0) / classes.length
          )
        : 100;

    return (
      <div className="space-y-5">
        <PageHeader
          title="Điểm danh & Đánh giá Sinh viên"
          description="Danh sách các lớp học phần được phân công giảng dạy. Chọn một lớp để quản lý điểm danh và đánh giá chuyên cần."
        />

        {/* KPI stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <i className="fas fa-chalkboard text-base" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-semibold uppercase">Lớp phụ trách</p>
              <p className="text-2xl font-black text-gray-800">{classes.length}</p>
            </div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <i className="fas fa-user-graduate text-base" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-semibold uppercase">Tổng sinh viên</p>
              <p className="text-2xl font-black text-gray-800">{totalEnrolled}</p>
            </div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <i className="fas fa-clipboard-check text-base" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-semibold uppercase">Chuyên cần trung bình</p>
              <p className="text-2xl font-black text-emerald-600">{avgTeacherRate}%</p>
            </div>
          </div>
        </div>

        {/* Filter bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-gray-500 font-medium">
            Chọn lớp học phần bên dưới để ghi nhận chuyên cần theo từng buổi hoặc theo dõi báo cáo sinh viên.
          </p>
          <div className="w-full sm:w-72">
            <SearchInput
              value={classSearch}
              onChange={setClassSearch}
              placeholder="Tìm mã lớp, học phần, phòng..."
              className="w-full"
            />
          </div>
        </div>

        {/* Class DataTable */}
        <DataTable
          columns={classColumns}
          rows={filteredClasses}
          emptyText="Bạn chưa được phân công lớp học phần nào"
        />
      </div>
    );
  }

  // ==========================================
  // VIEW 2: STUDENT ATTENDANCE DETAILS
  // ==========================================
  return (
    <div className="space-y-5">
      {/* Top Header Navigation */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setViewMode('list');
                setSelectedClassId('');
              }}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-gray-700 bg-gray-100 hover:bg-indigo-50 hover:text-indigo-700 border border-gray-200 transition"
              title="Quay lại danh sách lớp học phần"
            >
              <i className="fas fa-arrow-left text-xs" />
              <span>Danh sách lớp</span>
            </button>
            <div className="h-6 w-px bg-gray-200 hidden sm:block" />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                  {selectedClass?.id || selectedClassId}
                </span>
                {selectedClass?.courseId && (
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                    Mã HP: {selectedClass.courseId}
                  </span>
                )}
                <h1 className="text-base sm:text-lg font-black text-gray-900">
                  {selectedClass?.courseName || 'Chi tiết lớp học phần'}
                </h1>
                {selectedClass?.className && (
                  <span className="text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-md">
                    Lớp: {selectedClass.className}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Khoa: {selectedClass?.department || 'Chung'} • Sĩ số: {students.length} SV • Chuyên cần: {overallStats.rate}%
              </p>
            </div>
          </div>

          {activeTab === 'session' && (
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleMarkAllPresent}
                disabled={students.length === 0}
                className="px-3.5 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl text-xs font-bold transition disabled:opacity-50 whitespace-nowrap"
              >
                <i className="fas fa-check-double mr-1.5" /> Có mặt tất cả
              </button>
              <button
                type="button"
                onClick={handleSaveBulk}
                disabled={saving || students.length === 0}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap"
              >
                <i className="fas fa-save" /> {saving ? 'Đang lưu...' : 'Lưu điểm danh'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Select class and session filters */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
              Đổi lớp học phần
            </label>
            <select
              value={selectedClassId}
              onChange={(e) => {
                if (e.target.value === '__list__') {
                  setViewMode('list');
                } else {
                  setSelectedClassId(e.target.value);
                }
              }}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white font-medium"
            >
              {classes.map((c) => (
                <option key={c._id || c.id} value={c.id}>
                  {c.id} - {c.courseName}
                </option>
              ))}
              <option value="__list__">← Quay lại danh sách lớp...</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
              Ngày điểm danh
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                max={getTodayDateString()}
                min={selectedClass?.studyStart || undefined}
                value={selectedDate}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val > getTodayDateString()) {
                    toast.error('Không thể chọn ngày điểm danh ở tương lai');
                    return;
                  }
                  setSelectedDate(val);
                }}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
              />
              <button
                type="button"
                onClick={() => setSelectedDate(getTodayDateString())}
                className="px-2.5 py-2 rounded-xl border border-gray-200 text-xs font-semibold hover:bg-gray-50 text-indigo-600 whitespace-nowrap"
              >
                Hôm nay
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
              Ca học / Tiết học
            </label>
            <select
              value={selectedShift}
              onChange={(e) => setSelectedShift(e.target.value)}
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

        {/* Selected class info banner */}
        {selectedClass && (
          <div className="pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between text-xs text-gray-500 gap-2">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span>Học phần: <strong className="text-gray-800 font-semibold">{selectedClass.courseName}</strong></span>
              <span>•</span>
              <span>Khoa: <strong className="text-gray-800 font-semibold">{selectedClass.department || 'Chung'}</strong></span>
              {selectedClass.room && (
                <>
                  <span>•</span>
                  <span>Phòng: <strong className="text-gray-800 font-semibold">{selectedClass.room}</strong></span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Tỷ lệ chuyên cần chung:</span>
              <span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                {overallStats.rate}%
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Tabs navigation */}
      <div className="flex border-b border-gray-200 gap-8">
        <button
          type="button"
          onClick={() => setActiveTab('session')}
          className={`pb-3 font-semibold text-sm transition relative ${
            activeTab === 'session' ? 'text-indigo-600' : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <i className="fas fa-calendar-check mr-2 text-xs" />
          Điểm danh buổi học
          {activeTab === 'session' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('students')}
          className={`pb-3 font-semibold text-sm transition relative ${
            activeTab === 'students' ? 'text-indigo-600' : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <i className="fas fa-users-viewfinder mr-2 text-xs" />
          Tổng hợp chuyên cần theo sinh viên ({students.length})
          {activeTab === 'students' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full" />
          )}
        </button>
      </div>

      {/* TAB 1: Điểm danh buổi học */}
      {activeTab === 'session' && (
        <div className="space-y-4">
          {/* Summary stats for current session */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs text-center">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Sĩ số lớp</p>
              <p className="text-xl font-black text-gray-800 mt-0.5">{sessionStats.total} <span className="text-xs font-normal text-gray-400">SV</span></p>
            </div>
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs text-center">
              <p className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">Có mặt</p>
              <p className="text-xl font-black text-emerald-600 mt-0.5">{sessionStats.present}</p>
            </div>
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs text-center">
              <p className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider">Đi muộn</p>
              <p className="text-xl font-black text-amber-600 mt-0.5">{sessionStats.late}</p>
            </div>
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs text-center">
              <p className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider">Có phép</p>
              <p className="text-xl font-black text-blue-600 mt-0.5">{sessionStats.excused}</p>
            </div>
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs text-center">
              <p className="text-[11px] font-semibold text-rose-600 uppercase tracking-wider">Vắng mặt</p>
              <p className="text-xl font-black text-rose-600 mt-0.5">{sessionStats.absent}</p>
            </div>
          </div>

          {/* Students list for attendance */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
            {studentsLoading || loadingRecords ? (
              <div className="p-12 text-center">
                <Spinner />
              </div>
            ) : students.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                <i className="fas fa-user-graduate text-4xl mb-3 block text-gray-300" />
                <p className="font-semibold text-gray-600 text-sm">Chưa có sinh viên đăng ký lớp học này</p>
                <p className="text-xs text-gray-400 mt-1">Khi sinh viên đăng ký lớp học phần, danh sách sẽ hiển thị ở đây.</p>
              </div>
            ) : (
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full min-w-[850px] text-left text-sm text-gray-700">
                  <thead className="bg-gray-50/75 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    <tr>
                      <th className="px-5 py-3 w-14 text-center">STT</th>
                      <th className="px-5 py-3">Mã SV</th>
                      <th className="px-5 py-3">Họ tên & Lớp SH</th>
                      <th className="px-5 py-3">Trạng thái điểm danh</th>
                      <th className="px-5 py-3 text-center">Điểm tiết</th>
                      <th className="px-5 py-3">Đánh giá nhận xét</th>
                      <th className="px-5 py-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {students.map((student, idx) => {
                      const rec = records[student.id] || { status: 'Có mặt', score: '', evaluation: '' };

                      return (
                        <tr key={student._id || student.id} className="hover:bg-indigo-50/20 transition">
                          <td className="px-5 py-3 text-center text-xs text-gray-400 font-medium">
                            {idx + 1}
                          </td>
                          <td className="px-5 py-3">
                            <span className="font-mono text-xs font-bold text-indigo-700 px-2 py-0.5 rounded bg-indigo-50 border border-indigo-100">
                              {formatStudentCode(student.id)}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            <p className="font-bold text-gray-900 leading-tight">{student.hoTen}</p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {student.className ? `Lớp: ${student.className}` : student.email}
                            </p>
                          </td>
                          <td className="px-5 py-3">
                            <div className="inline-flex rounded-xl border border-gray-200 p-0.5 bg-gray-50 gap-0.5">
                              {ATTENDANCE_STATUSES.map((status) => {
                                const isSelected = rec.status === status;
                                let activeClass = 'bg-white shadow-xs font-bold ';
                                if (status === 'Có mặt') activeClass += 'text-emerald-700';
                                else if (status === 'Đi muộn') activeClass += 'text-amber-700';
                                else if (status === 'Vắng có phép') activeClass += 'text-blue-700';
                                else if (status === 'Vắng mặt') activeClass += 'text-rose-700';

                                return (
                                  <button
                                    key={status}
                                    type="button"
                                    onClick={() => handleStatusChange(student.id, status)}
                                    className={`px-2.5 py-1 text-xs rounded-lg transition ${
                                      isSelected
                                        ? activeClass
                                        : 'text-gray-500 hover:text-gray-800'
                                    }`}
                                  >
                                    <i className={`fas ${getStatusIcon(status)} mr-1 text-[10px]`} />
                                    {status}
                                  </button>
                                );
                              })}
                            </div>
                          </td>
                          <td className="px-5 py-3 text-center">
                            {rec.score !== '' && rec.score != null ? (
                              <span className="inline-block bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded text-xs border border-emerald-200">
                                {rec.score}đ
                              </span>
                            ) : (
                              <span className="text-gray-300 text-xs italic">—</span>
                            )}
                          </td>
                          <td className="px-5 py-3">
                            {rec.evaluation ? (
                              <p className="text-xs text-gray-600 italic line-clamp-1 max-w-xs" title={rec.evaluation}>
                                &quot;{rec.evaluation}&quot;
                              </p>
                            ) : (
                              <span className="text-gray-300 text-xs italic">Chưa có nhận xét</span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => openEvaluationModal(student)}
                              className="px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 rounded-lg border border-indigo-200 transition"
                            >
                              <i className="fas fa-star mr-1 text-[10px] text-amber-500" />
                              Đánh giá
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Tổng hợp chuyên cần theo sinh viên */}
      {activeTab === 'students' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-gray-500 font-medium">
              Thống kê tổng số buổi học, tỷ lệ chuyên cần và lịch sử đánh giá của từng sinh viên trong lớp học phần này.
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

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
            {studentsLoading || loadingClassRecords ? (
              <div className="p-12 text-center">
                <Spinner />
              </div>
            ) : filteredStudentSummaries.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                <p className="font-semibold text-gray-600 text-sm">Không có dữ liệu sinh viên</p>
              </div>
            ) : (
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full min-w-[950px] text-left text-sm text-gray-700">
                  <thead className="bg-gray-50/75 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
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

      {/* MODAL 1: Quick evaluation modal */}
      {evalModal.isOpen && (
        <Modal
          open
          onClose={() => setEvalModal({ isOpen: false, student: null, score: '', evaluation: '', status: 'Có mặt', note: '' })}
          title={`Đánh giá sinh viên - ${evalModal.student?.hoTen || 'Sinh viên'}`}
        >
          <div className="space-y-4">
            {evalModal.student && (
              <div className="flex items-center gap-3 p-3 bg-indigo-50/60 rounded-2xl border border-indigo-100">
                <Avatar
                  src={evalModal.student.avatar?.url || evalModal.student.avatar}
                  name={evalModal.student.hoTen || 'SV'}
                  size={46}
                />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-gray-900 text-sm">{evalModal.student.hoTen}</p>
                    <span className="text-[10px] font-mono font-bold bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">
                      {formatStudentCode(evalModal.student.id)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    Lớp: <span className="font-semibold text-gray-700">{evalModal.student.className || 'Chưa phân lớp'}</span> • {selectedClass?.courseName}
                  </p>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                Trạng thái chuyên cần
              </label>
              <div className="grid grid-cols-2 gap-2">
                {ATTENDANCE_STATUSES.map((status) => {
                  const isSelected = evalModal.status === status;
                  return (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setEvalModal((p) => ({ ...p, status }))}
                      className={`p-2.5 rounded-xl text-xs font-bold border text-left transition flex items-center justify-between ${
                        isSelected
                          ? getStatusBadgeClass(status) + ' ring-2 ring-indigo-500/20'
                          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <span>{status}</span>
                      <i className={`fas ${getStatusIcon(status)}`} />
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-bold text-gray-600 uppercase">
                  Điểm đánh giá tiết học (Thang điểm 10)
                </label>
                {evalModal.score && (
                  <span className="text-xs font-bold text-indigo-600">{evalModal.score} / 10 điểm</span>
                )}
              </div>
              <input
                type="number"
                min="0"
                max="10"
                step="0.5"
                placeholder="Nhập điểm phát biểu, làm bài (VD: 8.5)"
                value={evalModal.score}
                onChange={(e) => setEvalModal((p) => ({ ...p, score: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {[10, 9, 8, 7, 5].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setEvalModal((p) => ({ ...p, score: String(val) }))}
                    className="px-2 py-0.5 rounded-lg border border-gray-200 text-xs font-semibold hover:bg-gray-50 text-gray-700"
                  >
                    {val}đ
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                Gợi ý nhận xét nhanh
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {EVALUATION_QUICK_TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() =>
                      setEvalModal((p) => ({
                        ...p,
                        evaluation: p.evaluation ? `${p.evaluation}, ${tag}` : tag,
                      }))
                    }
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-indigo-50 hover:text-indigo-600 text-gray-700 transition"
                  >
                    + {tag}
                  </button>
                ))}
              </div>
              <textarea
                rows={2}
                placeholder="Ghi chú thái độ, kết quả học tập của sinh viên trong buổi này..."
                value={evalModal.evaluation}
                onChange={(e) => setEvalModal((p) => ({ ...p, evaluation: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setEvalModal({ isOpen: false, student: null, score: '', evaluation: '', status: 'Có mặt', note: '' })}
                className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveEvalModal}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
              >
                Cập nhật đánh giá
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
        >
          <div className="space-y-4">
            {historyModal.student && (
              <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Avatar
                      src={historyModal.student.avatar?.url || historyModal.student.avatar}
                      name={historyModal.student.hoTen || 'SV'}
                      size={40}
                    />
                    <div>
                      <p className="font-bold text-gray-900 text-sm">{historyModal.student.hoTen}</p>
                      <p className="text-xs text-gray-400">
                        Mã SV: <strong className="font-mono text-gray-700">{formatStudentCode(historyModal.student.id)}</strong>
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-gray-400">Chuyên cần</span>
                    <p className="text-base font-black text-indigo-600">{historyModal.student.rate}%</p>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-gray-200/60 text-center">
                  <div>
                    <span className="text-[10px] text-gray-400 block uppercase font-bold">Tổng</span>
                    <span className="font-bold text-gray-700 text-xs">{historyModal.student.total} buổi</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-emerald-600 block uppercase font-bold">Có mặt</span>
                    <span className="font-bold text-emerald-600 text-xs">{historyModal.student.present}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-amber-600 block uppercase font-bold">Muộn</span>
                    <span className="font-bold text-amber-600 text-xs">{historyModal.student.late}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-rose-600 block uppercase font-bold">Vắng</span>
                    <span className="font-bold text-rose-600 text-xs">{historyModal.student.absent + historyModal.student.excused}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {historyModal.student?.history?.length === 0 ? (
                <p className="text-center text-xs text-gray-400 py-6">Chưa có bản ghi điểm danh nào</p>
              ) : (
                historyModal.student?.history?.map((rec) => (
                  <div
                    key={rec._id || rec.id}
                    className="p-3 bg-white rounded-xl border border-gray-100 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-800">
                          {formatAttendanceDate(rec.date)}
                        </span>
                        <span className="text-gray-400">• Ca {rec.shiftId}</span>
                      </div>
                      {rec.evaluation && (
                        <p className="text-gray-500 italic mt-0.5 text-[11px]">&quot;{rec.evaluation}&quot;</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {rec.score != null && (
                        <span className="font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded text-[11px] border border-emerald-100">
                          {rec.score}đ
                        </span>
                      )}
                      <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${getStatusBadgeClass(rec.status)}`}>
                        {rec.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setHistoryModal({ isOpen: false, student: null })}
                className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition"
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

export default TeacherAttendance;
