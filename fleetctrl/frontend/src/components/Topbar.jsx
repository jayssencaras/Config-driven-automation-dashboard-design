import { useFleetContext } from '../hooks/useFleet.js';

export function Topbar() {
  const {
    services,
    loading,
    refetch,
    startDeployAll,
    deployRunning,
    pageTitle,
  } = useFleetContext();

  const running = services.filter((s) => s.status === 'up').length;
  const warnings = services.filter((s) => s.status === 'warn').length;

  return (
    <header className="sticky top-0 z-20 flex h-[60px] items-center justify-between border-b border-border bg-surface px-8">
      <h1 className="font-sans text-xl font-bold text-text">{pageTitle}</h1>
      <div className="flex items-center gap-4">
        {loading && (
          <span
            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-accent"
            aria-hidden
          />
        )}
        <span className="rounded-full border border-border bg-surface2 px-3 py-1 font-mono text-xs text-accent">
          running: {running}
        </span>
        <span className="rounded-full border border-border bg-surface2 px-3 py-1 font-mono text-xs text-warn">
          warn: {warnings}
        </span>
        <button
          type="button"
          onClick={() => refetch()}
          className="rounded-md border border-border px-4 py-2 font-mono text-sm text-muted transition hover:border-accent hover:text-accent"
        >
          Reload Config
        </button>
        <button
          type="button"
          disabled={deployRunning}
          onClick={() => startDeployAll()}
          className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 font-mono text-sm font-semibold text-bg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {deployRunning && (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-bg border-t-transparent" />
          )}
          ▶ Deploy All
        </button>
      </div>
    </header>
  );
}
