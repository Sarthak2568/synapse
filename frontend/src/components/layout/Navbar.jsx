export function Navbar({ status, sidebarCollapsed, onToggleSidebar }) {
  return (
    <header className="glass-nav sticky top-0 z-40 border-b border-white/10">
      <div className="mx-auto flex max-w-[1500px] items-center justify-between px-4 py-3 lg:px-6">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-primary">
            Synapse Sports Tech
          </p>
          <h1 className="font-heading text-xl">
            AI Motion Analysis Platform
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-card px-3 py-1 text-xs text-subtxt">
            <span className="pulse-dot h-2 w-2 rounded-full bg-secondary" />
            {status}
          </span>
          <button
            className="btn-press rounded-xl border border-white/15 bg-card px-3 py-2 text-sm text-subtxt"
            onClick={onToggleSidebar}
          >
            {sidebarCollapsed ? "Expand" : "Collapse"}
          </button>
        </div>
      </div>
    </header>
  );
}
