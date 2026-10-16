import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StudentDashboard } from './StudentDashboard.jsx';

const mockEnrollments = [
  {
    _id: 'enr-1',
    classId: 'CNTT01-01',
    class: {
      id: 'CNTT01-01',
      courseId: 'IT101',
      courseName: 'Lập trình Web',
      credits: 3,
      teacher: 'Trần Văn Giáo Viên',
      gradeWeights: { attendance: 10, homework: 10, midterm: 30, final: 50 },
    },
    manualGrades: {
      attendance: 10,
      assignment: 9,
      midterm: 8,
      final: 8.5,
    },
    finalScore: 8.55,
  },
  {
    _id: 'enr-2',
    classId: 'CNTT02-01',
    class: {
      id: 'CNTT02-01',
      courseId: 'IT102',
      courseName: 'Cơ sở dữ liệu',
      credits: 3,
      teacher: 'Lê Văn Cơ Sở',
      gradeWeights: { attendance: 10, homework: 10, midterm: 30, final: 50 },
    },
    manualGrades: {
      attendance: 9,
      assignment: 8,
      midterm: 7,
      final: null,
    },
    finalScore: null,
  },
];

vi.mock('../../app/providers/AuthProvider.jsx', () => ({
  useAuth: () => ({
    user: { id: 'u-sv1', role: 'student', studentId: 7, hoTen: 'Nguyễn Văn Sinh Viên' },
    profile: { id: 7, hoTen: 'Nguyễn Văn Sinh Viên', className: 'CNTT-K15A', department: 'Khoa CNTT' },
  }),
}));

vi.mock('../../app/providers/ToastProvider.jsx', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('./useEnrollments.js', () => ({
  useMyEnrollments: () => ({
    data: { data: mockEnrollments },
  }),
}));

vi.mock('../../api/feedbackApi.js', () => ({
  feedbackApi: {
    list: vi.fn().mockResolvedValue([]),
    submit: vi.fn().mockResolvedValue({ success: true }),
  },
}));

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <StudentDashboard />
    </QueryClientProvider>
  );
}

describe('StudentDashboard - Personal Gradebook Widget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Personal Gradebook widget on Student Dashboard with course grades and GPA', async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Bảng điểm Cá nhân & Điểm tổng kết học phần')).toBeInTheDocument();
    });

    // Check course names
    expect(screen.getByText('Lập trình Web')).toBeInTheDocument();
    expect(screen.getByText('Cơ sở dữ liệu')).toBeInTheDocument();

    // Check teacher names
    expect(screen.getByText('Trần Văn Giáo Viên')).toBeInTheDocument();
    expect(screen.getByText('Lê Văn Cơ Sở')).toBeInTheDocument();

    // Check component grades for Lập trình Web
    expect(screen.getByText('8.55')).toBeInTheDocument(); // final GPA
    expect(screen.getByText(/Chi tiết điểm danh & sổ điểm/i)).toBeInTheDocument();

    // Check summary pills in widget header
    expect(screen.getByText(/GPA Thang 10:/)).toBeInTheDocument();
    expect(screen.getByText(/GPA Thang 4:/)).toBeInTheDocument();
    expect(screen.getByText(/Xếp loại:/)).toBeInTheDocument();
  });
});

