import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { Spinner } from '../../../components/ui/Spinner.jsx';
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
  const submission = assignment.mySubmission;
  const overdue = isPastDue(assignment.dueDate);
  const missed = quiz && overdue && !submission;
  const count = assignment.questions?.length || 0;

  return (
    <article className="group relative overflow-hidden rounded-3xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition">
      <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${quiz ? 'bg-gradient-to-b from-violet-500 to-indigo-500' : 'bg-gradient-to-b from-sky-500 to-cyan-500'}`} />
      <div className="p-5 pl-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${quiz ? 'text-violet-700 bg-violet-50' : 'text-sky-700 bg-sky-50'}`}>
              <i className={`fas ${quiz ? 'fa-list-check' : 'fa-file-lines'}`} />
              {quiz ? 'Trắc nghiệm' : 'Tệp'}
            </span>
            <span className="text-xs font-semibold text-gray-400">{assignment.courseId}</span>
          </div>
          {assignment.dueDate && (
            <span className={`text-xs font-semibold ${overdue ? 'text-red-500' : 'text-gray-500'}`}>
              <i className="far fa-clock mr-1" />
              {overdue ? 'Hết hạn' : `Hạn ${assignment.dueDate}`}
            </span>
          )}
        </div>

        <h3 className="mt-3 text-lg font-extrabold text-gray-900 leading-6">{assignment.title}</h3>
        {assignment.description && (
          <p className="mt-1 text-sm text-gray-500 line-clamp-2">{assignment.description}</p>
        )}

        <div className="mt-4 flex items-center justify-between">
          {submission ? (
            <div>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                <i className="fas fa-circle-check" /> Hoàn thành
              </span>
              <p className="mt-1 text-xs text-gray-500">Kết quả: <strong className="text-gray-700">{submission.score}/10</strong></p>
            </div>
          ) : missed ? (
            <div>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600">
                <i className="fas fa-circle-xmark" /> Chưa nộp
              </span>
              <p className="mt-1 text-xs text-gray-500">Kết quả: <strong className="text-red-600">0/10</strong></p>
            </div>
          ) : (
            <span className="text-xs text-gray-400">{quiz ? `${count} câu hỏi` : 'Tài liệu đính kèm'}</span>
          )}
          {quiz ? (
            <button
              type="button"
              onClick={() => onOpen(assignment)}
              disabled={overdue && !submission}
              className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submission ? 'Xem kết quả' : overdue ? 'Đã đóng' : 'Làm bài'}
              {(!overdue || submission) && <i className="fas fa-arrow-right ml-2" />}
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
