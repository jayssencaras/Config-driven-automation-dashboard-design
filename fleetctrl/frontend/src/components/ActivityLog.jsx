import { useEffect, useRef, useState } from 'react';
import { useFleetContext } from '../hooks/useFleet.js';

function rel(ms) {
  if (!ms) return '—';
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export function ActivityLog() {
  const { deployMessages } = useFleetContext();
  const [entries, setEntries] = useState([]);
  const seen = useRef(0);

  useEffect(() => {
    if (deployMessages.length === 0) {
      seen.current = 0;
      setEntries([]);
      return;
    }
    if (deployMessages.length < seen.current) {
      seen.current = 0;
    }
    const batch = deployMessages.slice(seen.current);
    seen.current = deployMessages.length;
    if (batch.length === 0) return;
    setEntries((e) => {
      let next = [...e];
      for (const last of batch) {
        const tsMs = last.timestamp != null ? last.timestamp * 1000 : Date.now();
        let icon = '▶';
        let tone = 'text-accent2';
        if (last.status === 'error' || last.stage === 'error') {
          icon = '✗';
          tone = 'text-danger';
        } else if (last.status === 'ok' || last.stage === 'done') {
          icon = '✓';
          tone = 'text-accent';
        }
        const line = `[${last.stage || '—'}] ${last.message || ''}`;
        const detail = last.service ? `service: ${last.service}` : '';
        next.push({
          tsMs,
          icon,
          tone,
          line,
          detail,
          id: `${tsMs}-${next.length}`,
        });
      }
      return next.slice(-50);
    });
  }, [deployMessages]);

  return (
    <div className="flex h-full min-h-[280px] flex-col rounded-lg border border-border bg-surface2">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="font-mono text-xs uppercase tracking-wider text-muted">Activity</span>
        <button
          type="button"
          className="font-mono text-[10px] text-muted hover:text-accent"
        >
          View All
        </button>
      </div>
      <ul className="max-h-[320px] flex-1 list-none overflow-y-auto p-3">
        {entries.length === 0 && (
          <li className="py-8 text-center font-mono text-xs text-muted">No deploy activity yet.</li>
        )}
        {entries.map((en) => (
          <li key={en.id} className="mb-3 flex gap-3 border-b border-border/50 pb-3 last:border-0">
            <span className={`shrink-0 font-mono text-lg ${en.tone}`}>{en.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="font-mono text-xs text-text">{en.line}</p>
              {en.detail && <p className="mt-0.5 font-mono text-[10px] text-muted">{en.detail}</p>}
              <p className="mt-1 font-mono text-[10px] text-muted">{rel(en.tsMs)}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
