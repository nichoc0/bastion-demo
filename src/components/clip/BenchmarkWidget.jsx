import { useState } from 'react';
import { CaretRight } from '@phosphor-icons/react';
import { BENCHMARK_META, MT_TARGETS, MT_METHODS, MT_AGGREGATE, PROTECTED_DATA, DETAIL_ROWS, DETAIL_META } from '../../data/benchmark';

const SectionLabel = ({ children }) => (
  <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-3">{children}</h3>
);

function Mark({ v }) {
  if (v === true) return <span className="text-slate-900 dark:text-slate-50 font-bold">●</span>;
  if (v === 'partial') return <span className="text-slate-400 dark:text-slate-500">◐</span>;
  return <span className="text-slate-300 dark:text-slate-700">○</span>;
}

// Bastion is the dark/solid bar; OSS tools are lighter. Grayscale only.
const BAR = {
  bastion: 'bg-slate-900 dark:bg-slate-100',
  promptfoo: 'bg-slate-400 dark:bg-slate-500',
  pyrit: 'bg-slate-300 dark:bg-slate-700',
};

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mb-6">
      {MT_METHODS.map((m) => (
        <div key={m.id} className="flex items-center gap-2">
          <span className={`inline-block w-3 h-3 ${BAR[m.id]}`} />
          <span className={`text-[12px] ${m.self ? 'font-bold text-slate-900 dark:text-slate-50' : 'text-slate-600 dark:text-slate-300'}`}>
            {m.name}
          </span>
          {m.kind && <span className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500">{m.kind}</span>}
        </div>
      ))}
    </div>
  );
}

