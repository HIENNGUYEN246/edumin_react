import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { classesApi } from '../../api/classesApi.js';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import { formatStudentCode } from '../../lib/format.js';
import { useToast } from '../../app/providers/ToastProvider.jsx';
import { useClassStudents } from './useTeacherClasses.js';

const MANUAL_GRADE_FIELDS = [
  { key: 'attendance', label: 'Điểm chuyên cần' },
  { key: 'midterm', label: 'Điểm kiểm tra giữa kỳ' },
  { key: 'assignment', label: 'Điểm tiểu luận' },
  { key: 'presentation', label: 'Điểm thuyết trình' },
  { key: 'practical', label: 'Điểm thực hành' },
  { key: 'final', label: 'Điểm thi cuối kỳ' },
];

function StudentGradeRow({ classId, student, ordinal }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [grades, setGrades] = useState(() =>
    Object.fromEntries(MANUAL_GRADE_FIELDS.map(({ key }) => [key, student.manualGrades?.[key] ?? '']))
  );
  const saveGrades = useMutation({
    mutationFn: () => classesApi.updateStudentGrades(classId, student._id, grades),
    onSuccess: (data) => {
      setGrades(Object.fromEntries(MANUAL_GRADE_FIELDS.map(({ key }) => [key, data.manualGrades?.[key] ?? ''])));
      queryClient.invalidateQueries({ queryKey: ['classes', classId, 'students'] });
      toast.success('Đã lưu điểm');
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <tr className="border-t border-gray-100 hover:bg-indigo-50/30">
      <td className="px-3 py-3 text-gray-500">{ordinal}</td>
      <td className="whitespace-nowrap px-3 py-3 font-semibold text-gray-700">{formatStudentCode(student.id)}</td>
      <td className="whitespace-nowrap px-3 py-3 font-medium text-gray-800">{student.hoTen}</td>
      {MANUAL_GRADE_FIELDS.slice(0, 2).map(({ key, label }) => (
        <td key={key} className="px-3 py-3">
          <input
            aria-label={`${label} - ${student.hoTen}`}
            type="number"
            min="0"
            max="10"
            step="0.1"
            value={grades[key]}
            onChange={(event) => setGrades((current) => ({ ...current, [key]: event.target.value }))}
            className="w-24 rounded-lg border border-gray-200 px-2.5 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
        </td>
      ))}
      <td className="px-3 py-3">
        <div className="font-bold text-gray-800">{student.homeworkGrade == null ? '—' : `${student.homeworkGrade}/10`}</div>
        <div className="mt-0.5 text-xs text-gray-400">{student.homeworkQuizCount}/{student.homeworkQuizTotal} quiz</div>
      </td>
      {MANUAL_GRADE_FIELDS.slice(2).map(({ key, label }) => (
        <td key={key} className="px-3 py-3">
          <input
            aria-label={`${label} - ${student.hoTen}`}
            type="number"
            min="0"
            max="10"
            step="0.1"
            value={grades[key]}
            onChange={(event) => setGrades((current) => ({ ...current, [key]: event.target.value }))}
            className="w-24 rounded-lg border border-gray-200 px-2.5 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
        </td>
      ))}
      <td className="px-3 py-3 text-right">
        <button
          type="button"
          onClick={() => saveGrades.mutate()}
          disabled={saveGrades.isPending}
          className="whitespace-nowrap rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
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

  if (classQuery.isLoading || studentsQuery.isLoading) return <Spinner />;
  if (classQuery.isError || studentsQuery.isError) {
    return <div className="rounded-xl border border-red-100 bg-white p-6 text-sm text-red-600">Không tải được sổ điểm lớp học phần.</div>;
  }

  const classInfo = classQuery.data;
  const students = studentsQuery.data?.students || [];

  return (
    <div>
      <PageHeader
        title={`Sổ điểm lớp ${classInfo.id}`}
        subtitle={`${classInfo.courseId} · ${classInfo.courseName || ''} · ${students.length} sinh viên`}
        actions={
          <button
            type="button"
            onClick={() => navigate(`/teacher/classes/${id}/students`)}
            className="whitespace-nowrap rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
          >
            <i className="fas fa-arrow-left mr-2" />Danh sách sinh viên
          </button>
        }
      />

      <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
        <table className="min-w-[1400px] w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
              <th className="px-3 py-3">STT</th>
              <th className="px-3 py-3">Mã SV</th>
              <th className="px-3 py-3">Họ tên</th>
              <th className="px-3 py-3">Điểm chuyên cần</th>
              <th className="px-3 py-3">Điểm kiểm tra giữa kỳ</th>
              <th className="px-3 py-3">Điểm bài tập về nhà</th>
              <th className="px-3 py-3">Điểm tiểu luận</th>
              <th className="px-3 py-3">Điểm thuyết trình</th>
              <th className="px-3 py-3">Điểm thực hành</th>
              <th className="px-3 py-3">Điểm thi cuối kỳ</th>
              <th className="px-3 py-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {students.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-10 text-center text-gray-400">Chưa có sinh viên đăng ký lớp này.</td>
              </tr>
            ) : students.map((student, index) => (
              <StudentGradeRow key={student._id} classId={id} student={student} ordinal={index + 1} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default TeacherClassGradebook;