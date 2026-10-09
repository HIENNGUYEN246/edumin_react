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
              {cls.courseId && (
                <span className="font-mono text-[10px] font-bold bg-white text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-200 block w-fit mb-1">
                  {cls.courseId}
                </span>
              )}
              <p className="font-bold text-gray-900 leading-tight">{cls.courseName}</p>
              <p className="text-indigo-700 font-semibold text-[11px] mt-0.5">
                {cls.className ? `Lớp ${cls.className}` : `Lớp ${cls.id}`}
              </p>
              {cls.room && <p className="text-gray-500 text-[11px] mt-0.5">Phòng {cls.room}</p>}
            </div>
          )}
        />
      )}
    </div>
  );
}

export default TeacherSchedule;
