import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../app/providers/ToastProvider.jsx';
import { AppLayout } from './AppLayout.jsx';

vi.mock('../../app/providers/AuthProvider.jsx', () => ({
  useAuth: () => ({
    user: { role: 'dao-tao', hoTen: 'Quản trị viên' },
    profile: { hoTen: 'Quản trị viên' },
    isAuthenticated: true,
  }),
}));

vi.mock('../../api/aiApi.js', () => ({
  aiApi: {
    query: vi.fn(),
    suggestions: vi.fn().mockResolvedValue({ success: true, suggestions: [] }),
  },
}));

describe('AppLayout with EduMinAiAssistant', () => {
  it('renders AppLayout and displays EduMinAiAssistant floating trigger', () => {
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter initialEntries={['/admin']}>
            <Routes>
              <Route element={<AppLayout />}>
                <Route path="/admin" element={<div>Admin Page Content</div>} />
              </Route>
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    );

    expect(screen.getByText('Admin Page Content')).toBeInTheDocument();
    const aiButton = screen.getByRole('button', { name: /Mở trợ lý ảo EduMin/i });
    expect(aiButton).toBeInTheDocument();
  });
});
