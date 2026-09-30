import { useMemo } from 'react';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import { useToast } from '../../app/providers/ToastProvider.jsx';
import { useConfirm } from '../../app/providers/ConfirmProvider.jsx';
import { describeSchedules } from '../../lib/schedule.js';
import { formatCurrency } from '../../lib/format.js';
import { useOpenClasses, useMyEnrollments, useEnrollmentMutations } from './useEnrollments.js';

/** Group a flat class list into [{ courseId, courseName, credits, classes }]. */
function groupByCourse(classes) {
  const map = new Map();
  classes.forEach((cls) => {
    if (!map.has(cls.courseId)) {
      map.set(cls.courseId, {
        courseId: cls.courseId,
        courseName: cls.courseName,
        credits: cls.credits,
        department: cls.department,
        classes: [],
      });
    }
    map.get(cls.courseId).classes.push(cls);
  });
  return [...map.values()];
}

function ClassRow({ cls, state, onEnroll, pending }) {
  const full = cls.capacity > 0 && cls.enrolledCount >= cls.capacity;
  const disabled = pending || state.enrolledThisClass || state.enrolledOtherInCourse || full;

  let action;
  if (state.enrolledThisClass) {
    action = <span className="text-xs font-bold text-emerald-600"><i className="fas fa-circle-check mr-1" />Đã đăng ký</span>;
  } else if (state.enrolledOtherInCourse) {
    action = <span className="text-xs text-gray-400">Đã đăng ký lớp khác</span>;
  } else if (full) {
    action = <span className="text-xs font-bold text-red-500">Đã đầy</span>;
  } else {
    action = (
      <button
        type="button"
        onClick={() => onEnroll(cls)}
        disabled={disabled}
        className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-60"
      >
        Đăng ký
      </button>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-3 rounded-xl border ${state.enrolledThisClass ? 'border-emerald-200 bg-emerald-50/40' : 'border-gray-100 bg-white'}`}>
      <span className="font-semibold text-gray-800 w-24">{cls.id}</span>
      <span className="text-sm text-gray-600 flex-1 min-w-[140px]">
        <i className="fas fa-user-tie text-gray-300 mr-1.5" />
        {cls.teacher || 'Chưa phân công'}
      </span>
      <span className="text-xs text-gray-500 min-w-[180px]">
        <i className="far fa-clock text-gray-300 mr-1.5" />
        {describeSchedules(cls.schedules)}
      </span>
      <span className="text-xs text-gray-500 w-20">
        <i className="fas fa-door-open text-gray-300 mr-1.5" />
        {cls.room || '—'}
      </span>
      <span className={`text-xs font-semibold w-16 ${full ? 'text-red-500' : 'text-gray-600'}`}>
        {cls.enrolledCount}
        {cls.capacity > 0 ? `/${cls.capacity}` : ''}
      </span>
      <span className="ml-auto">{action}</span>
    </div>
  );
}

export function StudentCourseRegistration() {
  const toast = useToast();
  const confirm = useConfirm();
  const { data: openData, isLoading } = useOpenClasses();
  const { data: mineData } = useMyEnrollments();
  const { enroll, cancel } = useEnrollmentMutations();

  const enrollments = useMemo(() => mineData?.data || [], [mineData]);
  const enrolledClassIds = useMemo(() => new Set(enrollments.map((e) => e.class?._id)), [enrollments]);
  const enrolledCourseIds = useMemo(
    () => new Set(enrollments.map((e) => e.class?.courseId).filter(Boolean)),
    [enrollments]
  );

  const groups = useMemo(() => groupByCourse(openData?.data || []), [openData]);

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
        <PageHeader title="Đăng ký học phần" subtitle="Chọn một lớp cho mỗi học phần bạn muốn học" />

        {groups.length === 0 ? (
          <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-10 text-center text-gray-400">
            Hiện không có lớp nào đang mở đăng ký.
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map((group) => {
              const registeredInCourse = enrolledCourseIds.has(group.courseId);
              return (
                <section key={group.courseId} className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-indigo-50 to-violet-50 border-b border-gray-100">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-indigo-500">{group.courseId} · {group.credits} tín chỉ</p>
                      <h3 className="text-base font-extrabold text-gray-900">{group.courseName}</h3>
                    </div>
                    {registeredInCourse && (
                      <span className="text-xs font-bold text-emerald-600 bg-white px-2.5 py-1 rounded-full border border-emerald-200">
                        <i className="fas fa-check mr-1" />Đã chọn lớp
                      </span>
                    )}
                  </div>
                  <div className="p-4 space-y-2">
                    {group.classes.map((cls) => (
                      <ClassRow
                        key={cls._id}
                        cls={cls}
                        pending={enroll.isPending}
                        state={{
                          enrolledThisClass: enrolledClassIds.has(cls._id),
                          enrolledOtherInCourse: registeredInCourse && !enrolledClassIds.has(cls._id),
                        }}
                        onEnroll={doEnroll}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-lg font-bold text-gray-800 mb-3">Học phần đã đăng ký</h2>
        <DataTable columns={enrolledColumns} rows={enrollments} rowKey={(e) => e._id} emptyText="Chưa đăng ký học phần nào" />
      </div>
    </div>
  );
}

export default StudentCourseRegistration;
