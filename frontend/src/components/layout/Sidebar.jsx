import { NavLink } from "react-router-dom";
import { NAV_ITEMS } from "../../utils/constants";

export function Sidebar({ collapsed }) {
  const sidebarClass = collapsed ? "w-20" : "w-64";

  return (
    <aside
      className={`${sidebarClass} rounded-2xl border border-white/10 bg-card p-3 transition-all duration-300 h-full flex flex-col`}
    >
      <nav className="space-y-2 flex-1">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `sidebar-item btn-press flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left ${
                isActive
                  ? "border border-primary/55 bg-primary/10 text-txt"
                  : "border border-transparent text-subtxt hover:text-txt"
              }`
            }
          >
            <span className="text-lg">{item.icon}</span>
            {!collapsed && (
              <span className="text-sm font-medium">{item.label}</span>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
