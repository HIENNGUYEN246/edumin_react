import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import { useAuth } from '../../app/providers/AuthProvider.jsx';
import { statsApi } from '../../api/statsApi.js';

const CARDS = [
  { key: 'teachers', label: 'Giáo viên', icon: 'fa-chalkboard-user', color: 'from-indigo-500 to-blue-500' },
  { key: 'students', label: 'Sinh viên', icon: 'fa-user-graduate', color: 'from-emerald-500 to-teal-500' },
  { key: 'departments', label: 'Khoa', icon: 'fa-building-columns', color: 'from-amber-500 to-orange-500' },
  { key: 'courses', label: 'Học phần', icon: 'fa-book', color: 'from-violet-500 to-purple-500' },
  { key: 'classes', label: 'Lớp học phần', icon: 'fa-layer-group', color: 'from-sky-500 to-cyan-500' },
  { key: 'openClasses', label: 'Lớp đang mở', icon: 'fa-calendar-check', color: 'from-pink-500 to-rose-500' },
];

export function AdminDashboard() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({ queryKey: ['stats', 'overview'], queryFn: statsApi.overview });

  return (
    <div>
      <PageHeader title="Tổng quan" subtitle={`Xin chào, ${user?.hoTen || 'Quản trị viên'}`} />
      {isLoading ? (
        <Spinner />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {CARDS.map((card) => (
            <div key={card.key} className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5 flex items-center gap-4">
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${card.color} text-white flex items-center justify-center text-xl shadow`}>
                <i className={`fas ${card.icon}`} />
              </div>
              <div>
                <p className="text-3xl font-extrabold text-gray-800">{data?.[card.key] ?? 0}</p>
                <p className="text-sm text-gray-500">{card.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
