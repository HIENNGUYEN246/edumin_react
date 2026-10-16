import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PersonFormModal } from './PersonFormModal.jsx';
import { getMaxBirthDate } from '../../../lib/format.js';

describe('PersonFormModal DOB restrictions', () => {
  it('calculates correct max birth date for student (17 years) and teacher (24 years)', () => {
    const studentMax = getMaxBirthDate(17);
    const teacherMax = getMaxBirthDate(24);

    const now = new Date();
    const expectedStudentYear = now.getFullYear() - 17;
    const expectedTeacherYear = now.getFullYear() - 24;

    expect(studentMax).toMatch(new RegExp(`^${expectedStudentYear}-\\d{2}-\\d{2}$`));
    expect(teacherMax).toMatch(new RegExp(`^${expectedTeacherYear}-\\d{2}-\\d{2}$`));
  });

  it('renders student form with max attribute and clamps manual date typing beyond limit', () => {
    const studentMax = getMaxBirthDate(17);
    const fields = [
      { name: 'hoTen', label: 'Họ tên', required: true },
      {
        name: 'dob',
        label: 'Ngày sinh',
        type: 'date',
        get max() {
          return studentMax;
        },
        hint: 'Tối đa: từ 17 tuổi trở lên',
      },
    ];

    const initial = { hoTen: 'Test Student', dob: '' };
    const onSubmit = vi.fn();

    render(
      <PersonFormModal
        open={true}
        mode="create"
        title="Thêm sinh viên"
        initial={initial}
        fields={fields}
        departments={[]}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    const dobInput = screen.getByLabelText(/Ngày sinh/i);
    expect(dobInput).toHaveAttribute('max', studentMax);
    expect(screen.getByText(/từ 17 tuổi trở lên/i)).toBeInTheDocument();

    // Type a date that is too young (e.g. today or next year)
    fireEvent.change(dobInput, { target: { value: '2025-01-01' } });
    // It should be automatically clamped to studentMax
    expect(dobInput.value).toBe(studentMax);
  });

  it('renders teacher form with max attribute and clamps manual date typing beyond limit', () => {
    const teacherMax = getMaxBirthDate(24);
    const fields = [
      { name: 'hoTen', label: 'Họ tên', required: true },
      {
        name: 'dob',
        label: 'Ngày sinh',
        type: 'date',
        get max() {
          return teacherMax;
        },
        hint: 'Tối đa: từ 24 tuổi trở lên',
      },
    ];

    const initial = { hoTen: 'Test Teacher', dob: '' };
    const onSubmit = vi.fn();

    render(
      <PersonFormModal
        open={true}
        mode="create"
        title="Thêm giáo viên"
        initial={initial}
        fields={fields}
        departments={[]}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    const dobInput = screen.getByLabelText(/Ngày sinh/i);
    expect(dobInput).toHaveAttribute('max', teacherMax);
    expect(screen.getByText(/từ 24 tuổi trở lên/i)).toBeInTheDocument();

    // Type a date that is too young for a teacher (e.g. 2010-01-01)
    fireEvent.change(dobInput, { target: { value: '2010-01-01' } });
    expect(dobInput.value).toBe(teacherMax);
  });
});

describe('PersonFormModal education validation', () => {
  it('accepts valid academic titles like "Giáo sư - Tiến sĩ (GS.TS)" without error', () => {
    const fields = [
      {
        name: 'education',
        label: 'Trình độ',
        type: 'select',
        required: true,
        validation: 'education',
        maxLength: 80,
        options: [
          { value: 'Giáo sư - Tiến sĩ (GS.TS)', label: 'Giáo sư - Tiến sĩ (GS.TS)' },
          { value: 'Phó Giáo sư - Tiến sĩ', label: 'Phó Giáo sư - Tiến sĩ (PGS.TS)' },
        ],
      },
    ];

    const initial = { education: '' };
    const onSubmit = vi.fn();

    render(
      <PersonFormModal
        open={true}
        mode="create"
        title="Thêm giảng viên"
        initial={initial}
        fields={fields}
        departments={[]}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    const select = screen.getByLabelText(/Trình độ/i);
    fireEvent.change(select, { target: { value: 'Giáo sư - Tiến sĩ (GS.TS)' } });
    fireEvent.blur(select);

    // Should not show validation error
    expect(screen.queryByText(/Trình độ chỉ gồm/i)).not.toBeInTheDocument();

    const submitBtn = screen.getByRole('button', { name: /Lưu|Thêm/i });
    fireEvent.click(submitBtn);

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ education: 'Giáo sư - Tiến sĩ (GS.TS)' }),
      expect.any(Function)
    );
  });

  it('rejects education containing forbidden symbols like exclamation mark', () => {
    const fields = [
      {
        name: 'education',
        label: 'Trình độ',
        type: 'text',
        required: true,
        validation: 'education',
        maxLength: 80,
      },
    ];

    const initial = { education: '' };
    const onSubmit = vi.fn();

    render(
      <PersonFormModal
        open={true}
        mode="create"
        title="Thêm giảng viên"
        initial={initial}
        fields={fields}
        departments={[]}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    const input = screen.getByLabelText(/Trình độ/i);
    fireEvent.change(input, { target: { value: 'Tiến sĩ!' } });
    fireEvent.blur(input);

    expect(screen.getByText(/Trình độ chỉ gồm chữ cái, khoảng trắng và các ký tự/i)).toBeInTheDocument();

    const submitBtn = screen.getByRole('button', { name: /Lưu|Thêm/i });
    fireEvent.click(submitBtn);

    expect(onSubmit).not.toHaveBeenCalled();
  });
});


