import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InternalMessagingPanel } from './InternalMessagingPanel.jsx';
import { chatApi } from '../../api/chatApi.js';

vi.mock('../../api/chatApi.js', () => ({
  chatApi: {
    getChannels: vi.fn(),
    getContacts: vi.fn(),
    getMessages: vi.fn(),
    sendMessage: vi.fn(),
  },
}));

let mockUser = {
  _id: 'user-admin-1',
  id: 'user-admin-1',
  role: 'dao-tao',
  hoTen: 'Admin Đào Tạo',
  email: 'admin@edumin.edu.vn',
};

vi.mock('../../app/providers/AuthProvider.jsx', () => ({
  useAuth: () => ({
    user: mockUser,
  }),
}));

const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
};

vi.mock('../../app/providers/ToastProvider.jsx', () => ({
  useToast: () => mockToast,
}));

function renderWithClient(ui) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}

describe('InternalMessagingPanel', () => {
  const mockClassGroups = [
    {
      classId: 'INT101-01',
      courseName: 'Lập trình Cơ bản C++',
      courseCode: 'INT101',
      teacher: 'ThS. Nguyễn Văn A',
      studentCount: 45,
      unreadCount: 2,
      lastMessage: {
        content: 'Chào cả lớp, tuần sau nộp bài tập lớn nhé!',
        createdAt: '2026-11-03T08:00:00Z',
        senderName: 'ThS. Nguyễn Văn A',
        isOwn: false,
      },
    },
    {
      classId: 'WEB202-02',
      courseName: 'Phát triển Ứng dụng Web',
      courseCode: 'WEB202',
      teacher: 'TS. Trần Thị B',
      studentCount: 38,
      unreadCount: 0,
      lastMessage: {
        content: 'Lớp đổi sang phòng LAB-302',
        createdAt: '2026-11-02T10:00:00Z',
        senderName: 'Admin',
        isOwn: true,
      },
    },
  ];

  const mockDirectConversations = [
    {
      partnerId: 'teacher-1',
      name: 'TS. Trần Thị B',
      role: 'giao-vien',
      email: 'ttb@edumin.edu.vn',
      avatar: '',
      unreadCount: 1,
      lastMessage: {
        content: 'Em đã nộp bảng điểm lớp WEB202 rồi ạ.',
        createdAt: '2026-11-03T07:30:00Z',
        isOwn: false,
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = {
      _id: 'user-admin-1',
      id: 'user-admin-1',
      role: 'dao-tao',
      hoTen: 'Admin Đào Tạo',
      email: 'admin@edumin.edu.vn',
    };

    chatApi.getChannels.mockResolvedValue({
      success: true,
      classGroups: mockClassGroups,
      directConversations: mockDirectConversations,
      totalUnread: 3,
    });

    chatApi.getMessages.mockResolvedValue({
      success: true,
      data: {
        classInfo: mockClassGroups[0],
        messages: [
          {
            _id: 'm1',
            type: 'class_group',
            classId: 'INT101-01',
            sender: 'teacher-1',
            senderName: 'ThS. Nguyễn Văn A',
            senderRole: 'giao-vien',
            content: 'Chào cả lớp, tuần sau nộp bài tập lớn nhé!',
            createdAt: '2026-11-03T08:00:00Z',
            isOwn: false,
          },
        ],
      },
    });

    chatApi.getContacts.mockResolvedValue({
      success: true,
      data: [
        {
          _id: 'teacher-2',
          name: 'TS. Lê Hoàng C',
          role: 'giao-vien',
          email: 'lhc@edumin.edu.vn',
        },
        {
          _id: 'student-1',
          name: 'Nguyễn Văn Em',
          role: 'sinh-vien',
          email: 'em.nv@sinhvien.edumin.edu.vn',
        },
      ],
    });

    chatApi.sendMessage.mockResolvedValue({
      success: true,
      message: {
        _id: 'm2',
        content: 'Phòng Đào Tạo đã ghi nhận thông báo.',
        createdAt: '2026-11-03T08:05:00Z',
      },
    });
  });

  it('renders class group channels list with course name, code, teacher, and unread badge', async () => {
    renderWithClient(<InternalMessagingPanel onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Lập trình Cơ bản C++')).toBeInTheDocument();
      expect(screen.getByText('INT101-01')).toBeInTheDocument();
      expect(screen.getByText('Phát triển Ứng dụng Web')).toBeInTheDocument();
    });

    // Unread count badge for class INT101-01 is 2
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('switches between Class Groups and Direct 1-on-1 tabs', async () => {
    renderWithClient(<InternalMessagingPanel onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Lập trình Cơ bản C++')).toBeInTheDocument();
    });

    // Click direct tab
    const directTab = screen.getByRole('button', { name: /Cá nhân/i });
    fireEvent.click(directTab);

    await waitFor(() => {
      expect(screen.getByText('TS. Trần Thị B')).toBeInTheDocument();
      expect(screen.getByText(/Em đã nộp bảng điểm lớp WEB202 rồi ạ/i)).toBeInTheDocument();
    });
  });

  it('selects a class group channel, displays messages stream and sends a new message', async () => {
    renderWithClient(<InternalMessagingPanel onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Lập trình Cơ bản C++')).toBeInTheDocument();
    });

    // Select the first class group
    fireEvent.click(screen.getByText('Lập trình Cơ bản C++'));

    await waitFor(() => {
      expect(chatApi.getMessages).toHaveBeenCalledWith({
        type: 'class_group',
        classId: 'INT101-01',
        recipientId: undefined,
      });
      expect(screen.getByText('Chào cả lớp, tuần sau nộp bài tập lớn nhé!')).toBeInTheDocument();
    });

    // Type and send a message
    const input = screen.getByPlaceholderText(/Gửi thông báo hoặc trao đổi trong lớp/i);
    fireEvent.change(input, { target: { value: 'Phòng Đào Tạo đã ghi nhận thông báo.' } });

    const sendBtn = screen.getByTitle(/Gửi tin nhắn/i);
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(chatApi.sendMessage).toHaveBeenCalledWith({
        type: 'class_group',
        classId: 'INT101-01',
        recipientId: undefined,
        content: 'Phòng Đào Tạo đã ghi nhận thông báo.',
      });
    });
  });

  it('allows Admin to click announcement template button in class group chat', async () => {
    renderWithClient(<InternalMessagingPanel onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Lập trình Cơ bản C++')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Lập trình Cơ bản C++'));

    await waitFor(() => {
      expect(screen.getByTitle(/Chèn mẫu thông báo nhanh/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle(/Chèn mẫu thông báo nhanh/i));

    const input = screen.getByPlaceholderText(/Gửi thông báo hoặc trao đổi trong lớp/i);
    expect(input.value).toContain('[Thông báo lớp học]:');
  });

  it('opens contact picker modal, lists eligible contacts, and starts a direct conversation', async () => {
    renderWithClient(<InternalMessagingPanel onClose={vi.fn()} />);

    // Switch to direct tab
    fireEvent.click(screen.getByRole('button', { name: /Cá nhân/i }));

    await waitFor(() => {
      expect(screen.getByText('Tin nhắn mới')).toBeInTheDocument();
    });

    // Open contact picker
    fireEvent.click(screen.getByText('Tin nhắn mới'));

    await waitFor(() => {
      expect(chatApi.getContacts).toHaveBeenCalled();
      expect(screen.getByText('TS. Lê Hoàng C')).toBeInTheDocument();
      expect(screen.getByText('Nguyễn Văn Em')).toBeInTheDocument();
    });

    // Select TS. Lê Hoàng C
    fireEvent.click(screen.getByText('TS. Lê Hoàng C'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Nhập tin nhắn trực tiếp/i)).toBeInTheDocument();
    });
  });
});
