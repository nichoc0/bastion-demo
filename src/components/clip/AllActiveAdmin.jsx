import { useEffect, useState } from 'react';
import { useUser, useOrganization } from '@clerk/clerk-react';
import { Lightning, TerminalWindow } from '@phosphor-icons/react';

// Admin-only "All active" board: every Bastion agent that is live right now.
// A Bastion agent is a Claude Code session whose cwd is under bastion-red/; the
// feed comes from a localhost-only dev endpoint that reads the local transcript
// store (see vite.config.js + dev/liveRuns.mjs). Only LIVE sessions are shown.
// Gated to admins both here (UI) and at the endpoint (localhost-only) — never a
// public surface.

const ADMIN_EMAILS = ['demo@pistonsolutions.ai', 'demo@bastion.ai'];

function useIsAdmin() {
  const { user } = useUser();
  const { membership } = useOrganization();
  const email = (user?.primaryEmailAddress?.emailAddress || '').toLowerCase();
  return membership?.role === 'admin' || ADMIN_EMAILS.includes(email);
}

function fmtDuration(ms) {
  if (ms == null || Number.isNaN(ms)) return '—';
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function LiveAgentCard({ run }) {
  const startedMs = run.startedAt ? Date.parse(run.startedAt) : null;
  const elapsed = startedMs ? fmtDuration(Date.now() - startedMs) : '—';
  return (
    <div className="group relative w-[320px] text-left border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a] hover:border-blue-400 dark:hover:border-blue-700 transition-colors">
      <span className="absolute left-0 inset-y-0 w-[2px] bg-blue-500" />
      <div className="flex items-center gap-2 px-4 pt-3.5">
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75 pulse-dot" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
        </span>
        <span className="text-[13px] font-bold tracking-tight text-slate-800 dark:text-slate-100 truncate">
          {run.engagement}
        </span>
        {run.model && (
          <span className="ml-auto font-tech text-[9px] uppercase tracking-widest text-slate-400 dark:text-slate-500 shrink-0 truncate max-w-[110px]">
            {run.model}
          </span>
        )}
      </div>
      <div className="px-4 pt-1.5 pb-2">
        <div className="text-[12px] leading-snug text-slate-600 dark:text-slate-300 line-clamp-2 min-h-[2.2em]">
          {run.title || <span className="text-slate-400 dark:text-slate-500 italic">untitled session</span>}
        </div>
      </div>
      <div className="flex items-center gap-3 px-4 pb-2 text-[10px] tabular-nums text-slate-400 dark:text-slate-500">
        <span className="text-blue-600 dark:text-blue-400 font-semibold">active {run.ageSec}s ago</span>
        {run.turns != null && <span>{run.turns.toLocaleString()} turns</span>}
        <span>running {elapsed}</span>
        <span className="ml-auto font-tech">{run.sessionShort}</span>
      </div>
      <div className="px-4 pb-3 flex items-center gap-1.5 text-[9px] text-slate-400 dark:text-slate-600 font-tech truncate">
        <TerminalWindow size={11} className="shrink-0" />
        <span className="truncate">{run.cwd}</span>
      </div>
    </div>
  );
}

export default function AllActiveAdmin() {
  const isAdmin = useIsAdmin();
  const [runs, setRuns] = useState([]);
  const [state, setState] = useState('loading'); // loading | ok | unavailable

  useEffect(() => {
    if (!isAdmin) return;
    let alive = true;
    const load = () =>
      fetch('/api/admin/active-runs', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error('bad status'))))
        .then((d) => { if (alive) { setRuns(d.runs || []); setState('ok'); } })
        .catch(() => { if (alive) setState('unavailable'); });
    load();
    const t = setInterval(load, 5000);
    return () => { alive = false; clearInterval(t); };
  }, [isAdmin]);

  if (!isAdmin) return null;

  return (
    <section className="mb-8 border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/30">
      <header className="flex items-center gap-2.5 px-4 h-11 border-b border-slate-200 dark:border-slate-800">
        <Lightning size={15} weight="fill" className="text-blue-500" />
        <h2 className="text-[13px] font-bold tracking-tight text-slate-900 dark:text-white">All active</h2>
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 border border-slate-300 dark:border-slate-700 px-1.5 py-0.5">admin</span>
        {state === 'ok' && (
          <span className="ml-auto text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
            {runs.length} Bastion agent{runs.length === 1 ? '' : 's'} live
          </span>
        )}
      </header>

      <div className="p-4">
        {state === 'unavailable' ? (
          <div className="text-[12px] text-slate-500 dark:text-slate-400">
            Live agent feed runs in the local console only. Start the app locally to monitor Bastion agents.
          </div>
        ) : runs.length === 0 ? (
          <div className="text-[12px] text-slate-500 dark:text-slate-400">No Bastion agents live right now.</div>
        ) : (
          <div className="flex flex-wrap gap-3">
            {runs.map((r) => <LiveAgentCard key={r.session} run={r} />)}
          </div>
        )}
      </div>
    </section>
  );
}
