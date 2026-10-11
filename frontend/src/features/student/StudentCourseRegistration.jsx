import { useMemo } from 'react';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import { Avatar } from '../../components/ui/Avatar.jsx';
import { useToast } from '../../app/providers/ToastProvider.jsx';
import { useConfirm } from '../../app/providers/ConfirmProvider.jsx';
import {
  formatCurrency,
  getCurrentDateTimeLocalWithSeconds,
  formatRegistrationDateTime,
  registrationDateTimeInput,
} from '../../lib/format.js';
import { useAuth } from '../../app/providers/AuthProvider.jsx';
import { useOpenClasses, useMyEnrollments, useEnrollmentMutations } from './useEnrollments.js';
import { ScheduleRoomBadge } from '../../components/schedule/ScheduleBadge.jsx';

function matchDepartment(classDept, userDept) {
  if (!userDept) return true;
  if (!classDept) return false;
  const clean = (s) => String(s || '').trim().toLowerCase().replace(/^khoa\s+/i, '');
  const norm = (s) => String(s || '').trim().toLowerCase();
  return norm(classDept) === norm(userDept) || clean(classDept) === clean(userDept);
}

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
  const isTimeLocked =
    cls.status !== 'Đang mở' ||
    Boolean(
      cls.registrationEnd &&
      registrationDateTimeInput(cls.registrationEnd, true) < getCurrentDateTimeLocalWithSeconds()
    );
  const disabled = pending || state.enrolledThisClass || state.enrolledOtherInCourse || full || isTimeLocked;

  let action;
  if (state.enrolledThisClass) {
    action = <span className="text-xs font-bold text-emerald-600"><i className="fas fa-circle-check mr-1" />Đã đăng ký</span>;
  } else if (isTimeLocked) {
    action = (
      <span
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 text-xs font-bold border border-amber-200 cursor-not-allowed"
        title="Thời hạn đăng ký đã kết thúc (khóa tự động / chỉ xem)"
      >
        <i className="fas fa-lock text-[10px]" />
        Đã khóa (hết hạn)
      </span>
    );
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
        className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-60 cursor-pointer"
      >
        Đăng ký
      </button>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 rounded-2xl border transition-all ${state.enrolledThisClass ? 'border-emerald-300 bg-emerald-50/50 shadow-2xs' : isTimeLocked ? 'border-amber-200/80 bg-amber-50/20' : 'border-gray-200/80 bg-white hover:border-indigo-200 hover:shadow-xs'}`}>
      <div className="w-32 shrink-0">
        <span className="font-mono font-bold text-indigo-700 text-xs px-2 py-1 rounded-lg bg-indigo-50 border border-indigo-100/80 text-center block">
          {cls.id}
        </span>
        <span className="mt-1 text-[11px] text-gray-600 text-center block truncate" title={cls.className || ''}>
          {cls.className || '—'}
        </span>
      </div>
      <span className="text-sm text-gray-700 min-w-[150px] max-w-[180px] flex items-center gap-2">
        <Avatar src={cls.teacherRef?.avatar?.url || cls.teacherRef?.avatar} name={cls.teacher || 'GV'} size={24} />
        <span className="font-semibold text-xs text-gray-800 truncate" title={cls.teacher}>{cls.teacher || 'Chưa phân công'}</span>
      </span>
      <div className="flex-1 min-w-[260px]">
        <ScheduleRoomBadge schedules={cls.schedules} room={cls.room} layout="inline" compact />
      </div>
      <span className={`text-xs font-semibold w-16 text-center ${full ? 'text-red-500 font-bold' : 'text-gray-600'}`}>
        {cls.enrolledCount}
        {cls.capacity > 0 ? `/${cls.capacity}` : ''}
      </span>
      <span className="text-xs font-semibold text-gray-700">Học phí: {formatCurrency(cls.fee)}</span>
      <span className="text-xs text-gray-500">
        Đăng ký: {formatRegistrationDateTime(cls.registrationStart)} – {formatRegistrationDateTime(cls.registrationEnd, true)}
      </span>
      <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${isTimeLocked ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-emerald-50 text-emerald-700'}`}>
        Trạng thái: {isTimeLocked ? 'Đã hết hạn đăng ký' : (cls.status || 'Đang mở')}
      </span>
      {cls.department && (
        <span className="rounded-full bg-indigo-50/80 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 border border-indigo-100">
          Khoa: {cls.department}
        </span>
      )}
      <span className="ml-auto">{action}</span>
    </div>
  );
}

