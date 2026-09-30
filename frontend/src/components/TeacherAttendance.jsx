import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import GVLayout from '../layouts/GVLayout';
import registrationAPI from '../services/registrationAPI';
import attendanceAPI from '../services/attendanceAPI';
import studentAPI from '../services/studentAPI';
import {
  getTodayDateString,
  formatAttendanceDate,
  getShiftLabel,
  getStatusBadgeClass,
  getStatusIcon,
  ATTENDANCE_STATUSES,
  SHIFT_OPTIONS,
  EVALUATION_QUICK_TAGS,
} from '../utils/attendanceUtils';

export default function TeacherAttendance() {
  const [searchParams] = useSearchParams();
  const initialRegId = searchParams.get('regId') || '';

  const [currentUser, setCurrentUser] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem('currentUser')) || null;
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [myClasses, setMyClasses] = useState([]);
  const [allEnrollments, setAllEnrollments] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [existingAttendances, setExistingAttendances] = useState([]);

  // Session selector
  const [selectedRegId, setSelectedRegId] = useState(initialRegId);
  const [selectedDate, setSelectedDate] = useState(getTodayDateString());
  const [selectedShift, setSelectedShift] = useState('1');

  // Attendance & Evaluation state for students in selected class
  // Map of studentId -> { status, score, evaluation, note, checkInTime, checkedBy, evaluatedAt }
  const [studentRecords, setStudentRecords] = useState({});

  // Active Evaluation Modal state
  const [evaluationModal, setEvaluationModal] = useState({
    isOpen: false,
    student: null,
    score: '',
    evaluation: '',
    status: 'Có mặt',
    note: '',
  });

  const teacherEmail = (currentUser?.email || '').trim().toLowerCase();
  const teacherIdVal = currentUser?.id ?? currentUser?.teacherId ?? '';

  // 1. Load classes taught by this teacher
  const loadTeacherClasses = useCallback(async () => {
    setLoading(true);
    try {
      const [regs, enrolls, atts, students] = await Promise.all([
        registrationAPI.getOpenRegistrations({ fresh: true }),
        registrationAPI.getStudentRegistrations({ fresh: true }),
        attendanceAPI.getAllAttendances(),
        studentAPI.getAllStudents({ fresh: true }),
      ]);

      const openList = Array.isArray(regs) ? regs : [];
      // Filter classes assigned to this teacher
      const taught = openList.filter((c) => {
        if (teacherIdVal && (String(c.teacherId) === String(teacherIdVal) || String(c.teacher) === String(teacherIdVal))) return true;
        if (teacherEmail && c.teacherEmail && String(c.teacherEmail).trim().toLowerCase() === teacherEmail) return true;
        const currentName = currentUser?.hoTen || currentUser?.name || '';
        if (currentName && c.teacher && c.teacher.toLowerCase().includes(currentName.toLowerCase())) return true;
        return false;
      });

      // If no matching classes found for specific filter, display all open registrations so teacher can still view/manage
      const finalClasses = taught.length > 0 ? taught : openList;
      setMyClasses(finalClasses);
      setAllEnrollments(Array.isArray(enrolls) ? enrolls : []);
      setAllStudents(Array.isArray(students) ? students : []);
      setExistingAttendances(Array.isArray(atts) ? atts : []);

      if (finalClasses.length > 0 && !selectedRegId) {
        setSelectedRegId(String(finalClasses[0].id));
      }
    } catch (err) {
      console.error('Lỗi tải danh sách lớp giảng dạy:', err);
      Swal.fire('Lỗi', 'Không thể tải danh sách lớp học.', 'error');
    } finally {
      setLoading(false);
    }
  }, [teacherIdVal, teacherEmail, currentUser?.hoTen, currentUser?.name, selectedRegId]);

  useEffect(() => {
    loadTeacherClasses();
  }, [loadTeacherClasses]);

  // Current selected class object
  const currentClass = useMemo(() => {
    return myClasses.find((c) => String(c.id) === String(selectedRegId)) || null;
  }, [myClasses, selectedRegId]);

  // Students enrolled in this class with full student avatar & info
  const classStudents = useMemo(() => {
    if (!selectedRegId) return [];
    const matched = allEnrollments.filter(
      (e) =>
        String(e.regId) === String(selectedRegId) ||
        (currentClass?.courseId && String(e.courseId) === String(currentClass.courseId))
    );

    return matched.map((e) => {
      const sId = e.studentId || e.id;
      const sEmail = (e.studentEmail || e.email || '').trim().toLowerCase();
      const sObj = (allStudents || []).find(
        (s) =>
          String(s.id) === String(sId) ||
          (sEmail && s.email && s.email.trim().toLowerCase() === sEmail)
      );

      const studentName = sObj?.hoTen || sObj?.name || e.studentName || e.name || 'Sinh viên';
      const studentEmail = sObj?.email || e.studentEmail || e.email || '';
      const avatar =
        sObj?.avatar ||
        e.studentAvatar ||
        e.avatar ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(studentName)}&background=6366f1&color=fff`;

      return {
        ...e,
        studentId: sId,
        studentName,
        studentEmail,
        avatar,
        studentAvatar: avatar,
      };
    });
  }, [allEnrollments, selectedRegId, currentClass, allStudents]);

  // Sync existing attendance & evaluations into studentRecords state when class, date, or shift changes
  useEffect(() => {
    if (!selectedRegId || classStudents.length === 0) {
      setStudentRecords({});
      return;
    }

    const map = {};
    classStudents.forEach((student) => {
      const sId = student.studentId || student.id;
      // Find matching attendance record in database for this date & shift
      const existing = existingAttendances.find(
        (a) =>
          String(a.regId) === String(selectedRegId) &&
          String(a.studentId) === String(sId) &&
          a.date === selectedDate &&
          String(a.shiftId) === String(selectedShift)
      );

      if (existing) {
        map[sId] = {
          status: existing.status || 'Có mặt',
          score: existing.score !== null && existing.score !== undefined ? existing.score : '',
          evaluation: existing.evaluation || '',
          note: existing.note || '',
          checkInTime: existing.checkInTime || '',
          checkedBy: existing.checkedBy || 'teacher',
          evaluatedAt: existing.evaluatedAt || '',
          recordId: existing._id || existing.id,
        };
      } else {
        // Default record for student who hasn't been checked
        map[sId] = {
          status: 'Có mặt',
          score: '',
          evaluation: '',
          note: '',
          checkInTime: '',
          checkedBy: 'teacher',
          evaluatedAt: '',
        };
      }
    });

    setStudentRecords(map);
  }, [selectedRegId, selectedDate, selectedShift, classStudents, existingAttendances]);

  // Handle single student status change
  const handleStatusChange = (studentId, newStatus) => {
    setStudentRecords((prev) => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || {}),
        status: newStatus,
      },
    }));
  };

  // Open active Evaluation Modal
  const openEvaluationModal = (student) => {
    const sId = student.studentId || student.id;
    const currentData = studentRecords[sId] || {
      status: 'Có mặt',
      score: '',
      evaluation: '',
      note: '',
    };

    setEvaluationModal({
      isOpen: true,
      student,
      score: currentData.score,
      evaluation: currentData.evaluation,
      status: currentData.status,
      note: currentData.note,
    });
  };

  // Close Evaluation Modal
  const closeEvaluationModal = () => {
    setEvaluationModal((prev) => ({ ...prev, isOpen: false, student: null }));
  };

  // Append a quick tag into evaluation text
  const handleAddQuickTag = (tag) => {
    setEvaluationModal((prev) => {
      const current = prev.evaluation.trim();
      const updated = current ? `${current}. ${tag}` : tag;
      return { ...prev, evaluation: updated };
    });
  };

  // Save Evaluation from Modal
  const handleSaveEvaluationModal = async () => {
    const { student, score, evaluation, status, note } = evaluationModal;
    if (!student) return;

    const sId = student.studentId || student.id;
    const sName = student.studentName || student.hoTen || student.name || 'Sinh viên';
    const sEmail = student.studentEmail || student.email || '';

    // Validate score if provided
    let numScore = null;
    if (score !== '' && score !== null && score !== undefined) {
      numScore = Number(score);
      if (Number.isNaN(numScore) || numScore < 0 || numScore > 10) {
        Swal.fire('Lỗi', 'Điểm đánh giá phải nằm trong khoảng từ 0 đến 10!', 'warning');
        return;
      }
    }

    try {
      const payload = {
        regId: String(selectedRegId),
        courseId: currentClass?.courseId || '',
        courseName: currentClass?.courseName || '',
        studentId: Number(sId),
        studentName: sName,
        studentEmail: sEmail,
        studentAvatar: student.avatar || student.studentAvatar || '',
        avatar: student.avatar || student.studentAvatar || '',
        date: selectedDate,
        shiftId: selectedShift,
        shiftLabel: getShiftLabel(selectedShift),
        status,
        score: numScore,
        evaluation: evaluation.trim(),
        note: note.trim(),
        teacherId: teacherIdVal,
        teacherName: currentUser?.hoTen || currentUser?.name || 'Giảng viên',
        checkedBy: 'teacher',
      };

      const res = await attendanceAPI.recordAndEvaluate(payload);

      // Update local state immediately
      setStudentRecords((prev) => ({
        ...prev,
        [sId]: {
          ...(prev[sId] || {}),
          status,
          score: numScore !== null ? numScore : '',
          evaluation: evaluation.trim(),
          note: note.trim(),
          evaluatedAt: res.record?.evaluatedAt || 'Vừa xong',
          checkedBy: 'teacher',
        },
      }));

      // Update existing attendances list in memory
      setExistingAttendances((prev) => {
        const filtered = prev.filter(
          (a) =>
            !(
              String(a.regId) === String(selectedRegId) &&
              String(a.studentId) === String(sId) &&
              a.date === selectedDate &&
              String(a.shiftId) === String(selectedShift)
            )
        );
        return [...filtered, res.record];
      });

      closeEvaluationModal();
      Swal.fire({
        icon: 'success',
        title: 'Đã lưu đánh giá!',
        text: `Đã cập nhật điểm số và nhận xét cho sinh viên ${sName}.`,
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (err) {
      console.error('Lỗi khi lưu đánh giá:', err);
      Swal.fire('Lỗi', 'Không thể lưu đánh giá. Vui lòng thử lại!', 'error');
    }
  };

  // Quick Action: Mark all present
  const handleMarkAllPresent = () => {
    setStudentRecords((prev) => {
      const next = { ...prev };
      classStudents.forEach((student) => {
        const sId = student.studentId || student.id;
        next[sId] = {
          ...(next[sId] || {}),
          status: 'Có mặt',
        };
      });
      return next;
    });
    Swal.fire({
      icon: 'info',
      title: 'Đã cập nhật',
      text: 'Đã chọn trạng thái "Có mặt" cho toàn bộ sinh viên.',
      timer: 1500,
      showConfirmButton: false,
    });
  };

  // Quick Action: Score 10 for all present
  const handleScore10AllPresent = () => {
    setStudentRecords((prev) => {
      const next = { ...prev };
      classStudents.forEach((student) => {
        const sId = student.studentId || student.id;
        if (next[sId]?.status === 'Có mặt') {
          next[sId] = {
            ...next[sId],
            score: 10,
            evaluation: next[sId]?.evaluation || 'Chuyên cần tốt, tham gia đầy đủ',
          };
        }
      });
      return next;
    });
    Swal.fire({
      icon: 'success',
      title: 'Đã gán điểm 10',
      text: 'Đã cho điểm 10 chuyên cần cho các sinh viên có mặt.',
      timer: 1500,
      showConfirmButton: false,
    });
  };

  // Save all attendance & evaluations for the session (Bulk Save)
  const handleSaveBulkAttendance = async () => {
    if (!selectedRegId || classStudents.length === 0) {
      Swal.fire('Chú ý', 'Không có sinh viên nào trong lớp để lưu!', 'warning');
      return;
    }

    setSaving(true);
    try {
      const recordsToSave = classStudents.map((student) => {
        const sId = student.studentId || student.id;
        const currentData = studentRecords[sId] || {};
        return {
          studentId: Number(sId),
          studentName: student.studentName || student.hoTen || student.name || 'Sinh viên',
          studentEmail: student.studentEmail || student.email || '',
          studentAvatar: student.avatar || student.studentAvatar || '',
          avatar: student.avatar || student.studentAvatar || '',
          status: currentData.status || 'Có mặt',
          score: currentData.score !== '' && currentData.score !== null ? Number(currentData.score) : null,
          evaluation: currentData.evaluation || '',
          note: currentData.note || '',
        };
      });

      const payload = {
        regId: String(selectedRegId),
        courseId: currentClass?.courseId || '',
        courseName: currentClass?.courseName || '',
        date: selectedDate,
        shiftId: selectedShift,
        shiftLabel: getShiftLabel(selectedShift),
        teacherId: teacherIdVal,
        teacherName: currentUser?.hoTen || currentUser?.name || 'Giảng viên',
        records: recordsToSave,
        checkedBy: 'teacher',
      };

      const res = await attendanceAPI.saveBulk(payload);

      // Refresh existing attendances
      const freshAtts = await attendanceAPI.getAllAttendances();
      setExistingAttendances(freshAtts || []);

      Swal.fire({
        icon: 'success',
        title: 'Lưu thành công!',
        text: res.message || `Đã lưu điểm danh và đánh giá cho ${recordsToSave.length} sinh viên!`,
      });
    } catch (err) {
      console.error('Lỗi khi lưu điểm danh hàng loạt:', err);
      Swal.fire('Lỗi', 'Không thể lưu dữ liệu điểm danh lên hệ thống.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Summary statistics for current view
  const sessionStats = useMemo(() => {
    const total = classStudents.length;
    let present = 0;
    let late = 0;
    let absent = 0;
    let excused = 0;
    let evaluatedCount = 0;
    let sumScore = 0;

    classStudents.forEach((student) => {
      const sId = student.studentId || student.id;
      const data = studentRecords[sId];
      if (!data) return;
      if (data.status === 'Có mặt') present++;
      else if (data.status === 'Đi muộn') late++;
      else if (data.status === 'Vắng mặt') absent++;
      else if (data.status === 'Vắng có phép') excused++;

      if (data.score !== '' && data.score !== null && data.score !== undefined) {
        evaluatedCount++;
        sumScore += Number(data.score);
      }
    });

    const avgScore = evaluatedCount > 0 ? (sumScore / evaluatedCount).toFixed(1) : null;

    return { total, present, late, absent, excused, evaluatedCount, avgScore };
  }, [classStudents, studentRecords]);

  return (
    <GVLayout>
      <div className="p-4 md:p-8 max-w-7xl mx-auto">
        {/* Header Title */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2.5">
              <i className="fas fa-clipboard-check text-indigo-600" />
              Điểm danh & Đánh giá sinh viên
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Ghi nhận chuyên cần, theo dõi sinh viên tự điểm danh, nhập điểm và gửi nhận xét đánh giá cho từng sinh viên.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSaveBulkAttendance}
              disabled={saving || classStudents.length === 0}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md hover:shadow-indigo-200 transition flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-save" />}
              <span>Lưu cả buổi học</span>
            </button>
          </div>
        </div>

        {/* Filter / Session Selector Card */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-2">
                1. Chọn lớp học phần
              </label>
              <select
                value={selectedRegId}
                onChange={(e) => setSelectedRegId(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
              >
                {myClasses.length === 0 ? (
                  <option value="">Không có lớp dạy</option>
                ) : (
                  myClasses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.courseId} - {c.courseName} ({c.department || 'Khoa'})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-2">
                2. Ngày điểm danh
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-2">
                3. Ca học
              </label>
              <select
                value={selectedShift}
                onChange={(e) => setSelectedShift(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
              >
                {SHIFT_OPTIONS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Live Session Overview Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm text-center">
            <span className="text-[11px] font-bold text-gray-400 uppercase">Sĩ số lớp</span>
            <div className="text-xl font-bold text-gray-800 mt-1">{sessionStats.total}</div>
          </div>
          <div className="bg-emerald-50/70 p-4 rounded-xl border border-emerald-100 shadow-sm text-center">
            <span className="text-[11px] font-bold text-emerald-600 uppercase">Có mặt</span>
            <div className="text-xl font-bold text-emerald-700 mt-1">{sessionStats.present}</div>
          </div>
          <div className="bg-amber-50/70 p-4 rounded-xl border border-amber-100 shadow-sm text-center">
            <span className="text-[11px] font-bold text-amber-600 uppercase">Đi muộn</span>
            <div className="text-xl font-bold text-amber-700 mt-1">{sessionStats.late}</div>
          </div>
          <div className="bg-rose-50/70 p-4 rounded-xl border border-rose-100 shadow-sm text-center">
            <span className="text-[11px] font-bold text-rose-600 uppercase">Vắng mặt</span>
            <div className="text-xl font-bold text-rose-700 mt-1">{sessionStats.absent}</div>
          </div>
          <div className="bg-blue-50/70 p-4 rounded-xl border border-blue-100 shadow-sm text-center">
            <span className="text-[11px] font-bold text-blue-600 uppercase">Vắng có phép</span>
            <div className="text-xl font-bold text-blue-700 mt-1">{sessionStats.excused}</div>
          </div>
          <div className="bg-purple-50/70 p-4 rounded-xl border border-purple-100 shadow-sm text-center">
            <span className="text-[11px] font-bold text-purple-600 uppercase">Điểm TB buổi</span>
            <div className="text-xl font-bold text-purple-700 mt-1">
              {sessionStats.avgScore !== null ? `${sessionStats.avgScore}/10` : '-'}
            </div>
          </div>
        </div>

        {/* Quick batch tools */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 px-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleMarkAllPresent}
              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold border border-emerald-200 transition flex items-center gap-1.5"
            >
              <i className="fas fa-check-double text-[11px]" />
              <span>Tất cả có mặt</span>
            </button>
            <button
              type="button"
              onClick={handleScore10AllPresent}
              className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg text-xs font-bold border border-amber-200 transition flex items-center gap-1.5"
            >
              <i className="fas fa-star text-[11px]" />
              <span>Điểm 10 chuyên cần cho bạn có mặt</span>
            </button>
          </div>

          <div className="text-xs text-gray-500">
            Đã đánh giá: <strong className="text-indigo-600">{sessionStats.evaluatedCount}</strong>/{sessionStats.total} sinh viên
          </div>
        </div>

        {/* Student Attendance & Evaluation Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-12">
          {loading ? (
            <div className="text-center py-20 text-gray-400">
              <i className="fas fa-spinner fa-spin text-3xl mb-2 text-indigo-500" />
              <p className="text-sm">Đang tải danh sách sinh viên...</p>
            </div>
          ) : classStudents.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <i className="fas fa-user-friends text-5xl mb-3 text-gray-200" />
              <p className="text-base font-semibold text-gray-600">Không có sinh viên nào trong lớp này</p>
              <p className="text-xs text-gray-400 mt-1">Chưa có sinh viên nào đăng ký học phần này.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-[11px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                    <th className="px-6 py-4 w-12 text-center">STT</th>
                    <th className="px-6 py-4">Sinh viên</th>
                    <th className="px-6 py-4">Tự điểm danh</th>
                    <th className="px-6 py-4">Trạng thái</th>
                    <th className="px-6 py-4 text-center">Điểm (0-10)</th>
                    <th className="px-6 py-4">Nhận xét / Đánh giá</th>
                    <th className="px-6 py-4 text-center">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-sm">
                  {classStudents.map((student, idx) => {
                    const sId = student.studentId || student.id;
                    const sName = student.studentName || student.hoTen || student.name || 'Sinh viên';
                    const sEmail = student.studentEmail || student.email || '';
                    const data = studentRecords[sId] || {
                      status: 'Có mặt',
                      score: '',
                      evaluation: '',
                    };

                    const hasSelfCheckedIn = Boolean(data.checkInTime);

                    return (
                      <tr key={sId || idx} className="hover:bg-gray-50/80 transition-colors">
                        <td className="px-6 py-4 text-center font-medium text-gray-400">{idx + 1}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={
                                student.avatar ||
                                `https://ui-avatars.com/api/?name=${encodeURIComponent(sName)}&background=6366f1&color=fff`
                              }
                              alt={sName}
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(sName)}&background=6366f1&color=fff`;
                              }}
                              className="w-10 h-10 rounded-xl object-cover border border-gray-100 shadow-sm shrink-0"
                            />
                            <div>
                              <div className="font-semibold text-gray-800">{sName}</div>
                              <div className="text-[11px] text-gray-400 font-mono">
                                MSV: SV-{String(sId).padStart(3, '0')}
                                {sEmail && ` • ${sEmail}`}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Self Check-in Status */}
                        <td className="px-6 py-4">
                          {hasSelfCheckedIn ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <i className="fas fa-mobile-alt text-[10px]" />
                              Đã check-in ({data.checkInTime})
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400 italic">Chưa check-in</span>
                          )}
                        </td>

                        {/* Status Select */}
                        <td className="px-6 py-4">
                          <select
                            value={data.status || 'Có mặt'}
                            onChange={(e) => handleStatusChange(sId, e.target.value)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border outline-none cursor-pointer transition ${getStatusBadgeClass(
                              data.status
                            )}`}
                          >
                            {ATTENDANCE_STATUSES.map((st) => (
                              <option key={st} value={st}>
                                {st}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Score display */}
                        <td className="px-6 py-4 text-center">
                          {data.score !== '' && data.score !== null && data.score !== undefined ? (
                            <span className="inline-block px-2.5 py-1 bg-amber-50 text-amber-800 font-bold rounded-lg text-xs border border-amber-200">
                              {data.score}
                            </span>
                          ) : (
                            <span className="text-gray-300 text-xs">-</span>
                          )}
                        </td>

                        {/* Evaluation Comment display */}
                        <td className="px-6 py-4 max-w-xs">
                          {data.evaluation ? (
                            <div className="text-xs text-gray-700 flex items-start gap-1.5" title={data.evaluation}>
                              <i className="fas fa-comment-dots text-indigo-400 mt-0.5 shrink-0" />
                              <span className="truncate">{data.evaluation}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-300 italic">Chưa có nhận xét</span>
                          )}
                        </td>

                        {/* Action: Active "Đánh giá" Button */}
                        <td className="px-6 py-4 text-center">
                          <button
                            type="button"
                            onClick={() => openEvaluationModal(student)}
                            className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 mx-auto shadow-sm"
                            title="Đánh giá & cho điểm sinh viên"
                          >
                            <i className="fas fa-edit text-[11px]" />
                            <span>Đánh giá</span>
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

        {/* Modal Đánh giá chi tiết cho Giáo viên */}
        {evaluationModal.isOpen && evaluationModal.student && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-fadeIn">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 p-5 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/10 rounded-lg">
                    <i className="fas fa-award text-xl text-amber-300" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Đánh giá & Cho điểm sinh viên</h3>
                    <p className="text-xs text-indigo-200">
                      {currentClass?.courseName} ({formatAttendanceDate(selectedDate)} - {getShiftLabel(selectedShift)})
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeEvaluationModal}
                  className="text-white/80 hover:text-white transition p-1"
                >
                  <i className="fas fa-times text-lg" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-5">
                {/* Student Info preview */}
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <img
                    src={
                      evaluationModal.student.avatar ||
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(
                        evaluationModal.student.studentName || evaluationModal.student.name || 'SV'
                      )}&background=6366f1&color=fff`
                    }
                    alt="Avatar"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                        evaluationModal.student.studentName || evaluationModal.student.name || 'SV'
                      )}&background=6366f1&color=fff`;
                    }}
                    className="w-12 h-12 rounded-xl object-cover border border-gray-200 shadow-sm shrink-0"
                  />
                  <div>
                    <h4 className="font-bold text-gray-800 text-sm">
                      {evaluationModal.student.studentName || evaluationModal.student.hoTen || evaluationModal.student.name}
                    </h4>
                    <p className="text-xs text-gray-500 font-mono">
                      MSV: SV-{String(evaluationModal.student.studentId || evaluationModal.student.id).padStart(3, '0')}
                    </p>
                  </div>
                </div>

                {/* Status select in modal */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-2">
                    Trạng thái điểm danh
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {ATTENDANCE_STATUSES.map((st) => (
                      <button
                        type="button"
                        key={st}
                        onClick={() => setEvaluationModal((prev) => ({ ...prev, status: st }))}
                        className={`py-2 px-2 rounded-xl text-xs font-bold border transition text-center ${
                          evaluationModal.status === st
                            ? `${getStatusBadgeClass(st)} ring-2 ring-indigo-400`
                            : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Score Input (0 - 10) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-gray-700 uppercase">
                      Điểm chuyên cần / buổi học (Thang điểm 10)
                    </label>
                    <span className="text-xs text-gray-400">0.0 - 10.0</span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="10"
                      step="0.5"
                      value={evaluationModal.score}
                      onChange={(e) => setEvaluationModal((prev) => ({ ...prev, score: e.target.value }))}
                      placeholder="Nhập điểm (Ví dụ: 8.5, 9, 10...)"
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-indigo-700 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
                    />
                    <div className="absolute right-3 top-2.5 flex items-center gap-1 text-xs">
                      {[10, 9, 8, 7, 5].map((quickScore) => (
                        <button
                          key={quickScore}
                          type="button"
                          onClick={() => setEvaluationModal((prev) => ({ ...prev, score: quickScore }))}
                          className="px-2 py-0.5 bg-gray-100 hover:bg-indigo-50 hover:text-indigo-600 rounded text-gray-600 font-semibold"
                        >
                          {quickScore}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Evaluation text & Quick Tags */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-2">
                    Lời nhận xét & Đánh giá của Giảng viên
                  </label>
                  <textarea
                    rows="3"
                    value={evaluationModal.evaluation}
                    onChange={(e) => setEvaluationModal((prev) => ({ ...prev, evaluation: e.target.value }))}
                    placeholder="Nhập nhận xét cụ thể về buổi học của sinh viên..."
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition resize-none"
                  />

                  {/* Suggested quick tags */}
                  <div className="mt-2">
                    <span className="text-[11px] text-gray-400 block mb-1.5 font-medium">Gợi ý đánh giá nhanh:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {EVALUATION_QUICK_TAGS.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => handleAddQuickTag(tag)}
                          className="px-2.5 py-1 bg-gray-100 hover:bg-indigo-50 hover:text-indigo-600 text-gray-600 rounded-lg text-xs font-medium transition border border-gray-200"
                        >
                          + {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeEvaluationModal}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-xl font-medium transition"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleSaveEvaluationModal}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-indigo-200 transition flex items-center gap-2"
                >
                  <i className="fas fa-check" />
                  <span>Lưu đánh giá</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </GVLayout>
  );
}
