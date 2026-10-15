import React, { useState, useEffect, useMemo } from 'react';
import { notificationsApi } from '../../api/notificationsApi.js';
import { classesApi } from '../../api/classesApi.js';
import { departmentsApi } from '../../api/departmentsApi.js';
import { studentsApi } from '../../api/studentsApi.js';
import { teachersApi } from '../../api/teachersApi.js';
import { useToast } from '../../app/providers/ToastProvider.jsx';

export function ScheduleChangeNotificationModal({ isOpen, onClose, defaultClassId = '', userRole = 'giao-vien' }) {
  const toast = useToast();

  const [targetType, setTargetType] = useState('class'); // 'class' | 'department' | 'all' | 'individual'
  const [selectedClassId, setSelectedClassId] = useState(defaultClassId);
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [individualSearch, setIndividualSearch] = useState('');
  const [selectedIndividuals, setSelectedIndividuals] = useState([]);

  // Change parameters
  const [changeType, setChangeType] = useState('room_change'); // 'room_change' | 'period_change' | 'reschedule' | 'cancel'
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [oldRoom, setOldRoom] = useState('');
  const [newRoom, setNewRoom] = useState('');
  const [oldShift, setOldShift] = useState('Sáng (Tiết 1 - 3)');
  const [newShift, setNewShift] = useState('Sáng (Tiết 1 - 3)');
  const [reason, setReason] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Available options
  const [classesList, setClassesList] = useState([]);
  const [departmentsList, setDepartmentsList] = useState([]);
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);

  // Synchronize defaultClassId
  useEffect(() => {
    if (defaultClassId) {
      setSelectedClassId(defaultClassId);
    }
  }, [defaultClassId]);

  // Load classes & departments
  useEffect(() => {
    if (!isOpen) return;

    let active = true;
    async function loadData() {
      try {
        const isTeacher = userRole === 'giao-vien' || userRole === 'teacher';
        const params = isTeacher ? { teacher: 'me', limit: 100 } : { limit: 100 };
        const res = await classesApi.list(params);
        if (active && res?.data) {
          setClassesList(res.data);
          if (!selectedClassId && res.data.length > 0) {
            setSelectedClassId(res.data[0].id);
          }
        }
      } catch {
        // Fallback or ignore
      }

      try {
        const deptRes = await departmentsApi.list();
        if (active && deptRes?.data) {
          setDepartmentsList(deptRes.data);
        }
      } catch {}
    }

    loadData();
    return () => {
      active = false;
    };
  }, [isOpen, userRole, selectedClassId]);

  // Auto-fill oldRoom when a class is selected
  useEffect(() => {
    if (selectedClassId && classesList.length > 0) {
      const cls = classesList.find((c) => c.id === selectedClassId || c._id === selectedClassId);
      if (cls?.room && !oldRoom) {
        setOldRoom(cls.room);
      }
    }
  }, [selectedClassId, classesList, oldRoom]);

  // Search individual students/teachers
  useEffect(() => {
    if (targetType !== 'individual' || !individualSearch.trim() || individualSearch.length < 2) {
      setUserSearchResults([]);
      return;
    }

    let active = true;
    const timer = setTimeout(async () => {
      setIsSearchingUsers(true);
      try {
        const [studentsRes, teachersRes] = await Promise.allSettled([
          studentsApi.list({ search: individualSearch.trim(), limit: 10 }),
          teachersApi.list({ search: individualSearch.trim(), limit: 10 }),
        ]);

        const results = [];
        if (studentsRes.status === 'fulfilled' && studentsRes.value?.data) {
          results.push(
            ...studentsRes.value.data.map((s) => ({
              id: s.userId || s._id || s.id,
              name: s.hoTen || s.email,
              code: `SV-${s.id}`,
              role: 'Sinh viên',
              department: s.department,
            }))
          );
        }
        if (teachersRes.status === 'fulfilled' && teachersRes.value?.data) {
          results.push(
            ...teachersRes.value.data.map((t) => ({
              id: t.userId || t._id || t.id,
              name: t.hoTen || t.email,
              code: `GV-${t.id}`,
              role: 'Giảng viên',
              department: t.department,
            }))
          );
        }

        if (active) {
          setUserSearchResults(results);
        }
      } catch {
        if (active) setUserSearchResults([]);
      } finally {
        if (active) setIsSearchingUsers(false);
      }
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [individualSearch, targetType]);

  // Auto-generate title & message template whenever core fields change
  useEffect(() => {
    const classTag = selectedClassId ? `[${selectedClassId}] ` : '';
    let autoTitle = '';
    let autoMsg = '';

    const selectedCls = classesList.find((c) => c.id === selectedClassId || c._id === selectedClassId);
    const classNameStr = selectedCls ? ` (${selectedCls.courseName || selectedCls.className || ''})` : '';

    switch (changeType) {
      case 'room_change':
        autoTitle = `${classTag}Thông báo đổi phòng học sang ${newRoom || '...'}`;
        autoMsg = `Lớp ${selectedClassId || ''}${classNameStr} sẽ đổi sang học tại phòng ${newRoom || 'mới'} vào ngày ${date}. Lý do: ${reason || 'Điều phối cơ sở vật chất'}.`;
        break;
      case 'period_change':
        autoTitle = `${classTag}Thông báo đổi ca/tiết học ngày ${date}`;
        autoMsg = `Lớp ${selectedClassId || ''}${classNameStr} đổi giờ học từ [${oldShift}] sang [${newShift}] vào ngày ${date}. Lý do: ${reason || 'Theo kế hoạch điều chỉnh'}.`;
        break;
      case 'reschedule':
        autoTitle = `${classTag}Thông báo dời lịch học / Học bù`;
        autoMsg = `Lớp ${selectedClassId || ''}${classNameStr} có lịch học bù/dời lịch sang ngày ${date}, ${newShift} tại phòng ${newRoom || oldRoom || 'học'}. Lý do: ${reason || 'Dời lịch giảng dạy'}.`;
        break;
      case 'cancel':
        autoTitle = `${classTag}Thông báo nghỉ buổi học ngày ${date}`;
        autoMsg = `Lớp ${selectedClassId || ''}${classNameStr} được nghỉ buổi học vào ngày ${date} (${oldShift}). Lịch học bù sẽ được thông báo sau. Lý do: ${reason || 'Kế hoạch công tác của Thầy/Cô'}.`;
        break;
      default:
        autoTitle = `${classTag}Thông báo điều chỉnh lịch học`;
        autoMsg = `Lớp ${selectedClassId || ''}${classNameStr} có cập nhật lịch học vào ngày ${date}.`;
    }

    setTitle(autoTitle);
    setMessage(autoMsg);
  }, [changeType, selectedClassId, date, oldRoom, newRoom, oldShift, newShift, reason, classesList]);

  if (!isOpen) return null;

  const handleAddIndividual = (user) => {
    if (!selectedIndividuals.some((u) => u.id === user.id)) {
      setSelectedIndividuals((prev) => [...prev, user]);
    }
    setIndividualSearch('');
    setUserSearchResults([]);
  };

  const handleRemoveIndividual = (id) => {
    setSelectedIndividuals((prev) => prev.filter((u) => u.id !== id));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      toast.error('Vui lòng nhập đầy đủ tiêu đề và nội dung thông báo');
      return;
    }

    if (targetType === 'class' && !selectedClassId) {
      toast.error('Vui lòng chọn lớp học phần nhận thông báo');
      return;
    }

    if (targetType === 'department' && !selectedDepartment) {
      toast.error('Vui lòng chọn Khoa/Khối đào tạo');
      return;
    }

    if (targetType === 'individual' && selectedIndividuals.length === 0) {
      toast.error('Vui lòng chọn ít nhất 1 người nhận thông báo');
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedCls = classesList.find((c) => c.id === selectedClassId || c._id === selectedClassId);
      const payload = {
        targetType,
        targetClassId: targetType === 'class' ? selectedClassId : '',
        targetIds:
          targetType === 'class'
            ? [selectedClassId]
            : targetType === 'department'
            ? [selectedDepartment]
            : targetType === 'individual'
            ? selectedIndividuals.map((u) => String(u.id))
            : ['all'],
        type: 'schedule_change',
        title: title.trim(),
        message: message.trim(),
        metadata: {
          changeType,
          classCode: selectedClassId || '',
          className: selectedCls?.courseName || selectedCls?.className || '',
          date,
          oldRoom,
          newRoom,
          oldShift,
          newShift,
          reason,
        },
      };

      const res = await notificationsApi.broadcast(payload);

      // Trigger immediate UI events across open tabs & notification bell
      window.dispatchEvent(
        new CustomEvent('edumin_notification_created', {
          detail: { ...payload, res },
        })
      );
      window.dispatchEvent(
        new CustomEvent('edumin_schedule_changed', {
          detail: { ...payload, res },
        })
      );

      toast.success(
        `Đã phát thông báo đổi lịch thành công (${res?.recipientCount ?? 1} người nhận)!`
      );
      onClose();
    } catch (err) {
      toast.error(err?.message || 'Không thể phát thông báo. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 text-white px-6 py-4 flex items-center justify-between shrink-0 shadow-xs border-b border-indigo-700/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center text-lg shadow-inner shrink-0">
              <i className="fas fa-calendar-alt text-amber-300" />
            </div>
            <div>
              <h3 className="text-base font-bold tracking-tight">Điều phối & Thông báo Đổi lịch học</h3>
              <p className="text-xs text-indigo-100/90 mt-0.5">
                Phát thông báo real-time tới sinh viên, giảng viên và đồng bộ cùng AI Assistant
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-white/90 hover:text-white transition cursor-pointer shrink-0 ml-3"
            aria-label="Đóng"
          >
            <i className="fas fa-times text-sm" />
          </button>
        </div>

        {/* Form Body with Fixed Footer */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="p-6 sm:p-7 overflow-y-auto space-y-6 flex-1 text-xs">
            {/* 1. Target Scope Selection */}
          <div className="space-y-2">
            <label className="font-bold text-gray-700 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <i className="fas fa-bullseye text-indigo-600" /> 1. Chọn phạm vi nhận thông báo
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setTargetType('class')}
                className={`p-2.5 rounded-xl border text-center transition flex flex-col items-center gap-1.5 ${
                  targetType === 'class'
                    ? 'border-indigo-600 bg-indigo-50/70 text-indigo-700 font-bold shadow-sm'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                <i className="fas fa-users-class text-sm" />
                <span>Theo Lớp học phần</span>
              </button>

              <button
                type="button"
                onClick={() => setTargetType('individual')}
                className={`p-2.5 rounded-xl border text-center transition flex flex-col items-center gap-1.5 ${
                  targetType === 'individual'
                    ? 'border-indigo-600 bg-indigo-50/70 text-indigo-700 font-bold shadow-sm'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                <i className="fas fa-user-check text-sm" />
                <span>Cá nhân cụ thể</span>
              </button>

              <button
                type="button"
                onClick={() => setTargetType('department')}
                className={`p-2.5 rounded-xl border text-center transition flex flex-col items-center gap-1.5 ${
                  targetType === 'department'
                    ? 'border-indigo-600 bg-indigo-50/70 text-indigo-700 font-bold shadow-sm'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                <i className="fas fa-university text-sm" />
                <span>Theo Khoa / Khối</span>
              </button>

              <button
                type="button"
                onClick={() => setTargetType('all')}
                className={`p-2.5 rounded-xl border text-center transition flex flex-col items-center gap-1.5 ${
                  targetType === 'all'
                    ? 'border-indigo-600 bg-indigo-50/70 text-indigo-700 font-bold shadow-sm'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                <i className="fas fa-globe text-sm" />
                <span>Toàn trường</span>
              </button>
            </div>
          </div>

          {/* Conditional Target Selectors */}
          {targetType === 'class' && (
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-1.5">
              <label className="font-semibold text-gray-700 block">Chọn Lớp học phần phụ trách:</label>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="">-- Chọn mã lớp học phần --</option>
                {classesList.map((c) => (
                  <option key={c._id || c.id} value={c.id}>
                    {c.id} - {c.courseName || c.className || 'Lớp HP'} (Phòng {c.room || 'TBA'})
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-gray-400">
                Tất cả sinh viên đã đăng ký lớp học phần này sẽ tự động nhận được thông báo chuông và nhắc nhở từ AI.
              </p>
            </div>
          )}

          {targetType === 'department' && (
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-1.5">
              <label className="font-semibold text-gray-700 block">Chọn Khoa đào tạo:</label>
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="">-- Chọn Khoa --</option>
                {departmentsList.map((d) => (
                  <option key={d._id || d.name} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {targetType === 'individual' && (
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-2">
              <label className="font-semibold text-gray-700 block">Tìm kiếm và chọn người nhận:</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Gõ tên, mã SV (SV-xxx) hoặc email..."
                  value={individualSearch}
                  onChange={(e) => setIndividualSearch(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-xl pl-9 pr-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                <i className="fas fa-search absolute left-3 top-2.5 text-gray-400" />
              </div>

              {/* User search dropdown suggestions */}
              {userSearchResults.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl shadow-lg max-h-40 overflow-y-auto divide-y divide-gray-50">
                  {userSearchResults.map((u) => (
                    <div
                      key={u.id}
                      onClick={() => handleAddIndividual(u)}
                      className="p-2 hover:bg-indigo-50 cursor-pointer flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold">
                          {u.name[0]}
                        </span>
                        <div>
                          <p className="font-bold text-gray-800">{u.name}</p>
                          <p className="text-[10px] text-gray-400">
                            {u.code} • {u.role} ({u.department || 'ĐH'})
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] text-indigo-600 font-semibold">+ Thêm</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Selected Pills */}
              {selectedIndividuals.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {selectedIndividuals.map((u) => (
                    <span
                      key={u.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-800 font-medium text-[11px]"
                    >
                      <span>
                        {u.name} ({u.code})
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveIndividual(u.id)}
                        className="text-indigo-400 hover:text-indigo-900"
                      >
                        <i className="fas fa-times text-[10px]" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 2. Change Category & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <label className="font-semibold text-gray-700 block">Loại hình điều chỉnh:</label>
              <select
                value={changeType}
                onChange={(e) => setChangeType(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium"
              >
                <option value="room_change">🏢 Đổi phòng học</option>
                <option value="period_change">⏰ Đổi ca / tiết học</option>
                <option value="reschedule">📅 Dời lịch / Học bù</option>
                <option value="cancel">🚫 Hủy / Nghỉ buổi học</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-gray-700 block">Ngày áp dụng:</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Conditional Detail Fields */}
          {changeType === 'room_change' && (
            <div className="grid grid-cols-2 gap-3 bg-amber-50/50 p-3.5 rounded-2xl border border-amber-200/60">
              <div className="space-y-1">
                <label className="font-semibold text-gray-700 block">Phòng cũ:</label>
                <input
                  type="text"
                  placeholder="Ví dụ: A1-201"
                  value={oldRoom}
                  onChange={(e) => setOldRoom(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-xl px-3 py-1.5 text-xs focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-amber-900 block font-bold">Phòng mới (Đến học):</label>
                <input
                  type="text"
                  placeholder="Ví dụ: B2-405"
                  value={newRoom}
                  onChange={(e) => setNewRoom(e.target.value)}
                  className="w-full bg-white border border-amber-300 rounded-xl px-3 py-1.5 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none font-bold text-amber-900"
                />
              </div>
            </div>
          )}

          {changeType === 'period_change' && (
            <div className="grid grid-cols-2 gap-3 bg-blue-50/50 p-3.5 rounded-2xl border border-blue-200/60">
              <div className="space-y-1">
                <label className="font-semibold text-gray-700 block">Ca / Tiết cũ:</label>
                <input
                  type="text"
                  value={oldShift}
                  onChange={(e) => setOldShift(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-xl px-3 py-1.5 text-xs focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-blue-900 block font-bold">Ca / Tiết mới:</label>
                <input
                  type="text"
                  value={newShift}
                  onChange={(e) => setNewShift(e.target.value)}
                  className="w-full bg-white border border-blue-300 rounded-xl px-3 py-1.5 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none font-bold text-blue-900"
                />
              </div>
            </div>
          )}

          {changeType === 'reschedule' && (
            <div className="grid grid-cols-2 gap-3 bg-emerald-50/50 p-3.5 rounded-2xl border border-emerald-200/60">
              <div className="space-y-1">
                <label className="font-semibold text-gray-700 block">Ca học bù:</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Chiều (Tiết 7-9)"
                  value={newShift}
                  onChange={(e) => setNewShift(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-xl px-3 py-1.5 text-xs focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-gray-700 block">Phòng học bù:</label>
                <input
                  type="text"
                  placeholder="Ví dụ: A2-303"
                  value={newRoom}
                  onChange={(e) => setNewRoom(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-xl px-3 py-1.5 text-xs focus:outline-none"
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="font-semibold text-gray-700 block">Lý do điều chỉnh:</label>
            <input
              type="text"
              placeholder="Ví dụ: Máy chiếu phòng A1-201 gặp sự cố / Giảng viên bận hội thảo khoa học"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          {/* 3. Title & Content */}
          <div className="space-y-3 pt-1 border-t border-gray-100">
            <div className="space-y-1">
              <label className="font-semibold text-gray-700 block">Tiêu đề thông báo:</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-gray-700 block">Chi tiết nội dung gửi đến người dùng:</label>
              <textarea
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-xl p-3 text-xs leading-relaxed focus:ring-2 focus:ring-indigo-500 focus:outline-none text-gray-700"
              />
            </div>
          </div>

          {/* AI Coordination Banner */}
          <div className="p-3 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl border border-indigo-100 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
              <i className="fas fa-robot text-sm" />
            </div>
            <p className="text-[11px] text-indigo-900 leading-snug">
              <strong>Tích hợp AI Chatbot:</strong> Khi sinh viên mở khung chat, AI sẽ chủ động nhắc nhở thông báo này và tự động trả lời khi sinh viên hỏi phòng mới.
            </p>
          </div>

          </div>

          {/* Pinned Modal Actions Footer */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200/80 flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-200/70 text-xs font-semibold transition cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-bold text-xs shadow-md hover:shadow-indigo-500/25 transition flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <i className="fas fa-spinner fa-spin" />
                  <span>Đang phát thông báo...</span>
                </>
              ) : (
                <>
                  <i className="fas fa-paper-plane" />
                  <span>Phát thông báo ngay</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ScheduleChangeNotificationModal;

