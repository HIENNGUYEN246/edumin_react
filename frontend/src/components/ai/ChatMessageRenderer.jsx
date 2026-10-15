import React from 'react';
import { ApprovalRequestCard } from './ApprovalRequestCard.jsx';
import { TeacherDocumentCard } from './TeacherDocumentCard.jsx';
import { InteractiveQuizCard } from './InteractiveQuizCard.jsx';
import { DocumentSummaryCard } from './DocumentSummaryCard.jsx';

/**
 * Message Types / Renderer for EduMin AI Chatbot.
 * Inspects message.type and card.type to render dedicated interactive UI components
 * instead of plain text strings.
 */
export function ChatMessageRenderer({
  message,
  renderMessageText,
  onApproveRequest,
  onRejectRequest,
  onQuickNavigate,
  onSendMessage,
  onReplyFeedback,
  onToggleSpeak,
  speakingMessageId,
  actionLoading = {},
  role = '',
}) {
  const isUser = message.sender === 'user';
  const cards = Array.isArray(message.cards) ? message.cards : [];

  // Determine message-level specialized type
  const messageType = message.type || message.messageType;

  return (
    <div
      className={`px-4 pt-3 pb-3 text-xs sm:text-[13px] leading-relaxed w-full ${
        isUser
          ? 'bg-blue-600 text-white font-medium rounded-2xl rounded-tr-xs shadow-md shadow-blue-500/25 border border-blue-500/40'
          : 'bg-white text-slate-800 rounded-2xl rounded-tl-xs border border-slate-200/80 shadow-2xs'
      }`}
    >
      {/* 1. Main Text Markdown / Math formatting */}
      {renderMessageText ? renderMessageText(message.text, isUser) : message.text}

      {/* 2. Interactive Action Cards & Specialized UI Components */}
      {!isUser && cards.length > 0 && (
        <div className="mt-3.5 space-y-2.5">
          {cards.map((card, cIdx) => {
            const cardKey = card.id || cIdx;
            const effectiveType = (card.type || messageType || '').toLowerCase();

            // Type A: Approval / Permission Card (Admin)
            if (
              effectiveType === 'approval' ||
              effectiveType === 'approval_card' ||
              effectiveType === 'approval_table'
            ) {
              return (
                <ApprovalRequestCard
                  key={cardKey}
                  card={card}
                  actionLoading={actionLoading}
                  onApprove={(reqId, title) =>
                    onApproveRequest?.(message.id, card.id, reqId, title)
                  }
                  onReject={(reqId, title, reason) =>
                    onRejectRequest?.(message.id, card.id, reqId, title, reason)
                  }
                  onNavigate={(path) => onQuickNavigate?.(path)}
                />
              );
            }

            // Type B: Teacher Document / File Card (Teacher / Academic)
            if (
              effectiveType === 'document_card' ||
              effectiveType === 'teacher_document' ||
              effectiveType === 'document_file' ||
              effectiveType === 'file_card'
            ) {
              return (
                <TeacherDocumentCard
                  key={cardKey}
                  card={card}
                  onSendMessage={(prompt) => onSendMessage?.(prompt)}
                  onNavigate={(path) => onQuickNavigate?.(path)}
                />
              );
            }

            // Type C: Interactive Quiz Card (Student / Self-study)
            if (effectiveType === 'interactive_quiz' || effectiveType === 'quiz_card') {
              return (
                <InteractiveQuizCard
                  key={cardKey}
                  card={card}
                  onSendMessage={(text) => onSendMessage?.(text)}
                  onNavigate={(path) => onQuickNavigate?.(path)}
                />
              );
            }

            // Type D: Document Summary Card (Student / Study Guide)
            if (effectiveType === 'document_summary' || effectiveType === 'summary_card') {
              return (
                <DocumentSummaryCard
                  key={cardKey}
                  card={card}
                  onSendMessage={(text) => onSendMessage?.(text)}
                  onNavigate={(path) => onQuickNavigate?.(path)}
                />
              );
            }

            // Type E: Default / Generic Card (Class, Grade Input, Feedback, Search)
            return (
              <div
                key={cardKey}
                className="bg-slate-50/90 rounded-xl p-3.5 pt-3 border border-slate-200/90 shadow-2xs space-y-2 text-slate-800"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-semibold text-xs text-slate-900 leading-tight">
                      {card.title}
                    </h4>
                    {card.subtitle && (
                      <p
                        className={`text-[11px] mt-0.5 ${
                          card.subtitle.startsWith('✓')
                            ? 'text-emerald-700 font-medium'
                            : card.subtitle.startsWith('✗')
                            ? 'text-rose-700 font-medium'
                            : 'text-slate-500'
                        }`}
                      >
                        {card.subtitle}
                      </p>
                    )}
                  </div>
                  {card.code && (
                    <span className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-slate-200 text-slate-800 whitespace-nowrap">
                      {card.code}
                    </span>
                  )}
                </div>

                {/* Card Meta / Quote */}
                {card.meta && (
                  <p className="text-[11px] text-slate-600 italic bg-white p-2 rounded-lg border border-slate-200/60 leading-relaxed">
                    {card.meta}
                  </p>
                )}

                {/* Key-Value Details */}
                {Array.isArray(card.details) && card.details.length > 0 && (
                  <div className="grid grid-cols-2 gap-1.5 py-0.5 text-[11px]">
                    {card.details.map((detail, dIdx) => (
                      <div
                        key={dIdx}
                        className="bg-white px-2 py-1 rounded-md border border-slate-200/60 flex flex-col"
                      >
                        <span className="text-slate-400 text-[10px]">{detail.label}</span>
                        <span className="font-semibold text-slate-800 truncate">
                          {detail.value}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Grade Input Action */}
                {card.type === 'grade_input' && (
                  <div className="pt-1 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onQuickNavigate?.(
                          card.action?.path ||
                            (role === 'giao-vien' || role === 'teacher'
                              ? '/teacher/classes'
                              : '/admin/gradebook')
                        )
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 active:scale-95 rounded-lg shadow-2xs transition cursor-pointer"
                    >
                      <i className="fas fa-edit" />
                      <span>📝 Vào điểm ngay</span>
                    </button>
                  </div>
                )}

                {/* Class Schedule Action */}
                {card.type === 'class' && (
                  <div className="pt-1 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onQuickNavigate?.(
                          role === 'giao-vien' || role === 'teacher'
                            ? '/teacher/classes'
                            : '/admin/gradebook'
                        )
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-800 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition active:scale-95 cursor-pointer shadow-2xs"
                    >
                      <i className="fas fa-table text-slate-500" />
                      <span>Bảng điểm lớp</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onQuickNavigate?.(
                          role === 'giao-vien' || role === 'teacher'
                            ? '/teacher/attendance'
                            : '/admin/classes'
                        )
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-800 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition active:scale-95 cursor-pointer shadow-2xs"
                    >
                      <i className="fas fa-calendar-check text-slate-500" />
                      <span>Điểm danh lớp</span>
                    </button>
                  </div>
                )}

                {/* Feedback Reply Action */}
                {card.type === 'feedback' && (
                  <div className="pt-1 space-y-1.5">
                    {card.status === 'responded' ? (
                      <div className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg text-xs font-semibold">
                        <i className="fas fa-check-circle" />
                        <span>Đã phản hồi ý kiến</span>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {(card.templates || []).map((tpl, tplIdx) => (
                          <button
                            key={tplIdx}
                            type="button"
                            disabled={actionLoading[card.feedbackId || card.id]}
                            onClick={() =>
                              onReplyFeedback?.(
                                message.id,
                                card.id,
                                card.feedbackId || card.id,
                                tpl
                              )
                            }
                            className="text-left px-2.5 py-1.5 text-[11px] text-slate-800 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition active:scale-[0.98] group flex items-start gap-1.5 shadow-2xs cursor-pointer"
                          >
                            <i className="fas fa-paper-plane text-[10px] text-slate-400 mt-0.5 group-hover:translate-x-0.5 transition-transform" />
                            <span>{tpl}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Generic Navigation Button */}
                {card.type !== 'grade_input' &&
                  card.type !== 'class' &&
                  card.type !== 'feedback' &&
                  card.action && (
                    <div className="pt-1 flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => onQuickNavigate?.(card.action.path)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-800 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition active:scale-95 group shadow-2xs cursor-pointer"
                      >
                        <span>{card.action.label || 'Xem chi tiết'}</span>
                        <i className="fas fa-arrow-right text-[10px] text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    </div>
                  )}
              </div>
            );
          })}
        </div>
      )}

      {/* 3. Action Links / Quick Links */}
      {!isUser && Array.isArray(message.quickLinks) && message.quickLinks.length > 0 && (
        <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap gap-1.5">
          {message.quickLinks.map((link, lIdx) => (
            <button
              key={lIdx}
              type="button"
              onClick={() => onQuickNavigate?.(link.path)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition active:scale-95 group cursor-pointer"
            >
              <span>{link.label}</span>
              <i className="fas fa-arrow-right text-[10px] group-hover:translate-x-0.5 transition-transform" />
            </button>
          ))}
        </div>
      )}

      {/* 4. Suggestions Chips */}
      {!isUser && Array.isArray(message.suggestions) && message.suggestions.length > 0 && (
        <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-col gap-1.5">
          <p className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
            <i className="fas fa-lightbulb text-slate-400" />
            Gợi ý tác vụ nhanh:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {message.suggestions.map((sug, sIdx) => (
              <button
                key={sIdx}
                type="button"
                onClick={() => onSendMessage?.(sug)}
                className="px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 border border-slate-200 rounded-full transition cursor-pointer"
              >
                {sug}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* TTS Audio Speak Button */}
      {!isUser && message.text && onToggleSpeak && (
        <div className="mt-2 pt-1 border-t border-slate-100 flex items-center justify-end">
          <button
            type="button"
            data-testid={`ai-tts-btn-${message.id}`}
            onClick={() => onToggleSpeak(message.id, message.text)}
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-medium transition cursor-pointer ${
              speakingMessageId === message.id
                ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300 shadow-2xs font-semibold'
                : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-100'
            }`}
            title={speakingMessageId === message.id ? 'Dừng đọc văn bản' : 'Đọc câu trả lời bằng giọng nói'}
            aria-label={speakingMessageId === message.id ? 'Dừng đọc' : 'Đọc văn bản'}
          >
            <i className={`fas ${speakingMessageId === message.id ? 'fa-volume-high text-indigo-600 animate-pulse' : 'fa-volume-low'} text-xs`} />
            <span>{speakingMessageId === message.id ? 'Dừng đọc' : 'Đọc văn bản'}</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default ChatMessageRenderer;

