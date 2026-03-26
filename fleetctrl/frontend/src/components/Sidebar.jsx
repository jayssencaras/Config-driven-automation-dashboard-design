const groups = [
  {
    title: 'Overview',
    items: ['Dashboard', 'Services', 'Servers'],
  },
  {
    title: 'Automation',
    items: ['Configs', 'Pipelines', 'Schedules'],
  },
  {
    title: 'Ops',
    items: ['Logs', 'Secrets', 'Settings'],
  },
];

export function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 z-30 flex h-screen w-[220px] flex-col border-r border-border bg-surface">
      <div className="flex items-center gap-3 border-b border-border px-5 py-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent font-mono text-sm font-bold text-bg">
          FC
        </div>
        <span className="font-sans text-lg font-extrabold text-accent">FleetCtrl</span>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {groups.map((g) => (
          <div key={g.title} className="mb-6">
            <p className="mb-2 px-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted">
              {g.title}
            </p>
            <ul className="space-y-0.5">
              {g.items.map((item) => {
                const active = g.title === 'Overview' && item === 'Dashboard';
                return (
                  <li key={item}>
                    <button
                      type="button"
                      className={`w-full rounded-md px-3 py-2 text-left font-mono text-sm transition hover:bg-surface2 ${
                        active ? 'bg-accent/10 text-accent' : 'text-text'
                      }`}
                    >
                      {item}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <footer className="border-t border-border px-4 py-4">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
          </span>
          <span className="font-mono text-xs text-muted">daemon v2.4.1</span>
        </div>
        <p className="mt-1 font-mono text-[10px] text-muted">config: fleet.yml</p>
      </footer>
    </aside>
  );
}
