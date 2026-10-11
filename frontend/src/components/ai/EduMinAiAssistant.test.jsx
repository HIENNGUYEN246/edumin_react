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

import { ROLES } from '../../app/navConfig.js';

let mockCurrentUser = { role: 'sinh-vien', hoTen: 'Trần Minh Quân' };

vi.mock('../../app/providers/AuthProvider.jsx', () => ({
  useAuth: () => ({
    user: mockCurrentUser,
    profile: mockCurrentUser,
  }),
}));

vi.mock('../../api/aiApi.js', () => ({
  aiApi: {
    query: vi.fn(),
    suggestions: vi.fn(),
  },
}));

vi.mock('../../api/profileRequestsApi.js', () => ({
  profileRequestsApi: {
    approve: vi.fn(),
  },
}));

vi.mock('../../api/feedbackApi.js', () => ({
  feedbackApi: {
    respond: vi.fn(),
  },
}));

import { aiApi } from '../../api/aiApi.js';
import { profileRequestsApi } from '../../api/profileRequestsApi.js';
import { feedbackApi } from '../../api/feedbackApi.js';

describe('EduMinAiAssistant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentUser = { role: 'sinh-vien', hoTen: 'Trần Minh Quân' };
    aiApi.suggestions.mockResolvedValue({
      success: true,
      suggestions: [
        'Làm sao để cấu hình điểm giữa kỳ và Quiz?',
        'Xem lịch giảng dạy hôm nay',
      ],
    });
    profileRequestsApi.approve.mockResolvedValue({ success: true });
    feedbackApi.respond.mockResolvedValue({ success: true });
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
    mockCurrentUser = { role: 'giao-vien', hoTen: 'Trần Minh Quân' };
    // When apiResult is null/offline, tests verify getSmartAiResponse disambiguation
    aiApi.query.mockRejectedValueOnce(new Error('Network offline'));

    render(
      <MemoryRouter>
        <EduMinAiAssistant forceRender={true} />
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
        <EduMinAiAssistant forceRender={true} />
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
      expect(screen.getAllByText(/Quản lý khoa/i).length).toBeGreaterThan(0);
    });
  });

  it('guides Admin to /admin/gradebook when asking about lock or gradebook management', async () => {
    mockCurrentUser = { role: 'dao-tao', hoTen: 'Phòng Đào Tạo' };
    aiApi.query.mockRejectedValueOnce(new Error('Network offline'));

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <EduMinAiAssistant forceRender={true} />
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

    const gradebookBtn = screen.getByRole('button', { name: /Quản lý bảng điểm/i });
    expect(gradebookBtn).toBeInTheDocument();
    fireEvent.click(gradebookBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/admin/gradebook');
  });

  it('guides Admin directly to /admin/gradebook when asked about "bảng điểm" or "xem điểm" without being out of scope', async () => {
    mockCurrentUser = { role: 'dao-tao', hoTen: 'Phòng Đào Tạo' };
    aiApi.query.mockRejectedValueOnce(new Error('Network offline'));

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <EduMinAiAssistant forceRender={true} />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /Mở trợ lý ảo EduMin/i }));

    const input = screen.getByPlaceholderText(/Nhập câu hỏi hoặc yêu cầu điều hướng.../i);
    fireEvent.change(input, { target: { value: 'Cho tôi xem bảng điểm' } });

    const submitBtn = screen.getByTitle('Gửi câu hỏi');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(
        screen.getAllByText(/Quản lý bảng điểm/i).length
      ).toBeGreaterThan(0);
      expect(
        screen.queryByText(/chưa hỗ trợ tính năng này/i)
      ).not.toBeInTheDocument();
    });

    const gradebookBtn = screen.getByRole('button', { name: /^Quản lý bảng điểm$/i });
    expect(gradebookBtn).toBeInTheDocument();
    fireEvent.click(gradebookBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/admin/gradebook');
  });

  it('renders student search card with MSSV and navigation for "Tìm sinh viên Nguyễn Văn An"', async () => {
    mockCurrentUser = { role: 'dao-tao', hoTen: 'Admin' };
    aiApi.query.mockRejectedValueOnce(new Error('Network offline'));

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <EduMinAiAssistant forceRender={true} />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /Mở trợ lý ảo EduMin/i }));

    const input = screen.getByPlaceholderText(/Nhập câu hỏi hoặc yêu cầu điều hướng.../i);
    fireEvent.change(input, { target: { value: 'Tìm sinh viên Nguyễn Văn An' } });
    fireEvent.click(screen.getByTitle('Gửi câu hỏi'));

    await waitFor(() => {
      expect(screen.getAllByText('SV-001').length).toBeGreaterThan(0);
      expect(screen.getByText(/an\.nguyen@edu\.vn/i)).toBeInTheDocument();
    });

    const detailBtn = screen.getByRole('button', { name: /Xem chi tiết/i });
    fireEvent.click(detailBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/admin/students');
  });

  it('renders class filter card with Room and Lecturer for "Lọc lớp CNTT"', async () => {
    mockCurrentUser = { role: 'dao-tao', hoTen: 'Admin' };
    aiApi.query.mockRejectedValueOnce(new Error('Network offline'));

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <EduMinAiAssistant forceRender={true} />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /Mở trợ lý ảo EduMin/i }));

    const input = screen.getByPlaceholderText(/Nhập câu hỏi hoặc yêu cầu điều hướng.../i);
    fireEvent.change(input, { target: { value: 'Lọc lớp CNTT' } });
    fireEvent.click(screen.getByTitle('Gửi câu hỏi'));

    await waitFor(() => {
      expect(screen.getByText('Mã lớp: IT101-01')).toBeInTheDocument();
      expect(screen.getByText(/ThS\. Trần Minh Quân/i)).toBeInTheDocument();
      expect(screen.getByText('B2-301')).toBeInTheDocument();
    });

    const detailBtn = screen.getByRole('button', { name: /Xem chi tiết/i });
    fireEvent.click(detailBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/admin/classes');
  });

  it('renders student grade card with GPA details for "Xem điểm của sinh viên Nguyễn Văn An"', async () => {
    mockCurrentUser = { role: 'dao-tao', hoTen: 'Admin' };
    aiApi.query.mockRejectedValueOnce(new Error('Network offline'));

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <EduMinAiAssistant forceRender={true} />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /Mở trợ lý ảo EduMin/i }));

    const input = screen.getByPlaceholderText(/Nhập câu hỏi hoặc yêu cầu điều hướng.../i);
    fireEvent.change(input, { target: { value: 'Xem điểm của sinh viên Nguyễn Văn An' } });
    fireEvent.click(screen.getByTitle('Gửi câu hỏi'));

    await waitFor(() => {
      expect(screen.getByText('Lớp IT101-01')).toBeInTheDocument();
      expect(screen.getByText('8.4')).toBeInTheDocument();
    });

    const detailBtn = screen.getByRole('button', { name: /Xem chi tiết/i });
    fireEvent.click(detailBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/admin/gradebook');
  });

  it('supports quick approval action directly in chat for profile requests', async () => {
    mockCurrentUser = { role: 'dao-tao', hoTen: 'Admin' };
    aiApi.query.mockRejectedValueOnce(new Error('Network offline'));

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <EduMinAiAssistant forceRender={true} />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /Mở trợ lý ảo EduMin/i }));

    const input = screen.getByPlaceholderText(/Nhập câu hỏi hoặc yêu cầu điều hướng.../i);
    fireEvent.change(input, { target: { value: 'Có yêu cầu nào mới không?' } });
    fireEvent.click(screen.getByTitle('Gửi câu hỏi'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Xác nhận duyệt nhanh/i })).toBeInTheDocument();
    });

    const approveBtn = screen.getByRole('button', { name: /Xác nhận duyệt nhanh/i });
    fireEvent.click(approveBtn);

    expect(profileRequestsApi.approve).toHaveBeenCalledWith('req-001');

    await waitFor(() => {
      expect(screen.getByText(/Đã phê duyệt thành công/i)).toBeInTheDocument();
    });
  });

  it('supports quick template response directly in chat for student feedback', async () => {
    mockCurrentUser = { role: 'dao-tao', hoTen: 'Admin' };
    aiApi.query.mockRejectedValueOnce(new Error('Network offline'));

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <EduMinAiAssistant forceRender={true} />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /Mở trợ lý ảo EduMin/i }));

    const input = screen.getByPlaceholderText(/Nhập câu hỏi hoặc yêu cầu điều hướng.../i);
    fireEvent.change(input, { target: { value: 'Xem ý kiến phản hồi chưa đọc' } });
    fireEvent.click(screen.getByTitle('Gửi câu hỏi'));

    await waitFor(() => {
      expect(screen.getByText(/Thầy dạy rất nhiệt tình/i)).toBeInTheDocument();
      expect(screen.getByText(/Cảm ơn bạn đã đóng góp ý kiến/i)).toBeInTheDocument();
    });

    const templateBtn = screen.getByText(/Cảm ơn bạn đã đóng góp ý kiến/i);
    fireEvent.click(templateBtn);

    expect(feedbackApi.respond).toHaveBeenCalledWith(
      'fb-001',
      expect.stringContaining('Cảm ơn bạn đã đóng góp ý kiến')
    );

    await waitFor(() => {
      expect(screen.getByText(/Đã phản hồi ý kiến/i)).toBeInTheDocument();
    });
  });

  it('displays fallback suggestion chips for unrecognized admin queries and allows clicking them', async () => {
    mockCurrentUser = { role: 'dao-tao', hoTen: 'Admin' };
    aiApi.query.mockRejectedValueOnce(new Error('Network offline'));

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <EduMinAiAssistant forceRender={true} />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /Mở trợ lý ảo EduMin/i }));

    const input = screen.getByPlaceholderText(/Nhập câu hỏi hoặc yêu cầu điều hướng.../i);
    fireEvent.change(input, { target: { value: 'yêu cầu lạ hoắc không xác định' } });
    fireEvent.click(screen.getByTitle('Gửi câu hỏi'));

    await waitFor(() => {
      expect(screen.getByText(/tôi chưa tìm thấy kết quả chính xác cho câu hỏi này/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Lọc lớp CNTT' })).toBeInTheDocument();
    });

    // Clicking the suggestion chip triggers that intent
    aiApi.query.mockRejectedValueOnce(new Error('Network offline'));
    fireEvent.click(screen.getByRole('button', { name: 'Lọc lớp CNTT' }));

    await waitFor(() => {
      expect(screen.getByText('Mã lớp: IT101-01')).toBeInTheDocument();
    });
  });
});

