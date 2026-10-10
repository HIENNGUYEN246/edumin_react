import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EduMinAiAssistant } from './EduMinAiAssistant.jsx';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../app/providers/AuthProvider.jsx', () => ({
  useAuth: () => ({
    user: { role: 'giao-vien', hoTen: 'Trần Minh Quân' },
    profile: { hoTen: 'Trần Minh Quân' },
  }),
}));

vi.mock('../../api/aiApi.js', () => ({
  aiApi: {
    query: vi.fn(),
    suggestions: vi.fn(),
  },
}));

import { aiApi } from '../../api/aiApi.js';

describe('EduMinAiAssistant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    aiApi.suggestions.mockResolvedValue({
      success: true,
      suggestions: [
        'Làm sao để cấu hình điểm giữa kỳ và Quiz?',
        'Xem lịch giảng dạy hôm nay',
      ],
    });
  });

  it('renders floating trigger button', async () => {
    render(
      <MemoryRouter>
        <EduMinAiAssistant />
      </MemoryRouter>
    );

    const button = screen.getByRole('button', { name: /Mở trợ lý ảo EduMin/i });
    expect(button).toBeInTheDocument();
    await waitFor(() => expect(aiApi.suggestions).toHaveBeenCalled());
  });

  it('opens chat window on toggle click and displays welcome message', async () => {
    render(
      <MemoryRouter>
        <EduMinAiAssistant />
      </MemoryRouter>
    );

    const toggleBtn = screen.getByRole('button', { name: /Mở trợ lý ảo EduMin/i });
    fireEvent.click(toggleBtn);

    expect(screen.getByRole('dialog', { name: /EduMin AI Assistant/i })).toBeInTheDocument();
    expect(screen.getByText(/Trần Minh Quân/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /EduMin AI Assistant/i })).toBeInTheDocument();
    await waitFor(() => expect(aiApi.suggestions).toHaveBeenCalled());
  });

  it('displays suggestions and sends question on suggestion click', async () => {
    aiApi.query.mockResolvedValueOnce({
      success: true,
      reply: 'Để cấu hình Quiz, bạn vào trang Lớp học phần và chọn Cấu hình Quiz.',
      intent: 'NAV_GRADE_CONFIG',
      quickLinks: [{ label: 'Đi tới Danh sách Lớp học phần', path: '/teacher/classes' }],
    });

    render(
      <MemoryRouter>
        <EduMinAiAssistant />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /Mở trợ lý ảo EduMin/i }));

    await waitFor(() => {
      expect(screen.getByText('Làm sao để cấu hình điểm giữa kỳ và Quiz?')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Làm sao để cấu hình điểm giữa kỳ và Quiz?'));

    expect(aiApi.query).toHaveBeenCalledWith('Làm sao để cấu hình điểm giữa kỳ và Quiz?');

    await waitFor(() => {
      expect(
        screen.getByText(/Để cấu hình Quiz, bạn vào trang Lớp học phần/i)
      ).toBeInTheDocument();
    });

    // Check quick link rendering
    const linkBtn = screen.getByRole('button', { name: /Đi tới Danh sách Lớp học phần/i });
    expect(linkBtn).toBeInTheDocument();

    fireEvent.click(linkBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/teacher/classes');
  });

  it('submits typed message and displays reply', async () => {
    aiApi.query.mockResolvedValueOnce({
      success: true,
      reply: 'Hôm nay bạn có 2 tiết học.',
      intent: 'QUERY_TEACHER_SCHEDULE',
      quickLinks: [{ label: 'Mở Thời khóa biểu', path: '/teacher/schedule' }],
    });

    render(
      <MemoryRouter>
        <EduMinAiAssistant />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /Mở trợ lý ảo EduMin/i }));

    const input = screen.getByPlaceholderText(/Nhập câu hỏi hoặc yêu cầu điều hướng.../i);
    fireEvent.change(input, { target: { value: 'Hôm nay tôi dạy gì?' } });

    const submitBtn = screen.getByTitle('Gửi câu hỏi');
    fireEvent.click(submitBtn);

    expect(aiApi.query).toHaveBeenCalledWith('Hôm nay tôi dạy gì?');

    await waitFor(() => {
      expect(screen.getByText('Hôm nay bạn có 2 tiết học.')).toBeInTheDocument();
    });
  });

  it('clears conversation when reset button is clicked', async () => {
    render(
      <MemoryRouter>
        <EduMinAiAssistant />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /Mở trợ lý ảo EduMin/i }));

    const resetBtn = screen.getByTitle('Làm mới hội thoại');
    fireEvent.click(resetBtn);

    expect(screen.getByText(/Đã làm mới cuộc hội thoại!/i)).toBeInTheDocument();
    await waitFor(() => expect(aiApi.suggestions).toHaveBeenCalled());
  });

  it('closes dialog when minimize button or toggle is clicked', async () => {
    render(
      <MemoryRouter>
        <EduMinAiAssistant />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /Mở trợ lý ảo EduMin/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    const minimizeBtn = screen.getByTitle('Thu nhỏ');
    fireEvent.click(minimizeBtn);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(aiApi.suggestions).toHaveBeenCalled());
  });
});
