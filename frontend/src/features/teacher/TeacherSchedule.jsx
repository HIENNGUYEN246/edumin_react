import React, { useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import { StudentWeeklySchedule } from '../student/StudentWeeklySchedule.jsx';
import { useMyTeacherClasses } from './useTeacherClasses.js';
import { ScheduleChangeNotificationModal } from '../../components/notifications/ScheduleChangeNotificationModal.jsx';

export function TeacherSchedule() {
  const { data, isLoading } = useMyTeacherClasses();
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (isLoading) return <Spinner />;

  const classes = data?.data || [];

  return (
    <div>
      <PageHeader
        title="Lịch dạy"
        actions={
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-sm hover:shadow transition"
          >
            <i className="fas fa-bullhorn" />
            <span>Thông báo đổi lịch học</span>
          </button>
        }
      />
      {classes.length === 0 ? (
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-8 text-center text-gray-400">
          Bạn chưa được phân công lớp nào.
        </div>
      ) : (
        <StudentWeeklySchedule classes={classes} audience="teacher" />
      )}

      {isModalOpen && (
        <ScheduleChangeNotificationModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          userRole="giao-vien"
        />
      )}
    </div>
  );
}

export default TeacherSchedule;
