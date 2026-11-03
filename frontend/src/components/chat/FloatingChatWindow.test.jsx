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

  it('renders rich message attachments (document, image, voice chat) and toolbar actions', async () => {
    chatApi.getMessages.mockResolvedValueOnce({
      success: true,
      data: {
        messages: [
          {
            _id: 'msg-rich-1',
            sender: 'teacher-1',
            senderName: 'ThS. Nguyễn Văn A',
            senderRole: 'giao-vien',
            content: 'Tài liệu và hướng dẫn bài tập lớn:',
            attachments: [
              {
                type: 'document',
                name: 'Huong_dan_BTL.pdf',
                url: 'https://example.com/btl.pdf',
                size: 204800,
              },
              {
                type: 'image',
                name: 'so_do.png',
                url: 'https://example.com/so_do.png',
              },
              {
                type: 'audio',
                name: 'voice_note.webm',
                url: 'https://example.com/voice.webm',
                duration: 15,
              },
            ],
            createdAt: '2026-11-03T08:10:00Z',
            isOwn: false,
          },
        ],
      },
    });

    renderWithProviders(<FloatingChatWindow chat={mockChat} />);

    // Document attachment
    await waitFor(() => {
      expect(screen.getByText('Huong_dan_BTL.pdf')).toBeInTheDocument();
      expect(screen.getByText(/200.0 KB/i)).toBeInTheDocument();
    });

    // Image attachment
    expect(screen.getByAltText('so_do.png')).toBeInTheDocument();

    // Voice note attachment player
    expect(screen.getByText('Thoại')).toBeInTheDocument();
    expect(screen.getByTitle('Nghe tin nhắn thoại')).toBeInTheDocument();

    // Toolbar buttons: Document, Image, Emoji, Voice Note
    expect(screen.getByTitle(/Đính kèm Tài liệu/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Đính kèm Hình ảnh/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Biểu tượng cảm xúc/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Ghi âm tin nhắn thoại/i)).toBeInTheDocument();

    // Click emoji picker and select an emoji
    fireEvent.click(screen.getByTitle(/Biểu tượng cảm xúc/i));
    expect(screen.getByText('Biểu tượng cảm xúc & Icon')).toBeInTheDocument();

    fireEvent.click(screen.getByText('📚'));
    const input = screen.getByPlaceholderText(/Gửi thông báo hoặc trao đổi trong lớp/i);
    expect(input.value).toContain('📚');
  });

  it('supports @ mentions: triggers dropdown, inserts tag and sends mentions array', async () => {
    chatApi.getMessages.mockResolvedValue({
      success: true,
      data: {
        type: 'class_group',
        classInfo: {
          classId: 'INT101-01',
          courseName: 'Lập trình Cơ bản C++',
          teacher: 'ThS. Nguyễn Văn A',
          studentCount: 30,
          members: [
            { userId: 'all', name: 'Tất cả cả lớp', role: 'system', code: 'ALL' },
            { userId: 'admin', name: 'Ban Quản trị & Đào tạo', role: 'dao-tao', code: 'ADMIN' },
            { userId: 'student-1', name: 'Nguyễn Thế Hiển', role: 'sinh-vien', code: 'SV-001' },
          ],
        },
        messages: [
          {
            _id: 'm-tag-1',
            sender: 'teacher-1',
            senderName: 'ThS. Nguyễn Văn A',
            senderRole: 'giao-vien',
            content: 'Chào @admin bạn kiểm tra phòng học nhé',
            mentions: [{ role: 'dao-tao', name: 'admin' }],
            createdAt: '2026-11-03T09:00:00Z',
            isOwn: false,
          },
        ],
      },
    });

    renderWithProviders(<FloatingChatWindow chat={mockChat} />);

    // Check mention banner when logged in user is admin and tagged
    await waitFor(() => {
      expect(screen.getByText(/Bạn được nhắc nhở trong tin nhắn này/i)).toBeInTheDocument();
      expect(screen.getByText('@admin')).toBeInTheDocument();
    });

    // Check @ Nhắc nhở button in toolbar
    const remindBtn = screen.getByTitle(/Nhắc nhở học sinh\/giáo viên bằng @/i);
    expect(remindBtn).toBeInTheDocument();

    // Click remind button triggers dropdown
    fireEvent.click(remindBtn);

    await waitFor(() => {
      expect(screen.getByTestId('mention-autocomplete-dropdown')).toBeInTheDocument();
      expect(screen.getByText('Nguyễn Thế Hiển')).toBeInTheDocument();
    });

    // Select Nguyễn Thế Hiển
    fireEvent.click(screen.getByText('Nguyễn Thế Hiển'));

    const input = screen.getByPlaceholderText(/Gửi thông báo hoặc trao đổi trong lớp/i);
    expect(input.value).toContain('@Nguyễn Thế Hiển');

    // Send message
    chatApi.sendMessage.mockResolvedValue({ success: true, data: { _id: 'new-msg' } });
    fireEvent.change(input, { target: { value: '@Nguyễn Thế Hiển chuẩn bị nộp bài tập nhé!' } });
    fireEvent.submit(input.closest('form'));

    await waitFor(() => {
      expect(chatApi.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'class_group',
          classId: 'INT101-01',
          content: '@Nguyễn Thế Hiển chuẩn bị nộp bài tập nhé!',
          mentions: expect.arrayContaining([
            expect.objectContaining({ name: 'Nguyễn Thế Hiển', userId: 'student-1' }),
          ]),
        })
      );
    });
  });
});

