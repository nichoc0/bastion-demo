import { useEffect, useState } from 'react';
import { Folder, House, CaretDown } from '@phosphor-icons/react';

// Cortex — the knowledge base. Folder tree on the left, a folder-card overview
// on the right, grouped by section. The structure is the exact tree app0192726
// renders; the counts are LIVE from the cortex graph, fetched over a read-only
// tunnel that serves aggregate counts only (no node contents ever leave the
// graph). Refreshes every 20s. No data is bundled into this repo.

const CORTEX_URL = import.meta.env.VITE_CORTEX_URL || 'https://ncas-mac-mini-1.tailb4b5fb.ts.net';
const num = (n) => (n ?? 0).toLocaleString('en-US');

export default function CortexView() {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ok | offline
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch(`${CORTEX_URL}/overview`, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error('bad status'))))
        .then((j) => { if (alive) { setData(j); setStatus('ok'); } })
        .catch(() => { if (alive) setStatus((s) => (data ? 'ok' : 'offline')); });
    load();
    const t = setInterval(load, 20000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  if (!data) {
    return (
      <div className="px-6 py-10 text-[13px] text-slate-500 dark:text-slate-400">
        {status === 'offline'
          ? 'Cortex is offline. The live knowledge graph is not reachable right now.'
          : 'Connecting to the live cortex graph…'}
      </div>
    );
  }

  const folders = data.sections.flatMap((s) => s.folders);
  const items = folders.reduce((a, f) => a + (f.count || 0), 0);
  const categories = folders.length;

  return (
    <div className="flex h-full min-h-[560px]">
      {/* left rail: the tree */}
      <aside className="w-56 shrink-0 border-r border-slate-200 dark:border-slate-800 py-4 overflow-y-auto">
        <div className="px-4 pb-2 flex items-center gap-2 text-[13px] font-semibold text-slate-900 dark:text-white">
          <House size={14} weight="fill" className="text-slate-400 dark:text-slate-500" /> Overview
        </div>
        {data.sections.map((s) => (
          <div key={s.title} className="mt-3">
            <div className="px-4 py-1 flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
              <CaretDown size={9} weight="bold" /> {s.title}
            </div>
            {s.folders.map((f) => (
              <div key={f.type} className="px-4 py-1 pl-6 flex items-center gap-2 text-[12px] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-default">
                <Folder size={13} className="text-slate-400 dark:text-slate-500 shrink-0" />
                <span className="truncate">{f.label}</span>
                <span className="ml-auto tabular-nums text-[11px] text-slate-400 dark:text-slate-500">{num(f.count)}</span>
              </div>
            ))}
          </div>
        ))}
      </aside>

      {/* main: overview */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="h-11 px-6 flex items-center border-b border-slate-200 dark:border-slate-800">
          <h1 className="text-[15px] font-bold tracking-tight text-slate-900 dark:text-white">Cortex</h1>
        </div>

        <div className="px-6 py-6">
          <div className="flex items-center gap-2 text-[12px] text-slate-500 dark:text-slate-400 mb-6">
            <Folder size={14} weight="fill" className="text-slate-400 dark:text-slate-500" />
            <span className="font-semibold text-slate-700 dark:text-slate-200">Cortex</span>
            <span>·</span>
            <span className="tabular-nums"><span className="font-semibold text-slate-700 dark:text-slate-200">{num(items)}</span> items</span>
            <span>·</span>
            <span className="tabular-nums"><span className="font-semibold text-slate-700 dark:text-slate-200">{num(data.links)}</span> links</span>
            <span>·</span>
            <span className="tabular-nums"><span className="font-semibold text-slate-700 dark:text-slate-200">{categories}</span> categories</span>
          </div>

          {data.sections.map((s) => (
            <section key={s.title} className="mb-7">
              <h2 className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500 mb-3">{s.title}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {s.folders.map((f) => (
                  <div key={f.type} className="group flex items-center gap-3 border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a] px-4 py-3 hover:border-blue-400 dark:hover:border-blue-700 transition-colors cursor-default">
                    <Folder size={18} weight="fill" className="text-slate-300 dark:text-slate-600 shrink-0" />
                    <span className="text-[13px] font-medium text-slate-800 dark:text-slate-100 truncate">{f.label}</span>
                    <span className="ml-auto tabular-nums text-[12px] text-slate-500 dark:text-slate-400 shrink-0">{num(f.count)} items</span>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
