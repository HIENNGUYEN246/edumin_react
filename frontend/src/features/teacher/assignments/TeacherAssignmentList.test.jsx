import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { TeacherAssignmentList } from './TeacherAssignmentList.jsx';

const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
};

const mockConfirm = vi.fn();

vi.mock('../../../app/providers/ToastProvider.jsx', () => ({
  useToast: () => mockToast,
}));

vi.mock('../../../app/providers/ConfirmProvider.jsx', () => ({
  useConfirm: () => mockConfirm,
}));

vi.mock('../useTeacherClasses.js', () => ({
  useMyTeacherClasses: vi.fn(),
}));

vi.mock('../../shared/useCourseOptions.js', () => ({
  useCourseOptions: vi.fn(),
}));

vi.mock('../../shared/useAssignments.js', () => ({
  useAssignments: vi.fn(),
  useAssignmentMutations: vi.fn(),
}));

import { useMyTeacherClasses } from '../useTeacherClasses.js';
import { useCourseOptions } from '../../shared/useCourseOptions.js';
import { useAssignments, useAssignmentMutations } from '../../shared/useAssignments.js';

describe('TeacherAssignmentList (Grouped by Class)', () => {
  let queryClient;

  const mockTeacherClasses = [
    {
      _id: 'cls1',
      id: 'TA1-L01',
      className: 'Lớp Tiếng Anh 1 - Nhóm 1',
      courseId: 'TA1',
      courseName: 'Tiếng Anh 1',
      room: 'B204',
      schedules: [{ dayOfWeek: 2, startPeriod: 1, endPeriod: 3 }],
    },
    {
      _id: 'cls2',
      id: 'CNTT-L02',
      className: 'Lớp Lập trình Web - Nhóm 2',
      courseId: 'CNTT101',
      courseName: 'Lập trình Web Cơ bản',
      room: 'A102',
      schedules: [{ dayOfWeek: 4, startPeriod: 4, endPeriod: 6 }],
    },
  ];

  const mockCourses = [
    { id: 'TA1', name: 'Tiếng Anh 1' },
    { id: 'CNTT101', name: 'Lập trình Web Cơ bản' },
  ];

  const mockAssignments = [
    {
      _id: 'asg1',
      title: 'Kiểm tra 15 phút Grammar',
      description: 'Làm bài kiểm tra thì hiện tại',
      courseId: 'TA1',
      classId: 'TA1-L01',
      type: 'quiz',
      dueDate: '2026-12-31',
      status: 'Công khai',
      questions: [{ id: 'q1', text: 'Q1', options: ['A', 'B'] }],
    },
    {
      _id: 'asg2',
      title: 'Bài tập Javascript Cơ bản',
      description: 'Làm bài trắc nghiệm JS',
      courseId: 'CNTT101',
      classId: 'CNTT-L02',
      type: 'quiz',
      dueDate: '2026-12-31',
      status: 'Công khai',
      questions: [{ id: 'q1', text: 'Q1', options: ['A', 'B'] }],
    },
  ];

  const mockMutations = {
    create: { mutateAsync: vi.fn(), isPending: false },
    update: { mutateAsync: vi.fn(), isPending: false },
    remove: { mutateAsync: vi.fn(), isPending: false },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    useMyTeacherClasses.mockReturnValue({
      data: { success: true, data: mockTeacherClasses },
      isLoading: false,
    });

    useCourseOptions.mockReturnValue({
      courses: mockCourses,
      isLoading: false,
    });

    useAssignments.mockReturnValue({
      data: { success: true, data: mockAssignments },
      isLoading: false,
    });

    useAssignmentMutations.mockReturnValue(mockMutations);
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TeacherAssignmentList />
        </MemoryRouter>
      </QueryClientProvider>
    );

  it('renders class folders with course name and class code', async () => {
    renderComponent();

    expect(screen.getAllByText('Tiếng Anh 1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Lập trình Web Cơ bản').length).toBeGreaterThan(0);
    expect(screen.getByText('Lớp TA1-L01')).toBeInTheDocument();
  });

  it('groups assignments inside class folders and expands them', async () => {
    renderComponent();

    expect(await screen.findByText('Kiểm tra 15 phút Grammar')).toBeInTheDocument();
    expect(screen.getByText('Bài tập Javascript Cơ bản')).toBeInTheDocument();
  });

  it('allows collapsing and expanding folders', async () => {
    renderComponent();

    await screen.findByText('Kiểm tra 15 phút Grammar');

    // Collapse All
    const collapseAllBtn = screen.getByText('Thu gọn tất cả');
    fireEvent.click(collapseAllBtn);

    expect(screen.queryByText('Kiểm tra 15 phút Grammar')).not.toBeInTheDocument();

    // Expand All
    const expandAllBtn = screen.getByText('Mở rộng tất cả');
    fireEvent.click(expandAllBtn);

    expect(await screen.findByText('Kiểm tra 15 phút Grammar')).toBeInTheDocument();
  });

  it('triggers delete confirmation when delete assignment button is clicked', async () => {
    mockConfirm.mockResolvedValue(true);
    renderComponent();

    const deleteBtns = await screen.findAllByTitle('Xóa bài tập');
    fireEvent.click(deleteBtns[0]);

    expect(mockConfirm).toHaveBeenCalled();
  });

  it('renders "Tạo quiz nhanh bằng AI" in header and dispatches edumin:ai-study on click', async () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    renderComponent();

    const quickQuizBtn = screen.getByRole('button', { name: /Tạo quiz nhanh bằng AI/i });
    expect(quickQuizBtn).toBeInTheDocument();

    fireEvent.click(quickQuizBtn);

    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'edumin:ai-study',
        detail: expect.objectContaining({
          action: 'quiz',
          role: 'teacher',
        }),
      })
    );
    dispatchSpy.mockRestore();
  });

  it('renders "Tạo Quiz nhanh AI" in class folders and dispatches edumin:ai-study with target class', async () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    renderComponent();

    const folderQuickQuizBtns = await screen.findAllByRole('button', { name: /Tạo Quiz nhanh AI/i });
    expect(folderQuickQuizBtns.length).toBeGreaterThan(0);

    fireEvent.click(folderQuickQuizBtns[0]);

    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'edumin:ai-study',
        detail: expect.objectContaining({
          action: 'quiz',
          courseId: 'TA1',
          classId: 'TA1-L01',
          role: 'teacher',
        }),
      })
    );
    dispatchSpy.mockRestore();
  });
});

