import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { TeacherDocumentList } from './TeacherDocumentList.jsx';

const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
};

const mockConfirm = vi.fn();

vi.mock('../../app/providers/ToastProvider.jsx', () => ({
  useToast: () => mockToast,
}));

vi.mock('../../app/providers/ConfirmProvider.jsx', () => ({
  useConfirm: () => mockConfirm,
}));

vi.mock('./useTeacherClasses.js', () => ({
  useMyTeacherClasses: vi.fn(),
}));

vi.mock('../shared/useCourseOptions.js', () => ({
  useCourseOptions: vi.fn(),
}));

vi.mock('../shared/useDocuments.js', () => ({
  useDocuments: vi.fn(),
  useDocumentMutations: vi.fn(),
  downloadDocument: vi.fn(),
}));

import { useMyTeacherClasses } from './useTeacherClasses.js';
import { useCourseOptions } from '../shared/useCourseOptions.js';
import { useDocuments, useDocumentMutations, downloadDocument } from '../shared/useDocuments.js';

describe('TeacherDocumentList (Grouped by Class)', () => {
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

  const mockDocs = [
    {
      _id: 'd1',
      name: 'Giáo trình Tiếng Anh Unit 1-5',
      courseId: 'TA1',
      classId: 'TA1-L01',
      format: 'pdf',
      status: 'Công khai',
      hasFile: true,
      size: 2048576,
      createdAt: '2026-10-01T08:00:00Z',
    },
    {
      _id: 'd2',
      name: 'Slide Lập trình Web',
      courseId: 'CNTT101',
      classId: 'CNTT-L02',
      format: 'pptx',
      status: 'Công khai',
      hasFile: true,
      size: 1048576,
      createdAt: '2026-10-02T09:00:00Z',
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

    useDocuments.mockReturnValue({
      data: { success: true, data: mockDocs },
      isLoading: false,
    });

    useDocumentMutations.mockReturnValue(mockMutations);
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TeacherDocumentList />
        </MemoryRouter>
      </QueryClientProvider>
    );

  it('renders class folders with course name and class code', async () => {
    renderComponent();

    expect(screen.getAllByText('Tiếng Anh 1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Lập trình Web Cơ bản').length).toBeGreaterThan(0);
    expect(screen.getByText('Lớp TA1-L01')).toBeInTheDocument();
  });

  it('groups documents inside class folders and expands them', async () => {
    renderComponent();

    expect(await screen.findByText('Giáo trình Tiếng Anh Unit 1-5')).toBeInTheDocument();
    expect(screen.getByText('Slide Lập trình Web')).toBeInTheDocument();
  });

  it('allows collapsing and expanding folders', async () => {
    renderComponent();

    await screen.findByText('Giáo trình Tiếng Anh Unit 1-5');

    // Collapse All
    const collapseAllBtn = screen.getByText('Thu gọn tất cả');
    fireEvent.click(collapseAllBtn);

    expect(screen.queryByText('Giáo trình Tiếng Anh Unit 1-5')).not.toBeInTheDocument();

    // Expand All
    const expandAllBtn = screen.getByText('Mở rộng tất cả');
    fireEvent.click(expandAllBtn);

    expect(await screen.findByText('Giáo trình Tiếng Anh Unit 1-5')).toBeInTheDocument();
  });

  it('triggers delete confirmation when delete button is clicked', async () => {
    mockConfirm.mockResolvedValue(true);
    renderComponent();

    const deleteBtns = await screen.findAllByTitle('Xóa tài liệu');
    fireEvent.click(deleteBtns[0]);

    expect(mockConfirm).toHaveBeenCalled();
  });

  it('auto-fills and locks course and class context when clicking + Thêm tài liệu on a class card', async () => {
    renderComponent();

    const addButtons = screen.getAllByTitle('Tải lên tài liệu cho học phần này');
    expect(addButtons.length).toBeGreaterThan(0);

    fireEvent.click(addButtons[0]);

    expect(screen.getByText('Tự động gán')).toBeInTheDocument();
    expect(screen.getByText('Học phần & Lớp áp dụng')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Học phần/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Chọn học phần')).not.toBeInTheDocument();
  });

  it('opens edit modal with existing file info and allows updating without changing file (non-mandatory)', async () => {
    renderComponent();

    const editBtns = await screen.findAllByTitle('Chỉnh sửa thông tin & link');
    fireEvent.click(editBtns[0]);

    expect(screen.getByRole('heading', { name: 'Chỉnh sửa tài liệu' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Giáo trình Tiếng Anh Unit 1-5')).toBeInTheDocument();
    expect(screen.getByText(/Tệp hiện tại: Giáo trình Tiếng Anh Unit 1-5/i)).toBeInTheDocument();
    expect(screen.getByTestId('edit-document-dropzone')).toBeInTheDocument();

    const saveBtn = screen.getByRole('button', { name: 'Lưu thay đổi' });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockMutations.update.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'd1',
          name: 'Giáo trình Tiếng Anh Unit 1-5',
          status: 'Công khai',
        })
      );
    });
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Chỉnh sửa tài liệu' })).not.toBeInTheDocument();
    });
  });

  it('allows selecting a new file in edit modal and displays file preview card with size', async () => {
    renderComponent();

    const editBtns = await screen.findAllByTitle('Chỉnh sửa thông tin & link');
    fireEvent.click(editBtns[0]);

    const fileInput = screen.getByTestId('edit-document-file-input');
    const newFile = new File(['mock content'], 'TaiLieuMoi.pdf', { type: 'application/pdf' });
    Object.defineProperty(newFile, 'size', { value: 2516582 }); // ~2.4 MB

    fireEvent.change(fileInput, { target: { files: [newFile] } });

    expect(screen.getByTestId('edit-file-preview-card')).toBeInTheDocument();
    expect(screen.getByText('TaiLieuMoi.pdf')).toBeInTheDocument();
    expect(screen.getByText(/2.4 MB/i)).toBeInTheDocument();
    expect(screen.getByTestId('edit-change-file-btn')).toBeInTheDocument();
    expect(screen.getByTestId('edit-remove-file-btn')).toBeInTheDocument();

    // Click save
    const saveBtn = screen.getByRole('button', { name: 'Lưu thay đổi' });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockMutations.update.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'd1',
          file: newFile,
        })
      );
    });
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Chỉnh sửa tài liệu' })).not.toBeInTheDocument();
    });
  });

  it('allows removing selected new file in edit modal to revert to dropzone', async () => {
    renderComponent();

    const editBtns = await screen.findAllByTitle('Chỉnh sửa thông tin & link');
    fireEvent.click(editBtns[0]);

    const fileInput = screen.getByTestId('edit-document-file-input');
    const newFile = new File(['mock content'], 'TaiLieuThayThe.docx', { type: 'application/docx' });
    fireEvent.change(fileInput, { target: { files: [newFile] } });

    expect(screen.getByTestId('edit-file-preview-card')).toBeInTheDocument();

    // Remove new file
    fireEvent.click(screen.getByTestId('edit-remove-file-btn'));
    expect(screen.queryByTestId('edit-file-preview-card')).not.toBeInTheDocument();
    expect(screen.getByTestId('edit-document-dropzone')).toBeInTheDocument();
  });

  it('renders "AI Tóm tắt" and "Tạo Quiz" buttons and dispatches edumin:ai-study event on click', async () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    renderComponent();

    const summarizeBtns = await screen.findAllByRole('button', { name: /AI Tóm tắt/i });
    expect(summarizeBtns.length).toBeGreaterThan(0);

    const quizBtns = await screen.findAllByRole('button', { name: /Tạo Quiz/i });
    expect(quizBtns.length).toBeGreaterThan(0);

    // Click AI Tóm tắt for first document
    fireEvent.click(summarizeBtns[0]);
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'edumin:ai-study',
        detail: expect.objectContaining({
          action: 'summarize',
          documentId: 'd1',
          role: 'teacher',
        }),
      })
    );

    // Click Tạo Quiz for first document
    fireEvent.click(quizBtns[0]);
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'edumin:ai-study',
        detail: expect.objectContaining({
          action: 'quiz',
          documentId: 'd1',
          role: 'teacher',
        }),
      })
    );

    dispatchSpy.mockRestore();
  });
});

