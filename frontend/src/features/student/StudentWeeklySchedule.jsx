import { useMemo, useState } from 'react';
import { DAYS, SHIFTS } from '../../lib/schedule.js';

const SESSION_GROUPS = [
  {
    id: 'sang',
    label: 'Sáng',
    lessons: 'Tiết 1 - 6',
    time: '07:00 - 11:45',
    icon: 'fa-sun',
    shifts: ['S1', 'S2'],
  },
  {
    id: 'chieu',
    label: 'Chiều',
    lessons: 'Tiết 7 - 12',
    time: '12:30 - 17:15',
    icon: 'fa-cloud-sun',
    shifts: ['C1', 'C2'],
  },
  {
    id: 'toi',
    label: 'Tối',
    lessons: 'Tiết 13 - 15',
    time: '18:00 - 20:15',
    icon: 'fa-moon',
    shifts: ['T1'],
  },
];

const CARD_STYLES = [
  'border-indigo-500 bg-indigo-50 text-indigo-950',
  'border-emerald-500 bg-emerald-50 text-emerald-950',
  'border-amber-500 bg-amber-50 text-amber-950',
  'border-rose-500 bg-rose-50 text-rose-950',
  'border-violet-500 bg-violet-50 text-violet-950',
  'border-cyan-500 bg-cyan-50 text-cyan-950',
];

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getWeekDates(value) {
  const date = new Date(`${value}T12:00:00`);
  const mondayOffset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - mondayOffset);

  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(date);
    day.setDate(date.getDate() + index);
    return day;
  });
}

