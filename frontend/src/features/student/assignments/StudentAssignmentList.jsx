import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { DataTable } from '../../../components/ui/DataTable.jsx';
import { Modal } from '../../../components/ui/Modal.jsx';
import { inputClass } from '../../../components/ui/FormField.jsx';
import { Spinner } from '../../../components/ui/Spinner.jsx';
import { useCourseOptions } from '../../shared/useCourseOptions.js';
import { useAssignments } from '../../shared/useAssignments.js';
import { assignmentsApi } from '../../../api/assignmentsApi.js';
import { QuizPlayer } from './QuizPlayer.jsx';

function QuizModal({ assignment, onClose }) {
  // Load any prior submission so a returning student sees their result + key.
  const { data, isLoading } = useQuery({
    queryKey: ['assignments', assignment._id, 'my-submission'],
    queryFn: () => assignmentsApi.mySubmission(assignment._id),
  });

  const prior = data?.submission
    ? { score: data.submission.score, answerKey: data.answerKey || [] }
    : null;

  return (
    <Modal open onClose={onClose} title={assignment.title} size="lg">
      {isLoading ? <Spinner /> : <QuizPlayer assignment={assignment} initialResult={prior} />}
    </Modal>
  );
}

export function StudentAssignmentList() {
  const { courses } = useCourseOptions();
  const [courseId, setCourseId] = useState('');
  const { data, isLoading } = useAssignments(courseId);
  const [active, setActive] = useState(null);

  const assignments = data?.data || [];

  const columns = [
    { key: 'title', header: 'Tiêu đề', className: 'font-semibold text-gray-800' },
    { key: 'courseId', header: 'Học phần' },
    { key: 'type', header: 'Loại', render: (a) => (a.type === 'quiz' ? 'Trắc nghiệm' : 'Tệp') },
    { key: 'dueDate', header: 'Hạn nộp', render: (a) => a.dueDate || '—' },
    {
      key: 'action',
      header: '',
      className: 'text-right w-28',
      render: (a) =>
        a.type === 'quiz' ? (
          <button type="button" onClick={() => setActive(a)} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700">
            Làm bài
          </button>
        ) : (
          <span className="text-xs text-gray-400">Tệp</span>
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Bài tập"
        subtitle="Làm bài trắc nghiệm các học phần bạn theo học"
        actions={
          <select className={inputClass} value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            <option value="">Tất cả học phần</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.id} — {c.name}</option>
            ))}
          </select>
        }
      />
      <DataTable columns={columns} rows={assignments} isLoading={isLoading} emptyText="Chưa có bài tập" />
      {active && <QuizModal assignment={active} onClose={() => setActive(null)} />}
    </div>
  );
}

export default StudentAssignmentList;
