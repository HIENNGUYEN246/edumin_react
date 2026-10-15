import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { TeacherAttendance } from './TeacherAttendance.jsx';

const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
};

vi.mock('../../../app/providers/ToastProvider.jsx', () => ({
  useToast: () => mockToast,
}));

const mockAuthUser = {
  _id: 'u-gv1',
  role: 'teacher',
  hoTen: 'ThS. Trần Đình',
};

const mockProfile = {
  id: 101,
  hoTen: 'ThS. Trần Đình',
  email: 'trandinh@edu.vn',
};

vi.mock('../../../app/providers/AuthProvider.jsx', () => ({
  useAuth: () => ({
    user: mockAuthUser,
    profile: mockProfile,
  }),
}));

vi.mock('../useTeacherClasses.js', () => ({
  useMyTeacherClasses: vi.fn(),
  useClassStudents: vi.fn(),
}));

vi.mock('../../../api/attendanceApi.js', () => ({
  attendanceApi: {
    getAll: vi.fn(),
    saveBulk: vi.fn(),
  },
}));

vi.mock('../../../lib/excel.js', () => ({
  exportSheet: vi.fn(),
}));

import { useMyTeacherClasses, useClassStudents } from '../useTeacherClasses.js';
import { attendanceApi } from '../../../api/attendanceApi.js';

