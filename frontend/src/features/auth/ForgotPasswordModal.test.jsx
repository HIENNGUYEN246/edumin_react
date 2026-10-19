import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ForgotPasswordModal } from './ForgotPasswordModal.jsx';
import { authApi } from '../../api/authApi.js';

vi.mock('../../api/authApi.js', () => ({
  authApi: {
    forgotPassword: vi.fn(),
  },
}));

vi.mock('../../app/providers/ToastProvider.jsx', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  }),
}));

describe('ForgotPasswordModal', () => {
  const onClose = vi.fn();
  const onSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal with default radio "Tôi quên mật khẩu" and input field', () => {
    render(<ForgotPasswordModal open={true} onClose={onClose} onSuccess={onSuccess} />);

    expect(screen.getByText('Khôi phục thông tin tài khoản')).toBeInTheDocument();
    expect(screen.getByLabelText('Tôi quên mật khẩu')).toBeChecked();
    expect(screen.getByLabelText('Tôi quên tên tài khoản')).not.toBeChecked();
    expect(screen.getByPlaceholderText('Nhập Mã sinh viên / Tên đăng nhập')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Yêu cầu khôi phục/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Quay lại đăng nhập/i })).toBeInTheDocument();
  });

  it('switches to "Tôi quên tên tài khoản" and changes the input field to personal email', async () => {
    render(<ForgotPasswordModal open={true} onClose={onClose} onSuccess={onSuccess} />);

    await userEvent.click(screen.getByLabelText('Tôi quên tên tài khoản'));

    expect(screen.getByLabelText('Tôi quên tên tài khoản')).toBeChecked();
    expect(screen.getByLabelText('Tôi quên mật khẩu')).not.toBeChecked();
    expect(screen.getByPlaceholderText('Nhập Email cá nhân đã đăng ký')).toBeInTheDocument();
  });

  it('handles "Tôi quên mật khẩu" submission and displays success message', async () => {
    authApi.forgotPassword.mockResolvedValueOnce({
      success: true,
      type: 'password',
      message: 'Mật khẩu của bạn đã được khôi phục về: 123. Vui lòng đăng nhập lại!',
    });

    render(<ForgotPasswordModal open={true} onClose={onClose} onSuccess={onSuccess} />);

    await userEvent.type(
      screen.getByPlaceholderText('Nhập Mã sinh viên / Tên đăng nhập'),
      'SV-001'
    );
    await userEvent.click(screen.getByRole('button', { name: /Yêu cầu khôi phục/i }));

    expect(authApi.forgotPassword).toHaveBeenCalledWith({
      type: 'password',
      identifier: 'SV-001',
    });

    await waitFor(() => {
      expect(
        screen.getByText('Mật khẩu của bạn đã được khôi phục về: 123. Vui lòng đăng nhập lại!')
      ).toBeInTheDocument();
    });
    expect(onSuccess).toHaveBeenCalled();
  });

  it('handles "Tôi quên tên tài khoản" submission, displays success message with email reminder', async () => {
    authApi.forgotPassword.mockResolvedValueOnce({
      success: true,
      type: 'username',
      username: 'an.nguyen@edu.vn',
      message:
        'Tên đăng nhập của bạn là: an.nguyen@edu.vn và mật khẩu đã được khôi phục về: 123. Vui lòng kiểm tra email để xem lại thông tin này.',
    });

    render(<ForgotPasswordModal open={true} onClose={onClose} onSuccess={onSuccess} />);

    await userEvent.click(screen.getByLabelText('Tôi quên tên tài khoản'));
    await userEvent.type(
      screen.getByPlaceholderText('Nhập Email cá nhân đã đăng ký'),
      'personal@gmail.com'
    );
    await userEvent.click(screen.getByRole('button', { name: /Yêu cầu khôi phục/i }));

    expect(authApi.forgotPassword).toHaveBeenCalledWith({
      type: 'username',
      email: 'personal@gmail.com',
    });

    await waitFor(() => {
      expect(
        screen.getByText(
          'Tên đăng nhập của bạn là: an.nguyen@edu.vn và mật khẩu đã được khôi phục về: 123. Vui lòng kiểm tra email để xem lại thông tin này.'
        )
      ).toBeInTheDocument();
    });
    expect(
      screen.getByText(/Hệ thống đã gửi email thông tin này tới hòm thư cá nhân của bạn/i)
    ).toBeInTheDocument();
  });

  it('calls onClose when "Quay lại đăng nhập" is clicked', async () => {
    render(<ForgotPasswordModal open={true} onClose={onClose} onSuccess={onSuccess} />);

    await userEvent.click(screen.getByRole('button', { name: /Quay lại đăng nhập/i }));
    expect(onClose).toHaveBeenCalled();
  });
});

