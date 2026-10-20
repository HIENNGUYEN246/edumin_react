import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { StudentDashboard } from './StudentDashboard.jsx';

const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
};

vi.mock('../../app/providers/ToastProvider.jsx', () => ({
  useToast: () => mockToast,
}));

let mockUser = {
  _id: 'u-sv1',
  role: 'sinh-vien',
  hoTen: 'Nguyễn Văn An',
  email: 'an.nguyen@student.edu.vn',
  studentId: 1001,
};

let mockProfile = {
  id: 1001,
  hoTen: 'Nguyễn Văn An',
  className: 'CNTT-K15A',
  department: 'Công nghệ thông tin',
  education: 'Chính quy',
};

vi.mock('../../app/providers/AuthProvider.jsx', () => ({
  useAuth: () => ({
    user: mockUser,
    profile: mockProfile,
  }),
}));

vi.mock('./useEnrollments.js', () => ({
  useMyEnrollments: vi.fn(),
}));

vi.mock('../../api/feedbackApi.js', () => ({
  feedbackApi: {
    list: vi.fn(),
    submit: vi.fn(),
  },
}));

vi.mock('../../api/profileRequestsApi.js', () => ({
  profileRequestsApi: {
    myLatest: vi.fn().mockResolvedValue(null),
  },
}));

import { useMyEnrollments } from './useEnrollments.js';
import { feedbackApi } from '../../api/feedbackApi.js';

describe('StudentDashboard - Crash Resilience and Null-Safety', () => {
  let queryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    feedbackApi.list.mockResolvedValue([]);
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <StudentDashboard />
        </MemoryRouter>
      </QueryClientProvider>
    );

  it('renders safely when enrollData is null/undefined without crashing or white screening', async () => {
    useMyEnrollments.mockReturnValue({
      data: null,
      isLoading: false,
    });

    renderComponent();

    expect(await screen.findByText('Tổng quan')).toBeInTheDocument();
    expect(screen.getByText('Bảng điểm Cá nhân & Điểm tổng kết học phần')).toBeInTheDocument();
    expect(screen.getByText('Bạn chưa đăng ký môn học nào trong học kỳ này')).toBeInTheDocument();
  });

  it('renders safely when user and profile have missing properties or nulls', async () => {
    mockUser = { _id: 'u-partial', role: 'student' };
    mockProfile = null;

    useMyEnrollments.mockReturnValue({
      data: { data: [] },
      isLoading: false,
    });

    renderComponent();

    expect(await screen.findByText('Tổng quan')).toBeInTheDocument();
    expect(screen.getByText('Chưa phân lớp')).toBeInTheDocument();
  });

  it('renders gradebook rows with partial, missing, or malformed manual grades', async () => {
    mockUser = {
      _id: 'u-sv1',
      role: 'sinh-vien',
      hoTen: 'Nguyễn Văn An',
      studentId: 1001,
    };
    mockProfile = {
      id: 1001,
      hoTen: 'Nguyễn Văn An',
      className: 'CNTT-K15A',
    };

    useMyEnrollments.mockReturnValue({
      data: {
        data: [
          {
            _id: 'enr1',
            classId: 'CS101-01',
            class: {
              id: 'CS101-01',
              courseId: 'CS101',
              courseName: 'Nhập môn Lập trình',
              credits: 3,
              teacher: { hoTen: 'TS. Phạm Minh Tuấn' },
            },
            manualGrades: {
              attendance: 10,
              // Other grades missing
            },
            finalScore: null,
          },
          {
            _id: 'enr2',
            classId: 'MA101-01',
            class: null, // Class ref missing/deleted
            manualGrades: null,
            finalScore: '8.5',
          },
        ],
      },
      isLoading: false,
    });

    renderComponent();

    expect(await screen.findByText('Nhập môn Lập trình')).toBeInTheDocument();
    expect(screen.getByText('TS. Phạm Minh Tuấn')).toBeInTheDocument();
    expect(screen.getByText('CS101-01')).toBeInTheDocument();
  });

  it('renders feedback section safely with feedbacks containing replies or pending states', async () => {
    useMyEnrollments.mockReturnValue({
      data: { data: [] },
      isLoading: false,
    });

    feedbackApi.list.mockResolvedValue([
      {
        _id: 'fb1',
        courseName: 'Cơ sở dữ liệu',
        regId: 'CS201-01',
        teacherName: 'ThS. Lê Hoàng',
        rating: 5,
        feedbackText: 'Thầy dạy rất nhiệt tình và dễ hiểu!',
        response: 'Cảm ơn em nhiều nhé, cố gắng phát huy!',
        respondedByName: 'ThS. Lê Hoàng',
        respondedAt: '12/10/2026',
      },
    ]);

    renderComponent();

    expect(await screen.findByText(/Ý kiến đóng góp & Phản hồi/i)).toBeInTheDocument();
    // History button appears when feedbacks exist
    const historyBtn = await screen.findByText(/Lịch sử góp ý/i);
    expect(historyBtn).toBeInTheDocument();
  });
});

