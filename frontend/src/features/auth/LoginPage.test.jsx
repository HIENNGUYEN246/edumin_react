import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import App, { createQueryClient } from '../../app/App.jsx';

const API = 'http://localhost:4000/api';

const server = setupServer(
  http.post(`${API}/auth/login`, async ({ request }) => {
    const { email, password } = await request.json();
    if (email === 'admin@edu.vn' && password === 'Secret123') {
      return HttpResponse.json({
        token: 'fake-token',
        user: { _id: '1', email, role: 'dao-tao', hoTen: 'Admin' },
        profile: null,
      });
    }
    return HttpResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Email hoặc mật khẩu không chính xác' } },
      { status: 401 }
    );
  }),
  http.get(`${API}/auth/me`, ({ request }) => {
    const auth = request.headers.get('authorization');
    if (auth === 'Bearer fake-token') {
      return HttpResponse.json({ user: { _id: '1', email: 'admin@edu.vn', role: 'dao-tao', hoTen: 'Admin' }, profile: null });
    }
    return HttpResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Thiếu token' } }, { status: 401 });
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('LoginPage', () => {
  it('logs in an admin and lands on the admin dashboard', async () => {
    window.history.pushState({}, '', '/login');
    render(<App client={createQueryClient()} />);

    await userEvent.type(screen.getByPlaceholderText('Email của bạn'), 'admin@edu.vn');
    await userEvent.type(screen.getByPlaceholderText('Mật khẩu'), 'Secret123');
    await userEvent.click(screen.getByRole('button', { name: /Đăng nhập/i }));

    await waitFor(() => expect(screen.getByText('Tổng quan')).toBeInTheDocument());
    expect(sessionStorage.getItem('authToken')).toBe('fake-token');
  }, 15000);

  it('shows an error on bad credentials', async () => {
    window.history.pushState({}, '', '/login');
    render(<App client={createQueryClient()} />);

    await userEvent.type(screen.getByPlaceholderText('Email của bạn'), 'admin@edu.vn');
    await userEvent.type(screen.getByPlaceholderText('Mật khẩu'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: /Đăng nhập/i }));

    await waitFor(() =>
      expect(screen.getByText(/không chính xác/i)).toBeInTheDocument()
    );
  }, 15000);
});
