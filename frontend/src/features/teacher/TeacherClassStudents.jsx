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
        title={classInfo ? `Sinh viên lớp ${classInfo.id}${classInfo.className ? ` (${classInfo.className})` : ''}` : 'Danh sách sinh viên'}
        subtitle={classInfo ? `Mã HP: ${classInfo.courseId} · Tên HP: ${classInfo.courseName || ''} · ${students.length} sinh viên` : ''}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/teacher/classes')}
              className="whitespace-nowrap rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 shadow-2xs hover:shadow transition cursor-pointer flex items-center gap-1.5"
            >
              <i className="fas fa-arrow-left" />
              <span>Quay lại lớp học phần</span>
            </button>
            <button
              type="button"
              onClick={() => navigate(`/teacher/classes/${id}/grades`)}
              className="whitespace-nowrap rounded-xl bg-gradient-to-r from-amber-500 via-amber-600 to-indigo-600 hover:from-amber-600 hover:to-indigo-700 px-4 py-2 text-xs font-bold text-white shadow-sm hover:shadow transition active:scale-[0.98] flex items-center gap-2 cursor-pointer ring-2 ring-amber-400/20"
            >
              <i className="fas fa-table-list text-amber-200" />
              <span>Danh sách điểm số</span>
              <span className="px-1.5 py-0.2 rounded-md bg-white/20 text-[10px] font-extrabold uppercase">Sổ điểm</span>
              <i className="fas fa-chevron-right text-[10px] opacity-75" />
            </button>
          </div>
        }
      />

      {/* Navigation Tabs Bar for Course Class Detail */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5 bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {/* Tab 1: Sinh viên (Active) */}
          <button
            type="button"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-white text-indigo-700 shadow-xs border border-indigo-100 cursor-default"
          >
            <i className="fas fa-users text-indigo-600" />
            <span>Danh sách sinh viên ({students.length})</span>
          </button>
          {/* Tab 2: Danh sách điểm số */}
          <button
            type="button"
            onClick={() => navigate(`/teacher/classes/${id}/grades`)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-slate-700 hover:text-amber-700 hover:bg-white transition cursor-pointer"
          >
            <i className="fas fa-table-list text-amber-500 text-sm" />
            <span>Danh sách điểm số (Sổ điểm)</span>
            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold border border-amber-200">
              Nhập điểm
            </span>
          </button>
          {/* Tab 3: Điểm danh */}
          <button
            type="button"
            onClick={() => navigate(`/teacher/attendance?classId=${id}`, { state: { classId: id } })}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-slate-700 hover:text-emerald-700 hover:bg-white transition cursor-pointer"
          >
            <i className="fa-solid fa-clipboard-user text-emerald-600" />
            <span>Điểm danh buổi học</span>
          </button>
        </div>

        {/* Direct quick CTA */}
        <div className="hidden md:flex items-center gap-2 pr-2">
          <button
            type="button"
            onClick={() => navigate(`/teacher/classes/${id}/grades`)}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5 cursor-pointer underline decoration-indigo-300"
          >
            <i className="fas fa-table-cells text-amber-500" />
            <span>Mở nhanh bảng điểm chi tiết</span>
            <i className="fas fa-arrow-right text-[10px]" />
          </button>
        </div>
      </div>

      {/* Quick Gradebook Highlight Banner */}
      <div className="mb-5 p-4 rounded-2xl bg-gradient-to-r from-amber-50/90 via-indigo-50/70 to-white border border-amber-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-400 text-white flex items-center justify-center text-lg shadow-sm shrink-0">
            <i className="fas fa-table-list" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>Sổ điểm & Đánh giá kết quả học tập</span>
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold border border-amber-200">
                Quan trọng
              </span>
            </h4>
            <p className="text-xs text-slate-600 mt-0.5">
              Nhập điểm thành phần (chuyên cần, bài tập, giữa kỳ, thuyết trình, cuối kỳ) và tính GPA tự động cho sinh viên.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate(`/teacher/classes/${id}/grades`)}
          className="self-start sm:self-auto inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-xs hover:shadow transition active:scale-[0.98] cursor-pointer shrink-0"
        >
          <i className="fas fa-pen-to-square text-xs" />
          <span>Vào Danh sách điểm số</span>
          <i className="fas fa-chevron-right text-[10px]" />
        </button>
      </div>
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