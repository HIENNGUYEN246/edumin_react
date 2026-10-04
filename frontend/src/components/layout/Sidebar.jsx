import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { NAV_BY_ROLE } from '../../app/navConfig.js';
import { profileRequestsApi } from '../../api/profileRequestsApi.js';

export function Sidebar({ role }) {
  const items = NAV_BY_ROLE[role] || [];

  const { data: reqData } = useQuery({
    queryKey: ['profile-requests', 'pending-count'],
    queryFn: () => profileRequestsApi.list({ status: 'pending', limit: 1 }),
    enabled: role === 'dao-tao',
    refetchInterval: 20000,
  });

  const pendingCount = reqData?.pendingCount ?? 0;

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex-shrink-0 hidden md:flex flex-col overflow-y-auto custom-scrollbar">
      <nav className="p-3 space-y-1">
        {items.map((item) => {
          const isApproval = item.to === '/admin/profile-requests';
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-indigo-50 hover:text-indigo-600'
                }`
              }
            >
              <i className={`fas ${item.icon} w-5 text-center`} />
              <span className="flex-1">{item.label}</span>
              {isApproval && pendingCount > 0 && (
                <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-rose-500 text-white animate-pulse">
                  {pendingCount > 99 ? '99+' : pendingCount}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}

export default Sidebar;