import { getSmartAiResponse } from './EduMinAiAssistant.jsx';

describe('getSmartAiResponse - Comprehensive Admin Menu & Intent Matcher', () => {
  it('correctly maps "bảng điểm", "xem điểm", "sổ điểm" to NAV_ADMIN_GRADEBOOK for admin without out-of-scope rejection', () => {
    const queries = ['bảng điểm', 'xem điểm', 'cho tôi xem điểm', 'sổ điểm', 'tra cứu điểm', 'quản lý bảng điểm'];
    for (const q of queries) {
      const res = getSmartAiResponse(q, 'dao-tao', null, '/admin');
      expect(res.intent).toBe('NAV_ADMIN_GRADEBOOK');
      expect(res.matched).toBe(true);
      expect(res.quickLinks.some((l) => l.path === '/admin/gradebook')).toBe(true);
      expect(res.quickLinks.some((l) => l.label === 'Quản lý bảng điểm')).toBe(true);
      expect(res.reply).not.toContain('chưa hỗ trợ');
    }
  });

  it('correctly maps all 11 Admin interface menu items without out-of-scope false rejection', () => {
    const testCases = [
      { q: 'Xem tổng quan hệ thống', expectedIntent: 'NAV_DASHBOARD', expectedPath: '/admin' },
      { q: 'Quản lý khoa đào tạo', expectedIntent: 'NAV_DEPARTMENTS', expectedPath: '/admin/departments' },
      { q: 'Xem danh sách các khoa', expectedIntent: 'NAV_DEPARTMENTS', expectedPath: '/admin/departments' },
      { q: 'Quản lý môn học và học phần', expectedIntent: 'NAV_COURSES', expectedPath: '/admin/courses' },
      { q: 'Danh mục học phần tín chỉ', expectedIntent: 'NAV_COURSES', expectedPath: '/admin/courses' },
      { q: 'Quản lý lớp học phần', expectedIntent: 'NAV_CLASSES', expectedPath: '/admin/classes' },
      { q: 'Mở lớp học phần mới', expectedIntent: 'NAV_CLASSES', expectedPath: '/admin/classes' },
      { q: 'Quản lý giáo viên', expectedIntent: 'NAV_TEACHERS', expectedPath: '/admin/teachers' },
      { q: 'Quản lý tài khoản giáo viên', expectedIntent: 'NAV_TEACHER_ACCOUNTS', expectedPath: '/admin/teacher-accounts' },
      { q: 'Quản lý sinh viên toàn trường', expectedIntent: 'NAV_STUDENTS', expectedPath: '/admin/students' },
      { q: 'Quản lý tài khoản sinh viên', expectedIntent: 'NAV_STUDENT_ACCOUNTS', expectedPath: '/admin/student-accounts' },
      { q: 'Ý kiến và phản hồi từ sinh viên', expectedIntent: 'NAV_FEEDBACK', expectedPath: '/admin/feedbacks' },
      { q: 'Duyệt yêu cầu cập nhật hồ sơ', expectedIntent: 'NAV_PROFILE_REQUESTS', expectedPath: '/admin/profile-requests' },
      { q: 'Bảng điểm toàn trường', expectedIntent: 'NAV_ADMIN_GRADEBOOK', expectedPath: '/admin/gradebook' },
    ];

    for (const tc of testCases) {
      const res = getSmartAiResponse(tc.q, 'dao-tao', null, '');
      expect(res.intent, `Failed for query: "${tc.q}"`).toBe(tc.expectedIntent);
      expect(res.matched, `Should match for query: "${tc.q}"`).toBe(true);
      expect(res.quickLinks.some((l) => l.path === tc.expectedPath), `Missing path ${tc.expectedPath} for "${tc.q}"`).toBe(true);
      expect(res.reply).not.toContain('chưa hỗ trợ');
    }
  });

  it('keeps genuine out-of-scope requests (ký túc xá, căn tin, xe buýt) as OUT_OF_SCOPE', () => {
    const outQueries = [
      'Đăng ký ký túc xá ở đâu?',
      'Căn tin hôm nay bán món gì?',
      'Tuyến xe buýt đi qua trường',
      'Thẻ mượn sách thư viện',
    ];
    for (const q of outQueries) {
      const res = getSmartAiResponse(q, 'dao-tao', null, '/admin');
      expect(res.intent).toBe('OUT_OF_SCOPE');
      expect(res.reply).toContain('chưa hỗ trợ');
    }
  });

  it('supports docking mode and dispatches edumin_ai_layout_change event', async () => {
    mockCurrentUser = { role: 'sinh-vien', hoTen: 'Nguyễn Văn An' };
    const layoutEventListener = vi.fn();
    window.addEventListener('edumin_ai_layout_change', layoutEventListener);

    render(
      <MemoryRouter>
        <EduMinAiAssistant />
      </MemoryRouter>
    );

    // Open chat
    fireEvent.click(screen.getByRole('button', { name: /Mở trợ lý ảo EduMin/i }));

    const dockBtn = screen.getByTitle(/Ghim bên phải/i);
    expect(dockBtn).toBeInTheDocument();

    fireEvent.click(dockBtn);

    await waitFor(() => {
      const dialog = screen.getByRole('dialog', { name: /EduMin AI Assistant/i });
      expect(dialog.className).toContain('fixed top-16 right-0 bottom-0');
    });

    expect(layoutEventListener).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: { isDocked: true, isOpen: true },
      })
    );

    window.removeEventListener('edumin_ai_layout_change', layoutEventListener);
  });

  it('supports toggling translucent see-through mode and flipping position left/right', async () => {
    mockCurrentUser = { role: 'sinh-vien', hoTen: 'Nguyễn Văn An' };
    render(
      <MemoryRouter>
        <EduMinAiAssistant />
      </MemoryRouter>
    );

    // Open chat
    fireEvent.click(screen.getByRole('button', { name: /Mở trợ lý ảo EduMin/i }));
    const dialog = screen.getByRole('dialog', { name: /EduMin AI Assistant/i });

    // Test Translucent Mode
    const translucentBtn = screen.getByTitle(/Bật chế độ mờ xuyên thấu/i);
    fireEvent.click(translucentBtn);
    await waitFor(() => {
      expect(dialog.className).toContain('opacity-40');
    });

    // Test Flip Side
    const flipBtn = screen.getByTitle(/Chuyển sang góc trái màn hình/i);
    fireEvent.click(flipBtn);
    await waitFor(() => {
      expect(dialog.className).toContain('left-4 sm:left-6');
    });
  });
});

