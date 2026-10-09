import { useRef, useState } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DataTable } from '../../../components/ui/DataTable.jsx';
import { Spinner } from '../../../components/ui/Spinner.jsx';
import { useToast } from '../../../app/providers/ToastProvider.jsx';
import { useConfirm } from '../../../app/providers/ConfirmProvider.jsx';
import {
  formatCurrency,
  registrationDateTimeInput,
  formatRegistrationDateTime,
} from '../../../lib/format.js';
import { coursesApi } from '../../../api/coursesApi.js';
import { CLASS_STATUSES } from '../../../api/classesApi.js';
import { useCourseClasses, useClassMutations } from '../classes/useClasses.js';
import { ClassStatusBadge } from '../classes/ClassStatusBadge.jsx';
import { ClassFormModal } from '../classes/ClassFormModal.jsx';
import { ClassStudentsModal } from '../classes/ClassStudentsModal.jsx';
import { Avatar } from '../../../components/ui/Avatar.jsx';
import { ScheduleRoomBadge } from '../../../components/schedule/ScheduleBadge.jsx';
import { classesApi } from '../../../api/classesApi.js';
import { teachersApi } from '../../../api/teachersApi.js';
import { readSheet, exportSheet } from '../../../lib/excel.js';
import { classExportRow, classImportPayload } from '../classes/classExcel.js';

