import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AdminEmailNotifications } from './AdminEmailNotifications.jsx';

const mocks = vi.hoisted(() => ({
  recipients: vi.fn(),
  sendAccountCredentials: vi.fn(),
  readSheet: vi.fn(),
  exportSheet: vi.fn(),
  confirm: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

vi.mock('../../../api/communicationsApi.js', () => ({
  communicationsApi: {
    recipients: mocks.recipients,
    sendAccountCredentials: mocks.sendAccountCredentials,
  },
}));

vi.mock('../../../lib/excel.js', () => ({
  readSheet: mocks.readSheet,
  exportSheet: mocks.exportSheet,
}));

vi.mock('../../../app/providers/ConfirmProvider.jsx', () => ({
  useConfirm: () => mocks.confirm,
}));

vi.mock('../../../app/providers/ToastProvider.jsx', () => ({
  useToast: () => mocks.toast,
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AdminEmailNotifications />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('AdminEmailNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.confirm.mockResolvedValue(true);
    mocks.recipients.mockImplementation(async ({ role }) => ({
      data: [
        {
          _id: role === 'giao-vien' ? 'teacher-1' : 'student-1',
          id: 1,
          role,
          hoTen: role === 'giao-vien' ? 'Giáo viên A' : 'Sinh viên A',
          email: role === 'giao-vien' ? 'teacher@edu.vn' : 'student@edu.vn',
          department: 'CNTT',
          className: 'CNTT-K18',
          accountActive: true,
        },
      ],
      meta: { page: 1, pages: 1, total: 1 },
      emailConfigured: true,
    }));
    mocks.sendAccountCredentials.mockResolvedValue({
      total: 1,
      sent: 1,
      failed: 0,
      skipped: 0,
      results: [
        {
          id: 'teacher-1',
          role: 'giao-vien',
          accountEmail: 'teacher@edu.vn',
          recipientEmail: 'teacher.personal@gmail.com',
          status: 'sent',
        },
      ],
    });
  });

  it('sends an account email to one selected recipient', async () => {
    renderPage();

    fireEvent.change(await screen.findByRole('textbox', { name: 'Gmail nhận của Giáo viên A' }), {
      target: { value: 'teacher.personal@gmail.com' },
    });
    const checkbox = await screen.findByRole('checkbox', { name: 'Chọn Giáo viên A' });
    fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole('button', { name: 'Gửi email' }));

    await waitFor(() => {
      expect(mocks.sendAccountCredentials).toHaveBeenCalledWith([
        {
          role: 'giao-vien',
          accountEmail: 'teacher@edu.vn',
          recipientEmail: 'teacher.personal@gmail.com',
        },
      ]);
    });
    expect(await screen.findByText(/Thành công 1/)).toBeInTheDocument();
    expect(mocks.toast.success).toHaveBeenCalled();
  });

  it('imports account login and personal Gmail mappings from Excel', async () => {
    mocks.readSheet.mockResolvedValue([
      {
        'Vai trò': 'Giáo viên',
        'Email tài khoản': 'hiennguyen123@university.edu.vn',
        'Email Gmail nhận': 'hien.personal@gmail.com',
        'Họ tên': 'Nguyễn Hiển',
      },
    ]);
    mocks.sendAccountCredentials.mockResolvedValue({
      total: 1,
      sent: 1,
      failed: 0,
      skipped: 0,
      results: [
        {
          id: 'teacher-111',
          role: 'giao-vien',
          accountEmail: 'hiennguyen123@university.edu.vn',
          recipientEmail: 'hien.personal@gmail.com',
          status: 'sent',
        },
      ],
    });
    renderPage();

    const fileInput = document.querySelector('input[type="file"]');
    fireEvent.change(fileInput, {
      target: { files: [new File(['xlsx'], 'recipients.xlsx')] },
    });

    expect(await screen.findByText('Nguyễn Hiển')).toBeInTheDocument();
    expect(
      await screen.findByText('Tài khoản: hiennguyen123@university.edu.vn')
    ).toBeInTheDocument();
    expect(screen.getAllByDisplayValue('hien.personal@gmail.com')).not.toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Gửi email' }));

    await waitFor(() => {
      expect(mocks.sendAccountCredentials).toHaveBeenCalledWith([
        expect.objectContaining({
          role: 'giao-vien',
          accountEmail: 'hiennguyen123@university.edu.vn',
          recipientEmail: 'hien.personal@gmail.com',
        }),
      ]);
    });
  });

  it('switches between separate teacher and student recipient lists', async () => {
    renderPage();
    expect(await screen.findByText('teacher@edu.vn')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Sinh viên' }));
    expect(await screen.findByText('student@edu.vn')).toBeInTheDocument();
    expect(mocks.recipients).toHaveBeenCalledWith(expect.objectContaining({ role: 'sinh-vien' }));
  });

  it('blocks sending when Gmail is not configured on the backend', async () => {
    mocks.recipients.mockResolvedValue({
      data: [],
      meta: { page: 1, pages: 0, total: 0 },
      emailConfigured: false,
    });
    renderPage();

    expect(await screen.findByText('Chưa cấu hình Gmail trên máy chủ')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gửi 0 email' })).toBeDisabled();
  });

  it('pre-fills auto-synced emailNhanThongBao and enables immediate selection', async () => {
    mocks.recipients.mockResolvedValueOnce({
      data: [
        {
          _id: 'student-synced',
          id: 10,
          role: 'sinh-vien',
          hoTen: 'Sinh viên Đồng Bộ',
          email: 'student.synced@edu.vn',
          emailNhanThongBao: 'student.synced.personal@gmail.com',
          department: 'CNTT',
          className: 'CNTT-K18',
          accountActive: true,
        },
      ],
      meta: { page: 1, pages: 1, total: 1 },
      emailConfigured: true,
    });

    renderPage();

    expect(await screen.findByDisplayValue('student.synced.personal@gmail.com')).toBeInTheDocument();
    const checkbox = screen.getByRole('checkbox', { name: 'Chọn Sinh viên Đồng Bộ' });
    expect(checkbox).not.toBeDisabled();
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
  });

  it('does not allow sending to the account email when it is saved as notification email', async () => {
    mocks.recipients.mockResolvedValueOnce({
      data: [
        {
          _id: 'teacher-account-email',
          id: 11,
          role: 'giao-vien',
          hoTen: 'Giáo viên dùng email trường',
          email: 'teacher@university.edu.vn',
          emailNhanThongBao: 'teacher@university.edu.vn',
          accountActive: true,
        },
      ],
      meta: { page: 1, pages: 1, total: 1 },
      emailConfigured: true,
    });

    renderPage();

    const checkbox = await screen.findByRole('checkbox', {
      name: 'Chọn Giáo viên dùng email trường',
    });
    expect(checkbox).toBeDisabled();
    expect(mocks.sendAccountCredentials).not.toHaveBeenCalled();
  });

  it('does not allow a non-Gmail address as the receiving address', async () => {
    renderPage();

    fireEvent.change(await screen.findByRole('textbox', { name: 'Gmail nhận của Giáo viên A' }), {
      target: { value: 'teacher.personal@outlook.com' },
    });

    expect(screen.getByRole('checkbox', { name: 'Chọn Giáo viên A' })).toBeDisabled();
    expect(mocks.sendAccountCredentials).not.toHaveBeenCalled();
  });
});
