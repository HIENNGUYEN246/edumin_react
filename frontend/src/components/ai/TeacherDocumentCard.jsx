import React, { useState } from 'react';
import { downloadDocument } from '../../features/shared/useDocuments.js';

function getFileMeta(format = '', link = '', hasFile = true, fileName = '') {
  if (link && !hasFile) {
    return {
      icon: 'fa-link',
      color: 'text-purple-600 bg-purple-50 border-purple-200',
      label: 'Liên kết',
    };
  }
  let ext = String(format).toLowerCase().replace(/^\./, '');
  if (!ext || ext === 'raw') {
    const match = /\.([a-zA-Z0-9]+)$/i.exec(fileName || '');
    if (match) ext = match[1].toLowerCase();
  }
  if (ext === 'pdf') {
    return {
      icon: 'fa-file-pdf',
      color: 'text-rose-600 bg-rose-50 border-rose-200',
      label: 'PDF',
    };
  }
  if (['doc', 'docx', 'word'].includes(ext)) {
    return {
      icon: 'fa-file-word',
      color: 'text-blue-600 bg-blue-50 border-blue-200',
      label: 'Word',
    };
  }
  if (['ppt', 'pptx', 'slide', 'powerpoint'].includes(ext)) {
    return {
      icon: 'fa-file-powerpoint',
      color: 'text-amber-600 bg-amber-50 border-amber-200',
      label: 'Slide',
    };
  }
  if (['xls', 'xlsx', 'excel', 'csv'].includes(ext)) {
    return {
      icon: 'fa-file-excel',
      color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
      label: 'Excel',
    };
  }
  if (['mp4', 'mkv', 'avi', 'mov', 'video'].includes(ext)) {
    return {
      icon: 'fa-file-video',
      color: 'text-cyan-600 bg-cyan-50 border-cyan-200',
      label: 'Video',
    };
  }
  return {
    icon: 'fa-file-lines',
    color: 'text-indigo-600 bg-indigo-50 border-indigo-200',
    label: ext ? ext.toUpperCase() : 'Tài liệu',
  };
}

/**
 * Teacher Document Card for EduMin AI Chatbot.
 * Renders dedicated file card UI for teacher course documents with:
 * - Icon per file type (PDF, Word, Slide...), file name, size, update date.
 * - Quick action buttons: [Xem chi tiết], [Tải xuống], and [Tạo Quiz ôn tập từ tài liệu này].
 */
