import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { Spinner } from '../../../components/ui/Spinner.jsx';
import { Modal } from '../../../components/ui/Modal.jsx';
import { useToast } from '../../../app/providers/ToastProvider.jsx';
import { useAuth } from '../../../app/providers/AuthProvider.jsx';
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

  const { data: classData, isLoading: classesLoading } = useMyTeacherClasses();
  const classes = classData?.data || [];

  const [selectedClassId, setSelectedClassId] = useState(initialClassId);
  const [selectedDate, setSelectedDate] = useState(getTodayDateString());
  const [selectedShift, setSelectedShift] = useState('1');

  // Enrolled students in selected class
  const { data: studentsData, isLoading: studentsLoading } = useClassStudents(selectedClassId);
  const students = studentsData?.students || [];

  // Map of studentId -> { status, score, evaluation, note }
  const [records, setRecords] = useState({});
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [saving, setSaving] = useState(false);

  // Quick evaluation modal
  const [evalModal, setEvalModal] = useState({
    isOpen: false,
    student: null,
    score: '',
    evaluation: '',
    status: 'Có mặt',
    note: '',
  });

  // Auto-select first class if none selected
  useEffect(() => {
    if (!selectedClassId && classes.length > 0) {
      setSelectedClassId(classes[0].id);
    }
  }, [selectedClassId, classes]);

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
    loadExistingAttendance();
  }, [loadExistingAttendance]);

  const selectedClass = useMemo(() => {
    return classes.find((c) => c.id === selectedClassId) || null;
  }, [classes, selectedClassId]);

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

  // Mark all present
  const handleMarkAllPresent = () => {
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

  // Save single evaluation from modal
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
      await loadExistingAttendance();
      window.dispatchEvent(new CustomEvent('edumin_attendance_updated', {
        detail: { courseName: selectedClass?.courseName, status: 'Đã hoàn tất điểm danh' },
      }));
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

  if (classesLoading) return <Spinner />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Điểm danh & Đánh giá Sinh viên"
        description="Ghi nhận chuyên cần và đánh giá kết quả học tập theo từng buổi học"
        actions={
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleMarkAllPresent}
              disabled={students.length === 0}
              className="px-4 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl text-xs font-bold transition disabled:opacity-50"
            >
              <i className="fas fa-check-double mr-1.5" /> Có mặt tất cả
            </button>
            <button
              type="button"
              onClick={handleSaveBulk}
              disabled={saving || students.length === 0}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs disabled:opacity-50 flex items-center gap-1.5"
            >
              <i className="fas fa-save" /> {saving ? 'Đang lưu...' : 'Lưu điểm danh'}
            </button>
          </div>
        }
      />

      {/* Select class and session */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
            Chọn lớp học phần
          </label>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white font-medium"
          >
            {classes.length === 0 ? (
              <option value="">Chưa có lớp giảng dạy</option>
            ) : (
              classes.map((c) => (
                <option key={c._id} value={c.id}>
                  {c.id} - {c.courseName}
                </option>
              ))
            )}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
            Ngày điểm danh
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
          />
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

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-gray-100 text-center">
          <p className="text-[11px] font-semibold text-gray-400 uppercase">Sĩ số lớp</p>
          <p className="text-xl font-bold text-gray-800 mt-0.5">{sessionStats.total}</p>
        </div>
        <div className="bg-emerald-50/50 p-3.5 rounded-xl border border-emerald-100 text-center">
          <p className="text-[11px] font-semibold text-emerald-600 uppercase">Có mặt</p>
          <p className="text-xl font-bold text-emerald-600 mt-0.5">{sessionStats.present}</p>
        </div>
        <div className="bg-amber-50/50 p-3.5 rounded-xl border border-amber-100 text-center">
          <p className="text-[11px] font-semibold text-amber-600 uppercase">Đi muộn</p>
          <p className="text-xl font-bold text-amber-600 mt-0.5">{sessionStats.late}</p>
        </div>
        <div className="bg-blue-50/50 p-3.5 rounded-xl border border-blue-100 text-center">
          <p className="text-[11px] font-semibold text-blue-600 uppercase">Có phép</p>
          <p className="text-xl font-bold text-blue-600 mt-0.5">{sessionStats.excused}</p>
        </div>
        <div className="bg-rose-50/50 p-3.5 rounded-xl border border-rose-100 text-center">
          <p className="text-[11px] font-semibold text-rose-600 uppercase">Vắng mặt</p>
          <p className="text-xl font-bold text-rose-600 mt-0.5">{sessionStats.absent}</p>
        </div>
      </div>

      {/* Students list for attendance */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
        {studentsLoading || loadingRecords ? (
          <div className="p-12">
            <Spinner />
          </div>
        ) : students.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <i className="fas fa-user-graduate text-4xl mb-3 block text-gray-300" />
            <p className="font-semibold text-gray-600 text-sm">Chưa có sinh viên đăng ký lớp học này</p>
            <p className="text-xs text-gray-400 mt-1">Khi sinh viên đăng ký lớp học phần, danh sách sẽ hiển thị ở đây.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-700">
              <thead className="bg-gray-50/75 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3">STT</th>
                  <th className="px-5 py-3">Sinh viên</th>
                  <th className="px-5 py-3">Trạng thái điểm danh</th>
                  <th className="px-5 py-3">Điểm tiết</th>
                  <th className="px-5 py-3">Đánh giá nhận xét</th>
                  <th className="px-5 py-3 text-right">Đánh giá chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {students.map((student, idx) => {
                  const rec = records[student.id] || { status: 'Có mặt', score: '', evaluation: '' };
                  const studentAvatar =
                    typeof student.avatar === 'string'
                      ? student.avatar
                      : student.avatar?.url ||
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(student.hoTen || 'SV')}&background=6366f1&color=fff`;

                  return (
                    <tr key={student._id} className="hover:bg-indigo-50/20 transition">
                      <td className="px-5 py-3 text-xs text-gray-400 font-medium">
                        {idx + 1}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={studentAvatar}
                            alt=""
                            className="w-9 h-9 rounded-full object-cover border border-gray-100 shrink-0"
                          />
                          <div>
                            <p className="font-bold text-gray-900">{student.hoTen}</p>
                            <p className="text-xs text-gray-400 font-mono">
                              {formatStudentCode(student.id)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="inline-flex rounded-xl border border-gray-200 p-0.5 bg-gray-50 gap-0.5">
                          {ATTENDANCE_STATUSES.map((status) => {
                            const isSelected = rec.status === status;
                            let activeClass = 'bg-white shadow-xs font-bold ';
                            if (status === 'Có mặt') activeClass += 'text-emerald-700';
                            else if (status === 'Đi muộn') activeClass += 'text-amber-700';
                            else if (status === 'Vắng có phép') activeClass += 'text-blue-700';
                            else activeClass += 'text-rose-700';

                            return (
                              <button
                                key={status}
                                type="button"
                                onClick={() => handleStatusChange(student.id, status)}
                                className={`px-2.5 py-1 text-xs rounded-lg transition ${
                                  isSelected ? activeClass : 'text-gray-500 hover:text-gray-800'
                                }`}
                              >
                                {status}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <input
                          type="number"
                          min="0"
                          max="10"
                          step="0.5"
                          placeholder="-"
                          value={rec.score != null ? rec.score : ''}
                          onChange={(e) =>
                            setRecords((prev) => ({
                              ...prev,
                              [student.id]: {
                                ...(prev[student.id] || {}),
                                score: e.target.value,
                              },
                            }))
                          }
                          className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-xs font-bold text-center focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        />
                      </td>
                      <td className="px-5 py-3">
                        {rec.evaluation ? (
                          <span className="text-xs text-gray-700 italic max-w-xs block truncate">
                            "{rec.evaluation}"
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300 italic">Chưa nhận xét</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => openEvaluationModal(student)}
                          className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold transition"
                        >
                          <i className="fas fa-edit mr-1" /> Nhận xét
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

      {/* Evaluation modal */}
      {evalModal.isOpen && (
        <Modal
          open
          onClose={() => setEvalModal({ isOpen: false, student: null, score: '', evaluation: '', status: 'Có mặt', note: '' })}
          title={`Đánh giá học tập - ${evalModal.student?.hoTen}`}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                Trạng thái chuyên cần
              </label>
              <select
                value={evalModal.status}
                onChange={(e) => setEvalModal((p) => ({ ...p, status: e.target.value }))}
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
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                Điểm đánh giá buổi học (Thang điểm 10)
              </label>
              <input
                type="number"
                min="0"
                max="10"
                step="0.5"
                value={evalModal.score}
                onChange={(e) => setEvalModal((p) => ({ ...p, score: e.target.value }))}
                placeholder="VD: 9.0"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">
                Gợi ý nhận xét nhanh
              </label>
              <div className="flex flex-wrap gap-1.5">
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
                    className="px-2.5 py-1 bg-gray-100 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg text-xs transition"
                  >
                    + {tag}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                Nội dung nhận xét chi tiết
              </label>
              <textarea
                rows={2}
                value={evalModal.evaluation}
                onChange={(e) => setEvalModal((p) => ({ ...p, evaluation: e.target.value }))}
                placeholder="Nhập nhận xét về thái độ học tập, bài làm..."
                className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setEvalModal({ isOpen: false, student: null, score: '', evaluation: '', status: 'Có mặt', note: '' })}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl font-medium"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveEvalModal}
                className="px-5 py-2 text-sm bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition"
              >
                Xác nhận
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default TeacherAttendance;

