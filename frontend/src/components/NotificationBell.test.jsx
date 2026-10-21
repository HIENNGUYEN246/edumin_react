import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NotificationBell from './NotificationBell.jsx';
import { notificationsApi } from '../api/notificationsApi.js';
import { tokenStore } from '../api/http.js';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../api/notificationsApi.js', () => ({
  notificationsApi: {
    list: vi.fn(),
    markRead: vi.fn().mockResolvedValue({ success: true }),
    markAllRead: vi.fn().mockResolvedValue({ success: true }),
    remove: vi.fn().mockResolvedValue({ success: true }),
    bulkDelete: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock('../api/http.js', () => ({
  tokenStore: {
    get: vi.fn().mockReturnValue('mock-jwt-token'),
  },
}));

describe('NotificationBell Component with Schedule Change Coordination', () => {
  const mockUser = {
    id: 1,
    _id: 'user-1',
    hoTen: 'Nguyễn Văn An',
    role: 'sinh-vien',
  };

  const sampleNotifications = [
    {
      _id: 'notif-1',
      type: 'schedule_change',
      targetClassId: 'CNTT101-01',
      title: '[CNTT101-01] Thông báo đổi phòng học',
      message: 'Lớp chuyển sang phòng B2-405 vào ngày 2026-10-25',
      isRead: false,
      createdAt: new Date().toISOString(),
      metadata: {
        changeType: 'room_change',
        classCode: 'CNTT101-01',
        oldRoom: 'A1-201',
        newRoom: 'B2-405',
        date: '2026-10-25',
      },
    },
    {
      _id: 'notif-2',
      type: 'system',
      title: 'Thông báo chung toàn trường',
      message: 'Chào mừng năm học mới 2026',
      isRead: true,
      createdAt: new Date(Date.now() - 3600000).toISOString(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    notificationsApi.list.mockResolvedValue({
      data: sampleNotifications,
    });
  });

  it('renders the bell icon with unread count badge', async () => {
    render(
      <MemoryRouter>
        <NotificationBell currentUser={mockUser} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('1')).toBeInTheDocument();
    });
  });

  it('opens notification dropdown on click and displays targeted class badge and room change chip', async () => {
    render(
      <MemoryRouter>
        <NotificationBell currentUser={mockUser} />
      </MemoryRouter>
    );

    const bellBtn = screen.getByRole('button', { name: /Xem thông báo/i });
    fireEvent.click(bellBtn);

    await waitFor(() => {
      expect(screen.getByText('Thông báo')).toBeInTheDocument();
      expect(screen.getByText('CNTT101-01')).toBeInTheDocument();
      expect(screen.getByText(/\[CNTT101-01\] Thông báo đổi phòng học/)).toBeInTheDocument();
      expect(screen.getByText(/A1-201 ➔ B2-405/)).toBeInTheDocument();
      expect(screen.getByText('2026-10-25')).toBeInTheDocument();
    });
  });

  it('marks all notifications as read when clicking "Đã đọc tất cả"', async () => {
    render(
      <MemoryRouter>
        <NotificationBell currentUser={mockUser} />
      </MemoryRouter>
    );

    const bellBtn = screen.getByRole('button', { name: /Xem thông báo/i });
    fireEvent.click(bellBtn);

    const markAllBtn = await screen.findByRole('button', { name: /Đã đọc tất cả/i });
    fireEvent.click(markAllBtn);

    await waitFor(() => {
      expect(notificationsApi.markAllRead).toHaveBeenCalled();
    });
  });

  it('refetches notifications when window event "edumin_schedule_changed" fires', async () => {
    render(
      <MemoryRouter>
        <NotificationBell currentUser={mockUser} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(notificationsApi.list).toHaveBeenCalledTimes(1);
    });

    window.dispatchEvent(
      new CustomEvent('edumin_schedule_changed', {
        detail: { classCode: 'CNTT101-01' },
      })
    );

    await waitFor(() => {
      expect(notificationsApi.list).toHaveBeenCalledTimes(2);
    });
  });

  it('clicking directly on a notification item opens detail modal directly, and "Đi tới trang liên quan" navigates properly', async () => {
    const teacherUser = {
      id: 2,
      _id: 'gv-1',
      hoTen: 'Thầy Nguyễn Văn Bình',
      role: 'giao-vien',
    };

    const avatarNotif = [
      {
        _id: 'notif-avatar-99',
        type: 'approval',
        title: 'Yêu cầu thay đổi đã được phê duyệt',
        message: 'Quản trị viên đã phê duyệt thay đổi ảnh đại diện của bạn.',
        link: '/teacher',
        isRead: false,
        createdAt: new Date().toISOString(),
        metadata: { requestId: 'req-avatar-123' },
      },
    ];

    notificationsApi.list.mockResolvedValueOnce({
      data: avatarNotif,
    });

    render(
      <MemoryRouter>
        <NotificationBell currentUser={teacherUser} customRole="giao-vien" />
      </MemoryRouter>
    );

    const bellBtn = await screen.findByRole('button', { name: /Xem thông báo/i });
    fireEvent.click(bellBtn);

    // Verify dropdown is open
    const itemTitle = await screen.findByText('Yêu cầu thay đổi đã được phê duyệt');
    expect(itemTitle).toBeInTheDocument();

    // User clicks directly on the notification item (not the eye icon!)
    fireEvent.click(itemTitle);

    // 1. Dropdown must be closed
    await waitFor(() => {
      expect(screen.queryByText('Đã đọc tất cả')).not.toBeInTheDocument();
    });

    // 2. Modal table must appear immediately
    expect(screen.getByText('Chi tiết thông báo')).toBeInTheDocument();
    expect(screen.getByText('Quản trị viên đã phê duyệt thay đổi ảnh đại diện của bạn.')).toBeInTheDocument();
    expect(screen.getByText('Thông tin chi tiết')).toBeInTheDocument();
    expect(screen.getByText('Phòng Đào tạo (Quản trị viên)')).toBeInTheDocument();
    expect(screen.getByText('Đã phê duyệt')).toBeInTheDocument();

    // 3. Item was marked as read
    expect(notificationsApi.markRead).toHaveBeenCalledWith('notif-avatar-99');

    // 4. "Đi tới trang liên quan" button is present and works
    const goToRelatedBtn = screen.getByRole('button', { name: /Đi tới trang liên quan/i });
    expect(goToRelatedBtn).toBeInTheDocument();

    fireEvent.click(goToRelatedBtn);

    // 5. Modal closes and navigates to target link
    await waitFor(() => {
      expect(screen.queryByText('Chi tiết thông báo')).not.toBeInTheDocument();
      expect(mockNavigate).toHaveBeenCalledWith('/teacher');
    });
  });

  it('does not render redundant eye icon and closes detail modal on Escape or backdrop click', async () => {
    const teacherUser = {
      id: 2,
      _id: 'gv-1',
      hoTen: 'Thầy Nguyễn Văn Bình',
      role: 'giao-vien',
    };

    const avatarNotif = [
      {
        _id: 'notif-avatar-99',
        type: 'approval',
        title: 'Yêu cầu thay đổi đã được phê duyệt',
        message: 'Quản trị viên đã phê duyệt thay đổi ảnh đại diện của bạn.',
        link: '/teacher',
        isRead: false,
        createdAt: new Date().toISOString(),
        metadata: { requestId: 'req-avatar-123' },
      },
    ];

    notificationsApi.list.mockResolvedValueOnce({
      data: avatarNotif,
    });

    render(
      <MemoryRouter>
        <NotificationBell currentUser={teacherUser} customRole="giao-vien" />
      </MemoryRouter>
    );

    const bellBtn = await screen.findByRole('button', { name: /Xem thông báo/i });
    fireEvent.click(bellBtn);

    // Eye icon must be removed completely
    expect(screen.queryByTitle('Xem chi tiết nội dung')).not.toBeInTheDocument();

    // Clicking the item opens the modal
    const item = await screen.findByText('Yêu cầu thay đổi đã được phê duyệt');
    fireEvent.click(item);

    expect(screen.getByText('Chi tiết thông báo')).toBeInTheDocument();

    // Press Escape to close
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByText('Chi tiết thông báo')).not.toBeInTheDocument();
    });
  });
});
