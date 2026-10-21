import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { notificationsApi } from '../api/notificationsApi.js';
import { tokenStore } from '../api/http.js';
import { getStoredNotifications, saveStoredNotifications } from '../services/notificationService';

function formatTimeAgo(dateInput) {
  if (!dateInput) return 'Vừa xong';
  const date = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return 'Vừa xong';
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diffSec < 60) return 'Vừa xong';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} ngày trước`;
  return date.toLocaleDateString('vi-VN');
}

export default function NotificationBell({ currentUser, customRole }) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'unread'
  const [detailModalNotif, setDetailModalNotif] = useState(null);
  const dropdownRef = useRef(null);

  const user = useMemo(() => {
    if (currentUser) return currentUser;
    try {
      return JSON.parse(sessionStorage.getItem('currentUser')) || null;
    } catch {
      return null;
    }
  }, [currentUser]);

  const role = customRole || user?.role || 'sinh-vien';

  const [backendItems, setBackendItems] = useState(null);
  const [localItems, setLocalItems] = useState(() => getStoredNotifications(role, user));

  // Fetch from backend API
  const fetchBackendNotifications = useCallback(async () => {
    if (!tokenStore.get()) return;
    try {
      const res = await notificationsApi.list({ limit: 40 });
      const items = res?.data || res?.items;
      if (Array.isArray(items)) {
        setBackendItems(items);
      }
    } catch {
      // Fallback stays in place
    }
  }, []);

  // Initial fetch and interval polling
  useEffect(() => {
    fetchBackendNotifications();
    const interval = setInterval(fetchBackendNotifications, 20000);
    const onFocus = () => fetchBackendNotifications();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [fetchBackendNotifications]);

  // Combined notifications: prefer backendItems if available, else localItems
  const notifications = useMemo(() => {
    if (backendItems !== null && backendItems.length > 0) {
      return backendItems.map((n) => ({
        id: n._id,
        _id: n._id,
        fromBackend: true,
        type: n.type || 'system',
        title: n.title,
        message: n.message,
        targetClassId: n.targetClassId || n.metadata?.classCode || '',
        metadata: n.metadata || {},
        time: formatTimeAgo(n.createdAt),
        link: n.link,
        isRead: Boolean(n.isRead),
        timestamp: n.createdAt ? new Date(n.createdAt).getTime() : Date.now(),
        senderName: n.senderName || '',
        senderRole: n.senderRole || '',
        createdAt: n.createdAt,
      }));
    }
    return localItems;
  }, [backendItems, localItems]);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.isRead).length;
  }, [notifications]);

  // Handle outside click to close dropdown
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

  // Close modal or dropdown on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (detailModalNotif) {
          setDetailModalNotif(null);
        } else if (isOpen) {
          setIsOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [detailModalNotif, isOpen]);

  // Listen to live system events
  useEffect(() => {
    const handleFeedbackUpdate = (e) => {
      fetchBackendNotifications();
      const fb = e?.detail;
      const newNotif = {
        id: `notif_live_fb_${Date.now()}`,
        type: 'feedback',
        title: role === 'sinh-vien' ? 'Phản hồi mới từ Thầy/Cô' : 'Ý kiến sinh viên mới',
        message: fb?.feedbackText
          ? `Góp ý: "${fb.feedbackText.substring(0, 60)}..."`
          : 'Có cập nhật mới về phản hồi học phần.',
        time: 'Vừa xong',
        link: role === 'sinh-vien' ? '/student' : (role === 'dao-tao' ? '/admin/feedbacks' : '/teacher'),
        isRead: false,
        timestamp: Date.now(),
      };
      setLocalItems((prev) => {
        const next = [newNotif, ...prev];
        saveStoredNotifications(role, user, next);
        return next;
      });
    };

    const handleAttendanceUpdate = (e) => {
      fetchBackendNotifications();
      const att = e?.detail;
      const newNotif = {
        id: `notif_live_att_${Date.now()}`,
        type: 'attendance',
        title: 'Cập nhật điểm danh',
        message: att?.status
          ? `Điểm danh: ${att.status} (${att.score != null ? att.score + 'đ' : ''})`
          : 'Có lượt ghi nhận chuyên cần mới trong hệ thống.',
        time: 'Vừa xong',
        link: role === 'sinh-vien' ? '/student/attendance' : (role === 'dao-tao' ? '/admin/attendance' : '/teacher/attendance'),
        isRead: false,
        timestamp: Date.now(),
      };
      setLocalItems((prev) => {
        const next = [newNotif, ...prev];
        saveStoredNotifications(role, user, next);
        return next;
      });
    };

    const handleProfileRequestUpdate = (e) => {
      fetchBackendNotifications();
      const req = e?.detail;
      if (role === 'dao-tao' && req) {
        const newNotif = {
          id: `notif_live_req_${Date.now()}`,
          type: 'approval',
          title: 'Yêu cầu duyệt thông tin mới',
          message: `${req.roleName || 'Người dùng'} ${req.name || ''} vừa gửi yêu cầu đổi: ${req.changedSummary || 'thông tin'}.`,
          time: 'Vừa xong',
          link: '/admin/profile-requests',
          isRead: false,
          timestamp: Date.now(),
        };
        setLocalItems((prev) => {
          const next = [newNotif, ...prev];
          saveStoredNotifications(role, user, next);
          return next;
        });
      }
    };

    const handleScheduleUpdate = () => {
      fetchBackendNotifications();
    };

    window.addEventListener('edumin_feedback_updated', handleFeedbackUpdate);
    window.addEventListener('edumin_attendance_updated', handleAttendanceUpdate);
    window.addEventListener('edumin_profile_request_updated', handleProfileRequestUpdate);
    window.addEventListener('edumin_notification_created', handleScheduleUpdate);
    window.addEventListener('edumin_schedule_changed', handleScheduleUpdate);
    window.addEventListener('edumin_schedule_notification', handleScheduleUpdate);

    return () => {
      window.removeEventListener('edumin_feedback_updated', handleFeedbackUpdate);
      window.removeEventListener('edumin_attendance_updated', handleAttendanceUpdate);
      window.removeEventListener('edumin_profile_request_updated', handleProfileRequestUpdate);
      window.removeEventListener('edumin_notification_created', handleScheduleUpdate);
      window.removeEventListener('edumin_schedule_changed', handleScheduleUpdate);
      window.removeEventListener('edumin_schedule_notification', handleScheduleUpdate);
    };
  }, [role, user, fetchBackendNotifications]);

  const toggleDropdown = () => {
    setIsOpen((prev) => !prev);
  };

  const markAllAsRead = async () => {
    if (backendItems !== null) {
      notificationsApi.markAllRead().catch(() => {});
      setBackendItems((prev) => (prev || []).map((x) => ({ ...x, isRead: true })));
    }
    const updated = localItems.map((n) => ({ ...n, isRead: true }));
    setLocalItems(updated);
    saveStoredNotifications(role, user, updated);
  };

  const markItemRead = (item) => {
    if (item.fromBackend && item._id) {
      notificationsApi.markRead(item._id).catch(() => {});
      setBackendItems((prev) =>
        (prev || []).map((x) => (x._id === item._id ? { ...x, isRead: true } : x))
      );
    } else {
      const updated = localItems.map((n) =>
        n.id === item.id ? { ...n, isRead: true } : n
      );
      setLocalItems(updated);
      saveStoredNotifications(role, user, updated);
    }
  };

  const resolveNotificationLink = (item) => {
    if (!item) return '/';
    if (item.link && item.link !== '#' && item.link !== '/') return item.link;
    const type = item.type || 'system';
    const isTeacher = role === 'giao-vien' || role === 'teacher';
    const isAdmin = role === 'dao-tao' || role === 'admin';

    switch (type) {
      case 'approval':
        return isAdmin ? '/admin/profile-requests' : (isTeacher ? '/teacher' : '/student');
      case 'feedback':
        return isAdmin ? '/admin/feedbacks' : (isTeacher ? '/teacher' : '/student');
      case 'attendance':
        if (isTeacher) return item.targetClassId ? `/teacher/classes/${item.targetClassId}/attendance` : '/teacher/attendance';
        if (isAdmin) return '/teacher/attendance';
        return '/student/attendance';
      case 'assignment':
      case 'quiz':
        return isTeacher ? '/teacher/assignments' : '/student/assignments';
      case 'grades':
      case 'grade':
        if (isTeacher) return item.targetClassId ? `/teacher/classes/${item.targetClassId}/grades` : '/teacher/classes';
        if (isAdmin) return '/admin/gradebook';
        return '/student/attendance';
      case 'schedule_change':
        return isTeacher ? '/teacher/schedule' : '/student/timetable';
      default:
        return isAdmin ? '/admin' : (isTeacher ? '/teacher' : '/student');
    }
  };

  const resolveNotificationActionLabel = (item) => {
    if (!item) return 'Đi tới trang liên quan';
    const type = item.type || 'system';
    const isTeacher = role === 'giao-vien' || role === 'teacher';
    const isAdmin = role === 'dao-tao' || role === 'admin';

    switch (type) {
      case 'approval':
        return isAdmin ? 'Quản lý duyệt yêu cầu' : (isTeacher ? 'Xem hồ sơ cá nhân' : 'Xem hồ sơ của tôi');
      case 'feedback':
        return isAdmin ? 'Xem danh sách phản hồi' : 'Xem chi tiết phản hồi';
      case 'attendance':
        return 'Đi tới bảng điểm danh';
      case 'assignment':
      case 'quiz':
        return 'Đi tới danh sách bài tập';
      case 'grades':
      case 'grade':
        return isAdmin ? 'Quản lý sổ điểm' : 'Xem điểm lớp học';
      case 'schedule_change':
        return isTeacher ? 'Xem lịch giảng dạy' : 'Xem thời khóa biểu';
      default:
        return 'Đi tới trang liên quan';
    }
  };

  const getSenderDisplay = (item) => {
    if (!item) return 'Hệ thống EduMin';
    if (item.senderName && item.senderName.trim()) return item.senderName;
    if (item.type === 'approval') return 'Phòng Đào tạo (Quản trị viên)';
    if (item.type === 'schedule_change') return 'Phòng Đào tạo';
    if (item.type === 'feedback') {
      return role === 'sinh-vien' ? 'Giảng viên phụ trách / PĐT' : 'Sinh viên gửi ý kiến';
    }
    return 'Hệ thống EduMin';
  };

  const handleNotificationClick = (item) => {
    markItemRead(item);
    setIsOpen(false);
    setDetailModalNotif(item);
  };

  const handleGoToRelatedPage = (item) => {
    if (!item) return;
    const target = resolveNotificationLink(item);
    setDetailModalNotif(null);
    setIsOpen(false);
    if (!target) return;

    if (target.startsWith('http://') || target.startsWith('https://')) {
      window.location.href = target;
      return;
    }

    navigate(target);

    if (typeof window !== 'undefined' && window.location.pathname === target) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleDeleteItem = async (e, item) => {
    e.stopPropagation();
    if (item.fromBackend && item._id) {
      notificationsApi.remove(item._id).catch(() => {});
      setBackendItems((prev) => (prev || []).filter((x) => x._id !== item._id));
    }
    const updated = localItems.filter((n) => n.id !== item.id);
    setLocalItems(updated);
    saveStoredNotifications(role, user, updated);
  };

  const handleClearAll = async () => {
    if (backendItems !== null && backendItems.length > 0) {
      const ids = backendItems.map((x) => x._id);
      notificationsApi.bulkDelete(ids).catch(() => {});
      setBackendItems([]);
    }
    setLocalItems([]);
    saveStoredNotifications(role, user, []);
  };

  const filteredList = useMemo(() => {
    if (activeTab === 'unread') {
      return notifications.filter((n) => !n.isRead);
    }
    return notifications;
  }, [notifications, activeTab]);

  const getTypeIcon = (type) => {
    switch (type) {
      case 'approval':
        return {
          icon: 'fa-id-card',
          bg: 'bg-teal-50 text-teal-600',
          badge: 'bg-teal-100 text-teal-700',
          label: 'Phê duyệt hồ sơ',
        };
      case 'feedback':
        return {
          icon: 'fa-comment-dots',
          bg: 'bg-indigo-50 text-indigo-600',
          badge: 'bg-indigo-100 text-indigo-700',
          label: 'Ý kiến - Phản hồi',
        };
      case 'attendance':
        return {
          icon: 'fa-user-check',
          bg: 'bg-emerald-50 text-emerald-600',
          badge: 'bg-emerald-100 text-emerald-700',
          label: 'Điểm danh lớp',
        };
      case 'assignment':
      case 'quiz':
        return {
          icon: 'fa-clipboard-list',
          bg: 'bg-amber-50 text-amber-600',
          badge: 'bg-amber-100 text-amber-700',
          label: 'Bài tập & Đánh giá',
        };
      case 'schedule_change':
        return {
          icon: 'fa-calendar-alt',
          bg: 'bg-blue-50 text-blue-600',
          badge: 'bg-blue-100 text-blue-700',
          label: 'Lịch học & Phòng học',
        };
      case 'grades':
      case 'grade':
        return {
          icon: 'fa-award',
          bg: 'bg-purple-50 text-purple-600',
          badge: 'bg-purple-100 text-purple-700',
          label: 'Bảng điểm',
        };
      case 'system':
      default:
        return {
          icon: 'fa-bell',
          bg: 'bg-indigo-50 text-indigo-600',
          badge: 'bg-indigo-100 text-indigo-700',
          label: 'Thông báo hệ thống',
        };
    }
  };

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        type="button"
        onClick={toggleDropdown}
        className="relative p-2 rounded-full text-gray-600 hover:text-indigo-600 hover:bg-indigo-50/60 transition-all duration-200 outline-none focus:ring-2 focus:ring-indigo-100 flex items-center justify-center cursor-pointer"
        title="Thông báo"
        aria-label="Xem thông báo"
      >
        <i
          className={`far fa-bell text-xl transition-transform ${
            unreadCount > 0 ? 'hover:rotate-12' : ''
          }`}
        />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full h-4 min-w-4 px-1 flex items-center justify-center shadow-sm animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-[1000]">
          <div className="p-4 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-sm">
                <i className="fas fa-bell" />
              </div>
              <div>
                <h4 className="font-bold text-sm leading-tight">Thông báo</h4>
                <p className="text-[10px] text-indigo-100">
                  {unreadCount > 0 ? `Bạn có ${unreadCount} thông báo chưa đọc` : 'Không có thông báo mới'}
                </p>
              </div>
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="text-[11px] font-semibold text-white/90 hover:text-white bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-lg transition"
              >
                Đã đọc tất cả
              </button>
            )}
          </div>

          <div className="flex items-center border-b border-gray-100 bg-gray-50/50 px-2 pt-2">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 text-xs font-bold rounded-t-lg transition border-b-2 ${
                activeTab === 'all'
                  ? 'border-indigo-600 text-indigo-600 bg-white'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Tất cả ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('unread')}
              className={`px-3 py-1.5 text-xs font-bold rounded-t-lg transition border-b-2 ${
                activeTab === 'unread'
                  ? 'border-indigo-600 text-indigo-600 bg-white'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Chưa đọc ({unreadCount})
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
            {filteredList.length === 0 ? (
              <div className="p-8 text-center text-gray-400 space-y-2">
                <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto text-gray-300 text-xl">
                  <i className="far fa-bell-slash" />
                </div>
                <p className="text-xs font-semibold text-gray-500">
                  {activeTab === 'unread' ? 'Không có thông báo chưa đọc' : 'Chưa có thông báo nào'}
                </p>
                <p className="text-[10px] text-gray-400">
                  Các thông báo hoạt động mới sẽ xuất hiện tại đây
                </p>
              </div>
            ) : (
              filteredList.map((item) => {
                const config = getTypeIcon(item.type);
                return (
                  <div
                    key={item.id}
                    onClick={() => handleNotificationClick(item)}
                    className={`p-3.5 flex items-start gap-3 cursor-pointer transition group hover:bg-indigo-50/40 relative ${
                      !item.isRead ? 'bg-indigo-50/20' : 'bg-white'
                    }`}
                  >
                    {!item.isRead && (
                      <span className="w-2 h-2 rounded-full bg-indigo-600 absolute top-4 left-2" />
                    )}

                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm shrink-0 ml-1 ${config.bg}`}
                    >
                      <i className={`fas ${config.icon}`} />
                    </div>

                    <div className="flex-1 min-w-0 pr-1">
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="min-w-0 flex-1">
                          {item.targetClassId && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700 mr-1.5 align-middle">
                              {item.targetClassId}
                            </span>
                          )}
                          <h5
                            className={`text-xs inline leading-snug line-clamp-2 break-words ${
                              !item.isRead ? 'font-bold text-gray-900' : 'font-medium text-gray-700'
                            }`}
                            title={item.title}
                          >
                            {item.title}
                          </h5>
                        </div>
                        <span className="text-[10px] text-gray-400 shrink-0 whitespace-nowrap mt-0.5">
                          {item.time}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-600 mt-1 line-clamp-3 leading-relaxed break-words">
                        {item.message}
                      </p>
                      {item.metadata?.changeType && (
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          {item.metadata.newRoom && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-amber-50 text-amber-700 border border-amber-200/60">
                              <i className="fas fa-door-open mr-1 text-[8px]" />
                              {item.metadata.oldRoom ? `${item.metadata.oldRoom} ➔ ` : ''}{item.metadata.newRoom}
                            </span>
                          )}
                          {item.metadata.newShift && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-blue-50 text-blue-700 border border-blue-200/60">
                              <i className="far fa-clock mr-1 text-[8px]" />
                              {item.metadata.newShift}
                            </span>
                          )}
                          {item.metadata.date && (
                            <span className="text-[9px] text-gray-400">
                              {item.metadata.date}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center shrink-0 self-center">
                      <button
                        type="button"
                        onClick={(e) => handleDeleteItem(e, item)}
                        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-rose-500 hover:bg-rose-50 p-1.5 rounded-lg transition"
                        title="Xóa thông báo này"
                      >
                        <i className="fas fa-times text-xs" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {notifications.length > 0 && (
            <div className="p-2.5 bg-gray-50/80 border-t border-gray-100 flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={handleClearAll}
                className="text-gray-400 hover:text-rose-500 text-[11px] font-medium transition flex items-center gap-1"
              >
                <i className="far fa-trash-alt text-[10px]" /> Xóa tất cả
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-indigo-600 font-bold text-[11px] hover:underline"
              >
                Đóng
              </button>
            </div>
          )}
        </div>
      )}

      {detailModalNotif && (() => {
        const typeInfo = getTypeIcon(detailModalNotif.type);
        const meta = detailModalNotif.metadata && typeof detailModalNotif.metadata === 'object' && !Array.isArray(detailModalNotif.metadata) ? detailModalNotif.metadata : {};
        const isApproval = detailModalNotif.type === 'approval' ||
          (detailModalNotif.title && detailModalNotif.title.toLowerCase().includes('phê duyệt')) ||
          (detailModalNotif.message && detailModalNotif.message.toLowerCase().includes('ảnh đại diện'));
        const actionLabel = resolveNotificationActionLabel(detailModalNotif);

        const modalElement = (
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setDetailModalNotif(null);
              }
            }}
          >
            <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto">
              {/* Header */}
              <div className="p-4 bg-gradient-to-r from-indigo-600 via-indigo-650 to-indigo-700 text-white flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-sm shadow-xs">
                    <i className={`fas ${typeInfo.icon || 'fa-bell'}`} />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm leading-tight">Chi tiết thông báo</h4>
                    <p className="text-[10px] text-indigo-100 font-medium">
                      {typeInfo.label || 'Hệ thống EduMin'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDetailModalNotif(null)}
                  className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
                  title="Đóng cửa sổ"
                >
                  <i className="fas fa-times text-xs" />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 space-y-4 text-xs">
                {/* Meta Header */}
                <div>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${typeInfo.badge || 'bg-indigo-100 text-indigo-700'}`}>
                      {typeInfo.label}
                    </span>
                    {detailModalNotif.targetClassId && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700">
                        Lớp: {detailModalNotif.targetClassId}
                      </span>
                    )}
                    <span className="text-slate-400 text-[10px] ml-auto flex items-center gap-1 font-medium">
                      <i className="far fa-clock text-[9px]" />
                      {detailModalNotif.time || 'Vừa xong'}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 leading-snug break-words">
                    {detailModalNotif.title}
                  </h3>
                </div>

                {/* Main Message Box */}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 text-slate-700 leading-relaxed break-words whitespace-pre-wrap text-xs shadow-2xs">
                  {detailModalNotif.message}
                </div>

                {/* Structured Detailed Info Card - NEVER EMPTY */}
                <div className="p-3.5 bg-indigo-50/60 rounded-xl border border-indigo-100 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-indigo-900 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                      <i className="fas fa-info-circle text-indigo-600 text-[11px]" />
                      Thông tin chi tiết
                    </p>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md flex items-center gap-1 ${
                      isApproval
                        ? 'text-emerald-700 bg-emerald-50 border border-emerald-200/60'
                        : 'text-indigo-700 bg-indigo-100/60 border border-indigo-200/60'
                    }`}>
                      <i className={`fas ${isApproval ? 'fa-check-circle' : 'fa-bell'} text-[9px]`} />
                      {isApproval ? 'Đã phê duyệt' : 'Ghi nhận từ hệ thống'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1.5 border-t border-indigo-100/80">
                    <div className="space-y-0.5">
                      <span className="text-slate-500 text-[10px] block">Đơn vị / Người gửi:</span>
                      <p className="font-semibold text-slate-800 break-words">
                        {getSenderDisplay(detailModalNotif)}
                      </p>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-slate-500 text-[10px] block">Thời gian gửi:</span>
                      <p className="font-semibold text-slate-800">
                        {detailModalNotif.createdAt
                          ? new Date(detailModalNotif.createdAt).toLocaleString('vi-VN', {
                              hour: '2-digit',
                              minute: '2-digit',
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                            })
                          : (detailModalNotif.time || 'Vừa xong')}
                      </p>
                    </div>

                    {detailModalNotif.targetClassId && (
                      <div className="space-y-0.5 sm:col-span-2">
                        <span className="text-slate-500 text-[10px] block">Lớp học phần:</span>
                        <p className="font-bold text-indigo-900">
                          {detailModalNotif.targetClassId}
                        </p>
                      </div>
                    )}

                    {meta.newRoom && (
                      <div className="space-y-0.5 sm:col-span-1">
                        <span className="text-slate-500 text-[10px] block">Phòng học áp dụng:</span>
                        <p className="font-semibold text-slate-800">
                          {meta.oldRoom ? `${meta.oldRoom} ➔ ` : ''}
                          <span className="text-indigo-700 font-bold">{meta.newRoom}</span>
                        </p>
                      </div>
                    )}

                    {meta.newShift && (
                      <div className="space-y-0.5 sm:col-span-1">
                        <span className="text-slate-500 text-[10px] block">Ca học:</span>
                        <p className="font-bold text-indigo-700">{meta.newShift}</p>
                      </div>
                    )}

                    {meta.date && (
                      <div className="space-y-0.5 sm:col-span-1">
                        <span className="text-slate-500 text-[10px] block">Ngày áp dụng:</span>
                        <p className="font-semibold text-slate-800">{meta.date}</p>
                      </div>
                    )}

                    {meta.reason && (
                      <div className="space-y-0.5 sm:col-span-2">
                        <span className="text-slate-500 text-[10px] block">Lý do điều chỉnh:</span>
                        <p className="text-slate-700 italic break-words">{meta.reason}</p>
                      </div>
                    )}
                  </div>

                  {/* Profile / Avatar Approval Rich Feedback */}
                  {isApproval && (
                    <div className="mt-2 pt-2 border-t border-indigo-100 text-[11px] text-emerald-800 bg-emerald-50/80 p-2.5 rounded-xl flex items-start gap-2 border border-emerald-200/50">
                      <i className="fas fa-check-double text-emerald-600 mt-0.5 text-xs shrink-0" />
                      <div className="leading-relaxed">
                        <p className="font-bold text-emerald-950">
                          Hồ sơ đã được đồng bộ hóa trên toàn hệ thống
                        </p>
                        <p className="text-[10px] text-emerald-800 mt-0.5">
                          {detailModalNotif.message?.toLowerCase().includes('ảnh đại diện')
                            ? 'Ảnh đại diện mới đã được Quản trị viên (Phòng Đào tạo) phê duyệt và cập nhật ngay vào tài khoản cá nhân, thẻ định danh và danh sách lớp học phần.'
                            : 'Thông tin thay đổi đã được Phòng Đào tạo kiểm tra, phê duyệt và cập nhật thành công vào cơ sở dữ liệu.'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setDetailModalNotif(null)}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
                  >
                    Đóng
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGoToRelatedPage(detailModalNotif)}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-sm hover:shadow cursor-pointer"
                    title="Đi tới trang liên quan"
                  >
                    <span>Đi tới trang liên quan</span>
                    <i className="fas fa-arrow-right text-[10px]" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

        return typeof document !== 'undefined'
          ? createPortal(modalElement, document.body)
          : modalElement;
      })()}
    </div>
  );
}
