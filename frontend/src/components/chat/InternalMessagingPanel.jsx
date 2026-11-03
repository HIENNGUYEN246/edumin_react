import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatApi } from '../../api/chatApi.js';
import { useAuth } from '../../app/providers/AuthProvider.jsx';
import { useToast } from '../../app/providers/ToastProvider.jsx';
import { Avatar } from '../ui/Avatar.jsx';

export function InternalMessagingPanel({ onClose }) {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('class_groups'); // 'class_groups' | 'direct'
  const [selectedChannel, setSelectedChannel] = useState(null); // { type: 'class_group', classId, classInfo } | { type: 'direct', recipientId, partner }
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isContactPickerOpen, setIsContactPickerOpen] = useState(false);
  const [contactSearch, setContactSearch] = useState('');

  const messagesEndRef = useRef(null);

  const role = user?.role || '';
  const isAdmin = role === 'dao-tao' || role === 'admin';
  const isTeacher = role === 'giao-vien' || role === 'teacher';
  const isStudent = role === 'sinh-vien' || role === 'student';

  // 1. Query available channels
  const { data: channelsData, isLoading: isLoadingChannels, refetch: refetchChannels } = useQuery({
    queryKey: ['chat-channels'],
    queryFn: () => chatApi.getChannels(),
    refetchInterval: 3000,
  });

  const classGroups = channelsData?.classGroups || [];
  const directConversations = channelsData?.directConversations || [];
  const totalUnread = channelsData?.totalUnread || 0;

  // 2. Query messages for selected channel
  const { data: messagesData, isLoading: isLoadingMessages } = useQuery({
    queryKey: ['chat-messages', selectedChannel?.type, selectedChannel?.classId || selectedChannel?.recipientId],
    queryFn: () => {
      if (!selectedChannel) return null;
      return chatApi.getMessages({
        type: selectedChannel.type,
        classId: selectedChannel.classId,
        recipientId: selectedChannel.recipientId,
      });
    },
    enabled: Boolean(selectedChannel),
    refetchInterval: 2500,
  });

  const messages = messagesData?.data?.messages || [];
  const activeClassInfo = messagesData?.data?.classInfo || selectedChannel?.classInfo;
  const activePartner = messagesData?.data?.partner || selectedChannel?.partner;

  // 3. Query contacts for 1-on-1 contact picker
  const { data: contactsData, isLoading: isLoadingContacts } = useQuery({
    queryKey: ['chat-contacts', contactSearch],
    queryFn: () => chatApi.getContacts({ search: contactSearch }),
    enabled: isContactPickerOpen,
  });

  const eligibleContacts = contactsData?.data || [];

  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (messagesEndRef.current && typeof messagesEndRef.current.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, selectedChannel]);

  // Send message mutation
  const sendMutation = useMutation({
    mutationFn: (payload) => chatApi.sendMessage(payload),
    onSuccess: (res) => {
      setInputText('');
      queryClient.invalidateQueries({
        queryKey: ['chat-messages', selectedChannel?.type, selectedChannel?.classId || selectedChannel?.recipientId],
      });
      queryClient.invalidateQueries({ queryKey: ['chat-channels'] });
      // Dispatch custom event for real-time notification across tabs
      window.dispatchEvent(new CustomEvent('edumin:chat-message-sent', { detail: res?.message }));
    },
    onError: (err) => {
      toast.error(err?.message || 'Không thể gửi tin nhắn. Vui lòng thử lại.');
    },
  });

  const handleSendMessage = (e) => {
    e?.preventDefault();
    const text = inputText.trim();
    if (!text || !selectedChannel || sendMutation.isPending) return;

    sendMutation.mutate({
      type: selectedChannel.type,
      classId: selectedChannel.classId,
      recipientId: selectedChannel.recipientId,
      content: text,
    });
  };

  const handleSelectClass = (c) => {
    setSelectedChannel({
      type: 'class_group',
      classId: c.classId,
      classInfo: c,
    });
  };

  const handleSelectDirect = (d) => {
    setSelectedChannel({
      type: 'direct',
      recipientId: d.partnerId,
      partner: d,
    });
  };

  const handleStartDirectWithContact = (contact) => {
    setSelectedChannel({
      type: 'direct',
      recipientId: contact._id,
      partner: {
        partnerId: contact._id,
        name: contact.name,
        role: contact.role,
        email: contact.email,
        avatar: contact.avatar,
      },
    });
    setIsContactPickerOpen(false);
  };

  // Filtered lists
  const filteredClassGroups = useMemo(() => {
    if (!searchQuery.trim()) return classGroups;
    const q = searchQuery.toLowerCase().trim();
    return classGroups.filter(
      (c) =>
        c.classId?.toLowerCase().includes(q) ||
        c.courseName?.toLowerCase().includes(q) ||
        c.teacher?.toLowerCase().includes(q)
    );
  }, [classGroups, searchQuery]);

  const filteredDirectConversations = useMemo(() => {
    if (!searchQuery.trim()) return directConversations;
    const q = searchQuery.toLowerCase().trim();
    return directConversations.filter(
      (d) =>
        d.name?.toLowerCase().includes(q) ||
        d.email?.toLowerCase().includes(q)
    );
  }, [directConversations, searchQuery]);

  const roleBadge = (r) => {
    if (r === 'dao-tao' || r === 'admin') {
      return <span className="px-1.5 py-0.2 rounded-md bg-purple-100 text-purple-700 text-[10px] font-bold">Phòng Đào Tạo</span>;
    }
    if (r === 'giao-vien' || r === 'teacher') {
      return <span className="px-1.5 py-0.2 rounded-md bg-indigo-100 text-indigo-700 text-[10px] font-bold">Giáo viên</span>;
    }
    return <span className="px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-700 text-[10px] font-bold">Sinh viên</span>;
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 select-none">
      {/* View 1: Active Chat Message Screen */}
      {selectedChannel ? (
        <div className="flex flex-col h-full bg-slate-50">
          {/* Active Chat Header */}
          <div className="p-3.5 bg-white border-b border-slate-200/80 flex items-center justify-between gap-3 shadow-2xs shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                onClick={() => setSelectedChannel(null)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition cursor-pointer shrink-0"
                title="Quay lại danh sách"
                aria-label="Quay lại danh sách"
              >
                <i className="fas fa-arrow-left text-xs" />
              </button>

              {selectedChannel.type === 'class_group' ? (
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-200">
                      {activeClassInfo?.classId || selectedChannel.classId}
                    </span>
                    <h4 className="text-xs font-bold text-slate-900 truncate">
                      {activeClassInfo?.courseName || activeClassInfo?.className || 'Nhóm Lớp học phần'}
                    </h4>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                    <i className="fas fa-users text-indigo-500 mr-1" />
                    {activeClassInfo?.memberCount ? `${activeClassInfo.memberCount} thành viên` : 'Nhóm lớp học phần'} • GV: {activeClassInfo?.teacher || 'Chưa phân công'}
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar src={activePartner?.avatar} name={activePartner?.name} size={34} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className="text-xs font-bold text-slate-900 truncate">
                        {activePartner?.name || 'Người dùng'}
                      </h4>
                      {roleBadge(activePartner?.role)}
                    </div>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">
                      {activePartner?.email || 'Hệ thống EduMin'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Template Picker for Admins & Teachers */}
            {(isAdmin || isTeacher) && selectedChannel.type === 'class_group' && (
              <div className="shrink-0 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setInputText((prev) => prev ? `${prev}\n[Thông báo]: ` : '[Thông báo lớp học]: ')}
                  className="px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-bold border border-indigo-200/80 transition cursor-pointer"
                  title="Chèn mẫu thông báo nhanh"
                >
                  <i className="fas fa-bullhorn text-[10px] mr-1" />
                  <span>Mẫu</span>
                </button>
              </div>
            )}
          </div>

          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3.5 space-y-3 bg-slate-100/60">
            {isLoadingMessages ? (
              <div className="flex items-center justify-center py-12 text-slate-400 gap-2 text-xs">
                <i className="fas fa-spinner fa-spin text-indigo-500" />
                <span>Đang tải tin nhắn...</span>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-center px-4">
                <div className="w-12 h-12 rounded-2xl bg-white text-indigo-500 flex items-center justify-center text-xl shadow-xs border border-slate-200 mb-2.5">
                  <i className="fas fa-comments" />
                </div>
                <p className="text-xs font-bold text-slate-700">Chưa có tin nhắn nào</p>
                <p className="text-[11px] text-slate-400 mt-1 max-w-[260px]">
                  {selectedChannel.type === 'class_group'
                    ? 'Hãy gửi tin nhắn đầu tiên để thông báo hoặc thảo luận cùng giảng viên và các bạn sinh viên trong lớp.'
                    : 'Bắt đầu cuộc trò chuyện trực tiếp 1-1 ngay bây giờ.'}
                </p>
              </div>
            ) : (
              messages.map((m, mIdx) => {
                const isOwn = m.isOwn;
                const timeStr = m.createdAt
                  ? new Date(m.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                  : '';

                return (
                  <div
                    key={m._id || m.id || mIdx}
                    className={`flex items-start gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    {!isOwn && (
                      <Avatar src={m.senderAvatar} name={m.senderName} size={30} className="mt-0.5 shrink-0" />
                    )}

                    <div className={`max-w-[78%] flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                      {!isOwn && (
                        <div className="flex items-center gap-1.5 mb-1 px-1">
                          <span className="text-[11px] font-bold text-slate-700">{m.senderName}</span>
                          {roleBadge(m.senderRole)}
                        </div>
                      )}

                      <div
                        className={`px-3.5 py-2.5 text-xs rounded-2xl leading-relaxed whitespace-pre-wrap break-words shadow-2xs ${
                          isOwn
                            ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-tr-xs'
                            : 'bg-white border border-slate-200/90 text-slate-800 rounded-tl-xs'
                        }`}
                      >
                        {m.content}
                      </div>

                      <span className="text-[9px] text-slate-400 mt-0.5 px-1 font-mono">
                        {timeStr}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input Bar */}
          <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-slate-200/80 flex items-center gap-2 shrink-0">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={
                selectedChannel.type === 'class_group'
                  ? 'Gửi thông báo hoặc trao đổi trong lớp...'
                  : 'Nhập tin nhắn trực tiếp...'
              }
              disabled={sendMutation.isPending}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || sendMutation.isPending}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer disabled:cursor-not-allowed"
              title="Gửi tin nhắn (Enter)"
            >
              {sendMutation.isPending ? (
                <i className="fas fa-spinner fa-spin text-xs" />
              ) : (
                <i className="fas fa-paper-plane text-xs" />
              )}
              <span className="hidden sm:inline">Gửi</span>
            </button>
          </form>
        </div>
      ) : (
        /* View 2: Channel & Conversation List Screen */
        <div className="flex flex-col h-full bg-slate-50">
          {/* Header & Sub-tabs */}
          <div className="p-3.5 bg-white border-b border-slate-200/80 space-y-3 shadow-2xs shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <i className="fas fa-comments text-indigo-600" />
                  <span>Tin nhắn & Trò chuyện</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {isAdmin
                    ? 'Toàn quyền kết nối Giảng viên, Sinh viên & Lớp học phần'
                    : isTeacher
                    ? 'Nhắn tin lớp học phần giảng dạy & sinh viên'
                    : 'Nhóm học phần đang học & Giảng viên'}
                </p>
              </div>

              {activeTab === 'direct' && (
                <button
                  type="button"
                  onClick={() => setIsContactPickerOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                  title="Bắt đầu tin nhắn mới"
                >
                  <i className="fas fa-plus text-[10px]" />
                  <span>Tin nhắn mới</span>
                </button>
              )}
            </div>

            {/* Segmented Sub-tabs */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveTab('class_groups')}
                className={`py-1.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === 'class_groups'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <i className="fas fa-users-class text-xs" />
                <span>Nhóm Lớp học phần</span>
                {classGroups.reduce((acc, c) => acc + (c.unreadCount || 0), 0) > 0 && (
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('direct')}
                className={`py-1.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === 'direct'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <i className="fas fa-user text-xs" />
                <span>Cá nhân (1-1)</span>
                {directConversations.reduce((acc, d) => acc + (d.unreadCount || 0), 0) > 0 && (
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                )}
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <i className="fas fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={activeTab === 'class_groups' ? 'Tìm theo mã lớp, tên môn học...' : 'Tìm theo tên, email...'}
                className="w-full pl-8 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
              />
            </div>
          </div>

          {/* List Content */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
            {isLoadingChannels ? (
              <div className="flex items-center justify-center py-12 text-slate-400 gap-2 text-xs">
                <i className="fas fa-spinner fa-spin text-indigo-500" />
                <span>Đang tải danh sách cuộc trò chuyện...</span>
              </div>
            ) : activeTab === 'class_groups' ? (
              /* Class Groups List */
              filteredClassGroups.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-center px-4">
                  <div className="w-12 h-12 rounded-2xl bg-white text-slate-400 flex items-center justify-center text-xl shadow-xs border border-slate-200 mb-2.5">
                    <i className="fas fa-users-slash" />
                  </div>
                  <p className="text-xs font-bold text-slate-700">
                    {isTeacher
                      ? 'Bạn chưa phụ trách lớp học phần nào'
                      : isStudent
                      ? 'Bạn chưa đăng ký lớp học phần nào'
                      : 'Chưa có lớp học phần nào'}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-[260px]">
                    {isTeacher
                      ? 'Chỉ những lớp học phần bạn được phân công giảng dạy mới hiển thị tại đây.'
                      : isStudent
                      ? 'Các nhóm học phần bạn đang tham gia học sẽ tự động hiển thị tại đây.'
                      : 'Hệ thống chưa tạo lớp học phần nào.'}
                  </p>
                </div>
              ) : (
                filteredClassGroups.map((c, cIdx) => (
                  <div
                    key={c.classId || c._id || cIdx}
                    onClick={() => handleSelectClass(c)}
                    className="p-3 bg-white hover:bg-indigo-50/50 border border-slate-200/80 hover:border-indigo-200 rounded-2xl transition cursor-pointer shadow-2xs group flex items-start gap-3"
                  >
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100 font-bold text-xs shadow-2xs group-hover:scale-105 transition">
                      <i className="fas fa-graduation-cap" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-mono font-bold text-[11px] text-indigo-700 truncate">
                          {c.classId}
                        </span>
                        {c.lastMessage?.createdAt && (
                          <span className="text-[9px] text-slate-400 font-mono shrink-0">
                            {new Date(c.lastMessage.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 truncate mt-0.5 group-hover:text-indigo-600 transition">
                        {c.courseName}
                      </h4>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {c.lastMessage ? (
                          <span>
                            <strong className="text-slate-700">{c.lastMessage.senderName}: </strong>
                            {c.lastMessage.content}
                          </span>
                        ) : (
                          <span className="italic text-slate-400">
                            GV: {c.teacher} • {c.memberCount} thành viên
                          </span>
                        )}
                      </p>
                    </div>
                    {c.unreadCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white font-extrabold text-[10px] shrink-0 self-center">
                        {c.unreadCount}
                      </span>
                    )}
                  </div>
                ))
              )
            ) : (
              /* Direct Conversations List */
              filteredDirectConversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-center px-4">
                  <div className="w-12 h-12 rounded-2xl bg-white text-slate-400 flex items-center justify-center text-xl shadow-xs border border-slate-200 mb-2.5">
                    <i className="fas fa-user-clock" />
                  </div>
                  <p className="text-xs font-bold text-slate-700">Chưa có cuộc trò chuyện trực tiếp nào</p>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-[260px]">
                    Bấm nút <strong>"Tin nhắn mới"</strong> ở góc trên để bắt đầu nhắn tin với người dùng được phân quyền.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsContactPickerOpen(true)}
                    className="mt-3 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <i className="fas fa-plus text-[10px]" />
                    <span>Chọn người nhắn tin</span>
                  </button>
                </div>
              ) : (
                filteredDirectConversations.map((d) => (
                  <div
                    key={d.partnerId}
                    onClick={() => handleSelectDirect(d)}
                    className="p-3 bg-white hover:bg-indigo-50/50 border border-slate-200/80 hover:border-indigo-200 rounded-2xl transition cursor-pointer shadow-2xs group flex items-start gap-3"
                  >
                    <Avatar src={d.avatar} name={d.name} size={38} className="shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition truncate">
                            {d.name}
                          </span>
                          {roleBadge(d.role)}
                        </div>
                        {d.lastMessage?.createdAt && (
                          <span className="text-[9px] text-slate-400 font-mono shrink-0">
                            {new Date(d.lastMessage.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-1">
                        {d.lastMessage ? (
                          <span>
                            {d.lastMessage.isOwn && <strong className="text-slate-600">Bạn: </strong>}
                            {d.lastMessage.content}
                          </span>
                        ) : (
                          d.email
                        )}
                      </p>
                    </div>
                    {d.unreadCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white font-extrabold text-[10px] shrink-0 self-center">
                        {d.unreadCount}
                      </span>
                    )}
                  </div>
                ))
              )
            )}
          </div>
        </div>
      )}

      {/* Contact Picker Modal for Direct 1-on-1 Messages */}
      {isContactPickerOpen && (
        <div className="absolute inset-0 z-50 bg-white flex flex-col animate-in fade-in zoom-in-95 duration-150">
          <div className="p-3.5 border-b border-slate-200/80 flex items-center justify-between gap-3 bg-slate-50/90 shadow-2xs">
            <div>
              <h4 className="text-xs font-bold text-slate-900">Chọn người nhận tin nhắn</h4>
              <p className="text-[10px] text-slate-500">
                {isAdmin
                  ? 'Gồm Giảng viên, Sinh viên & Admin trong toàn trường'
                  : isTeacher
                  ? 'Gồm Admin, đồng nghiệp và sinh viên các lớp bạn dạy'
                  : 'Gồm Giảng viên phụ trách môn học và Phòng Đào Tạo'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsContactPickerOpen(false)}
              className="w-7 h-7 rounded-xl bg-slate-200/80 hover:bg-slate-300 text-slate-700 flex items-center justify-center transition cursor-pointer"
            >
              <i className="fas fa-times text-xs" />
            </button>
          </div>

          <div className="p-3 border-b border-slate-100 bg-white">
            <input
              type="text"
              value={contactSearch}
              onChange={(e) => setContactSearch(e.target.value)}
              placeholder="Tìm theo tên hoặc email người nhận..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
              autoFocus
            />
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
            {isLoadingContacts ? (
              <div className="flex items-center justify-center py-10 text-slate-400 gap-2 text-xs">
                <i className="fas fa-spinner fa-spin text-indigo-500" />
                <span>Đang tìm danh bạ...</span>
              </div>
            ) : eligibleContacts.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs">
                Không tìm thấy liên hệ nào phù hợp với phạm vi phân quyền của bạn.
              </div>
            ) : (
              eligibleContacts.map((c, cIdx) => (
                <div
                  key={c._id || c.id || cIdx}
                  onClick={() => handleStartDirectWithContact(c)}
                  className="p-2.5 bg-slate-50 hover:bg-indigo-50 border border-slate-200/70 hover:border-indigo-200 rounded-xl transition cursor-pointer flex items-center justify-between gap-3 group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar src={c.avatar} name={c.name} size={34} />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition truncate">
                        {c.name}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate">{c.email}</p>
                    </div>
                  </div>
                  <div className="shrink-0">
                    {roleBadge(c.role)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default InternalMessagingPanel;
