import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Spinner } from '../../../components/ui/Spinner.jsx';
import { assignmentsApi } from '../../../api/assignmentsApi.js';
import { QuizPlayer } from './QuizPlayer.jsx';

export function StudentQuizPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const assignmentQuery = useQuery({
    queryKey: ['assignments', id, 'detail'],
    queryFn: () => assignmentsApi.get(id),
  });
  const submissionQuery = useQuery({
    queryKey: ['assignments', id, 'my-submission'],
    queryFn: () => assignmentsApi.mySubmission(id),
  });

  const loading = assignmentQuery.isLoading || submissionQuery.isLoading;

  if (loading) return <Spinner label="Đang tải bài tập..." />;

  if (assignmentQuery.isError) {
    return (
      <div className="max-w-2xl mx-auto rounded-2xl bg-white border border-gray-100 shadow-sm p-10 text-center">
        <div className="w-14 h-14 mx-auto rounded-full bg-red-100 text-red-600 flex items-center justify-center text-2xl mb-3">
          <i className="fas fa-triangle-exclamation" />
        </div>
        <p className="text-gray-600">{assignmentQuery.error.message || 'Không mở được bài tập này.'}</p>
        <button
          type="button"
          onClick={() => navigate('/student/assignments')}
          className="mt-5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700"
        >
          Quay lại danh sách
        </button>
      </div>
    );
  }

  const assignment = assignmentQuery.data;
  const submission = submissionQuery.data?.submission || null;
  const prior = submission
    ? {
        score: submission.score,
        correctCount: submissionQuery.data.answerKey
          ? submissionQuery.data.answerKey.filter((k) => Number(submission.answers?.[k.id]) === Number(k.correctIndex)).length
          : 0,
        total: assignment.questions?.length || 0,
        answerKey: submissionQuery.data.answerKey || [],
      }
    : null;

  return (
    <div className="max-w-3xl mx-auto">
      <button
        type="button"
        onClick={() => navigate('/student/assignments')}
        className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-indigo-600 mb-4"
      >
        <i className="fas fa-arrow-left" /> Danh sách bài tập
      </button>

      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-500">
          {assignment.courseId} · Trắc nghiệm
        </p>
        <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 mt-1">{assignment.title}</h1>
        {assignment.description && <p className="text-gray-500 mt-2">{assignment.description}</p>}
        <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-500">
          <span><i className="fas fa-list-ol mr-1.5" />{assignment.questions?.length || 0} câu hỏi</span>
          {assignment.dueDate && <span><i className="far fa-clock mr-1.5" />Hạn nộp {assignment.dueDate}</span>}
          {submission && <span className="text-emerald-600 font-semibold"><i className="fas fa-circle-check mr-1.5" />Đã nộp</span>}
        </div>
      </div>

      <QuizPlayer assignment={assignment} initialResult={prior} initialAnswers={submission?.answers} />
    </div>
  );
}

export default StudentQuizPage;
