import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { TeacherClassGradebook } from './TeacherClassGradebook.jsx';

vi.mock('../../api/classesApi.js', () => ({
  classesApi: {
    get: vi.fn().mockResolvedValue({
      id: 'IT101-01',
      courseId: 'IT101',
      courseName: 'Lập trình C++',
      gradeWeights: { attendance: 10, homework: 10, midterm: 30, presentation: 0, final: 50 },
      midtermQuizId: 'quiz-mid-1',
      finalQuizId: null,
    }),
    students: vi.fn().mockResolvedValue({
      class: {
        id: 'IT101-01',
        midtermQuiz: { _id: 'quiz-mid-1', title: 'Quiz Giữa Kỳ 1' },
        finalQuiz: null,
      },
      availableQuizzes: [
        { _id: 'quiz-mid-1', title: 'Quiz Giữa Kỳ 1', questionCount: 15, dueDate: '2026-11-20' },
        { _id: 'quiz-fin-1', title: 'Quiz Cuối Kỳ 1', questionCount: 30, dueDate: '2026-12-20' },
      ],
      students: [
        {
          _id: 's-01',
          id: 101,
          hoTen: 'Nguyễn Văn Sinh Viên',
          manualGrades: {},
          attendanceStats: {
            total: 10,
            present: 9,
            late: 1,
            excused: 0,
            absent: 0,
            rate: 95,
            autoScore: 9.5,
            isOverridden: false,
          },
          quizMidterm: {
            quizId: 'quiz-mid-1',
            quizTitle: 'Quiz Giữa Kỳ 1',
            score: 8.5,
            isOverridden: false,
          },
          quizFinal: null,
          homeworkGrade: 9.0,
          homeworkQuizCount: 3,
          homeworkQuizTotal: 3,
          finalScore: 8.8,
        },
      ],
    }),
    updateStudentGrades: vi.fn().mockResolvedValue({
      manualGrades: { attendance: 10 },
      finalScore: 8.9,
    }),
    updateGradeConfig: vi.fn().mockResolvedValue({
      success: true,
      midtermQuizId: 'quiz-mid-1',
      finalQuizId: 'quiz-fin-1',
    }),
  },
}));

import { classesApi } from '../../api/classesApi.js';

