import { useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
import { Avatar } from '../../../components/ui/Avatar.jsx';
import {
  ScheduleTimeCombinedBadge,
  ScheduleDaysBadge,
  ScheduleTimeBadge,
  RoomBadge,
  ScheduleRoomBadge,
} from '../../../components/schedule/ScheduleBadge.jsx';
import { classesApi } from '../../../api/classesApi.js';
import { teachersApi } from '../../../api/teachersApi.js';
import { readSheet, exportSheet, exportWorkbook } from '../../../lib/excel.js';
import { classExportRow, classImportPayload } from '../classes/classExcel.js';

export function CourseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const importFileRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const courseQuery = useQuery({ queryKey: ['courses', id, 'detail'], queryFn: () => coursesApi.get(id) });
  const course = courseQuery.data;
  const { data: classData, isLoading: classesLoading } = useCourseClasses(course?.id);
  const { create, update, changeStatus, remove, bulkRemove } = useClassMutations();

  const [formModal, setFormModal] = useState(null); // {mode, initial?}
  const [selectedClassIds, setSelectedClassIds] = useState([]);

  const classes = Array.isArray(classData?.data) ? classData.data : [];
  const allClassIds = classes.filter(Boolean).map((c) => String(c._id || c.id || ''));
  const isAllSelected = classes.length > 0 && allClassIds.every((cId) => selectedClassIds.includes(cId));
  const isSomeSelected = classes.length > 0 && allClassIds.some((cId) => selectedClassIds.includes(cId)) && !isAllSelected;

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedClassIds([]);
    } else {
      setSelectedClassIds(allClassIds);
    }
  };

  const handleToggleSelectClass = (cId) => {
    setSelectedClassIds((prev) =>
      prev.includes(cId) ? prev.filter((item) => item !== cId) : [...prev, cId]
    );
  };

  const handleBulkDelete = async () => {
    if (selectedClassIds.length === 0) return;
    const ok = await confirm({
      title: 'Xóa hàng loạt lớp học phần',
      message: `Bạn có chắc chắn muốn xóa ${selectedClassIds.length} lớp học phần đã chọn? Toàn bộ đăng ký của sinh viên trong các lớp này sẽ bị xóa.`,
      confirmText: `Xóa ${selectedClassIds.length} lớp`,
      tone: 'danger',
    });
    if (!ok) return;

    try {
      await bulkRemove.mutateAsync(selectedClassIds);
      toast.success(`Đã xóa thành công ${selectedClassIds.length} lớp học phần`);
      setSelectedClassIds([]);
    } catch (error) {
      toast.error(error.message || 'Không thể xóa các lớp học phần đã chọn');
    }
  };

  const onDownloadTemplate = async () => {
    try {
      const sampleTeacher = teachers[0]?.id || teachers[0]?.code || 'GV001';
      const sampleTeacher2 = teachers[1]?.id || teachers[1]?.code || sampleTeacher;

      const templateRows = [
        {
          'Mã lớp': `${course?.id || 'CS101'}-01`,
          'Tên lớp': `Lớp học phần ${course?.name || ''} 01`,
          'Mã GV': sampleTeacher,
          'Phòng học': 'P.A102',
          'Sĩ số tối đa': 40,
          'Học phí': course?.fee || 1500000,
          'Thứ (2,3,4,5,6,7,CN)': '2,4',
          'Ca học (1-5)': '1',
          'Ngày bắt đầu (YYYY-MM-DD)': '2026-09-01',
          'Ngày kết thúc (YYYY-MM-DD)': '2026-12-15',
          'Hạn đăng ký (YYYY-MM-DDTHH:mm)': '2026-08-30T23:59',
        },
        {
          'Mã lớp': `${course?.id || 'CS101'}-02`,
          'Tên lớp': `Lớp học phần ${course?.name || ''} 02`,
          'Mã GV': sampleTeacher2,
          'Phòng học': 'P.B204',
          'Sĩ số tối đa': 35,
          'Học phí': course?.fee || 1500000,
          'Thứ (2,3,4,5,6,7,CN)': '3,5',
          'Ca học (1-5)': '2',
          'Ngày bắt đầu (YYYY-MM-DD)': '2026-09-01',
          'Ngày kết thúc (YYYY-MM-DD)': '2026-12-15',
          'Hạn đăng ký (YYYY-MM-DDTHH:mm)': '2026-08-30T23:59',
        },
      ];

      // Sheet 2: Danh sách Giảng viên thực tế từ CSDL để người dùng biết đường điền đúng Mã GV
      const teacherRefRows = (teachers || []).map((t, idx) => ({
        STT: idx + 1,
        'Mã GV (Điền cột Mã GV)': t.id || t.code || t._id,
        'Họ và tên Giảng viên': t.hoTen || t.name || '',
        'Khoa': typeof t.department === 'object' ? t.department?.name || t.department?.tenKhoa || '' : t.department || '',
        'Email': t.email || '',
        'Ghi chú': 'Điền chính xác Mã GV này vào cột Mã GV ở Sheet biểu mẫu',
      }));

      // Sheet 3: Hướng dẫn cấu hình lịch học
      const scheduleGuideRows = [
        { 'Cột dữ liệu': 'Mã lớp', 'Quy tắc': 'Mã duy nhất, ví dụ: CS101-01, CS101-02' },
        { 'Cột dữ liệu': 'Tên lớp', 'Quy tắc': 'Tên lớp học phần hiển thị' },
        { 'Cột dữ liệu': 'Mã GV', 'Quy tắc': 'Bắt buộc chọn đúng Mã GV trong Sheet "DanhSachGiangVien_CSDL"' },
        { 'Cột dữ liệu': 'Phòng học', 'Quy tắc': 'Tên phòng (ví dụ: P.A102, P.B204, LAB-01)' },
        { 'Cột dữ liệu': 'Sĩ số tối đa', 'Quy tắc': 'Số nguyên dương (ví dụ: 30, 40, 50)' },
        { 'Cột dữ liệu': 'Thứ (2,3,4,5,6,7,CN)', 'Quy tắc': 'Thứ trong tuần, nếu nhiều buổi cách nhau bằng dấu phẩy: 2,4 hoặc 3,5 hoặc 6' },
        { 'Cột dữ liệu': 'Ca học (1-5)', 'Quy tắc': 'Ca 1 (7h-9h30), Ca 2 (9h45-12h15), Ca 3 (13h-15h30), Ca 4 (15h45-18h15), Ca 5 (18h30-21h)' },
        { 'Cột dữ liệu': 'Ngày bắt đầu / kết thúc', 'Quy tắc': 'Định dạng YYYY-MM-DD (Ví dụ: 2026-09-01)' },
        { 'Cột dữ liệu': 'Hạn đăng ký', 'Quy tắc': 'Định dạng YYYY-MM-DDTHH:mm (Ví dụ: 2026-08-30T23:59)' },
      ];

      const sheets = [
        { sheetName: 'BieuMau_LopHocPhan', rows: templateRows },
        { sheetName: 'DanhSachGiangVien_CSDL', rows: teacherRefRows.length ? teacherRefRows : [{ 'Mã GV': 'GV001', 'Họ tên': 'Giảng viên mẫu' }] },
        { sheetName: 'HuongDan_LichHoc', rows: scheduleGuideRows },
      ];

      await exportWorkbook(sheets, {
        fileName: `bieu-mau-lop-hoc-phan-${course?.id || 'sample'}.xlsx`,
      });
      toast.success('Đã tải xuống biểu mẫu Lớp học phần kèm danh sách giảng viên CSDL!');
    } catch (err) {
      toast.error('Lỗi khi tải biểu mẫu Lớp học phần');
    }
  };

  const openCreate = () =>
    setFormModal({
      mode: 'create',
      initial: {
        courseId: course?.id,
        fee: course?.fee || ((course?.credits || 0) * 500000),
        gradeWeights: course?.gradeWeights,
      },
    });
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
        fee: cls.fee !== undefined ? cls.fee : (course?.fee || ((course?.credits || 0) * 500000)),
        schedules: cls.schedules || [],
        studyStart: cls.studyStart || '',
        studyEnd: cls.studyEnd || '',
        registrationStart: registrationDateTimeInput(cls.registrationStart),
        registrationEnd: registrationDateTimeInput(cls.registrationEnd, true),
        gradeWeights: cls.gradeWeights || course?.gradeWeights,
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
  if (courseQuery.isError || !course) {
    return (
      <div className="max-w-xl mx-auto rounded-2xl bg-white border border-gray-100 shadow-sm p-10 text-center">
        <p className="text-gray-600">{courseQuery.error?.message || 'Không tìm thấy học phần.'}</p>
        <button type="button" onClick={() => navigate('/admin/classes')} className="mt-5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700">
          Quay lại
        </button>
      </div>
    );
  }

  const columns = [
    {
      key: 'selection',
      header: (
        <div className="flex items-center justify-center">
          <input
            type="checkbox"
            checked={isAllSelected}
            ref={(el) => {
              if (el) el.indeterminate = isSomeSelected;
            }}
            onChange={handleSelectAll}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            title="Chọn tất cả lớp"
          />
        </div>
      ),
      className: 'w-10 text-center',
      render: (cls) => (
        <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={selectedClassIds.includes(String(cls._id))}
            onChange={() => handleToggleSelectClass(String(cls._id))}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
          />
        </div>
      ),
    },
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
      header: 'Thời gian học',
      className: 'min-w-[210px]',
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
    {
      key: 'fee',
      header: 'Học phí',
      render: (c) => (
        <span className="font-semibold text-xs text-gray-700 whitespace-nowrap">
          {formatCurrency(c.fee != null ? c.fee : (course?.fee || ((course?.credits || 0) * 500000)))}
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
          <button
            type="button"
            onClick={() => navigate(`/admin/classes/course/${id}/class/${c._id}/students`)}
            className="w-8 h-8 rounded-lg text-gray-600 hover:bg-gray-100"
            title="Sinh viên"
            aria-label={`Xem danh sách sinh viên ${c.id}`}
          >
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
    <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6">
      <button
        type="button"
        onClick={() => navigate('/admin/classes')}
        className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-indigo-600 mb-2"
      >
        <i className="fas fa-arrow-left" /> Quản lý lớp học phần
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
            className="inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 disabled:opacity-60 shadow-xs transition active:scale-[0.98] cursor-pointer whitespace-nowrap"
          >
            <i className="fas fa-file-export text-xs" />
            <span>{exporting ? 'Đang xuất...' : 'Xuất Excel'}</span>
          </button>
          <button
            type="button"
            onClick={onDownloadTemplate}
            className="inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 shadow-2xs transition active:scale-[0.98] cursor-pointer whitespace-nowrap"
            title="Tải biểu mẫu Excel chuẩn kèm danh sách giảng viên từ CSDL"
          >
            <i className="fas fa-file-excel text-emerald-600 text-xs" />
            <span>Biểu mẫu</span>
          </button>
          <button
            type="button"
            onClick={() => importFileRef.current?.click()}
            disabled={importing}
            className="inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-semibold hover:bg-indigo-100 disabled:opacity-60 shadow-xs transition active:scale-[0.98] cursor-pointer whitespace-nowrap"
          >
            <i className="fas fa-file-import text-xs" />
            <span>{importing ? 'Đang nhập...' : 'Nhập Excel'}</span>
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 shadow-xs hover:shadow transition active:scale-[0.98] cursor-pointer whitespace-nowrap"
          >
            <i className="fas fa-plus text-xs" />
            <span>Thêm lớp</span>
          </button>
        </div>
      </div>
      {selectedClassIds.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/90 px-4 py-3 shadow-xs">
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-xs font-bold text-white shadow-xs">
              {selectedClassIds.length}
            </span>
            <span className="text-sm font-medium text-indigo-950">
              Đang chọn <strong className="text-indigo-700">{selectedClassIds.length}</strong> lớp học phần
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedClassIds([])}
              className="rounded-xl border border-gray-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 shadow-2xs transition cursor-pointer"
            >
              Bỏ chọn
            </button>
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={bulkRemove.isPending}
              className="flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-red-700 disabled:opacity-50 transition cursor-pointer"
            >
              <i className="fas fa-trash-alt text-[11px]" />
              <span>{bulkRemove.isPending ? 'Đang xóa...' : `Xóa ${selectedClassIds.length} lớp đã chọn`}</span>
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <DataTable
          columns={columns}
          rows={classes}
          isLoading={classesLoading}
          emptyText="Môn học này chưa có lớp học phần nào được mở"
          cellPadding="px-4 py-4 sm:py-5"
        />
      </div>

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

    </div>
  );
}

export default CourseDetail;
