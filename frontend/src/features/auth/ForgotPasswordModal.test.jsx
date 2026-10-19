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

  it('renders modal with default radio "Tôi quên mật khẩu" and appropriate fields', () => {
    render(<ForgotPasswordModal open={true} onClose={onClose} onSuccess={onSuccess} />);

    expect(screen.getByText('Khôi phục thông tin tài khoản')).toBeInTheDocument();
    expect(screen.getByLabelText('Tôi quên mật khẩu')).toBeChecked();
    expect(screen.getByLabelText('Tôi quên tên tài khoản')).not.toBeChecked();

    expect(screen.getByPlaceholderText('Nhập Họ và tên của bạn')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Nhập Mã sinh viên / Tên đăng nhập')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Nhập Email cá nhân đã đăng ký')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Yêu cầu khôi phục/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Quay lại đăng nhập/i })).toBeInTheDocument();
  });

  it('switches to "Tôi quên tên tài khoản" and renders Họ tên and required Email field', async () => {
    render(<ForgotPasswordModal open={true} onClose={onClose} onSuccess={onSuccess} />);

    await userEvent.click(screen.getByLabelText('Tôi quên tên tài khoản'));

    expect(screen.getByLabelText('Tôi quên tên tài khoản')).toBeChecked();
    expect(screen.getByLabelText('Tôi quên mật khẩu')).not.toBeChecked();

    expect(screen.getByPlaceholderText('Nhập Họ và tên của bạn')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Nhập Email cá nhân đã đăng ký')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Nhập Mã sinh viên / Tên đăng nhập')).not.toBeInTheDocument();
  });

  it('handles "Tôi quên mật khẩu" submission KHÔNG nhập Email: shows direct notification', async () => {
    authApi.forgotPassword.mockResolvedValueOnce({
      success: true,
      hasEmail: false,
      role: 'sinh-vien',
      username: 'an.nguyen@edu.vn',
      message: 'Khôi phục mật khẩu thành công! Mật khẩu mới của bạn là: 123',
    });

    render(<ForgotPasswordModal open={true} onClose={onClose} onSuccess={onSuccess} />);

    await userEvent.type(
      screen.getByPlaceholderText('Nhập Họ và tên của bạn'),
      'Nguyễn Văn An'
    );
    await userEvent.type(
      screen.getByPlaceholderText('Nhập Mã sinh viên / Tên đăng nhập'),
      'SV-001'
    );
    await userEvent.click(screen.getByRole('button', { name: /Yêu cầu khôi phục/i }));

    expect(authApi.forgotPassword).toHaveBeenCalledWith({
      type: 'password',
      hoTen: 'Nguyễn Văn An',
      identifier: 'SV-001',
      email: '',
    });

    await waitFor(() => {
      expect(
        screen.getByText('Khôi phục mật khẩu thành công! Mật khẩu mới của bạn là: 123')
      ).toBeInTheDocument();
    });
    expect(onSuccess).toHaveBeenCalled();
  });

  it('handles "Tôi quên mật khẩu" submission CÓ nhập Email: passes personal email', async () => {
    authApi.forgotPassword.mockResolvedValueOnce({
      success: true,
      hasEmail: true,
      emailSynced: true,
      role: 'sinh-vien',
      username: 'an.nguyen@edu.vn',
      emailSentTo: 'personal@gmail.com',
      message: 'Khôi phục mật khẩu thành công! Mật khẩu mới của bạn là: 123. Bản sao đã được gửi tới email cá nhân.',
    });

    render(<ForgotPasswordModal open={true} onClose={onClose} onSuccess={onSuccess} />);

    await userEvent.type(
      screen.getByPlaceholderText('Nhập Họ và tên của bạn'),
      'Nguyễn Văn An'
    );
    await userEvent.type(
      screen.getByPlaceholderText('Nhập Mã sinh viên / Tên đăng nhập'),
      'SV-001'
    );
    await userEvent.type(
      screen.getByPlaceholderText('Nhập Email cá nhân đã đăng ký'),
      'personal@gmail.com'
    );
    await userEvent.click(screen.getByRole('button', { name: /Yêu cầu khôi phục/i }));

    expect(authApi.forgotPassword).toHaveBeenCalledWith({
      type: 'password',
      hoTen: 'Nguyễn Văn An',
      identifier: 'SV-001',
      email: 'personal@gmail.com',
    });

    await waitFor(() => {
      expect(
        screen.getByText(/Khôi phục mật khẩu thành công! Mật khẩu mới của bạn là: 123/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Hệ thống đã gửi email chi tiết thông tin tài khoản tới:/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Địa chỉ email này đã được tự động đồng bộ vào hệ thống quản lý/i)
      ).toBeInTheDocument();
    });
  });

  it('handles "Tôi quên tên tài khoản" submission: calls API with type username and displays check email reminder', async () => {
    authApi.forgotPassword.mockResolvedValueOnce({
      success: true,
      hasEmail: true,
      role: 'sinh-vien',
      username: 'an.nguyen@edu.vn',
      emailSentTo: 'personal@gmail.com',
      message:
        'Tên đăng nhập của bạn là: an.nguyen@edu.vn và mật khẩu đã được khôi phục về: 123. Vui lòng kiểm tra email để xem lại thông tin này.',
    });

    render(<ForgotPasswordModal open={true} onClose={onClose} onSuccess={onSuccess} />);

    await userEvent.click(screen.getByLabelText('Tôi quên tên tài khoản'));

    await userEvent.type(
      screen.getByPlaceholderText('Nhập Họ và tên của bạn'),
      'Nguyễn Văn An'
    );
    await userEvent.type(
      screen.getByPlaceholderText('Nhập Email cá nhân đã đăng ký'),
      'personal@gmail.com'
    );
    await userEvent.click(screen.getByRole('button', { name: /Yêu cầu khôi phục/i }));

    expect(authApi.forgotPassword).toHaveBeenCalledWith({
      type: 'username',
      hoTen: 'Nguyễn Văn An',
      email: 'personal@gmail.com',
    });

    await waitFor(() => {
      expect(
        screen.getByText(
          'Tên đăng nhập của bạn là: an.nguyen@edu.vn và mật khẩu đã được khôi phục về: 123. Vui lòng kiểm tra email để xem lại thông tin này.'
        )
      ).toBeInTheDocument();
    });
  });

  it('supports selecting "Giáo viên" role and passes role to API payload', async () => {
    authApi.forgotPassword.mockResolvedValueOnce({
      success: true,
      hasEmail: false,
      role: 'giao-vien',
      username: 'lehoang.gv@edu.vn',
      message: 'Khôi phục mật khẩu thành công! Mật khẩu mới của bạn là: 123',
    });

    render(<ForgotPasswordModal open={true} onClose={onClose} onSuccess={onSuccess} />);

    // Select role "Giáo viên"
    const selectRole = screen.getByLabelText('Bạn là');
    await userEvent.selectOptions(selectRole, 'teacher');

    expect(screen.getByPlaceholderText('Nhập Mã giảng viên / Tên đăng nhập')).toBeInTheDocument();

    await userEvent.type(
      screen.getByPlaceholderText('Nhập Họ và tên của bạn'),
      'Lê Hoàng'
    );
    await userEvent.type(
      screen.getByPlaceholderText('Nhập Mã giảng viên / Tên đăng nhập'),
      'GV-001'
    );
    await userEvent.click(screen.getByRole('button', { name: /Yêu cầu khôi phục/i }));

    expect(authApi.forgotPassword).toHaveBeenCalledWith({
      type: 'password',
      hoTen: 'Lê Hoàng',
      identifier: 'GV-001',
      email: '',
      role: 'teacher',
    });

    await waitFor(() => {
      expect(screen.getByText('Giáo viên')).toBeInTheDocument();
      expect(
        screen.getByText('Khôi phục mật khẩu thành công! Mật khẩu mới của bạn là: 123')
      ).toBeInTheDocument();
    });
  });

  it('calls onClose when "Quay lại đăng nhập" is clicked', async () => {
    render(<ForgotPasswordModal open={true} onClose={onClose} onSuccess={onSuccess} />);

    await userEvent.click(screen.getByRole('button', { name: /Quay lại đăng nhập/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
