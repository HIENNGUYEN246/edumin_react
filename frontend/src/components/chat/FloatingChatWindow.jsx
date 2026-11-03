import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatApi } from '../../api/chatApi.js';
import { useAuth } from '../../app/providers/AuthProvider.jsx';
import { useChat } from '../../app/providers/ChatProvider.jsx';
import { Avatar } from '../ui/Avatar.jsx';

export function FloatingChatWindow({ chat }) {
  const { user } = useAuth();
  const { closeChat, toggleMinimizeChat, refetchChannels } = useChat();
  const queryClient = useQueryClient();

  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const role = user?.role || '';
  const isAdmin = role === 'dao-tao' || role === 'admin';
  const isTeacher = role === 'giao-vien' || role === 'teacher';

  // 1. Fetch messages for this specific target
  const { data: messagesData, isLoading } = useQuery({
    queryKey: ['chat-messages', chat.type, chat.type === 'class_group' ? chat.classId : chat.recipientId],
    queryFn: () =>
      chatApi.getMessages({
        type: chat.type,
        classId: chat.classId,
        recipientId: chat.recipientId,
      }),
    refetchInterval: 2500,
    enabled: Boolean(chat),
  });

  const messages = messagesData?.data?.messages || [];
  const classInfo = messagesData?.data?.classInfo || {};
  const partner = messagesData?.data?.partner || {};
  const currentStudentCount = classInfo.studentCount ?? chat.studentCount;

  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (!chat.isMinimized && messagesEndRef.current && typeof messagesEndRef.current.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, chat.isMinimized]);

  // Focus input when chat window is expanded
  useEffect(() => {
    if (!chat.isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [chat.isMinimized]);

  // Send message mutation
  const sendMutation = useMutation({
    mutationFn: (payload) => chatApi.sendMessage(payload),
    onSuccess: () => {
      setInputText('');
      queryClient.invalidateQueries({
        queryKey: ['chat-messages', chat.type, chat.type === 'class_group' ? chat.classId : chat.recipientId],
      });
      refetchChannels();
    },
  });

  const handleSendMessage = (e) => {
    e?.preventDefault();
    const text = inputText.trim();
    if (!text || sendMutation.isPending) return;

    sendMutation.mutate({
      type: chat.type,
      classId: chat.classId,
      recipientId: chat.recipientId,
      content: text,
    });
  };

  const handleInsertAnnouncementTemplate = () => {
    setInputText((prev) => (prev ? prev : '[Thông báo lớp học]: '));
    inputRef.current?.focus();
  };

  const roleBadge = (r) => {
    if (r === 'dao-tao' || r === 'admin') {
      return (
        <span className="px-1.5 py-0.2 rounded-md bg-purple-100 text-purple-700 text-[10px] font-bold">
          Đào tạo
        </span>
      );
    }
    if (r === 'giao-vien' || r === 'teacher') {
      return (
        <span className="px-1.5 py-0.2 rounded-md bg-indigo-100 text-indigo-700 text-[10px] font-bold">
          Giáo viên
        </span>
      );
    }
    return (
      <span className="px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-700 text-[10px] font-bold">
        Sinh viên
      </span>
    );
  };

  const isClass = chat.type === 'class_group';

  return (
    <div
      data-testid={`floating-chat-${chat.key}`}
      className={`bg-white rounded-t-2xl shadow-2xl border border-slate-200/90 flex flex-col transition-all duration-200 overflow-hidden ${
        chat.isMinimized
          ? 'w-64 h-11'
          : 'w-80 sm:w-96 h-[460px] max-h-[85vh]'
      }`}
    >
      {/* Facebook-style Chat Header */}
      <div
        onClick={() => chat.isMinimized && toggleMinimizeChat(chat.key)}
        className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 text-white px-3.5 py-2.5 flex items-center justify-between shadow-xs select-none cursor-pointer shrink-0"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Avatar or Class Icon */}
          {isClass ? (
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-white shrink-0 shadow-xs border border-white/20">
              <i className="fas fa-graduation-cap text-xs" />
            </div>
          ) : (
            <div className="relative shrink-0">
              <Avatar src={chat.avatar} name={chat.title} size={32} />
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-indigo-700" />
            </div>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 truncate">
              <h4 className="text-xs font-bold text-white truncate max-w-[150px] sm:max-w-[190px]" title={chat.title}>
                {chat.title}
              </h4>
              {!isClass && chat.role && roleBadge(chat.role)}
            </div>
            <p className="text-[10px] text-indigo-100/90 truncate">
              {isClass
                ? `Lớp ${chat.classId}${
                    currentStudentCount !== undefined && currentStudentCount !== null
                      ? currentStudentCount > 0
                        ? ` • ${currentStudentCount} SV`
                        : ' • Chưa có SV'
                      : ''
                  }${chat.teacher ? ` • GV: ${chat.teacher}` : ''}`
                : 'Đang hoạt động'}
            </p>
          </div>
        </div>

        {/* Header Action Controls */}
        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          {/* Announcement Template button for Admin/Teacher in class chat */}
          {isClass && (isAdmin || isTeacher) && !chat.isMinimized && (
            <button
              type="button"
              onClick={handleInsertAnnouncementTemplate}
              className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition text-xs cursor-pointer"
              title="Chèn mẫu thông báo nhanh"
            >
              <i className="fas fa-bullhorn text-[11px]" />
            </button>
          )}

          {/* Minimize / Expand Toggle */}
          <button
            type="button"
            onClick={() => toggleMinimizeChat(chat.key)}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition text-xs cursor-pointer"
            title={chat.isMinimized ? 'Mở rộng ô chat' : 'Thu nhỏ ô chat'}
            aria-label={chat.isMinimized ? 'Mở rộng' : 'Thu nhỏ'}
          >
            <i className={`fas ${chat.isMinimized ? 'fa-chevron-up' : 'fa-minus'} text-[11px]`} />
          </button>

          {/* Close Chat Window */}
          <button
            type="button"
            onClick={() => closeChat(chat.key)}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition text-xs cursor-pointer"
            title="Đóng ô chat"
            aria-label="Đóng"
          >
            <i className="fas fa-xmark text-xs" />
          </button>
        </div>
      </div>

      {/* Messages Stream & Input (Visible only when not minimized) */}
      {!chat.isMinimized && (
        <>
          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2.5 bg-slate-50/70 text-xs">
            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
                <i className="fas fa-spinner fa-spin text-indigo-500" />
                <span>Đang tải tin nhắn...</span>
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-10 px-4 text-slate-400">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-2">
                  <i className="fas fa-comments text-base" />
                </div>
                <p className="font-semibold text-slate-600">Chưa có tin nhắn nào</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  {isClass
                    ? 'Gửi tin nhắn hoặc thông báo đầu tiên cho các thành viên trong lớp học phần.'
                    : 'Hãy gửi lời chào đầu tiên để bắt đầu trò chuyện.'}
                </p>
              </div>
            ) : (
              messages.map((m, mIdx) => {
                const isOwn = m.isOwn || m.sender === user?._id || m.sender === user?.id;
                const timeStr = m.createdAt
                  ? new Date(m.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                  : '';

                return (
                  <div
                    key={m._id || m.id || mIdx}
                    className={`flex items-start gap-1.5 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    {!isOwn && (
                      <Avatar src={m.senderAvatar} name={m.senderName} size={28} className="mt-0.5 shrink-0" />
                    )}

                    <div className={`max-w-[78%] flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                      {!isOwn && isClass && (
                        <div className="flex items-center gap-1 mb-0.5 px-1">
                          <span className="text-[10px] font-bold text-slate-700 truncate max-w-[130px]">
                            {m.senderName}
                          </span>
                          {roleBadge(m.senderRole)}
                        </div>
                      )}

                      <div
                        className={`px-3 py-2 text-xs rounded-2xl leading-relaxed whitespace-pre-wrap break-words shadow-2xs ${
                          isOwn
                            ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-tr-xs shadow-indigo-500/10'
                            : 'bg-white border border-slate-200/90 text-slate-800 rounded-tl-xs'
                        }`}
                      >
                        {m.content}
                      </div>

                      {timeStr && (
                        <span className="text-[9px] text-slate-400 mt-0.5 px-1 font-mono">
                          {timeStr}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input Bar */}
          <form
            onSubmit={handleSendMessage}
            className="p-2.5 bg-white border-t border-slate-200/80 flex items-center gap-2 shrink-0"
          >
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={
                isClass
                  ? 'Gửi thông báo hoặc trao đổi trong lớp...'
                  : 'Nhập tin nhắn...'
              }
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition"
            />

            <button
              type="submit"
              disabled={!inputText.trim() || sendMutation.isPending}
              className="w-8 h-8 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white transition flex items-center justify-center shrink-0 shadow-xs cursor-pointer disabled:cursor-not-allowed"
              title="Gửi tin nhắn"
              aria-label="Gửi tin nhắn"
            >
              <i className="fas fa-paper-plane text-xs" />
            </button>
          </form>
        </>
      )}
    </div>
  );
}

export default FloatingChatWindow;

