import { useFleetContext } from '../hooks/useFleet.js';

function barClass(pct) {
  if (pct == null || Number.isNaN(pct)) return 'bg-muted';
  if (pct < 60) return 'bg-accent';
  if (pct < 80) return 'bg-warn';
  return 'bg-danger';
}

function Bar({ label, value }) {
  const pct = value != null ? Math.min(100, Math.max(0, value)) : null;
  return (
    <div className="mb-2">
      <div className="mb-1 flex justify-between font-mono text-[10px] text-muted">
        <span>{label}</span>
        <span>{pct != null ? `${pct.toFixed(0)}%` : '—'}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded bg-surface">
        <div
          className={`h-full rounded transition-all ${barClass(pct)}`}
          style={{ width: pct != null ? `${pct}%` : '0%' }}
        />
      </div>
    </div>
  );
}

export function ServerHealthGrid() {
  const { serverHealth } = useFleetContext();

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {serverHealth.length === 0 && (
        <p className="col-span-full font-mono text-sm text-muted">No server data yet.</p>
      )}
      {serverHealth.map((s) => (
        <div
          key={s.host}
          className={`rounded-lg border bg-surface2 p-4 ${
            s.reachable ? 'border-border' : 'border-danger'
          }`}
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={`relative h-2.5 w-2.5 rounded-full ${s.reachable ? 'bg-accent' : 'bg-danger'}`}
              >
                {s.reachable && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-50" />
                )}
              </span>
              <span className="font-sans font-bold text-text">{s.host}</span>
            </div>
            <span className="font-mono text-[10px] text-muted">
              {s.container_count != null ? `${s.container_count} ctrs` : '—'}
            </span>
          </div>
          {!s.reachable && (
            <p className="mb-3 font-mono text-xs text-danger">unreachable · SSH timeout</p>
          )}
          <div className={!s.reachable ? 'pointer-events-none opacity-40' : ''}>
            <Bar label="CPU" value={s.cpu_percent} />
            <Bar label="MEM" value={s.mem_percent} />
          </div>
        </div>
      ))}
    </div>
  );
}
