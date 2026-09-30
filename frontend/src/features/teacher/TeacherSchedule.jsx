import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import { ScheduleGrid } from '../../components/schedule/ScheduleGrid.jsx';
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
        <ScheduleGrid
          classes={classes}
          renderCell={(cls) => (
            <div className="text-xs">
              <p className="font-bold text-indigo-700">{cls.courseName}</p>
              <p className="text-gray-500">Lớp {cls.id}</p>
              {cls.room && <p className="text-gray-400">Phòng {cls.room}</p>}
            </div>
          )}
        />
      )}
    </div>
  );
}

export default TeacherSchedule;
