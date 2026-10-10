import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ManageGradebook } from './ManageGradebook.jsx';

const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
};

vi.mock('../../../app/providers/ToastProvider.jsx', () => ({
  useToast: () => mockToast,
}));

vi.mock('../../../api/departmentsApi.js', () => ({
  departmentsApi: {
    list: vi.fn().mockResolvedValue({
      data: [
        { _id: 'd-1', maKhoa: 'CNTT', name: 'Công Nghệ Thông Tin' },
        { _id: 'd-2', maKhoa: 'DTVT', name: 'Điện Tử Viễn Thông' },
      ],
    }),
  },
}));

vi.mock('../../../api/classesApi.js', () => ({
  classesApi: {
    adminGradebookOverview: vi.fn(),
    students: vi.fn(),
    toggleGradeLock: vi.fn(),
    lockAllGrades: vi.fn(),
    updateStudentGrades: vi.fn(),
    auditLogs: vi.fn(),
    allAuditLogs: vi.fn(),
  },
}));

import { classesApi } from '../../../api/classesApi.js';

function renderWithClient(ui) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('ManageGradebook (Admin Gradebook Management)', () => {
  const mockOverview = {
    totalClasses: 2,
    lockedCount: 1,
    openCount: 1,
    classes: [
      {
        _id: 'c-1',
        id: 'CNTT01-01',
        courseName: 'Lập trình Web',
        courseId: 'IT101',
        department: 'Công Nghệ Thông Tin',
        teacher: 'Trần Văn Giáo Viên',
        credits: 3,
        totalStudents: 35,
        gradedStudents: 35,
        completionRate: 100,
        avgGpa: 7.8,
        isGradeLocked: true,
        gradeLockedAt: '2026-10-10T08:00:00Z',
      },
      {
        _id: 'c-2',
        id: 'CNTT02-01',
        courseName: 'Cơ sở dữ liệu',
        courseId: 'IT102',
        department: 'Công Nghệ Thông Tin',
        teacher: 'Lê Văn Cơ Sở',
        credits: 3,
        totalStudents: 40,
        gradedStudents: 20,
        completionRate: 50,
        avgGpa: 6.5,
        isGradeLocked: false,
        gradeLockedAt: null,
      },
    ],
  };

  const mockClassDetail = {
    class: {
      _id: 'c-1',
      id: 'CNTT01-01',
      courseName: 'Lập trình Web',
      courseCode: 'IT101',
      isGradeLocked: true,
      gradeLockedAt: '2026-10-10T08:00:00Z',
      gradeLockedBy: { hoTen: 'Admin PDT' },
      teacher: { hoTen: 'Trần Văn Giáo Viên' },
      gradeWeights: { attendance: 10, homework: 10, midterm: 30, presentation: 0, final: 50 },
    },
    students: [
      {
        _id: 's-1',
        id: 2021001,
        hoTen: 'Nguyễn Văn An',
        manualGrades: { attendance: 9, assignment: 8, midterm: 7.5, presentation: 0, final: 8.5 },
        effectiveGrades: { attendance: 9, homework: 8, midterm: 7.5, final: 8.5 },
        attendanceStats: { autoScore: 9 },
        finalScore: 8.2,
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    classesApi.adminGradebookOverview.mockResolvedValue(mockOverview);
    classesApi.students.mockResolvedValue(mockClassDetail);
    classesApi.toggleGradeLock.mockResolvedValue({ message: 'Đã mở khóa bảng điểm thành công' });
    classesApi.updateStudentGrades.mockResolvedValue({ success: true });
    classesApi.allAuditLogs.mockResolvedValue([]);
  });

  it('renders overview header and statistics summary cards', async () => {
    renderWithClient(<ManageGradebook />);

    expect(screen.getByText(/Quản lý Bảng điểm Toàn trường/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('CNTT01-01')).toBeInTheDocument();
      expect(screen.getByText('CNTT02-01')).toBeInTheDocument();
    });

    expect(screen.getByText('Lập trình Web')).toBeInTheDocument();
    expect(screen.getByText('Cơ sở dữ liệu')).toBeInTheDocument();
    expect(screen.getByText('Đã chốt sổ')).toBeInTheDocument();
    expect(screen.getByText('Đang mở nhập')).toBeInTheDocument();
  });

  it('filters classes by search term', async () => {
    renderWithClient(<ManageGradebook />);

    await waitFor(() => {
      expect(screen.getByText('CNTT01-01')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Tìm mã lớp, môn học, giảng viên.../i);
    fireEvent.change(searchInput, { target: { value: 'Web' } });

    await waitFor(() => {
      expect(classesApi.adminGradebookOverview).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'Web' })
      );
    });
  });

  it('switches to class detail gradebook view when clicking "Xem Bảng điểm"', async () => {
    renderWithClient(<ManageGradebook />);

    await waitFor(() => {
      expect(screen.getByText('CNTT01-01')).toBeInTheDocument();
    });

    const viewDetailBtns = screen.getAllByRole('button', { name: /Xem Bảng điểm/i });
    fireEvent.click(viewDetailBtns[0]);

    await waitFor(() => {
      expect(classesApi.students).toHaveBeenCalledWith('c-1');
      expect(screen.getByText('Nguyễn Văn An')).toBeInTheDocument();
      expect(screen.getByTitle('Quay lại danh sách lớp')).toBeInTheDocument();
    });
  });

  it('allows Admin to toggle grade lock on a class', async () => {
    renderWithClient(<ManageGradebook />);

    await waitFor(() => {
      expect(screen.getByText('CNTT01-01')).toBeInTheDocument();
    });

    // Class c-1 is locked; clicking unlock button calls toggleGradeLock with lock: false
    const unlockBtn = screen.getByRole('button', { name: /Mở khóa/i });
    fireEvent.click(unlockBtn);

    await waitFor(() => {
      expect(classesApi.toggleGradeLock).toHaveBeenCalledWith('c-1', { lock: false });
      expect(mockToast.success).toHaveBeenCalledWith('Đã mở khóa bảng điểm thành công');
    });
  });

  it('opens Grade Override modal and records Audit Log reason', async () => {
    renderWithClient(<ManageGradebook />);

    await waitFor(() => {
      expect(screen.getByText('CNTT01-01')).toBeInTheDocument();
    });

    // Enter detail view
    fireEvent.click(screen.getAllByRole('button', { name: /Xem Bảng điểm/i })[0]);

    await waitFor(() => {
      expect(screen.getByText('Nguyễn Văn An')).toBeInTheDocument();
    });

    // Click "Sửa điểm" button for student
    const editGradeBtn = screen.getByRole('button', { name: /Sửa điểm/i });
    fireEvent.click(editGradeBtn);

    expect(screen.getByText(/Can thiệp Điểm số/i)).toBeInTheDocument();

    // Fill new score and audit reason
    const scoreInput = screen.getByPlaceholderText(/Nhập 0 - 10/i);
    fireEvent.change(scoreInput, { target: { value: '9.5' } });

    const reasonInput = screen.getByPlaceholderText(/Ví dụ: Phúc khảo bài thi cuối kỳ/i);
    fireEvent.change(reasonInput, { target: { value: 'Phúc khảo bài thi cuối kỳ theo đơn số 12/PK' } });

    // Submit grade override
    const saveBtn = screen.getByRole('button', { name: /Lưu Điểm & Ghi Audit Log/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(classesApi.updateStudentGrades).toHaveBeenCalledWith(
        'c-1',
        's-1',
        expect.objectContaining({ final: 9.5 }),
        'Phúc khảo bài thi cuối kỳ theo đơn số 12/PK'
      );
      expect(mockToast.success).toHaveBeenCalled();
    });
  });
});
