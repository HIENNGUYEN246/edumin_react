import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { ToastProvider } from '../../../app/providers/ToastProvider.jsx';
import { ConfirmProvider } from '../../../app/providers/ConfirmProvider.jsx';
import { ManageStudents } from '../students/ManageStudents.jsx';
import { ManageTeachers } from '../teachers/ManageTeachers.jsx';

const API = 'http://localhost:4000/api';

const mockStudents = [
  {
    _id: 'stu1',
    id: 1,
    hoTen: 'Nguyễn Văn Active',
    email: 'active@edu.vn',
    className: '20DTH01',
    department: 'Công nghệ thông tin',
    userId: {
      _id: 'user1',
      email: 'active@edu.vn',
      status: 'Active',
      role: 'sinh-vien',
    },
  },
  {
    _id: 'stu2',
    id: 2,
    hoTen: 'Trần Thị Locked',
    email: 'locked@edu.vn',
    className: '20DTH02',
    department: 'Công nghệ thông tin',
    userId: {
      _id: 'user2',
      email: 'locked@edu.vn',
      status: 'Locked',
      lockReason: 'Vi phạm quy định',
      role: 'sinh-vien',
    },
  },
];

const mockTeachers = [
  {
    _id: 'teacher1',
    id: 1,
    hoTen: 'Lê Thị Giáo Viên',
    email: 'teacher@edu.vn',
    department: 'Công nghệ thông tin',
    accountStatus: 'Locked',
    userId: {
      _id: 'teacher-user1',
      status: 'Locked',
      lockReason: 'Yêu cầu từ quản lý',
    },
  },
];

const server = setupServer(
  http.get(`${API}/students`, () => {
    return HttpResponse.json({
      data: mockStudents,
      meta: { page: 1, pages: 1, total: 2 },
    });
  }),
  http.get(`${API}/teachers`, () => {
    return HttpResponse.json({
      data: mockTeachers,
      meta: { page: 1, pages: 1, total: 1 },
    });
  }),
  http.get(`${API}/departments`, () => {
    return HttpResponse.json({
      data: [{ _id: 'd1', id: 1, name: 'Công nghệ thông tin' }],
    });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderWithProviders(ui) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ConfirmProvider>{ui}</ConfirmProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}

describe('PersonManager account actions', () => {
  it.each([
    ['teacher', ManageTeachers, 'Lê Thị Giáo Viên'],
    ['student', ManageStudents, 'Nguyễn Văn Active'],
  ])('hides lock and password reset actions on the %s management page', async (_role, Page, name) => {
    renderWithProviders(<Page />);

    expect(await screen.findByText(name)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /khóa tài khoản|mở khóa tài khoản|đặt lại mật khẩu/i })).not.toBeInTheDocument();
  });

  it.each([
    ['teacher', ManageTeachers, 'Tài khoản'],
    ['student', ManageStudents, 'Tài khoản'],
  ])('hides the account status column on the %s management page', async (_role, Page, columnName) => {
    renderWithProviders(<Page />);

    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: columnName })).not.toBeInTheDocument();
    expect(screen.queryByText('Đã khóa')).not.toBeInTheDocument();
    expect(screen.queryByText('Hoạt động')).not.toBeInTheDocument();
  });
});
