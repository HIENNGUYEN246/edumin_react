import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDocumentDetail, getFileMeta, downloadDocument } from '../shared/useDocuments.js';
import { documentsApi } from '../../api/documentsApi.js';
import { Spinner } from '../../components/ui/Spinner.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { useToast } from '../../app/providers/ToastProvider.jsx';
import { formatDate } from '../../lib/format.js';

function formatFileSize(bytes) {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentViewerPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const { data: docData, isLoading, error } = useDocumentDetail(id);
  const doc = docData?.data || docData;

  const [activeTab, setActiveTab] = useState('reader'); // 'reader' | 'office' | 'raw'
  const [searchTerm, setSearchTerm] = useState('');
  const [fontSize, setFontSize] = useState(15); // in px
  const [isDownloading, setIsDownloading] = useState(false);
  const [showAiSummaryModal, setShowAiSummaryModal] = useState(false);
  const [selectedChapterIndex, setSelectedChapterIndex] = useState(0);

  const meta = useMemo(() => {
    if (!doc) return getFileMeta('', '', false);
    return getFileMeta(doc.format, doc.link, doc.hasFile || doc.size > 0, doc.fileName || doc.name);
  }, [doc]);

  const fileStreamUrl = useMemo(() => {
    if (!id) return '';
    return documentsApi.getFileUrl(id);
  }, [id]);

  const directFileUrl = useMemo(() => {
    if (!doc) return '';
    return doc.fileUrl || doc.directUrl || fileStreamUrl;
  }, [doc, fileStreamUrl]);

  const officeViewerEmbedUrl = useMemo(() => {
    if (!directFileUrl || !directFileUrl.startsWith('http')) return '';
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(directFileUrl)}`;
  }, [directFileUrl]);

  const officeViewerExternalUrl = useMemo(() => {
    if (!directFileUrl || !directFileUrl.startsWith('http')) return '';
    return `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(directFileUrl)}`;
  }, [directFileUrl]);

  const handleDownload = async () => {
    if (!doc) return;
    try {
      setIsDownloading(true);
      await downloadDocument(doc._id, doc.name);
      toast.success('Bắt đầu tải xuống tệp');
    } catch (err) {
      toast.error(err.message || 'Không thể tải xuống tài liệu');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleClose = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      window.close();
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 space-y-4">
        <Spinner />
        <p className="text-xs text-slate-500 font-medium">Đang tải nội dung tài liệu...</p>
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-md p-8 max-w-md w-full text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center text-2xl border border-rose-100">
            <i className="fas fa-file-circle-xmark" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-slate-800 text-base">Không tìm thấy tài liệu</h3>
            <p className="text-xs text-slate-500">
              {error?.message || 'Tài liệu không tồn tại hoặc bạn không có quyền truy cập vào tài liệu này.'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow cursor-pointer"
          >
            Đóng trang
          </button>
        </div>
      </div>
    );
  }

  const chapters = doc.chapters || [];
  const keyConcepts = doc.keyConcepts || [];
  const fullText = doc.extractedText || '';
  const sizeText = formatFileSize(doc.size);

  const isWord = meta.type === 'word';
  const isExcel = meta.type === 'excel';
  const isPpt = meta.type === 'powerpoint';
  const isPdf = meta.type === 'pdf';
  const isImage = meta.type === 'image';
  const isText = meta.type === 'text';
  const isVideo = meta.type === 'video';

  return (
    <div className="min-h-screen bg-slate-100/70 flex flex-col font-sans">
      {/* Top Header Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200/90 shadow-2xs px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Left: Back button & Document details */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={handleClose}
              className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center shrink-0 transition cursor-pointer"
              title="Quay lại danh sách"
            >
              <i className="fas fa-arrow-left text-xs" />
            </button>

            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border text-base shadow-2xs ${meta.color}`}
            >
              <i className={`fas ${meta.icon}`} />
            </div>

            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase shrink-0 ${meta.badgeColor}`}
                >
                  {meta.label}
                </span>
                <h1 className="font-bold text-slate-800 text-sm sm:text-base truncate max-w-lg" title={doc.name}>
                  {doc.name}
                </h1>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                {doc.courseName && (
                  <span className="font-medium text-slate-700 truncate max-w-[200px]">
                    {doc.courseName}
                  </span>
                )}
                {doc.classId && (
                  <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[10px]">
                    {doc.classId}
                  </span>
                )}
                {sizeText && (
                  <span className="text-slate-400 font-mono text-[11px]">• {sizeText}</span>
                )}
                {doc.uploadedBy && (
                  <span className="text-slate-400 text-[11px] truncate hidden sm:inline">
                    • Đăng bởi {doc.uploadedBy}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex flex-wrap items-center gap-2 self-end md:self-center shrink-0">
            {/* View Mode Tabs for Office docs */}
            {(isWord || isExcel || isPpt) && (
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab('reader')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                    activeTab === 'reader'
                      ? 'bg-white text-indigo-600 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  <i className="fas fa-book-open mr-1.5 text-[11px]" />
                  <span>Trình đọc văn bản</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('office')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                    activeTab === 'office'
                      ? 'bg-white text-indigo-600 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  <i className="fas fa-window-maximize mr-1.5 text-[11px]" />
                  <span>Office Viewer</span>
                </button>
              </div>
            )}

            {/* AI Summary button if summary or text exists */}
            {(doc.summary || fullText) && (
              <button
                type="button"
                onClick={() => setShowAiSummaryModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-bold transition shadow-2xs cursor-pointer active:scale-95"
                title="Xem tóm tắt thông minh từ AI"
              >
                <i className="fas fa-wand-magic-sparkles text-[11px] text-purple-600" />
                <span>AI Tóm tắt</span>
              </button>
            )}

            {/* Download file button */}
            {doc.hasFile && (
              <button
                type="button"
                disabled={isDownloading}
                onClick={handleDownload}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-2xs hover:shadow active:scale-95 cursor-pointer disabled:opacity-50"
                title="Tải tệp gốc về máy"
              >
                {isDownloading ? (
                  <i className="fas fa-spinner fa-spin text-[11px]" />
                ) : (
                  <i className="fas fa-download text-[11px]" />
                )}
                <span>Tải tệp ({meta.label})</span>
              </button>
            )}

            {/* External link button */}
            {doc.link && (
              <a
                href={doc.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition border border-slate-200 shadow-2xs"
              >
                <i className="fas fa-arrow-up-right-from-square text-[11px]" />
                <span>Mở liên kết ngoài</span>
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Main View Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col">
        {/* CASE 1: PDF DOCUMENT */}
        {isPdf && (
          <div className="flex-1 flex flex-col bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden min-h-[calc(100vh-140px)]">
            <div className="p-3 bg-slate-50/80 border-b border-slate-200/80 flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold flex items-center gap-2">
                <i className="fas fa-file-pdf text-rose-500" />
                <span>Xem trực tuyến tệp PDF qua trình duyệt</span>
              </span>
              <a
                href={fileStreamUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:text-indigo-800 font-bold inline-flex items-center gap-1"
              >
                <span>Mở bằng trình đọc gốc của trình duyệt</span>
                <i className="fas fa-external-link-alt text-[10px]" />
              </a>
            </div>
            <iframe
              src={fileStreamUrl}
              title={doc.name}
              className="w-full flex-1 border-0 min-h-[calc(100vh-180px)]"
            />
          </div>
        )}

        {/* CASE 2: OFFICE VIEWER TAB (Word, Excel, PPT) */}
        {(isWord || isExcel || isPpt) && activeTab === 'office' && (
          <div className="flex-1 flex flex-col bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden min-h-[calc(100vh-140px)]">
            <div className="p-3 bg-slate-50/80 border-b border-slate-200/80 flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold flex items-center gap-2">
                <i className="fas fa-microsoft text-indigo-500" />
                <span>Trình xem trực tuyến Microsoft Office Online Viewer</span>
              </span>
              <div className="flex items-center gap-3">
                {officeViewerExternalUrl && (
                  <a
                    href={officeViewerExternalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:text-indigo-800 font-bold inline-flex items-center gap-1"
                  >
                    <span>Mở toàn màn hình</span>
                    <i className="fas fa-arrow-up-right-from-square text-[10px]" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={handleDownload}
                  className="text-slate-600 hover:text-slate-800 font-bold inline-flex items-center gap-1 cursor-pointer"
                >
                  <i className="fas fa-download text-[10px]" />
                  <span>Tải tệp gốc</span>
                </button>
              </div>
            </div>

            {officeViewerEmbedUrl ? (
              <iframe
                src={officeViewerEmbedUrl}
                title={doc.name}
                className="w-full flex-1 border-0 min-h-[calc(100vh-180px)]"
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-4">
                <i className="fas fa-triangle-exclamation text-3xl text-amber-500" />
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-800 text-sm">Chưa thể nhúng Office Viewer</h4>
                  <p className="text-xs text-slate-500 max-w-md">
                    Bạn có thể chuyển sang tab &quot;Trình đọc văn bản&quot; để đọc trực tiếp toàn bộ nội dung hoặc tải tệp gốc về máy.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('reader')}
                    className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold cursor-pointer"
                  >
                    Mở trình đọc văn bản
                  </button>
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                  >
                    Tải tệp về máy
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* CASE 3: TEXT / WORD / PPT / EXCEL READER VIEW */}
        {((isWord || isExcel || isPpt) && activeTab === 'reader') || isText ? (
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-[calc(100vh-140px)]">
            {/* Left Sidebar: Chapters & Key Concepts */}
            <div className="lg:col-span-1 space-y-4">
              {/* Document Overview Card */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span>Mục lục nội dung</span>
                  <span className="text-indigo-600 font-mono text-[11px]">
                    {chapters.length > 0 ? `${chapters.length} phần` : 'Toàn văn'}
                  </span>
                </h4>

                {chapters.length > 0 ? (
                  <div className="space-y-1 max-h-[50vh] overflow-y-auto custom-scrollbar pr-1">
                    {chapters.map((ch, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setSelectedChapterIndex(idx);
                          const el = document.getElementById(`chapter-${idx}`);
                          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }}
                        className={`w-full text-left p-2.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center justify-between gap-2 ${
                          selectedChapterIndex === idx
                            ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200/80'
                            : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <span className="truncate">
                          {ch.chapterNumber ? `Chương ${ch.chapterNumber}: ` : ''}
                          {ch.title || `Phần ${idx + 1}`}
                        </span>
                        <i className="fas fa-chevron-right text-[10px] text-slate-400 shrink-0" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">
                    Tài liệu không phân chia chương mục rõ ràng. Hiển thị dưới dạng toàn văn trích xuất.
                  </p>
                )}
              </div>

              {/* Key Concepts Widget */}
              {keyConcepts.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 space-y-3">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <i className="fas fa-lightbulb text-amber-500" />
                    <span>Khái niệm trọng tâm ({keyConcepts.length})</span>
                  </h4>
                  <div className="space-y-2 max-h-[40vh] overflow-y-auto custom-scrollbar pr-1">
                    {keyConcepts.map((kc, idx) => (
                      <div key={idx} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-1">
                        <span className="font-bold text-slate-800 text-xs text-indigo-700 block">
                          {kc.concept}
                        </span>
                        <p className="text-slate-600 text-[11px] leading-relaxed">
                          {kc.definition}
                        </p>
                        {kc.formula && (
                          <div className="mt-1 px-2 py-1 rounded bg-white border border-slate-200 font-mono text-[10px] text-slate-800">
                            {kc.formula}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Main Pane: Structured Reader */}
            <div className="lg:col-span-3 flex flex-col bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
              {/* Reader Controls Toolbar */}
              <div className="p-3 bg-slate-50/80 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                {/* Search in document */}
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[11px]" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Tìm kiếm từ khóa trong tài liệu..."
                    className="w-full pl-8 pr-7 py-1.5 rounded-lg text-xs bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                    >
                      <i className="fas fa-times-circle" />
                    </button>
                  )}
                </div>

                {/* Font Size & Copy Controls */}
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 text-[11px]">Cỡ chữ:</span>
                  <button
                    type="button"
                    onClick={() => setFontSize((s) => Math.max(12, s - 1))}
                    className="w-7 h-7 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center font-bold text-xs cursor-pointer"
                    title="Giảm cỡ chữ"
                  >
                    A-
                  </button>
                  <span className="font-mono text-xs text-slate-600 w-6 text-center">{fontSize}</span>
                  <button
                    type="button"
                    onClick={() => setFontSize((s) => Math.min(22, s + 1))}
                    className="w-7 h-7 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center font-bold text-xs cursor-pointer"
                    title="Tăng cỡ chữ"
                  >
                    A+
                  </button>

                  <div className="h-4 w-px bg-slate-200 mx-1" />

                  <button
                    type="button"
                    onClick={() => {
                      if (fullText) {
                        navigator.clipboard.writeText(fullText);
                        toast.success('Đã sao chép toàn bộ văn bản');
                      }
                    }}
                    className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
                    title="Sao chép toàn bộ văn bản vào clipboard"
                  >
                    <i className="far fa-copy text-[11px]" />
                    <span>Sao chép</span>
                  </button>
                </div>
              </div>

              {/* Reader Content Area */}
              <div className="flex-1 p-6 sm:p-8 overflow-y-auto max-h-[calc(100vh-230px)] space-y-6">
                {/* AI Executive Summary Box if present */}
                {doc.summary && (
                  <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-purple-50/80 to-indigo-50/80 border border-purple-200/70 space-y-2">
                    <div className="flex items-center gap-2 text-purple-700 font-bold text-xs uppercase tracking-wider">
                      <i className="fas fa-wand-magic-sparkles text-xs" />
                      <span>Tóm tắt tổng quan từ hệ thống AI</span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-serif italic">
                      &quot;{doc.summary}&quot;
                    </p>
                  </div>
                )}

                {/* Chapters or Full Text */}
                {chapters.length > 0 ? (
                  <div className="space-y-8">
                    {chapters.map((ch, idx) => {
                      const contentText = ch.content || '';
                      return (
                        <section
                          key={idx}
                          id={`chapter-${idx}`}
                          className="space-y-3 pb-6 border-b border-slate-100 last:border-0"
                        >
                          <h3 className="font-bold text-slate-800 text-base sm:text-lg flex items-center gap-2">
                            <span className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-bold border border-indigo-100 shrink-0">
                              {ch.chapterNumber || idx + 1}
                            </span>
                            <span>{ch.title || `Nội dung phần ${idx + 1}`}</span>
                          </h3>

                          <div
                            style={{ fontSize: `${fontSize}px` }}
                            className="text-slate-700 leading-relaxed whitespace-pre-line font-serif space-y-3"
                          >
                            {contentText}
                          </div>
                        </section>
                      );
                    })}
                  </div>
                ) : fullText ? (
                  <div
                    style={{ fontSize: `${fontSize}px` }}
                    className="text-slate-700 leading-relaxed whitespace-pre-line font-serif"
                  >
                    {fullText}
                  </div>
                ) : (
                  <div className="py-16 text-center space-y-3 text-slate-400">
                    <i className="far fa-file-alt text-3xl text-slate-300" />
                    <p className="text-xs font-medium text-slate-600">
                      Tài liệu này hiện chưa có nội dung văn bản trích xuất sẵn.
                    </p>
                    <div className="flex justify-center gap-2">
                      <button
                        type="button"
                        onClick={handleDownload}
                        className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold cursor-pointer"
                      >
                        Tải tệp gốc về máy để xem
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {/* CASE 4: IMAGE DOCUMENT */}
        {isImage && (
          <div className="flex-1 flex flex-col bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden p-6 items-center justify-center min-h-[calc(100vh-140px)]">
            <img
              src={directFileUrl}
              alt={doc.name}
              className="max-h-[80vh] max-w-full object-contain rounded-xl shadow-md border border-slate-200"
            />
          </div>
        )}

        {/* CASE 5: VIDEO DOCUMENT */}
        {isVideo && (
          <div className="flex-1 flex flex-col bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden p-6 items-center justify-center min-h-[calc(100vh-140px)]">
            <video
              controls
              src={directFileUrl}
              className="max-h-[80vh] max-w-full rounded-xl shadow-md"
            >
              Trình duyệt của bạn không hỗ trợ thẻ video.
            </video>
          </div>
        )}

        {/* CASE 6: ARCHIVE OR GENERIC */}
        {!isPdf && !isWord && !isExcel && !isPpt && !isText && !isImage && !isVideo && (
          <div className="flex-1 flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-slate-200/80 shadow-2xs text-center space-y-4">
            <div
              className={`w-20 h-20 rounded-3xl flex items-center justify-center text-4xl shadow-sm border mx-auto ${meta.color}`}
            >
              <i className={`fas ${meta.icon}`} />
            </div>

            <div className="space-y-1 max-w-md">
              <h3 className="font-bold text-slate-800 text-lg">{doc.name}</h3>
              <p className="text-xs text-slate-500">
                Định dạng tệp: <strong className="uppercase">{meta.label}</strong> ({sizeText || 'Chưa rõ kích thước'})
              </p>
              <p className="text-xs text-slate-400 mt-2">
                Định dạng này không hỗ trợ hiển thị trực tiếp trong khung xem trước web. Bạn có thể tải tệp về thiết bị để mở bằng ứng dụng tương thích.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleDownload}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-md active:scale-95 cursor-pointer flex items-center gap-2"
              >
                <i className="fas fa-download text-xs" />
                <span>Tải tệp về máy</span>
              </button>
              {doc.link && (
                <a
                  href={doc.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition border border-slate-200"
                >
                  <i className="fas fa-arrow-up-right-from-square text-xs mr-1.5" />
                  <span>Mở liên kết gốc</span>
                </a>
              )}
            </div>
          </div>
        )}
      </main>

      {/* AI Summary Modal */}
      {showAiSummaryModal && (
        <Modal
          isOpen={showAiSummaryModal}
          onClose={() => setShowAiSummaryModal(false)}
          title="Tóm tắt & Khái niệm trọng tâm (AI)"
          maxWidth="max-w-2xl"
        >
          <div className="space-y-4 p-1">
            <div className="p-4 rounded-xl bg-purple-50 border border-purple-200 text-xs text-purple-900 leading-relaxed font-serif">
              <h5 className="font-bold text-xs uppercase text-purple-800 mb-1 flex items-center gap-1.5">
                <i className="fas fa-sparkles text-purple-600" />
                <span>Tóm tắt tổng quan</span>
              </h5>
              <p className="italic">&quot;{doc.summary || 'Chưa có tóm tắt tự động.'}&quot;</p>
            </div>

            {keyConcepts.length > 0 && (
              <div className="space-y-2">
                <h5 className="font-bold text-xs uppercase text-slate-500">Khái niệm & Điểm chính</h5>
                <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                  {keyConcepts.map((kc, i) => (
                    <div key={i} className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs space-y-1">
                      <span className="font-bold text-indigo-700 text-xs">{kc.concept}</span>
                      <p className="text-slate-600">{kc.definition}</p>
                      {kc.formula && (
                        <div className="mt-1 px-2 py-0.5 rounded bg-white border border-slate-200 font-mono text-[10px] text-slate-700 inline-block">
                          {kc.formula}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowAiSummaryModal(false)}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 cursor-pointer"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default DocumentViewerPage;

