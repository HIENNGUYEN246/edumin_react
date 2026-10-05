import { Modal } from '../../../components/ui/Modal.jsx';
import { DataTable } from '../../../components/ui/DataTable.jsx';
import { Spinner } from '../../../components/ui/Spinner.jsx';
import { Avatar } from '../../../components/ui/Avatar.jsx';
import { formatStudentCode } from '../../../lib/format.js';
import { useClassStudents } from './useClasses.js';

export function ClassStudentsModal({ classId, className, onClose }) {
  const { data, isLoading } = useClassStudents(classId);
  const students = data?.students || [];

  return (
    <Modal open onClose={onClose} title={`Danh sách sinh viên lớp học phần: ${className} (${students.length} SV)`} size="lg">
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
            { key: 'code', header: 'Mã SV', className: 'font-semibold text-gray-800', render: (s) => formatStudentCode(s.id) },
            { key: 'hoTen', header: 'Họ tên', className: 'font-bold text-gray-900' },
            { key: 'email', header: 'Email' },
            {
              key: 'className',
              header: 'Lớp sinh hoạt',
              render: (s) => (
                s.className ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                    {s.className}
                  </span>
                ) : (
                  <span className="text-gray-400 text-xs italic">Chưa phân lớp</span>
                )
              ),
            },
          ]}
          rows={students}
          rowKey={(s) => s._id}
          emptyText="Chưa có sinh viên đăng ký"
        />
      )}
    </Modal>
  );
}

export default ClassStudentsModal;
