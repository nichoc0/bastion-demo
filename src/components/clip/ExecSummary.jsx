import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CaretRight } from '@phosphor-icons/react';

// ExecSummary — the executive summary that sits on top of a run's widget menu:
// the agents that ran, the findings (each expands to its proof-of-concept), and
// the tools the swarm used. The widgets below (Swarm / Toolbox / Graph / Agents)
// are the detail. Palette: identity = color, leak = dark blue, held = light
// blue, severity = neutral fill-weight.

function Stat({ n, label }) {
  return (
    <div className="px-4 py-3">
      <div className="text-[22px] font-semibold tracking-tight text-slate-800 dark:text-slate-100 tabular-nums leading-none">{n}</div>
      <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">{label}</div>
    </div>
  );
}

const SEV = { high: 'bg-slate-700 dark:bg-slate-200', med: 'bg-slate-400 dark:bg-slate-500', low: 'bg-slate-300 dark:bg-slate-700' };

function FindingRow({ f }) {
  const [open, setOpen] = useState(false);
  const leaked = f.kind === 'leaked';
  const hasPoc = !!f.poc;
  return (
    <div className="border-b border-slate-50 dark:border-slate-800/40 last:border-b-0">
      <button
        onClick={() => hasPoc && setOpen((o) => !o)}
        className={`w-full flex items-center gap-2.5 py-1.5 text-left ${hasPoc ? 'cursor-pointer group' : 'cursor-default'}`}
      >
        {hasPoc
          ? <motion.span animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.15 }} className="text-slate-300 dark:text-slate-600 shrink-0 -ml-0.5"><CaretRight size={11} weight="bold" /></motion.span>
          : <span className="w-[11px] shrink-0" />}
        <span className={`w-2.5 h-2.5 rounded-[2px] shrink-0 ${leaked ? 'bg-blue-700 dark:bg-blue-500' : 'border border-blue-300 dark:border-blue-700'}`} />
        <span className="text-[12.5px] text-slate-700 dark:text-slate-200 flex-1 min-w-0 truncate group-hover:text-slate-900 dark:group-hover:text-white transition-colors">{f.title}</span>
        <span className="font-tech text-[9px] uppercase text-slate-400 dark:text-slate-500 shrink-0 w-[64px] text-right">{f.owasp}</span>
        {f.sev !== 'none'
          ? <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${SEV[f.sev] || 'bg-slate-300'}`} title={f.sev} />
          : <span className="w-1.5 h-1.5 shrink-0" />}
      </button>
      <AnimatePresence initial={false}>
        {open && hasPoc && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="ml-[23px] mr-1 mb-2 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50">
              <div className="flex items-center gap-2 px-2.5 h-6 border-b border-slate-200 dark:border-slate-800">
                <span className="font-tech text-[8.5px] uppercase tracking-wide text-slate-400 dark:text-slate-500">proof of concept</span>
                <span className="font-tech text-[8.5px] text-slate-300 dark:text-slate-600 ml-auto">{f.poc.lang}</span>
              </div>
              <pre className="px-3 py-2 overflow-x-auto font-tech text-[10.5px] leading-relaxed text-slate-600 dark:text-slate-300 whitespace-pre">{f.poc.content}</pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function ExecSummary({ run }) {
  const breached = run.verdict === 'breached';
  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-[#0f172a] mb-4 overflow-hidden">
      {/* header */}
      <div className="flex items-center gap-2 px-4 h-10 border-b border-slate-200 dark:border-slate-800">
        <span className={`w-2 h-2 rounded-full ${breached ? 'bg-blue-700 dark:bg-blue-500' : 'bg-sky-400 dark:bg-sky-300'}`} />
        <span className={`text-[12px] font-semibold ${breached ? 'text-blue-700 dark:text-blue-400' : 'text-sky-500 dark:text-sky-300'}`}>{run.verdict}</span>
        <span className="text-[11px] text-slate-400 dark:text-slate-500">executive summary</span>
        <span className="ml-auto font-tech text-[10px] text-slate-400 dark:text-slate-500 tabular-nums">{run.turns} turns</span>
      </div>

      {/* stat strip */}
      <div className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-slate-800/60 border-b border-slate-200 dark:border-slate-800">
        <Stat n={run.agents.length} label="agents" />
        <Stat n={run.findings.length} label={breached ? 'findings' : 'vectors held'} />
        <Stat n={run.tools.length} label="tools used" />
      </div>

      {/* findings */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
        <div className="text-[11px] text-slate-400 dark:text-slate-500 mb-1.5">{breached ? 'findings' : 'vectors tested, all held'}</div>
        {run.findings.map((f, i) => <FindingRow key={i} f={f} />)}
      </div>

      {/* agents + tools */}
      <div className="grid grid-cols-2 divide-x divide-slate-100 dark:divide-slate-800/60">
        <div className="px-4 py-3">
          <div className="text-[11px] text-slate-400 dark:text-slate-500 mb-2">agents</div>
          <div className="flex flex-col gap-1.5">
            {run.agents.map((a) => (
              <span key={a.name} className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: a.color }} />
                <span className="text-[11.5px] text-slate-600 dark:text-slate-300">{a.name}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="px-4 py-3">
          <div className="text-[11px] text-slate-400 dark:text-slate-500 mb-2">tools</div>
          <div className="flex flex-wrap gap-1.5">
            {run.tools.map((t) => (
              <span key={t} className="font-tech text-[10px] px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">{t}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
