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

let mockOpenClassesList = mockOpenClasses;
let mockMyEnrollmentsList = [];

vi.mock('./useEnrollments.js', () => ({
  useOpenClasses: () => ({
    data: { data: mockOpenClassesList },
    isLoading: false,
  }),
  useMyEnrollments: () => ({
    data: { data: mockMyEnrollmentsList },
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
    mockOpenClassesList = mockOpenClasses;
    mockMyEnrollmentsList = [];
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

describe('StudentCourseRegistration Auto Time-Lock & Read-only behavior', () => {
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

  it('locks registration button and shows expired status badge when registrationEnd has passed', () => {
    mockOpenClassesList = [
      {
        _id: 'class-hoa-expired',
        id: 'HOA101-99',
        courseId: 'HOA101',
        courseName: 'Hóa Học Cơ Bản',
        department: 'Khoa Hóa Học',
        credits: 3,
        fee: 1500000,
        status: 'Đang mở',
        registrationStart: '2026-01-01T08:00',
        registrationEnd: '2026-01-10T17:00', // In the past!
        enrolledCount: 5,
        capacity: 30,
        schedules: [{ dayId: '2', shiftId: 'S1' }],
        room: 'A101',
      },
    ];
    mockMyEnrollmentsList = [];

    renderWithClient();

    // The class is visible
    expect(screen.getByText('HOA101-99')).toBeInTheDocument();

    // Button should be locked
    const lockedBtn = screen.getByText(/Đã khóa \(hết hạn\)/i);
    expect(lockedBtn).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Đăng ký$/i })).not.toBeInTheDocument();

    // Status should be expired
    expect(screen.getByText(/Trạng thái: Đã hết hạn đăng ký/i)).toBeInTheDocument();
  });

  it('locks cancellation button into read-only mode when enrolled class registration has expired', () => {
    mockOpenClassesList = [];
    mockMyEnrollmentsList = [
      {
        _id: 'enr-1',
        classId: 'HOA101-01',
        class: {
          _id: 'class-hoa-1',
          id: 'HOA101-01',
          courseId: 'HOA101',
          courseName: 'Hóa Học Cơ Bản',
          status: 'Đang mở',
          registrationStart: '2026-01-01T08:00',
          registrationEnd: '2026-01-10T17:00', // In the past!
          fee: 1500000,
        },
      },
    ];

    renderWithClient();

    // Status column shows lock badge
    expect(screen.getByText(/Đã khóa \(hết hạn\)/i)).toBeInTheDocument();

    // Action column shows disabled "Đã khóa" badge instead of clickable Cancel button
    const lockedAction = screen.getByTitle(/Thời hạn đăng ký đã kết thúc — đã khóa tính năng hủy/i);
    expect(lockedAction).toBeInTheDocument();
    expect(lockedAction).toHaveTextContent(/Đã khóa/i);
    expect(screen.queryByRole('button', { name: /^Hủy$/i })).not.toBeInTheDocument();
  });
});