export function TeacherDocumentCard({
  card,
  onDownload,
  onGenerateQuiz,
  onNavigate,
  onSendMessage,
}) {
  const documents = Array.isArray(card.documents) && card.documents.length > 0
    ? card.documents
    : [card];

  const [downloadingId, setDownloadingId] = useState(null);

  const handleDownloadFile = async (doc) => {
    const docId = doc.docId || doc.id || doc._id;
    if (onDownload) {
      await onDownload(doc);
      return;
    }

    if (!docId) return;
    setDownloadingId(docId);
    try {
      await downloadDocument(docId);
    } catch {
      // fallback if file link exists
      if (doc.url || doc.link) {
        window.open(doc.url || doc.link, '_blank', 'noopener');
      }
    } finally {
      setDownloadingId(null);
    }
  };

  const handleCreateQuiz = (doc) => {
    if (onGenerateQuiz) {
      onGenerateQuiz(doc);
      return;
    }
    const docName = doc.name || doc.title || 'tài liệu học tập';
    const courseTitle = doc.courseName ? ` môn ${doc.courseName}` : '';
    const prompt = `Tạo cho tôi 5 câu quiz trắc nghiệm ôn tập dựa trên file ${docName}${courseTitle}`;
    if (onSendMessage) {
      onSendMessage(prompt);
    }
  };

  return (
    <div className="bg-slate-50/95 rounded-2xl p-3.5 sm:p-4 border border-indigo-100 shadow-sm space-y-3.5 text-slate-800 transition-all">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 border-b border-slate-200/70 pb-3">
        <div className="flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center shrink-0 shadow-2xs">
            <i className="fas fa-folder-tree text-xs" />
          </div>
          <div>
            <h4 className="font-bold text-xs sm:text-[13px] text-slate-900 leading-snug">
              {card.title || 'Quản lý tài liệu học phần & bài giảng'}
            </h4>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {card.subtitle || `Đã quét và tìm thấy ${documents.length} tài liệu bài giảng phù hợp`}
            </p>
          </div>
        </div>
        {card.code && (
          <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 whitespace-nowrap">
            {card.code}
          </span>
        )}
      </div>

      {/* File Cards List */}
      <div className="space-y-2.5">
        {documents.map((doc, idx) => {
          const docId = doc.docId || doc.id || doc._id || idx;
          const meta = getFileMeta(doc.format || doc.ext, doc.link, doc.hasFile || doc.size > 0, doc.fileName || doc.name);
          const isDownloading = downloadingId === docId;
          const fileName = doc.name || doc.title || 'Tài liệu học tập';
          const sizeText = doc.sizeText || doc.size || (doc.format ? '2.4 MB' : '');
          const updateDate = doc.updatedAt || doc.createdAt || 'Mới cập nhật';
          const courseLabel = doc.courseName || doc.className || 'Học phần';

          return (
            <div
              key={docId}
              className="bg-white rounded-xl p-3 sm:p-3.5 border border-slate-200/80 shadow-2xs space-y-3 transition hover:border-indigo-200"
            >
              {/* File Info Row */}
              <div className="flex items-start gap-3">
                {/* File Format Icon */}
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border text-base shadow-2xs ${meta.color}`}
                >
                  <i className={`fas ${meta.icon}`} />
                </div>

                {/* File Title & Meta */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h5
                      className="font-bold text-xs sm:text-[13px] text-slate-900 hover:text-indigo-600 transition leading-snug truncate"
                      title={fileName}
                    >
                      {fileName}
                    </h5>
                    <span
                      className={`shrink-0 px-2 py-0.2 text-[9px] font-bold rounded-md border uppercase ${meta.color}`}
                    >
                      {meta.label}
                    </span>
                  </div>

                  {/* Metadata Chips: Course, Size, Date */}
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1 text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                      <i className="fas fa-graduation-cap text-indigo-500 text-[10px]" />
                      <span>{courseLabel}</span>
                    </span>
                    {doc.classId && (
                      <span className="font-mono text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded border border-slate-200">
                        {doc.classId}
                      </span>
                    )}
                    {sizeText && (
                      <span className="font-mono text-slate-600">
                        • {sizeText}
                      </span>
                    )}
                    {updateDate && (
                      <span className="text-slate-400">
                        • {updateDate}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons Row */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100">
                <div className="flex flex-wrap items-center gap-1.5">
                  {/* Download button */}
                  <button
                    type="button"
                    disabled={isDownloading}
                    onClick={() => handleDownloadFile(doc)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold shadow-2xs transition active:scale-95 cursor-pointer disabled:opacity-50"
                    title="Tải tệp tài liệu này về máy"
                  >
                    {isDownloading ? (
                      <>
                        <i className="fas fa-spinner fa-spin text-[10px]" />
                        <span>Đang tải...</span>
                      </>
                    ) : (
                      <>
                        <i className="fas fa-download text-[10px]" />
                        <span>Tải xuống</span>
                      </>
                    )}
                  </button>

                  {/* Generate Quiz from this document button */}
                  <button
                    type="button"
                    onClick={() => handleCreateQuiz(doc)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-semibold shadow-2xs transition active:scale-95 cursor-pointer"
                    title="Yêu cầu AI sinh bộ 5 câu quiz trắc nghiệm ôn tập từ tài liệu này"
                  >
                    <i className="fas fa-clipboard-question text-amber-600 text-[11px]" />
                    <span>Tạo Quiz ôn tập</span>
                  </button>
                </div>

                {/* Details Navigation */}
                {onNavigate && (
                  <button
                    type="button"
                    onClick={() => onNavigate(card.action?.path || '/teacher/documents')}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 transition cursor-pointer ml-auto"
                  >
                    <span>Xem chi tiết</span>
                    <i className="fas fa-arrow-right text-[10px]" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Navigation */}
      {onNavigate && (
        <div className="pt-1 flex items-center justify-between text-xs border-t border-slate-200/70">
          <span className="text-[11px] text-slate-500">
            Giảng viên có thể tải lên tệp mới hoặc quản lý quyền truy cập tại kho tài liệu.
          </span>
          <button
            type="button"
            onClick={() => onNavigate(card.action?.path || '/teacher/documents')}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:text-indigo-900 bg-white hover:bg-indigo-50 border border-indigo-200 rounded-lg transition cursor-pointer shrink-0"
          >
            <span>Mở trang Quản lý tài liệu</span>
            <i className="fas fa-arrow-up-right-from-square text-[10px]" />
          </button>
        </div>
      )}
    </div>
  );
}

export default TeacherDocumentCard;

