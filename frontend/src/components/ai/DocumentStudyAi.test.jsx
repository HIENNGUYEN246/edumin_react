import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { InteractiveQuizCard } from './InteractiveQuizCard.jsx';
import { DocumentSummaryCard } from './DocumentSummaryCard.jsx';

describe('InteractiveQuizCard Component', () => {
  const sampleQuizCard = {
    id: 'quiz-1',
    title: 'Bộ Quiz ôn tập: Lập trình Web',
    subtitle: 'Lập trình Web • 2 câu hỏi trắc nghiệm kèm giải thích',
    code: 'CNTT101-01',
    questions: [
      {
        id: 'q1',
        question: 'Trong React, Virtual DOM giúp tối ưu hóa hiệu năng render giao diện chủ yếu nhờ vào quá trình nào?',
        options: [
          'A. Tự động biên dịch mã sang WebAssembly',
          'B. So sánh khác biệt (Diffing) giữa cây Virtual DOM cũ và mới để cập nhật tối thiểu vào DOM thật',
          'C. Lưu trữ dữ liệu lên LocalStorage',
          'D. Thay thế giao thức HTTP bằng WebSockets',
        ],
        correctIndex: 1,
        explanation: 'Virtual DOM so sánh Diffing và chỉ cập nhật các phần tử thay đổi lên DOM thực tế.',
        concept: 'Virtual DOM & Diffing',
      },
      {
        id: 'q2',
        question: 'Cú pháp Destructuring trong ES6 cho phép thực hiện điều gì?',
        options: [
          'A. Xóa hoàn toàn một object ra khỏi bộ nhớ Heap',
          'B. Trích xuất trực tiếp các thuộc tính của Object hoặc phần tử của Array vào các biến riêng biệt',
          'C. Tự động chuyển đổi mã đồng bộ sang bất đồng bộ',
          'D. Mã hóa chuỗi JSON thành mã nhị phân',
        ],
        correctIndex: 1,
        explanation: 'Destructuring cho phép trích xuất các giá trị từ Object hoặc Array vào các biến độc lập.',
        concept: 'JavaScript ES6+',
      },
    ],
  };

  it('renders quiz title, questions, and initial score of 0', () => {
    render(<InteractiveQuizCard card={sampleQuizCard} />);

    expect(screen.getByText('Bộ Quiz ôn tập: Lập trình Web')).toBeInTheDocument();
    expect(screen.getByText('CNTT101-01')).toBeInTheDocument();
    expect(screen.getByText(/Tiến độ:/)).toBeInTheDocument();
    expect(screen.getByText('0/2')).toBeInTheDocument();
    expect(screen.getByText('0.0')).toBeInTheDocument();

    // Rationale should not be visible before answering
    expect(screen.queryByText(/Giải thích chi tiết \(Rationale\):/)).not.toBeInTheDocument();
  });

  it('handles correct answer selection and shows rationale', () => {
    render(<InteractiveQuizCard card={sampleQuizCard} />);

    const correctOptionBtn = screen.getByText(/So sánh khác biệt \(Diffing\)/);
    fireEvent.click(correctOptionBtn);

    // Score increases to 5.0 (1/2 correct)
    expect(screen.getByText('Chính xác')).toBeInTheDocument();
    expect(screen.getByText('5.0')).toBeInTheDocument();
    expect(screen.getByText(/Virtual DOM so sánh Diffing/)).toBeInTheDocument();
  });

  it('handles incorrect answer selection, shows correct indicator and rationale', () => {
    render(<InteractiveQuizCard card={sampleQuizCard} />);

    const wrongOptionBtn = screen.getByText(/Tự động biên dịch mã sang WebAssembly/);
    fireEvent.click(wrongOptionBtn);

    // Score remains 0.0 (0/2 correct)
    expect(screen.getByText('Chưa đúng')).toBeInTheDocument();
    expect(screen.getByText('0.0')).toBeInTheDocument();
    expect(screen.getByText(/Virtual DOM so sánh Diffing/)).toBeInTheDocument();
  });

  it('displays completion banner and supports reset quiz', () => {
    render(<InteractiveQuizCard card={sampleQuizCard} />);

    // Answer Q1 correctly
    fireEvent.click(screen.getByText(/So sánh khác biệt \(Diffing\)/));

    // Answer Q2 correctly
    fireEvent.click(screen.getByText(/Trích xuất trực tiếp các thuộc tính/));

    // Score is 10.0
    expect(screen.getByText('10.0')).toBeInTheDocument();
    expect(screen.getByText(/Bạn đã hoàn thành bộ Quiz! Đạt 2\/2 câu/)).toBeInTheDocument();

    // Click Làm lại
    const resetBtns = screen.getAllByText('Làm lại');
    fireEvent.click(resetBtns[0]);

    // Score is reset
    expect(screen.getByText('0.0')).toBeInTheDocument();
    expect(screen.queryByText(/Bạn đã hoàn thành bộ Quiz!/)).not.toBeInTheDocument();
  });

  it('calls onSendMessage when clicking Tạo thêm câu hỏi', () => {
    const handleSend = vi.fn();
    render(<InteractiveQuizCard card={sampleQuizCard} onSendMessage={handleSend} />);

    const addMoreBtn = screen.getByText('Tạo thêm câu hỏi');
    fireEvent.click(addMoreBtn);

    expect(handleSend).toHaveBeenCalledWith(expect.stringContaining('Tạo thêm 5 câu quiz trắc nghiệm ôn tập môn CNTT101-01'));
  });
});

