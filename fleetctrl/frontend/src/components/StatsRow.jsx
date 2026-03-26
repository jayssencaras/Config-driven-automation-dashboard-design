import { useFleetContext } from '../hooks/useFleet.js';

function relTime(ts) {
  if (!ts) return '—';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const top = {
  accent: 'border-t-accent',
  accent2: 'border-t-accent2',
  warn: 'border-t-warn',
  muted: 'border-t-muted',
};

function Card({ tone, label, value, sub, up }) {
  return (
    <div
      className={`rounded-lg border border-border border-t-2 bg-surface2 p-5 ${top[tone]}`}
    >
      <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-widest text-muted">
        {label}
      </p>
      <p className="font-sans text-3xl font-extrabold text-text">{value}</p>
      <p className="mt-1 font-mono text-xs text-muted">
        {sub}
        {up !== undefined && (
          <span className={up ? 'text-accent' : 'text-danger'}>{up ? ' ↑' : ' ↓'}</span>
        )}
      </p>
    </div>
  );
}

export function StatsRow() {
  const { services, serverHealth, lastDeployAt } = useFleetContext();
  const total = services.length;
  const totalServers = serverHealth.length;
  const online = serverHealth.filter((h) => h.reachable).length;
  const containers = serverHealth.reduce((a, h) => a + (h.container_count ?? 0), 0);

  return (
    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card
        tone="accent"
        label="Total services"
        value={total}
        sub="configured in fleet"
        up={total > 0}
      />
      <Card
        tone="accent2"
        label="Servers online"
        value={totalServers ? `${online}/${totalServers}` : '—'}
        sub="SSH reachability"
        up={totalServers > 0 && online === totalServers}
      />
      <Card tone="warn" label="Containers" value={containers} sub="running on fleet hosts" />
      <Card
        tone="muted"
        label="Last deploy"
        value={relTime(lastDeployAt)}
        sub="pipeline completion"
      />
    </div>
  );
}
