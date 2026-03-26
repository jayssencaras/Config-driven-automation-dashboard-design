import { useEffect, useState } from 'react';
import { useFleetContext } from '../hooks/useFleet.js';

const STEPS = [
  { id: 'parse', label: 'Parse Config', stage: 'config_parse' },
  { id: 'ssh', label: 'SSH Connect', stage: 'ssh_connect' },
  { id: 'pull', label: 'Pull Images', stage: 'image_pull' },
  { id: 'deploy', label: 'Deploy Services', stage: 'deploy' },
  { id: 'health', label: 'Health Check', stage: 'health_check' },
  { id: 'cleanup', label: 'Cleanup', stage: 'cleanup' },
  { id: 'notify', label: 'Notify', stage: 'done' },
];

export function PipelineTracker() {
  const { deployMessages, deployRunning } = useFleetContext();
  const [stepState, setStepState] = useState(() =>
    STEPS.map((s) => ({ ...s, status: 'waiting' }))
  );

  useEffect(() => {
    if (!deployRunning) {
      setStepState(STEPS.map((s) => ({ ...s, status: 'waiting' })));
      return;
    }
    const next = STEPS.map((s) => ({ ...s, status: 'waiting' }));
    let failedAt = -1;
    for (const m of deployMessages) {
      if (m.stage === 'error') {
        failedAt = next.findIndex((_, i) => next[i].status === 'running');
        if (failedAt < 0) failedAt = 0;
        break;
      }
      const idx = STEPS.findIndex((s) => s.stage === m.stage);
      if (idx < 0) continue;
      if (m.status === 'running') {
        for (let j = 0; j < idx; j++) next[j].status = 'done';
        next[idx].status = 'running';
      } else if (m.status === 'error') {
        for (let j = 0; j < idx; j++) next[j].status = 'done';
        next[idx].status = 'failed';
        failedAt = idx;
        break;
      } else if (m.status === 'ok' || m.status === 'warn' || m.status === 'skipped') {
        for (let j = 0; j <= idx; j++) next[j].status = 'done';
      }
    }
    if (failedAt >= 0) {
      for (let j = failedAt; j < next.length; j++) {
        if (next[j].status === 'waiting') next[j].status = 'failed';
      }
    }
    if (deployMessages.some((m) => m.stage === 'done' && m.status === 'ok')) {
      next.forEach((s, i) => {
        if (s.status === 'waiting') next[i].status = 'done';
      });
    }
    setStepState(next);
  }, [deployMessages, deployRunning]);

  if (!deployRunning) return null;

  return (
    <div className="mb-6 rounded-lg border border-border bg-surface2 p-6">
      <p className="mb-4 font-mono text-xs uppercase tracking-wider text-muted">Deploy pipeline</p>
      <div className="flex flex-wrap items-start justify-between gap-2">
        {stepState.map((step, i) => (
          <div key={step.id} className="flex min-w-[72px] flex-1 items-center">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full border-2 font-mono text-sm ${
                  step.status === 'done'
                    ? 'border-accent text-accent'
                    : step.status === 'running'
                      ? 'border-accent2 text-accent2'
                      : step.status === 'failed'
                        ? 'border-danger text-danger'
                        : 'border-muted text-muted'
                }`}
              >
                {step.status === 'done' && '✓'}
                {step.status === 'running' && <span className="inline-block animate-spin">⟳</span>}
                {step.status === 'failed' && '✗'}
                {step.status === 'waiting' && '○'}
              </div>
              <span className="mt-2 text-center font-mono text-[10px] text-muted">{step.label}</span>
            </div>
            {i < stepState.length - 1 && (
              <span className="mx-1 mt-3 hidden font-mono text-muted sm:inline">→</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
