import { useCallback, useEffect, useMemo, useState } from 'react';
import GVLayout from '../layouts/GVLayout';
import teacherAPI from '../services/teacherAPI';
import {
  fetchOpenRegistrations,
  getSessionFromShiftId,
  OPEN_REGISTRATIONS_UPDATED_EVENT,
} from '../utils/registrationUtils';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
const DAY_NAMES = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
const DAY_KEYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SESSIONS = ['sang', 'chieu', 'toi'];
const SESSION_LABELS = { sang: 'Sáng', chieu: 'Chiều', toi: 'Tối' };

function getStartOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

function formatDate(date) {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export default function TeacherSchedule() {
  const [currentViewDate, setCurrentViewDate] = useState(new Date());
  const [openRegs, setOpenRegs] = useState([]);
  const [myTeacherId, setMyTeacherId] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadSchedule = useCallback(async () => {
    setLoading(true);
    try {
      const user = JSON.parse(sessionStorage.getItem('currentUser'));
      const teachers = await teacherAPI.getAllTeachers({ fresh: true });
      const teacherRecord = teachers.find((t) => t.email?.toLowerCase() === user?.email?.toLowerCase());
      setMyTeacherId(teacherRecord?.id ?? null);
      const regs = await fetchOpenRegistrations({ fresh: true });
      setOpenRegs(regs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSchedule();
    const onUpdate = () => loadSchedule();
    window.addEventListener(OPEN_REGISTRATIONS_UPDATED_EVENT, onUpdate);
    return () => {
      window.removeEventListener(OPEN_REGISTRATIONS_UPDATED_EVENT, onUpdate);
    };
  }, [loadSchedule]);

  const mySchedule = useMemo(
    () => (myTeacherId != null ? openRegs.filter((reg) => reg.teacherId == myTeacherId) : []),
    [openRegs, myTeacherId]
  );

  const weekData = useMemo(() => {
    const startOfWeek = getStartOfWeek(new Date(currentViewDate));
    const headers = [];
    const cells = {};

    DAY_KEYS.forEach((key) => {
      SESSIONS.forEach((session) => {
        cells[`${key}-${session}`] = [];
      });
    });

    for (let i = 0; i < 7; i++) {
      const dateInWeek = new Date(startOfWeek);
      dateInWeek.setDate(startOfWeek.getDate() + i);
      dateInWeek.setHours(0, 0, 0, 0);
      headers.push({ label: DAY_NAMES[i], date: formatDate(dateInWeek) });

      mySchedule.forEach((course, idx) => {
        const startDate = new Date(course.studyStart);
        const endDate = new Date(course.studyEnd);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);

        if (dateInWeek >= startDate && dateInWeek <= endDate && course.schedules) {
          course.schedules.forEach((session) => {
            const checkDayId = i === 6 ? 'CN' : String(i + 2);
            if (session.dayId === checkDayId) {
              const sessionGroup = getSessionFromShiftId(session.shiftId);
              if (sessionGroup) {
                const key = `${DAY_KEYS[i]}-${sessionGroup}`;
                cells[key].push({
                  course,
                  session,
                  color: COLORS[idx % COLORS.length],
                });
              }
            }
          });
        }
      });
    }

    return { headers, cells };
  }, [currentViewDate, mySchedule]);

  const navigateWeek = (type) => {
    setCurrentViewDate((prev) => {
      const d = new Date(prev);
      if (type === 'today') return new Date();
      if (type === 'prev') d.setDate(d.getDate() - 7);
      else if (type === 'next') d.setDate(d.getDate() + 7);
      return d;
    });
  };

  const datePickerValue = currentViewDate.toISOString().split('T')[0];

  return (
    <GVLayout>
      <div className="p-4 md:p-6">
        <ScheduleToolbar
          datePickerValue={datePickerValue}
          onDateChange={(v) => setCurrentViewDate(new Date(v))}
          navigateWeek={navigateWeek}
        />
        <div className="bg-white border-x border-b border-gray-200 overflow-x-auto shadow-sm">
          {loading ? (
            <p className="p-8 text-center text-gray-400">Đang tải thời khóa biểu...</p>
          ) : (
            <table className="tkb-table">
              <thead>
                <tr>
                  <th className="ca-hoc-col border-r">Ca dạy</th>
                  {weekData.headers.map((h) => (
                    <th key={h.label} className="text-center">
                      <div className="text-indigo-600">{h.label}</div>
                      <div className="text-gray-400 font-normal text-xs">{h.date}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SESSIONS.map((session) => (
                  <tr key={session}>
                    <td className="ca-hoc-col">{SESSION_LABELS[session]}</td>
                    {DAY_KEYS.map((dayKey) => (
                      <td key={`${dayKey}-${session}`} className="tkb-cell">
                        {(weekData.cells[`${dayKey}-${session}`] || []).map((item, i) => (
                          <div
                            key={`${item.course.id}-${i}`}
                            className="course-card"
                            style={{ backgroundColor: item.color }}
                          >
                            <span className="course-name">{item.course.courseName}</span>
                            <CourseCardInfo course={item.course} session={item.session} />
                          </div>
                        ))}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </GVLayout>
  );
}

function ScheduleToolbar({ datePickerValue, onDateChange, navigateWeek }) {
  return (
    <div className="bg-white rounded-t-xl border border-gray-200 p-4 flex flex-wrap items-center justify-between gap-4 mb-0">
      <div>
        <h2 className="text-xl font-bold text-gray-800">Lịch dạy theo tuần</h2>
        <p className="text-xs text-gray-500">Xem và quản lý thời gian giảng dạy</p>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center bg-gray-100 rounded-lg p-1">
          <input
            type="date"
            value={datePickerValue}
            onChange={(e) => onDateChange(e.target.value)}
            className="bg-transparent border-none text-sm focus:ring-0 cursor-pointer"
          />
        </div>
        <button type="button" onClick={() => navigateWeek('today')} className="bg-indigo-600 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-indigo-700 flex items-center gap-2">
          <i className="fas fa-calendar-day" /> Hôm nay
        </button>
        <button type="button" onClick={() => navigateWeek('prev')} className="bg-white border border-gray-200 text-gray-600 px-3 py-1.5 rounded text-sm hover:bg-gray-50">
          <i className="fas fa-chevron-left" />
        </button>
        <button type="button" onClick={() => navigateWeek('next')} className="bg-white border border-gray-200 text-gray-600 px-3 py-1.5 rounded text-sm hover:bg-gray-50">
          <i className="fas fa-chevron-right" />
        </button>
      </div>
    </div>
  );
}

function CourseCardInfo({ course, session }) {
  return (
    <div className="course-info" style={{ whiteSpace: 'nowrap' }}>
      <i className="fas fa-clock mr-1" />
      {session.shiftLabel}
      <br />
      <i className="fas fa-map-marker-alt mr-1" />
      Phòng: {course.room || 'TBA'}
      <br />
      <i className="fas fa-users mr-1" />
      Mã lớp: {course.courseId}
    </div>
  );
}
