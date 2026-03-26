import { useEffect, useMemo, useState } from 'react';
import yaml from 'js-yaml';
import { useFleetContext } from '../hooks/useFleet.js';

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function highlightYaml(src) {
  const lines = src.split('\n');
  return lines
    .map((line) => {
      const c = line.match(/^\s*#/);
      if (c) {
        return `<span class="italic text-muted">${escapeHtml(line)}</span>`;
      }
      let rest = escapeHtml(line);
      rest = rest.replace(
        /^(\s*)([a-zA-Z0-9_.-]+)(:)/,
        (_, sp, key, col) => {
          const isTop = /^\s{0,2}\S/.test(line) && !line.trimStart().startsWith('-');
          const cls = isTop ? 'text-accent' : 'text-hl-key';
          return `${sp}<span class="${cls}">${key}</span>${col}`;
        }
      );
      rest = rest.replace(/\b(true|false)\b/g, '<span class="text-accent2">$&</span>');
      rest = rest.replace(/\b\d+(\.\d+)?\b/g, '<span class="text-hl-number">$&</span>');
      rest = rest.replace(/:\s*"([^"]*)"/g, ': <span class="text-hl-string">"$1"</span>');
      rest = rest.replace(/:\s*'([^']*)'/g, ': <span class="text-hl-string">\'$1\'</span>');
      return rest;
    })
    .join('\n');
}

export function YamlEditor() {
  const { config, saveConfig } = useFleetContext();
  const [tab, setTab] = useState('view');
  const [draft, setDraft] = useState(config.raw || '');
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    setDraft(config.raw || '');
  }, [config.raw]);

  const html = useMemo(() => highlightYaml(draft || ''), [draft]);

  async function apply() {
    setFeedback(null);
    try {
      yaml.load(draft);
    } catch (e) {
      setFeedback({ ok: false, text: e.message || String(e) });
      return;
    }
    const res = await saveConfig(draft);
    if (res.success) {
      setFeedback({ ok: true, text: 'Saved fleet.yml' });
    } else {
      setFeedback({ ok: false, text: (res.errors && res.errors.join('; ')) || 'Validation failed' });
    }
  }

  function reset() {
    setDraft(config.raw || '');
    setFeedback(null);
  }

  return (
    <div className="flex h-full min-h-[320px] flex-col rounded-lg border border-border bg-surface2">
      <div className="flex border-b border-border">
        <button
          type="button"
          onClick={() => setTab('view')}
          className={`px-4 py-2 font-mono text-xs uppercase ${tab === 'view' ? 'border-b-2 border-accent text-accent' : 'text-muted'}`}
        >
          view
        </button>
        <button
          type="button"
          onClick={() => setTab('edit')}
          className={`px-4 py-2 font-mono text-xs uppercase ${tab === 'edit' ? 'border-b-2 border-accent text-accent' : 'text-muted'}`}
        >
          edit
        </button>
      </div>
      <div className="relative flex-1 overflow-hidden p-4">
        {tab === 'view' && (
          <pre
            className="h-full max-h-[360px] overflow-auto whitespace-pre-wrap break-words rounded border border-border bg-editor p-4 font-mono text-xs leading-relaxed text-text"
            dangerouslySetInnerHTML={{ __html: html || '&nbsp;' }}
          />
        )}
        {tab === 'edit' && (
          <div className="flex h-full max-h-[360px] gap-3">
            <div
              className="editor-lines flex w-10 shrink-0 select-none flex-col overflow-hidden border-r border-border pr-2 text-right font-mono text-[10px] text-muted"
              aria-hidden
            >
              {draft.split('\n').map((_, i) => (
                <span key={i}>{i + 1}</span>
              ))}
            </div>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              spellCheck={false}
              className="min-h-0 flex-1 resize-none rounded border border-border bg-editor p-3 font-mono text-xs leading-relaxed text-text outline-none focus:border-accent"
            />
          </div>
        )}
      </div>
      <style>{`
        .editor-lines span { display: block; line-height: 1.25rem; min-height: 1.25rem; }
      `}</style>
      {feedback && (
        <p
          className={`border-t border-border px-4 py-2 font-mono text-xs ${feedback.ok ? 'text-accent' : 'text-danger'}`}
        >
          {feedback.text}
        </p>
      )}
      <div className="flex gap-2 border-t border-border p-3">
        <button
          type="button"
          onClick={apply}
          className="rounded bg-accent px-4 py-2 font-mono text-xs font-semibold text-bg"
        >
          Apply
        </button>
        <button
          type="button"
          onClick={reset}
          className="rounded border border-border px-4 py-2 font-mono text-xs text-muted hover:border-accent hover:text-accent"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
