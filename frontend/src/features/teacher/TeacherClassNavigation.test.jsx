import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { TeacherClassList } from './TeacherClassList.jsx';
import { TeacherClassStudents } from './TeacherClassStudents.jsx';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../api/classesApi.js', () => ({
  classesApi: {
    get: vi.fn().mockResolvedValue({
      id: 'IT101-01',
      className: 'Lớp 01',
      courseId: 'IT101',
      courseName: 'Lập trình Web',
    }),
  },
}));

vi.mock('./useTeacherClasses.js', () => ({
  useMyTeacherClasses: vi.fn().mockReturnValue({
    data: {
      data: [
        {
          _id: 'cls-123',
          id: 'IT101-01',
          className: 'Lớp 01',
          courseId: 'IT101',
          courseName: 'Lập trình Web',
          schedules: [{ dayId: '2', shiftId: '1' }],
          room: 'A101',
        },
      ],
    },
    isLoading: false,
  }),
  useClassStudents: vi.fn().mockReturnValue({
    data: {
      students: [
        {
          _id: 'st-1',
          id: 101,
          hoTen: 'Nguyễn Văn An',
          email: 'an.nguyen@edu.vn',
          className: 'CNTT-K15',
        },
      ],
    },
    isLoading: false,
  }),
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

describe('Teacher Gradebook Navigation & UI Enhancements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders prominent "Điểm số" button in TeacherClassList leading directly to class gradebook', async () => {
    renderWithProviders(<TeacherClassList />);

    // Class row should display course and class
    expect(screen.getByText('Lập trình Web')).toBeInTheDocument();
    expect(screen.getByText('IT101-01')).toBeInTheDocument();

    // Check that direct "Điểm số" button exists in the row
    const gradebookBtn = screen.getByRole('link', { name: /Danh sách điểm số lớp IT101-01/i });
    expect(gradebookBtn).toBeInTheDocument();
    expect(gradebookBtn).toHaveAttribute('href', '/teacher/classes/cls-123/grades');

    // Also check Attendance and Students buttons exist
    const attendanceBtn = screen.getByRole('link', { name: /Điểm danh/i });
    expect(attendanceBtn).toBeInTheDocument();
    expect(attendanceBtn).toHaveAttribute('href', '/teacher/attendance?classId=IT101-01');
    expect(screen.getByRole('link', { name: /Danh sách sinh viên lớp IT101-01/i })).toBeInTheDocument();
  });

  it('renders prominent "Danh sách điểm số" buttons and navigation tab bar in TeacherClassStudents', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/" element={<TeacherClassStudents />} />
      </Routes>
    );

    // Wait for class and student info to load
    await waitFor(() => {
      expect(screen.getByText(/Nguyễn Văn An/i)).toBeInTheDocument();
    });

    // 1. Prominent header action button
    const headerGradebookBtn = screen.getByRole('button', { name: /Danh sách điểm số Sổ điểm/i });
    expect(headerGradebookBtn).toBeInTheDocument();
    fireEvent.click(headerGradebookBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/teacher/classes/undefined/grades');

    // 2. Navigation tab bar
    const tabGradebookBtn = screen.getByRole('button', { name: /Danh sách điểm số \(Sổ điểm\) Nhập điểm/i });
    expect(tabGradebookBtn).toBeInTheDocument();
    fireEvent.click(tabGradebookBtn);

    // 3. Quick-access gradebook highlight banner
    const bannerGradebookBtn = screen.getByRole('button', { name: /Vào Danh sách điểm số/i });
    expect(bannerGradebookBtn).toBeInTheDocument();
    fireEvent.click(bannerGradebookBtn);

    expect(mockNavigate).toHaveBeenCalledTimes(3);
  });
});

