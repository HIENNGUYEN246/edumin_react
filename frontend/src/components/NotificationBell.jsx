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
        if (isAdmin) return '/admin/attendance';
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
        return isTeacher ? '/teacher/schedule' : '/student/schedule';
      default:
        return isAdmin ? '/admin' : (isTeacher ? '/teacher' : '/student');
    }
  };

  const handleNotificationClick = async (item) => {
    markItemRead(item);
    setIsOpen(false);

    const targetUrl = resolveNotificationLink(item);
    if (targetUrl) {
      navigate(targetUrl);
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
      case 'schedule_change':
        return { icon: 'fa-calendar-alt', bg: 'bg-amber-50 text-amber-600' };
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
                        <div className="flex items-center gap-1.5 min-w-0">
                          {item.targetClassId && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700 shrink-0">
                              {item.targetClassId}
                            </span>
                          )}
                          <h5 className={`text-xs truncate ${!item.isRead ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
                            {item.title}
                          </h5>
                        </div>
                        <span className="text-[10px] text-gray-400 shrink-0">{item.time}</span>
                      </div>
                      <p className="text-[11px] text-gray-600 mt-0.5 line-clamp-3 leading-relaxed break-words">
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

                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDetailModalNotif(item);
                          markItemRead(item);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-indigo-600 p-1 rounded-lg transition"
                        title="Xem chi tiết nội dung"
                      >
                        <i className="far fa-eye text-xs" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteItem(e, item)}
                        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-rose-500 p-1 rounded-lg transition"
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

      {detailModalNotif && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <i className={`fas ${getTypeIcon(detailModalNotif.type)?.icon || 'fa-bell'}`} />
                <h4 className="font-bold text-sm">Chi tiết thông báo</h4>
              </div>
              <button
                type="button"
                onClick={() => setDetailModalNotif(null)}
                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
              >
                <i className="fas fa-times text-xs" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div>
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  {detailModalNotif.targetClassId && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700">
                      Lớp: {detailModalNotif.targetClassId}
                    </span>
                  )}
                  <span className="text-slate-400 text-[10px]">{detailModalNotif.time}</span>
                </div>
                <h3 className="text-sm font-bold text-slate-900 leading-snug">{detailModalNotif.title}</h3>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 text-slate-700 leading-relaxed break-words whitespace-pre-wrap">
                {detailModalNotif.message}
              </div>

              {detailModalNotif.metadata && typeof detailModalNotif.metadata === 'object' && !Array.isArray(detailModalNotif.metadata) && Object.keys(detailModalNotif.metadata).length > 0 && (
                <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 space-y-1.5">
                  <p className="font-bold text-indigo-900 text-[11px] uppercase tracking-wider">Thông tin chi tiết:</p>
                  {detailModalNotif.metadata.newRoom && (
                    <p className="text-indigo-800">
                      Phòng học: {detailModalNotif.metadata.oldRoom ? `${detailModalNotif.metadata.oldRoom} ➔ ` : ''}
                      <strong className="text-indigo-950 font-bold">{detailModalNotif.metadata.newRoom}</strong>
                    </p>
                  )}
                  {detailModalNotif.metadata.newShift && (
                    <p className="text-indigo-800">
                      Ca học: <strong className="text-indigo-950 font-bold">{detailModalNotif.metadata.newShift}</strong>
                    </p>
                  )}
                  {detailModalNotif.metadata.date && (
                    <p className="text-indigo-800">
                      Ngày áp dụng: <strong className="text-indigo-950 font-bold">{detailModalNotif.metadata.date}</strong>
                    </p>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDetailModalNotif(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const target = resolveNotificationLink(detailModalNotif);
                    setDetailModalNotif(null);
                    setIsOpen(false);
                    if (target) navigate(target);
                  }}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <span>Đi tới trang liên quan</span>
                  <i className="fas fa-arrow-right text-[10px]" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
