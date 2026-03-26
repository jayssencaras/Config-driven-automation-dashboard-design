import { useState } from 'react';
import { deployService, stopService } from '../api.js';
import { useFleetContext } from '../hooks/useFleet.js';

function abbrev(name) {
  const p = (name || '').split(/[-_]/).filter(Boolean);
  if (p.length >= 2) return (p[0][0] + p[1][0]).toUpperCase().slice(0, 3);
  return (name || '??').slice(0, 3).toUpperCase();
}

function StatusPill({ status, pending }) {
  if (pending) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 font-mono text-xs text-muted">
        <span className="h-2 w-2 animate-spin rounded-full border border-muted border-t-accent" />
        pending
      </span>
    );
  }
  const map = {
    up: { dot: 'bg-accent', text: 'text-accent', label: 'up' },
    warn: { dot: 'bg-warn', text: 'text-warn', label: 'warn' },
    down: { dot: 'bg-danger', text: 'text-danger', label: 'down' },
  };
  const m = map[status] || map.down;
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border border-border bg-surface2 px-3 py-1 font-mono text-xs ${m.text}`}
    >
      <span className={`h-2 w-2 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

export function ServicesTable() {
  const { services, config, refetch, setError } = useFleetContext();
  const [pending, setPending] = useState({});

  const definedCount = config.parsed?.services?.length ?? 0;

  async function onDeploy(name) {
    setPending((p) => ({ ...p, [name]: 'deploy' }));
    try {
      await deployService(name);
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setPending((p) => {
        const n = { ...p };
        delete n[name];
        return n;
      });
      refetch();
    }
  }

  async function onStop(name) {
    setPending((p) => ({ ...p, [name]: 'stop' }));
    try {
      await stopService(name);
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setPending((p) => {
        const n = { ...p };
        delete n[name];
        return n;
      });
      refetch();
    }
  }

  if (definedCount === 0) {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center rounded-lg border border-border border-dashed bg-surface2 p-8 text-center">
        <p className="font-mono text-sm text-muted">
          No services in fleet.yml — add one to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface2">
      <table className="w-full border-collapse text-left font-mono text-sm">
        <thead>
          <tr className="border-b border-border bg-surface text-[10px] uppercase tracking-wider text-muted">
            <th className="px-4 py-3">Service</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Server</th>
            <th className="px-4 py-3">Image</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {services.map((row) => (
            <tr key={row.name} className="border-b border-border/80 hover:bg-surface/80">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded bg-accent/15 font-mono text-xs font-bold text-accent2">
                    {abbrev(row.name)}
                  </span>
                  <span className="text-text">{row.name}</span>
                </div>
              </td>
              <td className="px-4 py-3">
                <StatusPill
                  status={pending[row.name] ? 'warn' : row.status}
                  pending={!!pending[row.name]}
                />
              </td>
              <td className="px-4 py-3">
                <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] text-muted">
                  {row.server}
                </span>
              </td>
              <td className="max-w-[200px] truncate px-4 py-3 text-muted">{row.image || '—'}</td>
              <td className="px-4 py-3 text-right">
                <button
                  type="button"
                  disabled={!!pending[row.name]}
                  onClick={() => onDeploy(row.name)}
                  className="mr-2 rounded border border-accent2/40 bg-accent2/10 px-3 py-1 text-xs text-accent2 transition hover:bg-accent2/20 disabled:opacity-50"
                >
                  redeploy
                </button>
                <button
                  type="button"
                  disabled={!!pending[row.name]}
                  onClick={() => onStop(row.name)}
                  className="rounded border border-danger/40 bg-danger/10 px-3 py-1 text-xs text-danger transition hover:bg-danger/20 disabled:opacity-50"
                >
                  stop
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
