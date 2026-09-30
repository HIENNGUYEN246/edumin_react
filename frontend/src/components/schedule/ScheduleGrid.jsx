import { DAYS, SHIFTS } from '../../lib/schedule.js';

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
      <p className="font-bold text-indigo-700">{cls.courseName || cls.courseId}</p>
      {cls.room && <p className="text-gray-500">Phòng {cls.room}</p>}
      {cls.teacher && <p className="text-gray-400">{cls.teacher}</p>}
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
