import React from 'react';
import { dayInfo, shiftInfo } from '../../lib/schedule.js';
import { formatDate } from '../../lib/format.js';

/**
 * Helper to group schedule slots by shift (or matching shift time/lessons)
 * so multiple days with the same time are compactly rendered together.
 * E.g. [T3, T4, T7, CN] • 07:00 - 09:15 (Tiết 1-3)
 */
export function groupSchedulesByShift(schedules = []) {
  if (!Array.isArray(schedules) || schedules.length === 0) return [];

  const dayOrder = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, CN: 8 };
  const sorted = [...schedules].sort((a, b) => (dayOrder[String(a.dayId)] || 99) - (dayOrder[String(b.dayId)] || 99));

  const groups = new Map();
  sorted.forEach((slot) => {
    const shift = shiftInfo(slot.shiftId);
    const key = slot.shiftId || shift.time || shift.lessons || 'default';
    if (!groups.has(key)) {
      groups.set(key, {
        shift,
        shiftId: slot.shiftId,
        days: [],
      });
    }
    const day = dayInfo(slot.dayId);
    groups.get(key).days.push(day);
  });

  return Array.from(groups.values());
}

/**
 * Compact Grouped schedule pill showing combined day tags and shared time slot.
 * E.g. [T3] [T4] [T7] [CN] • 07:00 - 09:15 (Tiết 1 - 3)
 */
/**
 * Compact Grouped schedule pill showing combined day tags and shared time slot.
 * E.g. [T3] [T4] [T7] [CN] • 07:00 - 09:15 (Tiết 1 - 3)
 */
