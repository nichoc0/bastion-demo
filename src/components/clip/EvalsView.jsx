import { useEffect, useMemo, useRef, useState } from 'react';
import { CaretLeft, CaretRight, ArrowUpRight, Play, X } from '@phosphor-icons/react';
import { CTF_TARGETS } from '../../data/ctfTargets';
import { EvalsPage } from './EvalsWidget';
import { BenchmarkPage } from './BenchmarkWidget';

// Evals tab = Sandbox (pick an OSS CTF target, the harness clones/attaches it in
// a sandbox and runs a new eval) + Past evals (the leak-resistance leaderboard +
// run traces). Clicking a CTF card starts a sandbox session; only the source
// is an outbound link.
const PAST_EVALS = [
  { id: 'leak-resistance', name: 'Leak Resistance', sub: '2 agents · 9 vectors · scored in the Bastion harness', vuln: '89%', held: '100%' },
];

// The sandbox boot log for a target. Repo-backed CTFs get cloned + built; hosted
// challenges are attached directly. Either way the harness then takes over.
function buildLog(ctf) {
  const isRepo = ctf.url.includes('github.com');
  const slug = ctf.id;
  if (isRepo) {
    return [
      `$ git clone ${ctf.url} /sandbox/${slug}`,
      `Cloning into '/sandbox/${slug}'...`,
      `remote: Enumerating objects: 312, done.`,
      `Receiving objects: 100% (312/312), 1.24 MiB | 4.1 MiB/s, done.`,
      `$ cd /sandbox/${slug} && docker compose up -d`,
      `[+] Running 2/2  network ${slug}_default  container ${slug}-app`,
      `target up on http://127.0.0.1:8000`,
      `$ bastion attach --target http://127.0.0.1:8000 --suite leak-resistance`,
      `harness: orchestrator online, recon dispatched`,
      `harness: ${ctf.kind} surface mapped`,
      `harness: scoring held vs leaked, tracing to run log`,
      `harness: run live. open Past Runs to watch the swarm`,
    ];
  }
  return [
    `$ bastion sandbox --hosted ${ctf.url}`,
    `sandbox: hosted target, no clone needed`,
    `$ bastion attach --target ${ctf.url} --suite leak-resistance`,
    `harness: orchestrator online, recon dispatched`,
    `harness: ${ctf.kind} mapped`,
    `harness: scoring held vs leaked, tracing to run log`,
    `harness: run live. open Past Runs to watch the swarm`,
  ];
}

function LogLine({ text }) {
  const cls = text.startsWith('$ ') ? 'text-blue-300'
    : text.startsWith('harness:') ? 'text-sky-300'
    : text.startsWith('target up') ? 'text-blue-300'
    : 'text-slate-400';
  return <div className={`whitespace-pre-wrap ${cls}`}>{text}</div>;
}

function SandboxSession({ ctf, onClose }) {
  const lines = useMemo(() => buildLog(ctf), [ctf.id]);
  const [n, setN] = useState(0);
  const endRef = useRef(null);

  useEffect(() => { setN(0); }, [ctf.id]);
  useEffect(() => {
    if (n >= lines.length) return undefined;
    const id = setTimeout(() => setN((x) => x + 1), n === 0 ? 120 : 320);
    return () => clearTimeout(id);
  }, [n, lines.length, ctf.id]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'nearest' }); }, [n]);

  const done = n >= lines.length;
  return (
    <div className="mt-4 max-w-[640px] border border-slate-800 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-3 h-8 bg-[#0b1220] border-b border-slate-800">
        <span className="flex gap-1.5">
          <span className="w-2 h-2 rounded-full bg-slate-600" />
          <span className="w-2 h-2 rounded-full bg-slate-700" />
          <span className="w-2 h-2 rounded-full bg-slate-700" />
        </span>
        <span className="font-tech text-[11px] text-slate-300 ml-1">sandbox · {ctf.name}</span>
        {done
          ? <span className="font-tech text-[9px] text-blue-300 ml-1">live</span>
          : <span className="font-tech text-[9px] text-sky-300 ml-1 animate-pulse">running</span>}
        <button onClick={onClose} className="ml-auto text-slate-500 hover:text-slate-300 transition-colors cursor-pointer bg-transparent border-0 p-0"><X size={13} weight="bold" /></button>
      </div>
      <div className="bg-[#0b1220] px-3 py-2.5 max-h-[240px] overflow-y-auto font-tech text-[11px] leading-relaxed">
        {lines.slice(0, n).map((l, i) => <LogLine key={i} text={l} />)}
        {!done && <span className="text-slate-500">▍</span>}
        <div ref={endRef} />
      </div>
    </div>
  );
}

