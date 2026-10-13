import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  EduMinAiAssistant,
  getChatUserStorageKey,
  getChatOpenStorageKey,
} from './EduMinAiAssistant.jsx';

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
    reject: vi.fn(),
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
    sessionStorage.clear();
    mockCurrentUser = { role: 'sinh-vien', hoTen: 'Trần Minh Quân' };
    aiApi.suggestions.mockResolvedValue({
      success: true,
      suggestions: [
        'Làm sao để cấu hình điểm giữa kỳ và Quiz?',
        'Xem lịch giảng dạy hôm nay',
      ],
    });
    profileRequestsApi.approve.mockResolvedValue({ success: true });
    profileRequestsApi.reject.mockResolvedValue({ success: true });
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
      expect(screen.getAllByText('8.4').length).toBeGreaterThan(0);
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

  it('persists chat messages across page transitions and reloads from sessionStorage', async () => {
    mockCurrentUser = { role: 'sinh-vien', hoTen: 'Trần Minh Quân', id: 'student-persist-1' };
    aiApi.query.mockResolvedValueOnce({
      success: true,
      reply: 'Đây là câu trả lời được lưu trữ qua chuyển trang',
      intent: 'NAV_CLASSES',
      quickLinks: [{ label: 'Đến trang Lớp học', path: '/student/classes' }],
    });

    const { unmount } = render(
      <MemoryRouter initialEntries={['/student']}>
        <EduMinAiAssistant forceRender={true} />
      </MemoryRouter>
    );

    // Open chat
    fireEvent.click(screen.getByRole('button', { name: /Mở trợ lý ảo EduMin/i }));

    // Send a message
    const input = screen.getByPlaceholderText(/Nhập câu hỏi hoặc yêu cầu điều hướng.../i);
    fireEvent.change(input, { target: { value: 'Cho mình xem thông tin lớp học' } });
    fireEvent.click(screen.getByTitle('Gửi câu hỏi'));

    await waitFor(() => {
      expect(
        screen.getByText('Đây là câu trả lời được lưu trữ qua chuyển trang')
      ).toBeInTheDocument();
    });

    // Click quick link to simulate direct page navigation
    const linkBtn = screen.getByRole('button', { name: /Đến trang Lớp học/i });
    fireEvent.click(linkBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/student/classes');

    // Unmount and remount (simulating page change / route transition)
    unmount();

    render(
      <MemoryRouter initialEntries={['/student/classes']}>
        <EduMinAiAssistant forceRender={true} />
      </MemoryRouter>
    );

    // Verify messages are retained from sessionStorage without resetting to initial welcome
    await waitFor(() => {
      expect(screen.getByText('Cho mình xem thông tin lớp học')).toBeInTheDocument();
      expect(
        screen.getByText('Đây là câu trả lời được lưu trữ qua chuyển trang')
      ).toBeInTheDocument();
    });
  });

  it('resets chat messages and updates sessionStorage when user clicks clear history', async () => {
    mockCurrentUser = { role: 'sinh-vien', hoTen: 'Trần Minh Quân', id: 'student-persist-2' };
    const storageKey = getChatUserStorageKey(mockCurrentUser);
    sessionStorage.setItem(
      storageKey,
      JSON.stringify([
        { id: 'msg-old', sender: 'user', text: 'Tin nhắn cũ từ phiên trước' },
      ])
    );

    render(
      <MemoryRouter initialEntries={['/student']}>
        <EduMinAiAssistant forceRender={true} />
      </MemoryRouter>
    );

    // Open chat if not open
    const toggleBtn = screen.queryByRole('button', { name: /Mở trợ lý ảo EduMin/i });
    if (toggleBtn) {
      fireEvent.click(toggleBtn);
    }

    expect(screen.getByText('Tin nhắn cũ từ phiên trước')).toBeInTheDocument();

    // Click refresh history
    const resetBtn = screen.getByTitle('Làm mới hội thoại');
    fireEvent.click(resetBtn);

    expect(screen.queryByText('Tin nhắn cũ từ phiên trước')).not.toBeInTheDocument();
    expect(screen.getByText(/Đã làm mới cuộc hội thoại/i)).toBeInTheDocument();

    const storedAfter = JSON.parse(sessionStorage.getItem(storageKey));
    expect(storedAfter[0].text).toContain('Đã làm mới cuộc hội thoại');
  });
});

