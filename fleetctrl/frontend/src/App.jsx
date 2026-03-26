import { useCallback, useRef, useState } from 'react';
import { createDeploySocket } from './api.js';
import { ActivityLog } from './components/ActivityLog.jsx';
import { PipelineTracker } from './components/PipelineTracker.jsx';
import { ServerHealthGrid } from './components/ServerHealthGrid.jsx';
import { ServicesTable } from './components/ServicesTable.jsx';
import { Sidebar } from './components/Sidebar.jsx';
import { StatsRow } from './components/StatsRow.jsx';
import { Topbar } from './components/Topbar.jsx';
import { YamlEditor } from './components/YamlEditor.jsx';
import { FleetContext, useFleet, useFleetContext } from './hooks/useFleet.js';

function FleetProvider({ children }) {
  const fleet = useFleet();
  const { refetch } = fleet;
  const [deployMessages, setDeployMessages] = useState([]);
  const [deployRunning, setDeployRunning] = useState(false);
  const [lastDeployAt, setLastDeployAt] = useState(null);
  const bufRef = useRef('');

  const startDeployAll = useCallback(() => {
    if (deployRunning) return;
    setDeployRunning(true);
    setDeployMessages([]);
    bufRef.current = '';
    const ws = createDeploySocket();
    let finished = false;

    const finish = () => {
      if (finished) return;
      finished = true;
      setDeployRunning(false);
      refetch();
    };

    ws.onopen = () => {
      ws.send(JSON.stringify({ action: 'deploy_all' }));
    };

    ws.onmessage = (ev) => {
      bufRef.current += ev.data;
      const parts = bufRef.current.split('\n');
      bufRef.current = parts.pop() ?? '';
      const parsed = [];
      for (const line of parts) {
        if (!line.trim()) continue;
        try {
          parsed.push(JSON.parse(line));
        } catch {
          /* ignore malformed line */
        }
      }
      if (parsed.length) {
        setDeployMessages((m) => [...m, ...parsed]);
        if (parsed.some((p) => p.stage === 'done' && p.status === 'ok')) {
          setLastDeployAt(Date.now());
        }
      }
    };

    ws.onclose = finish;
    ws.onerror = () => {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    };
  }, [deployRunning, refetch]);

  const dismissError = useCallback(() => fleet.setError(null), [fleet]);

  const value = {
    ...fleet,
    deployMessages,
    deployRunning,
    lastDeployAt,
    startDeployAll,
    pageTitle: 'Dashboard',
    dismissError,
  };

  return <FleetContext.Provider value={value}>{children}</FleetContext.Provider>;
}

function Shell() {
  const { error, dismissError } = useFleetContext();
  return (
    <div className="flex min-h-screen bg-bg font-mono text-text">
      <Sidebar />
      <div className="ml-[220px] flex flex-1 flex-col">
        {error && (
          <div className="flex items-center justify-between border-b border-danger/50 bg-danger/10 px-8 py-3 font-mono text-sm text-danger">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => dismissError()}
              className="rounded border border-border px-3 py-1 text-xs text-text hover:border-accent"
            >
              Dismiss
            </button>
          </div>
        )}
        <Topbar />
        <main className="flex-1 p-8">
          <StatsRow />
          <PipelineTracker />
          <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-[2fr_1fr]">
            <ServicesTable />
            <YamlEditor />
          </div>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <ServerHealthGrid />
            <ActivityLog />
          </div>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <FleetProvider>
      <Shell />
    </FleetProvider>
  );
}

export default App;
