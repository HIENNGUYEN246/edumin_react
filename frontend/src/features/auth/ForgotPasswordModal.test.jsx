import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ForgotPasswordModal } from './ForgotPasswordModal.jsx';
import { authApi } from '../../api/authApi.js';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockLogin = vi.fn();
const mockLoginWithSession = vi.fn();
vi.mock('../../app/providers/AuthProvider.jsx', () => ({
  useAuth: () => ({
    login: mockLogin,
    loginWithSession: mockLoginWithSession,
  }),
}));

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

  it('renders modal with default radio "Tôi quên mật khẩu" and appropriate fields without dropdown', () => {
    render(<ForgotPasswordModal open={true} onClose={onClose} onSuccess={onSuccess} />);

    expect(screen.getByText('Khôi phục thông tin tài khoản')).toBeInTheDocument();
    expect(screen.getByLabelText('Tôi quên mật khẩu')).toBeChecked();
    expect(screen.getByLabelText('Tôi quên tên tài khoản')).not.toBeChecked();

    // Không còn dropdown chọn đối tượng
    expect(screen.queryByLabelText('Bạn là')).not.toBeInTheDocument();

    expect(screen.getByPlaceholderText('Nhập Họ và tên của bạn')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Nhập Mã sinh viên / Tên đăng nhập')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Nhập Email cá nhân đã đăng ký')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Yêu cầu khôi phục/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Quay lại đăng nhập/i })).toBeInTheDocument();
  });

  it('switches to "Tôi quên tên tài khoản" and renders Họ tên, Mã/SĐT and optional Email field', async () => {
    render(<ForgotPasswordModal open={true} onClose={onClose} onSuccess={onSuccess} />);

    await userEvent.click(screen.getByLabelText('Tôi quên tên tài khoản'));

    expect(screen.getByLabelText('Tôi quên tên tài khoản')).toBeChecked();
    expect(screen.getByLabelText('Tôi quên mật khẩu')).not.toBeChecked();

    expect(screen.getByPlaceholderText('Nhập Họ và tên của bạn')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Nhập Mã SV / Mã GV hoặc Số điện thoại')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Nhập Email cá nhân đã đăng ký')).toBeInTheDocument();
  });

  it('handles "Tôi quên mật khẩu" submission KHÔNG nhập Email: shows direct notification and 123 password', async () => {
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

  it('handles "Tôi quên mật khẩu" submission CÓ nhập Email: passes personal email and shows sync note', async () => {
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

  it('handles "Tôi quên tên tài khoản" submission CÓ nhập Email: calls API and displays check email reminder', async () => {
    authApi.forgotPassword.mockResolvedValueOnce({
      success: true,
      hasEmail: true,
      emailSynced: true,
      role: 'giao-vien',
      username: 'lehoang.gv@edu.vn',
      emailSentTo: 'lehoang.personal@gmail.com',
      message:
        'Tên đăng nhập của bạn là: lehoang.gv@edu.vn và mật khẩu đã được khôi phục về: 123. Vui lòng kiểm tra email để xem lại thông tin này.',
    });

    render(<ForgotPasswordModal open={true} onClose={onClose} onSuccess={onSuccess} />);

    await userEvent.click(screen.getByLabelText('Tôi quên tên tài khoản'));

    await userEvent.type(
      screen.getByPlaceholderText('Nhập Họ và tên của bạn'),
      'Lê Hoàng'
    );
    await userEvent.type(
      screen.getByPlaceholderText('Nhập Mã SV / Mã GV hoặc Số điện thoại'),
      'GV-001'
    );
    await userEvent.type(
      screen.getByPlaceholderText('Nhập Email cá nhân đã đăng ký'),
      'lehoang.personal@gmail.com'
    );
    await userEvent.click(screen.getByRole('button', { name: /Yêu cầu khôi phục/i }));

    expect(authApi.forgotPassword).toHaveBeenCalledWith({
      type: 'username',
      hoTen: 'Lê Hoàng',
      identifier: 'GV-001',
      email: 'lehoang.personal@gmail.com',
    });

    await waitFor(() => {
      expect(
        screen.getByText(
          'Tên đăng nhập của bạn là: lehoang.gv@edu.vn và mật khẩu đã được khôi phục về: 123. Vui lòng kiểm tra email để xem lại thông tin này.'
        )
      ).toBeInTheDocument();
      expect(screen.getByText('lehoang.gv@edu.vn')).toBeInTheDocument();
    });
  });

  it('handles "Tôi quên tên tài khoản" submission KHÔNG nhập Email: displays username directly on screen without error', async () => {
    authApi.forgotPassword.mockResolvedValueOnce({
      success: true,
      hasEmail: false,
      emailSynced: false,
      role: 'sinh-vien',
      username: 'sv.tranvan@student.edu.vn',
      message: 'Tên đăng nhập của bạn là: sv.tranvan@student.edu.vn. Mật khẩu mới đã được khôi phục về: 123',
    });

    render(<ForgotPasswordModal open={true} onClose={onClose} onSuccess={onSuccess} />);

    await userEvent.click(screen.getByLabelText('Tôi quên tên tài khoản'));

    await userEvent.type(
      screen.getByPlaceholderText('Nhập Họ và tên của bạn'),
      'Trần Văn Sinh Viên'
    );
    await userEvent.type(
      screen.getByPlaceholderText('Nhập Mã SV / Mã GV hoặc Số điện thoại'),
      'SV-002'
    );
    // Bỏ trống Email cá nhân
    await userEvent.click(screen.getByRole('button', { name: /Yêu cầu khôi phục/i }));

    expect(authApi.forgotPassword).toHaveBeenCalledWith({
      type: 'username',
      hoTen: 'Trần Văn Sinh Viên',
      identifier: 'SV-002',
      email: '',
    });

    await waitFor(() => {
      expect(
        screen.getByText(
          'Tên đăng nhập của bạn là: sv.tranvan@student.edu.vn. Mật khẩu mới đã được khôi phục về: 123'
        )
      ).toBeInTheDocument();
      expect(screen.getByText('sv.tranvan@student.edu.vn')).toBeInTheDocument();
      expect(screen.getByText('123')).toBeInTheDocument();
    });
  });

  it('calls onClose when "Quay lại đăng nhập" is clicked', async () => {
    render(<ForgotPasswordModal open={true} onClose={onClose} onSuccess={onSuccess} />);

    await userEvent.click(screen.getByRole('button', { name: /Quay lại đăng nhập/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('automatically logs in immediately and navigates to role dashboard when "Đăng nhập ngay" is clicked with session token', async () => {
    const fakeSession = {
      success: true,
      role: 'student',
      username: 'sv.tranvan@student.edu.vn',
      token: 'jwt-session-token',
      user: {
        _id: 'user-sv-1',
        email: 'sv.tranvan@student.edu.vn',
        role: 'student',
      },
      message: 'Khôi phục mật khẩu thành công! Mật khẩu mới của bạn là: 123',
    };
    authApi.forgotPassword.mockResolvedValueOnce(fakeSession);
    mockLoginWithSession.mockResolvedValueOnce(fakeSession);

    render(<ForgotPasswordModal open={true} onClose={onClose} onSuccess={onSuccess} />);

    await userEvent.type(
      screen.getByPlaceholderText('Nhập Họ và tên của bạn'),
      'Trần Văn Sinh Viên'
    );
    await userEvent.type(
      screen.getByPlaceholderText('Nhập Mã sinh viên / Tên đăng nhập'),
      'SV-001'
    );
    await userEvent.click(screen.getByRole('button', { name: /Yêu cầu khôi phục/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Đăng nhập ngay/i })).toBeInTheDocument();
    });

    // Bấm nút "Đăng nhập ngay"
    await userEvent.click(screen.getByRole('button', { name: /Đăng nhập ngay/i }));

    // Tự động đăng nhập trực tiếp bằng session
    await waitFor(() => {
      expect(mockLoginWithSession).toHaveBeenCalledWith(fakeSession);
      expect(onClose).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/student', { replace: true });
    });
  });

  it('falls back to credentials login when session token is absent and navigates to teacher dashboard', async () => {
    const fakeResult = {
      success: true,
      role: 'teacher',
      username: 'gv.lehoang@edu.vn',
      message: 'Khôi phục mật khẩu thành công! Mật khẩu mới của bạn là: 123',
    };
    authApi.forgotPassword.mockResolvedValueOnce(fakeResult);
    mockLogin.mockResolvedValueOnce({
      user: { email: 'gv.lehoang@edu.vn', role: 'teacher' },
    });

    render(<ForgotPasswordModal open={true} onClose={onClose} onSuccess={onSuccess} />);

    await userEvent.type(
      screen.getByPlaceholderText('Nhập Họ và tên của bạn'),
      'Lê Hoàng'
    );
    await userEvent.type(
      screen.getByPlaceholderText('Nhập Mã sinh viên / Tên đăng nhập'),
      'GV-001'
    );
    await userEvent.click(screen.getByRole('button', { name: /Yêu cầu khôi phục/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Đăng nhập ngay/i })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /Đăng nhập ngay/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('gv.lehoang@edu.vn', '123');
      expect(onClose).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/teacher', { replace: true });
    });
  });
});
