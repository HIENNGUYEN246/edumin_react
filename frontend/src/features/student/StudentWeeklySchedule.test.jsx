import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { StudentWeeklySchedule } from './StudentWeeklySchedule.jsx';

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
});
