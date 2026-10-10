import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { classesApi } from '../../../api/classesApi.js';
import { departmentsApi } from '../../../api/departmentsApi.js';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { Spinner } from '../../../components/ui/Spinner.jsx';
import { Modal } from '../../../components/ui/Modal.jsx';
import { useToast } from '../../../app/providers/ToastProvider.jsx';
import {
  formatStudentCode,
  calculateGpa,
  getGpaClassification,
  GRADE_COMPONENTS,
  DEFAULT_GRADE_WEIGHTS,
  formatDate,
} from '../../../lib/format.js';

export function ManageGradebook() {
  const toast = useToast();
  const queryClient = useQueryClient();

  // Filters state
  const [selectedDept, setSelectedDept] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // View state: 'overview' (list of classes) or 'detail' (viewing specific class gradebook)
  const [selectedClassId, setSelectedClassId] = useState(null);

  // Modals state
  const [isLockAllModalOpen, setIsLockAllModalOpen] = useState(false);
  const [lockAllMode, setLockAllMode] = useState('lock'); // 'lock' or 'unlock'
  const [isAuditLogsModalOpen, setIsAuditLogsModalOpen] = useState(false);
  const [auditLogScope, setAuditLogScope] = useState('all'); // 'all' or 'class'

  // Edit / Override single student grade modal
  const [editingStudent, setEditingStudent] = useState(null);
  const [editGradeComponent, setEditGradeComponent] = useState('final');
  const [editScoreValue, setEditScoreValue] = useState('');
  const [editReason, setEditReason] = useState('');

  // 1. Fetch departments for filter
  const { data: deptData } = useQuery({
    queryKey: ['departments', 'all'],
    queryFn: () => departmentsApi.list({ limit: 100 }),
  });
  const departments = useMemo(() => deptData?.data || deptData || [], [deptData]);

  // 2. Fetch admin gradebook overview
  const { data: overviewData, isLoading: isLoadingOverview, refetch: refetchOverview } = useQuery({
    queryKey: ['admin-gradebook-overview', selectedDept, selectedStatus, searchTerm],
    queryFn: () =>
      classesApi.adminGradebookOverview({
        department: selectedDept !== 'all' ? selectedDept : undefined,
        status: selectedStatus !== 'all' ? selectedStatus : undefined,
        search: searchTerm || undefined,
      }),
  });

  const classesList = overviewData?.classes || [];
  const totalClasses = overviewData?.totalClasses || 0;
  const lockedCount = overviewData?.lockedCount || 0;
  const openCount = overviewData?.openCount || 0;

  // 3. Fetch detailed students & grades for selected class (when in detail view)
  const { data: classStudentsData, isLoading: isLoadingClassStudents } = useQuery({
    queryKey: ['classes', selectedClassId, 'students'],
    queryFn: () => classesApi.students(selectedClassId),
    enabled: Boolean(selectedClassId),
  });

  const currentClass = classStudentsData?.class || null;
  const classStudents = classStudentsData?.students || [];

  // 4. Fetch audit logs (either all or specific class)
  const { data: auditLogsData, isLoading: isLoadingAuditLogs, refetch: refetchAuditLogs } = useQuery({
    queryKey: ['grade-audit-logs', auditLogScope, selectedClassId],
    queryFn: () => {
      if (auditLogScope === 'class' && selectedClassId) {
        return classesApi.auditLogs(selectedClassId);
      }
      return classesApi.allAuditLogs();
    },
    enabled: isAuditLogsModalOpen,
  });

  // Mutation: Toggle grade lock for a single class
  const toggleLockMutation = useMutation({
    mutationFn: ({ classId, lock }) => classesApi.toggleGradeLock(classId, { lock }),
    onSuccess: (data) => {
      toast.success(data.message || 'Đã cập nhật trạng thái bảng điểm');
      queryClient.invalidateQueries({ queryKey: ['admin-gradebook-overview'] });
      if (selectedClassId) {
        queryClient.invalidateQueries({ queryKey: ['classes', selectedClassId, 'students'] });
      }
    },
    onError: (err) => toast.error(err.message || 'Không thể đổi trạng thái khóa bảng điểm'),
  });

  // Mutation: Lock or Unlock all classes
  const lockAllMutation = useMutation({
    mutationFn: ({ lock, department }) =>
      classesApi.lockAllGrades({ lock, department: department !== 'all' ? department : undefined }),
    onSuccess: (data) => {
      toast.success(data.message || 'Đã cập nhật trạng thái chốt sổ bảng điểm');
      setIsLockAllModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['admin-gradebook-overview'] });
      if (selectedClassId) {
        queryClient.invalidateQueries({ queryKey: ['classes', selectedClassId, 'students'] });
      }
    },
    onError: (err) => toast.error(err.message || 'Không thể thực hiện thao tác chốt sổ hàng loạt'),
  });

  // Mutation: Admin override student grade with audit log
  const updateGradeMutation = useMutation({
    mutationFn: () => {
      if (!editingStudent || !selectedClassId) return;
      const numScore = editScoreValue === '' ? null : Number(editScoreValue);
      if (numScore !== null && (Number.isNaN(numScore) || numScore < 0 || numScore > 10)) {
        throw new Error('Điểm số phải là giá trị số từ 0 đến 10');
      }
      if (!editReason || !editReason.trim()) {
        throw new Error('Vui lòng nhập lý do can thiệp điểm số để ghi nhận vào Audit Log');
      }

      return classesApi.updateStudentGrades(
        selectedClassId,
        editingStudent._id,
        { [editGradeComponent]: numScore },
        editReason.trim()
      );
    },
    onSuccess: () => {
      toast.success(`Đã cập nhật điểm và ghi nhận Audit Log cho ${editingStudent?.hoTen}`);
      setEditingStudent(null);
      setEditReason('');
      setEditScoreValue('');
      queryClient.invalidateQueries({ queryKey: ['classes', selectedClassId, 'students'] });
      queryClient.invalidateQueries({ queryKey: ['admin-gradebook-overview'] });
    },
    onError: (err) => toast.error(err.message || 'Lỗi khi cập nhật điểm'),
  });

  // Handler to open single student edit modal
  const handleOpenEditModal = (student) => {
    setEditingStudent(student);
    setEditGradeComponent('final');
    const existingVal = student.manualGrades?.final ?? (student.quizFinal?.score ?? '');
    setEditScoreValue(existingVal !== '' && existingVal !== null ? String(existingVal) : '');
    setEditReason('Giải quyết phúc khảo bài thi kết thúc học phần');
  };

  const handleComponentChange = (newComp) => {
    setEditGradeComponent(newComp);
    if (!editingStudent) return;
    let existingVal = '';
    if (newComp === 'attendance') {
      existingVal = editingStudent.manualGrades?.attendance ?? (editingStudent.attendanceStats?.autoScore ?? '');
    } else if (newComp === 'midterm') {
      existingVal = editingStudent.manualGrades?.midterm ?? (editingStudent.quizMidterm?.score ?? '');
    } else if (newComp === 'final') {
      existingVal = editingStudent.manualGrades?.final ?? (editingStudent.quizFinal?.score ?? '');
    } else if (newComp === 'presentation') {
      existingVal = editingStudent.manualGrades?.presentation ?? '';
    } else if (newComp === 'assignment') {
      existingVal = editingStudent.manualGrades?.assignment ?? (editingStudent.homeworkGrade ?? '');
    }
    setEditScoreValue(existingVal !== '' && existingVal !== null ? String(existingVal) : '');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quản lý Bảng điểm Toàn trường"
        subtitle="Theo dõi toàn cục điểm số tất cả lớp học phần, can thiệp sửa điểm phúc khảo kèm Audit Log, và chốt sổ khóa bảng điểm."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setAuditLogScope('all');
                setIsAuditLogsModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-white border border-slate-200 text-slate-700 shadow-xs hover:bg-slate-50 transition cursor-pointer"
            >
              <i className="fas fa-history text-indigo-600" />
              <span>Xem Audit Log Toàn trường</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setLockAllMode('lock');
                setIsLockAllModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-rose-600 text-white shadow-xs hover:bg-rose-700 transition cursor-pointer"
            >
              <i className="fas fa-lock" />
              <span>Chốt sổ / Khóa Bảng điểm Toàn trường</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setLockAllMode('unlock');
                setIsLockAllModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-emerald-600 text-white shadow-xs hover:bg-emerald-700 transition cursor-pointer"
            >
              <i className="fas fa-lock-open" />
              <span>Mở khóa Bảng điểm Hàng loạt</span>
            </button>
          </div>
        }
      />

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl">
            <i className="fas fa-layer-group" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{totalClasses}</div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tổng Lớp học phần</div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl">
            <i className="fas fa-lock-open" />
          </div>
          <div>
            <div className="text-2xl font-black text-emerald-600">{openCount}</div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Đang mở nhập điểm</div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center text-xl">
            <i className="fas fa-lock" />
          </div>
          <div>
            <div className="text-2xl font-black text-rose-600">{lockedCount}</div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Đã chốt sổ / Khóa</div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {!selectedClassId ? (
        /* VIEW 1: Overview list of all classes */
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          {/* Filter Toolbar */}
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              {/* Department filter */}
              <div className="flex items-center gap-2">
                <label htmlFor="dept-select" className="text-xs font-bold text-slate-600 whitespace-nowrap">
                  Khoa:
                </label>
                <select
                  id="dept-select"
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="all">Tất cả khoa đào tạo</option>
                  {departments.map((d) => (
                    <option key={d._id || d.id} value={d.name || d.department}>
                      {d.name || d.department}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status filter */}
              <div className="flex items-center gap-2">
                <label htmlFor="status-select" className="text-xs font-bold text-slate-600 whitespace-nowrap">
                  Trạng thái:
                </label>
                <select
                  id="status-select"
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="all">Tất cả trạng thái</option>
                  <option value="open">Đang mở nhập điểm</option>
                  <option value="locked">Đã chốt sổ / Khóa điểm</option>
                </select>
              </div>
            </div>

            {/* Search filter */}
            <div className="relative min-w-[240px]">
              <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm mã lớp, môn học, giảng viên..."
                className="w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Classes Table */}
          {isLoadingOverview ? (
            <div className="py-16 flex justify-center">
              <Spinner />
            </div>
          ) : classesList.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <i className="fas fa-folder-open text-3xl mb-2 block" />
              <span>Không tìm thấy lớp học phần nào phù hợp với bộ lọc.</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200/80 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3">Mã lớp</th>
                    <th className="px-4 py-3">Môn học</th>
                    <th className="px-4 py-3">Khoa</th>
                    <th className="px-4 py-3">Giảng viên</th>
                    <th className="px-4 py-3 text-center">Sĩ số & Tiến độ</th>
                    <th className="px-4 py-3 text-center">GPA Lớp</th>
                    <th className="px-4 py-3 text-center">Trạng thái Bảng điểm</th>
                    <th className="px-4 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {classesList.map((cls) => {
                    return (
                      <tr key={cls._id || cls.id} className="hover:bg-slate-50/70 transition">
                        <td className="px-4 py-3.5 font-bold text-slate-900 whitespace-nowrap">
                          {cls.id}
                        </td>
                        <td className="px-4 py-3.5 font-semibold text-slate-800">
                          <div>{cls.courseName || cls.courseId}</div>
                          <div className="text-[11px] font-normal text-slate-400">{cls.credits} tín chỉ</div>
                        </td>
                        <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap">
                          {typeof cls.department === 'object' ? cls.department?.name || cls.department?.tenKhoa : cls.department || '—'}
                        </td>
                        <td className="px-4 py-3.5 text-slate-700 whitespace-nowrap">
                          {typeof cls.teacher === 'object' ? cls.teacher?.hoTen || cls.teacher?.name : cls.teacher || 'Chưa phân công'}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <div className="font-semibold text-slate-800">
                            {cls.gradedStudents}/{cls.totalStudents} SV
                          </div>
                          <div className="w-24 bg-slate-100 rounded-full h-1.5 mx-auto mt-1 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                cls.completionRate === 100 ? 'bg-emerald-500' : 'bg-indigo-500'
                              }`}
                              style={{ width: `${cls.completionRate}%` }}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-center whitespace-nowrap font-black">
                          {cls.avgGpa != null ? (
                            <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">
                              {cls.avgGpa.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-center whitespace-nowrap">
                          {cls.isGradeLocked ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              <i className="fas fa-lock text-[10px]" />
                              <span>Đã chốt sổ</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <i className="fas fa-lock-open text-[10px]" />
                              <span>Đang mở nhập</span>
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right whitespace-nowrap space-x-2">
                          <button
                            type="button"
                            onClick={() => setSelectedClassId(cls._id || cls.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold transition cursor-pointer"
                          >
                            <i className="fas fa-eye text-xs" />
                            <span>Xem Bảng điểm</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              toggleLockMutation.mutate({
                                classId: cls._id || cls.id,
                                lock: !cls.isGradeLocked,
                              })
                            }
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border font-semibold transition cursor-pointer ${
                              cls.isGradeLocked
                                ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                                : 'border-rose-200 text-rose-700 hover:bg-rose-50'
                            }`}
                            title={cls.isGradeLocked ? 'Mở khóa bảng điểm cho lớp này' : 'Chốt sổ và khóa điểm lớp này'}
                          >
                            <i className={`fas ${cls.isGradeLocked ? 'fa-lock-open' : 'fa-lock'}`} />
                            <span>{cls.isGradeLocked ? 'Mở khóa' : 'Khóa sổ'}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* VIEW 2: Detail Class Gradebook with Admin Intervention capabilities */
        <div className="space-y-4">
          {/* Header of selected class */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSelectedClassId(null)}
                className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center transition cursor-pointer"
                title="Quay lại danh sách lớp"
              >
                <i className="fas fa-arrow-left" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-slate-900">
                    {currentClass?.courseName || currentClass?.id} ({currentClass?.id})
                  </h3>
                  {currentClass?.isGradeLocked ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                      <i className="fas fa-lock text-[9px]" />
                      <span>Đã chốt sổ</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <i className="fas fa-lock-open text-[9px]" />
                      <span>Đang mở nhập</span>
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Giảng viên:{' '}
                  <strong className="text-slate-700">
                    {typeof currentClass?.teacher === 'object'
                      ? currentClass?.teacher?.hoTen || currentClass?.teacher?.name
                      : currentClass?.teacher || 'Chưa phân công'}
                  </strong>{' '}
                  | Khoa:{' '}
                  <strong className="text-slate-700">
                    {typeof currentClass?.department === 'object'
                      ? currentClass?.department?.name || currentClass?.department?.tenKhoa
                      : currentClass?.department || '—'}
                  </strong>{' '}
                  | Sĩ số:{' '}
                  <strong className="text-slate-700">{classStudents.length} sinh viên</strong>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setAuditLogScope('class');
                  setIsAuditLogsModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <i className="fas fa-history text-indigo-600" />
                <span>Audit Log Lớp này</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  toggleLockMutation.mutate({
                    classId: selectedClassId,
                    lock: !currentClass?.isGradeLocked,
                  })
                }
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl text-white transition cursor-pointer shadow-xs ${
                  currentClass?.isGradeLocked ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                <i className={`fas ${currentClass?.isGradeLocked ? 'fa-lock-open' : 'fa-lock'}`} />
                <span>{currentClass?.isGradeLocked ? 'Mở khóa Bảng điểm' : 'Chốt sổ Bảng điểm lớp'}</span>
              </button>
            </div>
          </div>

          {/* Detailed Students Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            {isLoadingClassStudents ? (
              <div className="py-16 flex justify-center">
                <Spinner />
              </div>
            ) : classStudents.length === 0 ? (
              <div className="py-16 text-center text-slate-400">
                <i className="fas fa-users-slash text-3xl mb-2 block" />
                <span>Lớp học phần này chưa có sinh viên nào đăng ký.</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200/80 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <th className="px-4 py-3">Mã SV</th>
                      <th className="px-4 py-3">Họ và tên</th>
                      <th className="px-3 py-3 text-center">Chuyên cần (10%)</th>
                      <th className="px-3 py-3 text-center">Bài tập / Quiz (10%)</th>
                      <th className="px-3 py-3 text-center">Giữa kỳ (30%)</th>
                      <th className="px-3 py-3 text-center">Cuối kỳ (50%)</th>
                      <th className="px-3 py-3 text-center bg-indigo-50/50">GPA Tổng kết</th>
                      <th className="px-3 py-3 text-center bg-indigo-50/50">Xếp loại</th>
                      <th className="px-4 py-3 text-right">Can thiệp Admin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {classStudents.map((st) => {
                      const eff = st.effectiveGrades || {};
                      const gpa = st.finalScore != null ? Number(st.finalScore) : null;
                      const classification = getGpaClassification(gpa);

                      return (
                        <tr key={st._id} className="hover:bg-slate-50/70 transition">
                          <td className="px-4 py-3.5 font-bold text-slate-800 whitespace-nowrap">
                            {formatStudentCode(st.id)}
                          </td>
                          <td className="px-4 py-3.5 font-medium text-slate-900">
                            {st.hoTen}
                          </td>
                          <td className="px-3 py-3.5 text-center font-bold">
                            {eff.attendance != null ? `${eff.attendance}` : <span className="text-slate-300 font-normal">—</span>}
                          </td>
                          <td className="px-3 py-3.5 text-center font-bold">
                            {eff.homework != null ? `${eff.homework}` : <span className="text-slate-300 font-normal">—</span>}
                          </td>
                          <td className="px-3 py-3.5 text-center font-bold">
                            {eff.midterm != null ? `${eff.midterm}` : <span className="text-slate-300 font-normal">—</span>}
                          </td>
                          <td className="px-3 py-3.5 text-center font-bold">
                            {eff.final != null ? `${eff.final}` : <span className="text-slate-300 font-normal">—</span>}
                          </td>
                          <td className="px-3 py-3.5 text-center font-black bg-indigo-50/30">
                            {gpa != null ? (
                              <span className="text-indigo-700 text-sm">{gpa.toFixed(2)}</span>
                            ) : (
                              <span className="text-slate-300 font-normal">—</span>
                            )}
                          </td>
                          <td className="px-3 py-3.5 text-center bg-indigo-50/30 whitespace-nowrap">
                            {gpa != null ? (
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                  classification.tone === 'success'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : classification.tone === 'primary'
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : classification.tone === 'warning'
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : 'bg-rose-50 text-rose-700 border-rose-200'
                                }`}
                              >
                                {classification.text}
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(st)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-100 font-bold transition cursor-pointer"
                              title="Can thiệp / Ghi đè điểm số phúc khảo"
                            >
                              <i className="fas fa-edit text-xs" />
                              <span>Sửa điểm</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: Admin Single Student Grade Override / Intervention */}
      <Modal
        open={Boolean(editingStudent)}
        onClose={() => setEditingStudent(null)}
        title="Can thiệp Điểm số (Phòng Đào Tạo)"
      >
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800">
            <i className="fas fa-exclamation-triangle mr-1.5 text-amber-600" />
            Mọi thao tác sửa đổi điểm số của Quản trị viên sẽ được ghi nhận chi tiết vào <strong>Audit Log</strong> của hệ thống để đảm bảo tính minh bạch.
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Sinh viên:</label>
            <div className="font-semibold text-sm text-slate-900 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              {editingStudent?.hoTen} ({formatStudentCode(editingStudent?.id)})
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="comp-select" className="block text-xs font-bold text-slate-700 mb-1">
                Cột điểm cần sửa:
              </label>
              <select
                id="comp-select"
                value={editGradeComponent}
                onChange={(e) => handleComponentChange(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold outline-none focus:border-indigo-500"
              >
                <option value="attendance">Chuyên cần (10%)</option>
                <option value="assignment">Bài tập / Quiz (10%)</option>
                <option value="midterm">Giữa kỳ (30%)</option>
                <option value="final">Cuối kỳ (50%)</option>
                <option value="presentation">Thuyết trình</option>
              </select>
            </div>
            <div>
              <label htmlFor="score-input" className="block text-xs font-bold text-slate-700 mb-1">
                Điểm số mới (Thang 10):
              </label>
              <input
                id="score-input"
                type="number"
                min="0"
                max="10"
                step="0.1"
                value={editScoreValue}
                onChange={(e) => setEditScoreValue(e.target.value)}
                placeholder="Nhập 0 - 10"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-indigo-700 outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="reason-input" className="block text-xs font-bold text-slate-700 mb-1">
              Lý do can thiệp <span className="text-rose-500">*</span>:
            </label>
            <textarea
              id="reason-input"
              rows={3}
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              placeholder="Ví dụ: Phúc khảo bài thi cuối kỳ theo đơn kiến nghị ngày... hoặc Sửa lỗi nhập liệu giảng viên đề nghị..."
              className="w-full rounded-xl border border-slate-200 p-2.5 text-xs outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setEditingStudent(null)}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              disabled={updateGradeMutation.isPending}
              onClick={() => updateGradeMutation.mutate()}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {updateGradeMutation.isPending ? 'Đang lưu...' : 'Lưu Điểm & Ghi Audit Log'}
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL 2: Batch Lock / Unlock Confirmation */}
      <Modal
        open={isLockAllModalOpen}
        onClose={() => setIsLockAllModalOpen(false)}
        title={lockAllMode === 'lock' ? 'Chốt sổ & Khóa Bảng điểm Toàn trường' : 'Mở khóa Bảng điểm Hàng loạt'}
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            {lockAllMode === 'lock'
              ? 'Bạn có chắc chắn muốn chốt sổ và khóa bảng điểm cho tất cả các lớp học phần trong hệ thống không? Khi đã khóa, giảng viên sẽ không thể tự ý sửa đổi điểm số, điểm số sẽ được cố định phục vụ xét học vụ và tốt nghiệp.'
              : 'Bạn có chắc chắn muốn mở khóa bảng điểm cho các lớp học phần để giảng viên tiếp tục cập nhật và chỉnh sửa điểm số không?'}
          </p>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsLockAllModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={lockAllMutation.isPending}
              onClick={() =>
                lockAllMutation.mutate({
                  lock: lockAllMode === 'lock',
                  department: selectedDept,
                })
              }
              className={`px-4 py-2 text-xs font-bold rounded-xl text-white transition disabled:opacity-50 ${
                lockAllMode === 'lock' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {lockAllMutation.isPending ? 'Đang xử lý...' : lockAllMode === 'lock' ? 'Xác nhận Chốt sổ' : 'Xác nhận Mở khóa'}
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL 3: Audit Logs History Viewer */}
      <Modal
        open={isAuditLogsModalOpen}
        onClose={() => setIsAuditLogsModalOpen(false)}
        title={`Lịch sử Can thiệp Điểm số (Audit Log) - ${auditLogScope === 'class' ? 'Lớp đang xem' : 'Toàn trường'}`}
      >
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {isLoadingAuditLogs ? (
            <div className="py-12 flex justify-center">
              <Spinner />
            </div>
          ) : !auditLogsData || auditLogsData.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              <i className="fas fa-clipboard-check text-2xl mb-1.5 block" />
              Chưa có bản ghi can thiệp điểm số nào được ghi lại.
            </div>
          ) : (
            <div className="space-y-2">
              {auditLogsData.map((log) => (
                <div key={log._id} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">
                      {log.studentName} ({formatStudentCode(log.studentId)}) - Lớp {log.classId}
                    </span>
                    <span className="text-[10px] text-slate-400">{formatDate(log.createdAt)}</span>
                  </div>
                  <div className="text-slate-600">
                    Cột điểm: <strong className="text-slate-800">{log.componentLabel || log.component}</strong> | Điểm cũ:{' '}
                    <strong className="text-slate-700">{log.oldScore ?? 'Chưa có'}</strong> ➔ Điểm mới:{' '}
                    <strong className="text-indigo-600">{log.newScore ?? 'Đã xóa'}</strong>
                  </div>
                  <div className="text-slate-700 bg-white p-2 rounded-lg border border-slate-100 text-[11px]">
                    Lý do: <em>{log.reason}</em>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Thực hiện bởi: <strong className="text-slate-600">{log.performedByName}</strong> ({log.performedByRole})
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAuditLogsModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
            >
              Đóng
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default ManageGradebook;

