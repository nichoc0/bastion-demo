import { useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

// Prop-driven port of staging.demo's knowledge-graph view. Takes `triples`
// ({h,r,t,source}) and renders the same force-directed graph: fill = entity
// type, ring = provenance, click a node for its facts. Used by both Graph
// modes (Global = FalkorDB, Assessment = the progressive run).

const COLOR_BY_TYPE = {
  Endpoint: '#2563eb',
  Finding: '#dc2626',
  Reveal: '#06b6d4',
  Technique: '#a855f7',
  TechniqueFamily: '#7c3aed',
  Tool: '#16a34a',
  OWASP: '#4f46e5',
  OWASPClass: '#4f46e5',
  ASIClass: '#4f46e5',
  CWE: '#f97316',
  StrategicLesson: '#0d9488',
  NextAction: '#d97706',
  CompetingObjective: '#ec4899',
  Engagement: '#1e3a8a',
  Vendor: '#64748b',
  Target: '#475569',
  Entity: '#94a3b8',
  Episodic: '#cbd5e1',
};
const typeOf = (n) => { const i = String(n || '').indexOf(':'); return i > 0 ? n.slice(0, i) : 'Unknown'; };
const labelOf = (n) => { const i = String(n || '').indexOf(':'); return i > 0 ? n.slice(i + 1) : String(n || ''); };

const RING = { finding: '#dc2626', log: '#1d4ed8', cortex: '#64748b', live: '#0d9488' };

export default function GraphCanvas({ triples = [], latestKey = null, emptyHint = 'Nothing yet.' }) {
  const containerRef = useRef(null);
  const fgRef = useRef(null);
  const [dims, setDims] = useState({ w: 600, h: 400 });
  const [selected, setSelected] = useState(null);
  const [filterTypes, setFilterTypes] = useState(new Set());

  const graph = useMemo(() => {
    const nodes = new Map();
    const links = [];
    const active = filterTypes.size > 0;
    const ensure = (id, ty, src) => { if (!nodes.has(id)) nodes.set(id, { id, type: ty, label: labelOf(id), source: src }); };
    for (const t of triples) {
      const ht = typeOf(t.h), tt = typeOf(t.t);
      // a filter shows ONLY nodes of the selected type(s); an edge survives
      // only when both of its endpoints are kept (so filtering "Tool" can't
      // drag in the Finding it points at).
      const hOk = !active || filterTypes.has(ht);
      const tOk = !active || filterTypes.has(tt);
      if (hOk) ensure(t.h, ht, t.source);
      if (tOk) ensure(t.t, tt, t.source);
      if (hOk && tOk) links.push({ source: t.h, target: t.t, relation: t.r });
    }
    return { nodes: [...nodes.values()], links };
  }, [triples, filterTypes]);

  const typesInData = useMemo(() => {
    const c = {};
    for (const t of triples) { c[typeOf(t.h)] = (c[typeOf(t.h)] || 0) + 1; c[typeOf(t.t)] = (c[typeOf(t.t)] || 0) + 1; }
    return Object.entries(c).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).map(([k]) => k);
  }, [triples]);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((e) => { const r = e[0]?.contentRect; if (r) setDims({ w: r.width, h: r.height }); });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!fgRef.current) return;
    fgRef.current.d3Force?.('charge')?.strength(-150);
    fgRef.current.d3Force?.('link')?.distance(46);
    fgRef.current.d3ReheatSimulation?.();
  }, [graph.nodes.length]);

  const toggleType = (ty) => setFilterTypes((p) => { const n = new Set(p); n.has(ty) ? n.delete(ty) : n.add(ty); return n; });
  const detail = useMemo(() => (selected ? triples.filter((t) => t.h === selected.id || t.t === selected.id) : []), [selected, triples]);

  return (
    <div className="h-full flex flex-col">
      {/* type filter row */}
      <div className="shrink-0 flex flex-wrap items-center gap-1.5 px-3 py-2 border-b border-slate-200 dark:border-slate-800">
        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500 mr-1">Filter</span>
        {typesInData.map((ty) => {
          const active = filterTypes.has(ty);
          return (
            <button key={ty} onClick={() => toggleType(ty)}
              className={`text-[10px] font-medium px-2 py-0.5 border rounded-none transition-colors cursor-pointer inline-flex items-center gap-1.5 ${active ? 'border-slate-700 dark:border-slate-200 text-slate-900 dark:text-slate-100' : 'border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-slate-400'}`}
              style={active ? undefined : { boxShadow: `inset 3px 0 0 ${COLOR_BY_TYPE[ty] || '#94a3b8'}` }}>
              {ty}
            </button>
          );
        })}
        {filterTypes.size > 0 && (
          <button onClick={() => setFilterTypes(new Set())} className="text-[10px] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 underline ml-1 cursor-pointer">clear</button>
        )}
        <span className="ml-auto text-[10px] font-mono text-slate-400 dark:text-slate-500">{graph.nodes.length} nodes · {graph.links.length} edges</span>
      </div>

      <div className="flex-1 min-h-0 flex">
        <div ref={containerRef} className="flex-1 min-w-0 relative bg-slate-50/40 dark:bg-slate-950/40">
          {graph.nodes.length > 0 ? (
            <ForceGraph2D
              ref={fgRef}
              graphData={graph}
              width={dims.w}
              height={dims.h}
              backgroundColor="rgba(0,0,0,0)"
              nodeLabel={(n) => `${n.type}: ${n.label}`}
              linkColor={() => 'rgba(100,116,139,0.25)'}
              linkDirectionalArrowLength={3}
              linkDirectionalArrowRelPos={0.95}
              cooldownTicks={140}
              onNodeClick={(n) => setSelected(n)}
              nodeCanvasObject={(node, ctx) => {
                const fill = COLOR_BY_TYPE[node.type] || '#94a3b8';
                const isNew = latestKey && node.id === latestKey;
                const r = node.type === 'Finding' ? 6 : 5;
                if (isNew) { ctx.beginPath(); ctx.fillStyle = `${fill}33`; ctx.arc(node.x, node.y, r + 7, 0, 2 * Math.PI); ctx.fill(); }
                ctx.beginPath(); ctx.fillStyle = `${fill}22`; ctx.arc(node.x, node.y, r + 3, 0, 2 * Math.PI); ctx.fill();
                ctx.beginPath(); ctx.fillStyle = fill; ctx.arc(node.x, node.y, r, 0, 2 * Math.PI); ctx.fill();
                ctx.lineWidth = 1.5; ctx.strokeStyle = RING[node.source] || 'rgba(255,255,255,0.9)'; ctx.stroke();
              }}
              nodePointerAreaPaint={(node, color, ctx) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(node.x, node.y, 9, 0, 2 * Math.PI); ctx.fill(); }}
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-[12px] text-slate-400 dark:text-slate-500 px-6 text-center">{emptyHint}</div>
          )}
        </div>

        {/* side panel */}
        <aside className="w-[280px] shrink-0 border-l border-slate-200 dark:border-slate-800 overflow-y-auto bg-white dark:bg-[#0f172a]">
          {selected ? (
            <div className="p-4 space-y-3">
              <div>
                <div className="text-[10px] font-medium uppercase tracking-wider mb-1" style={{ color: COLOR_BY_TYPE[selected.type] || '#94a3b8' }}>{selected.type}</div>
                <h3 className="text-[14px] font-semibold text-slate-900 dark:text-slate-100 break-words">{selected.label}</h3>
              </div>
              <div>
                <div className="text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">Connections</div>
                <ul className="space-y-1.5">
                  {detail.map((t, i) => (
                    <li key={i} className="text-[11px] font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2 break-words">
                      <span className="text-slate-500 dark:text-slate-400">{t.h === selected.id ? labelOf(t.h) : labelOf(t.h)}</span>
                      <span className="text-blue-600 dark:text-blue-400"> — {t.r} — </span>
                      <span className="text-slate-500 dark:text-slate-400">{labelOf(t.t)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="p-4 text-[12px] text-slate-400 dark:text-slate-500">Click a node to see its connections.</div>
          )}
        </aside>
      </div>
    </div>
  );
}
