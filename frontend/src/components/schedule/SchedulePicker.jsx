import { DAYS, SHIFTS } from '../../lib/schedule.js';

/**
 * Grid of day × shift checkboxes. `value` is an array of { dayId, shiftId }.
 */
export function SchedulePicker({ value = [], onChange }) {
  const isSelected = (dayId, shiftId) => value.some((s) => s.dayId === dayId && s.shiftId === shiftId);

  const toggle = (dayId, shiftId) => {
    if (isSelected(dayId, shiftId)) {
      onChange(value.filter((s) => !(s.dayId === dayId && s.shiftId === shiftId)));
    } else {
      onChange([...value, { dayId, shiftId }]);
    }
  };

  return (
    <div className="overflow-x-auto custom-scrollbar border border-gray-200 rounded-xl">
      <table className="min-w-full text-xs text-center">
        <thead>
          <tr className="bg-gray-50 text-gray-500">
            <th className="px-2 py-2 text-left">Ca / Thứ</th>
            {DAYS.map((d) => (
              <th key={d.id} className="px-2 py-2">
                {d.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SHIFTS.map((shift) => (
            <tr key={shift.id} className="border-t border-gray-100">
              <td className="px-2 py-2 text-left text-gray-600 whitespace-nowrap">{shift.label}</td>
              {DAYS.map((day) => (
                <td key={day.id} className="px-1 py-1">
                  <button
                    type="button"
                    onClick={() => toggle(day.id, shift.id)}
                    className={`w-7 h-7 rounded-md transition ${
                      isSelected(day.id, shift.id)
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-300 hover:bg-indigo-100'
                    }`}
                    aria-label={`${day.label} ${shift.label}`}
                  >
                    <i className="fas fa-check text-[10px]" />
                  </button>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default SchedulePicker;
