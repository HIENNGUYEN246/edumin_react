import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ClassStudentsPage } from './ClassStudentsPage.jsx';

const { mockUseClassStudents } = vi.hoisted(() => ({ mockUseClassStudents: vi.fn() }));

vi.mock('./useClasses.js', () => ({
  useClassStudents: (...args) => mockUseClassStudents(...args),
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/classes/course/course-1/class/class-1/students']}>
      <Routes>
        <Route
          path="/admin/classes/course/:courseId/class/:classId/students"
          element={<ClassStudentsPage />}
        />
      </Routes>
    </MemoryRouter>
  );
}

describe('ClassStudentsPage', () => {
  const students = Array.from({ length: 45 }, (_, index) => ({
    _id: `student-${index + 1}`,
    id: index + 1,
    hoTen: `Sinh viên ${String(index + 1).padStart(2, '0')}`,
    email: `student${index + 1}@university.edu.vn`,
    className: index % 2 ? 'CNTT01' : '',
    department: 'Công Nghệ Thông Tin',
  }));

  it('shows a full page with paginated students and supports search', () => {
    mockUseClassStudents.mockReturnValue({
      data: {
        class: { courseName: 'Nhập môn lập trình', id: 'IT101-01', className: 'Lớp 01' },
        students,
      },
      isLoading: false,
      isError: false,
    });

    renderPage();

    expect(screen.getByRole('heading', { name: 'Danh sách sinh viên đăng ký' })).toBeInTheDocument();
    expect(screen.getByText('45 sinh viên')).toBeInTheDocument();
    expect(screen.getByText('Sinh viên 01')).toBeInTheDocument();
    expect(screen.getByText('Sinh viên 20')).toBeInTheDocument();
    expect(screen.queryByText('Sinh viên 21')).not.toBeInTheDocument();

    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[buttons.length - 1]);
    expect(screen.getByText('Sinh viên 21')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Tìm sinh viên' }), {
      target: { value: 'student45@university.edu.vn' },
    });
    expect(screen.getByText('Sinh viên 45')).toBeInTheDocument();
    expect(screen.queryByText('Sinh viên 21')).not.toBeInTheDocument();
  });
});
