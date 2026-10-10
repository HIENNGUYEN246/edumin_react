import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/providers/AuthProvider.jsx';
import { aiApi } from '../../api/aiApi.js';

/**
 * Formats markdown-like bold (**text**) and newlines for clean rendering.
 */
function renderMessageText(text = '') {
  const lines = String(text).split('\n');
  return lines.map((line, lIdx) => {
    // Split by **bold** markers
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return (
      <span key={lIdx} className="block min-h-[1.25rem]">
        {parts.map((part, pIdx) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return (
              <strong key={pIdx} className="font-semibold text-slate-900">
                {part.slice(2, -2)}
              </strong>
            );
          }
          return <span key={pIdx}>{part}</span>;
        })}
      </span>
    );
  });
}

export function EduMinAiAssistant() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const displayName = profile?.hoTen || user?.hoTen || 'bạn';
  const role = user?.role || '';

  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [messages, setMessages] = useState(() => [
    {
      id: 'welcome',
      sender: 'assistant',
      text: `Xin chào **${displayName}**! 👋\nTôi là **EduMin AI Assistant**. Tôi có thể hỗ trợ bạn tra cứu lịch học, thời khóa biểu, cấu hình điểm số hoặc điều hướng nhanh đến các tính năng trong hệ thống. Bạn cần hỗ trợ gì hôm nay?`,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom whenever messages or loading state changes
  useEffect(() => {
    if (isOpen && typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading, isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  // Fetch suggestions when user/role changes
  useEffect(() => {
    let active = true;
    async function loadSuggestions() {
      try {
        const res = await aiApi.suggestions();
        if (active && res?.suggestions && Array.isArray(res.suggestions)) {
          setSuggestions(res.suggestions);
        }
      } catch {
        // Fallback default suggestions based on role
        if (!active) return;
        if (role === 'giao-vien' || role === 'teacher') {
          setSuggestions([
            'Làm sao để cấu hình điểm giữa kỳ và Quiz?',
            'Xem lịch giảng dạy hôm nay',
            'Danh sách lớp tôi đang phụ trách',
            'Có ý kiến sinh viên nào chưa phản hồi không?',
          ]);
        } else if (role === 'sinh-vien' || role === 'student') {
          setSuggestions([
            'Xem thời khóa biểu tuần này ở đâu?',
            'Cách xem chuyên cần và điểm danh',
            'Hướng dẫn đăng ký học phần',
            'Xem tài liệu bài giảng ở đâu?',
          ]);
        } else {
          setSuggestions([
            'Thống kê hệ thống hiện tại',
            'Có yêu cầu cập nhật hồ sơ nào đang chờ duyệt?',
            'Cách cấu hình trọng số điểm cho môn học',
            'Quản lý danh sách lớp học phần',
          ]);
        }
      }
    }

    if (user) {
      loadSuggestions();
    }
    return () => {
      active = false;
    };
  }, [user, role]);

  const handleSend = async (messageText) => {
    const textToSend = String(messageText || input).trim();
    if (!textToSend || loading) return;

    const userMsg = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await aiApi.query(textToSend);
      const assistantMsg = {
        id: `assistant-${Date.now()}`,
        sender: 'assistant',
        text: res?.reply || 'Tôi đã xử lý xong yêu cầu của bạn.',
        intent: res?.intent,
        quickLinks: res?.quickLinks || [],
        data: res?.data,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const errorMsg = {
        id: `assistant-err-${Date.now()}`,
        sender: 'assistant',
        text:
          err?.message ||
          'Rất tiếc, tôi gặp sự cố kết nối tới máy chủ khi xử lý yêu cầu. Vui lòng thử lại sau giây lát!',
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: 'welcome-reset',
        sender: 'assistant',
        text: `Đã làm mới cuộc hội thoại! 👋\nBạn có thể hỏi tôi bất kỳ câu hỏi nào về quy trình, dữ liệu hoặc điều hướng trong hệ thống EduMin.`,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  const handleQuickNavigate = (path) => {
    if (!path) return;
    navigate(path);
    // On small screens, close the chat to allow user to see the page
    if (window.innerWidth < 640) {
      setIsOpen(false);
    }
  };

  return (
    <>
      {/* Floating Toggle Button */}
      <div className="fixed bottom-6 right-6 z-50 flex items-center">
        {!isOpen && (
          <div className="hidden md:flex items-center mr-3 px-3 py-1.5 bg-slate-900/85 text-white text-xs font-medium rounded-full shadow-lg backdrop-blur-xs animate-in fade-in slide-in-from-right-3 duration-200">
            <span>Hỏi EduMin AI</span>
            <i className="fas fa-sparkles ml-1.5 text-amber-300 text-[11px]" />
          </div>
        )}

        <button
          type="button"
          aria-label={isOpen ? 'Đóng trợ lý ảo EduMin' : 'Mở trợ lý ảo EduMin'}
          onClick={() => setIsOpen((prev) => !prev)}
          className={`relative p-3.5 rounded-full shadow-xl transition-all duration-300 transform active:scale-95 flex items-center justify-center ${
            isOpen
              ? 'bg-slate-800 text-white hover:bg-slate-900 rotate-90 shadow-slate-800/30'
              : 'bg-gradient-to-tr from-indigo-600 via-indigo-700 to-purple-600 text-white hover:shadow-indigo-500/40 hover:scale-105'
          }`}
        >
          {isOpen ? (
            <i className="fas fa-xmark text-xl" />
          ) : (
            <>
              <i className="fas fa-robot text-xl" />
              {/* Online / Active pulse ping */}
              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-white" />
              </span>
            </>
          )}
        </button>
      </div>

      {/* Floating Chat Modal Window */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="EduMin AI Assistant"
          className="fixed bottom-22 right-4 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-[420px] h-[580px] max-h-[80vh] bg-white rounded-2xl shadow-2xl border border-slate-200/90 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 px-4 py-3.5 text-white flex items-center justify-between shadow-xs select-none">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-xs flex items-center justify-center text-white border border-white/20 shadow-xs">
                <i className="fas fa-robot text-base" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold tracking-tight">EduMin AI Assistant</h3>
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-emerald-500/20 text-emerald-200 px-1.5 py-0.5 rounded-full border border-emerald-400/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Online
                  </span>
                </div>
                <p className="text-[11px] text-indigo-100/90">Trợ lý định hướng & Tra cứu nhanh</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                title="Làm mới hội thoại"
                onClick={handleClearHistory}
                className="p-2 text-indigo-100 hover:text-white hover:bg-white/10 rounded-lg transition text-xs"
              >
                <i className="fas fa-rotate-right" />
              </button>
              <button
                type="button"
                title="Thu nhỏ"
                onClick={() => setIsOpen(false)}
                className="p-2 text-indigo-100 hover:text-white hover:bg-white/10 rounded-lg transition text-xs"
              >
                <i className="fas fa-minus" />
              </button>
            </div>
          </div>

          {/* Messages Body */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4 bg-slate-50/60">
            {messages.map((msg) => {
              const isUser = msg.sender === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  {!isUser && (
                    <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs flex-shrink-0 mt-0.5 shadow-2xs">
                      <i className="fas fa-robot" />
                    </div>
                  )}

                  <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[85%]`}>
                    <div
                      className={`px-3.5 py-2.5 text-xs sm:text-[13px] leading-relaxed shadow-2xs ${
                        isUser
                          ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-2xl rounded-tr-xs'
                          : 'bg-white text-slate-800 rounded-2xl rounded-tl-xs border border-slate-200/80'
                      }`}
                    >
                      {renderMessageText(msg.text)}

                      {/* Quick Navigation Action Links */}
                      {!isUser && Array.isArray(msg.quickLinks) && msg.quickLinks.length > 0 && (
                        <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-col gap-1.5">
                          <p className="text-[11px] font-semibold text-indigo-900 flex items-center gap-1">
                            <i className="fas fa-compass text-indigo-500" />
                            Đường dẫn thao tác nhanh:
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {msg.quickLinks.map((link, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => handleQuickNavigate(link.path)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition active:scale-95 group"
                              >
                                <span>{link.label}</span>
                                <i className="fas fa-arrow-right text-[10px] text-indigo-500 group-hover:translate-x-0.5 transition-transform" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <span className="text-[10px] text-slate-400 mt-1 px-1">
                      {msg.timestamp}
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Loading Indicator */}
            {loading && (
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs flex-shrink-0 mt-0.5 shadow-2xs">
                  <i className="fas fa-robot" />
                </div>
                <div className="bg-white border border-slate-200/80 rounded-2xl rounded-tl-xs px-3.5 py-2.5 shadow-2xs flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" />
                  <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce [animation-delay:0.2s]" />
                  <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce [animation-delay:0.4s]" />
                  <span className="text-xs text-slate-500 ml-1 font-medium">EduMin AI đang trả lời...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Suggested Quick Chips */}
          {suggestions.length > 0 && (
            <div className="px-3 py-2 bg-slate-100/90 border-t border-slate-200/80 flex items-center gap-1.5 overflow-x-auto custom-scrollbar no-scrollbar text-xs">
              <span className="text-[11px] font-semibold text-slate-500 flex-shrink-0 flex items-center gap-1">
                <i className="fas fa-lightbulb text-amber-500" /> Gợi ý:
              </span>
              {suggestions.slice(0, 4).map((sug, i) => (
                <button
                  key={i}
                  type="button"
                  disabled={loading}
                  onClick={() => handleSend(sug)}
                  className="flex-shrink-0 px-2.5 py-1 bg-white hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 text-slate-700 text-xs rounded-full border border-slate-200 transition shadow-2xs font-normal"
                >
                  {sug}
                </button>
              ))}
            </div>
          )}

          {/* Input Footer */}
          <div className="p-3 bg-white border-t border-slate-200 flex flex-col gap-1.5">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2"
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Nhập câu hỏi hoặc yêu cầu điều hướng..."
                disabled={loading}
                className="flex-1 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-800 placeholder-slate-400 outline-hidden transition"
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="p-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:hover:bg-indigo-600 transition flex items-center justify-center flex-shrink-0 shadow-xs"
                title="Gửi câu hỏi"
              >
                <i className="fas fa-paper-plane text-xs sm:text-sm" />
              </button>
            </form>
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] text-slate-400">
                ⚡ Hỗ trợ trả lời câu hỏi và điều hướng tác vụ nhanh
              </span>
              <span className="text-[10px] text-slate-400 font-mono">EduMin v2.0</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default EduMinAiAssistant;
