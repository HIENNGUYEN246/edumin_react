import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Avatar } from '../../components/ui/Avatar.jsx';
import { formatStudentCode } from '../../lib/format.js';
import { useMyTeacherClasses, useClassStudents } from './useTeacherClasses.js';
import { ScheduleRoomBadge } from '../../components/schedule/ScheduleBadge.jsx';

function StudentsModal({ classId, className, onClose }) {
  const { data, isLoading } = useClassStudents(classId);
  const students = data?.students || [];
  return (
    <Modal open onClose={onClose} title={`Sinh viên lớp ${className}`} size="lg">
      {isLoading ? (
        <Spinner />
      ) : (
        <DataTable
          columns={[
            {
              key: 'avatar',
              header: '',
              className: 'w-12 text-center',
              render: (s) => <Avatar src={s.avatar?.url || s.avatar} name={s.hoTen} size={34} />,
            },
            { key: 'id', header: 'Mã SV', className: 'font-semibold text-gray-800', render: (s) => formatStudentCode(s.id) },
            { key: 'hoTen', header: 'Họ tên', className: 'font-bold text-gray-900' },
            { key: 'email', header: 'Email' },
            { key: 'className', header: 'Lớp' },
          ]}
          rows={students}
          rowKey={(s) => s._id}
          emptyText="Chưa có sinh viên đăng ký"
        />
      )}
    </Modal>
  );
}

export function TeacherClassList() {
  const [selected, setSelected] = useState(null);
  const { data, isLoading } = useMyTeacherClasses();
  const classes = data?.data || [];

  const columns = [
    { key: 'id', header: 'Mã lớp', className: 'font-semibold text-gray-800 w-28' },
    {
      key: 'courseName',
      header: 'Học phần',
      render: (c) => (
        <span className="font-bold text-gray-900 truncate max-w-[240px] block" title={c.courseName}>
          {c.courseName}
        </span>
      ),
    },
    {
      key: 'schedules',
      header: 'Lịch học & Phòng',
      render: (c) => (
        <ScheduleRoomBadge
          schedules={c.schedules}
          room={c.room}
          studyStart={c.studyStart}
          studyEnd={c.studyEnd}
        />
      ),
    },
    {
      key: 'action',
      header: '',
      className: 'text-right w-48',
      render: (c) => (
        <div className="flex justify-end items-center gap-2">
          <Link
            to={`/teacher/attendance?classId=${c._id}`}
            className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 inline-flex items-center gap-1.5 shadow-xs hover:shadow transition active:scale-[0.98]"
          >
            <i className="fa-solid fa-clipboard-user text-[11px]" />
            <span>Điểm danh</span>
          </Link>
          <button
            type="button"
            onClick={() => setSelected(c)}
            className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 shadow-xs hover:shadow transition active:scale-[0.98]"
          >
            Danh sách SV
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Lớp học phần" subtitle="Danh sách lớp bạn phụ trách" />
      <DataTable columns={columns} rows={classes} isLoading={isLoading} emptyText="Bạn chưa được phân công lớp nào" />
      {selected && (
        <StudentsModal
          classId={selected._id || selected.id}
          className={selected.courseName ? `${selected.courseName} (${selected.id})` : selected.id}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

export default TeacherClassList;