describe('TeacherAttendance - LMS Matrix Attendance Grid', () => {
  let queryClient;

  const mockClasses = [
    {
      _id: 'c1',
      id: 'TA1-L01',
      className: 'Lớp Tiếng Anh 1',
      courseId: 'TA1',
      courseName: 'Tiếng Anh 1',
      room: 'B204',
      studyStart: '2026-09-01',
      studyEnd: '2026-10-15',
      schedules: [
        { dayId: '2', shiftId: '1' },
        { dayId: '4', shiftId: '1' },
      ],
    },
  ];

  const mockStudents = [
    {
      id: 1001,
      _id: 's1',
      hoTen: 'Trương Quang Mạnh',
      email: 'manh@student.edu.vn',
      className: 'CNTT-K15A',
      avatar: '',
    },
    {
      id: 1002,
      _id: 's2',
      hoTen: 'Sơn Đình Vũ',
      email: 'vu@student.edu.vn',
      className: 'CNTT-K15A',
      avatar: '',
    },
  ];

  const mockAttendanceRecords = [
    {
      studentId: 1001,
      regId: 'TA1-L01',
      date: '2026-09-01',
      shiftId: '1',
      status: 'Có mặt',
      score: null,
      note: '',
    },
    {
      studentId: 1002,
      regId: 'TA1-L01',
      date: '2026-09-01',
      shiftId: '1',
      status: 'Vắng mặt',
      score: null,
      note: 'Nghỉ không lý do',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    useMyTeacherClasses.mockReturnValue({
      data: { success: true, data: mockClasses },
      isLoading: false,
    });

    useClassStudents.mockReturnValue({
      data: { success: true, students: mockStudents },
      isLoading: false,
    });

    attendanceApi.getAll.mockResolvedValue(mockAttendanceRecords);
    attendanceApi.saveBulk.mockResolvedValue({ success: true });
  });

  const renderComponent = (initialEntries = ['/teacher/attendance']) =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries}>
          <TeacherAttendance />
        </MemoryRouter>
      </QueryClientProvider>
    );

  const renderWithRoute = (initialEntry = '/teacher/attendance/TA1-L01') =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route path="/teacher/attendance/:classId" element={<TeacherAttendance />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

  it('renders matrix grid layout with students along vertical axis and sessions along horizontal axis', async () => {
    renderComponent();

    // Verify student names are in rows
    expect(await screen.findByText('Trương Quang Mạnh')).toBeInTheDocument();
    expect(screen.getByText('Sơn Đình Vũ')).toBeInTheDocument();

    // Verify session columns
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText('01/09')).toBeInTheDocument();
  });

  it('renders attendance status icons at matrix intersection cells', async () => {
    renderComponent();

    await screen.findByText('Trương Quang Mạnh');

    // Matrix cells are rendered as buttons with title attributes
    const cellButtons = screen.getAllByRole('button');
    const presentCell = cellButtons.find((btn) =>
      btn.getAttribute('title')?.includes('Trạng thái: Có mặt')
    );
    expect(presentCell).toBeInTheDocument();

    const absentCell = cellButtons.find((btn) =>
      btn.getAttribute('title')?.includes('Trạng thái: Vắng không phép')
    );
    expect(absentCell).toBeInTheDocument();
  });

  it('allows clicking an intersection cell to open status picker and change attendance status', async () => {
    renderComponent();

    await screen.findByText('Trương Quang Mạnh');

    // Find cell for Sơn Đình Vũ on 01/09 (currently Vắng không phép)
    const cellButtons = screen.getAllByRole('button');
    const absentCell = cellButtons.find((btn) =>
      btn.getAttribute('title')?.includes('Sơn Đình Vũ') && btn.getAttribute('title')?.includes('01/09')
    );
    expect(absentCell).toBeInTheDocument();

    // Click cell to open quick popover
    fireEvent.click(absentCell);

    // Popover contains "Có mặt" button
    const markPresentBtn = await screen.findByRole('button', { name: /^Có mặt$/ });
    fireEvent.click(markPresentBtn);

    // Unsaved changes badge should now appear
    expect(screen.getByText(/1 thay đổi chưa lưu/i)).toBeInTheDocument();
  });

  it('saves all modified matrix changes when clicking Save button', async () => {
    renderComponent();

    await screen.findByText('Trương Quang Mạnh');

    // Click cell to open popover and change status
    const cellButtons = screen.getAllByRole('button');
    const targetCell = cellButtons.find((btn) =>
      btn.getAttribute('title')?.includes('Sơn Đình Vũ') && btn.getAttribute('title')?.includes('01/09')
    );
    fireEvent.click(targetCell);

    const markPresentBtn = await screen.findByRole('button', { name: /^Có mặt$/ });
    fireEvent.click(markPresentBtn);

    // Click "Lưu điểm danh" button at bottom
    const saveBtn = screen.getByRole('button', { name: /Lưu điểm danh/i });
    expect(saveBtn).not.toBeDisabled();
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(attendanceApi.saveBulk).toHaveBeenCalled();
    });
  });

  it('supports marking all students present for active session with one click', async () => {
    renderComponent();

    await screen.findByText('Trương Quang Mạnh');

    // Click "Cả lớp có mặt" button
    const markAllBtn = screen.getByRole('button', { name: /Cả lớp có mặt/i });
    fireEvent.click(markAllBtn);

    // All students marked present, changes counter should be > 0
    expect(screen.getByText(/thay đổi chưa lưu/i)).toBeInTheDocument();
  });

  it('renders class card with metadata and expands/collapses matrix grid on click', async () => {
    renderComponent();

    // Verify card header elements
    expect(await screen.findByText('Tiếng Anh 1')).toBeInTheDocument();
    expect(screen.getByText('TA1-L01')).toBeInTheDocument();

    // The collapse button exists
    const toggleBtn = screen.getByRole('button', { name: /Thu gọn ma trận/i });
    expect(toggleBtn).toBeInTheDocument();

    // Click collapse button
    fireEvent.click(toggleBtn);

    // After collapse, student names inside matrix should not be rendered
    expect(screen.queryByText('Trương Quang Mạnh')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mở ma trận điểm danh/i })).toBeInTheDocument();

    // Click to expand again
    fireEvent.click(screen.getByRole('button', { name: /Mở ma trận điểm danh/i }));
    expect(await screen.findByText('Trương Quang Mạnh')).toBeInTheDocument();
  });

  it('supports expanding all and collapsing all class cards via toolbar buttons', async () => {
    renderComponent();

    await screen.findByText('Trương Quang Mạnh');

    // Click "Thu gọn tất cả"
    const collapseAllBtn = screen.getByRole('button', { name: /Thu gọn tất cả/i });
    fireEvent.click(collapseAllBtn);

    expect(screen.queryByText('Trương Quang Mạnh')).not.toBeInTheDocument();

    // Click "Mở rộng tất cả"
    const expandAllBtn = screen.getByRole('button', { name: /Mở rộng tất cả/i });
    fireEvent.click(expandAllBtn);

    expect(await screen.findByText('Trương Quang Mạnh')).toBeInTheDocument();
  });

  it('loads and binds existing note, evaluation, score, and status into modal when opened', async () => {
    // Provide attendance record with existing score and evaluation/note
    attendanceApi.getAll.mockResolvedValueOnce([
      {
        studentId: 1001,
        regId: 'TA1-L01',
        date: '2026-09-01',
        shiftId: '1',
        status: 'Có mặt',
        score: 9.5,
        evaluation: 'Rất tích cực xây dựng bài',
      },
    ]);

    renderComponent();

    await screen.findByText('Trương Quang Mạnh');

    // Click the cell for Trương Quang Mạnh on 01/09
    const cellButtons = screen.getAllByRole('button');
    const targetCell = cellButtons.find((btn) =>
      btn.getAttribute('title')?.includes('Trương Quang Mạnh') && btn.getAttribute('title')?.includes('01/09')
    );
    expect(targetCell).toBeInTheDocument();
    fireEvent.click(targetCell);

    // Click "Ghi chú / Đánh giá" in popover
    const evalBtn = await screen.findByRole('button', { name: /Ghi chú \/ Đánh giá/i });
    fireEvent.click(evalBtn);

    // Modal should open with title
    expect(await screen.findByText(/Ghi chú & Đánh giá buổi học — Trương Quang Mạnh/i)).toBeInTheDocument();

    // Verify existing status is bound
    const statusSelect = screen.getByDisplayValue('Có mặt');
    expect(statusSelect).toBeInTheDocument();

    // Verify existing score is bound (9.5)
    const scoreInput = screen.getByDisplayValue('9.5');
    expect(scoreInput).toBeInTheDocument();

    // Verify existing note / evaluation is bound in textarea
    const noteTextarea = screen.getByDisplayValue('Rất tích cực xây dựng bài');
    expect(noteTextarea).toBeInTheDocument();

    // Verify updating note via quick tags or textarea works and saves
    fireEvent.change(noteTextarea, { target: { value: 'Rất tích cực xây dựng bài; Làm bài tốt' } });
    const applyBtn = screen.getByRole('button', { name: /Áp dụng/i });
    fireEvent.click(applyBtn);

    // Modal should close
    expect(screen.queryByText(/Ghi chú & Đánh giá buổi học — Trương Quang Mạnh/i)).not.toBeInTheDocument();
  });

  it('matches class code from query param (?classId=TA1-L01) and renders matrix without empty error', async () => {
    renderComponent(['/teacher/attendance?classId=TA1-L01']);

    expect(await screen.findByText('Tiếng Anh 1')).toBeInTheDocument();
    expect(screen.queryByText(/Không tìm thấy lớp học phần phù hợp/i)).not.toBeInTheDocument();
    expect(attendanceApi.getAll).toHaveBeenCalledWith(
      expect.objectContaining({ regId: 'TA1-L01', classId: 'TA1-L01' })
    );
  });

  it('matches class Mongo ObjectId from query param (?classId=c1) and sets dropdown correctly', async () => {
    renderComponent(['/teacher/attendance?classId=c1']);

    expect(await screen.findByText('Tiếng Anh 1')).toBeInTheDocument();
    expect(screen.queryByText(/Không tìm thấy lớp học phần phù hợp/i)).not.toBeInTheDocument();

    const classSelect = screen.getAllByRole('combobox')[0];
    expect(classSelect.value).toBe('TA1-L01');
  });

  it('supports path parameter :classId in route (/teacher/attendance/:classId)', async () => {
    renderWithRoute('/teacher/attendance/TA1-L01');

    expect(await screen.findByText('Tiếng Anh 1')).toBeInTheDocument();
    expect(screen.queryByText(/Không tìm thấy lớp học phần phù hợp/i)).not.toBeInTheDocument();
  });

  it('displays loading state gracefully without prematurely rendering "Không tìm thấy lớp học phần phù hợp"', () => {
    useMyTeacherClasses.mockReturnValue({
      data: null,
      isLoading: true,
      isPending: true,
    });

    renderComponent(['/teacher/attendance?classId=TA1-L01']);

    expect(screen.getByText(/Đang tải dữ liệu Điểm danh & Chuyên cần/i)).toBeInTheDocument();
    expect(screen.queryByText(/Không tìm thấy lớp học phần phù hợp/i)).not.toBeInTheDocument();
  });

  it('displays empty state with recovery button when non-existent class is requested, and clicking button resets filter', async () => {
    renderComponent(['/teacher/attendance?classId=NON_EXISTENT']);

    expect(await screen.findByText(/Không tìm thấy lớp học phần phù hợp/i)).toBeInTheDocument();

    const resetBtn = screen.getByRole('button', { name: /Xem tất cả lớp phụ trách/i });
    expect(resetBtn).toBeInTheDocument();

    fireEvent.click(resetBtn);

    expect(await screen.findByText('Tiếng Anh 1')).toBeInTheDocument();
    expect(screen.queryByText(/Không tìm thấy lớp học phần phù hợp/i)).not.toBeInTheDocument();
  });
});