import { getSmartAiResponse, detectIntent, findStudentByName, BUSINESS_RESERVED_WORDS } from './EduMinAiAssistant.jsx';

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

  it('getSmartAiResponse handles conversational student query for "Quyền Huế Trân"', () => {
    const res = getSmartAiResponse('có thông tin gì về bạn Quyền Huế Trân không ?', 'admin');
    expect(res.matched).toBe(true);
    expect(res.intent).toBe('SEARCH_STUDENT');
    expect(Array.isArray(res.cards)).toBe(true);
    expect(res.cards[0].title).toBe('Quyền Huế Trân');
    expect(res.cards[0].code).toBe('SV-002');
  });

  it('getSmartAiResponse handles conversational teacher query for "thầy Đình"', () => {
    const res = getSmartAiResponse('bạn tìm giùm mình thầy Đình nha', 'admin');
    expect(res.matched).toBe(true);
    expect(res.intent).toBe('SEARCH_TEACHER');
    expect(Array.isArray(res.cards)).toBe(true);
    expect(res.cards[0].title).toBe('Trần Đình');
    expect(res.cards[0].code).toBe('GV-001');
  });

  it('getSmartAiResponse handles raw name query for "Huê Trân" with real-time status and card details', () => {
    const res = getSmartAiResponse('Huê Trân', 'admin');
    expect(res.matched).toBe(true);
    expect(res.intent).toBe('SEARCH_STUDENT');
    expect(Array.isArray(res.cards)).toBe(true);
    expect(res.cards[0].title).toBe('Quyền Huế Trân');
    expect(res.cards[0].code).toBe('SV-002');
    expect(res.cards[0].details.some((d) => d.label === 'Trạng thái' && d.value === 'Đang học')).toBe(true);
  });

  it('getSmartAiResponse resolves on-screen personnel from active pageContext', () => {
    const pageCtx = {
      students: [
        {
          id: 88,
          hoTen: 'Phan Minh Test',
          code: 'SV-088',
          className: '14A2',
          department: 'Khoa Ngoại Ngữ',
          education: 'Chính quy',
          email: 'test.phan@edu.vn',
          status: 'Đang học',
        },
      ],
    };
    const res = getSmartAiResponse('tìm Phan Minh Test', 'admin', null, '/admin/students', pageCtx);
    expect(res.matched).toBe(true);
    expect(res.intent).toBe('SEARCH_STUDENT');
    expect(res.cards[0].title).toBe('Phan Minh Test');
    expect(res.cards[0].code).toBe('SV-088');
  });

  it('getSmartAiResponse handles conversational student grade query for "cho mình xem tình hình điểm của em Trân được không?" with full in-chat summary and cards', () => {
    const res = getSmartAiResponse('cho mình xem tình hình điểm của em Trân được không?', 'admin');
    expect(res.matched).toBe(true);
    expect(res.intent).toBe('SEARCH_STUDENT_GRADES');
    expect(res.reply).toContain('Quyền Huế Trân');
    expect(res.reply).toContain('Chuyên cần');
    expect(res.reply).toContain('Bài tập');
    expect(res.reply).toContain('Giữa kỳ');
    expect(res.reply).toContain('Cuối kỳ');
    expect(res.reply).toContain('Điểm tổng kết (GPA)');
    expect(res.reply).toContain('Trạng thái');

    expect(Array.isArray(res.cards)).toBe(true);
    expect(res.cards.length).toBeGreaterThan(0);
    expect(res.cards[0].type).toBe('grade');
    expect(res.cards[0].subtitle).toContain('Quyền Huế Trân');
    expect(res.cards[0].details.some((d) => d.label === 'Chuyên cần')).toBe(true);
    expect(res.cards[0].details.some((d) => d.label === 'Bài tập')).toBe(true);
    expect(res.cards[0].details.some((d) => d.label === 'Giữa kỳ')).toBe(true);
    expect(res.cards[0].details.some((d) => d.label === 'Cuối kỳ')).toBe(true);
    expect(res.cards[0].details.some((d) => d.label === 'Điểm tổng kết (GPA)')).toBe(true);
    expect(res.cards[0].details.some((d) => d.label === 'Trạng thái')).toBe(true);
  });

  it('getSmartAiResponse handles conversational student grade query by code "bạn ơi cho mình xin kết quả học tập của SV-002 với nha"', () => {
    const res = getSmartAiResponse('bạn ơi cho mình xin kết quả học tập của SV-002 với nha', 'admin');
    expect(res.matched).toBe(true);
    expect(res.intent).toBe('SEARCH_STUDENT_GRADES');
    expect(res.reply).toContain('SV-002');
    expect(res.cards[0].subtitle).toContain('SV-002');
  });

  it('getSmartAiResponse resolves on-screen student grades from active pageContext', () => {
    const pageCtx = {
      currentClass: { id: 'ENG201-01', courseName: 'Tiếng Anh Thương Mại' },
      students: [
        {
          id: 77,
          hoTen: 'Đặng Gia Huy',
          code: 'SV-077',
          attendance: 10,
          homework: 9.5,
          midterm: 9.0,
          final: 9.2,
          finalScore: 9.3,
          status: 'Đạt',
        },
      ],
    };
    const res = getSmartAiResponse('xem điểm của bạn Đặng Gia Huy', 'admin', null, '/admin/gradebook', pageCtx);
    expect(res.matched).toBe(true);
    expect(res.intent).toBe('SEARCH_STUDENT_GRADES');
    expect(res.reply).toContain('Đặng Gia Huy');
    expect(res.cards[0].title).toBe('Tiếng Anh Thương Mại');
    expect(res.cards[0].details.find((d) => d.label === 'Điểm tổng kết (GPA)').value).toBe('9.3');
  });

  it('getSmartAiResponse handles natural grade filtering and sorting query "lọc cho mình những môn có điểm cao nhất đi"', () => {
    const res = getSmartAiResponse('lọc cho mình những môn có điểm cao nhất đi', 'sinh-vien');
    expect(res.matched).toBe(true);
    expect(res.intent).toBe('FILTER_SORT_GRADES');
    expect(res.actionTrigger).toBeDefined();
    expect(res.actionTrigger.action).toBe('filter_grades');
    expect(res.actionTrigger.direction).toBe('desc');
    expect(res.reply).toContain('| STT | Mã HP | Tên học phần |');
    expect(res.reply).toContain('GPA');
    expect(Array.isArray(res.suggestions)).toBe(true);
  });

  it('getSmartAiResponse handles course grades summary "xem điểm các môn"', () => {
    const res = getSmartAiResponse('xem điểm các môn', 'sinh-vien');
    expect(res.matched).toBe(true);
    expect(res.intent).toBe('COURSE_GRADES_SUMMARY');
    expect(res.reply).toContain('| STT | Mã HP | Tên học phần |');
    expect(res.reply).toContain('GPA');
    expect(res.quickLinks).toBeDefined();
  });

  it('getSmartAiResponse handles tuition inquiry "học phí của tôi"', () => {
    const res = getSmartAiResponse('học phí của tôi', 'sinh-vien');
    expect(res.matched).toBe(true);
    expect(res.intent).toBe('TUITION_INQUIRY');
    expect(res.reply).toContain('| Khoản mục |');
    expect(res.reply).toContain('Học phí');
    expect(res.reply).toContain('Đã thanh toán');
  });

  it('getSmartAiResponse handles personnel search "tìm bạn Huê Trân" without matching full sentence string', () => {
    const res = getSmartAiResponse('tìm bạn Huê Trân', 'admin');
    expect(res.matched).toBe(true);
    expect(res.intent).toBe('SEARCH_STUDENT');
    expect(Array.isArray(res.cards)).toBe(true);
    expect(res.cards[0].title).toBe('Quyền Huế Trân');
    expect(res.cards[0].type).toBe('student');
  });

  it('handles Teacher grade entry query and renders grade_input card with locate and navigate actions', async () => {
    mockCurrentUser = { role: 'giao-vien', hoTen: 'Giảng viên' };
    aiApi.query.mockRejectedValueOnce(new Error('Network offline'));

    render(
      <MemoryRouter initialEntries={['/teacher/classes']}>
        <EduMinAiAssistant forceRender={true} />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /Mở trợ lý ảo EduMin/i }));

    const input = screen.getByPlaceholderText(/Nhập câu hỏi hoặc yêu cầu điều hướng.../i);
    fireEvent.change(input, { target: { value: 'vào điểm cho em Trân' } });
    fireEvent.click(screen.getByTitle('Gửi câu hỏi'));

    await waitFor(() => {
      expect(screen.getAllByText('Quyền Huế Trân').length).toBeGreaterThan(0);
      expect(screen.getByRole('button', { name: /📝 Vào điểm ngay/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /🎯 Định vị trên bảng điểm/i })).toBeInTheDocument();
    });

    const enterBtn = screen.getByRole('button', { name: /📝 Vào điểm ngay/i });
    fireEvent.click(enterBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/teacher/classes');
  });

  it('handles Admin profile request rejection directly in chat', async () => {
    mockCurrentUser = { role: 'dao-tao', hoTen: 'Admin' };
    aiApi.query.mockRejectedValueOnce(new Error('Network offline'));

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <EduMinAiAssistant forceRender={true} />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /Mở trợ lý ảo EduMin/i }));

    const input = screen.getByPlaceholderText(/Nhập câu hỏi hoặc yêu cầu điều hướng.../i);
    fireEvent.change(input, { target: { value: 'có hồ sơ nào chờ duyệt không?' } });
    fireEvent.click(screen.getByTitle('Gửi câu hỏi'));

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /✗ Từ chối/i }).length).toBeGreaterThan(0);
    });

    const rejectBtn = screen.getAllByRole('button', { name: /✗ Từ chối/i })[0];
    fireEvent.click(rejectBtn);

    expect(profileRequestsApi.reject).toHaveBeenCalledWith('req-001', expect.any(String));

    await waitFor(() => {
      expect(screen.getAllByText(/Đã từ chối yêu cầu/i).length).toBeGreaterThan(0);
    });
  });

  it('handles Student regulation guide inquiry', () => {
    const res = getSmartAiResponse('quy chế cấm thi thế nào?', 'sinh-vien');
    expect(res.matched).toBe(true);
    expect(res.intent).toBe('STUDENT_REGULATION_GUIDE');
    expect(res.reply).toContain('20%');
    expect(res.reply).toContain('Thang điểm');
    expect(res.reply).toContain('25 tín chỉ');
    expect(res.reply).toContain('7 ngày');
  });

  it('handles Student homework & quiz guide inquiry', () => {
    const res = getSmartAiResponse('hướng dẫn làm bài tập quiz', 'sinh-vien');
    expect(res.matched).toBe(true);
    expect(res.intent).toBe('STUDENT_HOMEWORK_GUIDE');
    expect(res.reply).toContain('Bài tập & Quiz');
    expect(res.reply).toContain('Nộp bài');
  });

  it('handles Class lookup inquiry with class card details and actions', () => {
    const res = getSmartAiResponse('danh sách lớp Tiếng Anh 1', 'giao-vien');
    expect(res.matched).toBe(true);
    expect(res.intent).toBe('QUERY_CLASS');
    expect(Array.isArray(res.cards)).toBe(true);
    expect(res.cards[0].code).toBe('Lớp ENG101-01');
    expect(res.cards[0].details.some((d) => d.label === 'Giảng viên')).toBe(true);
  });

  it('detects intents correctly via detectIntent and guards operational queries from student lookup in frontend', () => {
    expect(detectIntent('nhập lại điểm Quiz')).toBe('GRADE_MANAGEMENT');
    expect(detectIntent('cấu hình quiz')).toBe('GRADE_MANAGEMENT');
    expect(detectIntent('bảng điểm các môn')).toBe('GRADE_MANAGEMENT');
    expect(detectIntent('duyệt hồ sơ')).toBe('ADMIN_APPROVAL');
    expect(detectIntent('có yêu cầu thay đổi nào cần duyệt không?')).toBe('ADMIN_APPROVAL');
    expect(detectIntent('tìm giảng viên')).toBe('TEACHER_SEARCH');
    expect(detectIntent('thông tin thầy Đình')).toBe('TEACHER_SEARCH');
    expect(detectIntent('tìm sinh viên Nguyễn Văn An')).toBe('STUDENT_SEARCH');
    expect(detectIntent('tìm bạn Huê Trân')).toBe('STUDENT_SEARCH');
    expect(detectIntent('thời tiết hôm nay ra sao?')).toBe('GENERAL_FALLBACK');
  });

  it('safely guards findStudentByName against business reserved words in frontend', () => {
    expect(findStudentByName('nhập lại điểm Quiz')).toBeNull();
    expect(findStudentByName('duyệt hồ sơ')).toBeNull();
    expect(findStudentByName('tìm giảng viên')).toBeNull();
    expect(findStudentByName('giảng viên')).toBeNull();
    expect(findStudentByName('quiz')).toBeNull();
    expect(findStudentByName('')).toBeNull();

    // Valid student search
    const found = findStudentByName('Huê Trân');
    expect(found).not.toBeNull();
    expect(found.hoTen).toBe('Quyền Huế Trân');
  });

  it('handles "nhập lại điểm Quiz" routing to NAV_GRADE_CONFIG without student lookup error in frontend', () => {
    const res = getSmartAiResponse('nhập lại điểm Quiz', 'giao-vien');
    expect(res.matched).toBe(true);
    expect(res.intent).toBe('NAV_GRADE_CONFIG');
    expect(res.reply).not.toContain('Không tìm thấy sinh viên');
  });

  it('handles "tìm giảng viên" routing to NAV_TEACHERS without returning empty error in frontend', () => {
    const res = getSmartAiResponse('tìm giảng viên', 'dao-tao');
    expect(res.matched).toBe(true);
    expect(res.intent).toBe('NAV_TEACHERS');
    expect(res.reply).not.toContain('Không tìm thấy');
    expect(res.quickLinks[0].path).toBe('/admin/teachers');
  });

  it('handles "duyệt hồ sơ" routing to NAV_PROFILE_REQUESTS without student lookup error in frontend', () => {
    const res = getSmartAiResponse('duyệt hồ sơ', 'dao-tao');
    expect(res.matched).toBe(true);
    expect(res.intent).toBe('NAV_PROFILE_REQUESTS');
    expect(res.reply).not.toContain('Không tìm thấy sinh viên');
  });

  it('detects role intelligence intents correctly in frontend detectIntent', () => {
    expect(detectIntent('tiêu chuẩn duyệt: CCCD 12 số, SĐT 10 số')).toBe('ADMIN_SET_CRITERIA');
    expect(detectIntent('duyệt hồ sơ theo tiêu chuẩn')).toBe('ADMIN_APPLY_CRITERIA_APPROVAL');
    expect(detectIntent('cho tôi xem ý kiến người dùng')).toBe('ADMIN_VIEW_USER_DESIRES');
    expect(detectIntent('em muốn mở thêm lớp học phần')).toBe('RECORD_USER_DESIRE');
    expect(detectIntent('tính điểm cho sinh viên dựa vào quiz và chuyên cần')).toBe('TEACHER_CALCULATE_GRADES');
    expect(detectIntent('báo cáo tình hình học tập sau khi được giảng viên đánh giá')).toBe('STUDENT_ACADEMIC_REPORT');
  });

  it('handles Admin setting criteria via prompt in getSmartAiResponse', () => {
    const res = getSmartAiResponse('tiêu chuẩn duyệt: CCCD 12 số, SĐT 10 số, lý do rõ ràng', 'dao-tao');
    expect(res.matched).toBe(true);
    expect(res.intent).toBe('ADMIN_SET_CRITERIA');
    expect(res.reply).toContain('tiêu chuẩn');
    expect(res.reply).toContain('CCCD');
    expect(res.quickLinks.some((l) => l.path === '/admin/profile-requests')).toBe(true);
  });

  it('handles Admin applying criteria approval via prompt in getSmartAiResponse', () => {
    const res = getSmartAiResponse('duyệt hồ sơ theo tiêu chuẩn', 'dao-tao');
    expect(res.matched).toBe(true);
    expect(res.intent).toBe('ADMIN_APPLY_CRITERIA_APPROVAL');
    expect(res.reply).toContain('tiêu chuẩn');
    expect(Array.isArray(res.cards)).toBe(true);
  });

  it('handles Admin viewing user desires via prompt in getSmartAiResponse', () => {
    const res = getSmartAiResponse('cho tôi xem ý kiến người dùng và mong muốn sinh viên', 'dao-tao');
    expect(res.matched).toBe(true);
    expect(res.intent).toBe('ADMIN_VIEW_USER_DESIRES');
    expect(res.reply).toContain('Nguyện vọng');
  });

  it('records user desire via prompt in getSmartAiResponse', () => {
    const res = getSmartAiResponse('em muốn mở thêm lớp tiếng Anh giao tiếp buổi tối', 'sinh-vien');
    expect(res.matched).toBe(true);
    expect(res.intent).toBe('RECORD_USER_DESIRE');
    expect(res.reply).toContain('ghi nhận');
  });

  it('calculates grades for Teacher based on quiz and attendance via prompt in getSmartAiResponse', () => {
    const res = getSmartAiResponse('tính điểm cho sinh viên dựa vào quiz và chuyên cần', 'giao-vien');
    expect(res.matched).toBe(true);
    expect(res.intent).toBe('TEACHER_CALCULATE_GRADES');
    expect(res.reply).toContain('Công thức');
    expect(res.reply).toContain('Chuyên cần');
    expect(res.reply).toContain('Quiz');
    expect(res.quickLinks.some((l) => l.path === '/teacher/classes')).toBe(true);
  });

  it('generates academic report for Student after teacher evaluation in getSmartAiResponse', () => {
    const res = getSmartAiResponse('báo cáo tình hình học tập sau khi được giảng viên đánh giá', 'sinh-vien');
    expect(res.matched).toBe(true);
    expect(res.intent).toBe('STUDENT_ACADEMIC_REPORT');
    expect(res.reply).toContain('BÁO CÁO TÌNH HÌNH HỌC TẬP');
    expect(res.reply).toContain('Điểm trung bình tích lũy');
    expect(res.reply).toContain('Đánh giá của Giảng viên');
  });
});


