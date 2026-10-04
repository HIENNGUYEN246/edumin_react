import React from 'react';
import { dayInfo, shiftInfo } from '../../lib/schedule.js';
import { formatDate } from '../../lib/format.js';

/**
 * Individual schedule session pill (e.g. "[T2] 07:00 - 09:15 (Tiết 1-3)")
 */
export function ScheduleSlotBadge({ slot, compact = false }) {
  if (!slot) return null;
  const day = dayInfo(slot.dayId);
  const shift = shiftInfo(slot.shiftId);

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xl border border-gray-200/90 bg-white shadow-2xs hover:border-indigo-300 hover:shadow-xs transition-all text-xs ${
        compact ? 'text-[11px]' : ''
      }`}
      title={`${day.label} • ${shift.label}`}
    >
      <span
        className={`px-1.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${day.badgeBg}`}
      >
        {day.short}
      </span>
      <span className="font-semibold text-gray-800 text-[11px] whitespace-nowrap flex items-center gap-1">
        <i className={`far ${shift.icon || 'fa-clock text-gray-400'} text-[10px]`} />
        <span>{shift.time || shift.lessons}</span>
      </span>
      {shift.time && shift.lessons && (
        <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap hidden sm:inline">
          ({shift.lessons})
        </span>
      )}
    </span>
  );
}

/**
 * Room pill badge with location pin icon
 */
export function RoomBadge({ room, compact = false }) {
  if (!room) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] text-gray-400 italic bg-gray-50 border border-gray-200/70">
        <i className="fas fa-door-closed text-gray-300 text-[10px]" />
        <span>Chưa xếp phòng</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-xl text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200/90 shadow-2xs ${
        compact ? 'text-[11px] py-0.5' : ''
      }`}
      title={`Phòng học: ${room}`}
    >
      <i className="fas fa-location-dot text-rose-500 text-[10px]" />
      <span>Phòng {room}</span>
    </span>
  );
}

/**
 * Combined Schedule & Room Block
 * Displays all sessions of a class alongside room and study period in a visually balanced, beautiful layout.
 */
export function ScheduleRoomBadge({
  schedules = [],
  room = '',
  studyStart = '',
  studyEnd = '',
  layout = 'stack', // 'stack' | 'inline'
  compact = false,
}) {
  const hasSchedules = Array.isArray(schedules) && schedules.length > 0;

  if (!hasSchedules && !room) {
    return (
      <span className="text-gray-400 text-xs italic flex items-center gap-1">
        <i className="far fa-calendar-times text-gray-300" />
        <span>Chưa xếp lịch & phòng</span>
      </span>
    );
  }

  if (layout === 'inline') {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {hasSchedules ? (
          schedules.map((slot, idx) => (
            <ScheduleSlotBadge key={`${slot.dayId}-${slot.shiftId}-${idx}`} slot={slot} compact={compact} />
          ))
        ) : (
          <span className="text-xs text-gray-400 italic">Chưa xếp lịch</span>
        )}
        <RoomBadge room={room} compact={compact} />
      </div>
    );
  }

  return (
    <div className="space-y-1.5 py-0.5">
      {/* Sessions list */}
      {hasSchedules ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {schedules.map((slot, idx) => (
            <ScheduleSlotBadge key={`${slot.dayId}-${slot.shiftId}-${idx}`} slot={slot} compact={compact} />
          ))}
        </div>
      ) : (
        <span className="text-xs text-gray-400 italic block">Chưa xếp lịch học</span>
      )}

      {/* Room and Study Duration Row */}
      <div className="flex flex-wrap items-center gap-2">
        <RoomBadge room={room} compact={compact} />

        {studyStart && studyEnd && (
          <span className="text-[10px] text-gray-500 font-medium flex items-center gap-1" title="Thời gian học phần">
            <i className="far fa-calendar text-gray-400 text-[9px]" />
            <span>
              {formatDate(studyStart)} - {formatDate(studyEnd)}
            </span>
          </span>
        )}
      </div>
    </div>
  );
}

export default ScheduleRoomBadge;
