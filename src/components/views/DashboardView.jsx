import { useState, useEffect } from 'react';
import {
  AreaChart, Area, ResponsiveContainer,
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, LabelList,
} from 'recharts';

// CISO + vulnerability-management console.
// Each dataset uses the chart form that fits its job — a donut for the
// part-to-whole severity split, a ranked bar chart for categories, an area line
// for the posture trend — so the page reads with variety instead of four
// identical bar stacks. One light surface, blue as the accent, severity as a
// black→blue ordinal ramp. Everything reconciles around 29 OPEN findings:
//   Critical 3 · High 5 · Medium 9 · Low 12 (= 29); category counts sum to 29;
//   per-asset critical→3, high→5, open→29.

const INK = 'text-slate-900 dark:text-white';
const MUTED = 'text-slate-500 dark:text-slate-400';
const FAINT = 'text-slate-400 dark:text-slate-500';

// Visual style only (never data): the ordinal severity ramp and the chips.
const SEV_ORDER = ['Critical', 'High', 'Medium', 'Low'];
const SEV_STYLE = {
  Critical: { hex: '#0f172a', bar: 'bg-slate-900 dark:bg-white' },
  High: { hex: '#1d4ed8', bar: 'bg-blue-700' },
  Medium: { hex: '#3b82f6', bar: 'bg-blue-500' },
  Low: { hex: '#93c5fd', bar: 'bg-blue-300 dark:bg-blue-900' },
};
const SEV_CHIP = {
  Critical: 'bg-slate-900 text-white dark:bg-white dark:text-slate-900',
  High: 'border border-blue-700 text-blue-700 dark:text-blue-400 dark:border-blue-500',
};
const RISK_CHIP = {
  High: 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900',
  Medium: 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  Low: 'bg-slate-50 text-slate-400 border border-slate-200 dark:bg-slate-900 dark:text-slate-500 dark:border-slate-800',
};

// All numbers come from an editable data file: public/demo-data/dashboard.json.
// These DEFAULTS are the fallback and the first-paint values; the file (when
// present) overrides them at load. Edit the file to change or add metrics —
// the layout and visuals are unchanged, only the data.
const DEFAULTS = {
  lastScan: '6m ago',
  posture: 54,
  postureLast: 48,
  trend: [46, 45, 47, 44, 48, 47, 49, 48, 50, 49, 51, 50, 52, 54],
  severity: { Critical: 3, High: 5, Medium: 9, Low: 12 },
  summary: { agentsAtRisk: 4, agentsTotal: 24, pastSla: 4 },
  kpis: [
    { value: '29', label: 'Open findings', delta: -4, hint: 'across all agents' },
    { value: '4', label: 'Past SLA', delta: 1, hint: 'breaching remediation SLA' },
    { value: '4.1', unit: 'd', label: 'MTTR', delta: -0.6, hint: 'mean time to remediate' },
    { value: '82', unit: '%', label: 'Within SLA', delta: 3, hint: 'remediated on time' },
    { value: '11', label: 'Remediated', delta: 4, hint: 'last 7 days' },
    { value: '4', unit: '/24', label: 'Agents at risk', delta: -1, hint: 'with an open finding' },
  ],
  attention: [
    { id: 'BAS-1042', sev: 'Critical', title: 'Tool-call exfiltration via injected résumé', asset: 'Kestrel · HR intake', sla: 'Breached' },
    { id: 'BAS-1039', sev: 'Critical', title: 'SIM-swap approved without OTP verification', asset: 'Vantage · telecom', sla: 'Breached' },
    { id: 'BAS-1031', sev: 'Critical', title: 'Controlled-substance delivery override', asset: 'Maple · Sera', sla: '1d left' },
    { id: 'BAS-1024', sev: 'High', title: 'System prompt leaked verbatim to caller', asset: 'Apex · banking', sla: '3d left' },
    { id: 'BAS-1018', sev: 'High', title: 'Refund issued past policy ceiling', asset: 'Ada · support', sla: '5d left' },
  ],
  categories: [
    { name: 'Prompt injection', n: 8 },
    { name: 'Insecure tool use', n: 6 },
    { name: 'Policy bypass', n: 5 },
    { name: 'Jailbreak', n: 4 },
    { name: 'Info disclosure', n: 4 },
    { name: 'Data exfiltration', n: 2 },
  ],
  assets: [
    { name: 'Kestrel', type: 'HR intake', crit: 1, high: 1, open: 8, risk: 'High' },
    { name: 'Vantage', type: 'telecom', crit: 1, high: 1, open: 7, risk: 'High' },
    { name: 'Maple · Sera', type: 'pharmacy', crit: 1, high: 0, open: 5, risk: 'High' },
    { name: 'Apex', type: 'banking', crit: 0, high: 2, open: 6, risk: 'Medium' },
    { name: 'Ada', type: 'support', crit: 0, high: 1, open: 3, risk: 'Medium' },
  ],
  frameworks: [
    { label: 'OWASP LLM Top 10', pct: 90 },
    { label: 'MITRE ATLAS', pct: 72 },
    { label: 'NIST AI RMF', pct: 64 },
    { label: 'SOC 2 (AI controls)', pct: 81 },
    { label: 'EU AI Act', pct: 38 },
  ],
};

