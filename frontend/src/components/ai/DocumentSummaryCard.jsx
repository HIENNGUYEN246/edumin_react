import React, { useState } from 'react';

/**
 * Document Summary Card for EduMin AI Chatbot.
 * Renders structured knowledge outlines, core concepts, formulas,
 * and key takeaways extracted from teacher's uploaded files.
 */
export function DocumentSummaryCard({ card, onSendMessage, onNavigate, userRole }) {
  const [showAllConcepts, setShowAllConcepts] = useState(false);
  const [copied, setCopied] = useState(false);
  const coreConcepts = card.coreConcepts || [];
  const displayedConcepts = showAllConcepts ? coreConcepts : coreConcepts.slice(0, 3);

  const isTeacher =
    userRole === 'teacher' ||
    userRole === 'giao-vien' ||
    card?.role === 'teacher' ||
    (typeof window !== 'undefined' && window.location.pathname.startsWith('/teacher'));

  const handleCopySummary = async () => {
    try {
      const lines = [
        `=== ${card.title || 'BẢN TÓM TẮT KIẾN THỨC TÀI LIỆU'} ===`,
        card.subtitle || '',
        '',
        '📌 CÁC KHÁI NIỆM & NGUYÊN LÝ CỐT LÕI:',
        ...coreConcepts.map((item, idx) => {
          let s = `${idx + 1}. ${item.concept || item.name}: ${item.definition || item.description || ''}`;
          if (item.formula) s += ` (Công thức/Cú pháp: ${item.formula})`;
          return s;
        }),
        '',
        ...(Array.isArray(card.chapters) && card.chapters.length > 0
          ? [
              '📚 ĐỀ CƯƠNG CÁC CHƯƠNG:',
              ...card.chapters.map((ch, idx) => `  ${idx + 1}. ${ch.title}`),
              '',
            ]
          : []),
      ];
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="bg-slate-50/95 rounded-2xl p-3.5 sm:p-4 border border-indigo-100 shadow-sm space-y-3 text-slate-800 transition-all">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 border-b border-slate-200/70 pb-3">
        <div className="flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center shrink-0 shadow-2xs">
            <i className="fas fa-book-open text-xs" />
          </div>
          <div>
            <h4 className="font-bold text-xs sm:text-[13px] text-slate-900 leading-snug">
              {card.title || 'Bản tóm tắt kiến thức tài liệu'}
            </h4>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {card.subtitle || 'Tóm tắt khái niệm cốt lõi & công thức trọng tâm'}
            </p>
          </div>
        </div>
        {card.code && (
          <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 whitespace-nowrap">
            {card.code}
          </span>
        )}
      </div>

      {/* Details Grid */}
      {Array.isArray(card.details) && card.details.length > 0 && (
        <div className="grid grid-cols-2 gap-1.5 py-0.5 text-[11px]">
          {card.details.map((detail, dIdx) => (
            <div
              key={dIdx}
              className="bg-white px-2 py-1.5 rounded-lg border border-slate-200/70 flex flex-col shadow-2xs"
            >
              <span className="text-slate-400 text-[10px]">{detail.label}</span>
              <span className="font-semibold text-slate-800 truncate">{detail.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Core Concepts Section */}
      {coreConcepts.length > 0 && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
              <i className="fas fa-layer-group text-indigo-500 text-xs" />
              <span>Khái niệm & Nguyên lý cốt lõi:</span>
            </span>
            {coreConcepts.length > 3 && (
              <button
                type="button"
                onClick={() => setShowAllConcepts(!showAllConcepts)}
                className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
              >
                {showAllConcepts ? 'Thu gọn' : `Xem thêm (${coreConcepts.length - 3})`}
              </button>
            )}
          </div>

          <div className="space-y-1.5">
            {displayedConcepts.map((item, idx) => (
              <div
                key={idx}
                className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs space-y-1 text-xs"
              >
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 shrink-0" />
                  <strong className="text-slate-900 font-bold">{item.concept || item.name}</strong>
                </div>
                <p className="text-[11px] text-slate-600 pl-3 leading-relaxed">
                  {item.definition || item.description}
                </p>
                {item.formula && (
                  <div className="pl-3 pt-0.5">
                    <span className="inline-block bg-slate-100 text-indigo-900 font-mono text-[10px] px-2 py-0.5 rounded border border-slate-200/80">
                      ⚡ Cú pháp/Công thức: {item.formula}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chapters Outline If Available */}
      {Array.isArray(card.chapters) && card.chapters.length > 0 && (
        <div className="space-y-1 pt-1">
          <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
            <i className="fas fa-list-ol text-slate-400 text-xs" />
            <span>Đề cương các chương trong tài liệu:</span>
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px]">
            {card.chapters.map((ch, idx) => (
              <div
                key={idx}
                className="bg-white/80 px-2 py-1 rounded-md border border-slate-200/60 truncate text-slate-700 flex items-center gap-1"
                title={ch.title}
              >
                <i className="fas fa-bookmark text-[9px] text-indigo-400 shrink-0" />
                <span className="truncate">{ch.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/70">
        <div className="flex flex-wrap items-center gap-1.5">
          {onSendMessage && (
            <button
              type="button"
              onClick={() =>
                onSendMessage(
                  isTeacher
                    ? `Tạo bộ 5 câu hỏi quiz trắc nghiệm kèm đáp án và giải thích từ tài liệu ${
                        card.title || card.code || ''
                      } để làm tư liệu kiểm tra cho lớp`
                    : `Tạo cho tôi 5 câu quiz trắc nghiệm ôn tập dựa trên file tài liệu ${
                        card.title || card.code || ''
                      }`
                )
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-2xs transition active:scale-95 cursor-pointer"
            >
              <i className="fas fa-clipboard-question text-white/90" />
              <span>{isTeacher ? '🎯 Tạo bộ Quiz đề thi cho lớp' : '🎯 Tạo 5 câu Quiz ôn tập ngay'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleCopySummary}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg shadow-2xs transition active:scale-95 cursor-pointer"
            title="Sao chép nội dung tóm tắt vào bộ nhớ tạm"
          >
            <i className={`fas ${copied ? 'fa-check text-emerald-600' : 'fa-copy text-slate-400'}`} />
            <span>{copied ? 'Đã sao chép' : 'Sao chép'}</span>
          </button>
        </div>

        {onNavigate && (
          <button
            type="button"
            onClick={() => onNavigate(isTeacher ? '/teacher/documents' : '/student/documents')}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition cursor-pointer"
          >
            <span>{isTeacher ? 'Quản lý Tài liệu lớp' : 'Mở kho Tài liệu'}</span>
            <i className="fas fa-arrow-right text-[10px]" />
          </button>
        )}
      </div>
    </div>
  );
}

export default DocumentSummaryCard;

