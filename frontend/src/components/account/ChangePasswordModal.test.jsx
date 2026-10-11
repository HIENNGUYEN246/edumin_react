import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ChangePasswordModal } from './ChangePasswordModal.jsx';

vi.mock('../../app/providers/ToastProvider.jsx', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
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
      <ChangePasswordModal open={true} onClose={vi.fn()} {...props} />
    </QueryClientProvider>
  );
}

describe('ChangePasswordModal layout and positioning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});

