import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { ToastProvider } from '../../app/providers/ToastProvider.jsx';
import { ConfirmProvider } from '../../app/providers/ConfirmProvider.jsx';
import { ManageTuition } from './ManageTuition.jsx';

const API = 'http://localhost:4000/api';

const mockTuitions = [
  {
    _id: 'tui1',
    studentId: 1,
    student: { id: 1, hoTen: 'Lê Văn Cường' },
    className: '20DTH01',
    semester: 'HK1 (2026-2027)',
    amount: 5000000,
    discount: 0,
    amountPaid: 0,
    amountDue: 5000000,
    status: 'Chưa đóng',
    transactions: [],
  },
  {
    _id: 'tui2',
    studentId: 2,
    student: { id: 2, hoTen: 'Nguyễn Thị Dung' },
    className: '20DTH02',
    semester: 'HK1 (2026-2027)',
    amount: 5000000,
    discount: 0,
    amountPaid: 2000000,
    amountDue: 3000000,
    status: 'Đang nợ',
    transactions: [{ amount: 2000000, paymentMethod: 'Tiền mặt', paidAt: new Date().toISOString() }],
  },
];

let lastBulkStatusPayload = null;
let lastPayPayload = null;

const server = setupServer(
  http.get(`${API}/tuition`, () => {
    return HttpResponse.json({
      data: mockTuitions,
      meta: { page: 1, pages: 1, total: 2 },
    });
  }),
  http.get(`${API}/tuition/semesters`, () => {
    return HttpResponse.json({ data: ['HK1 (2026-2027)'] });
  }),
  http.get(`${API}/tuition/classes`, () => {
    return HttpResponse.json({ data: ['20DTH01', '20DTH02'] });
  }),
  http.post(`${API}/tuition/bulk-status`, async ({ request }) => {
    lastBulkStatusPayload = await request.json();
    return HttpResponse.json({ success: true, updated: 2, message: 'Duyệt thành công' });
  }),
  http.post(`${API}/tuition/:id/pay`, async ({ request }) => {
    lastPayPayload = await request.json();
    return HttpResponse.json({ success: true, message: 'Thanh toán thành công' });
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => {
  server.resetHandlers();
  lastBulkStatusPayload = null;
  lastPayPayload = null;
});
afterAll(() => server.close());

function renderComponent() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ConfirmProvider>
          <ManageTuition />
        </ConfirmProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}

describe('ManageTuition Component', () => {
  it('renders tuition rows with Lớp sinh hoạt, amounts and status badges', async () => {
    renderComponent();

    await waitFor(() => expect(screen.getByText('Lê Văn Cường')).toBeInTheDocument());
    expect(screen.getByText('Nguyễn Thị Dung')).toBeInTheDocument();
    expect(screen.getByText('20DTH01')).toBeInTheDocument();
    expect(screen.getByText('20DTH02')).toBeInTheDocument();
    expect(screen.getAllByText('Chưa đóng').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Đang nợ').length).toBeGreaterThan(0);
  });

  it('selects multiple rows, opens bulk approval modal, and submits bulk status update', async () => {
    renderComponent();

    await waitFor(() => expect(screen.getByText('Lê Văn Cường')).toBeInTheDocument());

    const selectAllCheckbox = screen.getByTitle('Chọn tất cả trên trang này');
    await userEvent.click(selectAllCheckbox);

    // Bulk actions bar appears
    const bulkBtn = await screen.findByRole('button', { name: /Duyệt Đã đóng \(2\)/i });
    expect(bulkBtn).toBeInTheDocument();

    await userEvent.click(bulkBtn);

    // Modal popup appears
    expect(await screen.findByText('Xác nhận duyệt học phí hàng loạt')).toBeInTheDocument();
    expect(
      screen.getByText(/Bạn có chắc chắn muốn duyệt 2 mục này sang trạng thái "Đã đóng"\?/i)
    ).toBeInTheDocument();

    // Submit confirmation
    const confirmBtn = screen.getByRole('button', { name: /Xác nhận duyệt \(2\)/i });
    await userEvent.click(confirmBtn);

    await waitFor(() => {
      expect(lastBulkStatusPayload).toMatchObject({
        ids: ['tui1', 'tui2'],
        status: 'Đã đóng',
        paymentMethod: 'Chuyển khoản',
      });
    });
  });

  it('opens record payment modal and submits single payment', async () => {
    renderComponent();

    await waitFor(() => expect(screen.getByText('Lê Văn Cường')).toBeInTheDocument());

    const payButtons = screen.getAllByRole('button', { name: /Thu tiền/i });
    await userEvent.click(payButtons[0]);

    expect(await screen.findByText('Lập phiếu thu học phí')).toBeInTheDocument();

    const submitBtn = screen.getByRole('button', { name: /Xác nhận thu tiền/i });
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(lastPayPayload).toMatchObject({
        amount: 5000000,
        paymentMethod: 'Chuyển khoản',
      });
    });
  });
});
