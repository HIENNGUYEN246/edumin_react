import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ScheduleChangeNotificationModal } from './ScheduleChangeNotificationModal.jsx';
import { notificationsApi } from '../../api/notificationsApi.js';
import { classesApi } from '../../api/classesApi.js';
import { departmentsApi } from '../../api/departmentsApi.js';

vi.mock('../../api/notificationsApi.js', () => ({
  notificationsApi: {
    broadcast: vi.fn().mockResolvedValue({ success: true, recipientCount: 35 }),
  },
}));

vi.mock('../../api/classesApi.js', () => ({
  classesApi: {
    list: vi.fn().mockResolvedValue({
      data: [
        {
          _id: 'cls-1',
          id: 'IT101-01',
          courseName: 'Lập trình Web',
          room: 'A1-201',
        },
      ],
    }),
  },
}));

vi.mock('../../api/departmentsApi.js', () => ({
  departmentsApi: {
    list: vi.fn().mockResolvedValue({
      data: [{ _id: 'd-1', name: 'Khoa Công Nghệ Thông Tin' }],
    }),
  },
}));

vi.mock('../../app/providers/ToastProvider.jsx', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('ScheduleChangeNotificationModal Component', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all scope options and preselects class scope by default', async () => {
    render(
      <ScheduleChangeNotificationModal
        isOpen={true}
        onClose={mockOnClose}
        defaultClassId="IT101-01"
      />
    );

    expect(screen.getByText('Điều phối & Thông báo Đổi lịch học')).toBeInTheDocument();
    expect(screen.getByText('Theo Lớp học phần')).toBeInTheDocument();
    expect(screen.getByText('Cá nhân cụ thể')).toBeInTheDocument();
    expect(screen.getByText('Theo Khoa / Khối')).toBeInTheDocument();
    expect(screen.getByText('Toàn trường')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByDisplayValue(/\[IT101-01\] Thông báo đổi phòng học/)).toBeInTheDocument();
    });
  });

  it('switches change type to period_change and updates auto-generated message', async () => {
    render(
      <ScheduleChangeNotificationModal
        isOpen={true}
        onClose={mockOnClose}
        defaultClassId="IT101-01"
      />
    );

    const typeSelect = screen.getByDisplayValue(/Đổi phòng học/);
    fireEvent.change(typeSelect, { target: { value: 'period_change' } });

    await waitFor(() => {
      expect(screen.getByDisplayValue(/\[IT101-01\] Thông báo đổi ca\/tiết học/)).toBeInTheDocument();
    });
  });

  it('submits form with schedule change parameters and dispatches window events', async () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    render(
      <ScheduleChangeNotificationModal
        isOpen={true}
        onClose={mockOnClose}
        defaultClassId="IT101-01"
      />
    );

    const submitBtn = screen.getByRole('button', { name: /Phát thông báo ngay/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(notificationsApi.broadcast).toHaveBeenCalledWith(
        expect.objectContaining({
          targetType: 'class',
          targetClassId: 'IT101-01',
          type: 'schedule_change',
        })
      );
      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'edumin_notification_created',
        })
      );
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('closes when pressing Escape key and locks body scroll', async () => {
    const { unmount } = render(
      <ScheduleChangeNotificationModal
        isOpen={true}
        onClose={mockOnClose}
        defaultClassId="IT101-01"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Điều phối & Thông báo Đổi lịch học')).toBeInTheDocument();
    });

    expect(document.body.style.overflow).toBe('hidden');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(mockOnClose).toHaveBeenCalledTimes(1);

    unmount();
    expect(document.body.style.overflow).toBe('');
  });

  it('closes when clicking on the backdrop overlay', async () => {
    render(
      <ScheduleChangeNotificationModal
        isOpen={true}
        onClose={mockOnClose}
        defaultClassId="IT101-01"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Điều phối & Thông báo Đổi lịch học')).toBeInTheDocument();
    });

    const backdrop = document.querySelector('.fixed.inset-0.z-\\[9999\\]');
    expect(backdrop).toBeInTheDocument();

    fireEvent.click(backdrop);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });
});
