import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MessengerBell } from './MessengerBell.jsx';
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

describe('MessengerBell', () => {
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
      classId: 'MAT101-02',
      courseName: 'Giải tích 1',
      courseCode: 'MAT101',
      teacher: 'TS. Phạm Minh C',
      studentCount: 0,
      unreadCount: 0,
      lastMessage: null,
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

  const mockContacts = [
    {
      _id: 'student-hien',
      name: 'Nguyễn Thế Hiển',
      hoTen: 'Nguyễn Thế Hiển',
      role: 'sinh-vien',
      code: 'SV-001',
      inMyClass: true,
      email: 'hien.nt@sinhvien.edumin.edu.vn',
      avatar: '',
    },
    {
      _id: 'teacher-quang',
      name: 'ThS. Lê Văn Quang',
      hoTen: 'ThS. Lê Văn Quang',
      role: 'giao-vien',
      code: 'GV-001',
      inMyClass: true,
      email: 'quang.lv@edumin.edu.vn',
      avatar: '',
    },
    {
      _id: 'teacher-ngoai',
      name: 'TS. Vũ Đình Ngoài',
      hoTen: 'TS. Vũ Đình Ngoài',
      role: 'giao-vien',
      code: 'GV-002',
      inMyClass: false,
      email: 'ngoai.vd@edumin.edu.vn',
      avatar: '',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    chatApi.getChannels.mockResolvedValue({
      success: true,
      classGroups: mockClassGroups,
      directConversations: mockDirectConversations,
      contacts: mockContacts,
      totalUnread: 3,
    });

    chatApi.getContacts.mockResolvedValue({
      success: true,
      data: mockContacts,
    });
  });

  it('renders messenger bell button and displays unread badge', async () => {
    renderWithProviders(<MessengerBell />);

    const button = screen.getByRole('button', { name: /Xem tin nhắn/i });
    expect(button).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });

  it('opens dropdown with conversation list when clicked', async () => {
    renderWithProviders(<MessengerBell />);

    const button = screen.getByRole('button', { name: /Xem tin nhắn/i });
    fireEvent.click(button);

    expect(screen.getByText('Đoạn chat')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Tìm theo tên hoặc mã GV\/SV/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Lập trình Cơ bản C++')).toBeInTheDocument();
      expect(screen.getByText('TS. Trần Thị B')).toBeInTheDocument();
      expect(screen.getByText(/45 SV/i)).toBeInTheDocument();
      expect(screen.getByText(/Mặc định:/i)).toBeInTheDocument();
    });
  });

  it('filters conversations by 4 tabs (Tất cả, Lớp HP, Giáo viên, Sinh viên) and displays student counts', async () => {
    renderWithProviders(<MessengerBell />);

    fireEvent.click(screen.getByRole('button', { name: /Xem tin nhắn/i }));

    await waitFor(() => {
      expect(screen.getByText('Lập trình Cơ bản C++')).toBeInTheDocument();
      expect(screen.getByText('TS. Trần Thị B')).toBeInTheDocument();
    });

    // Verify student count badge in class card
    expect(screen.getByText(/45 SV/i)).toBeInTheDocument();
    expect(screen.getByText(/Chưa có SV/i)).toBeInTheDocument();

    // Click "Lớp HP" filter tab
    fireEvent.click(screen.getByRole('button', { name: /Lớp HP/i }));
    expect(screen.getByText('Lập trình Cơ bản C++')).toBeInTheDocument();
    expect(screen.getByText('Giải tích 1')).toBeInTheDocument();
    expect(screen.queryByText('TS. Trần Thị B')).not.toBeInTheDocument();
    expect(screen.queryByText('Nguyễn Thế Hiển')).not.toBeInTheDocument();

    // Click "Giáo viên" filter tab -> shows only teachers
    fireEvent.click(screen.getByRole('button', { name: /Giáo viên/i }));
    expect(screen.getByText('TS. Trần Thị B')).toBeInTheDocument();
    expect(screen.getByText('ThS. Lê Văn Quang')).toBeInTheDocument();
    expect(screen.queryByText('Lập trình Cơ bản C++')).not.toBeInTheDocument();
    expect(screen.queryByText('Nguyễn Thế Hiển')).not.toBeInTheDocument();

    // Click "Sinh viên" filter tab -> shows only students
    fireEvent.click(screen.getByRole('button', { name: /Sinh viên/i }));
    expect(screen.getByText('Nguyễn Thế Hiển')).toBeInTheDocument();
    expect(screen.queryByText('TS. Trần Thị B')).not.toBeInTheDocument();
    expect(screen.queryByText('Lập trình Cơ bản C++')).not.toBeInTheDocument();
  });

  it('searches for individual student "Nguyễn Thế Hiển" and finds him immediately in search results', async () => {
    renderWithProviders(<MessengerBell />);

    fireEvent.click(screen.getByRole('button', { name: /Xem tin nhắn/i }));

    const searchInput = screen.getByPlaceholderText(/Tìm theo tên hoặc mã GV\/SV/i);
    fireEvent.change(searchInput, { target: { value: 'Nguyễn Thế Hiển' } });

    await waitFor(() => {
      expect(screen.getByText('Nguyễn Thế Hiển')).toBeInTheDocument();
      expect(screen.getAllByText('Sinh viên').length).toBeGreaterThanOrEqual(1);
      expect(screen.queryByText('Lập trình Cơ bản C++')).not.toBeInTheDocument();
    });
  });

  it('searches outside-class teacher by code "GV-002" and displays "Lớp ngoài" badge', async () => {
    renderWithProviders(<MessengerBell />);

    fireEvent.click(screen.getByRole('button', { name: /Xem tin nhắn/i }));

    const searchInput = screen.getByPlaceholderText(/Tìm theo tên hoặc mã GV\/SV/i);
    fireEvent.change(searchInput, { target: { value: 'GV-002' } });

    await waitFor(() => {
      expect(screen.getByText('TS. Vũ Đình Ngoài')).toBeInTheDocument();
      expect(screen.getByText('GV-002')).toBeInTheDocument();
      expect(screen.getByText('Lớp ngoài')).toBeInTheDocument();
    });
  });
});
