import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { StudentDocumentList } from './StudentDocumentList.jsx';

const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
};

vi.mock('../../app/providers/ToastProvider.jsx', () => ({
  useToast: () => mockToast,
}));

vi.mock('../../api/enrollmentsApi.js', () => ({
  enrollmentsApi: {
    mine: vi.fn(),
  },
}));

vi.mock('../shared/useCourseOptions.js', () => ({
  useCourseOptions: vi.fn(),
}));

vi.mock('../shared/useDocuments.js', () => ({
  useDocuments: vi.fn(),
  downloadDocument: vi.fn(),
}));

import { enrollmentsApi } from '../../api/enrollmentsApi.js';
import { useCourseOptions } from '../shared/useCourseOptions.js';
import { useDocuments, downloadDocument } from '../shared/useDocuments.js';

describe('StudentDocumentList (Grouped by Class)', () => {
  let queryClient;

  const mockEnrollments = [
    {
      _id: 'e1',
      status: 'active',
      class: {
        id: 'L01',
        _id: 'class_01',
        className: 'Lớp 01 - Lập trình Web',
        courseId: 'CS101',
        courseName: 'Lập trình Web',
        teacherName: 'ThS. Nguyễn Văn A',
        credits: 3,
        room: 'A201',
      },
    },
    {
      _id: 'e2',
      status: 'active',
      class: {
        id: 'L02',
        _id: 'class_02',
        className: 'Lớp 02 - Cơ sở dữ liệu',
        courseId: 'CS102',
        courseName: 'Cơ sở dữ liệu',
        teacherName: 'TS. Trần Thị B',
        credits: 4,
        room: 'B102',
      },
    },
  ];

  const mockCourses = [
    { id: 'CS101', name: 'Lập trình Web', credits: 3 },
    { id: 'CS102', name: 'Cơ sở dữ liệu', credits: 4 },
  ];

  const mockDocs = [
    {
      _id: 'doc1',
      name: 'Slide Bài giảng Chương 1 - HTML & CSS',
      courseId: 'CS101',
      classId: 'L01',
      format: 'pdf',
      size: 1048576, // 1MB
      hasFile: true,
      uploadedBy: 'ThS. Nguyễn Văn A',
      createdAt: '2026-10-01T08:00:00Z',
    },
    {
      _id: 'doc2',
      name: 'Tài liệu ôn tập SQL',
      courseId: 'CS102',
      classId: 'L02',
      format: 'docx',
      size: 512000,
      hasFile: true,
      uploadedBy: 'TS. Trần Thị B',
      createdAt: '2026-10-02T09:00:00Z',
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

    useDocuments.mockReturnValue({
      data: { success: true, data: mockDocs },
      isLoading: false,
      refetch: vi.fn(),
    });
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <StudentDocumentList />
        </MemoryRouter>
      </QueryClientProvider>
    );

  it('renders class folders with course name, code and teacher', async () => {
    renderComponent();

    const teacherAElements = await screen.findAllByText('ThS. Nguyễn Văn A');
    expect(teacherAElements.length).toBeGreaterThan(0);
    expect(screen.getByText('Lập trình Web')).toBeInTheDocument();
    expect(screen.getByText('Cơ sở dữ liệu')).toBeInTheDocument();
    expect(screen.getAllByText('TS. Trần Thị B').length).toBeGreaterThan(0);
  });

  it('groups documents inside their corresponding class folders', async () => {
    renderComponent();

    // Since mockDocs exist, class folders should be expanded and docs should be visible
    expect(await screen.findByText('Slide Bài giảng Chương 1 - HTML & CSS')).toBeInTheDocument();
    expect(screen.getByText('Tài liệu ôn tập SQL')).toBeInTheDocument();
  });

  it('allows collapsing and expanding class folders', async () => {
    renderComponent();

    await screen.findByText('Slide Bài giảng Chương 1 - HTML & CSS');

    // Click "Thu gọn tất cả"
    const collapseAllBtn = screen.getByText('Thu gọn tất cả');
    fireEvent.click(collapseAllBtn);

    // Document text should no longer be visible
    expect(screen.queryByText('Slide Bài giảng Chương 1 - HTML & CSS')).not.toBeInTheDocument();

    // Click "Mở rộng tất cả"
    const expandAllBtn = screen.getByText('Mở rộng tất cả');
    fireEvent.click(expandAllBtn);

    expect(await screen.findByText('Slide Bài giảng Chương 1 - HTML & CSS')).toBeInTheDocument();
  });

  it('handles document download when download button is clicked', async () => {
    downloadDocument.mockResolvedValueOnce();
    renderComponent();

    expect(await screen.findByText('Slide Bài giảng Chương 1 - HTML & CSS')).toBeInTheDocument();

    const downloadButtons = await screen.findAllByRole('button', { name: /Tải về/i });
    expect(downloadButtons.length).toBeGreaterThan(0);

    fireEvent.click(downloadButtons[0]);

    await waitFor(() => {
      expect(downloadDocument).toHaveBeenCalledWith('doc1');
    });
  });

  it('filters folders when search input is used', async () => {
    renderComponent();

    await screen.findByText('ThS. Nguyễn Văn A');

    const searchInput = screen.getByPlaceholderText(/Tìm kiếm tài liệu/i);
    fireEvent.change(searchInput, { target: { value: 'SQL' } });

    // "Cơ sở dữ liệu" has the SQL doc, so it should be visible
    expect(screen.getByText('Cơ sở dữ liệu')).toBeInTheDocument();
    // "Lập trình Web" has no SQL doc, so it should be filtered out
    expect(screen.queryByText('ThS. Nguyễn Văn A')).not.toBeInTheDocument();
  });

  it('renders "AI Tóm tắt" button and does NOT render "Tạo Quiz" button for student', async () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    renderComponent();

    // Student should have "AI Tóm tắt"
    const summarizeBtns = await screen.findAllByRole('button', { name: /AI Tóm tắt/i });
    expect(summarizeBtns.length).toBeGreaterThan(0);

    // Student should NOT have "Tạo Quiz" (quiz creation is reserved for teachers)
    expect(screen.queryByRole('button', { name: /Tạo Quiz/i })).not.toBeInTheDocument();

    // Clicking "AI Tóm tắt" dispatches summarize action with role student
    fireEvent.click(summarizeBtns[0]);
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'edumin:ai-study',
        detail: expect.objectContaining({
          action: 'summarize',
          documentId: 'doc1',
          role: 'student',
        }),
      })
    );

    dispatchSpy.mockRestore();
  });
});
