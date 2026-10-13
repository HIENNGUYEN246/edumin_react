import { useState, useMemo, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { classesApi } from '../../api/classesApi.js';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import {
  formatStudentCode,
  DEFAULT_GRADE_WEIGHTS,
  GRADE_COMPONENTS,
  calculateGpa,
  getGpaClassification,
} from '../../lib/format.js';
import { useToast } from '../../app/providers/ToastProvider.jsx';
import { useClassStudents } from './useTeacherClasses.js';
import { setAiPageContext } from '../../components/ai/EduMinAiAssistant.jsx';

function StudentGradeRow({ classId, student, weights, activeComponents, quizConfig }) {
  const toast = useToast();
  const queryClient = useQueryClient();

  const initialGrades = useMemo(() => ({
    attendance: student.manualGrades?.attendance ?? (student.attendanceStats?.autoScore ?? ''),
    presentation: student.manualGrades?.presentation ?? '',
    midterm: student.manualGrades?.midterm ?? (student.quizMidterm?.score ?? ''),
    final: student.manualGrades?.final ?? (student.quizFinal?.score ?? ''),
  }), [student]);

  const [grades, setGrades] = useState(initialGrades);

  // Sync state if student prop changes from query refetch
  useEffect(() => {
    setGrades(initialGrades);
  }, [initialGrades]);

  const liveGrades = useMemo(() => ({
    ...grades,
    homework: student.homeworkGrade,
  }), [grades, student.homeworkGrade]);

  const liveGpa = useMemo(() => calculateGpa(liveGrades, weights), [liveGrades, weights]);
  const classification = useMemo(() => getGpaClassification(liveGpa), [liveGpa]);

  const saveGrades = useMutation({
    mutationFn: () => {
      const payload = {};
      for (const [key, value] of Object.entries(grades)) {
        if (value === '' || value === null || value === undefined) {
          payload[key] = null;
        } else {
          const num = Number(value);
          if (Number.isNaN(num) || num < 0 || num > 10) {
            throw new Error(`Điểm ${key} phải là số từ 0 đến 10`);
          }
          payload[key] = num;
        }
      }
      return classesApi.updateStudentGrades(classId, student._id, payload);
    },
    onSuccess: (data) => {
      setGrades({
        attendance: data.manualGrades?.attendance ?? (student.attendanceStats?.autoScore ?? ''),
        presentation: data.manualGrades?.presentation ?? '',
        midterm: data.manualGrades?.midterm ?? (student.quizMidterm?.score ?? ''),
        final: data.manualGrades?.final ?? (student.quizFinal?.score ?? ''),
      });
      queryClient.invalidateQueries({ queryKey: ['classes', classId, 'students'] });
      toast.success(`Đã lưu điểm cho sinh viên ${student.hoTen}`);
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <tr className="border-t border-gray-100 hover:bg-indigo-50/30 transition">
      <td className="whitespace-nowrap px-3 py-3 font-semibold text-gray-700">{formatStudentCode(student.id)}</td>
      <td className="whitespace-nowrap px-3 py-3 font-medium text-gray-800">{student.hoTen}</td>
      {activeComponents.map((comp) => {
        if (comp.key === 'homework') {
          return (
            <td key={comp.key} className="px-3 py-3 whitespace-nowrap text-center">
              <div className="font-bold text-gray-800">
                {student.homeworkGrade == null ? '—' : `${student.homeworkGrade}/10`}
              </div>
              <div className="mt-0.5 text-xs text-gray-400">
                {student.homeworkQuizCount ?? 0}/{student.homeworkQuizTotal ?? 0} quiz
              </div>
            </td>
          );
        }

        // Subtext / Helper details under each cell
        let helperNode = null;
        if (comp.key === 'attendance') {
          const hasAtt = (student.attendanceStats?.total || 0) > 0;
          const autoScore = student.attendanceStats?.autoScore;
          const currentVal = grades.attendance === '' ? null : Number(grades.attendance);
          const isOverridden = hasAtt && currentVal !== null && autoScore !== null && currentVal !== autoScore;

          if (hasAtt) {
            if (isOverridden) {
              helperNode = (
                <div className="mt-1 flex items-center justify-center gap-1 text-[10px] text-amber-600 font-semibold">
                  <span>Ghi đè</span>
                  <button
                    type="button"
                    title={`Khôi phục điểm tự động từ điểm danh (${autoScore})`}
                    onClick={() => setGrades((current) => ({ ...current, attendance: String(autoScore) }))}
                    className="underline text-indigo-600 hover:text-indigo-800 cursor-pointer"
                  >
                    Gốc: {autoScore}
                  </button>
                </div>
              );
            } else {
              helperNode = (
                <div className="mt-1 text-[10px] text-emerald-600 font-medium">
                  <i className="fas fa-check-circle mr-1 text-[9px]" />
                  Tự động ({student.attendanceStats?.present}/{student.attendanceStats?.total} buổi)
                </div>
              );
            }
          } else {
            helperNode = <div className="mt-1 text-[10px] text-slate-400 italic">Chưa điểm danh</div>;
          }
        } else if (comp.key === 'midterm') {
          const hasLinkedQuiz = Boolean(quizConfig?.midtermQuiz);
          const quizScore = student.quizMidterm?.score;
          const currentVal = grades.midterm === '' ? null : Number(grades.midterm);
          const isOverridden = hasLinkedQuiz && currentVal !== null && quizScore !== null && currentVal !== quizScore;

          if (hasLinkedQuiz) {
            if (isOverridden) {
              helperNode = (
                <div className="mt-1 flex items-center justify-center gap-1 text-[10px] text-amber-600 font-semibold">
                  <span>Ghi đè</span>
                  <button
                    type="button"
                    title="Lấy lại điểm thi Quiz gốc"
                    onClick={() =>
                      setGrades((current) => ({
                        ...current,
                        midterm: quizScore != null ? String(quizScore) : '',
                      }))
                    }
                    className="underline text-indigo-600 hover:text-indigo-800 cursor-pointer"
                  >
                    Quiz: {quizScore ?? '—'}
                  </button>
                </div>
              );
            } else {
              helperNode = (
                <div className="mt-1 text-[10px] text-indigo-600 font-medium">
                  <i className="fas fa-bolt mr-1 text-[9px]" />
                  Quiz: {quizScore != null ? `${quizScore}/10` : 'Chưa nộp'}
                </div>
              );
            }
          } else {
            helperNode = <div className="mt-1 text-[10px] text-slate-400">Nhập tay</div>;
          }
        } else if (comp.key === 'final') {
          const hasLinkedQuiz = Boolean(quizConfig?.finalQuiz);
          const quizScore = student.quizFinal?.score;
          const currentVal = grades.final === '' ? null : Number(grades.final);
          const isOverridden = hasLinkedQuiz && currentVal !== null && quizScore !== null && currentVal !== quizScore;

          if (hasLinkedQuiz) {
            if (isOverridden) {
              helperNode = (
                <div className="mt-1 flex items-center justify-center gap-1 text-[10px] text-amber-600 font-semibold">
                  <span>Ghi đè</span>
                  <button
                    type="button"
                    title="Lấy lại điểm thi Quiz gốc"
                    onClick={() =>
                      setGrades((current) => ({
                        ...current,
                        final: quizScore != null ? String(quizScore) : '',
                      }))
                    }
                    className="underline text-indigo-600 hover:text-indigo-800 cursor-pointer"
                  >
                    Quiz: {quizScore ?? '—'}
                  </button>
                </div>
              );
            } else {
              helperNode = (
                <div className="mt-1 text-[10px] text-indigo-600 font-medium">
                  <i className="fas fa-bolt mr-1 text-[9px]" />
                  Quiz: {quizScore != null ? `${quizScore}/10` : 'Chưa nộp'}
                </div>
              );
            }
          } else {
            helperNode = <div className="mt-1 text-[10px] text-slate-400">Nhập tay</div>;
          }
        }

        return (
          <td key={comp.key} className="px-3 py-3 text-center">
            <input
              aria-label={`${comp.label} - ${student.hoTen}`}
              type="number"
              min="0"
              max="10"
              step="0.1"
              value={grades[comp.key] ?? ''}
              onChange={(event) =>
                setGrades((current) => ({ ...current, [comp.key]: event.target.value }))
              }
              className="w-20 text-center font-semibold rounded-lg border border-gray-200 px-2 py-1.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition"
            />
            {helperNode}
          </td>
        );
      })}
      <td className="px-3 py-3 whitespace-nowrap bg-indigo-50/40 text-center border-x border-indigo-100/50">
        {liveGpa == null ? (
          <span className="text-gray-400 font-medium">—</span>
        ) : (
          <div className="inline-flex flex-col items-center">
            <span className="text-sm font-black text-indigo-700 tracking-tight">
              {liveGpa.toFixed(2)}
            </span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full mt-0.5 border ${
                classification.tone === 'success'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : classification.tone === 'primary'
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : classification.tone === 'warning'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : classification.tone === 'caution'
                  ? 'bg-orange-50 text-orange-700 border-orange-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}
            >
              {classification.letter ? `${classification.letter} · ` : ''}
              {classification.text}
            </span>
          </div>
        )}
      </td>
      <td className="px-3 py-3 text-right whitespace-nowrap">
        <button
          type="button"
          onClick={() => saveGrades.mutate()}
          disabled={saveGrades.isPending}
          className="whitespace-nowrap rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 shadow-2xs hover:shadow disabled:opacity-60 transition cursor-pointer"
        >
          {saveGrades.isPending ? 'Đang lưu...' : 'Lưu điểm'}
        </button>
      </td>
    </tr>
  );
}

export function TeacherClassGradebook() {
  const navigate = useNavigate();
  const { id } = useParams();
  const toast = useToast();
  const queryClient = useQueryClient();

  const classQuery = useQuery({ queryKey: ['classes', id, 'detail'], queryFn: () => classesApi.get(id) });
  const studentsQuery = useClassStudents(id);

  const [isQuizConfigOpen, setIsQuizConfigOpen] = useState(false);
  const [selectedMidtermQuiz, setSelectedMidtermQuiz] = useState('');
  const [selectedFinalQuiz, setSelectedFinalQuiz] = useState('');

  // Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'completed', 'pending'

  const classInfo = classQuery.data;
  const weights = useMemo(() => {
    return classInfo?.gradeWeights || DEFAULT_GRADE_WEIGHTS;
  }, [classInfo?.gradeWeights]);

  const activeComponents = useMemo(() => {
    const list = GRADE_COMPONENTS.filter((comp) => (Number(weights[comp.key]) || 0) > 0);
    return list.length > 0 ? list : GRADE_COMPONENTS.filter((comp) => comp.key !== 'presentation');
  }, [weights]);

  const students = useMemo(() => studentsQuery.data?.students || [], [studentsQuery.data?.students]);
  const availableQuizzes = useMemo(() => studentsQuery.data?.availableQuizzes || [], [studentsQuery.data?.availableQuizzes]);
  const classFromStudents = useMemo(() => studentsQuery.data?.class || null, [studentsQuery.data?.class]);

  // Sync real-time page context with EduMin AI Assistant
  useEffect(() => {
    if (classInfo || students.length > 0) {
      setAiPageContext({
        page: 'teacher_gradebook',
        currentClass: classInfo || classFromStudents,
        students: students.map((st) => ({
          ...st,
          code: formatStudentCode(st.id),
          finalScore: calculateGpa(
            {
              attendance: st.manualGrades?.attendance ?? st.attendanceStats?.autoScore,
              presentation: st.manualGrades?.presentation,
              midterm: st.manualGrades?.midterm ?? st.quizMidterm?.score,
              final: st.manualGrades?.final ?? st.quizFinal?.score,
              homework: st.homeworkGrade,
            },
            weights
          ),
        })),
      });
    }
  }, [classInfo, classFromStudents, students, weights]);

  // Listen to AI action triggers (e.g. locate student on gradebook)
  useEffect(() => {
    const handleAiAction = (e) => {
      const detail = e.detail;
      if (!detail) return;
      if (detail.action === 'locate_student') {
        const query = detail.studentName || detail.studentCode || '';
        if (query) {
          setSearchTerm(query);
          toast.info(`Đã tìm kiếm và định vị sinh viên ${query} trên bảng điểm!`);
        }
      }
    };
    window.addEventListener('edumin:ai-action', handleAiAction);
    return () => window.removeEventListener('edumin:ai-action', handleAiAction);
  }, [toast]);

  // Check if a student has all active component grades filled
  const isStudentComplete = (st) => {
    return activeComponents.every((comp) => {
      if (comp.key === 'homework') return st.homeworkGrade != null;
      if (comp.key === 'attendance') {
        const val = st.manualGrades?.attendance ?? st.attendanceStats?.autoScore;
        return val != null && val !== '';
      }
      if (comp.key === 'midterm') {
        const val = st.manualGrades?.midterm ?? st.quizMidterm?.score;
        return val != null && val !== '';
      }
      if (comp.key === 'final') {
        const val = st.manualGrades?.final ?? st.quizFinal?.score;
        return val != null && val !== '';
      }
      if (comp.key === 'presentation') {
        const val = st.manualGrades?.presentation;
        return val != null && val !== '';
      }
      return true;
    });
  };

  const filteredStudents = useMemo(() => {
    return students.filter((st) => {
      if (searchTerm.trim()) {
        const term = searchTerm.trim().toLowerCase();
        const code = formatStudentCode(st.id).toLowerCase();
        const rawId = String(st.id ?? '').toLowerCase();
        const name = (st.hoTen || '').toLowerCase();
        if (!code.includes(term) && !rawId.includes(term) && !name.includes(term)) {
          return false;
        }
      }
      if (statusFilter === 'completed') {
        return isStudentComplete(st);
      }
      if (statusFilter === 'pending') {
        return !isStudentComplete(st);
      }
      return true;
    });
  }, [students, searchTerm, statusFilter, activeComponents]);

  const quizConfig = useMemo(() => ({
    midtermQuiz: classFromStudents?.midtermQuiz || classInfo?.midtermQuizId,
    finalQuiz: classFromStudents?.finalQuiz || classInfo?.finalQuizId,
  }), [classFromStudents?.midtermQuiz, classFromStudents?.finalQuiz, classInfo?.midtermQuizId, classInfo?.finalQuizId]);

  const midtermAvailableQuizzes = useMemo(() => {
    return availableQuizzes.filter((quiz) => !selectedFinalQuiz || quiz._id !== selectedFinalQuiz);
  }, [availableQuizzes, selectedFinalQuiz]);

  const finalAvailableQuizzes = useMemo(() => {
    return availableQuizzes.filter((quiz) => !selectedMidtermQuiz || quiz._id !== selectedMidtermQuiz);
  }, [availableQuizzes, selectedMidtermQuiz]);

  // Sync modal selections when opened
  useEffect(() => {
    if (isQuizConfigOpen) {
      setSelectedMidtermQuiz(
        classFromStudents?.midtermQuiz?._id ||
        (typeof classInfo?.midtermQuizId === 'object' ? classInfo?.midtermQuizId?._id : classInfo?.midtermQuizId) ||
        ''
      );
      setSelectedFinalQuiz(
        classFromStudents?.finalQuiz?._id ||
        (typeof classInfo?.finalQuizId === 'object' ? classInfo?.finalQuizId?._id : classInfo?.finalQuizId) ||
        ''
      );
    }
  }, [isQuizConfigOpen, classFromStudents?.midtermQuiz, classFromStudents?.finalQuiz, classInfo?.midtermQuizId, classInfo?.finalQuizId]);

  const handleMidtermQuizChange = (e) => {
    const val = e.target.value;
    setSelectedMidtermQuiz(val);
    if (val && val === selectedFinalQuiz) {
      setSelectedFinalQuiz('');
    }
  };

  const handleFinalQuizChange = (e) => {
    const val = e.target.value;
    setSelectedFinalQuiz(val);
    if (val && val === selectedMidtermQuiz) {
      setSelectedMidtermQuiz('');
    }
  };

  const saveQuizConfig = useMutation({
    mutationFn: () => {
      if (selectedMidtermQuiz && selectedFinalQuiz && selectedMidtermQuiz === selectedFinalQuiz) {
        throw new Error('Không thể chọn cùng một bài Quiz cho cả Giữa kỳ và Cuối kỳ');
      }
      return classesApi.updateGradeConfig(id, {
        midtermQuizId: selectedMidtermQuiz || null,
        finalQuizId: selectedFinalQuiz || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes', id] });
      toast.success('Đã cập nhật cấu hình Quiz cho lớp học phần!');
      setIsQuizConfigOpen(false);
    },
    onError: (err) => toast.error(err.message),
  });

  if (classQuery.isLoading || studentsQuery.isLoading || classQuery.isPending || studentsQuery.isPending) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-3">
        <Spinner />
        <span className="text-xs font-semibold text-slate-500 animate-pulse">
          Đang tải dữ liệu sổ điểm lớp học phần...
        </span>
      </div>
    );
  }
  if (classQuery.isError || studentsQuery.isError) {
    return <div className="rounded-xl border border-red-100 bg-white p-6 text-sm text-red-600">Không tải được sổ điểm lớp học phần.</div>;
  }

  return (
    <div>
      <PageHeader
        title={`Sổ điểm lớp ${classInfo.id}${classInfo.className ? ` (${classInfo.className})` : ''}`}
        subtitle={`Mã HP: ${classInfo.courseId} · Tên HP: ${classInfo.courseName || ''} · ${students.length} sinh viên`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsQuizConfigOpen(true)}
              className="whitespace-nowrap rounded-xl border border-indigo-200 bg-indigo-50/70 px-3.5 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100/80 transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
            >
              <i className="fas fa-sliders" />
              <span>Cấu hình thi (Quiz / Nhập tay)</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/teacher/classes')}
              className="whitespace-nowrap rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition cursor-pointer shadow-2xs flex items-center gap-1.5"
            >
              <i className="fas fa-arrow-left" />
              <span>Quay lại lớp học phần</span>
            </button>
          </div>
        }
      />

      {/* Navigation Tabs Bar for Course Class Detail */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5 bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {/* Tab 1: Sinh viên */}
          <button
            type="button"
            onClick={() => navigate(`/teacher/classes/${id}/students`)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-slate-700 hover:text-indigo-700 hover:bg-white transition cursor-pointer"
          >
            <i className="fas fa-users text-indigo-600" />
            <span>Danh sách sinh viên ({students.length})</span>
          </button>
          {/* Tab 2: Danh sách điểm số (Active) */}
          <button
            type="button"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-white text-amber-700 shadow-xs border border-amber-200 cursor-default"
          >
            <i className="fas fa-table-list text-amber-500 text-sm" />
            <span>Danh sách điểm số (Sổ điểm)</span>
            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold border border-amber-200">
              Đang xem
            </span>
          </button>
          {/* Tab 3: Điểm danh */}
          <button
            type="button"
            onClick={() => navigate(`/teacher/attendance?classId=${id}`)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-slate-700 hover:text-emerald-700 hover:bg-white transition cursor-pointer"
          >
            <i className="fa-solid fa-clipboard-user text-emerald-600" />
            <span>Điểm danh buổi học</span>
          </button>
        </div>

        {/* Back to all classes shortcut */}
        <div className="hidden md:flex items-center gap-2 pr-2">
          <button
            type="button"
            onClick={() => navigate('/teacher/classes')}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1.5 cursor-pointer"
          >
            <i className="fas fa-layer-group text-slate-400" />
            <span>Tất cả lớp học phần</span>
          </button>
        </div>
      </div>

      <div className="mb-4 p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-100/80 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2 text-indigo-900 font-semibold">
          <i className="fas fa-scale-balanced text-indigo-600" />
          <span>Cơ cấu trọng số điểm của lớp:</span>
          <div className="flex flex-wrap items-center gap-1.5 font-medium text-slate-700">
            {activeComponents.map((comp) => (
              <span key={comp.key} className="px-2 py-0.5 rounded-md bg-white border border-indigo-100 text-indigo-700 font-bold">
                {comp.shortLabel}: {weights[comp.key]}%
              </span>
            ))}
          </div>
        </div>
        <div className="text-slate-500 italic">
          * Điểm trung bình (GPA) được tự động tính theo tỷ lệ các cột điểm đã cấu hình.
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 text-emerald-800 font-medium">
          <i className="fas fa-clipboard-check text-emerald-600" />
          <span>Điểm Chuyên cần: Tự động liên kết từ module Điểm danh (hỗ trợ ghi đè khi cần)</span>
        </span>

        {quizConfig.midtermQuiz ? (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 border border-indigo-200/80 px-2.5 py-1 text-indigo-800 font-medium">
            <i className="fas fa-bolt text-indigo-600" />
            <span>Giữa kỳ: Đồng bộ Quiz &quot;{quizConfig.midtermQuiz.title}&quot;</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 border border-slate-200 px-2.5 py-1 text-slate-700">
            <i className="fas fa-pen text-slate-500" />
            <span>Giữa kỳ: Nhập tay trực tiếp</span>
          </span>
        )}

        {quizConfig.finalQuiz ? (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 border border-indigo-200/80 px-2.5 py-1 text-indigo-800 font-medium">
            <i className="fas fa-bolt text-indigo-600" />
            <span>Cuối kỳ: Đồng bộ Quiz &quot;{quizConfig.finalQuiz.title}&quot;</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 border border-slate-200 px-2.5 py-1 text-slate-700">
            <i className="fas fa-pen text-slate-500" />
            <span>Cuối kỳ: Nhập tay trực tiếp</span>
          </span>
        )}
      </div>

      {/* Teacher Gradebook Filter Toolbar */}
      <div className="mb-4 p-4 rounded-2xl bg-white border border-gray-100 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="teacher-status-filter" className="text-xs font-bold text-gray-600 whitespace-nowrap">
              Trạng thái điểm:
            </label>
            <select
              id="teacher-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">Tất cả sinh viên</option>
              <option value="completed">Đã nhập đủ điểm</option>
              <option value="pending">Chưa nhập đủ điểm</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative min-w-[260px]">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo tên hoặc mã SV..."
              className="w-full rounded-xl border border-gray-200 bg-white pl-8 pr-7 py-1.5 text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs cursor-pointer"
                title="Xóa tìm kiếm"
              >
                <i className="fas fa-times" />
              </button>
            )}
          </div>

          {(searchTerm || statusFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-600 hover:bg-gray-50 transition cursor-pointer"
              title="Đặt lại bộ lọc"
            >
              <i className="fas fa-rotate-left text-[10px]" />
              <span>Đặt lại</span>
            </button>
          )}

          <span className="text-xs font-medium text-gray-500 whitespace-nowrap pl-2 border-l border-gray-200">
            Hiển thị <strong className="text-gray-800 font-bold">{filteredStudents.length}</strong>/{students.length} SV
          </span>
        </div>
      </div>

      <div className="overflow-x-auto custom-scrollbar rounded-2xl border border-gray-100 bg-white shadow-sm">
        <table className="min-w-[1100px] w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500 whitespace-nowrap">
              <th className="px-3 py-3">Mã SV</th>
              <th className="px-3 py-3">Họ tên</th>
              {activeComponents.map((comp) => {
                let badgeNode = null;
                if (comp.key === 'attendance') {
                  badgeNode = (
                    <span className="inline-block mt-0.5 text-[9px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                      Tự động điểm danh
                    </span>
                  );
                } else if (comp.key === 'midterm') {
                  badgeNode = quizConfig.midtermQuiz ? (
                    <span
                      className="inline-block mt-0.5 text-[9px] font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-200 max-w-[120px] truncate"
                      title={quizConfig.midtermQuiz.title}
                    >
                      Quiz: {quizConfig.midtermQuiz.title}
                    </span>
                  ) : (
                    <span className="inline-block mt-0.5 text-[9px] font-normal text-slate-400">
                      Nhập tay
                    </span>
                  );
                } else if (comp.key === 'final') {
                  badgeNode = quizConfig.finalQuiz ? (
                    <span
                      className="inline-block mt-0.5 text-[9px] font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-200 max-w-[120px] truncate"
                      title={quizConfig.finalQuiz.title}
                    >
                      Quiz: {quizConfig.finalQuiz.title}
                    </span>
                  ) : (
                    <span className="inline-block mt-0.5 text-[9px] font-normal text-slate-400">
                      Nhập tay
                    </span>
                  );
                }

                return (
                  <th key={comp.key} className="px-3 py-3 text-center">
                    <div>{comp.shortLabel}</div>
                    <div className="text-[10px] font-normal text-indigo-600 lowercase tracking-normal">
                      ({weights[comp.key]}%)
                    </div>
                    {badgeNode}
                  </th>
                );
              })}
              <th className="px-3 py-3 text-center bg-indigo-100/50 text-indigo-900 font-bold border-x border-indigo-100">
                <div>Điểm TB (GPA)</div>
                <div className="text-[10px] font-normal text-indigo-600 lowercase tracking-normal">
                  (tự động tính)
                </div>
              </th>
              <th className="px-3 py-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {students.length === 0 ? (
              <tr>
                <td colSpan={activeComponents.length + 4} className="px-4 py-10 text-center text-gray-400">
                  Chưa có sinh viên đăng ký lớp này.
                </td>
              </tr>
            ) : filteredStudents.length === 0 ? (
              <tr>
                <td colSpan={activeComponents.length + 4} className="px-4 py-10 text-center text-gray-400">
                  <i className="fas fa-filter-circle-xmark text-3xl mb-2 block text-gray-300" />
                  <p className="font-semibold text-gray-600 text-sm">Không tìm thấy sinh viên phù hợp</p>
                  <p className="text-xs text-gray-400 mt-1">Vui lòng kiểm tra lại từ khóa tìm kiếm hoặc bộ lọc trạng thái điểm.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm('');
                      setStatusFilter('all');
                    }}
                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition cursor-pointer"
                  >
                    <i className="fas fa-rotate-left" />
                    <span>Xóa bộ lọc</span>
                  </button>
                </td>
              </tr>
            ) : (
              filteredStudents.map((student) => (
                <StudentGradeRow
                  key={student._id}
                  classId={id}
                  student={student}
                  weights={weights}
                  activeComponents={activeComponents}
                  quizConfig={quizConfig}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Quiz Configuration Modal */}
      <Modal
        open={isQuizConfigOpen}
        onClose={() => setIsQuizConfigOpen(false)}
        title="Cấu hình hình thức thi Giữa kỳ & Cuối kỳ"
        size="lg"
      >
        <div className="space-y-5">
          <p className="text-xs text-slate-500 leading-relaxed">
            Mặc định, các cột điểm Giữa kỳ và Cuối kỳ cho phép giảng viên <strong>nhập điểm thủ công</strong> (áp dụng cho thi tự luận, đồ án, thi tập trung).
            Nếu bạn chọn gắn với một bài kiểm tra trực tuyến (Quiz), điểm số của sinh viên sẽ được <strong>tự động đồng bộ từ bài Quiz</strong> đó (vẫn cho phép giảng viên ghi đè).
          </p>

          <div className="space-y-4">
            <div>
              <label htmlFor="midterm-quiz-select" className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                Cột điểm Giữa kỳ
              </label>
              <select
                id="midterm-quiz-select"
                aria-label="Cột điểm Giữa kỳ"
                value={selectedMidtermQuiz}
                onChange={handleMidtermQuizChange}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition"
              >
                <option value="">✍️ Nhập điểm trực tiếp / thủ công (Mặc định)</option>
                {midtermAvailableQuizzes.map((quiz) => (
                  <option key={quiz._id} value={quiz._id}>
                    📝 [Quiz] {quiz.title} ({quiz.questionCount} câu - Hạn nộp: {quiz.dueDate || 'Không thời hạn'})
                  </option>
                ))}
              </select>
              {selectedFinalQuiz && (
                <p className="mt-1 text-[11px] text-slate-500 flex items-center gap-1 font-medium">
                  <i className="fas fa-filter text-indigo-500 text-[10px]" />
                  Đã tự động ẩn bài Quiz đang dùng ở Cuối kỳ: &quot;{availableQuizzes.find((q) => q._id === selectedFinalQuiz)?.title || selectedFinalQuiz}&quot;
                </p>
              )}
            </div>

            <div>
              <label htmlFor="final-quiz-select" className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                Cột điểm Cuối kỳ
              </label>
              <select
                id="final-quiz-select"
                aria-label="Cột điểm Cuối kỳ"
                value={selectedFinalQuiz}
                onChange={handleFinalQuizChange}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition"
              >
                <option value="">✍️ Nhập điểm trực tiếp / thủ công (Mặc định)</option>
                {finalAvailableQuizzes.map((quiz) => (
                  <option key={quiz._id} value={quiz._id}>
                    📝 [Quiz] {quiz.title} ({quiz.questionCount} câu - Hạn nộp: {quiz.dueDate || 'Không thời hạn'})
                  </option>
                ))}
              </select>
              {selectedMidtermQuiz && (
                <p className="mt-1 text-[11px] text-slate-500 flex items-center gap-1 font-medium">
                  <i className="fas fa-filter text-indigo-500 text-[10px]" />
                  Đã tự động ẩn bài Quiz đang dùng ở Giữa kỳ: &quot;{availableQuizzes.find((q) => q._id === selectedMidtermQuiz)?.title || selectedMidtermQuiz}&quot;
                </p>
              )}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600 flex items-start gap-2">
            <i className="fas fa-circle-info text-indigo-500 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-700">Lưu ý nghiệp vụ:</p>
              <ul className="list-disc list-inside mt-1 space-y-0.5 text-slate-500">
                <li>Bài Quiz được chọn sẽ không còn tính vào điểm trung bình bài tập thường xuyên (Homework).</li>
                <li>Cột Chuyên cần luôn được hệ thống tự động tính từ module Điểm danh (buổi có mặt / tổng số buổi quy về thang 10).</li>
                <li>Giảng viên có thể ghi đè thủ công bất kỳ ô điểm nào trong sổ điểm khi cần điều chỉnh.</li>
              </ul>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsQuizConfigOpen(false)}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={() => saveQuizConfig.mutate()}
              disabled={saveQuizConfig.isPending}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 transition cursor-pointer"
            >
              {saveQuizConfig.isPending ? 'Đang lưu...' : 'Lưu cấu hình'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default TeacherClassGradebook;