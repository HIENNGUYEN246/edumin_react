import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConfirmProvider, useConfirm } from './ConfirmProvider.jsx';

function TestConsumer({ confirmOptions }) {
  const confirm = useConfirm();
  return (
    <button type="button" onClick={() => confirm(confirmOptions)}>
      Mở modal xác nhận
    </button>
  );
}

describe('ConfirmProvider - Contextual Icons and Styles', () => {
  it('renders a paper plane icon for email sending confirmation and avoids question mark (?)', async () => {
    render(
      <ConfirmProvider>
        <TestConsumer
          confirmOptions={{
            title: 'Gửi thông tin tài khoản cho 1 người',
            message: 'Mỗi Gmail nhận sẽ được gửi riêng email đăng nhập trường.',
            confirmText: 'Gửi 1 email',
            cancelText: 'Kiểm tra lại',
            tone: 'email',
          }}
        />
      </ConfirmProvider>
    );

    fireEvent.click(screen.getByText('Mở modal xác nhận'));

    await waitFor(() => {
      expect(screen.getByText('Gửi thông tin tài khoản cho 1 người')).toBeInTheDocument();
    });

    // Verify paper plane icon is rendered in document (portal)
    const paperPlanes = document.querySelectorAll('.fa-paper-plane');
    expect(paperPlanes.length).toBeGreaterThan(0);

    // Verify question mark is NOT rendered
    const questionMarks = document.querySelectorAll('.fa-circle-question');
    expect(questionMarks.length).toBe(0);
  });

  it('renders a trash can icon for danger/delete confirmation', async () => {
    render(
      <ConfirmProvider>
        <TestConsumer
          confirmOptions={{
            title: 'Xóa tài khoản',
            message: 'Bạn có chắc chắn muốn xóa?',
            confirmText: 'Xóa ngay',
            tone: 'danger',
          }}
        />
      </ConfirmProvider>
    );

    fireEvent.click(screen.getByText('Mở modal xác nhận'));

    await waitFor(() => {
      expect(screen.getByText('Xóa tài khoản')).toBeInTheDocument();
    });

    const trashIcons = document.querySelectorAll('.fa-trash-can');
    expect(trashIcons.length).toBeGreaterThan(0);
  });

  it('renders a check circle icon for approval/success confirmation', async () => {
    render(
      <ConfirmProvider>
        <TestConsumer
          confirmOptions={{
            title: 'Phê duyệt hồ sơ',
            message: 'Xác nhận duyệt thay đổi thông tin?',
            confirmText: 'Phê duyệt',
            tone: 'success',
          }}
        />
      </ConfirmProvider>
    );

    fireEvent.click(screen.getByText('Mở modal xác nhận'));

    await waitFor(() => {
      expect(screen.getByText('Phê duyệt hồ sơ')).toBeInTheDocument();
    });

    const checkIcons = document.querySelectorAll('.fa-circle-check');
    expect(checkIcons.length).toBeGreaterThan(0);
  });
});