export function StudentCourseRegistration() {
  const toast = useToast();
  const confirm = useConfirm();
  const { user, profile } = useAuth();
  const { data: openData, isLoading } = useOpenClasses();
  const { data: mineData } = useMyEnrollments();
  const { enroll, cancel } = useEnrollmentMutations();

  const studentDept =
    user?.khoa ||
    user?.department ||
    profile?.department ||
    profile?.departmentRef?.name ||
    profile?.departmentRef?.id ||
    '';

  const deptCandidates = useMemo(
    () => [user?.khoa, user?.department, profile?.department, profile?.departmentRef?.name, profile?.departmentRef?.id].filter(Boolean),
    [user, profile]
  );

  const enrollments = useMemo(() => mineData?.data || [], [mineData]);
  const enrolledClassIds = useMemo(() => new Set(enrollments.map((e) => e.class?._id)), [enrollments]);
  const enrolledCourseIds = useMemo(
    () => new Set(enrollments.map((e) => e.class?.courseId).filter(Boolean)),
    [enrollments]
  );

  const filteredOpenClasses = useMemo(() => {
    const raw = openData?.data || [];
    if (deptCandidates.length === 0) return raw;
    return raw.filter((cls) => {
      const classDept = cls.department || cls.courseRef?.department;
      if (!classDept) return false;
      return deptCandidates.some((candidate) => matchDepartment(classDept, candidate));
    });
  }, [openData, deptCandidates]);

  const groups = useMemo(() => groupByCourse(filteredOpenClasses), [filteredOpenClasses]);

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

  const cancellationLocked = (cls) =>
    cls?.status !== 'Đang mở' ||
    Boolean(
      cls.registrationEnd &&
      registrationDateTimeInput(cls.registrationEnd, true) < getCurrentDateTimeLocalWithSeconds()
    );

  const enrolledColumns = [
    { key: 'classId', header: 'Mã lớp học phần', className: 'font-semibold text-gray-800 w-32' },
    {
      key: 'className',
      header: 'Tên lớp học phần',
      render: (e) => (
        <span className="font-medium text-gray-800 truncate max-w-[200px] block" title={e.class?.className || ''}>
          {e.class?.className || '—'}
        </span>
      ),
    },
    {
      key: 'courseName',
      header: 'Học phần',
      render: (e) => (
        <div>
          <span className="font-mono font-bold text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-100">
            {e.class?.courseId || '—'}
          </span>
          <span className="font-semibold text-gray-900 truncate max-w-[220px] block mt-1" title={e.class?.courseName}>
            {e.class?.courseName || '—'}
          </span>
        </div>
      ),
    },
    {
      key: 'teacher',
      header: 'Giảng viên',
      render: (e) =>
        e.class?.teacher ? (
          <div className="flex items-center gap-2 max-w-[160px]">
            <Avatar src={e.class?.teacherRef?.avatar?.url || e.class?.teacherRef?.avatar} name={e.class.teacher} size={24} />
            <span className="text-xs font-semibold text-gray-800 truncate" title={e.class.teacher}>{e.class.teacher}</span>
          </div>
        ) : (
          <span className="text-gray-400 text-xs italic">Chưa phân công</span>
        ),
    },
    {
      key: 'schedules',
      header: 'Lịch học & Phòng',
      render: (e) => (
        <ScheduleRoomBadge
          schedules={e.class?.schedules}
          room={e.class?.room}
          studyStart={e.class?.studyStart}
          studyEnd={e.class?.studyEnd}
        />
      ),
    },
    {
      key: 'registrationPeriod',
      header: 'Thời gian đăng ký',
      render: (e) => (
        <span className="text-xs text-gray-600">
          {formatRegistrationDateTime(e.class?.registrationStart)} – {formatRegistrationDateTime(e.class?.registrationEnd, true)}
        </span>
      ),
    },
    { key: 'fee', header: 'Học phí', render: (e) => formatCurrency(e.class?.fee) },
    {
      key: 'status',
      header: 'Trạng thái',
      render: (e) => {
        const isLocked = cancellationLocked(e.class);
        return (
          <span
            className={`text-xs font-semibold ${
              isLocked
                ? 'text-amber-700'
                : e.class?.status === 'Đang mở'
                  ? 'text-emerald-700'
                  : 'text-gray-500'
            }`}
          >
            {isLocked ? (
              <span className="inline-flex items-center gap-1 font-medium bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-200">
                <i className="fas fa-lock text-[10px]" />
                Đã khóa (hết hạn)
              </span>
            ) : (
              e.class?.status || '—'
            )}
          </span>
        );
      },
    },
    {
      key: 'action',
      header: '',
      className: 'text-right w-28',
      render: (e) => {
        const isLocked = cancellationLocked(e.class);
        if (isLocked) {
          return (
            <span
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-500 text-xs font-medium cursor-not-allowed border border-gray-200"
              title="Thời hạn đăng ký đã kết thúc — đã khóa tính năng hủy (chế độ chỉ xem / read-only)"
            >
              <i className="fas fa-lock text-[10px]" />
              Đã khóa
            </span>
          );
        }
        return (
          <button
            type="button"
            onClick={() => doCancel(e)}
            disabled={cancel.isPending}
            className="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 disabled:opacity-60 cursor-pointer"
          >
            Hủy
          </button>
        );
      },
    },
  ];

  if (isLoading) return <Spinner />;

  return (
    <div className="space-y-8">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <PageHeader title="Đăng ký học phần" subtitle="Chọn một lớp cho mỗi học phần bạn muốn học" />
          {studentDept && (
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-indigo-50 border border-indigo-100 text-xs font-bold text-indigo-700 shadow-2xs">
              <i className="fas fa-building-columns text-indigo-500" />
              <span>Khoa: {studentDept}</span>
            </div>
          )}
        </div>

        {groups.length === 0 ? (
          <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-10 text-center text-gray-400">
            {studentDept
              ? `Hiện không có lớp học phần nào đang mở đăng ký cho ${studentDept}.`
              : 'Hiện không có lớp nào đang mở đăng ký.'}
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map((group) => {
              const registeredInCourse = enrolledCourseIds.has(group.courseId);
              return (
                <section key={group.courseId} className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-indigo-50 to-violet-50 border-b border-gray-100">
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-xs font-bold uppercase tracking-wider text-indigo-500">{group.courseId} · {group.credits} tín chỉ</p>
                        {group.department && (
                          <span className="text-[11px] font-semibold text-slate-600 bg-white/90 px-2 py-0.2 rounded border border-slate-200/80">
                            Khoa: {group.department}
                          </span>
                        )}
                      </div>
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
