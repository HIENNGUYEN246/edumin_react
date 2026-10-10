import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TeacherDashboard } from './TeacherDashboard.jsx';

const { mockFeedbacks } = vi.hoisted(() => ({
  mockFeedbacks: [
    {
      _id: 'fb-01',
      id: 'FB_01',
      studentId: 101,
      studentName: 'Nguyễn Văn An',
      studentClass: 'CNTT-K18',
      isAnonymous: false,
      courseId: 'IT101',
      courseName: 'Lập trình C++',
      regId: 'IT101-01',
      rating: 5,
      courseQuality: 'Tốt',
      feedbackText: 'Thầy giảng rất dễ hiểu và tận tâm ạ!',
      teacherId: 1,
      teacherName: 'Trần Đình',
      teacherGender: 'Nam',
      response: 'Cảm ơn em đã cố gắng học tốt.',
      respondedAt: '14:30 10/10/2026',
      respondedByName: 'Trần Đình',
    },
    {
      _id: 'fb-02',
      id: 'FB_02',
      studentId: 102,
      studentName: 'Sinh viên',
      isAnonymous: true,
      courseId: 'IT101',
      courseName: 'Lập trình C++',
      regId: 'IT101-01',
      rating: 4,
      courseQuality: 'Ổn',
      feedbackText: 'Em muốn xin thêm slide bài giảng tuần trước.',
      teacherId: 1,
      teacherName: 'Trần Đình',
      teacherGender: 'Nam',
      response: '',
    },
  ],
}));

vi.mock('../../app/providers/AuthProvider.jsx', () => ({
  useAuth: () => ({
    user: { role: 'teacher', teacherId: 1 },
    profile: { id: 1, hoTen: 'Trần Đình', gender: 'Nam', department: 'Khoa CNTT' },
  }),
}));

vi.mock('../../app/providers/ToastProvider.jsx', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('./useTeacherClasses.js', () => ({
  useMyTeacherClasses: () => ({
    data: { data: [{ id: 'IT101-01', courseName: 'Lập trình C++' }] },
  }),
}));

vi.mock('../../api/feedbackApi.js', () => ({
  feedbackApi: {
    list: vi.fn().mockImplementation(() => Promise.resolve(mockFeedbacks)),
    respond: vi.fn().mockResolvedValue({ success: true }),
  },
}));

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <TeacherDashboard />
    </QueryClientProvider>
  );
}

describe('TeacherDashboard - Feedback 2-Way Chat Bubble & Smart Filters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders pedagogical teacher honorific and chat bubble conversation', async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Ý kiến & Đánh giá từ Sinh viên')).toBeInTheDocument();
    });

    // Check student opinion bubble
    expect(screen.getByText(/"Thầy giảng rất dễ hiểu và tận tâm ạ!"/)).toBeInTheDocument();
    expect(screen.getByText('Nguyễn Văn An')).toBeInTheDocument();

    // Check anonymous student opinion bubble
    expect(screen.getByText(/"Em muốn xin thêm slide bài giảng tuần trước."/)).toBeInTheDocument();
    expect(screen.getAllByText('Sinh viên ẩn danh').length).toBeGreaterThan(0);

    // Check pedagogical teacher response label: "Phản hồi từ Thầy Trần Đình"
    expect(screen.getByText(/Phản hồi từ Thầy Trần Đình/)).toBeInTheDocument();
    expect(screen.getByText('Cảm ơn em đã cố gắng học tốt.')).toBeInTheDocument();

    // Check action callout for pending feedback
    expect(screen.getByText(/Ý kiến này đang chờ Thầy Trần Đình gửi phản hồi/)).toBeInTheDocument();
    expect(screen.getAllByText('Phản hồi ngay').length).toBeGreaterThan(0);
  });

  it('filters feedbacks correctly when switching between status tabs', async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Ý kiến & Đánh giá từ Sinh viên')).toBeInTheDocument();
    });

    // Initial: "Tất cả" tab is selected, shows both feedbacks
    expect(screen.getByText(/"Thầy giảng rất dễ hiểu và tận tâm ạ!"/)).toBeInTheDocument();
    expect(screen.getByText(/"Em muốn xin thêm slide bài giảng tuần trước."/)).toBeInTheDocument();

    // Click "Chưa phản hồi" tab
    const pendingTab = screen.getByRole('button', { name: /Chưa phản hồi/i });
    fireEvent.click(pendingTab);

    // Only pending feedback is shown
    expect(screen.queryByText(/"Thầy giảng rất dễ hiểu và tận tâm ạ!"/)).not.toBeInTheDocument();
    expect(screen.getByText(/"Em muốn xin thêm slide bài giảng tuần trước."/)).toBeInTheDocument();

    // Click "Đã phản hồi" tab
    const repliedTab = screen.getByRole('button', { name: /Đã phản hồi/i });
    fireEvent.click(repliedTab);

    // Only replied feedback is shown
    expect(screen.getByText(/"Thầy giảng rất dễ hiểu và tận tâm ạ!"/)).toBeInTheDocument();
    expect(screen.queryByText(/"Em muốn xin thêm slide bài giảng tuần trước."/)).not.toBeInTheDocument();

    // Click "Tất cả" tab again
    const allTab = screen.getByRole('button', { name: /Tất cả/i });
    fireEvent.click(allTab);

    expect(screen.getByText(/"Thầy giảng rất dễ hiểu và tận tâm ạ!"/)).toBeInTheDocument();
    expect(screen.getByText(/"Em muốn xin thêm slide bài giảng tuần trước."/)).toBeInTheDocument();
  });
});
