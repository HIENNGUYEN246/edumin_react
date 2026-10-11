import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { StudentCourseRegistration } from './StudentCourseRegistration.jsx';

const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
};

vi.mock('../../app/providers/ToastProvider.jsx', () => ({
  useToast: () => mockToast,
}));

vi.mock('../../app/providers/ConfirmProvider.jsx', () => ({
  useConfirm: () => vi.fn().mockResolvedValue(true),
}));

let mockUser = {
  id: 'u-sv1',
  role: 'sinh-vien',
  khoa: 'Khoa Hóa Học',
  department: 'Khoa Hóa Học',
};

let mockProfile = {
  id: 201,
  hoTen: 'Nguyễn Hóa Học',
  department: 'Khoa Hóa Học',
};

vi.mock('../../app/providers/AuthProvider.jsx', () => ({
  useAuth: () => ({
    user: mockUser,
    profile: mockProfile,
  }),
}));

const mockOpenClasses = [
  {
    _id: 'class-hoa-1',
    id: 'HOA101-01',
    courseId: 'HOA101',
    courseName: 'Hóa Học Cơ Bản',
    department: 'Khoa Hóa Học',
    credits: 3,
    fee: 1500000,
    status: 'Đang mở',
    enrolledCount: 5,
    capacity: 30,
    schedules: [{ dayId: '2', shiftId: 'S1' }],
    room: 'A101',
  },
  {
    _id: 'class-nna-1',
    id: 'ENG101-01',
    courseId: 'ENG101',
    courseName: 'Tiếng Anh Thương Mại',
    department: 'Khoa Ngôn Ngữ Anh',
    credits: 3,
    fee: 1500000,
    status: 'Đang mở',
    enrolledCount: 10,
    capacity: 30,
    schedules: [{ dayId: '3', shiftId: 'S2' }],
    room: 'B202',
  },
];

vi.mock('./useEnrollments.js', () => ({
  useOpenClasses: () => ({
    data: { data: mockOpenClasses },
    isLoading: false,
  }),
  useMyEnrollments: () => ({
    data: { data: [] },
    isLoading: false,
  }),
  useEnrollmentMutations: () => ({
    enroll: { mutateAsync: vi.fn(), isPending: false },
    cancel: { mutateAsync: vi.fn(), isPending: false },
  }),
}));

function renderWithClient() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <StudentCourseRegistration />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('StudentCourseRegistration Department Filtering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = {
      id: 'u-sv1',
      role: 'sinh-vien',
      khoa: 'Khoa Hóa Học',
      department: 'Khoa Hóa Học',
    };
    mockProfile = {
      id: 201,
      hoTen: 'Nguyễn Hóa Học',
      department: 'Khoa Hóa Học',
    };
  });

  it('displays user department badge in header', () => {
    renderWithClient();
    const badges = screen.getAllByText(/Khoa: Khoa Hóa Học/i);
    expect(badges.length).toBeGreaterThan(0);
  });

  it('only displays classes belonging to user department and filters out other departments', () => {
    renderWithClient();
    // Chemistry class is visible
    expect(screen.getByText('HOA101-01')).toBeInTheDocument();
    expect(screen.getByText('Hóa Học Cơ Bản')).toBeInTheDocument();

    // English class is hidden/filtered out
    expect(screen.queryByText('ENG101-01')).not.toBeInTheDocument();
    expect(screen.queryByText('Tiếng Anh Thương Mại')).not.toBeInTheDocument();
  });

  it('shows appropriate empty message when no classes match student department', () => {
    mockUser = {
      id: 'u-sv3',
      role: 'sinh-vien',
      khoa: 'Khoa Xây Dựng',
      department: 'Khoa Xây Dựng',
    };
    mockProfile = {
      id: 301,
      department: 'Khoa Xây Dựng',
    };

    renderWithClient();
    expect(screen.getByText(/Hiện không có lớp học phần nào đang mở đăng ký cho Khoa Xây Dựng/i)).toBeInTheDocument();
  });
});
