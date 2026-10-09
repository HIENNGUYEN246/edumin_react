import { useState, useMemo, useEffect, useCallback } from 'react';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { Spinner } from '../../../components/ui/Spinner.jsx';
import { Avatar } from '../../../components/ui/Avatar.jsx';
import { formatStudentCode } from '../../../lib/format.js';
import { useToast } from '../../../app/providers/ToastProvider.jsx';
import { useAuth } from '../../../app/providers/AuthProvider.jsx';
import { attendanceApi } from '../../../api/attendanceApi.js';
import { enrollmentsApi } from '../../../api/enrollmentsApi.js';
import {
  formatAttendanceDate,
  getShiftLabel,
  getStatusBadgeClass,
  getStatusIcon,
  calculateStudentAttendanceStats,
} from '../../../utils/attendanceUtils.js';

export function StudentAttendance() {
  const toast = useToast();
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [attendances, setAttendances] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [filterCourse, setFilterCourse] = useState('all');

  const studentId = profile?.id ?? user?.studentId ?? user?.id;

  const loadData = useCallback(async () => {
    if (!studentId) return;
    try {
      setLoading(true);
      const [attRes, enrRes] = await Promise.all([
        attendanceApi.getByStudent(studentId),
        enrollmentsApi.mine().catch(() => ({ data: [] })),
      ]);
      setAttendances(Array.isArray(attRes) ? attRes : attRes?.data || []);
      setEnrollments(enrRes?.data || []);
    } catch {
      toast.error('Không thể tải lịch sử điểm danh');
    } finally {
      setLoading(false);
    }
  }, [studentId, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtered rows
  const filteredList = useMemo(() => {
    if (filterCourse === 'all') return attendances;
    return attendances.filter(
      (a) => a.courseId === filterCourse || a.regId === filterCourse || a.courseName === filterCourse
    );
  }, [attendances, filterCourse]);

  // Overall attendance stats
  const stats = useMemo(() => {
    return calculateStudentAttendanceStats(filteredList);
  }, [filteredList]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lịch sử Điểm danh & Chuyên cần"
        description="Theo dõi tỷ lệ chuyên cần, ngày giờ vào lớp và nhận xét đánh giá từ Giảng viên"
      />

      {/* Overview Card */}
      <div className="bg-gradient-to-br from-indigo-900 to-indigo-800 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-indigo-700/20 rounded-full blur-2xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <Avatar
              src={profile?.avatar?.url || profile?.avatar || user?.avatar}
              name={profile?.hoTen || user?.hoTen}
              size={64}
              className="border-2 border-white/20 shrink-0 shadow-lg"
            />
            <div className="space-y-1">
              <span className="text-xs uppercase font-bold tracking-wider text-indigo-300">
                {profile?.id != null ? formatStudentCode(profile.id) : 'Sinh viên'}
              </span>
              <h3 className="text-2xl font-black text-white">
                {stats.rate}% <span className="text-base font-normal text-indigo-200">Chuyên cần</span>
              </h3>
              <p className="text-xs text-indigo-200">
                {stats.absent >= 3 ? (
                  <span className="text-rose-300 font-bold">
                    ⚠️ Cảnh báo: Bạn đã vắng {stats.absent} buổi, chú ý không vượt quá 20% số tiết quy định.
                  </span>
                ) : (
                  'Tình trạng chuyên cần của bạn rất tốt, hãy duy trì nhé!'
                )}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div className="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10">
              <p className="text-[11px] text-indigo-200">Tổng số buổi</p>
              <p className="text-xl font-bold mt-0.5">{stats.total}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10">
              <p className="text-[11px] text-emerald-300">Có mặt</p>
              <p className="text-xl font-bold text-emerald-300 mt-0.5">{stats.present}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10">
              <p className="text-[11px] text-amber-300">Đi muộn</p>
              <p className="text-xl font-bold text-amber-300 mt-0.5">{stats.late}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10">
              <p className="text-[11px] text-rose-300">Vắng mặt</p>
              <p className="text-xl font-bold text-rose-300 mt-0.5">{stats.absent}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter by course */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-gray-500 uppercase">Lọc theo học phần:</span>
          <select
            value={filterCourse}
            onChange={(e) => setFilterCourse(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
          >
            <option value="all">Tất cả các môn</option>
            {enrollments.map((e) => (
              <option key={e._id} value={e.class?.courseId || e.classId}>
                {e.class?.courseName || e.class?.courseId || e.classId}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12">
            <Spinner />
          </div>
        ) : filteredList.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <i className="far fa-calendar-check text-4xl mb-3 block text-gray-300" />
            <p className="font-semibold text-gray-600 text-sm">Chưa có lượt điểm danh nào</p>
            <p className="text-xs text-gray-400 mt-1">Thông tin điểm danh từng buổi học sẽ xuất hiện tại đây.</p>
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full min-w-[760px] text-left text-sm text-gray-700">
              <thead className="bg-gray-50/75 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                <tr>
                  <th className="px-5 py-3">Học phần & Lớp</th>
                  <th className="px-5 py-3">Ngày học</th>
                  <th className="px-5 py-3">Ca học</th>
                  <th className="px-5 py-3">Trạng thái</th>
                  <th className="px-5 py-3">Điểm số</th>
                  <th className="px-5 py-3">Nhận xét của Giảng viên</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredList.map((row) => (
                  <tr key={row._id || row.id} className="hover:bg-indigo-50/20 transition">
                    <td className="px-5 py-3.5">
                      <p className="font-bold text-gray-900 leading-tight">{row.courseName || row.courseId}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        {row.courseId && (
                          <span className="font-mono text-[10px] font-bold bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-100">
                            {row.courseId}
                          </span>
                        )}
                        {row.regId && (
                          <span className="text-[11px] text-gray-500 font-mono">
                            Lớp: {row.regId}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-medium text-gray-800">
                      {formatAttendanceDate(row.date)}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-gray-500">
                      {row.shiftLabel || getShiftLabel(row.shiftId)}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${getStatusBadgeClass(row.status)}`}>
                        <i className={`fas ${getStatusIcon(row.status)}`} />
                        {row.status}
                      </span>
                      {row.checkInTime && (
                        <p className="text-[10px] text-gray-400 mt-0.5">Giờ vào: {row.checkInTime}</p>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {row.score != null ? (
                        <span className="inline-block bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded text-xs border border-emerald-200">
                          {row.score}đ
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs italic">-</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {row.evaluation ? (
                        <div className="space-y-1">
                          <p className="text-xs text-gray-800 italic leading-relaxed">
                            &quot;{row.evaluation}&quot;
                          </p>
                          {row.teacherName && (
                            <div className="flex items-center gap-1.5 text-[11px] text-gray-500 font-medium">
                              <Avatar
                                src={row.teacherAvatar || row.teacherRef?.avatar?.url || row.teacherRef?.avatar}
                                name={row.teacherName}
                                size={18}
                              />
                              <span>GV: {row.teacherName}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-300 text-xs italic">Không có nhận xét</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default StudentAttendance;

