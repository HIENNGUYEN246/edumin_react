import { Modal } from '../../../components/ui/Modal.jsx';
import { DataTable } from '../../../components/ui/DataTable.jsx';
import { Spinner } from '../../../components/ui/Spinner.jsx';
import { formatStudentCode } from '../../../lib/format.js';
import { useClassStudents } from './useClasses.js';

export function ClassStudentsModal({ classId, className, onClose }) {
  const { data, isLoading } = useClassStudents(classId);
  const students = data?.students || [];

  return (
    <Modal open onClose={onClose} title={`Sinh viên lớp ${className}`} size="lg">
      {isLoading ? (
        <Spinner />
      ) : (
        <DataTable
          columns={[
            { key: 'code', header: 'Mã SV', render: (s) => formatStudentCode(s.id) },
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

export default ClassStudentsModal;