describe('DocumentSummaryCard Component', () => {
  const sampleSummaryCard = {
    id: 'sum-1',
    title: 'Bản tóm tắt: Giáo trình Cơ sở dữ liệu',
    subtitle: 'Cơ sở dữ liệu • Chương 1',
    code: 'CS102-01',
    details: [
      { label: 'Học phần', value: 'Cơ sở dữ liệu' },
      { label: 'Phạm vi', value: 'Chương 1' },
    ],
    coreConcepts: [
      { concept: 'Nguyên lý ACID', definition: 'Atomicity, Consistency, Isolation, Durability.', formula: 'ACID' },
      { concept: 'Chuẩn hóa 2NF', definition: 'Loại bỏ phụ thuộc một phần.', formula: '2NF' },
      { concept: 'Phép JOIN', definition: 'Kết hợp dữ liệu từ nhiều bảng.', formula: 'JOIN' },
      { concept: 'B-Tree Index', definition: 'Tăng tốc độ truy vấn SELECT.', formula: 'O(log N)' },
    ],
  };

  it('renders summary title, details, and first 3 concepts by default', () => {
    render(<DocumentSummaryCard card={sampleSummaryCard} />);

    expect(screen.getByText('Bản tóm tắt: Giáo trình Cơ sở dữ liệu')).toBeInTheDocument();
    expect(screen.getByText('CS102-01')).toBeInTheDocument();
    expect(screen.getByText('Nguyên lý ACID')).toBeInTheDocument();
    expect(screen.getByText('Chuẩn hóa 2NF')).toBeInTheDocument();
    expect(screen.getByText('Phép JOIN')).toBeInTheDocument();

    // 4th concept is collapsed initially
    expect(screen.queryByText('B-Tree Index')).not.toBeInTheDocument();
    expect(screen.getByText('Xem thêm (1)')).toBeInTheDocument();
  });

  it('expands all concepts when clicking Xem thêm', () => {
    render(<DocumentSummaryCard card={sampleSummaryCard} />);

    const expandBtn = screen.getByText('Xem thêm (1)');
    fireEvent.click(expandBtn);

    expect(screen.getByText('B-Tree Index')).toBeInTheDocument();
    expect(screen.getByText('Thu gọn')).toBeInTheDocument();
  });

  it('triggers onSendMessage when clicking Tạo 5 câu Quiz ôn tập ngay', () => {
    const handleSend = vi.fn();
    render(<DocumentSummaryCard card={sampleSummaryCard} onSendMessage={handleSend} />);

    const createQuizBtn = screen.getByText('🎯 Tạo 5 câu Quiz ôn tập ngay');
    fireEvent.click(createQuizBtn);

    expect(handleSend).toHaveBeenCalledWith(expect.stringContaining('Tạo cho tôi 5 câu quiz trắc nghiệm ôn tập dựa trên file tài liệu'));
  });
});

