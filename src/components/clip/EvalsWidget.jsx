import { motion } from 'framer-motion';
import { ArrowUpRight } from '@phosphor-icons/react';
import { LEADERBOARD, AGENTS, VECTORS } from '../../data/evals';

// Evals — a ranked leak-resistance leaderboard. Mono is reserved for actual
// data (percentages, counts, OWASP codes); everything else is clean sans.
// Blue = held metric; the vulnerable model ranks last.

const heldPct = (a) => Math.round((a.held / a.total) * 100);
const GOLD = '#facc15';

function MetricBar({ pct }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-[110px] h-[5px] rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <motion.div className="h-full rounded-full bg-blue-600 dark:bg-blue-500" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, ease: 'easeOut' }} />
      </div>
      <span className="font-tech text-[12px] tabular-nums text-slate-700 dark:text-slate-200 w-[34px]">{pct}%</span>
    </div>
  );
}

function Mark({ leaked }) {
  return leaked
    ? <span className="inline-block w-2.5 h-2.5 rounded-[2px] bg-blue-700 dark:bg-blue-500" />
    : <span className="inline-block w-2.5 h-2.5 rounded-[2px] border border-blue-300 dark:border-blue-700" />;
}

export function EvalsPage() {
  const board = [...AGENTS].sort((a, b) => heldPct(b) - heldPct(a));

  return (
    <div className="max-w-[700px]">
      {/* leaderboard */}
      <div className="flex items-center gap-2 mb-2.5">
        <span className="inline-block w-2 h-2 rounded-full" style={{ background: GOLD }} />
        <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">Leaderboard</span>
        <span className="font-tech text-[11px] text-slate-400 dark:text-slate-500">leak_resistance</span>
        <a href={LEADERBOARD.url} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-[12px] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors">open leaderboard <ArrowUpRight size={12} weight="bold" /></a>
      </div>
      <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-white dark:bg-[#0f172a]">
        <div className="grid grid-cols-[40px_1fr_180px_70px_80px] items-center px-4 h-9 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-[12px] text-slate-400 dark:text-slate-500">
          <span>#</span><span>Model</span><span>Held rate</span><span className="text-right">Leaked</span><span className="text-right">AI-native</span>
        </div>
        {board.map((a, i) => (
          <div key={a.name} className={`grid grid-cols-[40px_1fr_180px_70px_80px] items-center px-4 h-12 border-b border-slate-100 dark:border-slate-800/60 last:border-b-0 ${i === 0 ? 'bg-amber-50/40 dark:bg-amber-500/[0.04]' : ''}`}>
            <span className="font-tech text-[12px] tabular-nums text-slate-400 dark:text-slate-500">{i + 1}</span>
            <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">{a.name}</span>
            <MetricBar pct={heldPct(a)} />
            <span className="font-tech text-[12px] tabular-nums text-right text-slate-600 dark:text-slate-300">{a.leaked}</span>
            <span className="font-tech text-[12px] tabular-nums text-right text-slate-600 dark:text-slate-300">{a.aiNative}</span>
          </div>
        ))}
      </div>

      {/* evaluation detail — per vector */}
      <div className="flex items-end justify-between mt-6 mb-2.5 px-0.5">
        <div className="flex items-baseline gap-2">
          <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">Evaluation</span>
          <span className="text-[12px] text-slate-400 dark:text-slate-500">{VECTORS.length} vectors</span>
        </div>
        <div className="flex items-center text-[11px] text-slate-400 dark:text-slate-500">
          <span className="w-[54px] text-center">Vuln</span><span className="w-[54px] text-center">Hardened</span>
        </div>
      </div>
      <motion.div initial="hidden" animate="show" transition={{ staggerChildren: 0.025 }} className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-white dark:bg-[#0f172a]">
        {VECTORS.map((v, i) => (
          <motion.div key={i} variants={{ hidden: { opacity: 0, x: -6 }, show: { opacity: 1, x: 0 } }} className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-100 dark:border-slate-800/60 last:border-b-0">
            <span className="text-[13px] text-slate-700 dark:text-slate-200 flex-1 min-w-0 truncate">
              {v.vector}
              {v.aiNative && <span className="text-[10px] font-medium text-blue-500/70 dark:text-blue-400/70 ml-1.5 align-[1px]">AI</span>}
            </span>
            <span className="font-tech text-[10px] uppercase text-slate-400 dark:text-slate-500 shrink-0 w-[108px] text-right">{v.owasp}</span>
            <span className="w-[54px] grid place-items-center shrink-0"><Mark leaked={v.vuln === 'leaked'} /></span>
            <span className="w-[54px] grid place-items-center shrink-0"><Mark leaked={false} /></span>
          </motion.div>
        ))}
      </motion.div>

      <div className="flex items-center gap-4 mt-3 text-[12px] text-slate-400 dark:text-slate-500">
        <span><span className="inline-block w-2 h-2 rounded-[2px] bg-blue-700 dark:bg-blue-500 align-middle mr-1.5" />leaked</span>
        <span><span className="inline-block w-2 h-2 rounded-[2px] border border-blue-300 dark:border-blue-700 align-middle mr-1.5" />held</span>
        <a href={LEADERBOARD.url} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">every probe + grade traced in the harness <ArrowUpRight size={12} weight="bold" /></a>
      </div>
    </div>
  );
}
