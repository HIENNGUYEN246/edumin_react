import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { QuizPlayer } from './QuizPlayer.jsx';
import { assignmentsApi } from '../../../api/assignmentsApi.js';

vi.mock('../../../api/assignmentsApi.js', () => ({
  assignmentsApi: {
    submit: vi.fn(),
  },
}));

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock('../../../app/providers/ToastProvider.jsx', () => ({
  useToast: () => ({
    success: mockToastSuccess,
    error: mockToastError,
  }),
}));

describe('Student Quiz Taking & Review Integration Flow (QuizPlayer)', () => {
  let queryClient;

  const mockQuizAssignment = {
    _id: 'assign_quiz_rag_101',
    courseId: 'CNTT202',
    classId: 'CNTT202-01',
    type: 'quiz',
    title: 'Quiz 1: Kiến trúc RAG và Vector Search',
    description: 'Bộ câu hỏi kiểm tra kiến thức AI RAG',
    dueDate: '2026-12-31',
    questions: [
      {
        id: 'q_1',
        text: 'Vector Database dùng để làm gì trong hệ thống RAG?',
        options: [
          'Lưu trữ và tìm kiếm vector embeddings tương đồng',
          'Quản lý bảng tính Excel',
          'Nén video chất lượng cao',
          'Gửi email tự động',
        ],
      },
      {
        id: 'q_2',
        text: 'Công thức Cosine Similarity dùng để tính đại lượng nào?',
        options: [
          'Góc tương đồng giữa hai vector',
          'Tốc độ CPU khi tính toán',
          'Kích thước file trên đĩa cứng',
          'Băng thông đường truyền mạng',
        ],
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    window.scrollTo = vi.fn();
  });

  const renderPlayer = (props = {}) =>
    render(
      <QueryClientProvider client={queryClient}>
        <QuizPlayer assignment={mockQuizAssignment} {...props} />
      </QueryClientProvider>
    );

  it('renders all questions and initial progress state (0/2 câu)', () => {
    renderPlayer();

    expect(screen.getByText('Vector Database dùng để làm gì trong hệ thống RAG?')).toBeInTheDocument();
    expect(screen.getByText('Công thức Cosine Similarity dùng để tính đại lượng nào?')).toBeInTheDocument();
    expect(screen.getByText('0/2 câu')).toBeInTheDocument();
    expect(screen.getByText('Còn 2 câu chưa trả lời.')).toBeInTheDocument();
  });

  it('blocks submission and warns user if questions are not fully answered', () => {
    renderPlayer();

    // Click option on question 1 only
    const optA = screen.getByText('Lưu trữ và tìm kiếm vector embeddings tương đồng');
    fireEvent.click(optA);

    expect(screen.getByText('1/2 câu')).toBeInTheDocument();
    expect(screen.getByText('Còn 1 câu chưa trả lời.')).toBeInTheDocument();

    const submitBtn = screen.getByRole('button', { name: /Nộp bài/i });
    fireEvent.click(submitBtn);

    expect(mockToastError).toHaveBeenCalledWith('Vui lòng trả lời đầy đủ câu hỏi');
    expect(assignmentsApi.submit).not.toHaveBeenCalled();
  });

  it('allows answering all questions and successfully submits with score display', async () => {
    assignmentsApi.submit.mockResolvedValueOnce({
      score: 10,
      correctCount: 2,
      total: 2,
      answerKey: [
        { id: 'q_1', correctIndex: 0, explanation: 'Vector Database tối ưu hóa tìm kiếm tương đồng vector.' },
        { id: 'q_2', correctIndex: 0, explanation: 'Cosine similarity đo độ tương đồng góc giữa hai vector embeddings.' },
      ],
    });

    renderPlayer();

    // Answer Q1 -> Option A (index 0)
    const opt1A = screen.getByText('Lưu trữ và tìm kiếm vector embeddings tương đồng');
    fireEvent.click(opt1A);

    // Answer Q2 -> Option A (index 0)
    const opt2A = screen.getByText('Góc tương đồng giữa hai vector');
    fireEvent.click(opt2A);

    expect(screen.getByText('2/2 câu')).toBeInTheDocument();
    expect(screen.getByText('Đã trả lời hết, sẵn sàng nộp bài.')).toBeInTheDocument();

    const submitBtn = screen.getByRole('button', { name: /Nộp bài/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(assignmentsApi.submit).toHaveBeenCalledWith('assign_quiz_rag_101', {
        q_1: 0,
        q_2: 0,
      });
    });

    // Score banner should appear
    expect(await screen.findByText('10')).toBeInTheDocument();
    expect(screen.getByText('Đúng 2/2 câu')).toBeInTheDocument();
    expect(mockToastSuccess).toHaveBeenCalledWith('Điểm của bạn: 10/10');
  });

  it('renders directly in review mode when initialResult is provided', () => {
    const initialResult = {
      score: 5,
      correctCount: 1,
      total: 2,
      answerKey: [
        { id: 'q_1', correctIndex: 0 },
        { id: 'q_2', correctIndex: 0 },
      ],
    };
    const initialAnswers = {
      q_1: 0, // correct
      q_2: 1, // wrong pick
    };

    renderPlayer({ initialResult, initialAnswers });

    // Review banner is visible
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('Đúng 1/2 câu')).toBeInTheDocument();
    expect(screen.getByText('Xem lại các câu trả lời đúng và sai bên dưới.')).toBeInTheDocument();

    // Submit bar should NOT be shown
    expect(screen.queryByRole('button', { name: /Nộp bài/i })).not.toBeInTheDocument();
  });
});