export function CourseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const fromClasses = location.pathname.startsWith('/admin/classes/course/');
  const backPath = fromClasses ? '/admin/classes' : '/admin/courses';
  const backLabel = fromClasses ? 'Quản lý lớp học phần' : 'Danh mục môn học';
  const toast = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const importFileRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const courseQuery = useQuery({ queryKey: ['courses', id, 'detail'], queryFn: () => coursesApi.get(id) });
  const course = courseQuery.data;
  const { data: classData, isLoading: classesLoading } = useCourseClasses(course?.id);
  const { create, update, changeStatus, remove } = useClassMutations();

  const [formModal, setFormModal] = useState(null); // {mode, initial?}
  const [studentsOf, setStudentsOf] = useState(null);

  const classes = classData?.data || [];

  const openCreate = () => setFormModal({ mode: 'create' });
  const openEdit = (cls) =>
    setFormModal({
      mode: 'edit',
      cls,
      initial: {
        id: cls.id,
        courseId: course.id,
        className: cls.className || '',
        teacherId: cls.teacherId || '',
        room: cls.room || '',
        capacity: cls.capacity || 0,
        schedules: cls.schedules || [],
        studyStart: cls.studyStart || '',
        studyEnd: cls.studyEnd || '',
        registrationStart: registrationDateTimeInput(cls.registrationStart),
        registrationEnd: registrationDateTimeInput(cls.registrationEnd, true),
        status: cls.status || 'Nháp',
      },
    });

  const handleSubmit = async (payload, setErrors) => {
    try {
      if (formModal.mode === 'create') {
        await create.mutateAsync(payload);
        toast.success('Đã thêm lớp');
      } else {
        // Drop the class code from the edit payload; the id below is the Mongo _id.
        const { id: _code, ...changes } = payload;
        void _code;
        await update.mutateAsync({ id: formModal.cls._id, ...changes });
        toast.success('Đã cập nhật lớp');
      }
      setFormModal(null);
    } catch (error) {
      const fieldErrors = {};
      for (const detail of error.details || []) {
        if (detail.path) fieldErrors[detail.path] = detail.message;
      }
      if (error.code === 'DUPLICATE_KEY') {
        fieldErrors.id = 'Mã lớp đã tồn tại';
      } else if (/giáo viên trùng lịch/i.test(error.message)) {
        fieldErrors.teacherId = error.message;
      } else if (/phòng .* đã được sử dụng/i.test(error.message)) {
        fieldErrors.room = error.message;
      } else if (/thời gian bắt đầu đăng ký/i.test(error.message)) {
        fieldErrors.registrationStart = error.message;
      } else if (/thời gian đăng ký/i.test(error.message)) {
        fieldErrors.registrationEnd = error.message;
      } else if (/15 tuần|ngày bắt đầu học/i.test(error.message)) {
        fieldErrors.studyEnd = error.message;
      } else if (/lịch học/i.test(error.message)) {
        fieldErrors.schedules = error.message;
      } else if (/giáo viên/i.test(error.message)) {
        fieldErrors.teacherId = error.message;
      } else if (/học phần/i.test(error.message)) {
        fieldErrors.courseId = error.message;
      }

      if (Object.keys(fieldErrors).length) setErrors(fieldErrors);
      else toast.error(error.message, 5000);
    }
  };

  const onImportClasses = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setImporting(true);
    try {
      const [rows, teacherResponse] = await Promise.all([
        readSheet(file),
        teachersApi.list({ limit: 500 }),
      ]);
      if (!rows.length) throw new Error('File Excel chưa có dữ liệu để nhập');
      const teachers = teacherResponse.data || [];
      let created = 0;
      const failures = [];

      for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index];
        if (Object.values(row).every((value) => String(value ?? '').trim() === '')) continue;
        try {
          const payload = classImportPayload(row, course.id, teachers);
          if (!payload.id) delete payload.id;
          await classesApi.create(payload);
          created += 1;
        } catch (error) {
          const details = error.details?.map((detail) => detail.message).filter(Boolean);
          failures.push({
            row: index + 2,
            message: details?.length ? details.join(', ') : error.message,
          });
        }
      }

      if (created) await queryClient.invalidateQueries({ queryKey: ['classes'] });
      if (failures.length) {
        const summary = failures.slice(0, 4)
          .map((failure) => `Dòng ${failure.row}: ${failure.message}`)
          .join(' · ');
        toast.error(`Đã nhập ${created} lớp; ${failures.length} dòng lỗi. ${summary}`, 10000);
      } else if (created) {
        toast.success(`Đã nhập ${created} lớp học phần`);
      } else {
        toast.error('Không tìm thấy dòng dữ liệu hợp lệ trong file');
      }
    } catch (error) {
      toast.error(error.message || 'Không đọc được file Excel');
    } finally {
      setImporting(false);
    }
  };

  const onExportClasses = async () => {
    setExporting(true);
    try {
      await exportSheet(classes.map(classExportRow), {
        fileName: `lop-hoc-phan-${course.id}.xlsx`,
        sheetName: 'Danh sach lop',
      });
      toast.success('Đã xuất danh sách lớp học phần');
    } catch (error) {
      toast.error(error.message || 'Không xuất được file Excel');
    } finally {
      setExporting(false);
    }
  };

  const onChangeStatus = async (cls, status) => {
    try {
      await changeStatus.mutateAsync({ id: cls._id, status });
      toast.success(`Đã chuyển "${cls.id}" sang ${status}`);
    } catch (error) {
      toast.error(error.message);
    }
  };

  const onDelete = async (cls) => {
    const ok = await confirm({
      title: 'Xóa lớp',
      message: `Xóa lớp "${cls.id}"? Các đăng ký của sinh viên trong lớp sẽ bị xóa.`,
      confirmText: 'Xóa',
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(cls._id);
      toast.success('Đã xóa lớp');
    } catch (error) {
      toast.error(error.message);
    }
  };

  if (courseQuery.isLoading) return <Spinner />;
  if (courseQuery.isError) {
    return (
      <div className="max-w-xl mx-auto rounded-2xl bg-white border border-gray-100 shadow-sm p-10 text-center">
        <p className="text-gray-600">{courseQuery.error.message || 'Không tìm thấy học phần.'}</p>
        <button type="button" onClick={() => navigate(backPath)} className="mt-5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700">
          Quay lại
        </button>
      </div>
    );
  }

  const columns = [
    { key: 'id', header: 'Mã lớp', className: 'font-semibold text-gray-800' },
    { key: 'className', header: 'Tên lớp học phần', render: (c) => c.className || '—' },
    {
      key: 'teacher',
      header: 'Giáo viên',
      render: (c) =>
        c.teacher ? (
          <div className="flex items-center gap-2">
            <Avatar src={c.teacherRef?.avatar?.url || c.teacherRef?.avatar} name={c.teacher} size={28} />
            <span className="font-semibold text-gray-800 text-xs">{c.teacher}</span>
          </div>
        ) : (
          <span className="text-gray-400 text-xs italic">Chưa phân công</span>
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
      key: 'capacity',
      header: 'Sĩ số',
      render: (c) => (
        <span className={c.capacity > 0 && c.enrolledCount >= c.capacity ? 'text-red-600 font-semibold' : ''}>
          {c.enrolledCount}
          {c.capacity > 0 ? `/${c.capacity}` : ''}
        </span>
      ),
    },
    {
      key: 'registrationPeriod',
      header: 'Thời gian đăng ký',
      render: (c) => (
        <span className="text-xs text-gray-600 whitespace-nowrap">
          {formatRegistrationDateTime(c.registrationStart)}
          {' – '}
          {formatRegistrationDateTime(c.registrationEnd, true)}
        </span>
      ),
    },
    { key: 'status', header: 'Trạng thái', render: (c) => <ClassStatusBadge status={c.status} /> },
    {
      key: 'actions',
      header: '',
      className: 'text-right w-64',
      render: (c) => (
        <div className="flex justify-end items-center gap-2">
          <select
            value={c.status}
            onChange={(e) => onChangeStatus(c, e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-indigo-500 outline-none"
            title="Đổi trạng thái"
          >
            {CLASS_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => setStudentsOf({ id: c.id, name: `${course.name} (${c.id})` })} className="w-8 h-8 rounded-lg text-gray-600 hover:bg-gray-100" title="Sinh viên">
            <i className="fas fa-users" />
          </button>
          <button type="button" onClick={() => openEdit(c)} className="w-8 h-8 rounded-lg text-indigo-600 hover:bg-indigo-50" title="Sửa">
            <i className="fas fa-pen" />
          </button>
          <button type="button" onClick={() => onDelete(c)} className="w-8 h-8 rounded-lg text-red-600 hover:bg-red-50" title="Xóa">
            <i className="fas fa-trash-alt" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <button
        type="button"
        onClick={() => navigate(backPath)}
        className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-indigo-600 mb-4"
      >
        <i className="fas fa-arrow-left" /> {backLabel}
      </button>

      {/* Course info */}
      <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-6 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-500">{course.id}</p>
            <h1 className="text-2xl font-extrabold text-gray-900 mt-1">{course.name}</h1>
            <p className="text-sm text-gray-500 mt-1">{course.department || 'Chưa xác định khoa'}</p>
          </div>
          <div className="flex gap-6 text-sm">
            <div>
              <p className="text-gray-400">Tín chỉ</p>
              <p className="text-lg font-bold text-gray-800">{course.credits}</p>
            </div>
            <div>
              <p className="text-gray-400">Học phí định mức</p>
              <p className="text-lg font-bold text-gray-800">{formatCurrency(course.fee)}</p>
            </div>
            <div>
              <p className="text-gray-400">Số lớp học phần</p>
              <p className="text-lg font-bold text-gray-800">{classes.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Classes */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-gray-800">Các lớp học phần mở</h2>
        <div className="flex flex-wrap justify-end gap-2">
          <input
            ref={importFileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={onImportClasses}
          />
          <button
            type="button"
            onClick={onExportClasses}
            disabled={exporting || classesLoading}
            className="px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm font-semibold hover:bg-emerald-100 disabled:opacity-60"
          >
            <i className="fas fa-file-export mr-1.5" /> {exporting ? 'Đang xuất...' : 'Xuất Excel'}
          </button>
          <button
            type="button"
            onClick={() => importFileRef.current?.click()}
            disabled={importing}
            className="px-3 py-2 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 text-sm font-semibold hover:bg-indigo-100 disabled:opacity-60"
          >
            <i className="fas fa-file-import mr-1.5" /> {importing ? 'Đang nhập...' : 'Nhập Excel'}
          </button>
          <button type="button" onClick={openCreate} className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700">
            <i className="fas fa-plus mr-1.5" /> Thêm lớp
          </button>
        </div>
      </div>
      <DataTable columns={columns} rows={classes} isLoading={classesLoading} emptyText="Môn học này chưa có lớp học phần nào được mở" />

      {formModal && (
        <ClassFormModal
          open
          mode={formModal.mode}
          courseId={course.id}
          initial={formModal.initial}
          onClose={() => setFormModal(null)}
          onSubmit={handleSubmit}
          saving={create.isPending || update.isPending}
        />
      )}

      {studentsOf && (
        <ClassStudentsModal classId={studentsOf.id} className={studentsOf.name} onClose={() => setStudentsOf(null)} />
      )}
    </div>
  );
}

export default CourseDetail;
