import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { useMyTeacherClasses } from './useTeacherClasses.js';
import {
  ScheduleTimeCombinedBadge,
  RoomBadge,
} from '../../components/schedule/ScheduleBadge.jsx';
import { setAiPageContext } from '../../components/ai/EduMinAiAssistant.jsx';

export function TeacherClassList() {
  const { data, isLoading } = useMyTeacherClasses();
  const classes = data?.data || [];

  // Sync real-time classes context with EduMin AI Assistant
  useEffect(() => {
    if (classes.length > 0) {
      setAiPageContext({
        page: 'teacher_classes',
        myClasses: classes,
      });
    }
  }, [classes]);

  const columns = [
    { key: 'courseId', header: 'Mã học phần', className: 'font-semibold text-gray-800 w-28' },
    { key: 'id', header: 'Mã lớp học phần', className: 'font-semibold text-gray-800 w-32' },
    {
      key: 'courseName',
      header: 'Tên học phần',
      render: (c) => (
        <span className="font-bold text-gray-900 truncate max-w-[220px] block" title={c.courseName}>
          {c.courseName}
        </span>
      ),
    },
    {
      key: 'className',
      header: 'Tên lớp học phần',
      render: (c) => (
        <span className="font-medium text-gray-800 truncate max-w-[200px] block" title={c.className || ''}>
          {c.className || '—'}
        </span>
      ),
    },
    {
      key: 'schedules',
      header: 'Thời gian học',
      className: 'min-w-[220px]',
      render: (c) => <ScheduleTimeCombinedBadge schedules={c.schedules} />,
    },
    {
      key: 'room',
      header: 'Phòng học',
      className: 'min-w-[130px]',
      render: (c) => (
        <RoomBadge
          room={c.room}
          studyStart={c.studyStart}
          studyEnd={c.studyEnd}
        />
      ),
    },
    {
      key: 'action',
      header: 'Thao tác',
      className: 'text-right w-72',
      render: (c) => (
        <div className="flex justify-end items-center gap-2">
          <Link
            to={`/teacher/classes/${c._id || c.id}/grades`}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white text-xs font-semibold hover:from-amber-600 hover:to-amber-700 inline-flex items-center gap-1.5 shadow-xs hover:shadow transition active:scale-[0.98]"
            aria-label={`Danh sách điểm số lớp ${c.id}`}
            title="Xem và quản lý sổ điểm lớp học phần"
          >
            <i className="fas fa-table-list text-[11px]" />
            <span>Điểm số</span>
          </Link>
          <Link
            to={`/teacher/attendance?classId=${c._id}`}
            className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 inline-flex items-center gap-1.5 shadow-xs hover:shadow transition active:scale-[0.98]"
          >
            <i className="fa-solid fa-clipboard-user text-[11px]" />
            <span>Điểm danh</span>
          </Link>
          <Link
            to={`/teacher/classes/${c._id || c.id}/students`}
            className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 shadow-xs hover:shadow transition active:scale-[0.98] inline-flex items-center gap-1.5"
            aria-label={`Danh sách sinh viên lớp ${c.id}`}
          >
            <i className="fas fa-users text-[11px]" />
            <span>Sinh viên</span>
          </Link>
        </div>
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
