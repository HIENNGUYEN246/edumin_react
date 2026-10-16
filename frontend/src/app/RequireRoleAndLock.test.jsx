import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { RequireRole } from './RequireRole.jsx';
import { LockModal } from '../components/account/LockModal.jsx';
import * as AuthContextModule from './providers/AuthProvider.jsx';

describe('RequireRole & LockModal account lock flow', () => {
  it('keeps the user on the current screen when lockInfo is active and does NOT redirect to /login', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { role: 'giao-vien', hoTen: 'Thầy Nguyễn' },
      lockInfo: { message: 'Tài khoản đã bị khóa: Nghỉ học/nghỉ dạy' },
      logout: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/teacher']}>
        <Routes>
          <Route
            path="/teacher"
            element={
              <RequireRole role="giao-vien">
                <div data-testid="teacher-dashboard">Giao diện Giảng viên đang xem</div>
              </RequireRole>
            }
          />
          <Route path="/login" element={<div data-testid="login-page">Trang Đăng Nhập</div>} />
        </Routes>
        <LockModal />
      </MemoryRouter>
    );

    // The teacher interface must still be visible in the background
    expect(screen.getByTestId('teacher-dashboard')).toBeInTheDocument();
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();

    // The lock modal must overlay the screen with the exact reason
    expect(screen.getByText('Tài khoản bị khóa')).toBeInTheDocument();
    expect(screen.getByText('Tài khoản đã bị khóa: Nghỉ học/nghỉ dạy')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Đăng xuất/i })).toBeInTheDocument();
  });

  it('redirects to /login only when user is unauthenticated and lockInfo is null', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      user: null,
      lockInfo: null,
      logout: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/teacher']}>
        <Routes>
          <Route
            path="/teacher"
            element={
              <RequireRole role="giao-vien">
                <div data-testid="teacher-dashboard">Giao diện Giảng viên</div>
              </RequireRole>
            }
          />
          <Route path="/login" element={<div data-testid="login-page">Trang Đăng Nhập</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.queryByTestId('teacher-dashboard')).not.toBeInTheDocument();
    expect(screen.getByTestId('login-page')).toBeInTheDocument();
  });

  it('triggers logout when clicking "Đăng xuất" on the LockModal', async () => {
    const mockLogout = vi.fn();
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { role: 'giao-vien', hoTen: 'Thầy Nguyễn' },
      lockInfo: { message: 'Tài khoản đã bị khóa: Nghỉ học/nghỉ dạy' },
      logout: mockLogout,
    });

    render(
      <MemoryRouter initialEntries={['/teacher']}>
        <LockModal />
      </MemoryRouter>
    );

    const logoutButton = screen.getByRole('button', { name: /Đăng xuất/i });
    await userEvent.click(logoutButton);

    expect(mockLogout).toHaveBeenCalledTimes(1);
  });
});
