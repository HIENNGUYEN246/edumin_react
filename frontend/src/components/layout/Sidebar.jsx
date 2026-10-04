import { NavLink } from 'react-router-dom';
import { NAV_BY_ROLE } from '../../app/navConfig.js';

export function Sidebar({ role }) {
  const items = NAV_BY_ROLE[role] || [];
  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex-shrink-0 hidden md:flex flex-col overflow-y-auto custom-scrollbar">
      <nav className="p-3 space-y-1">
        {items.map((item) => (
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
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

export default Sidebar;
