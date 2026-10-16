import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { StudentWeeklySchedule, getStartPeriod } from './StudentWeeklySchedule.jsx';

const classes = [
  {
    _id: 'class-1',
    id: 'IT101-01',
    courseId: 'IT101',
    courseName: 'Nhập môn lập trình',
    className: 'Lớp CNTT-K18',
    room: 'A101',
    teacher: 'Trần Minh Quân',
    schedules: [
      { dayId: '2', shiftId: 'S1' },
      { dayId: '2', shiftId: 'C2' },
      { dayId: '2', shiftId: 'T1' },
    ],
  },
];

describe('StudentWeeklySchedule', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows course details in the correct study periods', () => {
    render(<StudentWeeklySchedule classes={classes} />);

    expect(screen.getByText('Lịch học theo tuần')).toBeInTheDocument();
    expect(screen.getByText(/3 buổi học trong tuần này/)).toBeInTheDocument();
    expect(screen.getAllByText('Nhập môn lập trình')).toHaveLength(3);
    expect(screen.getAllByText('Phòng A101')).toHaveLength(3);
    expect(screen.getAllByText('Trần Minh Quân')).toHaveLength(3);
    expect(screen.getByText(/Tiết 1 - 3 \(07:00 - 09:15\)/)).toBeInTheDocument();
    expect(screen.getByText(/Tiết 10 - 12 \(15:00 - 17:15\)/)).toBeInTheDocument();
    expect(screen.getByText(/Tiết 13 - 15 \(18:00 - 20:15\)/)).toBeInTheDocument();
  });

  it('changes the displayed week using the date picker and week actions', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 11, 12));
    render(<StudentWeeklySchedule classes={classes} />);

    const dateInput = screen.getByLabelText('Chọn ngày trong tuần');
    fireEvent.change(dateInput, { target: { value: '2026-10-14' } });
    expect(screen.getByText(/12\/10\/2026 - 18\/10\/2026/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Tuần trước' }));
    expect(screen.getByText(/05\/10\/2026 - 11\/10\/2026/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Hôm nay/ }));
    expect(dateInput).toHaveValue('2026-10-11');
  });

  it('shows full dates and hides class sessions outside the study period', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 11, 12));
    const classWithStudyPeriod = {
      ...classes[0],
      studyStart: '2026-10-07',
      studyEnd: '2026-10-10',
      schedules: [
        { dayId: '2', shiftId: 'S1' },
        { dayId: '4', shiftId: 'S1' },
        { dayId: 'CN', shiftId: 'S1' },
      ],
    };
    render(<StudentWeeklySchedule classes={[classWithStudyPeriod]} />);

    screen
      .getAllByRole('columnheader')
      .slice(1)
      .forEach((header) => {
        expect(header).toHaveTextContent(/\/10\/2026/);
      });
    expect(screen.getByText(/1 buổi học trong tuần này/)).toBeInTheDocument();
    expect(screen.getAllByText('Nhập môn lập trình')).toHaveLength(1);
  });

  it('uses teaching labels when displaying the teacher weekly schedule', () => {
    render(<StudentWeeklySchedule classes={classes} audience="teacher" />);

    expect(screen.getByText('Lịch dạy theo tuần')).toBeInTheDocument();
    expect(screen.getByText(/1 lớp học phần/)).toBeInTheDocument();
    expect(screen.getByText(/3 buổi dạy trong tuần này/)).toBeInTheDocument();
  });

  it('sorts classes in the same day chronologically ascending by startPeriod (Tiết 1-3 before Tiết 4-6)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 12, 12)); // Monday Oct 12, 2026

    // Two classes on Monday (Thứ 2, dayId: '2')
    // Pass classLate (Tiết 4-6) FIRST in array to ensure sorting works regardless of input order
    const classLate = {
      _id: 'class-late',
      id: 'CS102-01',
      courseId: 'CS102',
      courseName: 'Cấu trúc dữ liệu',
      schedules: [{ dayId: '2', shiftId: 'S2' }], // Tiết 4 - 6
    };
    const classEarly = {
      _id: 'class-early',
      id: 'CS101-01',
      courseId: 'CS101',
      courseName: 'Lập trình C cơ bản',
      schedules: [{ dayId: '2', shiftId: 'S1' }], // Tiết 1 - 3
    };

    render(<StudentWeeklySchedule classes={[classLate, classEarly]} />);

    const articles = screen.getAllByRole('article');
    expect(articles).toHaveLength(2);

    // Verify Tiết 1 - 3 comes first, Tiết 4 - 6 comes second
    expect(articles[0]).toHaveTextContent('Lập trình C cơ bản');
    expect(articles[0]).toHaveTextContent(/Tiết 1 - 3/);
    expect(articles[1]).toHaveTextContent('Cấu trúc dữ liệu');
    expect(articles[1]).toHaveTextContent(/Tiết 4 - 6/);
  });

  it('supports explicit startPeriod or tietBatDau sorting', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 12, 12));

    const classAfternoon2 = {
      _id: 'c-aft2',
      courseName: 'Kỹ năng giao tiếp',
      schedules: [{ dayId: '2', shiftId: 'C2', startPeriod: 10 }],
    };
    const classAfternoon1 = {
      _id: 'c-aft1',
      courseName: 'Pháp luật đại cương',
      schedules: [{ dayId: '2', shiftId: 'C1', startPeriod: 7 }],
    };

    render(<StudentWeeklySchedule classes={[classAfternoon2, classAfternoon1]} />);

    const articles = screen.getAllByRole('article');
    expect(articles).toHaveLength(2);
    expect(articles[0]).toHaveTextContent('Pháp luật đại cương');
    expect(articles[1]).toHaveTextContent('Kỹ năng giao tiếp');
  });

  it('getStartPeriod correctly resolves periods from lessons, shifts, and explicit fields', () => {
    expect(getStartPeriod({ startPeriod: 4 })).toBe(4);
    expect(getStartPeriod({ tietBatDau: 7 })).toBe(7);
    expect(getStartPeriod({}, { lessons: 'Tiết 1 - 3' })).toBe(1);
    expect(getStartPeriod({}, { lessons: 'Tiết 4 - 6' })).toBe(4);
    expect(getStartPeriod({ shiftId: 'S1' })).toBe(1);
    expect(getStartPeriod({ shiftId: 'S2' })).toBe(4);
    expect(getStartPeriod({ shiftId: 'C1' })).toBe(7);
    expect(getStartPeriod({ shiftId: 'C2' })).toBe(10);
    expect(getStartPeriod({ shiftId: 'T1' })).toBe(13);
  });
});
