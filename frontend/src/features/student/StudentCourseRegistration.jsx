import { useMemo } from 'react';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import { useToast } from '../../app/providers/ToastProvider.jsx';
import { useConfirm } from '../../app/providers/ConfirmProvider.jsx';
import { describeSchedules } from '../../lib/schedule.js';
import { formatCurrency } from '../../lib/format.js';
import { useOpenClasses, useMyEnrollments, useEnrollmentMutations } from './useEnrollments.js';

export function StudentCourseRegistration() {
  const toast = useToast();
  const confirm = useConfirm();
  const { data: openData, isLoading } = useOpenClasses();
  const { data: mineData } = useMyEnrollments();
  const { enroll, cancel } = useEnrollmentMutations();

  const openClasses = openData?.data || [];
  const enrollments = useMemo(() => mineData?.data || [], [mineData]);
  const enrolledClassIds = useMemo(
    () => new Set(enrollments.map((e) => e.class?._id)),
    [enrollments]
  );

  const doEnroll = async (cls) => {
    try {
      await enroll.mutateAsync(cls._id);
      toast.success(`Đã đăng ký ${cls.courseName}`);
    } catch (error) {
      toast.error(error.message, 5000);
    }
  };

  const doCancel = async (enrollment) => {
    const ok = await confirm({
      title: 'Hủy đăng ký',
      message: `Hủy đăng ký lớp ${enrollment.class?.courseName || enrollment.classId}?`,
      confirmText: 'Hủy đăng ký',
    });
    if (!ok) return;
    try {
      await cancel.mutateAsync(enrollment.class._id);
      toast.success('Đã hủy đăng ký');
    } catch (error) {
      toast.error(error.message);
    }
  };

  const openColumns = [
    { key: 'id', header: 'Mã lớp', className: 'font-semibold text-gray-800' },
    { key: 'courseName', header: 'Học phần' },
    { key: 'teacher', header: 'Giáo viên', render: (c) => c.teacher || '—' },
    { key: 'schedules', header: 'Lịch học', render: (c) => <span className="text-xs">{describeSchedules(c.schedules)}</span> },
    { key: 'room', header: 'Phòng' },
    { key: 'fee', header: 'Học phí', render: (c) => formatCurrency(c.fee) },
    {
      key: 'action',
      header: '',
      className: 'text-right w-28',
      render: (c) =>
        enrolledClassIds.has(c._id) ? (
          <span className="text-xs font-bold text-emerald-600">Đã đăng ký</span>
        ) : (
          <button type="button" onClick={() => doEnroll(c)} disabled={enroll.isPending} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-60">
            Đăng ký
          </button>
        ),
    },
  ];

  const enrolledColumns = [
    { key: 'classId', header: 'Mã lớp', className: 'font-semibold text-gray-800' },
    { key: 'courseName', header: 'Học phần', render: (e) => e.class?.courseName || '—' },
    { key: 'schedules', header: 'Lịch học', render: (e) => <span className="text-xs">{describeSchedules(e.class?.schedules)}</span> },
    { key: 'fee', header: 'Học phí', render: (e) => formatCurrency(e.class?.fee) },
    {
      key: 'action',
      header: '',
      className: 'text-right w-28',
      render: (e) => (
        <button type="button" onClick={() => doCancel(e)} disabled={cancel.isPending} className="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 disabled:opacity-60">
          Hủy
        </button>
      ),
    },
  ];

  if (isLoading) return <Spinner />;

  return (
    <div className="space-y-8">
      <div>
        <PageHeader title="Đăng ký học phần" subtitle="Các lớp đang mở đăng ký" />
        <DataTable columns={openColumns} rows={openClasses} emptyText="Hiện không có lớp nào đang mở đăng ký" />
      </div>

      <div>
        <h2 className="text-lg font-bold text-gray-800 mb-3">Học phần đã đăng ký</h2>
        <DataTable columns={enrolledColumns} rows={enrollments} rowKey={(e) => e._id} emptyText="Chưa đăng ký học phần nào" />
      </div>
    </div>
  );
}

export default StudentCourseRegistration;
