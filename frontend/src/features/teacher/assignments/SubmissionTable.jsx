import { DataTable } from '../../../components/ui/DataTable.jsx';
import { Spinner } from '../../../components/ui/Spinner.jsx';
import { formatStudentCode } from '../../../lib/format.js';
import { useSubmissions } from '../../shared/useAssignments.js';

export function SubmissionTable({ assignmentId }) {
  const { data, isLoading } = useSubmissions(assignmentId);
  if (isLoading) return <Spinner />;
  const rows = data?.data || [];
  return (
    <DataTable
      columns={[
        { key: 'code', header: 'Mã SV', render: (s) => formatStudentCode(s.student?.id ?? s.studentId) },
        { key: 'name', header: 'Họ tên', render: (s) => s.student?.hoTen || s.studentName },
        { key: 'score', header: 'Điểm', render: (s) => (s.score != null ? `${s.score}/10` : '—') },
        { key: 'submittedAt', header: 'Nộp lúc', render: (s) => new Date(s.submittedAt).toLocaleString('vi-VN') },
      ]}
      rows={rows}
      rowKey={(s) => s._id}
      emptyText="Chưa có bài nộp"
    />
  );
}

export default SubmissionTable;
