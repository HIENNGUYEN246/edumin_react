import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EduMinAiAssistant, { classifyAiIntent, getSmartAiResponse } from './EduMinAiAssistant.jsx';
import { notificationsApi } from '../../api/notificationsApi.js';
import { aiApi } from '../../api/aiApi.js';

vi.mock('../../api/notificationsApi.js', () => ({
  notificationsApi: {
    list: vi.fn(),
  },
}));

vi.mock('../../api/aiApi.js', () => ({
  aiApi: {
    query: vi.fn().mockResolvedValue({
      reply: 'AI API reply',
      intent: 'GENERAL',
    }),
    suggestions: vi.fn().mockResolvedValue({
      suggestions: ['Lớp tôi vừa đổi phòng nào thế AI?'],
    }),
  },
}));

vi.mock('../../app/providers/AuthProvider.jsx', () => ({
  useAuth: () => ({
    user: {
      id: 2,
      _id: 'user-sv-2',
      hoTen: 'Quyền Huế Trân',
      role: 'sinh-vien',
    },
    profile: {
      hoTen: 'Quyền Huế Trân',
    },
  }),
}));

vi.mock('../../app/providers/ToastProvider.jsx', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('EduMin AI Assistant Schedule Change Coordination', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    notificationsApi.list.mockResolvedValue({
      data: [
        {
          _id: 'notif-sched-1',
          type: 'schedule_change',
          targetClassId: 'CNTT101-01',
          senderName: 'ThS. Nguyễn Văn An',
          senderRole: 'giao-vien',
          title: '[CNTT101-01] Thông báo đổi phòng học',
          message: 'Lớp đổi sang học phòng B2-405 do phòng cũ sửa chữa.',
          isRead: false,
          metadata: {
            changeType: 'room_change',
            classCode: 'CNTT101-01',
            oldRoom: 'A1-201',
            newRoom: 'B2-405',
            date: '2026-10-25',
            oldShift: 'Sáng (Tiết 1 - 3)',
            newShift: 'Sáng (Tiết 1 - 3)',
            reason: 'Phòng cũ sửa máy chiếu',
          },
        },
      ],
    });
  });

  it('classifies "Lớp tôi vừa đổi phòng nào thế AI?" into SCHEDULE_ROOM_CHANGE_QUERY', () => {
    const intent = classifyAiIntent('Lớp tôi vừa đổi phòng nào thế AI?', { role: 'sinh-vien' });
    expect(intent).toBe('SCHEDULE_ROOM_CHANGE_QUERY');
  });

  it('generates detailed room change response for SCHEDULE_ROOM_CHANGE_QUERY', () => {
    sessionStorage.setItem(
      'edumin_latest_schedule_change',
      JSON.stringify({
        classCode: 'CNTT101-01',
        oldRoom: 'A1-201',
        newRoom: 'B2-405',
        date: '2026-10-25',
        reason: 'Sửa máy chiếu',
        senderName: 'Thầy An',
      })
    );

    const result = getSmartAiResponse('Lớp tôi vừa đổi phòng nào thế AI?', 'sinh-vien');
    expect(result.matched).toBe(true);
    expect(result.intent).toBe('SCHEDULE_ROOM_CHANGE_QUERY');
    expect(result.reply).toContain('CNTT101-01');
    expect(result.reply).toContain('A1-201');
    expect(result.reply).toContain('B2-405');
    expect(result.reply).toContain('2026-10-25');
  });

  it('proactively greets the user with schedule change alert and offers quick action when chat is opened', async () => {
    render(
      <MemoryRouter>
        <EduMinAiAssistant />
      </MemoryRouter>
    );

    // Open chat FAB
    const fabButton = screen.getByRole('button', { name: /Mở trợ lý ảo/i });
    fireEvent.click(fabButton);

    await waitFor(() => {
      expect(screen.getByText(/CNTT101-01/)).toBeInTheDocument();
      expect(screen.getByText(/vừa có thông báo đổi lịch/i)).toBeInTheDocument();
      expect(screen.getByText(/Bạn có muốn tôi xem lại thời khóa biểu mới không\?/i)).toBeInTheDocument();
      expect(screen.getByText('Xem Thời khóa biểu mới')).toBeInTheDocument();
    });
  });
});
