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
      expect(screen.getByText(/SV-007/i)).toBeInTheDocument();
      expect(screen.getByText(/Nguyễn Văn Sinh Viên/i)).toBeInTheDocument();
    });

    // Check circular progress ring presence
    expect(screen.getByText(/Tiến độ/i)).toBeInTheDocument();
    // 3 sessions: 2 present, 1 late (rate = round((2 + 0.5) / 3 * 100) = 83%)
    expect(screen.getByText('83%')).toBeInTheDocument();
    expect(screen.getByText(/Chuyên cần tốt/i)).toBeInTheDocument();

    // Check attendance cards
    expect(screen.getByText('Tổng buổi')).toBeInTheDocument();
    expect(screen.getAllByText('Có mặt').length).toBeGreaterThan(0);
  });

  it('filters attendance list and recalculates stats when selecting a course', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getAllByText(/Lập trình Web/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Cơ sở dữ liệu/i).length).toBeGreaterThan(0);
    });

    const select = screen.getByLabelText(/Lọc theo môn/i);
    expect(select).toBeInTheDocument();

    // Select IT102 (Cơ sở dữ liệu)
    fireEvent.change(select, { target: { value: 'IT102' } });

    // Table should show IT102 record
    expect(screen.getByText(/Lê Văn Cơ Sở/i)).toBeInTheDocument();
    expect(screen.queryByText('Rất chủ động phát biểu')).not.toBeInTheDocument();

    // Recalculates stats for IT102: 1 session, present = 1 (rate = 100%)
    expect(screen.getByText('100%')).toBeInTheDocument();
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
});
