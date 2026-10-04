import { DAYS, SHIFTS } from '../../lib/schedule.js';
import { ScheduleSlotBadge } from './ScheduleBadge.jsx';

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
    <div className="space-y-3">
      <div className="overflow-x-auto custom-scrollbar border border-gray-200 rounded-2xl bg-white shadow-2xs">
        <table className="w-full text-xs text-center border-collapse table-fixed min-w-[620px]">
          <thead>
            <tr className="bg-slate-50 text-slate-600 border-b border-gray-200">
              <th className="w-[180px] px-3.5 py-3 text-left font-bold text-gray-700 bg-slate-50">
                <div className="flex items-center gap-1.5">
                  <i className="far fa-clock text-indigo-500" />
                  <span>Ca & Tiết học</span>
                </div>
              </th>
              {DAYS.map((d) => (
                <th key={d.id} className="w-[11.7%] px-1 py-2.5 text-center font-bold text-gray-700">
                  <div className="flex flex-col items-center justify-center">
                    <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${d.lightBg || 'bg-gray-100 text-gray-700'}`}>
                      {d.short}
                    </span>
                    <span className="text-[10px] text-gray-400 font-normal mt-0.5 whitespace-nowrap">
                      {d.id === 'cn' ? 'Chủ nhật' : `Thứ ${d.id}`}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {SHIFTS.map((shift) => (
              <tr key={shift.id} className="hover:bg-slate-50/60 transition-colors">
                <td className="px-3.5 py-2.5 text-left whitespace-nowrap bg-slate-50/30 border-r border-gray-100/80">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs shrink-0">
                      <i className={`far ${shift.icon || 'fa-clock'}`} />
                    </span>
                    <div>
                      <div className="font-bold text-gray-800 text-xs">{shift.lessons}</div>
                      <div className="text-[10px] text-gray-400 font-mono">{shift.time}</div>
                    </div>
                  </div>
                </td>
                {DAYS.map((day) => {
                  const active = isSelected(day.id, shift.id);
                  return (
                    <td key={day.id} className="px-1 py-2 text-center align-middle">
                      <button
                        type="button"
                        onClick={() => toggle(day.id, shift.id)}
                        className={`w-8 h-8 rounded-xl transition-all font-bold text-xs flex items-center justify-center mx-auto shadow-2xs ${
                          active
                            ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-200 scale-105'
                            : 'bg-gray-50/80 text-gray-300 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 border border-gray-200/70'
                        }`}
                        title={`${day.label} • ${shift.label}`}
                        aria-label={`${day.label} ${shift.label}`}
                      >
                        <i className={`fas fa-check text-[11px] transition-transform ${active ? 'scale-100' : 'opacity-0 scale-50'}`} />
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Selected Slots Live Preview */}
      <div className="p-3 bg-slate-50/80 rounded-2xl border border-gray-200 flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5 mr-1">
          <i className="fas fa-list-check text-indigo-600 text-xs" />
          <span>Lịch học đã chọn ({value.length} buổi):</span>
        </span>
        {value.length === 0 ? (
          <span className="text-xs text-gray-400 italic">Nhấp vào bảng trên để chọn ca học trong tuần</span>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            {value.map((slot, idx) => (
              <ScheduleSlotBadge key={`${slot.dayId}-${slot.shiftId}-${idx}`} slot={slot} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default SchedulePicker;
