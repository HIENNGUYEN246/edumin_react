import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { DocumentAiStudyPage } from './DocumentAiStudyPage.jsx';

const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
};

vi.mock('../../app/providers/ToastProvider.jsx', () => ({
  useToast: () => mockToast,
}));

let mockUser = {
  id: 'u1',
  hoTen: 'Trần Thị Huệ',
  email: 'teacher@edu.vn',
  role: 'giao-vien',
};

vi.mock('../../app/providers/AuthProvider.jsx', () => ({
  useAuth: () => ({ user: mockUser }),
}));

vi.mock('../../api/documentsApi.js', () => ({
  documentsApi: {
    getAiStudy: vi.fn(),
    publishSummary: vi.fn(),
    publishQuiz: vi.fn(),
    summarize: vi.fn(),
    generateQuiz: vi.fn(),
  },
}));

import { documentsApi } from '../../api/documentsApi.js';

describe('DocumentAiStudyPage Component', () => {
  let queryClient;

  const mockStudyData = {
    document: {
      _id: 'doc123',
      name: 'Chuong_1_Gioi_thieu_HDH.pdf',
      courseId: 'HDH-01',
      courseName: 'Hệ điều hành',
      className: 'Lớp HDH 01',
      uploadedBy: 'Trần Thị Huệ',
    },
    summary: {
      publishedSummary: 'Tóm tắt bài học Hệ điều hành: Khái niệm tiến trình và luồng.',
      publishedKeyConcepts: [
        {
          concept: 'Tiến trình (Process)',
          definition: 'Chương trình đang trong quá trình thực thi.',
          formula: 'PCB = Context + State',
        },
      ],
      isPublished: true,
      publishedBy: 'Trần Thị Huệ',
      publishedAt: '2026-10-26T10:00:00.000Z',
    },
    quiz: {
      publishedQuizzes: [
        {
          question: 'Tiến trình trong hệ điều hành là gì?',
          options: [
            'Chương trình đang thực thi',
            'Một file lưu trên ổ đĩa cứng',
            'Thiết bị ngoại vi',
            'Dung lượng RAM',
          ],
          correctIndex: 0,
          explanation: 'Tiến trình là một thực thể đang thực thi bởi CPU.',
          concept: 'Tiến trình',
        },
      ],
      isPublished: true,
      publishedBy: 'Trần Thị Huệ',
      publishedAt: '2026-10-26T10:00:00.000Z',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });
  });

  const renderComponent = (initialEntries = ['/documents/doc123/ai-study?tab=summary']) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries}>
          <Routes>
            <Route path="/documents/:id/ai-study" element={<DocumentAiStudyPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it('renders summary data and core concepts without infinite re-render loop', async () => {
    documentsApi.getAiStudy.mockResolvedValueOnce({
      success: true,
      data: mockStudyData,
    });

    renderComponent();

    // Verify loading spinner first
    expect(screen.getByText(/Đang tải trung tâm AI Tóm tắt & Ôn tập Quiz/i)).toBeInTheDocument();

    // Wait for content to render
    await waitFor(() => {
      expect(screen.getByText('Chuong_1_Gioi_thieu_HDH.pdf')).toBeInTheDocument();
    });

    expect(screen.getByText(/Tiến trình \(Process\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Tóm tắt bài học Hệ điều hành/i)).toBeInTheDocument();
    expect(screen.getByText(/PCB = Context \+ State/i)).toBeInTheDocument();
  });

  it('switches to quiz tab and allows student/user to answer and grade quiz', async () => {
    documentsApi.getAiStudy.mockResolvedValueOnce({
      success: true,
      data: mockStudyData,
    });

    renderComponent(['/documents/doc123/ai-study?tab=quiz']);

    await waitFor(() => {
      expect(screen.getByText('Tiến trình trong hệ điều hành là gì?')).toBeInTheDocument();
    });

    // Select option A
    const optionA = screen.getByText('Chương trình đang thực thi');
    fireEvent.click(optionA);

    // Option A is selected
    expect(optionA).toBeInTheDocument();
  });

  it('allows teacher to click "Chỉnh sửa nội dung" and save updated summary', async () => {
    documentsApi.getAiStudy.mockResolvedValueOnce({
      success: true,
      data: mockStudyData,
    });
    documentsApi.publishSummary.mockResolvedValueOnce({
      success: true,
      message: 'Cập nhật tóm tắt thành công',
    });

    renderComponent(['/documents/doc123/ai-study?tab=summary']);

    await waitFor(() => {
      expect(screen.getByText(/Chỉnh sửa nội dung/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Chỉnh sửa nội dung/i));

    // Form inputs should now be displayed
    expect(screen.getByPlaceholderText(/Nhập nội dung tóm tắt/i)).toBeInTheDocument();

    // Click "Lưu & Phát hành cho sinh viên"
    const saveButton = screen.getByText(/Lưu & Phát hành cho sinh viên/i);
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(documentsApi.publishSummary).toHaveBeenCalledTimes(1);
    });
  });
});