// grouped vertical bars: one cluster per target, one bar per method
function GroupedBars() {
  const H = 200; // px plot height
  return (
    <div className="w-full">
      <div className="flex items-end gap-10 sm:gap-16 pl-9 relative" style={{ height: H + 26 }}>
        {/* y gridlines */}
        <div className="absolute left-0 top-0 bottom-[26px] w-full pointer-events-none">
          {[100, 75, 50, 25, 0].map((g) => (
            <div key={g} className="absolute left-0 w-full flex items-center" style={{ top: `${((100 - g) / 100) * H}px` }}>
              <span className="text-[9px] tabular-nums text-slate-400 dark:text-slate-500 w-7 -translate-y-1/2">{g}</span>
              <span className="flex-1 border-t border-slate-100 dark:border-slate-800" />
            </div>
          ))}
        </div>
        {MT_TARGETS.map((t) => (
          <div key={t.id} className="flex flex-col items-center gap-2 z-10">
            <div className="flex items-end gap-2" style={{ height: H }}>
              {MT_METHODS.map((m) => {
                const v = m.asr[t.id];
                return (
                  <div key={m.id} className="flex flex-col items-center justify-end" style={{ height: H }}>
                    <span className={`text-[10px] tabular-nums mb-1 ${m.self ? 'font-bold text-slate-900 dark:text-slate-50' : 'text-slate-500 dark:text-slate-400'}`}>{v}</span>
                    <div className={`${BAR[m.id]} w-7 sm:w-9`} style={{ height: `${(v / 100) * (H - 16)}px` }} />
                  </div>
                );
              })}
            </div>
            <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">{t.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// the headline: mean ASR across targets, one bar per method (horizontal)
function AggregateRow() {
  return (
    <div className="space-y-2.5 mb-8">
      {MT_AGGREGATE.map((m) => (
        <div key={m.id} className="flex items-center gap-3">
          <span className={`w-40 shrink-0 text-[12px] ${m.self ? 'font-bold text-slate-900 dark:text-slate-50' : 'text-slate-600 dark:text-slate-300'}`}>{m.name}</span>
          <div className="flex-1 h-6 bg-slate-50 dark:bg-slate-900/40 relative">
            <div className={`${BAR[m.id]} h-full`} style={{ width: `${m.mean}%` }} />
          </div>
          <span className={`w-12 text-right text-[13px] tabular-nums ${m.self ? 'font-bold text-slate-900 dark:text-slate-50' : 'text-slate-600 dark:text-slate-300'}`}>{m.mean}%</span>
        </div>
      ))}
    </div>
  );
}

const pct = (c) => (c && c[1] ? Math.round((c[0] / c[1]) * 100) : 0);

// Detailed measured data behind the bars — for technical readers.
function DetailTable() {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-[11.5px] tabular-nums border-collapse">
        <thead>
          <tr className="border-b-2 border-slate-400 dark:border-slate-500 text-slate-600 dark:text-slate-300 text-left">
            <th className="font-semibold py-2 pr-3">Method</th>
            {MT_TARGETS.map((t) => (
              <th key={t.id} className="font-semibold py-2 px-3 text-right">{t.label}</th>
            ))}
            <th className="font-semibold py-2 pl-3 text-right">Mean</th>
          </tr>
        </thead>
        <tbody>
          {DETAIL_ROWS.map((r) => (
            <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-200">
              <td className="py-2 pr-3">
                <span className={r.self ? 'font-bold text-slate-900 dark:text-slate-50' : ''}>{r.name}</span>
                <span className="block text-[10px] text-slate-400 dark:text-slate-500">{r.kind}</span>
              </td>
              {MT_TARGETS.map((t) => (
                <td key={t.id} className={`py-2 px-3 text-right ${r.self ? 'font-semibold text-slate-900 dark:text-slate-50' : ''}`}>
                  {pct(r.cells[t.id])}%
                  <span className="block text-[9.5px] text-slate-400 dark:text-slate-500">{r.cells[t.id][0]}/{r.cells[t.id][1]}</span>
                </td>
              ))}
              <td className={`py-2 pl-3 text-right ${r.self ? 'font-bold text-slate-900 dark:text-slate-50' : ''}`}>{r.mean}%</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-b-2 border-slate-400 dark:border-slate-500"><td colSpan={MT_TARGETS.length + 2} className="p-0" /></tr>
        </tfoot>
      </table>
      <p className="text-[10.5px] leading-relaxed text-slate-500 dark:text-slate-300 mt-3">{DETAIL_META.oracle}</p>
    </div>
  );
}

export function BenchmarkPage() {
  const M = BENCHMARK_META;
  const [detail, setDetail] = useState(false);
  return (
    <div className="w-full max-w-[760px]" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <p className="text-[12.5px] leading-relaxed text-slate-600 dark:text-slate-300 mb-1">
        {M.metric}. Bastion vs open-source red-team tools (Microsoft PyRIT, promptfoo) on multi-turn
        (crescendo) attacks. {M.successDef}
      </p>
      <div className="mb-7" />

      {/* headline: mean ASR per method */}
      <SectionLabel>Mean attack-success rate</SectionLabel>
      <AggregateRow />

      {/* per-target detail */}
      <SectionLabel>By target resistance · multi-turn ASR (%)</SectionLabel>
      <Legend />
      <GroupedBars />
      <p className="text-[11px] leading-relaxed text-slate-400 dark:text-slate-500 mt-4">{M.resistanceNote}</p>

      {/* expandable detailed data — for technical readers */}
      <div className="mt-7 border-t border-slate-100 dark:border-slate-800 pt-4">
        <button onClick={() => setDetail((d) => !d)} className="flex items-center gap-2 text-left cursor-pointer bg-transparent border-0 p-0 group">
          <CaretRight size={13} weight="bold" className={`text-slate-400 dark:text-slate-500 transition-transform ${detail ? 'rotate-90' : ''}`} />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200">{detail ? 'Hide detailed data' : 'Show detailed data'}</span>
        </button>
        {detail && <DetailTable />}
      </div>

      {/* protected data taxonomy */}
      <div className="mt-9">
        <SectionLabel>What counts as protected data</SectionLabel>
        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-2.5">
          {PROTECTED_DATA.map((p) => (
            <div key={p.cls} className="flex items-baseline gap-2.5">
              <Mark v={p.here ? true : false} />
              <div>
                <span className="text-[12px] font-medium text-slate-800 dark:text-slate-100">{p.cls}</span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500"> — {p.note}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10.5px] leading-relaxed text-slate-400 dark:text-slate-500 mt-3">
          These are the protected-data classes Bastion recovers across engagements. The controlled benchmark
          above exercises a planted secret; the live classes are demonstrated against real deployments in the
          engagement findings, where the protected data is real rather than planted.
        </p>
      </div>
    </div>
  );
}
