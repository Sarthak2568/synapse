import { NAV_ITEMS } from '../../utils/constants';

export function Sidebar({ activeNav, onNavChange, collapsed }) {
  const sidebarClass = collapsed ? "w-20" : "w-64";

  return (
    <aside
      className={`${sidebarClass} rounded-2xl border border-white/10 bg-card p-3 transition-all duration-300`}
    >
      <nav className="space-y-2">
        {NAV_ITEMS.map((item) => {
          const active = activeNav === item.key;
          return (
            <button
              key={item.key}
              onClick={() => onNavChange(item.key)}
              className={`sidebar-item btn-press flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left ${
                active
                  ? "border border-primary/55 bg-primary/10 text-txt"
                  : "border border-transparent text-subtxt"
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              {!collapsed && (
                <span className="text-sm font-medium">{item.label}</span>
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
