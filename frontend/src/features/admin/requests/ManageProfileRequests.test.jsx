import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
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
let lastCriteriaPayload = null;
let currentCriteria = null;

const server = setupServer(
  http.get(`${API}/admin/requests`, () => {
    return HttpResponse.json({
      data: mockRequests,
      meta: { page: 1, pages: 1, total: 2 },
      pendingCount: 2,
    });
  }),
  http.get(`${API}/profile-requests`, () => {
    return HttpResponse.json({
      data: mockRequests,
      meta: { page: 1, pages: 1, total: 2 },
      pendingCount: 2,
    });
  }),
  http.post(`${API}/admin/requests/bulk-approve`, async ({ request }) => {
    lastBulkApprovePayload = await request.json();
    return HttpResponse.json({ success: true, approvedCount: 2 });
  }),
  http.post(`${API}/profile-requests/bulk-approve`, async ({ request }) => {
    lastBulkApprovePayload = await request.json();
    return HttpResponse.json({ success: true, approvedCount: 2 });
  }),
  http.get(`${API}/ai/admin-criteria`, () => {
    return HttpResponse.json({
      success: true,
      criteria: currentCriteria,
    });
  }),
  http.post(`${API}/ai/admin-criteria`, async ({ request }) => {
    lastCriteriaPayload = await request.json();
    currentCriteria = {
      rawCriteriaText: lastCriteriaPayload.rawCriteriaText || 'SĐT đủ 10 số',
      rules: lastCriteriaPayload.rules || { requirePhone10: true, requireReason: true },
    };
    return HttpResponse.json({
      success: true,
      criteria: currentCriteria,
      processResult: { autoApprovedCount: 1, keptPendingCount: 1 },
    });
  }),
  http.delete(`${API}/ai/admin-criteria`, () => {
    currentCriteria = null;
    return HttpResponse.json({ success: true, message: 'Đã hủy quy chuẩn' });
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => {
  server.resetHandlers();
  lastBulkApprovePayload = null;
  lastCriteriaPayload = null;
  currentCriteria = null;
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

describe('ManageProfileRequests Page & Direct Criteria Management', () => {
  it('renders updated page title "Duyệt Thay Đổi Thông Tin" and bulk approves items', async () => {
    renderComponent();

    // Verify updated title
    expect(await screen.findByRole('heading', { name: 'Duyệt Thay Đổi Thông Tin' })).toBeInTheDocument();

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

  it('allows opening criteria configuration modal directly on the page and saving new criteria', async () => {
    renderComponent();

    // Page title and criteria button
    expect(await screen.findByRole('heading', { name: 'Duyệt Thay Đổi Thông Tin' })).toBeInTheDocument();

    // Initial banner shows not configured state
    expect(screen.getByText('Chưa thiết lập tiêu chí kiểm duyệt tự động')).toBeInTheDocument();
    const openModalBtn = screen.getByRole('button', { name: /Thiết lập tiêu chí duyệt/i });
    expect(openModalBtn).toBeInTheDocument();

    // Click to open Criteria Modal directly on page
    await userEvent.click(openModalBtn);

    // Verify modal appeared with direct toggles and presets
    expect(await screen.findByText('Thiết lập Tiêu chí Kiểm duyệt Tự động')).toBeInTheDocument();
    expect(screen.getByText('Mẫu thiết lập nhanh (Presets):')).toBeInTheDocument();
    expect(screen.getByText('SĐT chuẩn 10 chữ số')).toBeInTheDocument();
    expect(screen.getByText('Bắt buộc có lý do thay đổi')).toBeInTheDocument();

    // Click preset "Toàn diện (Khuyên dùng)"
    const strictPresetBtn = screen.getByRole('button', { name: /Toàn diện \(Khuyên dùng\)/i });
    await userEvent.click(strictPresetBtn);

    // Save criteria
    const saveBtn = screen.getByRole('button', { name: /Lưu & Kích hoạt/i });
    await userEvent.click(saveBtn);

    // Verify API received payload
    await waitFor(() => {
      expect(lastCriteriaPayload).not.toBeNull();
      expect(lastCriteriaPayload.rules.requirePhone10).toBe(true);
      expect(lastCriteriaPayload.rules.requireReason).toBe(true);
      expect(lastCriteriaPayload.rules.requireHumanSingleAvatar).toBe(true);
    });
  }, 15000);

  it('displays active criteria badges and allows direct adjustment or clearing from page banner', async () => {
    currentCriteria = {
      rawCriteriaText: 'SĐT 10 số, lý do rõ ràng',
      rules: {
        requirePhone10: true,
        requireReason: true,
        requireHumanSingleAvatar: true,
        customSummary: 'SĐT đủ 10 số • Có lý do rõ ràng • Avatar ảnh người thật 1 người',
      },
    };

    renderComponent();

    // Wait for active banner to appear
    expect(await screen.findByText('Tiêu chí kiểm duyệt tự động đang kích hoạt')).toBeInTheDocument();
    expect(screen.getByText('Đang áp dụng đón đầu')).toBeInTheDocument();
    expect(screen.getByText('SĐT 10 số')).toBeInTheDocument();
    expect(screen.getByText('Có lý do thay đổi')).toBeInTheDocument();
    expect(screen.getByText('Avatar người thật (1 người)')).toBeInTheDocument();

    // Adjustment button opens modal directly on page
    const adjustBtn = screen.getByRole('button', { name: /Điều chỉnh/i });
    await userEvent.click(adjustBtn);
    expect(await screen.findByText('Thiết lập Tiêu chí Kiểm duyệt Tự động')).toBeInTheDocument();

    // Close modal
    const cancelBtn = screen.getByRole('button', { name: 'Hủy' });
    await userEvent.click(cancelBtn);

    // Turn off criteria button exists directly on banner
    const turnOffBtn = screen.getByRole('button', { name: 'Tắt' });
    expect(turnOffBtn).toBeInTheDocument();
  }, 15000);
});
