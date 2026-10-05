import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { classesApi } from '../../api/classesApi.js';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { formatStudentCode } from '../../lib/format.js';
import { useClassStudents } from './useTeacherClasses.js';

export function TeacherClassStudents() {
  const navigate = useNavigate();
  const { id } = useParams();
  const classQuery = useQuery({ queryKey: ['classes', id, 'detail'], queryFn: () => classesApi.get(id) });
  const studentsQuery = useClassStudents(id);
  const students = studentsQuery.data?.students || [];
  const classInfo = classQuery.data;

  return (
    <div>
      <PageHeader
        title={classInfo ? `Sinh viên lớp ${classInfo.id}` : 'Danh sách sinh viên'}
        subtitle={classInfo ? `${classInfo.courseId} · ${classInfo.courseName || ''} · ${students.length} sinh viên` : ''}
        actions={
          <>
            <button
              type="button"
              onClick={() => navigate('/teacher/classes')}
              className="whitespace-nowrap rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
            >
              <i className="fas fa-arrow-left mr-2" />Về lớp học phần
            </button>
            <button
              type="button"
              onClick={() => navigate(`/teacher/classes/${id}/grades`)}
              className="whitespace-nowrap rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              <i className="fas fa-table-list mr-2" />Sổ điểm
            </button>
          </>
        }
      />
      {classQuery.isError || studentsQuery.isError ? (
        <div className="rounded-xl border border-red-100 bg-white p-6 text-sm text-red-600">Không tải được danh sách sinh viên.</div>
      ) : (
        <DataTable
          columns={[
            { key: 'ordinal', header: 'STT' },
            { key: 'id', header: 'Mã SV', render: (student) => formatStudentCode(student.id) },
            { key: 'hoTen', header: 'Họ tên', className: 'font-medium text-gray-800' },
            { key: 'email', header: 'Email' },
            { key: 'className', header: 'Lớp' },
          ]}
          rows={students.map((student, index) => ({ ...student, ordinal: index + 1 }))}
          rowKey={(student) => student._id}
          isLoading={classQuery.isLoading || studentsQuery.isLoading}
          emptyText="Chưa có sinh viên đăng ký lớp này"
        />
      )}
    </div>
  );
}

export default TeacherClassStudents;