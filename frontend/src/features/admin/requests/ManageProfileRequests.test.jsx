import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { ToastProvider } from '../../../app/providers/ToastProvider.jsx';
import { ConfirmProvider } from '../../../app/providers/ConfirmProvider.jsx';
import { ManageProfileRequests } from './ManageProfileRequests.jsx';

const API = 'http://localhost:4000/api';

const mockRequests = [
  {
    _id: 'req1',
    requesterName: 'Nguyễn Văn A',
    requesterRole: 'giao-vien',
    requesterEmail: 'gvA@edu.vn',
    requesterCode: 1,
    type: 'avatar',
    status: 'pending',
    createdAt: new Date().toISOString(),
    requestedData: { avatar: { url: 'https://new-avatar1.png' } },
  },
  {
    _id: 'req2',
    requesterName: 'Trần Thị B',
    requesterRole: 'sinh-vien',
    requesterEmail: 'svB@edu.vn',
    requesterCode: 2,
    type: 'profile',
    status: 'pending',
    createdAt: new Date().toISOString(),
    requestedData: { phone: '0912345678' },
  },
];

let lastBulkApprovePayload = null;

const server = setupServer(
  http.get(`${API}/profile-requests`, () => {
    return HttpResponse.json({
      data: mockRequests,
      meta: { page: 1, pages: 1, total: 2 },
      pendingCount: 2,
    });
  }),
  http.post(`${API}/profile-requests/bulk-approve`, async ({ request }) => {
    lastBulkApprovePayload = await request.json();
    return HttpResponse.json({ success: true, approvedCount: 2 });
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => {
  server.resetHandlers();
  lastBulkApprovePayload = null;
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
          <ManageProfileRequests />
        </ConfirmProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}

describe('ManageProfileRequests Bulk Approval', () => {
  it('shows checkboxes, opens confirmation modal, and bulk approves items', async () => {
    renderComponent();

    // Wait for rows to load
    await waitFor(() => expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument());
    expect(screen.getByText('Trần Thị B')).toBeInTheDocument();

    // Checkbox column header exists
    const selectAllCheckbox = screen.getByTitle('Chọn tất cả trên trang này');
    expect(selectAllCheckbox).toBeInTheDocument();

    // Click select all
    await userEvent.click(selectAllCheckbox);

    // Toolbar appears with 'Duyệt tất cả (Bulk Approve)'
    const bulkApproveBtn = await screen.findByRole('button', { name: /Duyệt tất cả \(Bulk Approve\)/i });
    expect(bulkApproveBtn).toBeInTheDocument();
    expect(screen.getByText(/Đã chọn 2 mục/i)).toBeInTheDocument();

    // Click 'Duyệt tất cả' button
    await userEvent.click(bulkApproveBtn);

    // Confirmation Modal popup appears with required text
    expect(await screen.findByText('Xác nhận duyệt hàng loạt')).toBeInTheDocument();
    expect(screen.getByText('Bạn có chắc chắn muốn duyệt 2 mục này không?')).toBeInTheDocument();

    // Click confirm in the modal
    const confirmBtn = screen.getByRole('button', { name: /Xác nhận duyệt/i });
    await userEvent.click(confirmBtn);

    // Verify API called with selected IDs
    await waitFor(() => expect(lastBulkApprovePayload).toEqual({ ids: ['req1', 'req2'] }));
  }, 15000);
});
