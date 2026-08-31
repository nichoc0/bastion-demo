import { useState, useEffect, useRef } from 'react';
import { TOOLS } from '../../data/toolbox';
import { useHealth, useLogs } from '../../data/useHealth';

// Tool-watching page. Left: the real-wired tool list (status from /api/health).
// Right: a logs box, empty until you pick a tool, then it streams that tool's
// real logs (/api/logs) — or says plainly when a tool has no log source yet.

const STATUS = {
  up:      { word: 'Ready',    text: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
  idle:    { word: 'Idle',     text: 'text-slate-400 dark:text-slate-500', dot: 'border border-slate-300 dark:border-slate-600' },
  down:    { word: 'Offline',  text: 'text-red-600 dark:text-red-400',     dot: 'bg-red-500' },
  unknown: { word: 'Checking', text: 'text-slate-300 dark:text-slate-600', dot: 'border border-slate-200 dark:border-slate-700' },
};

function Row({ tool, health, selected, onSelect }) {
  const s = STATUS[health?.status] || STATUS.unknown;
  const Icon = tool.icon;
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left flex items-center gap-3 py-3 pl-3 pr-2 border-b border-slate-100 dark:border-slate-800/60 cursor-pointer transition-colors ${
        selected ? 'bg-slate-50 dark:bg-slate-800/40' : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/20'
      }`}
    >
      <span className={`w-[2px] self-stretch -my-3 ${selected ? 'bg-slate-800 dark:bg-slate-200' : 'bg-transparent'}`} />
      <Icon size={17} className="shrink-0 text-slate-400 dark:text-slate-500" />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-slate-800 dark:text-slate-100 leading-tight">{tool.label}</div>
        <div className="text-[11px] text-slate-400 dark:text-slate-500 leading-tight truncate">{tool.note}</div>
      </div>
      <span className={`text-[12px] ${s.text} shrink-0`}>{s.word}</span>
      <span className={`h-2 w-2 rounded-full shrink-0 ${s.dot}`} />
    </button>
  );
}

function ToolLogs({ tool, health, live }) {
  const { lines, source, loading, error } = useLogs(tool?.service, { live });
  const scrollRef = useRef(null);

  // keep the feed pinned to the latest line
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  if (!tool) {
    return (
      <div className="h-full grid place-items-center text-center px-6">
        <p className="text-[13px] text-slate-400 dark:text-slate-500">Select a tool to view its logs.</p>
      </div>
    );
  }

  const s = STATUS[health?.status] || STATUS.unknown;
  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 flex items-center gap-2 px-4 h-11 border-b border-slate-200 dark:border-slate-800">
        <tool.icon size={15} className="text-slate-400 dark:text-slate-500" />
        <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">{tool.label}</span>
        <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
          {s.word}
          <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
        </span>
      </div>
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-3 bg-slate-50/50 dark:bg-slate-950/40">
        {source && lines.length > 0 ? (
          <pre className="text-[11px] leading-relaxed font-mono text-slate-600 dark:text-slate-300 whitespace-pre-wrap break-words">
            {lines.join('\n')}
          </pre>
        ) : (
          <div className="h-full grid place-items-center text-center px-4">
            <p className="text-[12px] text-slate-400 dark:text-slate-500">
              {loading ? 'Loading logs…'
                : error ? `Couldn't load logs (${error})`
                : !source ? 'Live logs stream during an active run. Start a run to watch this tool.'
                : 'No recent log lines.'}
            </p>
          </div>
        )}
      </div>
      {source && (
        <div className="shrink-0 px-4 h-7 flex items-center border-t border-slate-200 dark:border-slate-800">
          <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">{source}{live ? ' · streaming' : ''}</span>
        </div>
      )}
    </div>
  );
}

export function ToolboxPage({ live = true }) {
  const { tools, loading, error } = useHealth({ live });
  const [selected, setSelected] = useState(null);
  const leftRef = useRef(null);
  const [listH, setListH] = useState(null);
  const known = TOOLS.filter((t) => tools[t.service]);
  const ready = known.filter((t) => tools[t.service].status === 'up').length;
  const selectedTool = TOOLS.find((t) => t.service === selected) || null;

  // keep the logs box cropped to exactly the tool-list height
  useEffect(() => {
    const el = leftRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setListH(el.offsetHeight));
    ro.observe(el);
    setListH(el.offsetHeight);
    return () => ro.disconnect();
  }, []);

  return (
    <div>
      <p className="text-[13px] text-slate-500 dark:text-slate-400 mb-4">
        {loading && !known.length
          ? 'Checking tools…'
          : error
            ? `Couldn't reach health probe (${error})`
            : `${TOOLS.length} tools provisioned · ${ready} ready`}
      </p>
      <div className="flex gap-5 items-start">
        {/* left — tool list (the height driver) */}
        <div ref={leftRef} className="w-[360px] shrink-0 border-t border-slate-200 dark:border-slate-800">
          {TOOLS.map((t) => (
            <Row
              key={t.service}
              tool={t}
              health={tools[t.service]}
              selected={selected === t.service}
              onSelect={() => setSelected(selected === t.service ? null : t.service)}
            />
          ))}
        </div>
        {/* right — logs box, cropped to the list height, scrolls inside */}
        <div
          className="flex-1 min-w-0 border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a] overflow-hidden"
          style={listH ? { height: listH } : undefined}
        >
          <ToolLogs tool={selectedTool} health={tools[selected]} live={live} />
        </div>
      </div>
    </div>
  );
}
