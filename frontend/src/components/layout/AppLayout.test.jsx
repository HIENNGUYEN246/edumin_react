import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../app/providers/ToastProvider.jsx';
import { AppLayout } from './AppLayout.jsx';

let mockUser = { role: 'dao-tao', hoTen: 'Quản trị viên' };

vi.mock('../../app/providers/AuthProvider.jsx', () => ({
  useAuth: () => ({
    user: mockUser,
    profile: mockUser,
    isAuthenticated: !!mockUser,
  }),
}));

vi.mock('../../api/aiApi.js', () => ({
  aiApi: {
    query: vi.fn(),
    suggestions: vi.fn().mockResolvedValue({ success: true, suggestions: [] }),
  },
}));

describe('AppLayout with EduMinAiAssistant for Admin, Teacher, and Student', () => {
  it('renders EduMinAiAssistant floating trigger for Admin (dao-tao) on /admin', () => {
    mockUser = { role: 'dao-tao', hoTen: 'Quản trị viên' };
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
    expect(screen.getByRole('button', { name: /Mở trợ lý ảo EduMin/i })).toBeInTheDocument();
  });

  it('renders EduMinAiAssistant floating trigger for Teacher (giao-vien) on /teacher', () => {
    mockUser = { role: 'giao-vien', hoTen: 'Trần Minh Quân' };
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter initialEntries={['/teacher']}>
            <Routes>
              <Route element={<AppLayout />}>
                <Route path="/teacher" element={<div>Teacher Page Content</div>} />
              </Route>
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    );

    expect(screen.getByText('Teacher Page Content')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mở trợ lý ảo EduMin/i })).toBeInTheDocument();
  });

  it('renders EduMinAiAssistant floating trigger for Student (sinh-vien) on /student', () => {
    mockUser = { role: 'sinh-vien', hoTen: 'Nguyễn Văn An' };
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter initialEntries={['/student']}>
            <Routes>
              <Route element={<AppLayout />}>
                <Route path="/student" element={<div>Student Page Content</div>} />
              </Route>
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    );

    expect(screen.getByText('Student Page Content')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mở trợ lý ảo EduMin/i })).toBeInTheDocument();
  });

  it('renders EduMinAiAssistant floating trigger when role is "student" on /student/attendance', () => {
    mockUser = { role: 'student', hoTen: 'Nguyễn Văn An' };
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter initialEntries={['/student/attendance']}>
            <Routes>
              <Route element={<AppLayout />}>
                <Route path="/student/attendance" element={<div>Student Attendance Content</div>} />
              </Route>
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    );

    expect(screen.getByText('Student Attendance Content')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mở trợ lý ảo EduMin/i })).toBeInTheDocument();
  });
});
