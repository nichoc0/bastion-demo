import { useMemo, useRef, useState, useEffect } from 'react';
import { MagnifyingGlass, Play, CaretDown } from '@phosphor-icons/react';

// The ONE authoritative way to start a run: search the real bug-bounty target
// registry (arkadiyt/bounty-targets-data — HackerOne / Bugcrowd / Intigriti /
// YesWeHack) and start against a program. Scoped to the registry (authorization
// is part of the harness). Custom targets later.
export default function StartRun({ onStart }) {
  const [targets, setTargets] = useState([]);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    fetch('/bountyTargets.json').then((r) => r.json()).then(setTargets).catch(() => setTargets([]));
  }, []);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    const base = s ? targets.filter((t) => t.name.toLowerCase().includes(s) || (t.url || '').toLowerCase().includes(s) || t.platform.toLowerCase().includes(s)) : targets;
    return base.slice(0, 40);
  }, [q, targets]);

  const pick = (t) => { setPicked(t); setQ(t.name); setOpen(false); };

  return (
    <div className="flex items-stretch gap-2 mb-6">
      <div ref={ref} className="relative flex-1 max-w-[480px]">
        <div className="flex items-center gap-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0f172a] px-3 h-10">
          <MagnifyingGlass size={14} className="text-slate-400 dark:text-slate-500 shrink-0" />
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setPicked(null); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder={`Find from ${targets.length || '…'} bug-bounty targets…`}
            className="flex-1 bg-transparent text-[13px] text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
          />
          <CaretDown size={13} weight="bold" className="text-slate-400 shrink-0" />
        </div>
        {open && (
          <div className="absolute z-30 top-full left-0 right-0 mt-1 border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f172a] shadow-lg max-h-[300px] overflow-y-auto thin-scroll">
            {results.length === 0 && <div className="px-3 py-3 text-[12px] text-slate-400">{targets.length ? 'No targets match.' : 'Loading registry…'}</div>}
            {results.map((t, i) => (
              <button key={`${t.platform}-${t.name}-${i}`} onClick={() => pick(t)} className="w-full text-left px-3 py-2 border-b border-slate-100 dark:border-slate-800/60 last:border-b-0 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium text-slate-800 dark:text-slate-100 truncate">{t.name}</span>
                  {t.bounties && <span className="font-tech text-[8px] uppercase tracking-widest text-emerald-600 dark:text-emerald-400 shrink-0">$</span>}
                  <span className="font-tech text-[9px] uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-auto shrink-0">{t.platform}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      <button
        onClick={() => picked && onStart?.(picked)}
        disabled={!picked}
        className={`inline-flex items-center gap-1.5 px-4 text-[12px] font-medium transition-colors ${picked ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 cursor-pointer' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'}`}
      >
        <Play size={13} weight="fill" /> Start a run
      </button>
    </div>
  );
}
