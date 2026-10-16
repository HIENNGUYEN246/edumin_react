import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { ConfirmProvider } from '../../../app/providers/ConfirmProvider.jsx';
import { ToastProvider } from '../../../app/providers/ToastProvider.jsx';
import { ManageClasses } from './ManageClasses.jsx';

const API = 'http://localhost:4000/api';
const courses = [
  { _id: 'course1', id: 'IT101', name: 'Nhập môn lập trình', credits: 3, fee: 1500000, department: 'CNTT' },
  { _id: 'course2', id: 'ENG101', name: 'Tiếng Anh', credits: 2, fee: 1000000, department: 'Ngoại ngữ' },
];

const server = setupServer(
  http.get(`${API}/courses`, () => HttpResponse.json({
    data: courses,
    meta: { page: 1, pages: 1, total: courses.length },
  })),
  http.get(`${API}/classes`, () => HttpResponse.json({
    data: [{ _id: 'section1', id: 'IT101-01', status: 'Đang mở', enrolledCount: 5 }],
    meta: { page: 1, pages: 1, total: 1 },
  })),
  http.get(`${API}/departments`, () => HttpResponse.json({
    data: [
      { id: 'CNTT', name: 'CNTT' },
      { id: 'NN', name: 'Ngoại ngữ' },
    ],
  }))
);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <ConfirmProvider>
            <ManageClasses />
          </ConfirmProvider>
        </ToastProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe('ManageClasses course list', () => {
  it('displays canonical course records instead of individual class sections', async () => {
    renderPage();

    expect(await screen.findByText('Nhập môn lập trình')).toBeInTheDocument();
    expect(screen.getByText('Tiếng Anh')).toBeInTheDocument();
    expect(screen.getByText('IT101')).toBeInTheDocument();
    expect(screen.queryByText('IT101-01')).not.toBeInTheDocument();
  });
});