function formatDayDate(date) {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function isClassActiveOnDate(cls, date) {
  const studyStart = cls.studyStart?.slice(0, 10);
  const studyEnd = cls.studyEnd?.slice(0, 10);
  const dateValue = toDateInputValue(date);

  return (!studyStart || dateValue >= studyStart) && (!studyEnd || dateValue <= studyEnd);
}

function formatWeekRange(dates) {
  const format = new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  return `${format.format(dates[0])} - ${format.format(dates[6])}`;
}

function getCardStyle(cls) {
  const key = cls._id || cls.id || cls.courseId || cls.courseName || '';
  const hash = Array.from(String(key)).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return CARD_STYLES[hash % CARD_STYLES.length];
}

function ScheduleCard({ cls, shift }) {
  const teacher =
    typeof cls.teacher === 'object' ? cls.teacher?.hoTen || cls.teacher?.name : cls.teacher;
  const style = getCardStyle(cls);

  return (
    <article
      className={`rounded-lg border-l-4 p-2.5 shadow-sm ${style}`}
      title={`${cls.courseName || cls.courseId || 'Học phần'} · ${shift.lessons} (${shift.time})`}
    >
      {cls.courseId && (
        <span className="mb-1 inline-flex rounded border border-current/15 bg-white/75 px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wide">
          {cls.courseId}
        </span>
      )}
      <h3 className="text-xs font-extrabold leading-snug">
        {cls.courseName || cls.courseId || 'Học phần'}
      </h3>
      <div className="mt-1.5 space-y-1 text-[10px] font-medium leading-tight text-slate-700">
        <p className="flex items-start gap-1.5">
          <i className="fas fa-clock mt-px w-3 text-center text-slate-500" aria-hidden="true" />
          <span>
            {shift.lessons} ({shift.time})
          </span>
        </p>
        {cls.room && (
          <p className="flex items-center gap-1.5">
            <i className="fas fa-location-dot w-3 text-center text-slate-500" aria-hidden="true" />
            <span>Phòng {cls.room}</span>
          </p>
        )}
        {(cls.className || cls.id) && (
          <p className="flex items-center gap-1.5">
            <i className="fas fa-users w-3 text-center text-slate-500" aria-hidden="true" />
            <span>{cls.className || cls.id}</span>
          </p>
        )}
        {teacher && (
          <p className="flex items-center gap-1.5 border-t border-current/10 pt-1">
            <i className="fas fa-user-tie w-3 text-center text-slate-500" aria-hidden="true" />
            <span className="truncate">{teacher}</span>
          </p>
        )}
      </div>
    </article>
  );
}

export function StudentWeeklySchedule({ classes = [] }) {
  const [selectedDate, setSelectedDate] = useState(() => toDateInputValue(new Date()));
  const dates = useMemo(() => getWeekDates(selectedDate), [selectedDate]);
  const today = toDateInputValue(new Date());
  const sessions = dates.reduce((count, date) => {
    const dayId = DAYS[(date.getDay() + 6) % 7].id;
    return (
      count +
      classes.reduce(
        (dayCount, cls) =>
          dayCount +
          (isClassActiveOnDate(cls, date)
            ? (cls.schedules || []).filter((slot) => String(slot.dayId) === dayId).length
            : 0),
        0
      )
    );
  }, 0);

  function moveWeek(offset) {
    const date = new Date(`${selectedDate}T12:00:00`);
    date.setDate(date.getDate() + offset * 7);
    setSelectedDate(toDateInputValue(date));
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Lịch học theo tuần</h2>
          <p className="mt-1 text-sm text-slate-500">
            Tuần {formatWeekRange(dates)} · {classes.length} học phần · {sessions} buổi học mỗi tuần
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="student-timetable-date" className="sr-only">
            Chọn ngày trong tuần
          </label>
          <input
            id="student-timetable-date"
            type="date"
            value={selectedDate}
            onChange={(event) => {
              if (event.target.value) setSelectedDate(event.target.value);
            }}
            className="h-10 rounded-lg border border-slate-300 px-3 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
          />
          <button
            type="button"
            onClick={() => setSelectedDate(today)}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-indigo-600 px-3 text-sm font-semibold text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/20"
          >
            <i className="far fa-calendar-check" aria-hidden="true" />
            Hôm nay
          </button>
          <button
            type="button"
            onClick={() => moveWeek(-1)}
            aria-label="Tuần trước"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
          >
            <i className="fas fa-chevron-left" aria-hidden="true" />
            Trước
          </button>
          <button
            type="button"
            onClick={() => moveWeek(1)}
            aria-label="Tuần tiếp theo"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
          >
            Tiếp
            <i className="fas fa-chevron-right" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="custom-scrollbar overflow-x-auto">
        <table className="w-full min-w-[1080px] table-fixed border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50">
              <th
                scope="col"
                className="w-32 border-b border-r border-slate-200 px-4 py-3 text-left font-bold text-slate-700"
              >
                Ca học
              </th>
              {DAYS.map((day, index) => {
                const date = dates[index];
                const isToday = toDateInputValue(date) === today;
                return (
                  <th
                    key={day.id}
                    scope="col"
                    className={`border-b border-r border-slate-200 px-2 py-3 text-center last:border-r-0 ${
                      isToday ? 'bg-indigo-50' : ''
                    }`}
                  >
                    <span
                      className={`block font-bold ${isToday ? 'text-indigo-700' : 'text-slate-700'}`}
                    >
                      {day.label}
                    </span>
                    <span
                      className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                        isToday ? 'bg-indigo-600 text-white' : 'text-slate-500'
                      }`}
                    >
                      {formatDayDate(date)}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {SESSION_GROUPS.map((group) => (
              <tr key={group.id} className="align-top">
                <th
                  scope="row"
                  className="border-b border-r border-slate-200 bg-amber-50/70 px-4 py-4 text-left"
                >
                  <span className="flex items-center gap-2 font-bold text-slate-800">
                    <i
                      className={`fas ${group.icon} w-4 text-center text-amber-500`}
                      aria-hidden="true"
                    />
                    {group.label}
                  </span>
                  <span className="mt-2 block text-[10px] font-semibold text-slate-500">
                    {group.lessons}
                  </span>
                  <span className="mt-0.5 block text-[10px] text-slate-500">{group.time}</span>
                </th>
                {DAYS.map((day, index) => {
                  const date = dates[index];
                  const isToday = toDateInputValue(date) === today;
                  const items = classes.flatMap((cls) =>
                    (cls.schedules || [])
                      .filter(
                        (slot) =>
                          String(slot.dayId) === day.id &&
                          group.shifts.includes(slot.shiftId) &&
                          isClassActiveOnDate(cls, date)
                      )
                      .map((slot) => ({
                        cls,
                        shift: SHIFTS.find((item) => item.id === slot.shiftId),
                      }))
                  );

                  return (
                    <td
                      key={day.id}
                      className={`h-48 border-b border-r border-slate-200 p-1.5 align-top last:border-r-0 ${
                        isToday ? 'bg-indigo-50/30' : ''
                      }`}
                    >
                      <div className="flex h-full min-h-44 flex-col gap-1.5 rounded-md bg-[radial-gradient(#e2e8f0_0.75px,transparent_0.75px)] [background-size:14px_14px] p-1">
                        {items.map(({ cls, shift }, itemIndex) => (
                          <ScheduleCard
                            key={`${cls._id || cls.id || cls.courseId}-${shift.id}-${itemIndex}`}
                            cls={cls}
                            shift={shift}
                          />
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
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
        <span className="inline-flex items-center gap-2">
          <i className="fas fa-circle text-[8px] text-indigo-500" aria-hidden="true" />
          Ngày hiện tại
        </span>
        <span className="inline-flex items-center gap-2">
          <i className="fas fa-hand-pointer text-slate-400" aria-hidden="true" />
          Chọn ngày hoặc chuyển tuần để xem lịch
        </span>
      </div>
    </section>
  );
}

export default StudentWeeklySchedule;