vi.mock('../../app/providers/ToastProvider.jsx', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

function renderGradebook() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/teacher/classes/c-01/gradebook']}>
        <Routes>
          <Route path="/teacher/classes/:id/gradebook" element={<TeacherClassGradebook />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('TeacherClassGradebook - Smart Grades & Syncing', () => {
  it('renders auto-filled attendance score from Attendance records and allows direct editing without override label', async () => {
    renderGradebook();

    // Student should be visible
    const studentName = await screen.findByText('Nguyễn Văn Sinh Viên');
    expect(studentName).toBeInTheDocument();

    // Attendance input should be auto-filled with 9.5
    const attInput = screen.getByLabelText(/(Chuyên cần|Điểm danh) - Nguyễn Văn Sinh Viên/i);
    expect(attInput).toHaveValue(9.5);

    // Shows auto attendance indicator
    expect(screen.getByText(/9\/10 buổi/i)).toBeInTheDocument();

    // Manually type 10 to edit ("sửa là sửa luôn")
    fireEvent.change(attInput, { target: { value: '10' } });
    expect(attInput).toHaveValue(10);

    // No override indicator or original score clutter
    expect(screen.queryByText('Ghi đè')).not.toBeInTheDocument();
    expect(screen.queryByText(/Gốc:/)).not.toBeInTheDocument();
  });

  it('renders auto-synced midterm grade from linked Quiz and shows override indicator when edited', async () => {
    renderGradebook();

    await screen.findByText('Nguyễn Văn Sinh Viên');

    // Midterm input is auto-filled with quiz score 8.5
    const midInput = screen.getByLabelText(/Giữa kỳ - Nguyễn Văn Sinh Viên/i);
    expect(midInput).toHaveValue(8.5);

    // Shows quiz indicator
    expect(screen.getByText(/Quiz: 8.5\/10/i)).toBeInTheDocument();

    // Lecturer types 9.0 override
    fireEvent.change(midInput, { target: { value: '9' } });
    expect(midInput).toHaveValue(9);

    // Button to revert to original quiz score is shown
    const revertBtn = screen.getByRole('button', { name: /Quiz: 8.5/i });
    expect(revertBtn).toBeInTheDocument();

    fireEvent.click(revertBtn);
    expect(midInput).toHaveValue(8.5);
  });

  it('opens Quiz Configuration modal allowing teacher to link or unlink online quizzes', async () => {
    renderGradebook();

    await screen.findByText('Nguyễn Văn Sinh Viên');

    // Button to open modal
    const configBtn = screen.getByRole('button', { name: /Cấu hình thi \(Quiz \/ Nhập tay\)/i });
    fireEvent.click(configBtn);

    // Modal opens
    expect(screen.getByText(/Cấu hình hình thức thi Giữa kỳ & Cuối kỳ/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Cột điểm Giữa kỳ/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Cột điểm Cuối kỳ/i)).toBeInTheDocument();
  });

  it('enforces mutual exclusion by completely hiding the quiz chosen in the opposite dropdown', async () => {
    renderGradebook();

    await screen.findByText('Nguyễn Văn Sinh Viên');

    // Open Quiz Configuration modal
    const configBtn = screen.getByRole('button', { name: /Cấu hình thi \(Quiz \/ Nhập tay\)/i });
    fireEvent.click(configBtn);

    const midSelect = screen.getByLabelText(/Cột điểm Giữa kỳ/i);
    const finalSelect = screen.getByLabelText(/Cột điểm Cuối kỳ/i);

    // Initially midterm is quiz-mid-1
    expect(midSelect).toHaveValue('quiz-mid-1');
    expect(finalSelect).toHaveValue('');

    // In Final dropdown, quiz-mid-1 must be completely hidden (null)
    const finalMidOption = finalSelect.querySelector('option[value="quiz-mid-1"]');
    expect(finalMidOption).toBeNull();

    // In Final dropdown, quiz-fin-1 is available
    const finalFinOption = finalSelect.querySelector('option[value="quiz-fin-1"]');
    expect(finalFinOption).not.toBeNull();

    // When Final chooses quiz-fin-1
    fireEvent.change(finalSelect, { target: { value: 'quiz-fin-1' } });
    expect(finalSelect).toHaveValue('quiz-fin-1');

    // In Midterm dropdown, quiz-fin-1 must now be completely hidden (null)
    const midFinOption = midSelect.querySelector('option[value="quiz-fin-1"]');
    expect(midFinOption).toBeNull();

    // If teacher switches midterm to manual ('')
    fireEvent.change(midSelect, { target: { value: '' } });
    expect(midSelect).toHaveValue('');

    // In Final dropdown, quiz-mid-1 reappears!
    expect(finalSelect.querySelector('option[value="quiz-mid-1"]')).not.toBeNull();
  });

  it('filters students by search input and completion status in teacher gradebook', async () => {
    classesApi.students.mockResolvedValueOnce({
      class: {
        id: 'IT101-01',
        midtermQuiz: { _id: 'quiz-mid-1', title: 'Quiz Giữa Kỳ 1' },
        finalQuiz: null,
      },
      availableQuizzes: [],
      students: [
        {
          _id: 's-01',
          id: 101,
          hoTen: 'Nguyễn Văn Sinh Viên',
          manualGrades: { final: 8.5 },
          attendanceStats: { autoScore: 9.5 },
          quizMidterm: { score: 8.5 },
          homeworkGrade: 9.0,
        },
        {
          _id: 's-02',
          id: 102,
          hoTen: 'Trần Thị Thu Thảo',
          manualGrades: { final: null }, // incomplete final
          attendanceStats: { autoScore: 8.0 },
          quizMidterm: { score: 7.0 },
          homeworkGrade: 8.0,
        },
      ],
    });

    renderGradebook();

    await screen.findByText('Nguyễn Văn Sinh Viên');
    expect(screen.getByText('Trần Thị Thu Thảo')).toBeInTheDocument();

    // 1. Search by student name
    const searchInput = screen.getByPlaceholderText(/Tìm theo tên hoặc mã SV/i);
    fireEvent.change(searchInput, { target: { value: 'Thảo' } });

    expect(screen.getByText('Trần Thị Thu Thảo')).toBeInTheDocument();
    expect(screen.queryByText('Nguyễn Văn Sinh Viên')).not.toBeInTheDocument();

    // Reset search
    fireEvent.change(searchInput, { target: { value: '' } });
    expect(screen.getByText('Nguyễn Văn Sinh Viên')).toBeInTheDocument();
    expect(screen.getByText('Trần Thị Thu Thảo')).toBeInTheDocument();

    // 2. Filter by status: "Đã nhập đủ điểm"
    const statusSelect = screen.getByLabelText(/Trạng thái điểm/i);
    fireEvent.change(statusSelect, { target: { value: 'completed' } });

    expect(screen.getByText('Nguyễn Văn Sinh Viên')).toBeInTheDocument();
    expect(screen.queryByText('Trần Thị Thu Thảo')).not.toBeInTheDocument();

    // 3. Filter by status: "Chưa nhập đủ điểm"
    fireEvent.change(statusSelect, { target: { value: 'pending' } });

    expect(screen.getByText('Trần Thị Thu Thảo')).toBeInTheDocument();
    expect(screen.queryByText('Nguyễn Văn Sinh Viên')).not.toBeInTheDocument();
  });
});


