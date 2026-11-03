import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { chatApi } from '../../api/chatApi.js';
import { useAuth } from '../../app/providers/AuthProvider.jsx';
import { useChat } from '../../app/providers/ChatProvider.jsx';
import { Avatar } from '../ui/Avatar.jsx';

export function NewMessageModal() {
  const { user } = useAuth();
  const { openChat, isNewMessageModalOpen, setIsNewMessageModalOpen } = useChat();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search input
  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 200);
    return () => clearTimeout(handler);
  }, [search]);

  const role = user?.role || '';
  const isAdmin = role === 'dao-tao' || role === 'admin';
  const isTeacher = role === 'giao-vien' || role === 'teacher';

  const { data: contactsData, isLoading } = useQuery({
    queryKey: ['chat-contacts', debouncedSearch],
    queryFn: () => chatApi.getContacts({ search: debouncedSearch }),
    enabled: isNewMessageModalOpen,
    placeholderData: (prev) => prev,
  });

  const contacts = contactsData?.data || [];

  if (!isNewMessageModalOpen) return null;

  const handleSelectContact = (contact) => {
    openChat({
      type: 'direct',
      recipientId: contact._id,
      title: contact.name,
      name: contact.name,
      role: contact.role,
      code: contact.code,
      inMyClass: contact.inMyClass,
      avatar: contact.avatar,
      email: contact.email,
    });
    setIsNewMessageModalOpen(false);
  };

  const roleBadge = (r) => {
    if (r === 'dao-tao' || r === 'admin') {
      return (
        <span className="px-1.5 py-0.2 rounded-md bg-purple-100 text-purple-700 text-[10px] font-bold">
          Phòng Đào Tạo
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

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-sm">
              <i className="fas fa-paper-plane" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Tin nhắn mới</h3>
              <p className="text-[11px] text-indigo-100">
                {isAdmin
                  ? 'Gửi tới Giảng viên, Sinh viên & Admin'
                  : isTeacher
                  ? 'Gửi tới Admin, đồng nghiệp & Sinh viên các lớp bạn dạy'
                  : 'Gửi tới Giảng viên bộ môn & Phòng Đào Tạo'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsNewMessageModalOpen(false)}
            className="w-7 h-7 rounded-lg text-white/80 hover:text-white hover:bg-white/10 flex items-center justify-center transition cursor-pointer"
            aria-label="Đóng"
          >
            <i className="fas fa-times text-xs" />
          </button>
        </div>

        {/* Search Input */}
        <div className="p-3 border-b border-slate-100 bg-slate-50">
          <div className="relative">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tên, email hoặc mã GV/SV (ví dụ: GV-001)..."
              className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 transition"
              autoFocus
            />
          </div>
        </div>

        {/* Contact List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1.5 min-h-[220px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-slate-400 gap-2 text-xs">
              <i className="fas fa-spinner fa-spin text-indigo-500" />
              <span>Đang tìm danh bạ...</span>
            </div>
          ) : contacts.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs px-4">
              <i className="fas fa-user-slash text-2xl text-slate-300 mb-2 block" />
              <p className="font-semibold text-slate-600">Không tìm thấy người phù hợp</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Chỉ hiển thị các đối tượng thuộc phạm vi giao tiếp theo phân quyền của bạn.
              </p>
            </div>
          ) : (
            contacts.map((c) => (
              <div
                key={c._id}
                onClick={() => handleSelectContact(c)}
                className="p-2.5 bg-white hover:bg-indigo-50/60 border border-slate-100 hover:border-indigo-200 rounded-xl transition cursor-pointer flex items-center justify-between gap-3 group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar src={c.avatar} name={c.name} size={36} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 truncate">
                      <h4 className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition truncate">
                        {c.name}
                      </h4>
                      {c.code && (
                        <span className="font-mono text-[9px] font-bold text-indigo-700 bg-indigo-50 px-1 py-0.2 rounded border border-indigo-100 shrink-0">
                          {c.code}
                        </span>
                      )}
                      {c.inMyClass === false && (
                        <span className="px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-600 text-[9px] font-semibold border border-slate-200 shrink-0">
                          Lớp ngoài
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">{c.email}</p>
                  </div>
                </div>
                <div className="shrink-0">{roleBadge(c.role)}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default NewMessageModal;