function CtfCard({ c, active, onRun }) {
  return (
    <div className={`w-[230px] border bg-white dark:bg-[#0f172a] px-3.5 py-3 transition-colors ${active ? 'border-slate-400 dark:border-slate-500' : 'border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600'}`}>
      <button onClick={onRun} className="group block w-full text-left cursor-pointer bg-transparent border-0 p-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">{c.name}</span>
          <Play size={12} weight="fill" className="ml-auto text-slate-300 dark:text-slate-600 group-hover:text-blue-500 transition-colors" />
        </div>
        <div className="font-tech text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{c.kind}</div>
      </button>
      <a href={c.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 font-tech text-[9px] text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400 mt-1.5 transition-colors">
        {c.src} <ArrowUpRight size={9} weight="bold" />
      </a>
    </div>
  );
}

export default function EvalsView() {
  const [benchOpen, setBenchOpen] = useState(false);
  return (
    <div>
      {/* Benchmark vs field — expandable, primary element */}
      <div className="mb-7 border border-slate-300 dark:border-slate-700">
        <button onClick={() => setBenchOpen((o) => !o)} className={`w-full flex items-center gap-4 px-6 py-6 text-left transition-colors cursor-pointer border-0 ${benchOpen ? 'bg-slate-50 dark:bg-slate-800/40' : 'bg-slate-50/70 dark:bg-slate-800/20 hover:bg-slate-100 dark:hover:bg-slate-800/50'}`}>
          <CaretRight size={22} weight="bold" className={`text-slate-500 dark:text-slate-400 shrink-0 transition-transform ${benchOpen ? 'rotate-90' : ''}`} />
          <div className="min-w-0">
            <div className="text-[16px] font-bold uppercase tracking-widest text-slate-800 dark:text-slate-100">Benchmark vs field</div>
            <div className="text-[12.5px] text-slate-500 dark:text-slate-400 mt-0.5">Bastion vs OSS red-team tools · multi-turn attack-success rate</div>
          </div>
          <span className="ml-auto shrink-0 text-[11px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300 border border-slate-400 dark:border-slate-500 px-4 py-2">{benchOpen ? 'Hide' : 'View tables'}</span>
        </button>
        {benchOpen && (
          <div className="px-6 pb-7 pt-4 border-t border-slate-200 dark:border-slate-800">
            <BenchmarkPage />
          </div>
        )}
      </div>

      {/* Sandbox — WIP (compact, so it doesn't dominate the page) */}
      <div>
        <div className="flex items-baseline gap-2 mb-2">
          <h2 className="text-[13px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Sandbox</h2>
          <span className="text-[12px] text-slate-400 dark:text-slate-500">pick an OSS CTF target, the harness clones it into a sandbox and runs a new eval</span>
        </div>
        <div className="relative max-h-[140px] overflow-hidden border border-slate-200 dark:border-slate-800">
          <div className="blur-[3px] pointer-events-none select-none opacity-50 p-2.5">
            <div className="flex flex-wrap gap-2.5">
              {CTF_TARGETS.map((c) => <CtfCard key={c.id} c={c} active={false} onRun={() => {}} />)}
            </div>
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="border border-slate-300 dark:border-slate-700 bg-white/90 dark:bg-[#0f172a]/90 backdrop-blur-sm px-5 py-3 text-center shadow-sm">
              <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Work in progress</div>
              <div className="text-[12px] text-slate-500 dark:text-slate-400 mt-1">Sandbox eval runs are being wired to the harness.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