describe('Role-based rendering authorization for EduMinAiAssistant', () => {
  it('renders EduMin AI Assistant for Student role (sinh-vien)', () => {
    mockCurrentUser = { role: 'sinh-vien', hoTen: 'Nguyễn Văn An' };
    render(
      <MemoryRouter>
        <EduMinAiAssistant />
      </MemoryRouter>
    );
    expect(screen.getByRole('button', { name: /Mở trợ lý ảo EduMin/i })).toBeInTheDocument();
  });

  it('renders EduMin AI Assistant for Student role (ROLES.STUDENT)', () => {
    mockCurrentUser = { role: ROLES.STUDENT, hoTen: 'Nguyễn Văn An' };
    render(
      <MemoryRouter>
        <EduMinAiAssistant />
      </MemoryRouter>
    );
    expect(screen.getByRole('button', { name: /Mở trợ lý ảo EduMin/i })).toBeInTheDocument();
  });

  it('renders EduMin AI Assistant for Admin role (dao-tao)', () => {
    mockCurrentUser = { role: 'dao-tao', hoTen: 'Quản trị viên' };
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <EduMinAiAssistant />
      </MemoryRouter>
    );
    expect(screen.getByRole('button', { name: /Mở trợ lý ảo EduMin/i })).toBeInTheDocument();
  });

  it('renders EduMin AI Assistant for Teacher role (giao-vien)', () => {
    mockCurrentUser = { role: 'giao-vien', hoTen: 'Trần Minh Quân' };
    render(
      <MemoryRouter initialEntries={['/teacher']}>
        <EduMinAiAssistant />
      </MemoryRouter>
    );
    expect(screen.getByRole('button', { name: /Mở trợ lý ảo EduMin/i })).toBeInTheDocument();
  });

  it('renders EduMin AI Assistant for Student role (student)', () => {
    mockCurrentUser = { role: 'student', hoTen: 'Nguyễn Văn An' };
    render(
      <MemoryRouter initialEntries={['/student']}>
        <EduMinAiAssistant />
      </MemoryRouter>
    );
    expect(screen.getByRole('button', { name: /Mở trợ lý ảo EduMin/i })).toBeInTheDocument();
  });

  it('renders EduMin AI Assistant on student path (/student/attendance)', () => {
    mockCurrentUser = { role: 'STUDENT', hoTen: 'Nguyễn Văn An' };
    render(
      <MemoryRouter initialEntries={['/student/attendance']}>
        <EduMinAiAssistant />
      </MemoryRouter>
    );
    expect(screen.getByRole('button', { name: /Mở trợ lý ảo EduMin/i })).toBeInTheDocument();
  });

  it('does NOT render EduMin AI Assistant when unauthenticated on /login', () => {
    mockCurrentUser = null;
    const { container } = render(
      <MemoryRouter initialEntries={['/login']}>
        <EduMinAiAssistant />
      </MemoryRouter>
    );
    expect(screen.queryByRole('button', { name: /Mở trợ lý ảo EduMin/i })).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });
});

