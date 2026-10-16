import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { StudentAttendance } from './StudentAttendance.jsx';

const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
};

vi.mock('../../../app/providers/ToastProvider.jsx', () => ({
  useToast: () => mockToast,
}));

const mockAuthUser = {
  id: 'u-sv1',
  studentId: '7',
  hoTen: 'Nguyễn Văn Sinh Viên',
  email: 'sv7@edu.vn',
  role: 'student',
};

const mockProfile = {
  id: 7,
  hoTen: 'Nguyễn Văn Sinh Viên',
  email: 'sv7@edu.vn',
  className: 'CNTT-K15A',
};

vi.mock('../../../app/providers/AuthProvider.jsx', () => ({
  useAuth: () => ({
    user: mockAuthUser,
    profile: mockProfile,
  }),
}));

vi.mock('../../../api/attendanceApi.js', () => ({
  attendanceApi: {
    getByStudent: vi.fn(),
  },
}));

vi.mock('../../../api/enrollmentsApi.js', () => ({
  enrollmentsApi: {
    mine: vi.fn(),
  },
}));

vi.mock('../../../api/assignmentsApi.js', () => ({
  assignmentsApi: {
    list: vi.fn(),
  },
}));

import { attendanceApi } from '../../../api/attendanceApi.js';
import { enrollmentsApi } from '../../../api/enrollmentsApi.js';
import { assignmentsApi } from '../../../api/assignmentsApi.js';

