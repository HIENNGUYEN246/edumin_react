import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ChangePasswordModal } from './ChangePasswordModal.jsx';
import { authApi } from '../../api/authApi.js';

const mockLogout = vi.fn();
const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
};

vi.mock('../../app/providers/ToastProvider.jsx', () => ({
  useToast: () => mockToast,
}));

vi.mock('../../app/providers/AuthProvider.jsx', () => ({
  useAuth: () => ({
    logout: mockLogout,
  }),
}));

vi.mock('../../api/authApi.js', () => ({
  authApi: {
    changePassword: vi.fn(),
  },
}));

function renderModal(props = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ChangePasswordModal open={true} onClose={vi.fn()} {...props} />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('ChangePasswordModal layout and positioning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('renders modal with fixed overlay and centered positioning classes', () => {
    renderModal();

    const dialog = screen.getByRole('dialog', { name: /Đổi mật khẩu/i });
    expect(dialog).toBeInTheDocument();

    // Check modal overlay container
    const overlayContainer = dialog.parentElement;
    expect(overlayContainer).toHaveClass('fixed');
    expect(overlayContainer).toHaveClass('inset-0');
    expect(overlayContainer).toHaveClass('z-50');
    expect(overlayContainer).toHaveClass('flex');
    expect(overlayContainer).toHaveClass('items-center');
    expect(overlayContainer).toHaveClass('justify-center');
  });

  it('renders backdrop overlay with fixed inset-0', () => {
    renderModal();

    const dialog = screen.getByRole('dialog', { name: /Đổi mật khẩu/i });
    const overlayContainer = dialog.parentElement;
    const backdrop = overlayContainer.firstElementChild;

    expect(backdrop).toHaveClass('fixed');
    expect(backdrop).toHaveClass('inset-0');
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    const closeBtn = screen.getByRole('button', { name: /Đóng/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clears session/tokens and triggers logout on successful password change', async () => {
    sessionStorage.setItem('authToken', 'token-123');
    localStorage.setItem('authToken', 'token-123');
    localStorage.setItem('authUser', JSON.stringify({ email: 'user@edu.vn' }));

    authApi.changePassword.mockResolvedValueOnce({
      message: 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại.',
    });

    renderModal();

    fireEvent.change(screen.getByLabelText(/Mật khẩu cũ/i), { target: { value: 'OldPass123' } });
    fireEvent.change(screen.getByLabelText(/^Mật khẩu mới/i), { target: { value: 'NewPass123' } });
    fireEvent.change(screen.getByLabelText(/Xác nhận mật khẩu mới/i), { target: { value: 'NewPass123' } });

    fireEvent.click(screen.getByRole('button', { name: /Cập nhật/i }));

    await waitFor(() => {
      expect(authApi.changePassword).toHaveBeenCalledWith({
        oldPassword: 'OldPass123',
        newPassword: 'NewPass123',
      });
    });

    expect(sessionStorage.getItem('authToken')).toBeNull();
    expect(localStorage.getItem('authToken')).toBeNull();
    expect(mockLogout).toHaveBeenCalled();
    expect(mockToast.success).toHaveBeenCalledWith(
      expect.stringContaining('Đổi mật khẩu thành công')
    );
  });
});

