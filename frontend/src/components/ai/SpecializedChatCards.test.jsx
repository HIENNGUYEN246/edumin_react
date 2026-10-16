import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ApprovalRequestCard } from './ApprovalRequestCard.jsx';
import { TeacherDocumentCard } from './TeacherDocumentCard.jsx';
import { ChatMessageRenderer } from './ChatMessageRenderer.jsx';

describe('Specialized AI Chatbot UI Components', () => {
  describe('ApprovalRequestCard (Admin Approval & Permissions UI)', () => {
    it('renders single approval card with requester name, role badge, and permission details', () => {
      const card = {
        id: 'req-001',
        requestId: 'req-001',
        title: 'Nguyễn Văn An',
        requesterName: 'Nguyễn Văn An',
        requesterRole: 'sinh-vien',
        code: 'Yêu cầu #REQ1',
        permission: 'Xin cấp quyền cập nhật ảnh thẻ & CCCD',
        reason: 'Cần cập nhật hồ sơ tốt nghiệp',
        status: 'pending',
        details: [
          { label: 'Người yêu cầu', value: 'Nguyễn Văn An' },
          { label: 'Vai trò', value: 'Sinh viên' },
        ],
      };

      render(
        <ApprovalRequestCard
          card={card}
          onApprove={vi.fn()}
          onReject={vi.fn()}
        />
      );

      expect(screen.getAllByText('Nguyễn Văn An').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Sinh viên').length).toBeGreaterThan(0);
      expect(screen.getByText(/Xin cấp quyền cập nhật ảnh thẻ & CCCD/i)).toBeInTheDocument();
      expect(screen.getByText(/Cần cập nhật hồ sơ tốt nghiệp/i)).toBeInTheDocument();

      // Green Accept and Red Reject buttons
      expect(screen.getByRole('button', { name: /Xác nhận duyệt nhanh/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Từ chối/i })).toBeInTheDocument();
    });

    it('clicking [Phê duyệt / Accept] triggers onApprove and updates inline status without reload', async () => {
      const onApproveMock = vi.fn().mockResolvedValueOnce();
      const card = {
        id: 'req-002',
        requestId: 'req-002',
        title: 'ThS. Trần Thị Mai',
        requesterRole: 'giao-vien',
        permission: 'Phân quyền quản lý lớp học phần & duyệt điểm',
        status: 'pending',
      };

      render(
        <ApprovalRequestCard
          card={card}
          onApprove={onApproveMock}
          onReject={vi.fn()}
        />
      );

      const acceptBtn = screen.getByRole('button', { name: /Xác nhận duyệt nhanh/i });
      fireEvent.click(acceptBtn);

      expect(onApproveMock).toHaveBeenCalledWith('req-002', 'ThS. Trần Thị Mai');

      await waitFor(() => {
        expect(screen.getAllByText(/Đã phê duyệt/i).length).toBeGreaterThan(0);
      });
    });

    it('clicking [Từ chối / Reject] triggers onReject and updates inline status without reload', async () => {
      const onRejectMock = vi.fn().mockResolvedValueOnce();
      const card = {
        id: 'req-003',
        requestId: 'req-003',
        title: 'Lê Hoàng Nam',
        requesterRole: 'sinh-vien',
        permission: 'Xin mở lại cổng đăng ký học phần',
        status: 'pending',
      };

      render(
        <ApprovalRequestCard
          card={card}
          onApprove={vi.fn()}
          onReject={onRejectMock}
        />
      );

      const rejectBtn = screen.getByRole('button', { name: /Từ chối/i });
      fireEvent.click(rejectBtn);

      expect(onRejectMock).toHaveBeenCalledWith('req-003', 'Lê Hoàng Nam');

      await waitFor(() => {
        expect(screen.getAllByText(/Đã từ chối/i).length).toBeGreaterThan(0);
      });
    });

    it('renders interactive table when card contains multiple requests', () => {
      const card = {
        id: 'batch-001',
        title: 'Duyệt danh sách yêu cầu chờ xử lý',
        requests: [
          {
            id: 'req-1',
            requestId: 'req-1',
            requesterName: 'Nguyễn Văn An',
            requesterRole: 'sinh-vien',
            permission: 'Cập nhật ảnh thẻ',
            status: 'pending',
          },
          {
            id: 'req-2',
            requestId: 'req-2',
            requesterName: 'ThS. Trần Thị Mai',
            requesterRole: 'giao-vien',
            permission: 'Phân quyền duyệt điểm',
            status: 'pending',
          },
        ],
      };

      render(
        <ApprovalRequestCard
          card={card}
          onApprove={vi.fn()}
          onReject={vi.fn()}
        />
      );

      expect(screen.getAllByText('Nguyễn Văn An').length).toBeGreaterThan(0);
      expect(screen.getAllByText('ThS. Trần Thị Mai').length).toBeGreaterThan(0);
      expect(screen.getAllByRole('button', { name: /Xác nhận duyệt nhanh/i })).toHaveLength(2);
      expect(screen.getAllByRole('button', { name: /Từ chối/i })).toHaveLength(2);
    });
  });

  describe('TeacherDocumentCard (Teacher Document Management & File Card UI)', () => {
    it('renders file card with proper format icon, size, update date and action buttons', () => {
      const card = {
        id: 'doc-001',
        title: 'Quản lý tài liệu học phần & bài giảng',
        documents: [
          {
            id: 'doc-1',
            docId: 'doc-1',
            name: 'GiaoTrinh_LapTrinhWeb_2026.pdf',
            format: 'pdf',
            sizeText: '4.8 MB',
            updatedAt: '15/10/2026',
            courseName: 'Lập trình Web',
          },
          {
            id: 'doc-2',
            docId: 'doc-2',
            name: 'Slide_Chuong1_TongQuan.pptx',
            format: 'pptx',
            sizeText: '2.3 MB',
            updatedAt: '14/10/2026',
            courseName: 'Lập trình Web',
          },
        ],
      };

      render(
        <TeacherDocumentCard
          card={card}
          onDownload={vi.fn()}
          onSendMessage={vi.fn()}
          onNavigate={vi.fn()}
        />
      );

      expect(screen.getByText('GiaoTrinh_LapTrinhWeb_2026.pdf')).toBeInTheDocument();
      expect(screen.getByText('Slide_Chuong1_TongQuan.pptx')).toBeInTheDocument();
      expect(screen.getByText('• 4.8 MB')).toBeInTheDocument();
      expect(screen.getByText('• 2.3 MB')).toBeInTheDocument();

      // Action buttons
      expect(screen.getAllByRole('button', { name: /Tải xuống/i })).toHaveLength(2);
      expect(screen.getAllByRole('button', { name: /Tạo Quiz ôn tập/i })).toHaveLength(2);
      expect(screen.getAllByRole('button', { name: /Xem chi tiết/i })).toHaveLength(2);
    });

    it('clicking [Tạo Quiz ôn tập] sends a targeted prompt to AI chatbot', () => {
      const onSendMessageMock = vi.fn();
      const card = {
        id: 'doc-003',
        documents: [
          {
            id: 'doc-3',
            name: 'KienTrucHeThong.pdf',
            courseName: 'Kiến trúc máy tính',
          },
        ],
      };

      render(
        <TeacherDocumentCard
          card={card}
          onSendMessage={onSendMessageMock}
        />
      );

      const quizBtn = screen.getByRole('button', { name: /Tạo Quiz ôn tập/i });
      fireEvent.click(quizBtn);

      expect(onSendMessageMock).toHaveBeenCalledWith(
        expect.stringContaining('Tạo cho tôi 5 câu quiz trắc nghiệm ôn tập dựa trên file KienTrucHeThong.pdf môn Kiến trúc máy tính')
      );
    });

    it('clicking [Tải xuống] triggers download handler', () => {
      const onDownloadMock = vi.fn();
      const card = {
        id: 'doc-004',
        documents: [
          {
            id: 'doc-4',
            name: 'BaiTapChuong2.docx',
            format: 'docx',
          },
        ],
      };

      render(
        <TeacherDocumentCard
          card={card}
          onDownload={onDownloadMock}
        />
      );

      const downloadBtn = screen.getByRole('button', { name: /Tải xuống/i });
      fireEvent.click(downloadBtn);

      expect(onDownloadMock).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'doc-4', name: 'BaiTapChuong2.docx' })
      );
    });
  });

  describe('ChatMessageRenderer (Message Types / Component Dispatcher)', () => {
    it('dispatches to ApprovalRequestCard when message contains approval card', () => {
      const message = {
        id: 'msg-admin-1',
        sender: 'assistant',
        text: 'Dưới đây là các yêu cầu chờ duyệt:',
        cards: [
          {
            id: 'req-test-1',
            type: 'APPROVAL_CARD',
            title: 'Nguyễn Văn An',
            requesterRole: 'sinh-vien',
            permission: 'Cập nhật CMND/CCCD',
            status: 'pending',
          },
        ],
      };

      render(
        <ChatMessageRenderer
          message={message}
          onApproveRequest={vi.fn()}
          onRejectRequest={vi.fn()}
        />
      );

      expect(screen.getAllByText('Nguyễn Văn An').length).toBeGreaterThan(0);
      expect(screen.getByRole('button', { name: /Xác nhận duyệt nhanh/i })).toBeInTheDocument();
    });

    it('dispatches to TeacherDocumentCard when message contains document card', () => {
      const message = {
        id: 'msg-teacher-1',
        sender: 'assistant',
        text: 'Đã quét tài liệu môn học:',
        cards: [
          {
            id: 'doc-test-1',
            type: 'DOCUMENT_CARD',
            name: 'Slide_LapTrinhHuongDoiTuong.pptx',
            format: 'pptx',
            sizeText: '3.1 MB',
            courseName: 'OOP',
          },
        ],
      };

      render(
        <ChatMessageRenderer
          message={message}
          onSendMessage={vi.fn()}
        />
      );

      expect(screen.getByText('Slide_LapTrinhHuongDoiTuong.pptx')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Tạo Quiz ôn tập/i })).toBeInTheDocument();
    });
  });
});
