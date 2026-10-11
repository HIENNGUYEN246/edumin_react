import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import { StudentWeeklySchedule } from '../student/StudentWeeklySchedule.jsx';
import { useMyTeacherClasses } from './useTeacherClasses.js';

export function TeacherSchedule() {
  const { data, isLoading } = useMyTeacherClasses();
  if (isLoading) return <Spinner />;

  const classes = data?.data || [];

  return (
    <div>
      <PageHeader title="Lịch dạy" subtitle="Các lớp học phần bạn phụ trách" />
      {classes.length === 0 ? (
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-8 text-center text-gray-400">
          Bạn chưa được phân công lớp nào.
        </div>
      ) : (
        <StudentWeeklySchedule classes={classes} audience="teacher" />
      )}
    </div>
  );
}

export default TeacherSchedule;