function scoreBand(s) {
  if (s >= 80) return 'Strong';
  if (s >= 65) return 'Moderate';
  if (s >= 45) return 'Elevated';
  return 'Critical';
}

// Edge-anchored x tick so the first/last labels never clip against the plot edge.
function TrendTick({ x, y, payload }) {
  if (!payload?.value) return null;
  const anchor = payload.value === 'today' ? 'end' : 'start';
  return <text x={x} y={y + 10} textAnchor={anchor} fontSize={10} fill="#94a3b8">{payload.value}</text>;
}

function SectionHead({ children, right }) {
  return (
    <header className="px-4 h-9 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
      <h3 className={`text-[10px] font-bold uppercase tracking-[0.16em] ${MUTED}`}>{children}</h3>
      {right}
    </header>
  );
}

function Delta({ v, unit }) {
  if (v == null) return null;
  const up = v > 0;
  return <span className={`text-[10px] font-semibold tabular-nums ${FAINT} ml-1.5`}>{up ? '▲' : '▼'}{Math.abs(v)}{unit || ''}</span>;
}

export default function DashboardView() {
  // Data comes from the editable file; DEFAULTS is the fallback / first paint.
  const [d, setD] = useState(DEFAULTS);
  useEffect(() => {
    let alive = true;
    fetch(`${import.meta.env.BASE_URL}demo-data/dashboard.json`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (alive && j && typeof j === 'object') setD({ ...DEFAULTS, ...j }); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const POSTURE = d.posture;
  const POSTURE_LAST = d.postureLast;
  const POSTURE_TREND = d.trend.map((v, i, a) => ({ i, v, label: i === 0 ? '14d ago' : i === a.length - 1 ? 'today' : '' }));
  const SEV = Object.fromEntries(SEV_ORDER.map((k) => [k, { ...SEV_STYLE[k], count: d.severity[k] ?? 0 }]));
  const SEV_DATA = SEV_ORDER.map((k) => ({ name: k, value: d.severity[k] ?? 0, hex: SEV_STYLE[k].hex }));
  const OPEN_TOTAL = SEV_ORDER.reduce((s, k) => s + (d.severity[k] ?? 0), 0);
  const KPIS = d.kpis;
  const ATTENTION = d.attention;
  const CATEGORIES = d.categories;
  const ASSETS = d.assets;
  const FRAMEWORKS = d.frameworks;
  const band = scoreBand(POSTURE);

  return (
    <div>
      {/* thin title strip — 16px gutter, matching the KPI strip and tables below */}
      <div className="h-11 px-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
        <h1 className="text-[15px] font-bold tracking-tight text-slate-900 dark:text-white">Dashboard</h1>
        <span className={`text-[11px] font-medium ${FAINT}`}>Last scan · {d.lastScan}</span>
      </div>

      {/* ── HERO · score · summary fills the width · trend + action ──────────── */}
      <section className="bg-white dark:bg-[#0f172a] px-4 py-5 border-b border-slate-200 dark:border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center gap-5 md:gap-8">
          {/* score */}
          <div className="shrink-0">
            <div className={`text-[12px] font-semibold ${MUTED}`}>Risk posture</div>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className={`text-[46px] leading-none font-bold tabular-nums tracking-tight ${INK}`}>{POSTURE}</span>
              <span className={`text-[14px] font-medium ${FAINT}`}>/ 100</span>
              <span className="text-[14px] font-semibold text-blue-700 dark:text-blue-400 ml-1">{band}</span>
              <Delta v={POSTURE - POSTURE_LAST} />
            </div>
          </div>

          <div className="hidden md:block w-px self-stretch bg-slate-200 dark:bg-slate-800" />

          {/* summary — fills the middle so there is no dead space */}
          <p className={`flex-1 text-[13px] leading-snug ${MUTED}`}>
            <span className={`font-semibold ${INK}`}>{OPEN_TOTAL} findings</span> open across{' '}
            <span className={`font-semibold ${INK}`}>{d.summary.agentsAtRisk} of {d.summary.agentsTotal} agents</span> —{' '}
            <span className={`font-semibold ${INK}`}>{SEV.Critical.count} critical</span>,{' '}
            <span className={`font-semibold ${INK}`}>{d.summary.pastSla} past SLA</span>. Posture is up{' '}
            <span className={`font-semibold ${INK}`}>{POSTURE - POSTURE_LAST}</span> over 14 days after two high-severity fixes.
          </p>

          <button className="inline-flex items-center gap-2 h-9 px-4 shrink-0 bg-blue-600 text-white text-[12px] font-semibold hover:bg-blue-700 transition-colors border-0 cursor-pointer">
            Full report →
          </button>
        </div>
      </section>

      {/* ── KPI STRIP ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-slate-200 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800">
        {KPIS.map((k) => (
          <div key={k.label} className="bg-white dark:bg-[#0f172a] px-4 py-4">
            <div className="flex items-baseline">
              <span className={`text-[26px] leading-none font-bold tabular-nums ${INK}`}>{k.value}</span>
              {k.unit && <span className="text-[12px] font-semibold text-slate-400 dark:text-slate-500">{k.unit}</span>}
              <Delta v={k.delta} unit={k.label === 'MTTR' ? 'd' : ''} />
            </div>
            <div className={`text-[11px] font-semibold uppercase tracking-[0.08em] ${MUTED} mt-2`}>{k.label}</div>
            <div className={`text-[10px] ${FAINT} mt-0.5`}>{k.hint}</div>
          </div>
        ))}
      </div>

      {/* ── FINDINGS ANALYTICS · three equal chart cards ────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-slate-200 dark:bg-slate-800">
        {/* by severity — donut */}
        <section className="bg-white dark:bg-[#0f172a]">
          <SectionHead right={<span className={`text-[10px] tabular-nums ${FAINT}`}>{OPEN_TOTAL} open</span>}>Findings by severity</SectionHead>
          <div className="px-5 py-5 flex items-center gap-5">
            <div className="relative shrink-0" style={{ width: 108, height: 108 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={SEV_DATA} dataKey="value" nameKey="name" innerRadius={35} outerRadius={52}
                    startAngle={90} endAngle={-270} paddingAngle={2} stroke="none" isAnimationActive={false}>
                    {SEV_DATA.map((d) => <Cell key={d.name} fill={d.hex} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className={`text-[22px] leading-none font-bold tabular-nums ${INK}`}>{OPEN_TOTAL}</span>
                <span className={`text-[9px] uppercase tracking-wider ${FAINT} mt-0.5`}>open</span>
              </div>
            </div>
            <div className="flex-1 space-y-2">
              {SEV_ORDER.map((k) => (
                <div key={k} className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 shrink-0" style={{ background: SEV[k].hex }} />
                  <span className={`text-[12px] ${MUTED} flex-1`}>{k}</span>
                  <span className={`text-[13px] font-semibold tabular-nums ${INK}`}>{SEV[k].count}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* by category — ranked bars */}
        <section className="bg-white dark:bg-[#0f172a]">
          <SectionHead right={<span className={`text-[10px] tabular-nums ${FAINT}`}>{OPEN_TOTAL} open</span>}>Findings by category</SectionHead>
          <div className="px-3 py-3">
            <ResponsiveContainer width="100%" height={168}>
              <BarChart data={CATEGORIES} layout="vertical" margin={{ top: 0, right: 22, left: 0, bottom: 0 }} barCategoryGap={8}>
                <XAxis type="number" hide domain={[0, 'dataMax']} />
                <YAxis type="category" dataKey="name" width={112} axisLine={false} tickLine={false}
                  tick={{ fontSize: 11, fill: '#64748b' }} />
                <Bar dataKey="n" fill="#2563eb" radius={[0, 2, 2, 0]} barSize={10} isAnimationActive={false}>
                  <LabelList dataKey="n" position="right" offset={7} style={{ fontSize: 11, fontWeight: 600, fill: '#0f172a' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* posture over time — the trend, in its rightful home */}
        <section className="bg-white dark:bg-[#0f172a]">
          <SectionHead right={<span className={`text-[10px] font-semibold tabular-nums text-blue-700 dark:text-blue-400`}>▲ {POSTURE - POSTURE_LAST}</span>}>Posture over time</SectionHead>
          <div className="px-4 py-3">
            <ResponsiveContainer width="100%" height={168}>
              <AreaChart data={POSTURE_TREND} margin={{ top: 8, right: 4, left: 4, bottom: 2 }}>
                <defs><linearGradient id="ph" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2563eb" stopOpacity={0.18} /><stop offset="100%" stopColor="#2563eb" stopOpacity={0} /></linearGradient></defs>
                <XAxis dataKey="label" interval={0} axisLine={false} tickLine={false} tick={<TrendTick />} height={18} />
                <YAxis domain={[40, 60]} hide />
                <Area type="monotone" dataKey="v" stroke="#2563eb" strokeWidth={2.5} fill="url(#ph)" isAnimationActive={false} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* ── FINDINGS REQUIRING ATTENTION · full-width triage list ────────────── */}
      <div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a]">
        <SectionHead right={<button className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 hover:underline bg-transparent border-0 cursor-pointer">View all findings →</button>}>Findings requiring attention</SectionHead>
        <table className="w-full">
          <thead>
            <tr className={`text-[9px] font-bold uppercase tracking-[0.12em] ${FAINT} border-b border-slate-100 dark:border-slate-800/70`}>
              <th className="text-left font-bold px-4 py-2 w-24">Severity</th>
              <th className="text-left font-bold px-3 py-2">Finding</th>
              <th className="text-left font-bold px-3 py-2 w-24">ID</th>
              <th className="text-left font-bold px-3 py-2">Asset</th>
              <th className="text-right font-bold px-4 py-2 w-28">SLA</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
            {ATTENTION.map((a) => (
              <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors cursor-default">
                <td className="px-4 py-2.5">
                  <span className={`inline-block text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 ${SEV_CHIP[a.sev]}`}>{a.sev}</span>
                </td>
                <td className={`px-3 py-2.5 text-[13px] font-medium ${INK}`}>{a.title}</td>
                <td className={`px-3 py-2.5 text-[11px] tabular-nums ${MUTED}`}>{a.id}</td>
                <td className={`px-3 py-2.5 text-[12px] ${MUTED}`}>{a.asset}</td>
                <td className={`px-4 py-2.5 text-right text-[11px] tabular-nums ${a.sla === 'Breached' ? 'text-slate-900 dark:text-white font-semibold' : FAINT}`}>{a.sla}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── COVERAGE · assets + compliance ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-px bg-slate-200 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-800">
        {/* Assets by risk */}
        <div className="lg:col-span-8 bg-white dark:bg-[#0f172a]">
          <SectionHead right={<button className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 hover:underline bg-transparent border-0 cursor-pointer">All 24 agents →</button>}>Assets by risk</SectionHead>
          <table className="w-full">
            <thead>
              <tr className={`text-[9px] font-bold uppercase tracking-[0.12em] ${FAINT} border-b border-slate-100 dark:border-slate-800/70`}>
                <th className="text-left font-bold px-4 py-2">Asset</th>
                <th className="text-right font-bold px-3 py-2">Critical</th>
                <th className="text-right font-bold px-3 py-2">High</th>
                <th className="text-right font-bold px-3 py-2">Open</th>
                <th className="text-right font-bold px-4 py-2">Risk level</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {ASSETS.map((a) => (
                <tr key={a.name} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                  <td className="px-4 py-2.5">
                    <span className={`text-[13px] font-medium ${INK}`}>{a.name}</span>
                    <span className={`text-[10px] ${FAINT} ml-2`}>{a.type}</span>
                  </td>
                  <td className={`text-right px-3 py-2.5 text-[12px] tabular-nums ${a.crit ? INK + ' font-semibold' : FAINT}`}>{a.crit || '—'}</td>
                  <td className={`text-right px-3 py-2.5 text-[12px] tabular-nums ${a.high ? INK : FAINT}`}>{a.high || '—'}</td>
                  <td className={`text-right px-3 py-2.5 text-[12px] tabular-nums ${MUTED}`}>{a.open}</td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={`inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 ${RISK_CHIP[a.risk]}`}>{a.risk}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Compliance coverage */}
        <section className="lg:col-span-4 bg-white dark:bg-[#0f172a]">
          <SectionHead right={<span className={`text-[10px] tabular-nums ${FAINT}`}>69%</span>}>Compliance coverage</SectionHead>
          <div className="px-4 py-3 space-y-3">
            {FRAMEWORKS.map((f) => (
              <div key={f.label}>
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-[11px] text-slate-700 dark:text-slate-200">{f.label}</span>
                  <span className={`text-[11px] font-semibold tabular-nums ${f.pct < 50 ? INK : MUTED}`}>{f.pct}%</span>
                </div>
                <div className="h-1 bg-slate-100 dark:bg-slate-800/80">
                  <div className="h-full bg-blue-600 dark:bg-blue-500" style={{ width: `${f.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
