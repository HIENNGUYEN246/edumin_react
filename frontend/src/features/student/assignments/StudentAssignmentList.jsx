import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { Spinner } from '../../../components/ui/Spinner.jsx';
import { Avatar } from '../../../components/ui/Avatar.jsx';
import { inputClass } from '../../../components/ui/FormField.jsx';
import { useCourseOptions } from '../../shared/useCourseOptions.js';
import { useAssignments } from '../../shared/useAssignments.js';

function isPastDue(dueDate) {
  if (!dueDate) return false;
  const deadline = new Date(`${dueDate}T23:59:59`);
  return !Number.isNaN(deadline.valueOf()) && new Date() > deadline;
}

function AssignmentCard({ assignment, onOpen }) {
  const quiz = assignment.type === 'quiz';
  const overdue = isPastDue(assignment.dueDate);
  const count = assignment.questions?.length || 0;

  return (
    <article className="group relative overflow-hidden rounded-3xl bg-white border border-gray-100 shadow-sm hover:shadow-md hover:border-teal-200 transition">
      <div
        className={`absolute left-0 top-0 bottom-0 w-1.5 ${
          quiz
            ? 'bg-gradient-to-b from-teal-500 via-emerald-500 to-teal-600'
            : 'bg-gradient-to-b from-cyan-500 to-blue-500'
        }`}
      />
      <div className="p-5 pl-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                quiz
                  ? 'text-teal-800 bg-teal-50/90 border-teal-100'
                  : 'text-cyan-800 bg-cyan-50/90 border-cyan-100'
              }`}
            >
              <i className={`fas ${quiz ? 'fa-list-check' : 'fa-file-lines'}`} />
              {quiz ? 'Trắc nghiệm' : 'Tệp'}
            </span>
            <span className="text-xs font-semibold bg-gray-100 text-gray-700 px-2 py-0.5 rounded-md">
              {assignment.courseId}
            </span>
          </div>
          {assignment.dueDate && (
            <span
              className={`text-xs font-semibold ${
                overdue ? 'text-rose-500' : 'text-teal-700 bg-teal-50/60 px-2 py-0.5 rounded-md'
              }`}
            >
              <i className="far fa-clock mr-1" />
              {overdue ? 'Hết hạn' : `Hạn ${assignment.dueDate}`}
            </span>
          )}
        </div>

        <h3 className="mt-3 text-lg font-extrabold text-gray-900 leading-6 group-hover:text-teal-700 transition">
          {assignment.title}
        </h3>
        {assignment.description && (
          <p className="mt-1 text-sm text-gray-500 line-clamp-2 leading-relaxed">
            {assignment.description}
          </p>
        )}

        {/* Teacher Avatar & Info */}
        {assignment.createdBy && (
          <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-gray-100 text-xs text-gray-500">
            <Avatar
              src={assignment.createdByRef?.avatar?.url || assignment.createdByRef?.avatar}
              name={assignment.createdBy}
              size={22}
            />
            <span className="font-medium text-gray-700 truncate">
              GV: {assignment.createdBy}
            </span>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs font-medium text-gray-400">
            {quiz ? `${count} câu hỏi trắc nghiệm` : 'Tài liệu đính kèm'}
          </span>
          {quiz ? (
            <button
              type="button"
              onClick={() => onOpen(assignment)}
              disabled={overdue}
              className="px-4 py-2 rounded-xl bg-teal-600 text-white text-sm font-bold hover:bg-teal-700 transition shadow-xs shadow-teal-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <span>{overdue ? 'Đã đóng' : 'Làm bài'}</span>
              {!overdue && <i className="fas fa-arrow-right text-xs" />}
            </button>
          ) : (
            <span className="text-xs text-gray-400">Xem ở mục Tài liệu</span>
          )}
        </div>
      </div>
    </article>
  );
}

export function StudentAssignmentList() {
  const navigate = useNavigate();
  const { courses } = useCourseOptions();
  const [courseId, setCourseId] = useState('');
  const { data, isLoading } = useAssignments(courseId);

  const assignments = data?.data || [];

  return (
    <div>
      <PageHeader
        title="Bài tập"
        subtitle="Làm bài trắc nghiệm các học phần bạn theo học"
        actions={
          <select className={inputClass} value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            <option value="">Tất cả học phần</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id} — {c.name}
              </option>
            ))}
          </select>
        }
      />

      {isLoading ? (
        <Spinner />
      ) : assignments.length === 0 ? (
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-10 text-center text-gray-400">
          Chưa có bài tập nào.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {assignments.map((a) => (
            <AssignmentCard key={a._id} assignment={a} onOpen={(item) => navigate(`/student/assignments/${item._id}`)} />
          ))}
        </div>
      )}
    </div>
  );
}

export default StudentAssignmentList;
