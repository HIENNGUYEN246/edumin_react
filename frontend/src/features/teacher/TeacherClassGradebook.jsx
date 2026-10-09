import { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { classesApi } from '../../api/classesApi.js';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import {
  formatStudentCode,
  DEFAULT_GRADE_WEIGHTS,
  GRADE_COMPONENTS,
  calculateGpa,
  getGpaClassification,
} from '../../lib/format.js';
import { useToast } from '../../app/providers/ToastProvider.jsx';
import { useClassStudents } from './useTeacherClasses.js';

function StudentGradeRow({ classId, student, weights, activeComponents }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [grades, setGrades] = useState(() => ({
    attendance: student.manualGrades?.attendance ?? '',
    presentation: student.manualGrades?.presentation ?? '',
    midterm: student.manualGrades?.midterm ?? '',
    final: student.manualGrades?.final ?? '',
  }));

  const liveGrades = useMemo(() => ({
    ...grades,
    homework: student.homeworkGrade,
  }), [grades, student.homeworkGrade]);

  const liveGpa = useMemo(() => calculateGpa(liveGrades, weights), [liveGrades, weights]);
  const classification = useMemo(() => getGpaClassification(liveGpa), [liveGpa]);

  const saveGrades = useMutation({
    mutationFn: () =>
      classesApi.updateStudentGrades(
        classId,
        student._id,
        Object.fromEntries(
          Object.entries(grades).map(([key, value]) => [key, value === '' ? null : Number(value)])
        )
      ),
    onSuccess: (data) => {
      setGrades({
        attendance: data.manualGrades?.attendance ?? '',
        presentation: data.manualGrades?.presentation ?? '',
        midterm: data.manualGrades?.midterm ?? '',
        final: data.manualGrades?.final ?? '',
      });
      queryClient.invalidateQueries({ queryKey: ['classes', classId, 'students'] });
      toast.success('Đã lưu điểm thành công');
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
  const classQuery = useQuery({ queryKey: ['classes', id, 'detail'], queryFn: () => classesApi.get(id) });
  const studentsQuery = useClassStudents(id);

  const classInfo = classQuery.data;
  const weights = useMemo(() => {
    return classInfo?.gradeWeights || DEFAULT_GRADE_WEIGHTS;
  }, [classInfo?.gradeWeights]);

  const activeComponents = useMemo(() => {
    const list = GRADE_COMPONENTS.filter((comp) => (Number(weights[comp.key]) || 0) > 0);
    return list.length > 0 ? list : GRADE_COMPONENTS.filter((comp) => comp.key !== 'presentation');
  }, [weights]);

  if (classQuery.isLoading || studentsQuery.isLoading) return <Spinner />;
  if (classQuery.isError || studentsQuery.isError) {
    return <div className="rounded-xl border border-red-100 bg-white p-6 text-sm text-red-600">Không tải được sổ điểm lớp học phần.</div>;
  }

  const students = studentsQuery.data?.students || [];

  return (
    <div>
      <PageHeader
        title={`Sổ điểm lớp ${classInfo.id}${classInfo.className ? ` (${classInfo.className})` : ''}`}
        subtitle={`Mã HP: ${classInfo.courseId} · Tên HP: ${classInfo.courseName || ''} · ${students.length} sinh viên`}
        actions={
          <button
            type="button"
            onClick={() => navigate(`/teacher/classes/${id}/students`)}
            className="whitespace-nowrap rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition cursor-pointer"
          >
            <i className="fas fa-arrow-left mr-2" />Danh sách sinh viên
          </button>
        }
      />

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

      {weights.homework > 0 && (
        <p className="mb-3 text-xs text-slate-500 flex items-center gap-1.5">
          <i className="fas fa-circle-info text-indigo-500" />
          Điểm bài tập được tính tự động từ điểm trung bình các quiz; quiz đã quá hạn mà chưa nộp được tính 0.
        </p>
      )}

      <div className="overflow-x-auto custom-scrollbar rounded-2xl border border-gray-100 bg-white shadow-sm">
        <table className="min-w-[1100px] w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500 whitespace-nowrap">
              <th className="px-3 py-3">Mã SV</th>
              <th className="px-3 py-3">Họ tên</th>
              {activeComponents.map((comp) => (
                <th key={comp.key} className="px-3 py-3 text-center">
                  <div>{comp.shortLabel}</div>
                  <div className="text-[10px] font-normal text-indigo-600 lowercase tracking-normal">
                    ({weights[comp.key]}%)
                  </div>
                </th>
              ))}
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
            ) : students.map((student) => (
              <StudentGradeRow
                key={student._id}
                classId={id}
                student={student}
                weights={weights}
                activeComponents={activeComponents}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default TeacherClassGradebook;