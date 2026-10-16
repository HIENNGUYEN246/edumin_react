import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { ProfileCard } from '../../components/account/ProfileCard.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import { useAuth } from '../../app/providers/AuthProvider.jsx';
import { tuitionApi } from '../../api/tuitionApi.js';
import { formatCurrency } from '../../lib/format.js';

export function AccountantDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [selectedSemester, setSelectedSemester] = useState('');
  const [selectedClass, setSelectedClass] = useState('');

  // Fetch distinct semesters & classes for filters
  const { data: semestersData } = useQuery({
    queryKey: ['tuition', 'semesters'],
    queryFn: tuitionApi.semesters,
  });
  const semesters = semestersData?.data || [];

  const { data: classesData } = useQuery({
    queryKey: ['tuition', 'classes'],
    queryFn: tuitionApi.classes,
  });
  const classes = classesData?.data || [];

  // Fetch financial stats
  const { data: statsData, isLoading, refetch } = useQuery({
    queryKey: ['tuition', 'stats', selectedSemester, selectedClass],
    queryFn: () =>
      tuitionApi.stats({
        semester: selectedSemester || undefined,
        className: selectedClass || undefined,
      }),
  });
  const stats = statsData?.data || {
    totalRevenue: 0,
    totalPaid: 0,
    totalDebt: 0,
    collectionRate: 0,
    totalRecords: 0,
    paidCount: 0,
    debtCount: 0,
    unpaidCount: 0,
  };

  // Fetch recent tuition records for activity feed
  const { data: recentData } = useQuery({
    queryKey: ['tuition', 'recent'],
    queryFn: () => tuitionApi.list({ limit: 6, page: 1 }),
  });
  const recentTuitions = recentData?.data || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Tổng quan Tài chính & Học phí"
          subtitle={`Xin chào, ${user?.hoTen || 'Kế toán viên'} · Phòng Tài chính - Kế toán`}
        />
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl text-xs font-semibold self-start sm:self-auto">
          <i className="fas fa-coins text-emerald-600" />
          <span>Hệ thống Quản lý Học phí Edumin</span>
        </div>
      </div>

      <ProfileCard
        user={user}
        profile={{
          hoTen: user?.hoTen || 'Võ Thị Kế Toán',
          email: user?.email,
          avatar: user?.avatar,
        }}
        code="ACC-TCKT"
        fields={[
          { label: 'Vai trò', value: 'Kế toán viên (Accountant)' },
          { label: 'Đơn vị', value: 'Phòng Tài chính - Kế toán' },
          { label: 'Nghiệp vụ', value: 'Quản lý thu học phí, công nợ & duyệt sao kê ngân hàng' },
          { label: 'Trạng thái', value: 'Sẵn sàng làm việc' },
        ]}
      />

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
          <i className="fas fa-filter text-indigo-500" />
          <span>Bộ lọc thống kê tài chính:</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedSemester}
            onChange={(e) => setSelectedSemester(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-medium bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            <option value="">-- Tất cả học kỳ --</option>
            {semesters.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-medium bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            <option value="">-- Tất cả lớp sinh hoạt --</option>
            {classes.map((c) => (
              <option key={c} value={c}>Lớp: {c}</option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => refetch()}
            className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
          >
            <i className="fas fa-redo text-xs" />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-12"><Spinner /></div>
      ) : (
        <>
          {/* Main 4 KPI Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Revenue */}
            <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 p-5 rounded-2xl text-white shadow-sm shadow-indigo-200/40 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between opacity-80 mb-2">
                <span className="text-xs uppercase font-bold tracking-wider">Tổng học phí dự thu</span>
                <i className="fas fa-file-invoice-dollar text-xl" />
              </div>
              <div className="text-2xl font-extrabold tracking-tight">{formatCurrency(stats.totalRevenue)}</div>
              <div className="text-xs opacity-90 mt-1">
                Ghi nhận trên {stats.totalRecords} bản ghi học phí
              </div>
            </div>

            {/* Total Paid */}
            <div className="bg-gradient-to-br from-emerald-500 to-teal-700 p-5 rounded-2xl text-white shadow-sm shadow-emerald-200/40 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between opacity-80 mb-2">
                <span className="text-xs uppercase font-bold tracking-wider">Đã thực thu</span>
                <i className="fas fa-check-circle text-xl" />
              </div>
              <div className="text-2xl font-extrabold tracking-tight">{formatCurrency(stats.totalPaid)}</div>
              <div className="text-xs opacity-90 mt-1">
                {stats.paidCount} sinh viên đã hoàn thành
              </div>
            </div>

            {/* Total Debt */}
            <div className="bg-gradient-to-br from-rose-500 to-red-700 p-5 rounded-2xl text-white shadow-sm shadow-rose-200/40 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between opacity-80 mb-2">
                <span className="text-xs uppercase font-bold tracking-wider">Dư nợ còn phải thu</span>
                <i className="fas fa-clock text-xl" />
              </div>
              <div className="text-2xl font-extrabold tracking-tight">{formatCurrency(stats.totalDebt)}</div>
              <div className="text-xs opacity-90 mt-1">
                {stats.debtCount + stats.unpaidCount} sinh viên còn dư nợ
              </div>
            </div>

            {/* Collection Rate */}
            <div className="bg-gradient-to-br from-violet-600 to-purple-700 p-5 rounded-2xl text-white shadow-sm shadow-purple-200/40 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between opacity-80 mb-2">
                <span className="text-xs uppercase font-bold tracking-wider">Tỷ lệ hoàn thành thu</span>
                <i className="fas fa-chart-pie text-xl" />
              </div>
              <div className="text-2xl font-extrabold tracking-tight">{stats.collectionRate}%</div>
              <div className="w-full bg-white/20 rounded-full h-2 mt-2 overflow-hidden">
                <div
                  className="bg-white h-2 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(stats.collectionRate, 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Quick Actions & Status Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Quick Actions */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <i className="fas fa-bolt text-amber-500" />
                <span>Thao tác nhanh kế toán</span>
              </h3>

              <div className="space-y-3">
                <Link
                  to="/accountant/tuition"
                  className="p-3.5 rounded-2xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 flex items-center justify-between transition group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
                      <i className="fas fa-tasks" />
                    </div>
                    <div>
                      <div className="text-xs font-bold">Quản lý & Duyệt học phí</div>
                      <div className="text-[11px] text-indigo-600/80">Tra cứu, duyệt hàng loạt & thu tiền</div>
                    </div>
                  </div>
                  <i className="fas fa-chevron-right text-xs group-hover:translate-x-1 transition-transform" />
                </Link>

                <div
                  onClick={() => navigate('/accountant/tuition')}
                  className="p-3.5 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 flex items-center justify-between transition cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
                      <i className="fas fa-file-excel" />
                    </div>
                    <div>
                      <div className="text-xs font-bold">Duyệt sao kê ngân hàng hàng loạt</div>
                      <div className="text-[11px] text-emerald-600/80">Import danh sách thanh toán Excel</div>
                    </div>
                  </div>
                  <i className="fas fa-chevron-right text-xs group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>

            {/* Status Distribution */}
            <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
              <h3 className="text-sm font-bold text-slate-800 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <i className="fas fa-users-cog text-indigo-600" />
                  <span>Phân bổ tình trạng sinh viên</span>
                </span>
                <span className="text-xs font-normal text-gray-400">
                  Tổng {stats.totalRecords} bản ghi
                </span>
              </h3>

              <div className="grid grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 text-center">
                  <div className="text-xl font-black text-emerald-700">{stats.paidCount}</div>
                  <div className="text-xs font-semibold text-emerald-800 mt-1">Đã đóng đủ</div>
                  <div className="text-[10px] text-emerald-600/80 mt-0.5">Không còn công nợ</div>
                </div>

                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 text-center">
                  <div className="text-xl font-black text-amber-700">{stats.debtCount}</div>
                  <div className="text-xs font-semibold text-amber-800 mt-1">Đang nợ một phần</div>
                  <div className="text-[10px] text-amber-600/80 mt-0.5">Đã đóng 1 phần tiền</div>
                </div>

                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 text-center">
                  <div className="text-xl font-black text-rose-700">{stats.unpaidCount}</div>
                  <div className="text-xs font-semibold text-rose-800 mt-1">Chưa đóng</div>
                  <div className="text-[10px] text-rose-600/80 mt-0.5">Chưa thanh toán kỳ này</div>
                </div>
              </div>

              {/* Progress visual */}
              <div className="space-y-1.5 pt-2">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Tiến độ thu học phí toàn trường</span>
                  <span className="font-bold text-indigo-600">{stats.collectionRate}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3 flex overflow-hidden">
                  <div
                    className="bg-emerald-500 h-3"
                    style={{ width: `${stats.totalRecords > 0 ? (stats.paidCount / stats.totalRecords) * 100 : 0}%` }}
                    title={`Đã đóng: ${stats.paidCount}`}
                  />
                  <div
                    className="bg-amber-400 h-3"
                    style={{ width: `${stats.totalRecords > 0 ? (stats.debtCount / stats.totalRecords) * 100 : 0}%` }}
                    title={`Đang nợ: ${stats.debtCount}`}
                  />
                  <div
                    className="bg-rose-400 h-3"
                    style={{ width: `${stats.totalRecords > 0 ? (stats.unpaidCount / stats.totalRecords) * 100 : 0}%` }}
                    title={`Chưa đóng: ${stats.unpaidCount}`}
                  />
                </div>
                <div className="flex items-center gap-4 text-[11px] text-gray-500 pt-1 justify-center">
                  <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Đã đóng</span>
                  <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Đang nợ</span>
                  <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-400" /> Chưa đóng</span>
                </div>
              </div>
            </div>
          </div>

          {/* Recent tuition records */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <i className="fas fa-list-check text-indigo-600" />
                <span>Danh sách học phí cập nhật gần đây</span>
              </h3>
              <Link
                to="/accountant/tuition"
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                <span>Xem tất cả</span>
                <i className="fas fa-arrow-right text-[10px]" />
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-100">
                    <th className="py-2.5 font-semibold">Mã SV</th>
                    <th className="py-2.5 font-semibold">Sinh viên</th>
                    <th className="py-2.5 font-semibold">Lớp SH</th>
                    <th className="py-2.5 font-semibold">Học kỳ</th>
                    <th className="py-2.5 font-semibold">Tổng học phí</th>
                    <th className="py-2.5 font-semibold">Đã đóng</th>
                    <th className="py-2.5 font-semibold">Còn nợ</th>
                    <th className="py-2.5 font-semibold text-center">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentTuitions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-gray-400">
                        Chưa có dữ liệu học phí
                      </td>
                    </tr>
                  ) : (
                    recentTuitions.map((t) => (
                      <tr key={t._id || t.id} className="hover:bg-gray-50/60 transition">
                        <td className="py-3 font-semibold text-gray-800">
                          {t.student?.id != null ? `SV-${String(t.student.id).padStart(3, '0')}` : (t.studentId ? `SV-${t.studentId}` : '-')}
                        </td>
                        <td className="py-3 font-medium text-gray-900">
                          {t.student?.hoTen || 'Sinh viên'}
                        </td>
                        <td className="py-3">
                          {t.className ? (
                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                              {t.className}
                            </span>
                          ) : (
                            <span className="text-gray-400 italic">Chưa phân lớp</span>
                          )}
                        </td>
                        <td className="py-3 font-medium text-gray-700">{t.semester}</td>
                        <td className="py-3 font-semibold">{formatCurrency(t.amount)}</td>
                        <td className="py-3 font-bold text-emerald-600">{formatCurrency(t.amountPaid || 0)}</td>
                        <td className="py-3 font-bold text-rose-600">{formatCurrency(t.amountDue || 0)}</td>
                        <td className="py-3 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              t.status === 'Đã đóng'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : t.status === 'Đang nợ'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {t.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default AccountantDashboard;
