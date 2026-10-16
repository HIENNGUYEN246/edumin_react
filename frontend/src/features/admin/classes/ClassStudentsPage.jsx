import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Avatar } from '../../../components/ui/Avatar.jsx';
import { DataTable } from '../../../components/ui/DataTable.jsx';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { Pagination } from '../../../components/ui/Pagination.jsx';
import { Spinner } from '../../../components/ui/Spinner.jsx';
import { formatStudentCode } from '../../../lib/format.js';
import { useClassStudents } from './useClasses.js';

const PAGE_SIZE = 20;

export function ClassStudentsPage() {
  const { courseId, classId } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError, error } = useClassStudents(classId);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const students = useMemo(() => data?.students || [], [data?.students]);
  const filteredStudents = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    if (!term) return students;
    return students.filter((student) => [
      formatStudentCode(student.id),
      student.hoTen,
      student.email,
      student.className,
    ].some((value) => String(value || '').toLocaleLowerCase().includes(term)));
  }, [search, students]);

  const pages = Math.max(1, Math.ceil(filteredStudents.length / PAGE_SIZE));
  const visibleStudents = filteredStudents.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const cls = data?.class;

  const columns = [
    {
      key: 'avatar',
      header: '',
      className: 'w-14 text-center',
      render: (student) => <Avatar src={student.avatar?.url || student.avatar} name={student.hoTen} size={36} />,
    },
    {
      key: 'code',
      header: 'Mã sinh viên',
      className: 'font-semibold text-gray-800 whitespace-nowrap',
      render: (student) => formatStudentCode(student.id),
    },
    { key: 'hoTen', header: 'Họ và tên', className: 'font-bold text-gray-900 min-w-[180px]' },
    { key: 'email', header: 'Email', className: 'min-w-[220px]' },
    {
      key: 'className',
      header: 'Lớp sinh hoạt',
      render: (student) => student.className
        ? <span className="inline-flex items-center rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">{student.className}</span>
        : <span className="text-xs italic text-gray-400">Chưa phân lớp</span>,
    },
    {
      key: 'department',
      header: 'Khoa',
      render: (student) => student.department || <span className="text-gray-400">—</span>,
    },
  ];

  if (isLoading) return <Spinner />;

  if (isError) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-xs">
        <p className="text-sm text-rose-600">{error?.message || 'Không tải được danh sách sinh viên.'}</p>
        <button
          type="button"
          onClick={() => navigate(`/admin/classes/course/${courseId}`)}
          className="mt-4 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Quay lại lớp học phần
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={() => navigate(`/admin/classes/course/${courseId}`)}
        className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-indigo-600"
      >
        <i className="fas fa-arrow-left" /> Quay lại lớp học phần
      </button>

      <PageHeader
        title="Danh sách sinh viên đăng ký"
        subtitle={`${cls?.courseName || cls?.courseId || ''} · ${cls?.className || cls?.id || ''}`}
        actions={
          <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-2 text-sm font-bold text-indigo-700">
            <i className="fas fa-users mr-2" />
            {students.length} sinh viên
          </div>
        }
      />

      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 p-4">
          <div>
            <h2 className="font-bold text-slate-800">Sinh viên trong lớp</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {filteredStudents.length === students.length
                ? `Danh sách gồm ${students.length} sinh viên`
                : `Tìm thấy ${filteredStudents.length} trong ${students.length} sinh viên`}
            </p>
          </div>
          <div className="relative w-full sm:w-80">
            <i className="fas fa-search pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Tìm mã, tên hoặc email sinh viên..."
              aria-label="Tìm sinh viên"
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
            />
          </div>
        </div>
        <DataTable
          columns={columns}
          rows={visibleStudents}
          rowKey={(student) => student._id}
          emptyText={search ? 'Không tìm thấy sinh viên phù hợp' : 'Chưa có sinh viên đăng ký lớp này'}
          minWidth="min-w-[900px]"
        />
      </section>

      <Pagination
        page={page}
        pages={pages}
        total={filteredStudents.length}
        onPageChange={setPage}
      />
    </div>
  );
}

export default ClassStudentsPage;
