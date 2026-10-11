import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import { StudentWeeklySchedule } from './StudentWeeklySchedule.jsx';
import { useMyEnrollments } from './useEnrollments.js';

export function StudentTimetable() {
  const { data, isLoading } = useMyEnrollments();
  if (isLoading) return <Spinner />;

  const classes = (data?.data || []).map((e) => e.class).filter(Boolean);

  return (
    <div>
      <PageHeader title="Thời khóa biểu" />
      {classes.length === 0 ? (
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-8 text-center text-gray-400">
          Bạn chưa đăng ký học phần nào.
        </div>
      ) : (
        <StudentWeeklySchedule classes={classes} />
      )}
    </div>
  );
}

export default StudentTimetable;
