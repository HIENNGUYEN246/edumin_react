import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { ToastProvider } from '../../../app/providers/ToastProvider.jsx';
import { ConfirmProvider } from '../../../app/providers/ConfirmProvider.jsx';
import { AccountManager } from './AccountManager.jsx';
import { formatTeacherCode } from '../../../lib/format.js';

const API = 'http://localhost:4000/api';

const page1Accounts = [
  {
    _id: 'acc1',
    id: 1,
    hoTen: 'Giáo viên 1',
    email: 'gv1@edu.vn',
    status: 'Active',
    teacher: { id: 1, hoTen: 'Giáo viên 1' },
  },
  {
    _id: 'acc2',
    id: 2,
    hoTen: 'Giáo viên 2',
    email: 'gv2@edu.vn',
    status: 'Active',
    teacher: { id: 2, hoTen: 'Giáo viên 2' },
  },
];

const page2Accounts = [
  {
    _id: 'acc3',
    id: 3,
    hoTen: 'Giáo viên 3',
    email: 'gv3@edu.vn',
    status: 'Active',
    teacher: { id: 3, hoTen: 'Giáo viên 3' },
  },
  {
    _id: 'acc4',
    id: 4,
    hoTen: 'Giáo viên 4',
    email: 'gv4@edu.vn',
    status: 'Active',
    teacher: { id: 4, hoTen: 'Giáo viên 4' },
  },
];

const server = setupServer(
  http.get(`${API}/accounts`, ({ request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') || '1');
    const data = page === 2 ? page2Accounts : page1Accounts;
    return HttpResponse.json({
      data,
      meta: { page, pages: 2, total: 4, limit: 2 },
    });
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderAccountManager() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ConfirmProvider>
          <AccountManager
            config={{
              role: 'giao-vien',
              title: 'Tài khoản giáo viên',
              subtitle: 'Quản lý tài khoản',
              formatCode: formatTeacherCode,
            }}
          />
        </ConfirmProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}

describe('AccountManager - Multi-page Checkbox Selection Persistence', () => {
  it('preserves selected item IDs and checkbox states across pagination navigation', async () => {
    const user = userEvent.setup();
    renderAccountManager();

    // 1. Wait for page 1 accounts to load
    await waitFor(() => {
      expect(screen.getByText('Giáo viên 1')).toBeInTheDocument();
      expect(screen.getByText('Giáo viên 2')).toBeInTheDocument();
    });

    const checkbox1 = screen.getByRole('checkbox', { name: /Chọn Giáo viên 1/i });
    expect(checkbox1).not.toBeChecked();

    // 2. Select Giáo viên 1 on page 1
    await user.click(checkbox1);
    expect(checkbox1).toBeChecked();
    expect(screen.getByText(/Đang chọn/i)).toBeInTheDocument();

    // 3. Navigate to page 2 using chevron-right button
    const buttons = screen.getAllByRole('button');
    const nextBtn = buttons.find((btn) => btn.querySelector('.fa-chevron-right'));
    await user.click(nextBtn);

    // 4. Verify page 2 accounts loaded
    await waitFor(() => {
      expect(screen.getByText('Giáo viên 3')).toBeInTheDocument();
      expect(screen.getByText('Giáo viên 4')).toBeInTheDocument();
    });

    // Selection banner should STILL show 1 account selected from page 1!
    expect(screen.getByText(/Đang chọn/i)).toBeInTheDocument();
    expect(screen.getByText('Xóa 1 tài khoản đã chọn')).toBeInTheDocument();

    // Page 2 checkboxes should NOT be checked initially
    const checkbox3 = screen.getByRole('checkbox', { name: /Chọn Giáo viên 3/i });
    expect(checkbox3).not.toBeChecked();

    // 5. Select Giáo viên 3 on page 2
    await user.click(checkbox3);
    expect(checkbox3).toBeChecked();
    // Count should now be 2
    expect(screen.getByText('Xóa 2 tài khoản đã chọn')).toBeInTheDocument();

    // 6. Navigate back to page 1 using chevron-left button
    const prevBtn = screen.getAllByRole('button').find((btn) => btn.querySelector('.fa-chevron-left'));
    await user.click(prevBtn);

    // 7. Verify page 1 loaded and Giáo viên 1 is STILL CHECKED!
    await waitFor(() => {
      expect(screen.getByText('Giáo viên 1')).toBeInTheDocument();
    });

    const checkbox1Again = screen.getByRole('checkbox', { name: /Chọn Giáo viên 1/i });
    expect(checkbox1Again).toBeChecked();

    // And total selected remains 2
    expect(screen.getByText('Xóa 2 tài khoản đã chọn')).toBeInTheDocument();
  });

  it('handles Select All on one page without clearing selections made on other pages', async () => {
    const user = userEvent.setup();
    renderAccountManager();

    // Wait for page 1 accounts
    await waitFor(() => {
      expect(screen.getByText('Giáo viên 1')).toBeInTheDocument();
    });

    // 1. Click Select All header checkbox on page 1
    const selectAllHeader = screen.getByRole('checkbox', { name: /Chọn tất cả/i });
    await user.click(selectAllHeader);

    expect(screen.getByText('Xóa 2 tài khoản đã chọn')).toBeInTheDocument();

    // 2. Go to page 2
    const nextBtn = screen.getAllByRole('button').find((btn) => btn.querySelector('.fa-chevron-right'));
    await user.click(nextBtn);

    await waitFor(() => {
      expect(screen.getByText('Giáo viên 3')).toBeInTheDocument();
    });

    // Page 2 header should be unchecked because page 2 items are not selected yet
    const selectAllHeaderPage2 = screen.getByRole('checkbox', { name: /Chọn tất cả/i });
    expect(selectAllHeaderPage2).not.toBeChecked();

    // 3. Select All on page 2 as well
    await user.click(selectAllHeaderPage2);
    // Now all 4 accounts selected
    expect(screen.getByText('Xóa 4 tài khoản đã chọn')).toBeInTheDocument();

    // 4. Return to page 1
    const prevBtn = screen.getAllByRole('button').find((btn) => btn.querySelector('.fa-chevron-left'));
    await user.click(prevBtn);

    await waitFor(() => {
      expect(screen.getByText('Giáo viên 1')).toBeInTheDocument();
    });

    // Page 1 header should still be checked
    const selectAllHeaderPage1Again = screen.getByRole('checkbox', { name: /Chọn tất cả/i });
    expect(selectAllHeaderPage1Again).toBeChecked();

    // 5. Uncheck Select All on page 1
    await user.click(selectAllHeaderPage1Again);

    // Total should now be 2 (page 2 accounts remain selected!)
    expect(screen.getByText('Xóa 2 tài khoản đã chọn')).toBeInTheDocument();

    // 6. Navigate back to page 2 and verify page 2 accounts are STILL checked
    await user.click(nextBtn);
    await waitFor(() => {
      expect(screen.getByText('Giáo viên 3')).toBeInTheDocument();
    });

    const checkbox3 = screen.getByRole('checkbox', { name: /Chọn Giáo viên 3/i });
    const checkbox4 = screen.getByRole('checkbox', { name: /Chọn Giáo viên 4/i });
    expect(checkbox3).toBeChecked();
    expect(checkbox4).toBeChecked();
  });
});
