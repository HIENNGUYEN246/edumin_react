import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useSearchParams, useLocation } from 'react-router-dom';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
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
import { exportSheet } from '../../../lib/excel.js';
import {
  getTodayDateString,
  formatAttendanceDate,
  getShiftLabel,
  ATTENDANCE_STATUSES,
  SHIFT_OPTIONS,
  EVALUATION_QUICK_TAGS,
  generateScheduleAlignedSessions,
  MATRIX_STATUS_MAP,
} from '../../../utils/attendanceUtils.js';

// Status icons & colors for matrix cells (re-exported for compatibility)
export { MATRIX_STATUS_MAP };

// Backward-compatible alias for session generator
export const generateClassSessions = generateScheduleAlignedSessions;

/**
 * Single Course Class Accordion Card with Integrated LMS Matrix Grid
 */
function TeacherClassAccordionCard({
  classItem,
  isExpanded,
  onToggleExpand,
  teacherUser,
  teacherProfile,
}) {
  const toast = useToast();
  const classId = classItem?.id || classItem?._id || '';

  // Enrolled students in this class
  const { data: studentsData, isLoading: studentsLoading } = useClassStudents(classId);
  const students = useMemo(() => studentsData?.students || [], [studentsData]);

  // Attendance records from DB for this class
  const [classAttendanceRecords, setClassAttendanceRecords] = useState([]);
  const [loadingClassRecords, setLoadingClassRecords] = useState(false);

  const loadAttendance = useCallback(async () => {
    if (!classId) return;
    try {
      setLoadingClassRecords(true);
      const res = await attendanceApi.getAll({ regId: classId, classId });
      setClassAttendanceRecords(Array.isArray(res) ? res : res?.data || []);
    } catch {
      // Ignore
    } finally {
      setLoadingClassRecords(false);
    }
  }, [classId]);

  useEffect(() => {
    if (classId) {
      loadAttendance();
    }
  }, [classId, loadAttendance]);

  // Generate sessions strictly synchronized with class weekly timetable (T3, T4, T7, CN...)
  const sessions = useMemo(() => {
    return generateScheduleAlignedSessions(classItem, classAttendanceRecords);
  }, [classItem, classAttendanceRecords]);

  // Active highlighted session column
  const [activeSessionDate, setActiveSessionDate] = useState('');

  useEffect(() => {
    if (sessions.length > 0) {
      const today = sessions.find((s) => s.date === getTodayDateString());
      if (today) {
        setActiveSessionDate(today.date);
      } else {
        const todayStr = getTodayDateString();
        const pastSessions = sessions.filter((s) => s.date <= todayStr);
        setActiveSessionDate(pastSessions.length > 0 ? pastSessions[pastSessions.length - 1].date : sessions[0].date);
      }
    }
  }, [sessions]);

  // Map of server records: `${studentId}__${date}` -> { status, score, evaluation, note }
  const originalRecordsMap = useMemo(() => {
    const map = {};
    classAttendanceRecords.forEach((att) => {
      const cleanDate = String(att.date || '').slice(0, 10).trim();
      if (!cleanDate) return;

      const noteText = att.note || att.evaluation || '';
      const scoreStr = att.score != null && att.score !== '' ? String(att.score) : '';
      const valObj = {
        status: att.status || 'Có mặt',
        score: scoreStr,
        evaluation: noteText,
        note: noteText,
        checkInTime: att.checkInTime || '',
      };

      // Collect all possible ID keys for this student (number id, string id, mongo _id)
      const idKeys = new Set();
      if (att.studentId != null) {
        if (typeof att.studentId === 'object') {
          if (att.studentId._id) idKeys.add(String(att.studentId._id));
          if (att.studentId.id) idKeys.add(String(att.studentId.id));
        } else {
          idKeys.add(String(att.studentId));
        }
      }
      if (att.studentRef != null) {
        if (typeof att.studentRef === 'object') {
          if (att.studentRef._id) idKeys.add(String(att.studentRef._id));
          if (att.studentRef.id) idKeys.add(String(att.studentRef.id));
        } else {
          idKeys.add(String(att.studentRef));
        }
      }

      idKeys.forEach((sId) => {
        map[`${sId}__${cleanDate}`] = valObj;
        if (att.date && att.date !== cleanDate) {
          map[`${sId}__${att.date}`] = valObj;
        }
      });
    });
    return map;
  }, [classAttendanceRecords]);

  // Unsaved changes: `${studentId}__${date}` -> { status, score, evaluation, note }
  const [cellChanges, setCellChanges] = useState({});
  const [saving, setSaving] = useState(false);

  // Search filter for students
  const [studentSearch, setStudentSearch] = useState('');
  const debouncedStudentSearch = useDebounce(studentSearch);

  // Risk status filter: 'all' | 'at_risk' | 'perfect'
  const [riskFilter, setRiskFilter] = useState('all');

  // Popover state for quick cell edit
  const [activeCellPopover, setActiveCellPopover] = useState(null); // { studentId, date, student, anchorEl }
  const popoverRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setActiveCellPopover(null);
      }
    };
    if (activeCellPopover) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [activeCellPopover]);

  // Evaluation & Note Modal
  const [evalModal, setEvalModal] = useState({
    isOpen: false,
    student: null,
    date: '',
    score: '',
    evaluation: '',
    note: '',
    status: 'Có mặt',
  });

  // Modal xác nhận hủy thay đổi điểm danh
  const [confirmRevertOpen, setConfirmRevertOpen] = useState(false);

  // History modal
  const [historyModal, setHistoryModal] = useState({
    isOpen: false,
    student: null,
  });

  // Cell helper: Get current value (supporting studentId, student object, clean date and aliases)
  const getCellValue = useCallback(
    (studentId, date, student = null) => {
      const cleanDate = String(date || '').slice(0, 10).trim();
      const possibleIds = [
        studentId,
        student?.id,
        student?._id,
        student?.studentId,
      ].filter((x) => x !== null && x !== undefined && x !== '').map(String);

      // 1. Check unsaved cellChanges first
      for (const id of possibleIds) {
        const key = `${id}__${cleanDate}`;
        if (cellChanges[key]) return cellChanges[key];
        if (date && date !== cleanDate && cellChanges[`${id}__${date}`]) {
          return cellChanges[`${id}__${date}`];
        }
      }

      // 2. Check originalRecordsMap
      for (const id of possibleIds) {
        const key = `${id}__${cleanDate}`;
        if (originalRecordsMap[key]) return originalRecordsMap[key];
        if (date && date !== cleanDate && originalRecordsMap[`${id}__${date}`]) {
          return originalRecordsMap[`${id}__${date}`];
        }
      }

      // 3. Fallback direct match in raw classAttendanceRecords
      if (classAttendanceRecords && classAttendanceRecords.length > 0) {
        const rec = classAttendanceRecords.find((att) => {
          const aDate = String(att.date || '').slice(0, 10).trim();
          if (aDate !== cleanDate && att.date !== date) return false;
          const attIds = [
            att.studentId != null
              ? (typeof att.studentId === 'object' ? [att.studentId._id, att.studentId.id] : [att.studentId])
              : [],
            att.studentRef != null
              ? (typeof att.studentRef === 'object' ? [att.studentRef._id, att.studentRef.id] : [att.studentRef])
              : [],
          ].flat().filter(Boolean).map(String);
          return possibleIds.some((pId) => attIds.includes(pId));
        });

        if (rec) {
          const noteText = rec.note || rec.evaluation || '';
          const scoreStr = rec.score != null && rec.score !== '' ? String(rec.score) : '';
          return {
            status: rec.status || 'Có mặt',
            score: scoreStr,
            evaluation: noteText,
            note: noteText,
            checkInTime: rec.checkInTime || '',
          };
        }
      }

      return { status: '', score: '', evaluation: '', note: '' };
    },
    [cellChanges, originalRecordsMap, classAttendanceRecords]
  );

  // Cell helper: Check if cell is dirty
  const isCellDirty = useCallback(
    (studentId, date, student = null) => {
      const cleanDate = String(date || '').slice(0, 10).trim();
      const possibleIds = [
        studentId,
        student?.id,
        student?._id,
      ].filter((x) => x !== null && x !== undefined && x !== '').map(String);

      for (const id of possibleIds) {
        if (cellChanges[`${id}__${cleanDate}`]) return true;
        if (date && date !== cleanDate && cellChanges[`${id}__${date}`]) return true;
      }
      return false;
    },
    [cellChanges]
  );

  // Handle cell status change
  const handleCellStatusChange = (studentId, date, newStatus, student = null) => {
    const cleanDate = String(date || '').slice(0, 10).trim();
    const primaryId = student?.id ?? studentId;
    const key = `${primaryId}__${cleanDate}`;
    const orig = originalRecordsMap[key] || {};
    const cur = getCellValue(studentId, cleanDate, student);

    const updated = {
      ...cur,
      status: newStatus,
    };

    const origNote = orig.note || orig.evaluation || '';
    const curNote = cur.note || cur.evaluation || '';

    if (
      orig.status === newStatus &&
      (orig.score ?? '') === (cur.score ?? '') &&
      origNote === curNote
    ) {
      setCellChanges((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    } else {
      setCellChanges((prev) => ({
        ...prev,
        [key]: updated,
      }));
    }

    setActiveCellPopover(null);
  };

  // Cycle status on double click
  const handleCycleStatus = (studentId, date, student = null) => {
    const cur = getCellValue(studentId, date, student);
    const order = ['Có mặt', 'Đi muộn', 'Vắng có phép', 'Vắng mặt', 'Chưa điểm danh'];
    const currentIdx = order.indexOf(cur.status);
    const nextStatus = order[(currentIdx + 1) % order.length];
    handleCellStatusChange(studentId, date, nextStatus, student);
  };

  // Mark all present for active session
  const handleMarkAllPresentForSession = (date) => {
    if (students.length === 0) return;
    const cleanDate = String(date || '').slice(0, 10).trim();
    const nextChanges = { ...cellChanges };

    students.forEach((s) => {
      const sId = s.id ?? s._id;
      const key = `${sId}__${cleanDate}`;
      const cur = getCellValue(sId, cleanDate, s);
      nextChanges[key] = {
        ...cur,
        status: 'Có mặt',
      };
    });

    setCellChanges(nextChanges);
    toast.success(`Đã đánh dấu Có mặt cho toàn bộ ${students.length} sinh viên buổi này`);
  };

  // Open note/eval modal with guaranteed binding of existing status, score, evaluation, and note
  const openNoteModal = useCallback(
    (student, session) => {
      if (!student) return;
      const dateStr =
        typeof session === 'object' && session !== null
          ? session.date || session.sessionDate || ''
          : String(session || '');

      const studentId = student.id ?? student._id;
      const val = getCellValue(studentId, dateStr, student);

      const oldStatus = val.status || 'Có mặt';
      const oldScore = val.score != null && val.score !== '' ? String(val.score) : '';
      const oldNote = val.note || val.evaluation || '';

      setEvalModal({
        isOpen: true,
        student,
        date: dateStr,
        score: oldScore,
        evaluation: oldNote,
        note: oldNote,
        status: oldStatus,
      });
      setActiveCellPopover(null);
    },
    [getCellValue]
  );

  // Backward-compatible alias as requested
  const handleOpenModal = openNoteModal;

  // Save note/eval modal
  const handleSaveNoteModal = () => {
    if (!evalModal.student || !evalModal.date) return;
    const { student, date, score, note, evaluation, status } = evalModal;
    const noteContent = (note || evaluation || '').trim();
    const studentId = student.id ?? student._id;
    const cleanDate = String(date).slice(0, 10).trim();
    const key = `${studentId}__${cleanDate}`;

    setCellChanges((prev) => ({
      ...prev,
      [key]: {
        status: status || 'Có mặt',
        score: score !== '' && score != null ? String(score) : '',
        evaluation: noteContent,
        note: noteContent,
      },
    }));

    setEvalModal({ isOpen: false, student: null, date: '', score: '', evaluation: '', note: '', status: 'Có mặt' });
    toast.success(`Đã lưu nhận xét cho ${student.hoTen}`);
  };

  // Save all modified changes for this class
  const dirtyCount = Object.keys(cellChanges).length;

  const handleSaveMatrix = async () => {
    if (dirtyCount === 0) {
      toast.info('Không có thay đổi nào cần lưu');
      return;
    }

    try {
      setSaving(true);

      const changedByDate = {};
      Object.entries(cellChanges).forEach(([key, val]) => {
        const [sId, date] = key.split('__');
        if (!changedByDate[date]) changedByDate[date] = [];
        const studentObj = students.find((s) => String(s.id) === String(sId) || String(s._id) === String(sId));
        const numericId = Number(studentObj?.id || sId);

        changedByDate[date].push({
          studentId: !isNaN(numericId) && numericId !== 0 ? numericId : sId,
          studentName: studentObj?.hoTen || '',
          studentEmail: studentObj?.email || '',
          studentAvatar: typeof studentObj?.avatar === 'string' ? studentObj?.avatar : studentObj?.avatar?.url || '',
          status: val.status || 'Có mặt',
          score: val.score !== '' && val.score != null ? Number(val.score) : null,
          evaluation: val.evaluation || val.note || '',
          note: val.note || val.evaluation || '',
        });
      });

      const savePromises = Object.entries(changedByDate).map(async ([date, recs]) => {
        const ses = sessions.find((s) => s.date === date);
        const shiftId = ses?.shiftId || '1';
        return attendanceApi.saveBulk({
          regId: classId,
          classId: classId,
          courseId: classItem.courseId || '',
          courseName: classItem.courseName || '',
          date,
          shiftId,
          shiftLabel: getShiftLabel(shiftId),
          teacherId: teacherProfile?.id || teacherUser?._id,
          teacherName: teacherProfile?.hoTen || teacherUser?.hoTen,
          records: recs,
        });
      });

      await Promise.all(savePromises);

      toast.success(`Đã lưu thành công ${dirtyCount} thay đổi điểm danh!`);
      setCellChanges({});
      await loadAttendance();

      window.dispatchEvent(
        new CustomEvent('edumin_attendance_updated', {
          detail: { courseName: classItem.courseName, status: 'Đã hoàn tất điểm danh ma trận' },
        })
      );
    } catch (err) {
      toast.error(err.message || 'Lỗi khi lưu điểm danh ma trận');
    } finally {
      setSaving(false);
    }
  };

  // Revert changes with modal
  const handleRevertChanges = () => {
    if (dirtyCount === 0) return;
    setConfirmRevertOpen(true);
  };

  const handleConfirmRevert = () => {
    setCellChanges({});
    setConfirmRevertOpen(false);
    toast.info('Đã hủy bỏ toàn bộ các thay đổi chưa lưu');
  };

  // Enriched students with calculated attendance rates
  const enrichedStudents = useMemo(() => {
    return students.map((s, idx) => {
      let present = 0;
      let late = 0;
      let excused = 0;
      let absent = 0;
      let evaluatedCount = 0;
      let scoreSum = 0;

      sessions.forEach((ses) => {
        const val = getCellValue(s.id, ses.date);
        if (val.status === 'Có mặt') present += 1;
        else if (val.status === 'Đi muộn') late += 1;
        else if (val.status === 'Vắng có phép') excused += 1;
        else if (val.status === 'Vắng mặt') absent += 1;

        if (val.score !== '' && val.score != null) {
          scoreSum += Number(val.score);
          evaluatedCount += 1;
        }
      });

      const totalRecorded = present + late + excused + absent;
      const rate = totalRecorded > 0 ? Math.round(((present + late * 0.5) / totalRecorded) * 100) : 100;
      const isAtRisk = totalRecorded >= 3 && rate < 80;
      const avgScore = evaluatedCount > 0 ? (scoreSum / evaluatedCount).toFixed(1) : null;

      return {
        ...s,
        index: idx + 1,
        present,
        late,
        excused,
        absent,
        totalRecorded,
        rate,
        isAtRisk,
        avgScore,
      };
    });
  }, [students, sessions, getCellValue]);

  // Filtered students by search & risk
  const filteredStudents = useMemo(() => {
    return enrichedStudents.filter((s) => {
      if (debouncedStudentSearch) {
        const q = debouncedStudentSearch.toLowerCase();
        const matches =
          (s.hoTen || '').toLowerCase().includes(q) ||
          String(s.id || '').toLowerCase().includes(q) ||
          (s.className || '').toLowerCase().includes(q);
        if (!matches) return false;
      }

      if (riskFilter === 'at_risk' && !s.isAtRisk) return false;
      if (riskFilter === 'perfect' && s.rate < 100) return false;

      return true;
    });
  }, [enrichedStudents, debouncedStudentSearch, riskFilter]);

  // Class statistics
  const classStats = useMemo(() => {
    if (enrichedStudents.length === 0) return { total: 0, avgRate: 100, atRiskCount: 0 };
    const total = enrichedStudents.length;
    const avgRate = Math.round(enrichedStudents.reduce((sum, s) => sum + s.rate, 0) / total);
    const atRiskCount = enrichedStudents.filter((s) => s.isAtRisk).length;
    return { total, avgRate, atRiskCount };
  }, [enrichedStudents]);

  // Export Excel
  const handleExportExcel = async () => {
    if (students.length === 0) return toast.error('Không có dữ liệu để xuất');
    try {
      const rows = filteredStudents.map((s) => {
        const row = {
          STT: s.index,
          'Mã sinh viên': formatStudentCode(s.id),
          'Họ và tên': s.hoTen,
          'Lớp sinh hoạt': s.className || '',
          'Chuyên cần (%)': `${s.rate}%`,
          'Có mặt': s.present,
          'Đi muộn': s.late,
          'Vắng có phép': s.excused,
          'Vắng không phép': s.absent,
        };

        sessions.forEach((ses) => {
          const val = getCellValue(s.id, ses.date);
          const colName = `Buổi ${ses.sessionNumber} (${ses.shortDate})`;
          row[colName] = val.status || '-';
        });

        return row;
      });

      await exportSheet(rows, {
        fileName: `Diem_danh_${classId}_${getTodayDateString()}.xlsx`,
        sheetName: 'Diem_Danh_Ma_Tran',
      });
      toast.success('Đã xuất file Excel bảng điểm danh thành công!');
    } catch {
      toast.error('Lỗi khi xuất file Excel');
    }
  };

  const rate = classStats.avgRate;
  let rateBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  let rateDotClass = 'bg-emerald-500';
  if (rate < 50) {
    rateBadgeClass = 'bg-rose-50 text-rose-700 border-rose-200';
    rateDotClass = 'bg-rose-500';
  } else if (rate < 80) {
    rateBadgeClass = 'bg-amber-50 text-amber-700 border-amber-200';
    rateDotClass = 'bg-amber-500';
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-xs transition-all duration-200 overflow-hidden">
      {/* ============================================================== */}
      {/* CARD HEADER (ACCORDION TRIGGER)                                */}
      {/* ============================================================== */}
      <div
        onClick={onToggleExpand}
        className="p-5 cursor-pointer select-none bg-gradient-to-r from-white via-white to-slate-50/50 hover:bg-slate-50/80 transition-colors"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Left: Class Title, Code & Schedule Badges */}
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
              <i className="fas fa-graduation-cap text-base" />
            </div>
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-base font-bold text-slate-900 leading-snug">
                  {classItem.courseName || classItem.name}
                </h4>
                <span className="font-mono text-xs font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-100">
                  {classId}
                </span>
                {classItem.className && classItem.className !== classId && (
                  <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                    {classItem.className}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                {classItem.schedules?.length > 0 && (
                  <ScheduleRoomBadge
                    schedules={classItem.schedules}
                    room={classItem.room}
                    studyStart={classItem.studyStart}
                    studyEnd={classItem.studyEnd}
                  />
                )}
                {classItem.room && !classItem.schedules?.length && (
                  <span className="inline-flex items-center gap-1 text-slate-600 font-medium">
                    <i className="fas fa-door-open text-slate-400" />
                    <span>Phòng {classItem.room}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: Quick Stats & Accordion Action Button */}
          <div className="flex flex-wrap items-center justify-between lg:justify-end gap-3 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100">
            {/* Attendance & Class Summary Pills */}
            <div className="flex items-center gap-2 text-xs">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl font-bold border ${rateBadgeClass}`}>
                <span className={`w-2 h-2 rounded-full ${rateDotClass}`} />
                <span>Chuyên cần: {rate}%</span>
              </span>

              <div className="inline-flex items-center gap-2 bg-slate-100/80 border border-slate-200/60 px-3 py-1 rounded-xl text-xs">
                <span className="text-slate-600" title="Sĩ số sinh viên">
                  <strong className="text-slate-900">{classStats.total}</strong> SV
                </span>
                <span className="text-slate-300">|</span>
                <span className="text-indigo-700 font-semibold" title="Số buổi học theo lịch">
                  <i className="fas fa-calendar-days text-[10px] mr-1" />
                  {sessions.length} buổi
                </span>
                {classStats.atRiskCount > 0 && (
                  <>
                    <span className="text-slate-300">|</span>
                    <span className="text-rose-700 font-bold" title="Sinh viên có nguy cơ cấm thi (< 80%)">
                      <i className="fas fa-triangle-exclamation text-[10px] mr-1 text-rose-500" />
                      {classStats.atRiskCount} nguy cơ
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Expand / Collapse Button */}
            <button
              type="button"
              aria-expanded={isExpanded}
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand();
              }}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer ${
                isExpanded
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                  : 'bg-white text-indigo-600 border border-indigo-200 hover:bg-indigo-50'
              }`}
            >
              <span>{isExpanded ? 'Thu gọn ma trận' : 'Mở ma trận điểm danh'}</span>
              <i className={`fas fa-chevron-down text-[10px] transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* CARD BODY: COLLAPSIBLE LMS MATRIX ATTENDANCE GRID              */}
      {/* ============================================================== */}
      {isExpanded && (
        <div className="border-t border-slate-100 bg-slate-50/40 p-4 sm:p-5 space-y-4">
          {/* Mini Toolbar for this class */}
          <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Search Student */}
            <div className="relative flex-1 max-w-md">
              <i className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
              <input
                type="text"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="Tìm sinh viên theo tên hoặc mã sinh viên..."
                className="w-full pl-9 pr-8 py-2 rounded-xl text-xs bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
              />
              {studentSearch && (
                <button
                  type="button"
                  onClick={() => setStudentSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  <i className="fas fa-times-circle" />
                </button>
              )}
            </div>

            {/* Quick Actions & Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={riskFilter}
                onChange={(e) => setRiskFilter(e.target.value)}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 border border-slate-200 text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition cursor-pointer"
              >
                <option value="all">Tất cả sinh viên ({students.length})</option>
                <option value="at_risk">Nguy cơ cấm thi (&lt; 80%)</option>
                <option value="perfect">Chuyên cần 100%</option>
              </select>

              {/* Active session mark all present shortcut */}
              {activeSessionDate && (
                <button
                  type="button"
                  onClick={() => handleMarkAllPresentForSession(activeSessionDate)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold border border-emerald-200 transition active:scale-95 cursor-pointer shadow-2xs"
                  title="Đánh dấu tất cả sinh viên có mặt ở buổi học đang chọn"
                >
                  <i className="fas fa-check-double text-[11px]" />
                  <span>Cả lớp có mặt</span>
                </button>
              )}


              {/* Export Excel Button */}
              <button
                type="button"
                onClick={handleExportExcel}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition shadow-2xs active:scale-95 cursor-pointer"
                title="Xuất file Excel bảng điểm danh của lớp này"
              >
                <i className="fas fa-file-excel text-emerald-600 text-xs" />
                <span>Xuất Excel</span>
              </button>
            </div>
          </div>

          {/* Matrix Grid Table Container */}
          {studentsLoading || loadingClassRecords ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-16 flex justify-center">
              <Spinner label="Đang tải ma trận điểm danh lớp..." />
            </div>
          ) : students.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-16 text-center text-slate-400 space-y-2">
              <i className="fas fa-user-slash text-3xl text-slate-300" />
              <p className="text-sm font-bold text-slate-600">Lớp học phần này hiện chưa có sinh viên đăng ký.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
              <div className="overflow-x-auto custom-scrollbar max-h-[600px]">
                <table className="w-full border-collapse text-left text-xs">
                  {/* Table Head: Session Columns */}
                  <thead className="bg-slate-50/95 sticky top-0 z-30 border-b border-slate-200/90 backdrop-blur-xs select-none">
                    <tr>
                      {/* Fixed Left Column 1: Index */}
                      <th className="px-3 py-3 w-10 text-center font-bold text-slate-500 bg-slate-50 sticky left-0 z-40 border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                        #
                      </th>

                      {/* Fixed Left Column 2: Student Info */}
                      <th className="px-4 py-3 min-w-[220px] max-w-[240px] font-bold text-slate-700 bg-slate-50 sticky left-10 z-40 border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                        Sinh viên
                      </th>

                      {/* Fixed Left Column 3: Overall Rate */}
                      <th className="px-3 py-3 w-20 text-center font-bold text-slate-600 bg-slate-50 sticky left-[280px] z-40 border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                        Tỉ lệ %
                      </th>

                      {/* Session Columns */}
                      {sessions.map((ses) => {
                        const isActive = ses.date === activeSessionDate;

                        return (
                          <th
                            key={ses.date}
                            onClick={() => setActiveSessionDate(ses.date)}
                            className={`px-2.5 py-2.5 min-w-[76px] max-w-[88px] text-center border-r border-slate-200/80 transition-colors cursor-pointer group ${
                              isActive
                                ? 'bg-indigo-600 text-white font-black shadow-md'
                                : 'hover:bg-slate-100 text-slate-700'
                            }`}
                            title={`Buổi ${ses.sessionNumber} - ${ses.date} (${ses.dayName || ses.dayShort}) · ${ses.shiftLabel}`}
                          >
                            <div className="flex flex-col items-center justify-center space-y-0.5">
                              {/* Session Number */}
                              <span
                                className={`text-[11px] font-black tracking-tight ${
                                  isActive ? 'text-white' : 'text-slate-800'
                                }`}
                              >
                                #{ses.sessionNumber}
                              </span>

                              {/* Date */}
                              <span
                                className={`text-[10px] font-bold ${
                                  isActive ? 'text-indigo-100' : 'text-slate-500 font-mono'
                                }`}
                              >
                                {ses.shortDate}
                              </span>

                              {/* Day Label & Shift */}
                              <span
                                className={`text-[9px] uppercase px-1 py-0.2 rounded font-semibold ${
                                  isActive
                                    ? 'bg-indigo-700 text-indigo-100'
                                    : ses.isToday
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'text-slate-400'
                                }`}
                              >
                                {ses.isToday ? 'Hôm nay' : ses.dayShort || ses.dayName}
                              </span>
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>

                  {/* Table Body: Students & Matrix Cells */}
                  <tbody className="divide-y divide-slate-100">
                    {filteredStudents.map((student) => {
                      return (
                        <tr key={student.id} className="hover:bg-slate-50/70 transition-colors group">
                          {/* STT */}
                          <td className="px-3 py-2.5 text-center font-bold text-slate-400 bg-white group-hover:bg-slate-50/70 sticky left-0 z-20 border-r border-slate-200/80 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                            {student.index}
                          </td>

                          {/* Student Info */}
                          <td className="px-4 py-2.5 bg-white group-hover:bg-slate-50/70 sticky left-10 z-20 border-r border-slate-200/80 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <Avatar
                                src={typeof student.avatar === 'string' ? student.avatar : student.avatar?.url}
                                name={student.hoTen}
                                size={28}
                              />
                              <div className="min-w-0">
                                <h5 className="font-bold text-slate-800 text-xs truncate max-w-[150px]">
                                  {student.hoTen}
                                </h5>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="font-mono text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1 rounded">
                                    {formatStudentCode(student.id)}
                                  </span>
                                  {student.className && (
                                    <span className="text-[10px] text-slate-400 truncate max-w-[80px]">
                                      {student.className}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Rate Badge */}
                          <td className="px-3 py-2.5 text-center bg-white group-hover:bg-slate-50/70 sticky left-[280px] z-20 border-r border-slate-200/80 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                            <span
                              className={`inline-block px-1.5 py-0.5 rounded-md text-[10px] font-black border ${
                                student.rate >= 90
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : student.rate >= 80
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse'
                              }`}
                              title={`Chuyên cần: ${student.rate}% (${student.present} có mặt, ${student.late} muộn, ${student.absent} vắng)`}
                            >
                              {student.rate}%
                            </span>
                          </td>

                          {/* Attendance Matrix Cells */}
                          {sessions.map((ses) => {
                            const val = getCellValue(student.id, ses.date);
                            const dirty = isCellDirty(student.id, ses.date);
                            const status = val.status || 'Chưa điểm danh';
                            const meta = MATRIX_STATUS_MAP[status] || MATRIX_STATUS_MAP['Chưa điểm danh'];
                            const hasNote = Boolean(val.note || val.evaluation || val.score);
                            const isActiveCol = ses.date === activeSessionDate;

                            return (
                              <td
                                key={ses.date}
                                className={`px-1.5 py-2 text-center border-r border-slate-100 transition-colors ${
                                  isActiveCol ? 'bg-indigo-50/20' : ''
                                }`}
                              >
                                <div className="relative flex items-center justify-center">
                                  {/* Clickable Cell Button */}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveCellPopover({
                                        studentId: student.id,
                                        date: ses.date,
                                        student,
                                        anchorEl: e.currentTarget,
                                      });
                                    }}
                                    onDoubleClick={(e) => {
                                      e.stopPropagation();
                                      handleCycleStatus(student.id, ses.date);
                                    }}
                                    className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm border transition-all duration-150 cursor-pointer shadow-2xs relative active:scale-90 ${
                                      meta.color
                                    } ${dirty ? 'ring-2 ring-indigo-500 ring-offset-1 font-black shadow-sm' : ''}`}
                                    title={`Sinh viên: ${student.hoTen}\nBuổi #${ses.sessionNumber} (${ses.shortDate})\nTrạng thái: ${meta.label}${
                                      val.note ? `\nGhi chú: ${val.note}` : ''
                                    }${val.score ? `\nĐiểm: ${val.score}/10` : ''}`}
                                  >
                                    {/* Icon */}
                                    <i className={`fas ${meta.icon} text-xs`} />

                                    {/* Note indicator */}
                                    {hasNote && (
                                      <span
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openNoteModal(student, ses.date);
                                        }}
                                        className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[8px] shadow-xs hover:scale-125 transition-transform cursor-pointer z-10"
                                        title={`Có ghi chú: ${val.note || val.evaluation || `Điểm ${val.score}`} (Bấm để xem/sửa)`}
                                      >
                                        <i className="fas fa-comment text-[7px]" />
                                      </span>
                                    )}

                                    {/* Unsaved indicator dot */}
                                    {dirty && (
                                      <span className="absolute -bottom-1 -left-1 w-2.5 h-2.5 rounded-full bg-indigo-600 border border-white" />
                                    )}
                                  </button>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Popover for Cell Status Editing */}
          {activeCellPopover && (
            <div
              ref={popoverRef}
              className="fixed z-50 bg-white rounded-2xl border border-slate-200 shadow-xl p-3 space-y-2 animate-in fade-in zoom-in-95 duration-100"
              style={{
                top: Math.min(
                  activeCellPopover.anchorEl.getBoundingClientRect().bottom + 8,
                  window.innerHeight - 200
                ),
                left: Math.max(
                  10,
                  Math.min(
                    activeCellPopover.anchorEl.getBoundingClientRect().left - 80,
                    window.innerWidth - 280
                  )
                ),
              }}
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 text-xs">
                <span className="font-bold text-slate-800 truncate max-w-[180px]">
                  {activeCellPopover.student?.hoTen}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {formatAttendanceDate(activeCellPopover.date)}
                </span>
              </div>

              {/* Status Action Buttons */}
              <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={() =>
                    handleCellStatusChange(activeCellPopover.studentId, activeCellPopover.date, 'Có mặt')
                  }
                  className="px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <i className="fas fa-check text-emerald-600 text-[11px]" />
                  <span>Có mặt</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleCellStatusChange(activeCellPopover.studentId, activeCellPopover.date, 'Đi muộn')
                  }
                  className="px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold border border-amber-200 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <i className="fas fa-clock text-amber-600 text-[11px]" />
                  <span>Đi muộn</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleCellStatusChange(activeCellPopover.studentId, activeCellPopover.date, 'Vắng có phép')
                  }
                  className="px-2.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-bold border border-blue-200 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <i className="fas fa-envelope-open-text text-blue-600 text-[11px]" />
                  <span>Có phép</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleCellStatusChange(activeCellPopover.studentId, activeCellPopover.date, 'Vắng mặt')
                  }
                  className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-bold border border-rose-200 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <i className="fas fa-xmark text-rose-600 text-[11px]" />
                  <span>Vắng mặt</span>
                </button>
              </div>

              {/* Note / Evaluation Action */}
              <div className="pt-1 border-t border-slate-100 flex items-center justify-between gap-1">
                <button
                  type="button"
                  onClick={() => openNoteModal(activeCellPopover.student, activeCellPopover.date)}
                  className="w-full py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <i className="fas fa-comment-dots text-[10px]" />
                  <span>Ghi chú / Đánh giá</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleCellStatusChange(activeCellPopover.studentId, activeCellPopover.date, 'Chưa điểm danh')
                  }
                  className="px-2 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 text-[11px] font-semibold transition cursor-pointer"
                  title="Đặt lại trạng thái chưa điểm danh"
                >
                  <i className="fas fa-rotate-left text-[10px]" />
                </button>
              </div>
            </div>
          )}

          {/* Integrated Class Save & Legend Bar */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-3.5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Legend */}
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="font-bold text-slate-500">Chú giải:</span>
              <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                <i className="fas fa-check text-xs" /> Có mặt
              </span>
              <span className="inline-flex items-center gap-1 text-amber-700 font-semibold">
                <i className="fas fa-clock text-xs" /> Đi muộn
              </span>
              <span className="inline-flex items-center gap-1 text-blue-700 font-semibold">
                <i className="fas fa-envelope-open-text text-xs" /> Vắng phép
              </span>
              <span className="inline-flex items-center gap-1 text-rose-700 font-semibold">
                <i className="fas fa-xmark text-xs" /> Vắng không phép
              </span>
              <span className="inline-flex items-center gap-1 text-amber-600 font-semibold">
                <i className="fas fa-comment text-xs" /> Ghi chú
              </span>
            </div>

            {/* Dirty Changes Count & Save Actions */}
            <div className="flex items-center justify-end gap-3 shrink-0">
              {dirtyCount > 0 ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300 animate-pulse">
                  <i className="fas fa-circle-exclamation text-amber-500 text-[11px]" />
                  <span>{dirtyCount} thay đổi chưa lưu</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <i className="fas fa-circle-check text-emerald-500 text-[11px]" />
                  <span>Đã lưu toàn bộ</span>
                </span>
              )}

              {dirtyCount > 0 && (
                <button
                  type="button"
                  onClick={handleRevertChanges}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
                >
                  Hủy thay đổi
                </button>
              )}

              {/* Primary Save Button */}
              <button
                type="button"
                onClick={handleSaveMatrix}
                disabled={saving || dirtyCount === 0}
                className={`px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-md cursor-pointer ${
                  dirtyCount > 0
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200 active:scale-95'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                }`}
              >
                {saving ? (
                  <>
                    <i className="fas fa-spinner fa-spin text-xs" />
                    <span>Đang lưu...</span>
                  </>
                ) : (
                  <>
                    <i className="fas fa-floppy-disk text-xs" />
                    <span>Lưu điểm danh ({dirtyCount})</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Note / Evaluation Modal */}
          <Modal
            open={evalModal.isOpen}
            onClose={() => setEvalModal({ isOpen: false, student: null, date: '', score: '', evaluation: '', note: '', status: 'Có mặt' })}
            title={`Ghi chú & Đánh giá buổi học — ${evalModal.student?.hoTen || ''}`}
            size="md"
          >
            <div className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-400">Buổi học:</span>{' '}
                  <strong className="text-slate-700">{formatAttendanceDate(evalModal.date)}</strong>
                </div>
                <div>
                  <span className="text-slate-400">Trạng thái:</span>{' '}
                  <strong className="text-indigo-600">{evalModal.status}</strong>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Trạng thái điểm danh</label>
                <select
                  value={evalModal.status}
                  onChange={(e) => setEvalModal((prev) => ({ ...prev, status: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                >
                  {ATTENDANCE_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Điểm đánh giá buổi học (Thang điểm 10)</label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="0.5"
                  value={evalModal.score}
                  onChange={(e) => setEvalModal((prev) => ({ ...prev, score: e.target.value }))}
                  placeholder="VD: 9.0 (Không bắt buộc)"
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Ghi chú & Nhận xét</label>
                <textarea
                  rows="3"
                  value={evalModal.note || ''}
                  onChange={(e) =>
                    setEvalModal((prev) => ({
                      ...prev,
                      note: e.target.value,
                      evaluation: e.target.value,
                    }))
                  }
                  placeholder="Nhập ghi chú cho buổi học (VD: Đi muộn 15p, chuẩn bị bài tốt...)"
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Quick Tags */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1.5 uppercase">Mẫu nhận xét nhanh</label>
                <div className="flex flex-wrap gap-1.5">
                  {EVALUATION_QUICK_TAGS.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() =>
                        setEvalModal((prev) => {
                          const cur = prev.note || prev.evaluation || '';
                          const nextText = cur ? `${cur}; ${tag}` : tag;
                          return {
                            ...prev,
                            note: nextText,
                            evaluation: nextText,
                          };
                        })
                      }
                      className="px-2 py-1 rounded-lg text-[11px] font-medium bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 transition cursor-pointer"
                    >
                      +{tag}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEvalModal({ isOpen: false, student: null, date: '', score: '', evaluation: '', note: '', status: 'Có mặt' })}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleSaveNoteModal}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition shadow-2xs cursor-pointer"
                >
                  Áp dụng
                </button>
              </div>
            </div>
          </Modal>

          {/* Confirm Discard/Revert Changes Modal */}
          <Modal
            open={confirmRevertOpen}
            onClose={() => setConfirmRevertOpen(false)}
            title="Xác nhận hủy thay đổi điểm danh"
            size="sm"
          >
            <div className="space-y-4 pt-1">
              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-50 border border-amber-200">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <i className="fas fa-triangle-exclamation text-sm" />
                </div>
                <div className="text-xs text-amber-900 leading-relaxed">
                  <p className="font-bold mb-0.5">Hủy bỏ các thay đổi chưa lưu?</p>
                  <p className="text-amber-800">
                    Bạn đang có <strong className="font-bold text-amber-950">{dirtyCount}</strong> thay đổi điểm danh chưa được lưu. Thao tác này sẽ hoàn tác toàn bộ dữ liệu về trạng thái gần nhất đã lưu trong hệ thống.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setConfirmRevertOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition cursor-pointer"
                >
                  Giữ lại thay đổi
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRevert}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 shadow-sm transition cursor-pointer flex items-center gap-1.5"
                >
                  <i className="fas fa-rotate-left text-[11px]" />
                  <span>Xác nhận hủy bỏ</span>
                </button>
              </div>
            </div>
          </Modal>

          {/* Student Attendance History Modal */}
          <Modal
            open={historyModal.isOpen}
            onClose={() => setHistoryModal({ isOpen: false, student: null })}
            title={`Lịch sử điểm danh — ${historyModal.student?.hoTen || ''}`}
            size="md"
          >
            {historyModal.student && (
              <div className="space-y-4 max-h-[480px] overflow-y-auto custom-scrollbar">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">Mã sinh viên: {formatStudentCode(historyModal.student.id)}</span>
                  <span className="font-bold text-indigo-700">Chuyên cần: {historyModal.student.rate}%</span>
                </div>

                <div className="space-y-2">
                  {sessions.map((ses) => {
                    const val = getCellValue(historyModal.student.id, ses.date);
                    const status = val.status || 'Chưa điểm danh';
                    const meta = MATRIX_STATUS_MAP[status] || MATRIX_STATUS_MAP['Chưa điểm danh'];

                    return (
                      <div
                        key={ses.date}
                        className="p-3 rounded-xl border border-slate-100 bg-white flex items-center justify-between text-xs"
                      >
                        <div>
                          <p className="font-bold text-slate-800">
                            Buổi #{ses.sessionNumber} · {formatAttendanceDate(ses.date)}
                          </p>
                          <p className="text-[11px] text-slate-400">{ses.shiftLabel}</p>
                          {val.note && <p className="text-[11px] text-amber-700 mt-1 italic">Ghi chú: {val.note}</p>}
                        </div>

                        <div className="flex items-center gap-2">
                          {val.score && (
                            <span className="font-bold text-indigo-600 text-xs bg-indigo-50 px-2 py-0.5 rounded">
                              {val.score}/10
                            </span>
                          )}
                          <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${meta.badge}`}>
                            {meta.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </Modal>
        </div>
      )}
    </div>
  );
}

/**
 * Teacher Attendance Main Component
 * Card-based Accordion representation per course class with schedule-aligned matrix grid
 */
export function TeacherAttendance() {
  const { user, profile } = useAuth();
  const params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();

  // Extract class ID from route param (:classId, :id), search param (?classId, ?id, ?regId), or navigation state
  const rawParamId =
    params.classId ||
    params.id ||
    searchParams.get('classId') ||
    searchParams.get('id') ||
    searchParams.get('regId') ||
    location.state?.classId ||
    location.state?.id ||
    '';

  const routeClassId = useMemo(() => {
    if (!rawParamId || rawParamId === 'undefined' || rawParamId === 'null') return '';
    return String(rawParamId).trim();
  }, [rawParamId]);

  // View tabs: 'matrix' (Ma trận điểm danh thẻ lớp) | 'classes' (Tổng quan lớp phụ trách)
  const [activeTab, setActiveTab] = useState('matrix');

  // Classes taught by teacher
  const { data: classData, isLoading: classesLoading, isPending: classesPending } = useMyTeacherClasses();
  const isTeacherClassesLoading = classesPending || classesLoading || !classData;
  const classes = useMemo(() => classData?.data || [], [classData]);

  // Flexible helper to match a class item against a target identifier (by class code id or Mongo _id)
  const isClassMatching = useCallback((cls, targetId) => {
    if (!cls || !targetId || targetId === 'all') return false;
    const t = String(targetId).trim().toLowerCase();
    const cId = String(cls.id || '').trim().toLowerCase();
    const cMongoId = String(cls._id || '').trim().toLowerCase();
    return cId === t || cMongoId === t;
  }, []);

  // Selected filter class ID: 'all' or specific class ID
  const [filterClassId, setFilterClassId] = useState(() => routeClassId || 'all');

  // Expanded card keys: Set of class IDs
  const [expandedClassIds, setExpandedClassIds] = useState(() => new Set());

  // Auto-expand and sync filter when classes data loads or route param changes
  const hasInitializedRef = useRef(false);
  useEffect(() => {
    if (classes.length > 0) {
      if (routeClassId && routeClassId !== 'all') {
        const found = classes.find((c) => isClassMatching(c, routeClassId));
        const resolvedId = found ? (found.id || found._id) : routeClassId;
        setFilterClassId(resolvedId);
        setExpandedClassIds(new Set([resolvedId]));
      } else if (!hasInitializedRef.current) {
        hasInitializedRef.current = true;
        const firstId = classes[0].id || classes[0]._id;
        if (firstId) {
          setExpandedClassIds(new Set([firstId]));
        }
      }
    }
  }, [classes, routeClassId, isClassMatching]);

  // Handle class filter dropdown change
  const handleFilterClassChange = (cId) => {
    setFilterClassId(cId);
    if (cId !== 'all') {
      setExpandedClassIds(new Set([cId]));
      setSearchParams({ classId: cId });
    } else {
      setExpandedClassIds(new Set(classes.map((c) => c.id || c._id)));
      setSearchParams({});
    }
  };

  // Toggle single class card expansion
  const toggleExpandClass = (cId) => {
    setExpandedClassIds((prev) => {
      const next = new Set(prev);
      if (next.has(cId)) {
        next.delete(cId);
      } else {
        next.add(cId);
      }
      return next;
    });
  };

  // Expand / collapse all cards
  const expandAll = () => {
    setExpandedClassIds(new Set(classes.map((c) => c.id || c._id)));
  };

  const collapseAll = () => {
    setExpandedClassIds(new Set());
  };

  // Filtered classes list
  const displayedClasses = useMemo(() => {
    if (!filterClassId || filterClassId === 'all') return classes;
    return classes.filter((c) => isClassMatching(c, filterClassId));
  }, [classes, filterClassId, isClassMatching]);

  // Selected value for the dropdown selector
  const selectedDropdownValue = useMemo(() => {
    if (!filterClassId || filterClassId === 'all') return 'all';
    const found = classes.find((c) => isClassMatching(c, filterClassId));
    return found ? (found.id || found._id) : filterClassId;
  }, [classes, filterClassId, isClassMatching]);

  if (isTeacherClassesLoading && classes.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-16 flex flex-col items-center justify-center gap-3">
        <Spinner />
        <span className="text-xs font-semibold text-slate-500 animate-pulse">
          Đang tải dữ liệu Điểm danh & Chuyên cần...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Page Header */}
      <PageHeader
        title="Điểm danh & Chuyên cần"
        subtitle="Quản lý điểm danh theo từng lớp học phần với ma trận chuyên cần đồng bộ 100% thời khóa biểu"
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Class Selector Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Lớp học phần:</span>
              <select
                value={selectedDropdownValue}
                onChange={(e) => handleFilterClassChange(e.target.value)}
                className="px-3 py-2 rounded-xl text-xs font-bold bg-white border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition shadow-2xs cursor-pointer max-w-[280px] truncate"
              >
                <option value="all">Tất cả lớp phụ trách ({classes.length})</option>
                {classes.map((c) => {
                  const val = c.id || c._id;
                  return (
                    <option key={val} value={val}>
                      {c.courseName || c.name} · {c.id}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
        }
      />

      {/* Overview Toolbar & View Switcher */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('matrix')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'matrix'
                ? 'bg-white text-indigo-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <i className="fas fa-layer-group text-[11px]" />
            <span>Ma trận theo thẻ lớp ({classes.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('classes')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'classes'
                ? 'bg-white text-indigo-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <i className="fas fa-grid-2 text-[11px]" />
            <span>Tổng quan các lớp</span>
          </button>
        </div>

        {/* Accordion Expand / Collapse All Controls */}
        {activeTab === 'matrix' && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={expandAll}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition cursor-pointer"
              title="Mở rộng tất cả ma trận điểm danh"
            >
              <i className="fas fa-angles-down text-[11px]" />
              <span>Mở rộng tất cả</span>
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
              title="Thu gọn tất cả thẻ lớp"
            >
              <i className="fas fa-angles-up text-[11px]" />
              <span>Thu gọn tất cả</span>
            </button>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* TAB 1: CARD-BASED ACCORDION LIST (MA TRẬN THEO THẺ LỚP LMS)    */}
      {/* ============================================================== */}
      {activeTab === 'matrix' && (
        <div className="space-y-4">
          {isTeacherClassesLoading ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-16 flex flex-col items-center justify-center gap-3">
              <Spinner />
              <span className="text-xs font-semibold text-slate-500 animate-pulse">
                Đang tải danh sách lớp học phần phụ trách...
              </span>
            </div>
          ) : displayedClasses.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center text-slate-400 space-y-3">
              <i className="fas fa-folder-open text-3xl text-slate-300" />
              <p className="text-sm font-bold text-slate-600">Không tìm thấy lớp học phần phù hợp.</p>
              {filterClassId !== 'all' && (
                <div>
                  <button
                    type="button"
                    onClick={() => handleFilterClassChange('all')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 text-xs font-bold hover:bg-indigo-100 transition cursor-pointer"
                  >
                    <i className="fas fa-list text-[11px]" />
                    <span>Xem tất cả lớp phụ trách ({classes.length})</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            displayedClasses.map((cls) => {
              const cId = cls.id || cls._id;
              const isExpanded = expandedClassIds.has(cId);

              return (
                <TeacherClassAccordionCard
                  key={cId}
                  classItem={cls}
                  isExpanded={isExpanded}
                  onToggleExpand={() => toggleExpandClass(cId)}
                  teacherUser={user}
                  teacherProfile={profile}
                />
              );
            })
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: CLASSES GRID OVERVIEW (DANH SÁCH LỚP PHỤ TRÁCH)          */}
      {/* ============================================================== */}
      {activeTab === 'classes' && (
        isTeacherClassesLoading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-16 flex flex-col items-center justify-center gap-3">
            <Spinner />
            <span className="text-xs font-semibold text-slate-500 animate-pulse">
              Đang tải danh sách lớp học phần...
            </span>
          </div>
        ) : classes.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center text-slate-400 space-y-2">
            <i className="fas fa-folder-open text-3xl text-slate-300" />
            <p className="text-sm font-bold text-slate-600">Chưa có lớp học phần nào được phân công.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.map((cls) => {
            const cId = cls.id || cls._id;
            const isSelected = filterClassId === cId;

            return (
              <div
                key={cId}
                onClick={() => {
                  handleFilterClassChange(cId);
                  setActiveTab('matrix');
                }}
                className={`p-5 rounded-2xl border transition-all duration-200 cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-50/50 border-indigo-300 shadow-sm'
                    : 'bg-white border-slate-200/80 hover:border-indigo-200 hover:shadow-xs'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-base shrink-0">
                    <i className="fas fa-graduation-cap" />
                  </div>
                  <span className="font-mono text-xs font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                    {cls.id}
                  </span>
                </div>

                <h4 className="mt-3 font-black text-slate-800 text-sm line-clamp-1">
                  {cls.courseName || cls.name}
                </h4>

                <div className="mt-2 space-y-1 text-xs text-slate-500">
                  {cls.room && (
                    <p className="flex items-center gap-1.5">
                      <i className="fas fa-door-open text-slate-400 text-[11px]" />
                      <span>Phòng {cls.room}</span>
                    </p>
                  )}
                  {cls.schedules?.length > 0 && (
                    <p className="flex items-center gap-1.5">
                      <i className="fas fa-calendar-days text-slate-400 text-[11px]" />
                      <span>{cls.schedules.length} buổi / tuần</span>
                    </p>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-600 flex items-center gap-1">
                    <span>Mở ma trận điểm danh</span>
                    <i className="fas fa-arrow-right text-[10px]" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        )
      )}
    </div>
  );
}

export default TeacherAttendance;
