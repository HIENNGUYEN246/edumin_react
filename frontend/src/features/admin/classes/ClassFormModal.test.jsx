import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClassFormModal } from './ClassFormModal.jsx';
import { getNextDate, addDaysToDate } from '../../../lib/format.js';

vi.mock('../../../api/teachersApi.js', () => ({
  teachersApi: {
    list: vi.fn().mockResolvedValue({ data: [{ id: 1, hoTen: 'Nguyễn Văn A', department: 'CNTT' }] }),
  },
}));

vi.mock('../../../api/classesApi.js', () => ({
  classesApi: {
    nextCode: vi.fn().mockResolvedValue({ data: { nextCode: 'IT101-01' } }),
  },
  CLASS_STATUSES: ['Nháp', 'Đang mở', 'Đã đóng', 'Đã hủy'],
}));

vi.mock('../../../api/coursesApi.js', () => ({
  coursesApi: {
    list: vi.fn().mockResolvedValue({ data: [{ id: 'IT101', name: 'Lập trình', department: 'CNTT' }] }),
  },
}));

function renderModal(props = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ClassFormModal
        open={true}
        mode="create"
        courseId="IT101"
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        {...props}
      />
    </QueryClientProvider>
  );
}

describe('ClassFormModal registration date picker & validation', () => {
  it('renders date-only pickers (type="date") for registration start and end', () => {
    renderModal();

    const regStartInput = screen.getByLabelText(/Bắt đầu đăng ký/i);
    const regEndInput = screen.getByLabelText(/Kết thúc đăng ký/i);
    const studyStartInput = screen.getByLabelText(/Bắt đầu học/i);

    expect(regStartInput).toHaveAttribute('type', 'date');
    expect(regEndInput).toHaveAttribute('type', 'date');
    expect(studyStartInput).toHaveAttribute('type', 'date');
  });

  it('computes dynamic min attribute for registrationEnd and studyStart', () => {
    renderModal();

    const regStartInput = screen.getByLabelText(/Bắt đầu đăng ký/i);
    const regEndInput = screen.getByLabelText(/Kết thúc đăng ký/i);
    const studyStartInput = screen.getByLabelText(/Bắt đầu học/i);

    fireEvent.change(regStartInput, { target: { value: '2026-11-10' } });
    expect(regEndInput).toHaveAttribute('min', getNextDate('2026-11-10'));

    fireEvent.change(regEndInput, { target: { value: '2026-11-20' } });
    expect(studyStartInput).toHaveAttribute('min', getNextDate('2026-11-20'));
  });

  it('rejects form submission when studyStart is on or before registrationEnd', async () => {
    const onSubmit = vi.fn();
    renderModal({ onSubmit });

    fireEvent.change(screen.getByLabelText(/Tên lớp học phần/i), { target: { value: 'Lớp 01' } });
    fireEvent.change(screen.getByLabelText(/Phòng học/i), { target: { value: 'A101' } });
    fireEvent.change(screen.getByLabelText(/Sĩ số tối đa/i), { target: { value: '30' } });
    fireEvent.change(screen.getByLabelText(/Bắt đầu đăng ký/i), { target: { value: '2026-11-10' } });
    fireEvent.change(screen.getByLabelText(/Kết thúc đăng ký/i), { target: { value: '2026-11-20' } });
    // Same day as registrationEnd -> invalid!
    fireEvent.change(screen.getByLabelText(/Bắt đầu học/i), { target: { value: '2026-11-20' } });

    const submitBtn = screen.getByRole('button', { name: /Lưu/i });
    fireEvent.click(submitBtn);

    expect(onSubmit).not.toHaveBeenCalled();
    expect(await screen.findByText(/Thời điểm bắt đầu học bắt buộc phải diễn ra sau thời điểm kết thúc đăng ký/i)).toBeInTheDocument();
  });

  it('automatically fills registrationEnd with start date + 7 days when registrationStart changes', () => {
    renderModal();

    const regStartInput = screen.getByLabelText(/Bắt đầu đăng ký/i);
    const regEndInput = screen.getByLabelText(/Kết thúc đăng ký/i);

    fireEvent.change(regStartInput, { target: { value: '2026-11-10' } });

    expect(regEndInput.value).toBe(addDaysToDate('2026-11-10', 7));
    expect(regEndInput.value).toBe('2026-11-17');
  });

  it('validates grade weights sum to 100% and displays error message if sum is not 100%', async () => {
    const onSubmit = vi.fn();
    renderModal({ onSubmit });

    const attendanceWeight = screen.getByLabelText(/Trọng số Điểm chuyên cần/i);
    fireEvent.change(attendanceWeight, { target: { value: '30' } }); // Sum now 120%

    expect(screen.getByText(/Tổng: 120%/i)).toBeInTheDocument();

    const submitBtn = screen.getByRole('button', { name: /Lưu/i });
    fireEvent.click(submitBtn);

    expect(onSubmit).not.toHaveBeenCalled();
    expect(await screen.findByText(/Tổng trọng số các cột điểm phải bằng đúng 100%/i)).toBeInTheDocument();
  });
});

