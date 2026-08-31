import { useEffect, useMemo, useRef, useState } from 'react';
import { PENNY_AGENTS, ROLE } from '../../data/pennyAgents';
import { usePlayback } from '../../data/usePlayback';
import Playback from './Playback';

// Agents tab — RADIAL spawn map: the orchestrator sits at the centre and agents
// diverge outward (hub-and-spoke, not a tree-org). Role agents on the inner
// ring, their research sub-agents further out. Monochrome; red is the one
// reserved accent on attacker nodes. Playback lights nodes up over the run.

function Node({ a, pos, on, isNew }) {
  const role = ROLE[a.role] || { tag: a.role, accent: false };
  if (a.role === 'orchestrator') {
    return (
      <div className="absolute -translate-x-1/2 -translate-y-1/2 z-10 transition-opacity duration-300" style={{ left: pos.x, top: pos.y, opacity: on ? 1 : 0.3 }}>
        <div className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-2.5 text-center w-[140px]">
          <div className="font-tech text-[8px] uppercase tracking-[0.28em] opacity-55">root</div>
          <div className="text-[12.5px] font-semibold tracking-tight mt-0.5">Orchestrator</div>
        </div>
      </div>
    );
  }
  return (
    <div className="absolute -translate-x-1/2 -translate-y-1/2 transition-opacity duration-300" style={{ left: pos.x, top: pos.y, width: 158, opacity: on ? 1 : 0.28 }}>
      <div className={`relative bg-white dark:bg-[#0f172a] border ${isNew ? 'border-slate-400 dark:border-slate-500' : 'border-slate-200 dark:border-slate-800'}`}>
        {role.accent && <span className="absolute left-0 inset-y-0 w-[2px] bg-red-500" />}
        <div className="px-2.5 py-2">
          <div className="flex items-baseline justify-between">
            <span className={`font-tech text-[8px] uppercase tracking-[0.18em] ${role.accent ? 'text-red-600 dark:text-red-400' : 'text-slate-400 dark:text-slate-500'}`}>{role.tag}</span>
            <span className="font-tech text-[8px] text-slate-300 dark:text-slate-600">t{a.at}</span>
          </div>
          <div className="text-[12.5px] font-semibold text-slate-800 dark:text-slate-100 leading-tight tracking-tight">{a.name}</div>
          <div className="text-[9.5px] text-slate-400 dark:text-slate-500 leading-snug mt-0.5 truncate">{a.summary}</div>
        </div>
      </div>
    </div>
  );
}

function Radial({ t, agents = PENNY_AGENTS }) {
  const ref = useRef(null);
  const [d, setD] = useState({ w: 800, h: 520 });
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver((e) => { const r = e[0]?.contentRect; if (r) setD({ w: r.width, h: r.height }); });
    ro.observe(el); return () => ro.disconnect();
  }, []);

  const placed = useMemo(() => {
    const cx = d.w / 2, cy = d.h / 2;
    const root = agents.find((a) => a.role === 'orchestrator') || agents[0];
    const others = agents.filter((a) => a !== root).slice().sort((a, b) => (a.at || 0) - (b.at || 0));
    const pos = {};
    if (root) pos[root.id] = { x: cx, y: cy };
    // Two elliptical rings that use the full (wide) card so 20 nodes get room.
    // Inner ring is the smaller half; outer ring is offset half a slot so the
    // two rings interleave instead of lining up radially.
    const rings = [
      { rx: d.w * 0.21, ry: d.h * 0.28, off: 0 },
      { rx: d.w * 0.40, ry: d.h * 0.46, off: 0.5 },
    ];
    const innerCount = Math.min(others.length, Math.ceil(others.length * 0.42));
    const groups = [others.slice(0, innerCount), others.slice(innerCount)];
    groups.forEach((grp, ri) => {
      const ring = rings[ri] || rings[rings.length - 1];
      grp.forEach((a, i) => {
        const th = -Math.PI / 2 + ((i + ring.off) / grp.length) * Math.PI * 2;
        pos[a.id] = { x: cx + Math.cos(th) * ring.rx, y: cy + Math.sin(th) * ring.ry };
      });
    });
    return { pos, rootId: root && root.id, list: agents.map((a) => ({ a, depth: a === root ? 0 : 1 })) };
  }, [d, agents]);

  return (
    <div ref={ref} className="relative w-full" style={{ height: 680 }}>
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        {placed.list.filter(({ a }) => a.id !== placed.rootId && a.at <= t).map(({ a }) => {
          const p = placed.pos[placed.rootId], c = placed.pos[a.id]; if (!p || !c) return null;
          return <line key={a.id} x1={p.x} y1={p.y} x2={c.x} y2={c.y} stroke="rgba(100,116,139,0.22)" strokeWidth="1" />;
        })}
      </svg>
      {placed.list.map(({ a }) => <Node key={a.id} a={a} pos={placed.pos[a.id]} on={a.at <= t} isNew={a.at === t} />)}
    </div>
  );
}

export function AgentsPage({ live = true, summary = null }) {
  // Per-run swarm with fallback to the Penny (default) agents.
  const AGENTS = summary?.swarmAgents ?? PENNY_AGENTS;
  const maxAt = useMemo(() => Math.max(...AGENTS.map((a) => a.at)), [AGENTS]);
  const pb = usePlayback(maxAt, { startAtEnd: true });
  const spawned = AGENTS.filter((a) => a.at <= pb.t).length;
  const attackers = AGENTS.filter((a) => a.role === 'attacker').length;

  if (live) {
    return (
      <div>
        <p className="text-[13px] text-slate-500 dark:text-slate-400 mb-3">Orchestrator on standby — no agents spawned yet.</p>
        <div className="border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/40 grid place-items-center" style={{ height: 520 }}>
          <div className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-2.5 text-center w-[140px]">
            <div className="font-tech text-[8px] uppercase tracking-[0.28em] opacity-55">root</div>
            <div className="text-[12.5px] font-semibold tracking-tight mt-0.5">Orchestrator</div>
            <div className="font-tech text-[8px] uppercase tracking-widest opacity-55 mt-1">standby</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <p className="text-[13px] text-slate-500 dark:text-slate-400">{AGENTS.length} agents diverging from the orchestrator</p>
        <span className="font-tech text-[10px] text-slate-400 dark:text-slate-500 inline-flex items-center gap-1.5"><span className="inline-block w-[2px] h-3 bg-red-500 align-middle" /> attacker · {attackers}</span>
      </div>
      <div className="border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/40 overflow-hidden">
        <Radial t={pb.t} agents={AGENTS} />
        <div className="border-t border-slate-200 dark:border-slate-800 py-2 px-2"><Playback pb={pb} label={(tt) => `${spawned} agent${spawned === 1 ? '' : 's'} · t${tt}/${pb.max}`} /></div>
      </div>
    </div>
  );
}
