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

    expect(aiApi.query).toHaveBeenCalledWith('Làm sao để cấu hình điểm giữa kỳ và Quiz?', {
      currentPath: '/',
    });

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

    expect(aiApi.query).toHaveBeenCalledWith('Hôm nay tôi dạy gì?', {
      currentPath: '/',
    });

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

  it('matches keyword "sinh viên" with smart mock response and quick navigation', async () => {
    aiApi.query.mockResolvedValueOnce({
      success: true,
      reply: 'Dạ, để xem danh sách sinh viên, bạn có thể truy cập nhanh vào mục Quản lý sinh viên ở menu bên trái.',
      intent: 'NAV_STUDENTS',
      quickLinks: [{ label: 'Quản lý sinh viên', path: '/admin/students' }],
    });

    render(
      <MemoryRouter>
        <EduMinAiAssistant />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /Mở trợ lý ảo EduMin/i }));

    const input = screen.getByPlaceholderText(/Nhập câu hỏi hoặc yêu cầu điều hướng.../i);
    fireEvent.change(input, { target: { value: 'Xem danh sách sinh viên ở đâu?' } });

    const submitBtn = screen.getByTitle('Gửi câu hỏi');
    fireEvent.click(submitBtn);

    // Verify user message appears
    expect(screen.getByText('Xem danh sách sinh viên ở đâu?')).toBeInTheDocument();

    // Verify smart response appears
    await waitFor(() => {
      expect(
        screen.getByText(/Dạ, để xem danh sách sinh viên, bạn có thể truy cập nhanh vào mục Quản lý sinh viên/i)
      ).toBeInTheDocument();
    });

    const studentNavBtn = screen.getByRole('button', { name: /Quản lý sinh viên/i });
    expect(studentNavBtn).toBeInTheDocument();
    fireEvent.click(studentNavBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/admin/students');
  });

  it('matches keyword "duyệt yêu cầu" with profile requests navigation', async () => {
    aiApi.query.mockResolvedValueOnce({
      success: true,
      reply: 'Dạ, bạn có thể xem xét và phê duyệt các yêu cầu thay đổi thông tin cá nhân hoặc cập nhật ảnh đại diện tại trang "Duyệt yêu cầu" ở menu bên trái.',
      intent: 'NAV_PROFILE_REQUESTS',
      quickLinks: [{ label: 'Duyệt yêu cầu hồ sơ', path: '/admin/profile-requests' }],
    });

    render(
      <MemoryRouter>
        <EduMinAiAssistant />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /Mở trợ lý ảo EduMin/i }));

    const input = screen.getByPlaceholderText(/Nhập câu hỏi hoặc yêu cầu điều hướng.../i);
    fireEvent.change(input, { target: { value: 'Làm thế nào để duyệt yêu cầu hồ sơ?' } });

    const submitBtn = screen.getByTitle('Gửi câu hỏi');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Dạ, để cập nhật thông tin cá nhân|Dạ, bạn có thể xem xét và phê duyệt các yêu cầu/i)).toBeInTheDocument();
    });
  });

  it('correctly prioritizes "Điểm số" over "Sinh viên" when asked about "phần điểm sinh viên"', async () => {
    // When apiResult is null/offline, tests verify getSmartAiResponse disambiguation
    aiApi.query.mockRejectedValueOnce(new Error('Network offline'));

    render(
      <MemoryRouter>
        <EduMinAiAssistant />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /Mở trợ lý ảo EduMin/i }));

    const input = screen.getByPlaceholderText(/Nhập câu hỏi hoặc yêu cầu điều hướng.../i);
    fireEvent.change(input, { target: { value: 'Làm sao để vào phần điểm sinh viên?' } });

    const submitBtn = screen.getByTitle('Gửi câu hỏi');
    fireEvent.click(submitBtn);

    // Should recognize the intent as Điểm số (Gradebook) and navigate to Gradebook, NOT Student management
    await waitFor(() => {
      expect(screen.getByText(/bảng điểm sinh viên/i)).toBeInTheDocument();
    });

    const gradeNavBtn = screen.getByRole('button', { name: /Vào Bảng điểm Lớp học phần/i });
    expect(gradeNavBtn).toBeInTheDocument();
    fireEvent.click(gradeNavBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/teacher/classes');
  });

  it('honestly handles out-of-scope/unsupported features like "ký túc xá" or "thư viện"', async () => {
    aiApi.query.mockRejectedValueOnce(new Error('Network offline'));

    render(
      <MemoryRouter>
        <EduMinAiAssistant />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /Mở trợ lý ảo EduMin/i }));

    const input = screen.getByPlaceholderText(/Nhập câu hỏi hoặc yêu cầu điều hướng.../i);
    fireEvent.change(input, { target: { value: 'Hệ thống có cho đăng ký ký túc xá không?' } });

    const submitBtn = screen.getByTitle('Gửi câu hỏi');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/Dạ, hiện tại hệ thống EduMin chưa hỗ trợ tính năng này hoặc không có mục đó trong phần quản lý của bạn/i)
      ).toBeInTheDocument();
    });
  });

  it('recognizes current page and responds friendly with CURRENT_PAGE_ALREADY without redirecting elsewhere', async () => {
    aiApi.query.mockRejectedValueOnce(new Error('Network offline'));

    render(
      <MemoryRouter initialEntries={['/admin/departments']}>
        <EduMinAiAssistant />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /Mở trợ lý ảo EduMin/i }));

    const input = screen.getByPlaceholderText(/Nhập câu hỏi hoặc yêu cầu điều hướng.../i);
    fireEvent.change(input, { target: { value: 'Làm sao để quản lý khoa đào tạo?' } });

    const submitBtn = screen.getByTitle('Gửi câu hỏi');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/Dạ, hiện tại bạn đang ở ngay trang/i)
      ).toBeInTheDocument();
      expect(screen.getAllByText(/Quản lý khoa đào tạo/i).length).toBeGreaterThan(0);
    });
  });

  it('guides Admin to /admin/gradebook when asking about lock or gradebook management', async () => {
    aiApi.query.mockRejectedValueOnce(new Error('Network offline'));

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <EduMinAiAssistant />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /Mở trợ lý ảo EduMin/i }));

    const input = screen.getByPlaceholderText(/Nhập câu hỏi hoặc yêu cầu điều hướng.../i);
    fireEvent.change(input, { target: { value: 'Làm sao để chốt sổ bảng điểm và khóa điểm?' } });

    const submitBtn = screen.getByTitle('Gửi câu hỏi');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/bạn có thể quản lý bảng điểm toàn trường tại trang/i)
      ).toBeInTheDocument();
    });

    const gradebookBtn = screen.getByRole('button', { name: /Quản lý bảng điểm toàn trường/i });
    expect(gradebookBtn).toBeInTheDocument();
    fireEvent.click(gradebookBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/admin/gradebook');
  });
});
