import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { describeSchedules } from '../../lib/schedule.js';
import { useMyTeacherClasses } from './useTeacherClasses.js';

export function TeacherClassList() {
  const navigate = useNavigate();
  const { data, isLoading } = useMyTeacherClasses();
  const classes = data?.data || [];

  const columns = [
    { key: 'id', header: 'Mã lớp', className: 'font-semibold text-gray-800' },
    { key: 'courseName', header: 'Học phần' },
    { key: 'schedules', header: 'Lịch học', render: (c) => <span className="text-xs">{describeSchedules(c.schedules)}</span> },
    { key: 'room', header: 'Phòng' },
    {
      key: 'action',
      header: '',
      className: 'text-right w-32',
      render: (c) => (
        <button type="button" onClick={() => navigate(`/teacher/classes/${c._id}/students`)} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700">
          Danh sách SV
        </button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Lớp học phần" subtitle="Danh sách lớp bạn phụ trách" />
      <DataTable columns={columns} rows={classes} isLoading={isLoading} emptyText="Bạn chưa được phân công lớp nào" />
    </div>
  );
}

export default TeacherClassList;
