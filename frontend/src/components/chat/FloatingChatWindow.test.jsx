import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FloatingChatWindow } from './FloatingChatWindow.jsx';
import { ChatProvider } from '../../app/providers/ChatProvider.jsx';
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

function renderWithProviders(ui) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ChatProvider>
        {ui}
      </ChatProvider>
    </QueryClientProvider>
  );
}

describe('FloatingChatWindow (Facebook-style Chat Box)', () => {
  const mockChat = {
    key: 'class_INT101-01',
    type: 'class_group',
    classId: 'INT101-01',
    title: 'Lập trình Cơ bản C++',
    teacher: 'ThS. Nguyễn Văn A',
    isMinimized: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    chatApi.getChannels.mockResolvedValue({
      success: true,
      classGroups: [],
      directConversations: [],
      totalUnread: 0,
    });

    chatApi.getMessages.mockResolvedValue({
      success: true,
      data: {
        messages: [
          {
            _id: 'msg-1',
            sender: 'teacher-1',
            senderName: 'ThS. Nguyễn Văn A',
            senderRole: 'giao-vien',
            content: 'Chào cả lớp, thứ hai tuần sau chúng ta thi giữa kỳ!',
            createdAt: '2026-11-03T08:00:00Z',
            isOwn: false,
          },
        ],
      },
    });

    chatApi.sendMessage.mockResolvedValue({
      success: true,
      message: {
        _id: 'msg-2',
        content: 'Phòng Đào Tạo đã cập nhật lịch thi.',
      },
    });
  });

  it('renders chat window header with title, teacher info, and message history', async () => {
    renderWithProviders(<FloatingChatWindow chat={mockChat} />);

    expect(screen.getByText('Lập trình Cơ bản C++')).toBeInTheDocument();
    expect(screen.getByText(/Lớp INT101-01 • GV: ThS. Nguyễn Văn A/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Chào cả lớp, thứ hai tuần sau chúng ta thi giữa kỳ!')).toBeInTheDocument();
      expect(screen.getByText('ThS. Nguyễn Văn A')).toBeInTheDocument();
    });
  });

  it('allows Admin to click announcement template button and send a message', async () => {
    renderWithProviders(<FloatingChatWindow chat={mockChat} />);

    await waitFor(() => {
      expect(screen.getByTitle('Chèn mẫu thông báo nhanh')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle('Chèn mẫu thông báo nhanh'));

    const input = screen.getByPlaceholderText(/Gửi thông báo hoặc trao đổi trong lớp/i);
    expect(input.value).toContain('[Thông báo lớp học]:');

    // Type addition and send
    fireEvent.change(input, { target: { value: '[Thông báo lớp học]: Phòng Đào Tạo đã cập nhật lịch thi.' } });
    fireEvent.click(screen.getByRole('button', { name: /Gửi tin nhắn/i }));

    await waitFor(() => {
      expect(chatApi.sendMessage).toHaveBeenCalledWith({
        type: 'class_group',
        classId: 'INT101-01',
        recipientId: undefined,
        content: '[Thông báo lớp học]: Phòng Đào Tạo đã cập nhật lịch thi.',
      });
    });
  });

  it('renders in compact minimized state when chat.isMinimized is true', () => {
    const minimizedChat = { ...mockChat, isMinimized: true };
    renderWithProviders(<FloatingChatWindow chat={minimizedChat} />);

    expect(screen.getByText('Lập trình Cơ bản C++')).toBeInTheDocument();
    // Input is hidden when minimized
    expect(screen.queryByPlaceholderText(/Gửi thông báo hoặc trao đổi/i)).not.toBeInTheDocument();
  });
});

