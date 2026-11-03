import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useChat } from '../../app/providers/ChatProvider.jsx';
import { chatApi } from '../../api/chatApi.js';
import { Avatar } from '../ui/Avatar.jsx';

function formatTimeAgo(dateInput) {
  if (!dateInput) return '';
  const date = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return '';
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diffSec < 60) return 'Vừa xong';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} phút`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} giờ`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} ngày`;
  return date.toLocaleDateString('vi-VN');
}

function removeVietnameseTones(str = '') {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

export function MessengerBell() {
  const {
    classGroups,
    directConversations,
    contacts: contextContacts,
    totalUnread,
    openChat,
    setIsNewMessageModalOpen,
  } = useChat();

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'classes' | 'teachers' | 'students'
  const [search, setSearch] = useState('');
  const dropdownRef = useRef(null);

  // Fetch eligible contacts (Giảng viên, Sinh viên, Admin) when dropdown is opened or search changes
  const { data: contactsData } = useQuery({
    queryKey: ['chat-contacts-bell', search],
    queryFn: () => chatApi.getContacts({ search }),
    enabled: isOpen,
    staleTime: 5000,
  });

  const contactsList = contactsData?.data || contextContacts || [];

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Separate and format conversations and contacts
  const {
    classesList,
    teachersList,
    studentsList,
    adminsList,
    classCount,
    teacherCount,
    studentCount,
  } = useMemo(() => {
    const q = search.trim();
    const normQ = removeVietnameseTones(q);

    // 1. Format Course Classes (with studentCount and hasStudents)
    const formattedClasses = classGroups.map((c) => {
      const studentNum = c.studentCount !== undefined && c.studentCount !== null
        ? Number(c.studentCount)
        : (c.memberCount ? Math.max(0, c.memberCount - (c.teacher ? 1 : 0)) : 0);

      return {
        ...c,
        itemType: 'class_group',
        type: 'class_group',
        studentCount: studentNum,
        hasStudents: studentNum > 0,
        displayName: c.courseName || c.className || c.classId,
        subName: `Lớp ${c.classId} • GV: ${c.teacher || 'Chưa phân công'}`,
        timestamp: c.lastMessage?.createdAt ? new Date(c.lastMessage.createdAt).getTime() : 0,
        timeText: formatTimeAgo(c.lastMessage?.createdAt),
        lastText: c.lastMessage?.content || 'Chưa có tin nhắn nào',
        lastSender: c.lastMessage?.senderName || '',
        isOwn: c.lastMessage?.isOwn || false,
      };
    });

    // 2. Format Existing Direct Conversations
    const formattedDirects = directConversations.map((d) => ({
      ...d,
      itemType: 'direct',
      type: 'direct',
      recipientId: d.partnerId,
      displayName: d.name,
      subName: d.email || d.role,
      timestamp: d.lastMessage?.createdAt ? new Date(d.lastMessage.createdAt).getTime() : 0,
      timeText: formatTimeAgo(d.lastMessage?.createdAt),
      lastText: d.lastMessage?.content || 'Bắt đầu cuộc trò chuyện',
      lastSender: d.lastMessage?.senderName || '',
      isOwn: d.lastMessage?.isOwn || false,
    }));

    // Partner IDs already in directConversations
    const existingPartnerIds = new Set(directConversations.map((d) => String(d.partnerId)));

    // 3. Additional Contacts from directory (not yet messaged)
    const additionalContacts = contactsList
      .filter((c) => !existingPartnerIds.has(String(c._id)))
      .map((c) => ({
        ...c,
        itemType: 'direct',
        type: 'direct',
        recipientId: c._id,
        partnerId: c._id,
        displayName: c.name || c.hoTen || c.email,
        subName: c.email || c.role,
        timestamp: 0,
        timeText: '',
        lastText: 'Bắt đầu cuộc trò chuyện',
        lastSender: '',
        isOwn: false,
        isNewContact: true,
      }));

    const allIndividuals = [...formattedDirects, ...additionalContacts];

    // Filter helper
    const filterItem = (item) => {
      if (!normQ) return true;
      const nameMatch = removeVietnameseTones(item.displayName).includes(normQ);
      const subMatch = removeVietnameseTones(item.subName).includes(normQ);
      const classIdMatch = item.classId && removeVietnameseTones(item.classId).includes(normQ);
      const emailMatch = item.email && removeVietnameseTones(item.email).includes(normQ);
      return nameMatch || subMatch || classIdMatch || emailMatch;
    };

    // Filter classes
    const filteredClasses = formattedClasses.filter(filterItem);

    // Split individuals into Teachers, Students, Admins
    const allTeachers = allIndividuals.filter(
      (p) => p.role === 'giao-vien' || p.role === 'teacher'
    );
    const allStudents = allIndividuals.filter(
      (p) => p.role === 'sinh-vien' || p.role === 'student'
    );
    const allAdmins = allIndividuals.filter(
      (p) => p.role === 'dao-tao' || p.role === 'admin'
    );

    const filteredTeachers = allTeachers.filter(filterItem);
    const filteredStudents = allStudents.filter(filterItem);
    const filteredAdmins = allAdmins.filter(filterItem);

    return {
      classesList: filteredClasses,
      teachersList: filteredTeachers,
      studentsList: filteredStudents,
      adminsList: filteredAdmins,
      classCount: formattedClasses.length,
      teacherCount: allTeachers.length,
      studentCount: allStudents.length,
    };
  }, [classGroups, directConversations, contactsList, search]);

  const handleSelectConversation = (item) => {
    openChat(item);
    setIsOpen(false);
  };

  const handleOpenCompose = () => {
    setIsNewMessageModalOpen(true);
    setIsOpen(false);
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

  // Determine which sections to render based on activeTab
  const renderSections = () => {
    const totalMatching =
      classesList.length + teachersList.length + studentsList.length + adminsList.length;

    if (totalMatching === 0) {
      return (
        <div className="text-center py-12 px-4 text-slate-400">
          <i className="fas fa-comment-slash text-2xl text-slate-300 mb-2 block" />
          <p className="text-xs font-semibold text-slate-600">Không tìm thấy kết quả nào</p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            Thử tìm theo tên, email hoặc mã lớp học phần khác.
          </p>
        </div>
      );
    }

    // Render an individual card
    const renderIndividualCard = (item, idx) => (
      <div
        key={item.key || item.recipientId || item.partnerId || item._id || idx}
        onClick={() => handleSelectConversation(item)}
        className="p-2.5 rounded-xl hover:bg-indigo-50/70 transition cursor-pointer flex items-center gap-3 group relative border border-transparent hover:border-indigo-100"
      >
        <div className="relative shrink-0">
          <Avatar src={item.avatar} name={item.displayName} size={40} />
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1.5 truncate">
              <h4 className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition truncate">
                {item.displayName}
              </h4>
              {roleBadge(item.role)}
            </div>
            {item.timeText ? (
              <span className="text-[10px] text-slate-400 font-mono shrink-0">
                {item.timeText}
              </span>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-2 mt-0.5">
            <p className={`text-[11px] truncate ${item.unreadCount > 0 ? 'font-bold text-slate-900' : 'text-slate-500'}`}>
              {item.isOwn && <span className="text-slate-600 font-medium">Bạn: </span>}
              {item.lastText}
            </p>
            {item.unreadCount > 0 ? (
              <span className="min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white font-extrabold text-[9px] flex items-center justify-center shrink-0">
                {item.unreadCount}
              </span>
            ) : item.isNewContact ? (
              <span className="text-[10px] font-medium text-indigo-600 opacity-0 group-hover:opacity-100 transition shrink-0">
                Nhắn tin
              </span>
            ) : null}
          </div>
        </div>
      </div>
    );

    // Render a class card with student count badge
    const renderClassCard = (item, idx) => (
      <div
        key={item.key || item.classId || item._id || idx}
        onClick={() => handleSelectConversation(item)}
        className="p-2.5 rounded-xl hover:bg-indigo-50/70 transition cursor-pointer flex items-center gap-3 group relative border border-transparent hover:border-indigo-100"
      >
        <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 font-bold group-hover:scale-105 transition shadow-2xs">
          <i className="fas fa-graduation-cap text-sm" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1.5 truncate">
              <span className="font-mono font-bold text-[10px] text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-100 shrink-0">
                {item.classId}
              </span>
              <h4 className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition truncate" title={item.displayName}>
                {item.displayName}
              </h4>
            </div>

            {/* Sĩ số sinh viên & Trạng thái có sinh viên */}
            {item.studentCount > 0 ? (
              <span
                data-testid={`badge-class-${item.classId}`}
                className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0 flex items-center gap-1"
                title={`Đang có ${item.studentCount} sinh viên trong lớp`}
              >
                <i className="fas fa-users text-[9px]" />
                <span>{item.studentCount} SV</span>
              </span>
            ) : (
              <span
                data-testid={`badge-class-${item.classId}`}
                className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 shrink-0 flex items-center gap-1"
                title="Lớp học phần chưa có sinh viên ghi danh"
              >
                <i className="fas fa-user-slash text-[9px]" />
                <span>Chưa có SV</span>
              </span>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 mt-1">
            <p className="text-[11px] text-slate-500 truncate">
              <span className="text-slate-600 font-medium">GV: {item.teacher || 'Chưa phân công'}</span>
              {item.lastText && item.lastText !== 'Chưa có tin nhắn nào' && (
                <span className="text-slate-400"> • {item.lastSender ? `${item.lastSender}: ` : ''}{item.lastText}</span>
              )}
            </p>
            {item.unreadCount > 0 && (
              <span className="min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white font-extrabold text-[9px] flex items-center justify-center shrink-0">
                {item.unreadCount}
              </span>
            )}
          </div>
        </div>
      </div>
    );

    // Section title component
    const SectionHeader = ({ icon, title, count, colorClass = 'text-slate-600' }) => (
      <div className="px-2.5 py-1 text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between bg-slate-100/80 rounded-lg my-1.5">
        <span className={`flex items-center gap-1.5 ${colorClass}`}>
          <i className={`${icon} text-xs`} />
          <span>{title}</span>
        </span>
        <span className="text-[10px] text-slate-400 font-mono">({count})</span>
      </div>
    );

    // Tab 1: Chỉ xem Lớp học phần
    if (activeTab === 'classes') {
      return classesList.map(renderClassCard);
    }

    // Tab 2: Chỉ xem Giáo viên
    if (activeTab === 'teachers') {
      return teachersList.map(renderIndividualCard);
    }

    // Tab 3: Chỉ xem Sinh viên
    if (activeTab === 'students') {
      return studentsList.map(renderIndividualCard);
    }

    // Tab 4 (hoặc 'all' / 'direct'): Phân nhóm rõ ràng từng mục
    return (
      <div className="space-y-1">
        {/* Lớp học phần */}
        {classesList.length > 0 && (
          <div>
            <SectionHeader
              icon="fas fa-graduation-cap"
              title="Lớp học phần"
              count={classesList.length}
              colorClass="text-indigo-700"
            />
            {classesList.map(renderClassCard)}
          </div>
        )}

        {/* Giáo viên */}
        {teachersList.length > 0 && (
          <div>
            <SectionHeader
              icon="fas fa-chalkboard-user"
              title="Giáo viên / Giảng viên"
              count={teachersList.length}
              colorClass="text-indigo-700"
            />
            {teachersList.map(renderIndividualCard)}
          </div>
        )}

        {/* Sinh viên */}
        {studentsList.length > 0 && (
          <div>
            <SectionHeader
              icon="fas fa-user-graduate"
              title="Sinh viên"
              count={studentsList.length}
              colorClass="text-emerald-700"
            />
            {studentsList.map(renderIndividualCard)}
          </div>
        )}

        {/* Ban Quản trị / Đào tạo */}
        {adminsList.length > 0 && (
          <div>
            <SectionHeader
              icon="fas fa-building-columns"
              title="Ban Quản trị & Đào tạo"
              count={adminsList.length}
              colorClass="text-purple-700"
            />
            {adminsList.map(renderIndividualCard)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Messenger Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative p-2 rounded-full text-gray-600 hover:text-indigo-600 hover:bg-indigo-50/60 transition-all duration-200 outline-none focus:ring-2 focus:ring-indigo-100 flex items-center justify-center cursor-pointer"
        title="Tin nhắn (Messenger)"
        aria-label="Xem tin nhắn"
      >
        {/* Messenger icon */}
        <i
          className={`fab fa-facebook-messenger text-xl transition-transform ${
            totalUnread > 0 ? 'hover:scale-110 text-indigo-600' : ''
          }`}
        />
        {totalUnread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full h-4 min-w-4 px-1 flex items-center justify-center shadow-sm animate-pulse">
            {totalUnread > 99 ? '99+' : totalUnread}
          </span>
        )}
      </button>

      {/* Facebook-style Messenger Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden z-[1000] animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="p-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-sm shadow-xs">
                <i className="fab fa-facebook-messenger" />
              </div>
              <div>
                <h4 className="font-bold text-sm leading-tight">Đoạn chat</h4>
                <p className="text-[10px] text-indigo-100">
                  {totalUnread > 0 ? `${totalUnread} tin nhắn chưa đọc` : 'Trao đổi Lớp & Cá nhân'}
                </p>
              </div>
            </div>

            {/* Compose New Message Button */}
            <button
              type="button"
              onClick={handleOpenCompose}
              className="px-2.5 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              title="Soạn tin nhắn mới"
            >
              <i className="fas fa-pen-to-square text-xs" />
              <span>Soạn tin</span>
            </button>
          </div>

          {/* Search Bar */}
          <div className="p-2.5 border-b border-slate-100 bg-slate-50">
            <div className="relative">
              <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm kiếm lớp học phần, giáo viên, sinh viên..."
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 transition"
              />
            </div>

            {/* 4 Distinct Filter Tabs: Tất cả | Lớp HP | Giáo viên | Sinh viên */}
            <div className="flex items-center gap-1 mt-2 overflow-x-auto pb-0.5 custom-scrollbar">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer shrink-0 ${
                  activeTab === 'all'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                Tất cả
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('classes')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer shrink-0 flex items-center gap-1 ${
                  activeTab === 'classes'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <i className="fas fa-graduation-cap text-[10px]" />
                <span>Lớp HP</span>
                {classCount > 0 && (
                  <span className="ml-0.5 opacity-80">({classCount})</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('teachers')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer shrink-0 flex items-center gap-1 ${
                  activeTab === 'teachers'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <i className="fas fa-chalkboard-user text-[10px]" />
                <span>Giáo viên</span>
                {teacherCount > 0 && (
                  <span className="ml-0.5 opacity-80">({teacherCount})</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('students')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer shrink-0 flex items-center gap-1 ${
                  activeTab === 'students'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <i className="fas fa-user-graduate text-[10px]" />
                <span>Sinh viên</span>
                {studentCount > 0 && (
                  <span className="ml-0.5 opacity-80">({studentCount})</span>
                )}
              </button>
            </div>
          </div>

          {/* Conversation & Contact List */}
          <div className="max-h-[380px] overflow-y-auto custom-scrollbar p-1.5 space-y-1">
            {renderSections()}
          </div>
        </div>
      )}
    </div>
  );
}

export default MessengerBell;
