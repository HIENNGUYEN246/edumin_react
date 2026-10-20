import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { StudentCourseRegistration, MAX_CREDITS } from './StudentCourseRegistration.jsx';

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

let mockAuthLoading = false;
let mockIsOpenLoading = false;
let mockIsMineLoading = false;

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
    isLoading: mockAuthLoading,
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
const mockEnrollMutateAsync = vi.fn();
const mockCancelMutateAsync = vi.fn();

vi.mock('./useEnrollments.js', () => ({
  useOpenClasses: () => ({
    data: mockOpenClassesList ? { data: mockOpenClassesList } : undefined,
    isLoading: mockIsOpenLoading,
    isPending: mockIsOpenLoading,
  }),
  useMyEnrollments: () => ({
    data: mockMyEnrollmentsList ? { data: mockMyEnrollmentsList } : undefined,
    isLoading: mockIsMineLoading,
    isPending: mockIsMineLoading,
  }),
  useEnrollmentMutations: () => ({
    enroll: { mutateAsync: mockEnrollMutateAsync, isPending: false },
    cancel: { mutateAsync: mockCancelMutateAsync, isPending: false },
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
    mockAuthLoading = false;
    mockIsOpenLoading = false;
    mockIsMineLoading = false;
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
    // Chemistry course is visible
    expect(screen.getByText('Hóa Học Cơ Bản')).toBeInTheDocument();

    // English course is hidden/filtered out
    expect(screen.queryByText('ENG101-01')).not.toBeInTheDocument();
    expect(screen.queryByText('Tiếng Anh Thương Mại')).not.toBeInTheDocument();

    // Expand accordion to reveal chemistry class
    fireEvent.click(screen.getByText('Hóa Học Cơ Bản'));
    expect(screen.getByText('HOA101-01')).toBeInTheDocument();
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

    // Expand course accordion
    fireEvent.click(screen.getByText('Hóa Học Cơ Bản'));

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
    expect(screen.queryByRole('button', { name: /Hủy đăng ký/i })).not.toBeInTheDocument();
  });
});

describe('StudentCourseRegistration Exclusive Class Selection & Credit Limit Validation', () => {
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

  it('enforces Exclusive Class Selection: locks other classes in the same course when a class is already selected', () => {
    // 2 classes of the SAME course HOA101
    mockOpenClassesList = [
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
        _id: 'class-hoa-2',
        id: 'HOA101-02',
        courseId: 'HOA101',
        courseName: 'Hóa Học Cơ Bản',
        department: 'Khoa Hóa Học',
        credits: 3,
        fee: 1500000,
        status: 'Đang mở',
        enrolledCount: 8,
        capacity: 30,
        schedules: [{ dayId: '4', shiftId: 'C1' }],
        room: 'A102',
      },
    ];

    // Student has enrolled in HOA101-01
    mockMyEnrollmentsList = [
      {
        _id: 'enr-hoa-1',
        classId: 'HOA101-01',
        class: mockOpenClassesList[0],
      },
    ];

    renderWithClient();

    // Course header should show "Đã chọn lớp"
    expect(screen.getByText(/Đã chọn lớp/i)).toBeInTheDocument();

    // Expand course accordion
    fireEvent.click(screen.getAllByText('Hóa Học Cơ Bản')[0]);

    // HOA101-01 should show "Đã đăng ký"
    expect(screen.getAllByText(/Đã đăng ký/i).length).toBeGreaterThan(0);

    // HOA101-02 should show "Đã đăng ký lớp khác" and have NO clickable "Đăng ký" button
    expect(screen.getByText('HOA101-02')).toBeInTheDocument();
    expect(screen.getByText(/Đã đăng ký lớp khác/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Đăng ký$/i })).not.toBeInTheDocument();
  });

  it('validates MAX_CREDITS (25): rejects enrolling when exceeding maximum credit limit and shows error toast', async () => {
    // Student already has 24 credits enrolled
    mockMyEnrollmentsList = [
      {
        _id: 'enr-heavy',
        classId: 'HOA201-01',
        class: {
          _id: 'class-hoa-heavy',
          id: 'HOA201-01',
          courseId: 'HOA201',
          courseName: 'Hóa Chuyên Sâu',
          department: 'Khoa Hóa Học',
          credits: 24,
          fee: 5000000,
          status: 'Đang mở',
        },
      },
    ];

    // Available class has 3 credits (24 + 3 = 27 > 25!)
    mockOpenClassesList = [
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
    ];

    renderWithClient();

    // Expand course accordion
    fireEvent.click(screen.getByText('Hóa Học Cơ Bản'));

    // Click "Đăng ký"
    const enrollBtn = screen.getByRole('button', { name: /^Đăng ký$/i });
    fireEvent.click(enrollBtn);

    // Should trigger error toast about exceeding MAX_CREDITS
    expect(mockToast.error).toHaveBeenCalledWith(
      expect.stringMatching(/vượt quá giới hạn tối đa cho phép/i)
    );
    // Mutate should NOT be executed
    expect(mockEnrollMutateAsync).not.toHaveBeenCalled();
  });

  it('shows the conflicting enrolled class name returned by the enrollment API', async () => {
    const conflictMessage =
      'Học phần bị trùng lịch (Thứ 2, Tiết 1 - 3 ( 7:00 - 9:15 )) với lớp học phần đã đăng ký: IT101-01 (Lập trình căn bản - Lớp 01).';
    mockMyEnrollmentsList = [
      {
        _id: 'enr-existing',
        classId: 'IT101-01',
        class: {
          _id: 'class-it101-1',
          id: 'IT101-01',
          courseId: 'IT101',
          courseName: 'Lập trình',
          className: 'Lập trình căn bản - Lớp 01',
          department: 'Khoa Hóa Học',
          credits: 3,
          status: 'Đang mở',
        },
      },
    ];
    mockEnrollMutateAsync.mockRejectedValueOnce(new Error(conflictMessage));

    renderWithClient();
    fireEvent.click(screen.getByText('Hóa Học Cơ Bản'));
    fireEvent.click(screen.getByRole('button', { name: /^Đăng ký$/i }));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(conflictMessage, 5000);
    });
  });

  it('allows any credit count (no minimum credit restriction) when verifying registration plan', async () => {
    // Student only has 3 credits enrolled
    mockMyEnrollmentsList = [
      {
        _id: 'enr-hoa-1',
        classId: 'HOA101-01',
        class: {
          _id: 'class-hoa-1',
          id: 'HOA101-01',
          courseId: 'HOA101',
          courseName: 'Hóa Học Cơ Bản',
          credits: 3,
          fee: 1500000,
          status: 'Đang mở',
        },
      },
    ];
    mockOpenClassesList = [];

    renderWithClient();

    // Verify progress bar shows 3 / 25 TC and does NOT show minimum credit warning
    expect(screen.getByText(/3 \/ 25 TC/i)).toBeInTheDocument();
    expect(screen.queryByText(/Chưa đạt tối thiểu/i)).not.toBeInTheDocument();

    // Click "Kiểm tra hợp lệ kế hoạch đăng ký"
    const validateBtn = screen.getByRole('button', { name: /Kiểm tra hợp lệ kế hoạch đăng ký/i });
    fireEvent.click(validateBtn);

    // Should succeed because minimum credit restrictions have been removed
    expect(mockToast.success).toHaveBeenCalledWith(
      expect.stringMatching(/Kế hoạch đăng ký hợp lệ/i)
    );
  });

  it('confirms plan when credits are enrolled', async () => {
    // Student has 12 credits enrolled (valid!)
    mockMyEnrollmentsList = [
      {
        _id: 'enr-1',
        classId: 'HOA101-01',
        class: {
          _id: 'class-hoa-1',
          id: 'HOA101-01',
          courseId: 'HOA101',
          courseName: 'Hóa Học Cơ Bản',
          credits: 12,
          fee: 6000000,
          status: 'Đang mở',
        },
      },
    ];
    mockOpenClassesList = [];

    renderWithClient();

    // Check valid badge
    expect(screen.getByText(/12 TC đã đăng ký/i)).toBeInTheDocument();

    // Click "Kiểm tra hợp lệ kế hoạch đăng ký"
    const validateBtn = screen.getByRole('button', { name: /Kiểm tra hợp lệ kế hoạch đăng ký/i });
    fireEvent.click(validateBtn);

    expect(mockToast.success).toHaveBeenCalledWith(
      expect.stringMatching(/Kế hoạch đăng ký hợp lệ/i)
    );
  });

  it('supports searching and filtering courses in open classes list', () => {
    mockOpenClassesList = [
      {
        _id: 'class-hoa-1',
        id: 'HOA101-01',
        courseId: 'HOA101',
        courseName: 'Hóa Học Cơ Bản',
        department: 'Khoa Hóa Học',
        credits: 3,
        fee: 1500000,
        status: 'Đang mở',
        schedules: [{ dayId: '2', shiftId: 'S1' }],
      },
      {
        _id: 'class-hoa-2',
        id: 'HOA201-01',
        courseId: 'HOA201',
        courseName: 'Hóa Hữu Cơ',
        department: 'Khoa Hóa Học',
        credits: 4,
        fee: 2000000,
        status: 'Đang mở',
        schedules: [{ dayId: '4', shiftId: 'S2' }],
      },
    ];
    mockMyEnrollmentsList = [];

    renderWithClient();

    expect(screen.getByText('Hóa Học Cơ Bản')).toBeInTheDocument();
    expect(screen.getByText('Hóa Hữu Cơ')).toBeInTheDocument();

    // Type "Hữu Cơ" into search input
    const searchInput = screen.getByPlaceholderText(/Tìm mã môn, tên học phần/i);
    fireEvent.change(searchInput, { target: { value: 'Hữu Cơ' } });

    // "Hóa Hữu Cơ" should stay, "Hóa Học Cơ Bản" should be filtered out
    expect(screen.getByText('Hóa Hữu Cơ')).toBeInTheDocument();
    expect(screen.queryByText('Hóa Học Cơ Bản')).not.toBeInTheDocument();
  });
});

