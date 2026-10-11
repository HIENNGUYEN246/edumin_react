import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { StudentAssignmentList } from './StudentAssignmentList.jsx';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../../api/enrollmentsApi.js', () => ({
  enrollmentsApi: {
    mine: vi.fn(),
  },
}));

vi.mock('../../shared/useCourseOptions.js', () => ({
  useCourseOptions: vi.fn(),
}));

vi.mock('../../shared/useAssignments.js', () => ({
  useAssignments: vi.fn(),
}));

import { enrollmentsApi } from '../../../api/enrollmentsApi.js';
import { useCourseOptions } from '../../shared/useCourseOptions.js';
import { useAssignments } from '../../shared/useAssignments.js';

describe('StudentAssignmentList (Grouped by Class)', () => {
  let queryClient;

  const mockEnrollments = [
    {
      _id: 'e1',
      status: 'active',
      class: {
        id: 'L01',
        _id: 'class_01',
        className: 'Lớp 01 - Tiếng Anh 1',
        courseId: 'TA1',
        courseName: 'Tiếng Anh 1',
        teacherName: 'GV: Trần Đình',
        credits: 3,
        room: 'B204',
      },
    },
    {
      _id: 'e2',
      status: 'active',
      class: {
        id: 'L02',
        _id: 'class_02',
        className: 'Lớp 02 - Lập trình Web',
        courseId: 'CNTT101',
        courseName: 'Lập trình Web Cơ bản',
        teacherName: 'GV: Nguyễn Văn Web',
        credits: 4,
        room: 'A101',
      },
    },
  ];

  const mockCourses = [
    { id: 'TA1', name: 'Tiếng Anh 1', credits: 3 },
    { id: 'CNTT101', name: 'Lập trình Web Cơ bản', credits: 4 },
  ];

  const mockAssignments = [
    {
      _id: 'a1',
      title: 'Kiểm tra 15 phút Vocabulary',
      description: 'Làm bài kiểm tra từ vựng Unit 1',
      courseId: 'TA1',
      classId: 'L01',
      type: 'quiz',
      dueDate: '2026-12-31',
      questions: [{ id: 'q1', text: 'Question 1', options: ['A', 'B'] }],
      createdBy: 'GV: Trần Đình',
      mySubmission: { score: 10 },
    },
    {
      _id: 'a2',
      title: 'Bài tập HTML DOM',
      description: 'Thực hành thao tác DOM với Javascript',
      courseId: 'CNTT101',
      classId: 'L02',
      type: 'quiz',
      dueDate: '2026-12-31',
      questions: [{ id: 'q1', text: 'Question 1', options: ['A', 'B'] }],
      createdBy: 'GV: Nguyễn Văn Web',
      mySubmission: null,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    enrollmentsApi.mine.mockResolvedValue({
      success: true,
      data: mockEnrollments,
    });

    useCourseOptions.mockReturnValue({
      courses: mockCourses,
      isLoading: false,
    });

    useAssignments.mockReturnValue({
      data: { success: true, data: mockAssignments },
      isLoading: false,
    });
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <StudentAssignmentList />
        </MemoryRouter>
      </QueryClientProvider>
    );

  it('renders class folders with course name, code and teacher', async () => {
    renderComponent();

    const teacherWebElements = await screen.findAllByText('GV: Nguyễn Văn Web');
    expect(teacherWebElements.length).toBeGreaterThan(0);
    expect(screen.getAllByText('Tiếng Anh 1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Lập trình Web Cơ bản').length).toBeGreaterThan(0);
  });

  it('groups assignments inside their corresponding class folders', async () => {
    renderComponent();

    // Since mockAssignments exist, folders should be auto-expanded and assignment titles visible
    expect(await screen.findByText('Kiểm tra 15 phút Vocabulary')).toBeInTheDocument();
    expect(screen.getByText('Bài tập HTML DOM')).toBeInTheDocument();
  });

  it('allows collapsing and expanding class folders with action buttons', async () => {
    renderComponent();

    await screen.findByText('Kiểm tra 15 phút Vocabulary');

    // Click "Thu gọn tất cả"
    const collapseAllBtn = screen.getByText('Thu gọn tất cả');
    fireEvent.click(collapseAllBtn);

    // Assignment titles should no longer be visible
    expect(screen.queryByText('Kiểm tra 15 phút Vocabulary')).not.toBeInTheDocument();

    // Click "Mở rộng tất cả"
    const expandAllBtn = screen.getByText('Mở rộng tất cả');
    fireEvent.click(expandAllBtn);

    expect(await screen.findByText('Kiểm tra 15 phút Vocabulary')).toBeInTheDocument();
  });

  it('navigates to quiz player when clicking Làm bài button', async () => {
    renderComponent();

    // Assignment 2 is not yet submitted, so it has "Làm bài" button
    const doQuizBtn = await screen.findByRole('button', { name: /Làm bài/i });
    fireEvent.click(doQuizBtn);

    expect(mockNavigate).toHaveBeenCalledWith('/student/assignments/a2');
  });

  it('navigates to review results when clicking Xem kết quả button', async () => {
    renderComponent();

    // Assignment 1 has submission (score 10), so it has "Xem kết quả" button
    const viewResultBtn = await screen.findByRole('button', { name: /Xem kết quả/i });
    fireEvent.click(viewResultBtn);

    expect(mockNavigate).toHaveBeenCalledWith('/student/assignments/a1');
  });

  it('filters assignments and folders when searching by keyword', async () => {
    renderComponent();

    await screen.findByText('Kiểm tra 15 phút Vocabulary');

    const searchInput = screen.getByPlaceholderText(/Tìm kiếm bài tập/i);
    fireEvent.change(searchInput, { target: { value: 'HTML DOM' } });

    // "Lập trình Web Cơ bản" has the HTML DOM assignment
    expect(screen.getAllByText('Lập trình Web Cơ bản').length).toBeGreaterThan(0);
    expect(screen.getByText('Bài tập HTML DOM')).toBeInTheDocument();

    // "Tiếng Anh 1" should be filtered out
    expect(screen.queryByText('Tiếng Anh 1')).not.toBeInTheDocument();
  });

  it('filters assignments by status (pending vs completed)', async () => {
    renderComponent();

    await screen.findByText('Kiểm tra 15 phút Vocabulary');

    // Select status filter: "Cần làm (chưa nộp)"
    const selects = screen.getAllByRole('combobox');
    // Status select is the second select
    const statusSelect = selects[1];
    fireEvent.change(statusSelect, { target: { value: 'pending' } });

    // Only pending assignment "Bài tập HTML DOM" should remain
    expect(screen.getByText('Bài tập HTML DOM')).toBeInTheDocument();
    expect(screen.queryByText('Kiểm tra 15 phút Vocabulary')).not.toBeInTheDocument();
  });
});
