import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
      if (res && Array.isArray(res.items)) {
        setBackendItems(res.items);
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
        time: formatTimeAgo(n.createdAt),
        link: n.link,
        isRead: Boolean(n.isRead),
        timestamp: new Date(n.createdAt).getTime(),
      }));
    }
    if (backendItems !== null && backendItems.length === 0) {
      return [];
    }
    return localItems;
  }, [backendItems, localItems]);

  // Unread count
  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.isRead).length;
  }, [notifications]);

  // Close dropdown on click outside
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

    const handleProfileRequestUpdate = () => {
      fetchBackendNotifications();
    };

    window.addEventListener('edumin_feedback_updated', handleFeedbackUpdate);
    window.addEventListener('edumin_attendance_updated', handleAttendanceUpdate);
    window.addEventListener('edumin_profile_request_updated', handleProfileRequestUpdate);
    window.addEventListener('edumin_notification_created', handleProfileRequestUpdate);

    return () => {
      window.removeEventListener('edumin_feedback_updated', handleFeedbackUpdate);
      window.removeEventListener('edumin_attendance_updated', handleAttendanceUpdate);
      window.removeEventListener('edumin_profile_request_updated', handleProfileRequestUpdate);
      window.removeEventListener('edumin_notification_created', handleProfileRequestUpdate);
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

  const handleNotificationClick = async (item) => {
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

    setIsOpen(false);

    if (item.link) {
      navigate(item.link);
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
        return { icon: 'fa-id-card', bg: 'bg-teal-50 text-teal-600' };
      case 'feedback':
        return { icon: 'fa-comment-dots', bg: 'bg-indigo-50 text-indigo-600' };
      case 'attendance':
        return { icon: 'fa-user-check', bg: 'bg-emerald-50 text-emerald-600' };
      case 'assignment':
        return { icon: 'fa-clipboard-list', bg: 'bg-amber-50 text-amber-600' };
      case 'system':
      default:
        return { icon: 'fa-bell', bg: 'bg-blue-50 text-blue-600' };
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

                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center justify-between gap-1">
                        <h5 className={`text-xs truncate ${!item.isRead ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
                          {item.title}
                        </h5>
                        <span className="text-[10px] text-gray-400 shrink-0">{item.time}</span>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">
                        {item.message}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleDeleteItem(e, item)}
                      className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-rose-500 p-1 rounded-lg transition"
                      title="Xóa thông báo này"
                    >
                      <i className="fas fa-times text-xs" />
                    </button>
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
    </div>
  );
}