describe('StudentCourseRegistration Course Details Modal & General Education Filtering & Compact UI', () => {
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

  it('shows general education courses for students of all departments alongside major courses', () => {
    mockOpenClassesList = [
      {
        _id: 'class-hoa-1',
        id: 'HOA101-01',
        courseId: 'HOA101',
        courseName: 'Hóa Học Cơ Bản',
        department: 'Khoa Hóa Học',
        credits: 3,
        fee: 1500000,
        status: 'Đang mở',
        schedules: [{ dayId: '2', shiftId: 'S1' }],
      },
      {
        _id: 'class-gen-1',
        id: 'MLN101-01',
        courseId: 'MLN101',
        courseName: 'Triết Học Mác - Lênin',
        department: 'Khoa Khoa Học Cơ Bản',
        credits: 3,
        fee: 1200000,
        status: 'Đang mở',
        schedules: [{ dayId: '3', shiftId: 'S2' }],
      },
      {
        _id: 'class-it-1',
        id: 'IT101-01',
        courseId: 'IT101',
        courseName: 'Lập Trình Web Nâng Cao',
        department: 'Khoa Công Nghệ Thông Tin',
        credits: 3,
        fee: 1800000,
        status: 'Đang mở',
        schedules: [{ dayId: '5', shiftId: 'C1' }],
      },
    ];
    mockMyEnrollmentsList = [];

    renderWithClient();

    // Chemistry (student major) is visible
    expect(screen.getByText('Hóa Học Cơ Bản')).toBeInTheDocument();

    // Philosophy (General Education) is also visible to Chemistry student!
    expect(screen.getByText('Triết Học Mác - Lênin')).toBeInTheDocument();

    // IT (other specific major) is strictly hidden
    expect(screen.queryByText('Lập Trình Web Nâng Cao')).not.toBeInTheDocument();
  });

  it('opens course details modal when clicking course detail button and displays teaching hours breakdown', () => {
    mockOpenClassesList = [
      {
        _id: 'class-hoa-1',
        id: 'HOA101-01',
        courseId: 'HOA101',
        courseName: 'Hóa Học Cơ Bản',
        department: 'Khoa Hóa Học',
        credits: 3,
        fee: 1500000,
        status: 'Đang mở',
        schedules: [{ dayId: '2', shiftId: 'S1' }],
      },
    ];
    mockMyEnrollmentsList = [];

    renderWithClient();

    // Click "Xem chi tiết"
    const detailBtn = screen.getByRole('button', { name: /Xem chi tiết/i });
    fireEvent.click(detailBtn);

    // Modal title appears
    expect(screen.getByText(/Thông tin chi tiết học phần: Hóa Học Cơ Bản/i)).toBeInTheDocument();

    // Classification should be "Chuyên ngành"
    expect(screen.getAllByText('Chuyên ngành').length).toBeGreaterThan(0);

    // Total periods = 3 * 15 = 45 tiết
    expect(screen.getByText('45 tiết')).toBeInTheDocument();

    // Theory = Math.round(3 * 10) = 30 tiết
    expect(screen.getByText('30 tiết')).toBeInTheDocument();

    // Practice = 45 - 30 = 15 tiết
    expect(screen.getByText('15 tiết')).toBeInTheDocument();

    // Evaluation weights appear
    expect(screen.getByText(/Cơ cấu đánh giá kết quả học phần:/i)).toBeInTheDocument();
    expect(screen.getByText(/Thi kết thúc học phần:/i)).toBeInTheDocument();

    // Close modal
    const closeBtns = screen.getAllByRole('button', { name: /Đóng/i });
    fireEvent.click(closeBtns[0]);

    expect(screen.queryByText(/Thông tin chi tiết học phần: Hóa Học Cơ Bản/i)).not.toBeInTheDocument();
  });

  it('displays General Education classification in modal for general education courses', () => {
    mockOpenClassesList = [
      {
        _id: 'class-math-1',
        id: 'MAT101-01',
        courseId: 'MAT101',
        courseName: 'Toán Cao Cấp 1',
        department: 'Khoa Đại Cương',
        credits: 4,
        fee: 1600000,
        status: 'Đang mở',
        schedules: [{ dayId: '2', shiftId: 'S1' }],
      },
    ];
    mockMyEnrollmentsList = [];

    renderWithClient();

    // Click "Xem chi tiết"
    const detailBtn = screen.getByRole('button', { name: /Xem chi tiết/i });
    fireEvent.click(detailBtn);

    // Modal opens
    expect(screen.getByText(/Thông tin chi tiết học phần: Toán Cao Cấp 1/i)).toBeInTheDocument();

    // Classification should be "Đại cương chung"
    expect(screen.getAllByText('Đại cương chung').length).toBeGreaterThan(0);

    // Total periods = 4 * 15 = 60 tiết
    expect(screen.getByText('60 tiết')).toBeInTheDocument();

    // Theory = Math.round(4 * 10) = 40 tiết
    expect(screen.getByText('40 tiết')).toBeInTheDocument();

    // Practice = 60 - 40 = 20 tiết
    expect(screen.getByText('20 tiết')).toBeInTheDocument();
  });

  it('renders compact sticky status bar with real-time credits, tuition fees, and course count', () => {
    mockMyEnrollmentsList = [
      {
        _id: 'enr-1',
        classId: 'HOA101-01',
        class: {
          _id: 'class-hoa-1',
          id: 'HOA101-01',
          courseId: 'HOA101',
          courseName: 'Hóa Học Cơ Bản',
          credits: 3,
          fee: 1500000,
          status: 'Đang mở',
        },
      },
      {
        _id: 'enr-2',
        classId: 'HOA201-01',
        class: {
          _id: 'class-hoa-2',
          id: 'HOA201-01',
          courseId: 'HOA201',
          courseName: 'Hóa Hữu Cơ',
          credits: 4,
          fee: 2000000,
          status: 'Đang mở',
        },
      },
    ];
    mockOpenClassesList = [];

    renderWithClient();

    // Progress bar shows 7 / 25 TC
    expect(screen.getByText(/7 \/ 25 TC/i)).toBeInTheDocument();

    // Course count shows 2 môn học
    expect(screen.getByText(/2 môn học/i)).toBeInTheDocument();

    // Total tuition fee shows 3,500,000 đ
    expect(screen.getAllByText(/3\.500\.000/i).length).toBeGreaterThan(0);
  });

  it('renders Hủy đăng ký button for each row in registered courses table', async () => {
    mockMyEnrollmentsList = [
      {
        _id: 'enr-1',
        classId: 'HOA101-01',
        class: {
          _id: 'class-hoa-1',
          id: 'HOA101-01',
          courseId: 'HOA101',
          courseName: 'Hóa Học Cơ Bản',
          credits: 3,
          fee: 1500000,
          status: 'Đang mở',
        },
      },
    ];
    mockOpenClassesList = [];

    renderWithClient();

    // Header "Thao tác" is present
    expect(screen.getByText('Thao tác')).toBeInTheDocument();

    // "Hủy đăng ký" button is present and clickable
    const cancelBtn = screen.getByRole('button', { name: /Hủy đăng ký/i });
    expect(cancelBtn).toBeInTheDocument();
    fireEvent.click(cancelBtn);

    // Cancel mutation should be called asynchronously
    await vi.waitFor(() => {
      expect(mockCancelMutateAsync).toHaveBeenCalledWith('class-hoa-1');
    });
  });

  it('supports accordion toggle: classes are collapsed by default and expand upon clicking', () => {
    mockOpenClassesList = [
      {
        _id: 'class-hoa-1',
        id: 'HOA101-01',
        courseId: 'HOA101',
        courseName: 'Hóa Học Cơ Bản',
        department: 'Khoa Hóa Học',
        credits: 3,
        fee: 1500000,
        status: 'Đang mở',
        schedules: [{ dayId: '2', shiftId: 'S1' }],
      },
    ];
    mockMyEnrollmentsList = [];

    renderWithClient();

    // Course title is visible
    expect(screen.getByText('Hóa Học Cơ Bản')).toBeInTheDocument();

    // Class code HOA101-01 is NOT visible initially (collapsed by default)
    expect(screen.queryByText('HOA101-01')).not.toBeInTheDocument();

    // Click accordion button to expand
    const expandBtn = screen.getByRole('button', { name: /Xem lớp \(1\)/i });
    fireEvent.click(expandBtn);

    // Now HOA101-01 is visible!
    expect(screen.getByText('HOA101-01')).toBeInTheDocument();
    expect(screen.getByText('Thu gọn lớp')).toBeInTheDocument();

    // Click again to collapse
    fireEvent.click(screen.getByRole('button', { name: /Thu gọn lớp/i }));
    expect(screen.queryByText('HOA101-01')).not.toBeInTheDocument();
  });

  it('strictly filters out out-of-department courses from enrolled courses table (enrolledCourses) and allows cancelling them', async () => {
    // Student belongs to Khoa Hóa Học.
    // In DB, student has:
    // 1) HOA101-01 (Chemistry - student's department)
    // 2) CNTT101-01 (IT - DIFFERENT department!)
    // 3) MLN101-01 (Philosophy - General Education)
    mockMyEnrollmentsList = [
      {
        _id: 'enr-hoa',
        classId: 'HOA101-01',
        class: {
          _id: 'class-hoa-1',
          id: 'HOA101-01',
          courseId: 'HOA101',
          courseName: 'Hóa Học Cơ Bản',
          department: 'Khoa Hóa Học',
          credits: 3,
          fee: 1500000,
          status: 'Đang mở',
        },
      },
      {
        _id: 'enr-cntt',
        classId: 'CNTT101-01',
        class: {
          _id: 'class-cntt-1',
          id: 'CNTT101-01',
          courseId: 'CNTT101',
          courseName: 'Lập trình Web Cơ bản',
          department: 'Khoa Công Nghệ Thông Tin',
          credits: 4,
          fee: 2000000,
          status: 'Đang mở',
        },
      },
      {
        _id: 'enr-mln',
        classId: 'MLN101-01',
        class: {
          _id: 'class-mln-1',
          id: 'MLN101-01',
          courseId: 'MLN101',
          courseName: 'Triết Học Mác - Lênin',
          department: 'Khoa Khoa Học Cơ Bản',
          credits: 3,
          fee: 1200000,
          status: 'Đang mở',
        },
      },
    ];
    mockOpenClassesList = [];

    renderWithClient();

    // 1. Chemistry (own dept) and Philosophy (general edu) ARE shown
    expect(screen.getByText('HOA101-01')).toBeInTheDocument();
    expect(screen.getByText('MLN101-01')).toBeInTheDocument();

    // 2. IT course is STRICTLY HIDDEN from the enrolled courses table
    expect(screen.queryByText('CNTT101-01')).not.toBeInTheDocument();
    expect(screen.queryByText('Lập trình Web Cơ bản')).not.toBeInTheDocument();

    // 3. Registered count badge displays 2 lớp (not 3 lớp!)
    expect(screen.getByText('2 lớp')).toBeInTheDocument();

    // 4. Total credits computes 3 + 3 = 6 TC (excludes 4 TC of CNTT)
    expect(screen.getByText(/6 \/ 25 TC/i)).toBeInTheDocument();

    // 5. Out of department notification banner appears
    expect(screen.getByText(/Đã tự động loại bỏ 1 môn học lệch chuyên ngành khỏi danh sách/i)).toBeInTheDocument();

    // 6. Each row has a prominent "Hủy đăng ký" button
    const cancelBtns = screen.getAllByRole('button', { name: /Hủy đăng ký/i });
    expect(cancelBtns.length).toBe(2);

    // 7. Banner provides quick purge button for CNTT101-01
    const purgeBtn = screen.getByRole('button', { name: /Hủy CNTT101-01/i });
    expect(purgeBtn).toBeInTheDocument();
    fireEvent.click(purgeBtn);

    await vi.waitFor(() => {
      expect(mockCancelMutateAsync).toHaveBeenCalledWith('class-cntt-1');
    });
  });

  it('displays loading state and prevents premature empty state while data or context is loading', () => {
    mockIsOpenLoading = true;
    mockOpenClassesList = undefined;
    mockMyEnrollmentsList = undefined;

    renderWithClient();

    // 1. Heading displays loading indicator instead of 0
    expect(screen.getByText(/\(Đang tải\.\.\.\)/i)).toBeInTheDocument();

    // 2. Enrolled classes table displays loading text
    expect(screen.getByText(/Đang tải danh sách học phần đã đăng ký/i)).toBeInTheDocument();

    // 3. Premature empty warning is NOT shown
    expect(screen.queryByText(/Hiện không có lớp nào đang mở đăng ký/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Hiện không có lớp học phần nào đang mở đăng ký cho/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Chưa đăng ký học phần nào/i)).not.toBeInTheDocument();
  });

  it('locks the register button and displays a warning banner when course prerequisites are not met', async () => {
    mockIsOpenLoading = false;
    mockIsMineLoading = false;

    // Course HOA201 requires prerequisite HOA100
    mockOpenClassesList = [
      {
        _id: 'class-hoa-advanced',
        id: 'HOA201-01',
        courseId: 'HOA201',
        courseName: 'Hóa Học Vô Cơ Nâng Cao',
        department: 'Khoa Hóa Học',
        credits: 3,
        fee: 1500000,
        status: 'Đang mở',
        enrolledCount: 2,
        capacity: 30,
        prerequisites: 'HOA100',
        courseRef: {
          prerequisites: 'HOA100',
        },
        schedules: [{ dayId: '2', shiftId: 'S1' }],
        room: 'Lab-A101',
      },
    ];

    // Student has not taken or passed HOA100
    mockMyEnrollmentsList = [];

    renderWithClient();

    // 1. Warning label is shown on course header
    expect(
      screen.getByText(/Yêu cầu hoàn thành môn tiên quyết: HOA100 trước khi đăng ký/i)
    ).toBeInTheDocument();

    // 2. Open accordion to view class
    const viewClassBtn = screen.getByRole('button', { name: /Xem lớp \(1\)/i });
    fireEvent.click(viewClassBtn);

    // 3. Button inside ClassRow is disabled with "Chưa đạt tiên quyết"
    const prereqLockedBtn = screen.getByRole('button', { name: /Chưa đạt tiên quyết/i });
    expect(prereqLockedBtn).toBeInTheDocument();
    expect(prereqLockedBtn).toBeDisabled();

    // 4. Normal active "Đăng ký" button is NOT clickable
    expect(screen.queryByRole('button', { name: /^Đăng ký$/i })).not.toBeInTheDocument();
  });

  it('allows registration when the student has successfully passed the prerequisite course (score >= 4.0)', async () => {
    mockIsOpenLoading = false;
    mockIsMineLoading = false;

    // Course HOA201 requires prerequisite HOA100
    mockOpenClassesList = [
      {
        _id: 'class-hoa-advanced',
        id: 'HOA201-01',
        courseId: 'HOA201',
        courseName: 'Hóa Học Vô Cơ Nâng Cao',
        department: 'Khoa Hóa Học',
        credits: 3,
        fee: 1500000,
        status: 'Đang mở',
        enrolledCount: 2,
        capacity: 30,
        prerequisites: 'HOA100',
        schedules: [{ dayId: '2', shiftId: 'S1' }],
        room: 'Lab-A101',
      },
    ];

    // Student has completed HOA100 with finalScore 8.0 (passed)
    mockMyEnrollmentsList = [
      {
        _id: 'enr-hoa-100',
        classId: 'HOA100-01',
        finalScore: 8.0,
        class: {
          _id: 'class-hoa-100',
          id: 'HOA100-01',
          courseId: 'HOA100',
          courseName: 'Hóa Đại Cương',
          department: 'Khoa Hóa Học',
          credits: 3,
        },
      },
    ];

    renderWithClient();

    // 1. Prerequisite warning is NOT shown
    expect(
      screen.queryByText(/Yêu cầu hoàn thành môn tiên quyết: HOA100 trước khi đăng ký/i)
    ).not.toBeInTheDocument();

    // 2. Open accordion
    const viewClassBtn = screen.getByRole('button', { name: /Xem lớp \(1\)/i });
    fireEvent.click(viewClassBtn);

    // 3. Normal active "Đăng ký" button is present and enabled
    const enrollBtn = screen.getByRole('button', { name: /^Đăng ký$/i });
    expect(enrollBtn).toBeInTheDocument();
    expect(enrollBtn).not.toBeDisabled();

    fireEvent.click(enrollBtn);
    expect(mockEnrollMutateAsync).toHaveBeenCalledWith('class-hoa-advanced');
  });
});