export function ScheduleGroupBadge({ group, compact = false }) {
  if (!group) return null;
  const { shift, days = [] } = group;

  return (
    <div className="flex flex-col gap-1.5">
      {/* Khối 1: Các Thứ trong tuần dạng tag gọn gàng */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 select-none">
          Thứ:
        </span>
        <div className="flex flex-wrap items-center gap-1">
          {days.map((day) => (
            <span
              key={day.id}
              className={`px-1.5 py-0.5 rounded text-[10.5px] font-bold uppercase tracking-wider shadow-2xs ${day.badgeBg}`}
            >
              {day.short}
            </span>
          ))}
        </div>
      </div>

      {/* Khối 2: Tiết & Giờ học độc lập */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 select-none">
          Ca:
        </span>
        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-50/80 border border-amber-200/70 text-slate-700 text-[11px] font-medium shadow-2xs whitespace-nowrap">
          <i className={`far ${shift.icon || 'fa-clock text-amber-500'} text-[10px] text-amber-600`} />
          {shift.lessons && (
            <>
              <span className="font-bold text-amber-800">
                {shift.lessons.startsWith('Tiết') ? shift.lessons : `Tiết ${shift.lessons.replace(/[^\d-]/g, '')}`}
              </span>
              <span className="text-amber-300 font-bold">•</span>
            </>
          )}
          <span className="font-semibold text-slate-800">{shift.time || shift.lessons}</span>
        </div>
      </div>
    </div>
  );
}

export function ScheduleDaysBadge({ schedules = [], compact = false }) {
  if (!Array.isArray(schedules) || schedules.length === 0) {
    return <span className="text-xs text-slate-400 italic">Chưa xếp thứ</span>;
  }

  const dayOrder = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, CN: 8, '8': 8 };
  const seen = new Set();
  const uniqueDays = [];

  const sortedSlots = [...schedules].sort(
    (a, b) => (dayOrder[String(a.dayId)] || 99) - (dayOrder[String(b.dayId)] || 99)
  );

  sortedSlots.forEach((slot) => {
    const key = String(slot.dayId);
    if (!seen.has(key)) {
      seen.add(key);
      uniqueDays.push(dayInfo(slot.dayId));
    }
  });

  if (uniqueDays.length === 0) {
    return <span className="text-xs text-slate-400 italic">Chưa xếp thứ</span>;
  }

  return (
    <div className="inline-flex flex-wrap items-center gap-1.5">
      {uniqueDays.map((day) => (
        <span
          key={day.id}
          className={`inline-flex items-center justify-center font-bold uppercase tracking-wide rounded-md shadow-2xs select-none transition-transform ${
            compact
              ? 'min-w-[26px] h-5 px-1.5 text-[10.5px]'
              : 'min-w-[28px] h-6 px-2 text-[11px]'
          } ${day.badgeBg}`}
          title={day.label}
        >
          {day.short}
        </span>
      ))}
    </div>
  );
}

/**
 * Combined Days + Time slot badge on a single compact horizontal line.
 * E.g.: [T3] [T5]  Tiết 1 - 3 • 07:00 - 09:15
 */
export function ScheduleTimeCombinedBadge({ schedules = [], compact = false }) {
  const groups = groupSchedulesByShift(schedules);
  if (groups.length === 0) {
    return <span className="text-xs text-slate-400 italic">Chưa xếp lịch học</span>;
  }

  return (
    <div className="flex flex-col gap-1.5 items-start">
      {groups.map((group, idx) => (
        <div key={idx} className="inline-flex items-center gap-2 flex-wrap">
          {/* Day tags */}
          <div className="inline-flex items-center gap-1">
            {group.days.map((day) => (
              <span
                key={day.id}
                className={`inline-flex items-center justify-center font-bold uppercase tracking-wide rounded-md shadow-2xs select-none ${
                  compact
                    ? 'min-w-[26px] h-5 px-1.5 text-[10.5px]'
                    : 'min-w-[28px] h-6 px-1.5 text-[11px]'
                } ${day.badgeBg}`}
                title={day.label}
              >
                {day.short}
              </span>
            ))}
          </div>

          {/* Time & Shift tag */}
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-50/80 border border-amber-200/70 text-slate-700 text-[11px] font-medium shadow-2xs whitespace-nowrap">
            <i className="far fa-clock text-amber-600 text-[10px]" />
            {group.shift.lessons && (
              <>
                <span className="font-bold text-amber-800">
                  {group.shift.lessons.startsWith('Tiết')
                    ? group.shift.lessons
                    : `Tiết ${group.shift.lessons.replace(/[^\d-]/g, '')}`}
                </span>
                <span className="text-amber-300 font-bold">•</span>
              </>
            )}
            <span className="font-semibold text-slate-800">
              {group.shift.time || group.shift.lessons}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Dedicated Shift & Lessons badge
 */
export function ScheduleTimeBadge({ schedules = [], compact = false }) {
  const groups = groupSchedulesByShift(schedules);
  if (groups.length === 0) {
    return <span className="text-xs text-slate-400 italic">Chưa xếp giờ</span>;
  }
  return (
    <div className="flex flex-col gap-1 items-start">
      {groups.map((group, idx) => (
        <div
          key={idx}
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-50/80 border border-amber-200/70 text-slate-700 text-[11px] font-medium shadow-2xs whitespace-nowrap"
        >
          <i className="far fa-clock text-amber-600 text-[10px]" />
          {group.shift.lessons && (
            <>
              <span className="font-bold text-amber-800">
                {group.shift.lessons.startsWith('Tiết') ? group.shift.lessons : `Tiết ${group.shift.lessons.replace(/[^\d-]/g, '')}`}
              </span>
              <span className="text-amber-300 font-bold">•</span>
            </>
          )}
          <span className="font-semibold text-slate-800">{group.shift.time || group.shift.lessons}</span>
        </div>
      ))}
    </div>
  );
}

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
export function RoomBadge({ room, studyStart = '', studyEnd = '', compact = false }) {
  if (!room && !studyStart && !studyEnd) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] text-slate-400 italic bg-slate-50 border border-slate-200/70 whitespace-nowrap">
        <i className="fas fa-door-closed text-slate-300 text-[10px]" />
        <span>Chưa xếp phòng</span>
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-1 items-start">
      {room ? (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200/80 shadow-2xs whitespace-nowrap ${
            compact ? 'text-[10.5px] py-0.5' : ''
          }`}
          title={`Phòng học: ${room}`}
        >
          <i className="fas fa-location-dot text-rose-500 text-[10.5px]" />
          <span>Phòng {room}</span>
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] text-slate-400 italic bg-slate-50 border border-slate-200/70 whitespace-nowrap">
          <i className="fas fa-door-closed text-slate-300 text-[10px]" />
          <span>Chưa xếp phòng</span>
        </span>
      )}
      {studyStart && studyEnd && (
        <span
          className="text-[10px] text-slate-500 font-medium inline-flex items-center gap-1 whitespace-nowrap"
          title="Thời gian học phần"
        >
          <i className="far fa-calendar-alt text-indigo-400 text-[10px]" />
          <span>
            {formatDate(studyStart)} – {formatDate(studyEnd)}
          </span>
        </span>
      )}
    </div>
  );
}

/**
 * Combined Schedule & Room Block
 * 3-line structured layout:
 * - Line 1: Day tags (T3, T4, T7, CN)
 * - Line 2: Time slot & lessons (Tiết 1 - 3 • 07:00 - 09:15)
 * - Line 3: Room & Course date duration (Phòng L303 • 24/10/2026 – 14/11/2026)
 */
export function ScheduleRoomBadge({
  schedules = [],
  room = '',
  studyStart = '',
  studyEnd = '',
  layout = 'stack', // 'stack' | 'inline'
  compact = false,
}) {
  const groups = groupSchedulesByShift(schedules);
  const hasSchedules = groups.length > 0;

  if (!hasSchedules && !room && !studyStart && !studyEnd) {
    return (
      <span className="text-slate-400 text-xs italic flex items-center gap-1.5">
        <i className="far fa-calendar-times text-slate-300" />
        <span>Chưa xếp lịch & phòng</span>
      </span>
    );
  }

  if (layout === 'inline') {
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 py-0.5">
        <ScheduleTimeCombinedBadge schedules={schedules} compact={compact} />
        <RoomBadge room={room} studyStart={studyStart} studyEnd={studyEnd} compact={compact} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 py-1 min-w-[210px] max-w-[340px]">
      {/* Dòng 1: Lịch học (Thứ & Ca giờ học trên cùng 1 hàng) */}
      <ScheduleTimeCombinedBadge schedules={schedules} compact={compact} />

      {/* Dòng 2: Phòng học & Thời gian học phần */}
      <RoomBadge room={room} studyStart={studyStart} studyEnd={studyEnd} compact={compact} />
    </div>
  );
}

export default ScheduleRoomBadge;
