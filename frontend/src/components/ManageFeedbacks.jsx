import React, { useState, useEffect, useMemo, useCallback } from 'react';
import * as XLSX from 'xlsx';
import Swal from 'sweetalert2';
import PDLayout from '../layouts/PDLayout';
import feedbackAPI from '../services/feedbackAPI';
import teacherAPI from '../services/teacherAPI';
import courseAPI from '../services/courseAPI';

export default function ManageFeedbacks() {
  const [loading, setLoading] = useState(true);
  const [feedbacks, setFeedbacks] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [courses, setCourses] = useState([]);

  // Filters
  const [filterTeacher, setFilterTeacher] = useState('all');
  const [filterCourse, setFilterCourse] = useState('all');
  const [filterRating, setFilterRating] = useState('all');
  const [filterQuality, setFilterQuality] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Respond Modal
  const [respondModal, setRespondModal] = useState({
    isOpen: false,
    item: null,
    responseText: '',
  });
  const [savingResponse, setSavingResponse] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [fbs, tchs, crss] = await Promise.all([
        feedbackAPI.getFeedbacks(),
        teacherAPI.getAllTeachers({ fresh: true }),
        courseAPI.getAllCourses({ fresh: true }),
      ]);
      setFeedbacks(Array.isArray(fbs) ? fbs : []);
      setTeachers(Array.isArray(tchs) ? tchs : []);
      setCourses(Array.isArray(crss) ? crss : []);
    } catch (err) {
      console.error('Lỗi khi tải danh sách phản hồi:', err);
      Swal.fire('Lỗi', 'Không thể tải danh sách phản hồi từ máy chủ.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    const onUpdate = () => loadData();
    window.addEventListener('edumin_feedback_updated', onUpdate);
    return () => window.removeEventListener('edumin_feedback_updated', onUpdate);
  }, [loadData]);

  // Statistics
  const stats = useMemo(() => {
    const total = feedbacks.length;
    if (total === 0) {
      return { total: 0, avgRating: 0, goodCount: 0, okCount: 0, badCount: 0, anonCount: 0, respondedCount: 0 };
    }
    const sumRating = feedbacks.reduce((acc, f) => acc + (Number(f.rating) || 5), 0);
    const avgRating = (sumRating / total).toFixed(1);
    const goodCount = feedbacks.filter((f) => f.courseQuality === 'Tốt').length;
    const okCount = feedbacks.filter((f) => f.courseQuality === 'Ổn').length;
    const badCount = feedbacks.filter((f) => f.courseQuality === 'Cần cải thiện').length;
    const anonCount = feedbacks.filter((f) => f.isAnonymous).length;
    const respondedCount = feedbacks.filter((f) => Boolean(f.response)).length;

    return { total, avgRating, goodCount, okCount, badCount, anonCount, respondedCount };
  }, [feedbacks]);

  // Filtered List
  const filteredFeedbacks = useMemo(() => {
    return feedbacks.filter((item) => {
      if (filterTeacher !== 'all' && String(item.teacherId) !== String(filterTeacher)) return false;
      if (filterCourse !== 'all' && String(item.courseId) !== String(filterCourse)) return false;
      if (filterRating !== 'all' && Number(item.rating) !== Number(filterRating)) return false;
      if (filterQuality !== 'all' && item.courseQuality !== filterQuality) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const sName = (item.displayName || item.studentName || '').toLowerCase();
        const sId = String(item.studentId || '');
        const tName = (item.teacherName || '').toLowerCase();
        const cName = (item.courseName || '').toLowerCase();
        const txt = (item.feedbackText || '').toLowerCase();
        const resp = (item.response || '').toLowerCase();

        return (
          sName.includes(q) ||
          sId.includes(q) ||
          tName.includes(q) ||
          cName.includes(q) ||
          txt.includes(q) ||
          resp.includes(q)
        );
      }
      return true;
    });
  }, [feedbacks, filterTeacher, filterCourse, filterRating, filterQuality, searchQuery]);

  const handleOpenRespond = (item) => {
    setRespondModal({
      isOpen: true,
      item,
      responseText: item.response || '',
    });
  };

  const handleCloseRespond = () => {
    setRespondModal({
      isOpen: false,
      item: null,
      responseText: '',
    });
  };

  const handleSaveResponse = async () => {
    if (!respondModal.item) return;
    setSavingResponse(true);
    try {
      await feedbackAPI.respondFeedback(
        respondModal.item.id || respondModal.item._id,
        respondModal.responseText.trim()
      );
      Swal.fire({
        icon: 'success',
        title: 'Thành công',
        text: 'Đã gửi phản hồi đến sinh viên!',
        timer: 1500,
        showConfirmButton: false,
      });
      handleCloseRespond();
      loadData();
    } catch (err) {
      console.error('Lỗi khi gửi phản hồi:', err);
      Swal.fire('Lỗi', 'Không thể lưu phản hồi. Vui lòng thử lại.', 'error');
    } finally {
      setSavingResponse(false);
    }
  };

  const handleDelete = (item) => {
    Swal.fire({
      title: 'Xóa phản hồi này?',
      text: 'Hành động này không thể hoàn tác.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Đồng ý xóa',
      cancelButtonText: 'Hủy',
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await feedbackAPI.deleteFeedback(item.id || item._id);
          Swal.fire({
            icon: 'success',
            title: 'Đã xóa!',
            text: 'Phản hồi đã được xóa thành công.',
            timer: 1500,
            showConfirmButton: false,
          });
          loadData();
        } catch (err) {
          console.error('Lỗi khi xóa:', err);
          Swal.fire('Lỗi', 'Không thể xóa phản hồi này.', 'error');
        }
      }
    });
  };

  const handleResetSeed = async () => {
    Swal.fire({
      title: 'Khởi tạo dữ liệu mẫu?',
      text: 'Hệ thống sẽ nạp lại các phản hồi mẫu thực tế từ sinh viên.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#4f46e5',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Khởi tạo ngay',
      cancelButtonText: 'Hủy',
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await feedbackAPI.resetSeedFeedbacks();
          Swal.fire({
            icon: 'success',
            title: 'Thành công!',
            text: 'Đã tạo dữ liệu phản hồi mẫu thành công.',
            timer: 1500,
            showConfirmButton: false,
          });
          loadData();
        } catch (err) {
          console.error('Lỗi seed:', err);
          Swal.fire('Lỗi', 'Không thể khởi tạo dữ liệu mẫu.', 'error');
        }
      }
    });
  };

  const exportExcel = () => {
    if (filteredFeedbacks.length === 0) {
      Swal.fire('Thông báo', 'Không có dữ liệu phản hồi để xuất.', 'info');
      return;
    }

    const data = filteredFeedbacks.map((f, idx) => ({
      STT: idx + 1,
      'Mã SV': f.isAnonymous ? 'Ẩn danh' : (f.studentId ? `SV-${String(f.studentId).padStart(3, '0')}` : ''),
      'Họ tên SV': f.isAnonymous ? 'Sinh viên ẩn danh' : (f.studentName || f.displayName || ''),
      'Giảng viên': f.teacherName || '',
      'Học phần': f.courseName || '',
      'Đánh giá sao': `${f.rating || 5}/5`,
      'Chất lượng học phần': f.courseQuality || 'Tốt',
      'Nội dung góp ý': f.feedbackText || '',
      'Phản hồi từ Nhà trường/GV': f.response || 'Chưa phản hồi',
      'Thời gian gửi': f.createdAtFormatted || (f.timestamp ? new Date(f.timestamp).toLocaleDateString('vi-VN') : ''),
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'YKienSinhVien');
    XLSX.writeFile(wb, `Danh_Sach_Phan_Hoi_Sinh_Vien_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const getQualityBadge = (quality) => {
    switch (quality) {
      case 'Tốt':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Ổn':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Cần cải thiện':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  return (
    <PDLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div>
            <h1 className="text-2xl font-black text-gray-800 flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl">
                <i className="fas fa-comment-dots"></i>
              </span>
              Ý kiến & Phản hồi Sinh viên
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Quản lý, theo dõi và phản hồi ý kiến đánh giá từ sinh viên dành cho giảng viên và học phần
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleResetSeed}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition active:scale-95"
              title="Khởi tạo hoặc nạp lại dữ liệu phản hồi mẫu"
            >
              <i className="fas fa-magic"></i> Nạp dữ liệu mẫu
            </button>
            <button
              onClick={exportExcel}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-100 transition active:scale-95"
            >
              <i className="fas fa-file-excel"></i> Xuất Excel
            </button>
            <button
              onClick={loadData}
              className="p-2.5 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-xl border border-gray-200 transition"
              title="Làm mới dữ liệu"
            >
              <i className={`fas fa-sync-alt ${loading ? 'fa-spin' : ''}`}></i>
            </button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl shrink-0">
              <i className="fas fa-comments"></i>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase text-gray-400">Tổng phản hồi</p>
              <h3 className="text-2xl font-black text-gray-800">{stats.total}</h3>
              <p className="text-[10px] text-gray-500 mt-0.5">{stats.respondedCount} đã phản hồi</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center text-xl shrink-0">
              <i className="fas fa-star"></i>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase text-gray-400">Điểm trung bình</p>
              <h3 className="text-2xl font-black text-amber-500 flex items-center gap-1">
                {stats.avgRating} <span className="text-xs text-gray-400 font-normal">/ 5.0</span>
              </h3>
              <p className="text-[10px] text-emerald-600 font-bold mt-0.5">
                {stats.total > 0 ? Math.round(((stats.goodCount + stats.okCount) / stats.total) * 100) : 100}% hài lòng
              </p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl shrink-0">
              <i className="fas fa-smile"></i>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase text-gray-400">Đánh giá "Tốt"</p>
              <h3 className="text-2xl font-black text-emerald-600">{stats.goodCount}</h3>
              <p className="text-[10px] text-gray-500 mt-0.5">Nội dung đạt chuẩn</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center text-xl shrink-0">
              <i className="fas fa-exclamation-triangle"></i>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase text-gray-400">Cần cải thiện</p>
              <h3 className="text-2xl font-black text-rose-600">{stats.badCount}</h3>
              <p className="text-[10px] text-gray-500 mt-0.5">Cần chú ý hỗ trợ</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center text-xl shrink-0">
              <i className="fas fa-user-secret"></i>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase text-gray-400">Góp ý ẩn danh</p>
              <h3 className="text-2xl font-black text-purple-600">{stats.anonCount}</h3>
              <p className="text-[10px] text-gray-500 mt-0.5">Bảo mật thông tin SV</p>
            </div>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
            {/* Search */}
            <div className="relative md:col-span-2">
              <i className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm sinh viên, giảng viên, từ khóa góp ý..."
                className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-100 transition"
              />
            </div>

            {/* Filter Teacher */}
            <div>
              <select
                value={filterTeacher}
                onChange={(e) => setFilterTeacher(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-100 transition"
              >
                <option value="all">Tất cả giảng viên</option>
                {teachers.map((t) => (
                  <option key={t.id || t._id} value={t.id || t._id}>
                    {t.hoTen || t.name} {t.id ? `(GV-${String(t.id).padStart(3, '0')})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Quality */}
            <div>
              <select
                value={filterQuality}
                onChange={(e) => setFilterQuality(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-100 transition"
              >
                <option value="all">Tất cả mức độ</option>
                <option value="Tốt">Tốt</option>
                <option value="Ổn">Ổn</option>
                <option value="Cần cải thiện">Cần cải thiện</option>
              </select>
            </div>

            {/* Filter Rating */}
            <div>
              <select
                value={filterRating}
                onChange={(e) => setFilterRating(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-100 transition"
              >
                <option value="all">Tất cả số sao</option>
                <option value="5">⭐⭐⭐⭐⭐ (5 sao)</option>
                <option value="4">⭐⭐⭐⭐ (4 sao)</option>
                <option value="3">⭐⭐⭐ (3 sao)</option>
                <option value="2">⭐⭐ (2 sao)</option>
                <option value="1">⭐ (1 sao)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Feedbacks Content List */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
              <i className="fas fa-list text-indigo-500"></i>
              Danh sách đóng góp ý kiến ({filteredFeedbacks.length})
            </h3>
          </div>

          {loading ? (
            <div className="p-12 text-center text-gray-400">
              <i className="fas fa-spinner fa-spin text-2xl mb-2 text-indigo-600"></i>
              <p className="text-xs">Đang tải danh sách phản hồi...</p>
            </div>
          ) : filteredFeedbacks.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3 text-gray-300 text-2xl">
                <i className="far fa-comment-dots"></i>
              </div>
              <p className="text-sm font-semibold text-gray-600">Chưa có phản hồi nào</p>
              <p className="text-xs text-gray-400 mt-1 mb-4">Bạn có thể bấm nút bên dưới để nạp các phản hồi mẫu vào hệ thống.</p>
              <button
                type="button"
                onClick={handleResetSeed}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-indigo-100"
              >
                <i className="fas fa-magic mr-1.5"></i> Nạp dữ liệu phản hồi mẫu
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredFeedbacks.map((item) => {
                const sAvatar = item.isAnonymous
                  ? ''
                  : (item.studentAvatar || item.studentRef?.avatar || '');
                const sName = item.isAnonymous ? 'Sinh viên ẩn danh' : (item.displayName || item.studentName || 'Sinh viên');

                return (
                  <div key={item.id || item._id} className="p-6 hover:bg-gray-50/50 transition">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      {/* Left: Student & Content */}
                      <div className="flex items-start gap-4 min-w-0 flex-1">
                        {/* Student Avatar */}
                        {item.isAnonymous ? (
                          <div className="w-11 h-11 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center text-lg shrink-0 border border-purple-200 shadow-xs">
                            <i className="fas fa-user-secret"></i>
                          </div>
                        ) : (
                          <img
                            src={
                              sAvatar ||
                              `https://ui-avatars.com/api/?name=${encodeURIComponent(sName)}&background=10b981&color=fff`
                            }
                            alt={sName}
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(sName)}&background=10b981&color=fff`;
                            }}
                            className="w-11 h-11 rounded-2xl object-cover border border-gray-200 shrink-0 shadow-xs"
                          />
                        )}

                        <div className="space-y-2 flex-1 min-w-0">
                          {/* Student Name & Meta */}
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-sm text-gray-800">{sName}</span>
                            {item.isAnonymous ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-600 border border-purple-200">
                                Ẩn danh
                              </span>
                            ) : item.studentId ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-200">
                                SV-{String(item.studentId).padStart(3, '0')}
                              </span>
                            ) : null}

                            <span className="text-[11px] text-gray-400">•</span>
                            <span className="text-[11px] text-gray-500 font-medium">
                              Giảng viên: <strong className="text-gray-700">{item.teacherName || 'Chưa rõ'}</strong>
                            </span>
                            {item.courseName && (
                              <>
                                <span className="text-[11px] text-gray-400">•</span>
                                <span className="text-[11px] text-indigo-600 font-medium bg-indigo-50 px-2 py-0.5 rounded-md">
                                  {item.courseName}
                                </span>
                              </>
                            )}
                          </div>

                          {/* Rating & Quality */}
                          <div className="flex items-center gap-3">
                            <div className="flex items-center text-amber-400 text-xs">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <i
                                  key={star}
                                  className={`fas fa-star ${star <= (Number(item.rating) || 5) ? 'text-amber-400' : 'text-gray-200'}`}
                                ></i>
                              ))}
                              <span className="ml-1.5 font-bold text-gray-700 text-xs">{item.rating || 5}.0</span>
                            </div>

                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getQualityBadge(item.courseQuality)}`}>
                              {item.courseQuality || 'Tốt'}
                            </span>

                            <span className="text-[10px] text-gray-400">
                              <i className="far fa-clock mr-1"></i>
                              {item.createdAtFormatted || (item.timestamp ? new Date(item.timestamp).toLocaleDateString('vi-VN') : 'Mới đây')}
                            </span>
                          </div>

                          {/* Student Message */}
                          <div className="p-3 bg-gray-50 rounded-xl text-xs text-gray-700 leading-relaxed border border-gray-100">
                            "{item.feedbackText}"
                          </div>

                          {/* Admin / Teacher Response */}
                          {item.response ? (
                            <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs space-y-1">
                              <div className="flex items-center justify-between text-indigo-700 font-bold text-[11px]">
                                <span className="flex items-center gap-1.5">
                                  <i className="fas fa-reply"></i> Phản hồi từ Nhà trường / Giảng viên:
                                </span>
                                {item.respondedAt && (
                                  <span className="text-[10px] text-indigo-400 font-normal">
                                    {item.respondedAt}
                                  </span>
                                )}
                              </div>
                              <p className="text-gray-700 italic leading-relaxed">{item.response}</p>
                            </div>
                          ) : (
                            <div className="text-[11px] text-amber-600 flex items-center gap-1">
                              <i className="far fa-clock text-[10px]"></i> Chưa có câu trả lời cho sinh viên
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right Actions */}
                      <div className="flex items-center gap-2 self-start md:self-center shrink-0">
                        <button
                          onClick={() => handleOpenRespond(item)}
                          className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white transition flex items-center gap-1.5 shadow-xs"
                          title="Phản hồi lại sinh viên"
                        >
                          <i className="fas fa-reply text-[10px]"></i>
                          <span>{item.response ? 'Sửa phản hồi' : 'Trả lời'}</span>
                        </button>

                        <button
                          onClick={() => handleDelete(item)}
                          className="p-2 rounded-xl text-xs text-rose-500 hover:bg-rose-50 hover:text-rose-600 transition"
                          title="Xóa phản hồi này"
                        >
                          <i className="fas fa-trash-alt"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Respond */}
        {respondModal.isOpen && (
          <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4 sm:p-6 md:p-8 py-10 sm:py-16 overflow-y-auto">
            <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full my-auto overflow-hidden border border-slate-100/80 animate-fadeIn">
              <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 p-5 text-white flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-lg">
                    <i className="fas fa-reply"></i>
                  </div>
                  <div>
                    <h3 className="font-bold text-base">Phản hồi ý kiến sinh viên</h3>
                    <p className="text-xs text-indigo-100">
                      Gửi lời cảm ơn, giải thích hoặc hướng dẫn tới sinh viên
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleCloseRespond}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>

              <div className="p-6 space-y-4">
                {/* Original Feedback preview */}
                <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100 text-xs">
                  <p className="text-gray-400 font-bold uppercase text-[10px] mb-1">Ý kiến của sinh viên:</p>
                  <p className="text-gray-700 italic">"{respondModal.item?.feedbackText}"</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-2">
                    Nội dung phản hồi của Nhà trường / Giảng viên:
                  </label>
                  <textarea
                    rows="4"
                    value={respondModal.responseText}
                    onChange={(e) =>
                      setRespondModal((prev) => ({ ...prev, responseText: e.target.value }))
                    }
                    placeholder="Nhập nội dung giải đáp, ghi nhận hoặc hướng dẫn..."
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-2xl text-xs text-gray-700 outline-none focus:ring-2 focus:ring-indigo-100 transition resize-none"
                  ></textarea>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleCloseRespond}
                    className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="button"
                    disabled={savingResponse || !respondModal.responseText.trim()}
                    onClick={handleSaveResponse}
                    className="px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl shadow-md shadow-indigo-100 transition flex items-center gap-2"
                  >
                    {savingResponse && <i className="fas fa-spinner fa-spin"></i>}
                    <span>Gửi câu trả lời</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </PDLayout>
  );
}

