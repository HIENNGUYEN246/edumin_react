import { DAYS, SHIFTS } from '../../lib/schedule.js';
import { Avatar } from '../ui/Avatar.jsx';

/**
 * Weekly timetable grid shared by teacher and student views.
 * `classes` is a list of objects carrying `schedules` plus display info.
 * `renderCell(cls)` renders the content for a matched class in a slot.
 */
export function ScheduleGrid({ classes = [], renderCell }) {
  // Index classes by "dayId|shiftId" for O(1) cell lookup.
  const bySlot = new Map();
  classes.forEach((cls) => {
    (cls.schedules || []).forEach((slot) => {
      const key = `${slot.dayId}|${slot.shiftId}`;
      if (!bySlot.has(key)) bySlot.set(key, []);
      bySlot.get(key).push(cls);
    });
  });

  const defaultRender = (cls) => (
    <div className="text-xs">
      {cls.courseId && (
        <span className="font-mono text-[10px] font-bold bg-white text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-200 block w-fit mb-1">
          {cls.courseId}
        </span>
      )}
      <p className="font-bold text-gray-900 leading-tight">{cls.courseName || cls.courseId}</p>
      {cls.className && (
        <p className="text-[11px] font-semibold text-indigo-700 mt-0.5">Lớp {cls.className}</p>
      )}
      {cls.room && <p className="text-gray-500 font-medium text-[11px] mt-0.5">Phòng {cls.room}</p>}
      {cls.teacher && (
        <div className="flex items-center gap-1.5 mt-1 pt-1 border-t border-indigo-100/60 text-gray-600">
          <Avatar
            src={cls.teacherRef?.avatar?.url || cls.teacherRef?.avatar}
            name={cls.teacher}
            size={18}
          />
          <span className="truncate font-medium">{cls.teacher}</span>
        </div>
      )}
    </div>
  );
  const render = renderCell || defaultRender;

  return (
    <div className="overflow-x-auto custom-scrollbar rounded-2xl border border-gray-100 bg-white shadow-sm">
      <table className="min-w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-50 text-gray-500">
            <th className="px-3 py-3 text-left w-48">Ca học</th>
            {DAYS.map((d) => (
              <th key={d.id} className="px-3 py-3 text-center border-l border-gray-100">
                {d.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SHIFTS.map((shift) => (
            <tr key={shift.id} className="border-t border-gray-100 align-top">
              <td className="px-3 py-3 text-gray-600 text-xs whitespace-nowrap">{shift.label}</td>
              {DAYS.map((day) => {
                const items = bySlot.get(`${day.id}|${shift.id}`) || [];
                return (
                  <td key={day.id} className="px-2 py-2 border-l border-gray-100 min-w-[140px]">
                    <div className="space-y-2">
                      {items.map((cls, idx) => (
                        <div key={cls._id || cls.id || idx} className="bg-indigo-50 rounded-lg p-2">
                          {render(cls)}
                        </div>
                      ))}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ScheduleGrid;
