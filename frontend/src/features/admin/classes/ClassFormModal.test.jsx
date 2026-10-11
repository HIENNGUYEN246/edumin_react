import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClassFormModal } from './ClassFormModal.jsx';
import { getCurrentDateTimeLocal, getNextDate } from '../../../lib/format.js';

vi.mock('../../../api/teachersApi.js', () => ({
  teachersApi: {
    list: vi
      .fn()
      .mockResolvedValue({ data: [{ id: 1, hoTen: 'Nguyễn Văn A', department: 'CNTT' }] }),
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
    list: vi.fn().mockResolvedValue({
      data: [{ id: 'IT101', name: 'Lập trình', credits: 3, fee: 1500000, department: 'CNTT' }],
    }),
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

describe('ClassFormModal registration date-time picker & validation', () => {
  it('renders date-time pickers for registration start and end', () => {
    renderModal();

    const regStartInput = screen.getByLabelText(/Bắt đầu đăng ký/i);
    const regEndInput = screen.getByLabelText(/Kết thúc đăng ký/i);
    const studyStartInput = screen.getByLabelText(/Bắt đầu học/i);

    expect(regStartInput).toHaveAttribute('type', 'datetime-local');
    expect(regEndInput).toHaveAttribute('type', 'datetime-local');
    expect(studyStartInput).toHaveAttribute('type', 'date');
    expect(
      screen.queryByText(/Chọn chính xác ngày, giờ và phút bắt đầu nhận đăng ký/)
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Tự nhập thời điểm kết thúc/)).not.toBeInTheDocument();
  });

  it('sets registration end after the selected start and study start after the registration end date', () => {
    renderModal();

    const regStartInput = screen.getByLabelText(/Bắt đầu đăng ký/i);
    const regEndInput = screen.getByLabelText(/Kết thúc đăng ký/i);
    const studyStartInput = screen.getByLabelText(/Bắt đầu học/i);

    fireEvent.change(regStartInput, { target: { value: '2026-11-10T08:30' } });
    expect(regEndInput).toHaveAttribute('min', '2026-11-10T08:30');

    fireEvent.change(regEndInput, { target: { value: '2026-11-20T17:45' } });
    expect(studyStartInput).toHaveAttribute('min', getNextDate('2026-11-20'));
  });

  it('rejects form submission when studyStart is on or before registrationEnd', async () => {
    const onSubmit = vi.fn();
    renderModal({ onSubmit });

    fireEvent.change(screen.getByLabelText(/Tên lớp học phần/i), { target: { value: 'Lớp 01' } });
    fireEvent.change(screen.getByLabelText(/Phòng học/i), { target: { value: 'A101' } });
    fireEvent.change(screen.getByLabelText(/Sĩ số tối đa/i), { target: { value: '30' } });
    fireEvent.change(screen.getByLabelText(/Bắt đầu đăng ký/i), {
      target: { value: '2026-11-10T08:30' },
    });
    fireEvent.change(screen.getByLabelText(/Kết thúc đăng ký/i), {
      target: { value: '2026-11-20T17:45' },
    });
    // Same day as registrationEnd -> invalid!
    fireEvent.change(screen.getByLabelText(/Bắt đầu học/i), { target: { value: '2026-11-20' } });

    const submitBtn = screen.getByRole('button', { name: /Lưu/i });
    fireEvent.click(submitBtn);

    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      await screen.findByText(
        /Thời điểm bắt đầu học bắt buộc phải diễn ra sau thời điểm kết thúc đăng ký/i
      )
    ).toBeInTheDocument();
  });

  it('does not change registrationEnd when registrationStart changes', () => {
    renderModal();

    const regStartInput = screen.getByLabelText(/Bắt đầu đăng ký/i);
    const regEndInput = screen.getByLabelText(/Kết thúc đăng ký/i);

    fireEvent.change(regEndInput, { target: { value: '2026-11-17T17:00' } });
    fireEvent.change(regStartInput, { target: { value: '2026-11-10T08:30' } });

    expect(regEndInput.value).toBe('2026-11-17T17:00');
  });

  it('uses midnight and end-of-day defaults when editing legacy date-only values', () => {
    renderModal({
      mode: 'edit',
      initial: {
        registrationStart: '2026-11-10',
        registrationEnd: '2026-11-17',
      },
    });

    expect(screen.getByLabelText(/Bắt đầu đăng ký/i)).toHaveValue('2026-11-10T00:00');
    expect(screen.getByLabelText(/Kết thúc đăng ký/i)).toHaveValue('2026-11-17T23:59');
  });

  it('preserves existing registration hours and minutes when editing a class', () => {
    renderModal({
      mode: 'edit',
      initial: {
        registrationStart: '2026-11-10T08:30:45',
        registrationEnd: '2026-11-17T17:15:30',
      },
    });

    expect(screen.getByLabelText(/Bắt đầu đăng ký/i)).toHaveValue('2026-11-10T08:30');
    expect(screen.getByLabelText(/Kết thúc đăng ký/i)).toHaveValue('2026-11-17T17:15');
  });

  it('uses the current date and time as the minimum registration start in create mode', () => {
    renderModal();

    expect(screen.getByLabelText(/Bắt đầu đăng ký/i)).toHaveAttribute(
      'min',
      getCurrentDateTimeLocal()
    );
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
    expect(
      await screen.findByText(/Tổng trọng số các cột điểm phải bằng đúng 100%/i)
    ).toBeInTheDocument();
  });

  it('auto-fills fee based on course credits when blank, and keeps custom fee when entered', async () => {
    const onSubmit = vi.fn();
    renderModal({
      onSubmit,
      initial: {
        teacherId: 1,
        schedules: [{ dayId: '2', shiftId: 'S1' }],
        studyEnd: '2027-04-01',
      },
    });

    const feeInput = await screen.findByPlaceholderText(/Tự động: 1.500.000/i);
    expect(feeInput).toBeInTheDocument();

    const autoFeeBtn = screen.getByTitle(/Tính tự động dựa trên số tín chỉ/i);
    fireEvent.click(autoFeeBtn);
    expect(feeInput.value).toBe('1500000');

    // User can customize the fee
    fireEvent.change(feeInput, { target: { value: '2000000' } });
    expect(feeInput.value).toBe('2000000');

    // Fill valid form fields to submit
    fireEvent.change(screen.getByLabelText(/Tên lớp học phần/i), {
      target: { value: 'Lớp Lập Trình' },
    });
    fireEvent.change(screen.getByLabelText(/Phòng học/i), { target: { value: 'A101' } });
    fireEvent.change(screen.getByLabelText(/Sĩ số tối đa/i), { target: { value: '30' } });
    fireEvent.change(screen.getByLabelText(/Bắt đầu đăng ký/i), {
      target: { value: '2026-11-10T08:30' },
    });
    fireEvent.change(screen.getByLabelText(/Kết thúc đăng ký/i), {
      target: { value: '2026-11-17T17:00' },
    });
    fireEvent.change(screen.getByLabelText(/Bắt đầu học/i), { target: { value: '2026-11-20' } });
    fireEvent.change(screen.getByLabelText(/Kết thúc học/i), { target: { value: '2027-04-01' } });

    const submitBtn = screen.getByRole('button', { name: /Lưu/i });
    fireEvent.click(submitBtn);

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        fee: 2000000,
        registrationStart: '2026-11-10T08:30',
        registrationEnd: '2026-11-17T17:00',
      }),
      expect.any(Function)
    );
  });

  it('auto-suggests smart grade weights according to course and allows one-click apply', async () => {
    renderModal();

    // Suggested preset button for IT101 (3 TC)
    const suggestBtn = await screen.findByText(/Gợi ý cho môn/i);
    expect(suggestBtn).toBeInTheDocument();
    expect(suggestBtn).toHaveTextContent(/Chuẩn 3 TC/i);

    // Initial default weights for 3 TC
    const attendanceWeight = screen.getByLabelText(/Trọng số Điểm chuyên cần/i);
    const midtermWeight = screen.getByLabelText(/Trọng số Điểm thi giữa kỳ/i);
    const finalWeight = screen.getByLabelText(/Trọng số Điểm thi cuối kỳ/i);

    expect(attendanceWeight.value).toBe('10');
    expect(midtermWeight.value).toBe('30');
    expect(finalWeight.value).toBe('50');
  });
});
