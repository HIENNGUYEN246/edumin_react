import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { ProfileCard } from '../../components/account/ProfileCard.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import { useAuth } from '../../app/providers/AuthProvider.jsx';
import { statsApi } from '../../api/statsApi.js';

export function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ['stats', 'overview'],
    queryFn: statsApi.overview,
    refetchInterval: 30000,
  });

  const teacherCount = data?.teachers ?? 0;
  const studentCount = data?.students ?? 0;
  const openClassesCount = data?.openClasses ?? 0;
  const classesCount = data?.classes ?? 0;
  const attendanceCount = data?.attendanceCount ?? 0;
  const attendancePresentRate = data?.attendancePresentRate ?? 100;
  const feedbackCount = data?.feedbackCount ?? 0;
  const avgRating = data?.avgRating ?? '5.0';
  const revenueTotal = data?.revenueTotal ?? (studentCount > 0 ? studentCount * 3200000 : 0);

  const quickActions = [
    { to: '/admin/teachers', label: 'Quản lý Giáo viên', desc: `${teacherCount} giảng viên, hồ sơ & tài khoản`, icon: 'fa-chalkboard-user', color: 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100' },
    { to: '/admin/students', label: 'Quản lý Sinh viên', desc: `${studentCount} sinh viên, hồ sơ & tài khoản`, icon: 'fa-user-graduate', color: 'bg-orange-50 text-orange-600 hover:bg-orange-100' },
    { to: '/admin/departments', label: 'Quản lý Khoa', desc: `${data?.departments ?? 0} khoa đào tạo`, icon: 'fa-building-columns', color: 'bg-amber-50 text-amber-600 hover:bg-amber-100' },
    { to: '/admin/courses', label: 'Quản lý Môn học', desc: `${data?.courses ?? 0} môn học trong danh mục`, icon: 'fa-book-bookmark', color: 'bg-violet-50 text-violet-600 hover:bg-violet-100' },
    { to: '/admin/classes', label: 'Quản lý Lớp học phần', desc: `${data?.classes ?? 0} lớp học phần mở theo kỳ`, icon: 'fa-shapes', color: 'bg-blue-50 text-blue-600 hover:bg-blue-100' },
    { to: '/admin/attendance', label: 'Điểm danh & Chuyên cần', desc: `${attendanceCount} lượt ghi nhận (${attendancePresentRate}%)`, icon: 'fa-clipboard-user', color: 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' },
    { to: '/admin/tuition', label: 'Quản lý Học phí', desc: 'Theo dõi công nợ & duyệt thu tiền SV', icon: 'fa-money-bill-wave', color: 'bg-cyan-50 text-cyan-600 hover:bg-cyan-100' },
    { to: '/admin/feedbacks', label: 'Ý kiến & Phản hồi', desc: `${feedbackCount} phản hồi (⭐ ${avgRating})`, icon: 'fa-comments', color: 'bg-teal-50 text-teal-600 hover:bg-teal-100' },
    { to: '/admin/profile-requests', label: 'Duyệt yêu cầu thay đổi', desc: 'Phê duyệt ảnh đại diện & hồ sơ GV/SV', icon: 'fa-user-check', color: 'bg-rose-50 text-rose-600 hover:bg-rose-100' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Tổng quan Quản trị"
          subtitle={`Xin chào, ${user?.hoTen || 'Quản trị viên'} · Phòng Đào Tạo Edumin`}
        />
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-xl text-xs font-semibold self-start sm:self-auto">
          <i className="fas fa-signal text-emerald-500 animate-pulse" />
          <span>Hệ thống trực tuyến</span>
        </div>
      </div>

      <ProfileCard
        user={user}
        profile={{
          hoTen: user?.hoTen || 'Quản trị viên',
          email: user?.email,
          avatar: user?.avatar,
        }}
        code="ADMIN-PDT"
        fields={[
          { label: 'Vai trò', value: 'Quản trị viên hệ thống (Admin)' },
          { label: 'Đơn vị', value: 'Phòng Đào Tạo Edumin' },
          { label: 'Quyền hạn', value: 'Toàn quyền quản trị & điều hành' },
          { label: 'Trạng thái', value: 'Hoạt động' },
        ]}
      />

      {isLoading ? (
        <Spinner />
      ) : (
        <>
          {/* 6 Top Stat Cards matching PDTDashboard on main */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {/* 1. Tổng Giáo Viên */}
            <div
              onClick={() => navigate('/admin/teachers')}
              className="bg-indigo-600 p-5 rounded-2xl text-white shadow-lg shadow-indigo-200/50 relative overflow-hidden cursor-pointer hover:scale-[1.02] hover:shadow-xl transition-all duration-200"
            >
              <div className="z-10 relative">
                <p className="text-xs uppercase font-medium text-indigo-100">Tổng Giáo Viên</p>
                <h3 className="text-2xl font-black my-1">{teacherCount.toLocaleString('vi-VN')}</h3>
                <div className="w-full bg-indigo-400/60 rounded-full h-1.5 mt-3">
                  <div className="bg-white h-1.5 rounded-full" style={{ width: '85%' }} />
                </div>
                <p className="text-[11px] mt-1.5 text-indigo-100 font-medium">85% Đang hoạt động</p>
              </div>
              <i className="fas fa-user-tie absolute -right-3 -bottom-3 text-7xl opacity-15" />
            </div>

            {/* 2. Tổng Sinh Viên */}
            <div
              onClick={() => navigate('/admin/students')}
              className="bg-orange-500 p-5 rounded-2xl text-white shadow-lg shadow-orange-200/50 relative overflow-hidden cursor-pointer hover:scale-[1.02] hover:shadow-xl transition-all duration-200"
            >
              <div className="z-10 relative">
                <p className="text-xs uppercase font-medium text-orange-100">Tổng Sinh Viên</p>
                <h3 className="text-2xl font-black my-1">{studentCount.toLocaleString('vi-VN')}</h3>
                <div className="w-full bg-orange-400/60 rounded-full h-1.5 mt-3">
                  <div className="bg-white h-1.5 rounded-full" style={{ width: '65%' }} />
                </div>
                <p className="text-[11px] mt-1.5 text-orange-100 font-medium">Đang theo học</p>
              </div>
              <i className="fas fa-user-graduate absolute -right-3 -bottom-3 text-7xl opacity-15" />
            </div>

            {/* 3. Lớp học phần mở */}
            <div
              onClick={() => navigate('/admin/classes')}
              className="bg-purple-600 p-5 rounded-2xl text-white shadow-lg shadow-purple-200/50 relative overflow-hidden cursor-pointer hover:scale-[1.02] hover:shadow-xl transition-all duration-200"
            >
              <div className="z-10 relative">
                <p className="text-xs uppercase font-medium text-purple-100">Lớp học phần mở</p>
                <h3 className="text-2xl font-black my-1">{openClassesCount.toLocaleString('vi-VN')}</h3>
                <div className="w-full bg-purple-400/60 rounded-full h-1.5 mt-3">
                  <div
                    className="bg-white h-1.5 rounded-full"
                    style={{ width: `${classesCount > 0 ? Math.min(100, Math.round((openClassesCount / classesCount) * 100)) : 80}%` }}
                  />
                </div>
                <p className="text-[11px] mt-1.5 text-purple-100 font-medium">{classesCount} lớp tổng số</p>
              </div>
              <i className="fas fa-shapes absolute -right-3 -bottom-3 text-7xl opacity-15" />
            </div>

            {/* 4. Tỷ lệ chuyên cần */}
            <div
              onClick={() => navigate('/admin/attendance')}
              className="bg-emerald-600 p-5 rounded-2xl text-white shadow-lg shadow-emerald-200/50 relative overflow-hidden cursor-pointer hover:scale-[1.02] hover:shadow-xl transition-all duration-200"
            >
              <div className="z-10 relative">
                <p className="text-xs uppercase font-medium text-emerald-100">Tỷ lệ chuyên cần</p>
                <h3 className="text-2xl font-black my-1">{attendancePresentRate}%</h3>
                <div className="w-full bg-emerald-400/60 rounded-full h-1.5 mt-3">
                  <div className="bg-white h-1.5 rounded-full" style={{ width: `${attendancePresentRate}%` }} />
                </div>
                <p className="text-[11px] mt-1.5 text-emerald-100 font-medium">{attendanceCount} lượt ghi nhận</p>
              </div>
              <i className="fas fa-clipboard-check absolute -right-3 -bottom-3 text-7xl opacity-15" />
            </div>

            {/* 5. Học phí thu */}
            <div className="bg-rose-500 p-5 rounded-2xl text-white shadow-lg shadow-rose-200/50 relative overflow-hidden">
              <div className="z-10 relative">
                <p className="text-xs uppercase font-medium text-rose-100">Học phí thu</p>
                <h3 className="text-2xl font-black my-1">
                  {new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(revenueTotal)}đ
                </h3>
                <div className="w-full bg-rose-400/60 rounded-full h-1.5 mt-3">
                  <div className="bg-white h-1.5 rounded-full" style={{ width: '75%' }} />
                </div>
                <p className="text-[11px] mt-1.5 text-rose-100 font-medium">Doanh thu học phần</p>
              </div>
              <i className="fas fa-dollar-sign absolute -right-3 -bottom-3 text-7xl opacity-15" />
            </div>

            {/* 6. Ý kiến phản hồi */}
            <div
              onClick={() => navigate('/admin/feedbacks')}
              className="bg-teal-600 p-5 rounded-2xl text-white shadow-lg shadow-teal-200/50 relative overflow-hidden cursor-pointer hover:scale-[1.02] hover:shadow-xl transition-all duration-200"
            >
              <div className="z-10 relative">
                <p className="text-xs uppercase font-medium text-teal-100">Ý kiến phản hồi</p>
                <h3 className="text-2xl font-black my-1">{feedbackCount} lượt</h3>
                <div className="w-full bg-teal-400/60 rounded-full h-1.5 mt-3">
                  <div
                    className="bg-white h-1.5 rounded-full"
                    style={{ width: `${Math.min(100, (Number(avgRating) / 5) * 100)}%` }}
                  />
                </div>
                <p className="text-[11px] mt-1.5 text-teal-100 font-medium">⭐ {avgRating} / 5.0 hài lòng</p>
              </div>
              <i className="fas fa-comment-dots absolute -right-3 -bottom-3 text-7xl opacity-15" />
            </div>
          </div>

          {/* Three Interactive Charts from PDTDashboard */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chart 1: Thống kê sinh viên theo ngày */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h4 className="font-bold text-gray-800 text-base">Thống kê Sinh viên</h4>
                  <p className="text-xs text-gray-400 mt-0.5">Mức độ hoạt động theo tuần</p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-lg">Tuần này</span>
              </div>
              <div className="h-56 flex items-end justify-around gap-2 px-2 pb-2 border-b border-gray-100">
                <div className="flex flex-col items-center gap-1.5 h-full justify-end group">
                  <div className="w-5 bg-indigo-500 rounded-t-md group-hover:bg-indigo-600 transition" style={{ height: '60%' }} title="Thứ 2: 60%" />
                  <div className="w-5 bg-indigo-100 rounded-t-sm" style={{ height: '35%' }} />
                </div>
                <div className="flex flex-col items-center gap-1.5 h-full justify-end group">
                  <div className="w-5 bg-indigo-500 rounded-t-md group-hover:bg-indigo-600 transition" style={{ height: '75%' }} title="Thứ 3: 75%" />
                  <div className="w-5 bg-indigo-100 rounded-t-sm" style={{ height: '20%' }} />
                </div>
                <div className="flex flex-col items-center gap-1.5 h-full justify-end group">
                  <div className="w-5 bg-indigo-500 rounded-t-md group-hover:bg-indigo-600 transition" style={{ height: '90%' }} title="Thứ 4: 90%" />
                  <div className="w-5 bg-indigo-100 rounded-t-sm" style={{ height: '55%' }} />
                </div>
                <div className="flex flex-col items-center gap-1.5 h-full justify-end group">
                  <div className="w-5 bg-indigo-500 rounded-t-md group-hover:bg-indigo-600 transition" style={{ height: '70%' }} title="Thứ 5: 70%" />
                  <div className="w-5 bg-indigo-100 rounded-t-sm" style={{ height: '40%' }} />
                </div>
                <div className="flex flex-col items-center gap-1.5 h-full justify-end group">
                  <div className="w-5 bg-indigo-500 rounded-t-md group-hover:bg-indigo-600 transition" style={{ height: '85%' }} title="Thứ 6: 85%" />
                  <div className="w-5 bg-indigo-100 rounded-t-sm" style={{ height: '45%' }} />
                </div>
                <div className="flex flex-col items-center gap-1.5 h-full justify-end group">
                  <div className="w-5 bg-indigo-500 rounded-t-md group-hover:bg-indigo-600 transition" style={{ height: '45%' }} title="Thứ 7: 45%" />
                  <div className="w-5 bg-indigo-100 rounded-t-sm" style={{ height: '20%' }} />
                </div>
                <div className="flex flex-col items-center gap-1.5 h-full justify-end group">
                  <div className="w-5 bg-indigo-500 rounded-t-md group-hover:bg-indigo-600 transition" style={{ height: '30%' }} title="CN: 30%" />
                  <div className="w-5 bg-indigo-100 rounded-t-sm" style={{ height: '15%' }} />
                </div>
              </div>
              <div className="flex justify-around mt-3 text-[11px] text-gray-500 font-bold uppercase tracking-wider">
                <span>T2</span><span>T3</span><span>T4</span><span>T5</span><span>T6</span><span>T7</span><span>CN</span>
              </div>
              <div className="flex items-center justify-center gap-4 mt-4 text-xs text-gray-500">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-indigo-500 rounded-full" /> Đi học đầy đủ</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-indigo-100 rounded-full" /> Tự học / Vắng</span>
              </div>
            </div>

            {/* Chart 2: Trạng thái học phí */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm text-center flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-bold text-gray-800 text-base text-left">Trạng thái học phí</h4>
                  <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-lg">Kỳ 1</span>
                </div>
                <p className="text-xs text-gray-400 text-left mb-4">Tỷ lệ hoàn tất nghĩa vụ học phí sinh viên</p>
              </div>

              <div className="py-2 flex items-center justify-center">
                <div className="relative inline-block">
                  <div
                    className="w-44 h-44 rounded-full border-[14px] border-indigo-600 border-t-transparent border-r-indigo-100 flex items-center justify-center shadow-inner"
                    style={{ transform: 'rotate(45deg)' }}
                  >
                    <div style={{ transform: 'rotate(-45deg)' }} className="text-center">
                      <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Đã hoàn thành</p>
                      <p className="text-3xl font-black text-gray-800 mt-1">85%</p>
                      <p className="text-[11px] text-emerald-600 font-bold">Tốt</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex justify-center gap-6 text-xs font-semibold">
                <span className="flex items-center gap-2 text-gray-700">
                  <span className="w-3 h-3 bg-indigo-600 rounded-full" /> Đã đóng (85%)
                </span>
                <span className="flex items-center gap-2 text-gray-500">
                  <span className="w-3 h-3 bg-indigo-100 rounded-full" /> Còn nợ (15%)
                </span>
              </div>
            </div>

            {/* Chart 3: Hiệu quả tuyển sinh & Khuyến mãi */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-bold text-gray-800 text-base">Hiệu quả Khuyến mãi</h4>
                  <span className="text-xs font-semibold px-2.5 py-1 bg-purple-50 text-purple-600 rounded-lg">Tuyển sinh</span>
                </div>
                <p className="text-xs text-gray-400 mb-4">Theo dõi các đợt ưu đãi khóa học & ghi danh</p>
              </div>

              <div className="h-44 relative overflow-hidden flex items-end rounded-xl bg-gradient-to-b from-indigo-50/40 to-transparent p-1">
                <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="waveGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#818cf8" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#818cf8" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>
                  <path d="M0,100 L0,70 C20,40 40,80 60,30 C80,10 100,40 100,40 L100,100 Z" fill="url(#waveGradient)" />
                  <path d="M0,70 C20,40 40,80 60,30 C80,10 100,40 100,40" stroke="#6366f1" strokeWidth="2.5" fill="none" />
                </svg>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center text-xs">
                <span className="text-gray-500">Tăng trưởng tuyển sinh:</span>
                <span className="font-bold text-emerald-600 flex items-center gap-1">
                  <i className="fas fa-arrow-trend-up" /> +24.8% kỳ này
                </span>
              </div>
            </div>
          </div>

          {/* Quick Access Menu */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="font-bold text-gray-800 text-base">Truy cập nhanh chức năng Quản trị</h4>
                <p className="text-xs text-gray-400 mt-0.5">Các phân hệ quản lý chính của Phòng Đào Tạo</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
              {quickActions.map((action) => (
                <Link
                  key={action.to}
                  to={action.to}
                  className="p-4 rounded-xl border border-gray-100 hover:border-indigo-200 hover:shadow-md transition-all group flex items-start gap-3.5 bg-gray-50/50 hover:bg-white"
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 ${action.color}`}>
                    <i className={`fas ${action.icon} text-base`} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-gray-800 text-sm group-hover:text-indigo-600 transition truncate">
                      {action.label}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{action.desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default AdminDashboard;

