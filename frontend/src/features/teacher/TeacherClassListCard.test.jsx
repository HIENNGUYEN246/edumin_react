import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { TeacherClassList, getCoursePeriodsBreakdown } from './TeacherClassList.jsx';

vi.mock('./useTeacherClasses.js', () => ({
  useMyTeacherClasses: vi.fn().mockReturnValue({
    data: {
      data: [
        {
          _id: 'cls-101',
          id: 'IT101-01',
          className: 'Lớp 01',
          courseId: 'IT101',
          courseName: 'Lập trình Web nâng cao',
          credits: 3,
          theoryPeriods: 30,
          practicePeriods: 15,
          totalPeriods: 45,
          teacher: 'TS. Nguyễn Văn A',
          department: 'Khoa Công nghệ Thông tin',
          enrolledCount: 42,
          capacity: 50,
          schedules: [{ dayId: '2', shiftId: '1' }, { dayId: '4', shiftId: '2' }],
          room: 'A305',
          prerequisites: 'Lập trình Cơ sở (IT100)',
          description: 'Học phần trang bị kiến thức phát triển ứng dụng Web hiện đại fullstack.',
          gradeWeights: {
            attendance: 10,
            homework: 15,
            midterm: 25,
            final: 50,
          },
        },
        {
          _id: 'cls-102',
          id: 'IT202-01',
          className: 'Lớp TH 01',
          courseId: 'IT202-TH',
          courseName: 'Thực hành Mạng máy tính',
          credits: 2,
          courseType: 'TH',
          teacher: 'ThS. Trần Thị B',
          schedules: [{ dayId: '3', shiftId: '3' }],
          room: 'Lab-B201',
        },
      ],
    },
    isLoading: false,
  }),
}));

vi.mock('../../components/notifications/ScheduleChangeNotificationModal.jsx', () => ({
  ScheduleChangeNotificationModal: ({ isOpen, onClose }) =>
    isOpen ? (
      <div data-testid="schedule-change-modal">
        <span>Modal Điều phối & Thông báo Đổi lịch học</span>
        <button onClick={onClose}>Đóng</button>
      </div>
    ) : null,
}));

function renderWithProviders(ui) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('TeacherClassList Card Layout & Course Detail Overhaul', () => {
  it('correctly calculates decoupled Theory and Practice periods in helper', () => {
    // 1. Explicit periods
    const explicit = getCoursePeriodsBreakdown({
      theoryPeriods: 30,
      practicePeriods: 15,
      credits: 3,
    });
    expect(explicit.theory).toBe(30);
    expect(explicit.practice).toBe(15);
    expect(explicit.total).toBe(45);

    // 2. Purely Practice course
    const thCourse = getCoursePeriodsBreakdown({
      courseName: 'Thực hành Cơ sở dữ liệu',
      credits: 2,
      totalPeriods: 30,
    });
    expect(thCourse.theory).toBe(0);
    expect(thCourse.practice).toBe(30);
    expect(thCourse.typeLabel).toBe('Thực hành (TH)');

    // 3. Combined course default ratio (2/3 LT, 1/3 TH)
    const combined = getCoursePeriodsBreakdown({
      courseName: 'Trí tuệ nhân tạo',
      credits: 3,
      totalPeriods: 45,
    });
    expect(combined.theory).toBe(30);
    expect(combined.practice).toBe(15);
    expect(combined.typeLabel).toBe('Lý thuyết & Thực hành');
  });

  it('renders modern Card Layout with class information, teacher, schedule, and room badges', () => {
    renderWithProviders(<TeacherClassList />);

    // Class cards should display codes and names
    expect(screen.getByText('IT101-01')).toBeInTheDocument();
    expect(screen.getByText('Lập trình Web nâng cao')).toBeInTheDocument();
    expect(screen.getByText('IT202-01')).toBeInTheDocument();
    expect(screen.getByText('Thực hành Mạng máy tính')).toBeInTheDocument();

    // Teacher and department info
    expect(screen.getByText(/GV: TS. Nguyễn Văn A/i)).toBeInTheDocument();
    expect(screen.getByText(/Khoa Công nghệ Thông tin/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Sĩ số:/i).length).toBeGreaterThan(0);

    // Core action buttons per card: Điểm danh, Điểm số, Sinh viên
    expect(screen.getByRole('link', { name: /Điểm danh lớp IT101-01/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Danh sách điểm số lớp IT101-01/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Danh sách sinh viên lớp IT101-01/i })).toBeInTheDocument();

    // NO "Báo đổi lịch" button inside the cards
    const cardScheduleButtons = screen.queryAllByRole('button', { name: /^Báo đổi lịch$/i });
    expect(cardScheduleButtons.length).toBe(0);

    // Top CTA "Điều phối & Báo đổi lịch" exists in header
    const topCtaBtn = screen.getByRole('button', { name: /Điều phối & Báo đổi lịch/i });
    expect(topCtaBtn).toBeInTheDocument();

    // Clicking top CTA opens schedule coordination modal
    fireEvent.click(topCtaBtn);
    expect(screen.getByTestId('schedule-change-modal')).toBeInTheDocument();
  });

  it('opens Course Details modal with decoupled LT/TH breakdown, prerequisites, and grade weights', () => {
    renderWithProviders(<TeacherClassList />);

    // Click "Chi tiết học phần" on the first card
    const detailButtons = screen.getAllByRole('button', { name: /Chi tiết học phần/i });
    expect(detailButtons.length).toBeGreaterThan(0);
    fireEvent.click(detailButtons[0]);

    // Modal should appear
    expect(screen.getByText(/Thông tin chi tiết học phần: Lập trình Web nâng cao/i)).toBeInTheDocument();

    // Decoupled Theory and Practice periods displayed
    expect(screen.getByText(/30 tiết/i)).toBeInTheDocument();
    expect(screen.getAllByText(/15 tiết/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Lý thuyết \(LT\)/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Thực hành \(TH\)/i).length).toBeGreaterThan(0);

    // Prerequisites and Description displayed
    expect(screen.getByText(/Lập trình Cơ sở \(IT100\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Học phần trang bị kiến thức phát triển ứng dụng Web/i)).toBeInTheDocument();

    // Grade weights breakdown displayed
    expect(screen.getByText(/Chuyên cần/i)).toBeInTheDocument();
    expect(screen.getByText('10%')).toBeInTheDocument();
    expect(screen.getByText('15%')).toBeInTheDocument();
    expect(screen.getByText('25%')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();

    // Close button dismisses modal
    const closeBtns = screen.getAllByRole('button', { name: /^Đóng$/i });
    fireEvent.click(closeBtns[0]);
    expect(screen.queryByText(/Thông tin chi tiết học phần: Lập trình Web nâng cao/i)).not.toBeInTheDocument();
  });
});
