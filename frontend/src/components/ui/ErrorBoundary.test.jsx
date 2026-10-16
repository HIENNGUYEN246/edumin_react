import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary.jsx';

function BrokenComponent() {
  throw new Error('Test intentional render crash');
}

function SafeComponent() {
  return <div>Nội dung an toàn</div>;
}

describe('ErrorBoundary Component', () => {
  it('renders children normally when no error occurs', () => {
    render(
      <ErrorBoundary>
        <SafeComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Nội dung an toàn')).toBeInTheDocument();
  });

  it('catches render error and displays fallback UI instead of crashing', () => {
    // Suppress console.error in test output for expected error
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <BrokenComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Đã có lỗi xảy ra khi hiển thị nội dung')).toBeInTheDocument();
    expect(screen.getByText('Test intentional render crash')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tải lại trang/i })).toBeInTheDocument();

    spy.mockRestore();
  });

  it('calls onReset callback when clicking reload button', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const handleReset = vi.fn();

    render(
      <ErrorBoundary onReset={handleReset}>
        <BrokenComponent />
      </ErrorBoundary>
    );

    const reloadBtn = screen.getByRole('button', { name: /Tải lại trang/i });
    fireEvent.click(reloadBtn);

    expect(handleReset).toHaveBeenCalledTimes(1);

    spy.mockRestore();
  });
});