function renderComponent() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <StudentAttendance />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('StudentAttendance (Attendance & Personal Gradebook)', () => {
  const mockAttendances = [
    {
      _id: 'att-1',
      studentId: 7,
      courseId: 'IT101',
      regId: 'CNTT01-01',
      courseName: 'Lập trình Web',
      date: '2026-10-01',
      shiftId: '1',
      status: 'Có mặt',
      score: 10,
      evaluation: 'Rất chủ động phát biểu',
      teacherName: 'Trần Văn Giáo Viên',
    },
    {
      _id: 'att-2',
      studentId: 7,
      courseId: 'IT101',
      regId: 'CNTT01-01',
      courseName: 'Lập trình Web',
      date: '2026-10-08',
      shiftId: '1',
      status: 'Đi muộn',
      score: 8,
      evaluation: 'Vào muộn 10 phút',
      teacherName: 'Trần Văn Giáo Viên',
    },
    {
      _id: 'att-3',
      studentId: 7,
      courseId: 'IT102',
      regId: 'CNTT02-01',
      courseName: 'Cơ sở dữ liệu',
      date: '2026-10-02',
      shiftId: '2',
      status: 'Có mặt',
      score: 9,
      evaluation: 'Làm bài lab tốt',
      teacherName: 'Lê Văn Cơ Sở',
    },
  ];

  const mockEnrollments = [
    {
      _id: 'enr-1',
      classId: 'CNTT01-01',
      class: {
        _id: 'cls-1',
        id: 'CNTT01-01',
        courseId: 'IT101',
        courseName: 'Lập trình Web',
        credits: 3,
        teacher: 'Trần Văn Giáo Viên',
        gradeWeights: { attendance: 10, homework: 10, midterm: 30, final: 50 },
      },
      manualGrades: {
        attendance: 9.0,
        assignment: 8.5,
        midterm: 8.0,
        final: 8.5,
      },
      finalScore: 8.35,
    },
    {
      _id: 'enr-2',
      classId: 'CNTT02-01',
      class: {
        _id: 'cls-2',
        id: 'CNTT02-01',
        courseId: 'IT102',
        courseName: 'Cơ sở dữ liệu',
        credits: 3,
        teacher: 'Lê Văn Cơ Sở',
        gradeWeights: { attendance: 10, homework: 10, midterm: 30, final: 50 },
      },
      manualGrades: {
        attendance: 10.0,
        assignment: 9.0,
        midterm: 7.5,
        final: null,
      },
      finalScore: null,
    },
  ];

  const mockAssignments = [
    {
      _id: 'asg-1',
      courseId: 'IT101',
      type: 'quiz',
      title: 'Quiz 1 HTML & CSS',
      mySubmission: { score: 9.0 },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    attendanceApi.getByStudent.mockResolvedValue(mockAttendances);
    enrollmentsApi.mine.mockResolvedValue({ data: mockEnrollments });
    assignmentsApi.list.mockResolvedValue(mockAssignments);
  });

  it('renders student profile info and SVG Circular Progress Ring', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('83%')).toBeInTheDocument();
    });

    expect(screen.getByText(/SV-007/i)).toBeInTheDocument();
    expect(screen.getByText(/Nguyễn Văn Sinh Viên/i)).toBeInTheDocument();

    // Check circular progress ring presence
    expect(screen.getByText(/Tiến độ/i)).toBeInTheDocument();
    expect(screen.getByText(/Chuyên cần tốt/i)).toBeInTheDocument();

    // Check attendance cards
    expect(screen.getByText('Tổng buổi')).toBeInTheDocument();
    expect(screen.getAllByText('Có mặt').length).toBeGreaterThan(0);
  });

  it('filters attendance list and recalculates stats when selecting a course class', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getAllByText(/Lập trình Web/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Cơ sở dữ liệu/i).length).toBeGreaterThan(0);
    });

    const select = screen.getByLabelText(/Lớp học phần|Lọc theo môn/i);
    expect(select).toBeInTheDocument();

    // Select CNTT02-01 (Lớp học phần Cơ sở dữ liệu)
    fireEvent.change(select, { target: { value: 'CNTT02-01' } });

    // Table should show CNTT02-01 record
    expect(screen.getAllByText(/Lê Văn Cơ Sở/i).length).toBeGreaterThan(0);
    expect(screen.queryByText('Rất chủ động phát biểu')).not.toBeInTheDocument();

    // Recalculates stats for CNTT02-01: 1 session, present = 1 (rate = 100%)
    expect(screen.getAllByText('100%').length).toBeGreaterThan(0);
  });

  it('sanitizes raw MongoDB ObjectIds and formats ca học and dates cleanly', async () => {
    // Mock attendance record with raw 24-hex MongoDB ID
    attendanceApi.getByStudent.mockResolvedValueOnce([
      {
        _id: '6abaddab1234567890123456',
        studentId: 7,
        regId: '6abaddab1234567890123456', // raw ObjectId as regId
        courseId: 'IT101',
        courseName: 'Lập trình Web',
        date: '2026-10-01',
        shiftId: 'SI', // legacy or Roman shift
        shiftLabel: 'Ca SI',
        status: 'Có mặt',
        checkInTime: '07:05',
        note: 'Đi học đúng giờ',
      },
    ]);

    renderComponent();

    await waitFor(() => {
      expect(screen.getAllByText(/Lập trình Web/i).length).toBeGreaterThan(0);
    });

    // Should NOT expose raw 24-hex MongoDB ObjectId in the UI
    expect(screen.queryByText(/6abaddab1234567890123456/)).not.toBeInTheDocument();

    // Expand the card to view detailed sessions
    const expandBtn = screen.getByRole('button', { name: /Xem chi tiết/i });
    fireEvent.click(expandBtn);

    // Ca học should be normalized from "Ca SI" to "Ca 1 (07:00 - 09:15)"
    expect(screen.getByText(/Ca 1 \(07:00 - 09:15\)/i)).toBeInTheDocument();

    // Date should be formatted cleanly (01/10/2026)
    expect(screen.getByText(/01\/10\/2026/)).toBeInTheDocument();

    // Check-in time should be rendered
    expect(screen.getByText(/Giờ vào: 07:05/i)).toBeInTheDocument();
  });

  it('renders card-based accordion view grouped by course and supports expand/collapse', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getAllByText(/Lập trình Web/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Cơ sở dữ liệu/i).length).toBeGreaterThan(0);
    });

    // Check course cards summary header information
    expect(screen.getByText(/2 môn học/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Trần Văn Giáo Viên/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Lê Văn Cơ Sở/i).length).toBeGreaterThan(0);

    // By default, detailed sessions inside the accordion are collapsed
    expect(screen.queryByText('Rất chủ động phát biểu')).not.toBeInTheDocument();
    expect(screen.queryByText('Làm bài lab tốt')).not.toBeInTheDocument();

    // Click "Xem chi tiết" on the first course card (Lập trình Web)
    const detailButtons = screen.getAllByRole('button', { name: /Xem chi tiết/i });
    fireEvent.click(detailButtons[0]);

    // Now Lập trình Web sessions are revealed
    expect(screen.getByText(/Rất chủ động phát biểu/i)).toBeInTheDocument();
    expect(screen.getByText(/Vào muộn 10 phút/i)).toBeInTheDocument();
    // Cơ sở dữ liệu is still collapsed
    expect(screen.queryByText(/Làm bài lab tốt/i)).not.toBeInTheDocument();

    // Test "Mở rộng tất cả" button
    const expandAllBtn = screen.getByRole('button', { name: /Mở rộng tất cả/i });
    fireEvent.click(expandAllBtn);

    // Both courses' details should now be visible
    expect(screen.getByText(/Rất chủ động phát biểu/i)).toBeInTheDocument();
    expect(screen.getByText(/Làm bài lab tốt/i)).toBeInTheDocument();

    // Test "Thu gọn tất cả" button
    const collapseAllBtn = screen.getByRole('button', { name: /Thu gọn tất cả/i });
    fireEvent.click(collapseAllBtn);

    // Both courses' details should now be collapsed again
    expect(screen.queryByText(/Rất chủ động phát biểu/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Làm bài lab tốt/i)).not.toBeInTheDocument();
  });

  it('switches to Personal Gradebook tab and displays read-only component scores and GPA', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Bảng điểm Cá nhân/i })).toBeInTheDocument();
    });

    const gradesTabBtn = screen.getByRole('button', { name: /Bảng điểm Cá nhân/i });
    fireEvent.click(gradesTabBtn);

    // Read-only indicator
    expect(screen.getByText(/Chế độ xem cá nhân \(Read-only\)/i)).toBeInTheDocument();

    // Cumulative GPA cards
    expect(screen.getByText(/GPA \(Thang 10\)/i)).toBeInTheDocument();
    expect(screen.getByText(/GPA \(Thang 4\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Xếp loại học lực/i)).toBeInTheDocument();

    // Class 1 grade: 8.35
    expect(screen.getByText('8.35')).toBeInTheDocument();
    expect(screen.getAllByText('Khá').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Đạt').length).toBeGreaterThan(0);
  });

  it('renders read-only attendance matrix and detailed table matching LMS design, strictly disabled from edits', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getAllByText(/Lập trình Web/i).length).toBeGreaterThan(0);
    });

    // Expand the first course card (Lập trình Web)
    const detailButtons = screen.getAllByRole('button', { name: /Xem chi tiết/i });
    fireEvent.click(detailButtons[0]);

    // Check Read-only badge and label
    expect(screen.getAllByText(/Chỉ xem \(Read-only\)/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Ma trận chuyên cần trực quan/i)).toBeInTheDocument();

    // Check optimized table headers (redundant status & standalone score columns removed to maximize evaluation space)
    expect(screen.getByRole('columnheader', { name: /^buổi$/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /thời gian & ca học/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /đánh giá & ghi chú của giảng viên/i })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /^trạng thái$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /^điểm số$/i })).not.toBeInTheDocument();

    // Verify session data rows are rendered
    expect(screen.getAllByText(/#1/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/#2/i).length).toBeGreaterThan(0);

    // Verify evaluation & teacher feedback
    expect(screen.getByText(/Rất chủ động phát biểu/i)).toBeInTheDocument();
    expect(screen.getByText(/Vào muộn 10 phút/i)).toBeInTheDocument();
    expect(screen.getAllByText(/\(GV: Trần Văn Giáo Viên\)/i).length).toBe(2);

    // Verify score badges
    expect(screen.getByText('10đ')).toBeInTheDocument();
    expect(screen.getByText('8đ')).toBeInTheDocument();

    // Verify footer disclaimer
    expect(screen.getByText(/Bảng chi tiết ghi chú & đánh giá từ Giảng viên · Dữ liệu chỉ xem \(Read-only\)/i)).toBeInTheDocument();

    // Verify that there are NO interactive buttons or selects inside the session matrix to change status
    // All attendance cells must be purely read-only indicators without change handlers
    const actionButtons = screen.queryByRole('button', { name: /Thay đổi trạng thái|Điểm danh ngay/i });
    expect(actionButtons).not.toBeInTheDocument();
  });

  it('hides sessions without notes in detailed table and displays empty state when no notes exist', async () => {
    // 3 sessions: 1 with note, 1 with score, 1 without note or score
    attendanceApi.getByStudent.mockResolvedValueOnce([
      {
        _id: 'att-x1',
        studentId: 7,
        regId: 'CNTT01-01',
        courseId: 'IT101',
        courseName: 'Lập trình Web',
        date: '2026-10-01',
        shiftId: '1',
        status: 'Có mặt',
        note: 'Học tốt, xung phong giải bài tập',
      },
      {
        _id: 'att-x2',
        studentId: 7,
        regId: 'CNTT01-01',
        courseId: 'IT101',
        courseName: 'Lập trình Web',
        date: '2026-10-08',
        shiftId: '1',
        status: 'Có mặt',
        // No note, no score
      },
      {
        _id: 'att-x3',
        studentId: 7,
        regId: 'CNTT01-01',
        courseId: 'IT101',
        courseName: 'Lập trình Web',
        date: '2026-10-15',
        shiftId: '1',
        status: 'Có mặt',
        score: 9.5,
      },
    ]);

    renderComponent();

    await waitFor(() => {
      expect(screen.getAllByText(/Lập trình Web/i).length).toBeGreaterThan(0);
    });

    const detailButtons = screen.getAllByRole('button', { name: /Xem chi tiết/i });
    fireEvent.click(detailButtons[0]);

    // Timeline matrix strip shows all 3 sessions (#1, #2, #3)
    expect(screen.getByText(/Ma trận chuyên cần trực quan \(3 buổi học\)/i)).toBeInTheDocument();
    expect(screen.getAllByText(/#1/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/#2/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/#3/i).length).toBeGreaterThan(0);

    // Detailed table should only show sessions with notes or score
    expect(screen.getByText(/Học tốt, xung phong giải bài tập/i)).toBeInTheDocument();
    expect(screen.getByText('9.5đ')).toBeInTheDocument();

    // Footer shows 2 out of 3 sessions
    expect(screen.getByText(/Hiển thị 2 \/ 3 buổi học có ghi chú/i)).toBeInTheDocument();
  });
});

