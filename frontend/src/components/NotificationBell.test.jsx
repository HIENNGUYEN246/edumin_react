import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NotificationBell from './NotificationBell.jsx';
import { notificationsApi } from '../api/notificationsApi.js';
import { tokenStore } from '../api/http.js';

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
});

