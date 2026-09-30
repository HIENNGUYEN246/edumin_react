import { useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { describeSchedules } from '../../lib/schedule.js';
import { formatStudentCode } from '../../lib/format.js';
import { useMyTeacherClasses, useClassStudents } from './useTeacherClasses.js';

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
            { key: 'id', header: 'Mã SV', render: (s) => formatStudentCode(s.id) },
            { key: 'hoTen', header: 'Họ tên' },
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
  const { data, isLoading } = useMyTeacherClasses();
  const [selected, setSelected] = useState(null);

  if (isLoading) return <Spinner />;
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
        <button type="button" onClick={() => setSelected(c)} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700">
          Danh sách SV
        </button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Lớp học phần" subtitle="Danh sách lớp bạn phụ trách" />
      <DataTable columns={columns} rows={classes} emptyText="Bạn chưa được phân công lớp nào" />
      {selected && <StudentsModal classId={selected._id} className={selected.id} onClose={() => setSelected(null)} />}
    </div>
  );
}

export default TeacherClassList;
