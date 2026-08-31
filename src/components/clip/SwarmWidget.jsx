import { useEffect, useRef, useState } from 'react';
import { Pause, Plus, ArrowUUpLeft, ArrowBendUpRight } from '@phosphor-icons/react';
import { usePlayback } from '../../data/usePlayback';
import Playback from './Playback';
import AgentChat from './AgentChat';

// Swarm — the boids. The canvas shows ONLY two things: the boids and the found
// nodes (endpoints discovered so far). No base, no lattice, no chrome.
//   Current Runs, no active run: empty + still.
//   Current Runs, a run active: commandable swarm (redirect / stop / spawn /
//     recall-think) over the discovered nodes.
//   Past Runs: faithful replay — nodes appear as they were found and the swarm
//     retraces exactly where it went, on the shared playback clock.

const DEFAULT_TARGETS = [
  { id: 'terms-chat',      label: 'terms-chat' },
  { id: 'getOfferDetails', label: 'getOfferDetails' },
  { id: 'genai-svc',       label: 'genai-svc realtime' },
  { id: 'maps-key',        label: 'maps key (APK)' },
];
// Campaign length is fixed per campaign (a realistic autonomous run is ~120-160
// agent turns, not 16). Static, not re-rolled per render. The Priceline campaign
// ran 142 turns; events land on the real Penny endpoints and the swarm explores
// the turns in between.
const DEFAULT_CAMPAIGN_TURNS = 142;
const DEFAULT_PATH = [
  { at: 4,   target: 'terms-chat',      leaked: false },  // scoped sub-bot found in recon
  { at: 26,  target: 'getOfferDetails', leaked: true },   // GraphQL BOLA
  { at: 62,  target: 'genai-svc',       leaked: true },   // unauth realtime + forged token + injection
  { at: 90,  target: 'terms-chat',      leaked: true },   // verbatim system-prompt extraction
  { at: 140, target: 'maps-key',        leaked: true },   // unrestricted Google Maps key in the APK
];

function SwarmCanvas({ ctrl, interact, targets = DEFAULT_TARGETS }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const S = useRef({ boids: [], nodes: new Map(), center: { x: 0, y: 0 }, dims: null, selected: null });

  useEffect(() => {
    const canvas = canvasRef.current; const ctx = canvas.getContext('2d'); const st = S.current;
    let raf; const dpr = Math.min(window.devicePixelRatio || 1, 2); const rand = (a, b) => a + Math.random() * (b - a);
    const ro = new ResizeObserver((e) => {
      const r = e[0]?.contentRect; if (!r) return;
      canvas.width = r.width * dpr; canvas.height = r.height * dpr; canvas.style.width = `${r.width}px`; canvas.style.height = `${r.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); st.dims = { w: r.width, h: r.height }; st.center = { x: r.width / 2, y: r.height / 2 };
      targets.forEach((t, i) => { const ang = (i / targets.length) * Math.PI * 2 - Math.PI / 2; const rad = Math.min(r.width, r.height) * 0.3; st.nodes.set(t.id, { x: r.width / 2 + Math.cos(ang) * rad, y: r.height / 2 + Math.sin(ang) * rad, label: t.label }); });
    });
    ro.observe(wrapRef.current);

    // Redirect interaction. Live mode: click a node to send the whole swarm.
    // Replay (divide) mode: click a SPECIFIC agent, then a SPECIFIC node, to
    // redirect that one agent (it pins to that node, overriding reassignment).
    const pickNode = (x, y) => { let best = null, bd = 70; st.nodes.forEach((n, id) => { if (!ctrl.current.found?.has(id)) return; const dd = Math.hypot(n.x - x, n.y - y); if (dd < bd) { bd = dd; best = id; } }); return best; };
    const onClick = (e) => {
      const it = interact?.current; if (!it || !it.redirecting) return;
      const rect = canvas.getBoundingClientRect(); const x = e.clientX - rect.left, y = e.clientY - rect.top;
      if (it.live) { const id = pickNode(x, y); if (id) it.onPickNode(id); return; }
      if (st.selected == null) {
        let best = -1, bd = 22 * 22;
        st.boids.forEach((b, i) => { const d2 = (b.x - x) ** 2 + (b.y - y) ** 2; if (d2 < bd) { bd = d2; best = i; } });
        if (best >= 0) st.selected = best;
      } else {
        const id = pickNode(x, y);
        if (id != null) { const b = st.boids[st.selected]; if (b) { b.tid = id; b.pinned = true; } st.selected = null; it.onAgentDone(); }
        else { st.selected = null; }   // click empty space cancels the selection
      }
    };
    canvas.addEventListener('click', onClick);

    const step = () => {
      const d = st.dims; if (!d) { raf = requestAnimationFrame(step); return; }
      const { w, h } = d; const c = ctrl.current; ctx.clearRect(0, 0, w, h);
      if (!interact?.current?.redirecting) st.selected = null;   // drop selection when not redirecting
      while (st.boids.length < c.count) st.boids.push({ x: st.center.x + rand(-30, 30), y: st.center.y + rand(-30, 30), vx: rand(-1, 1), vy: rand(-1, 1) });
      st.boids.length = Math.min(st.boids.length, c.count);
      // Single-seek (live attack / recall-to-center) vs divide-and-conquer
      // (replay): in divide mode each boid is assigned its own found target so
      // the swarm splits into small groups probing every target in parallel,
      // with the current frontier getting a heavier share.
      const seekCenter = c.seekId === 'center' ? st.center : null;
      const singleSeek = (!c.divide && c.seekId && c.seekId !== 'center' && st.nodes.has(c.seekId)) ? st.nodes.get(c.seekId) : null;
      const targetIds = (c.divide && c.found) ? [...c.found].filter((id) => st.nodes.has(id)) : [];
      let pool = null;
      if (targetIds.length) { pool = []; targetIds.forEach((id) => { pool.push(id); if (id === c.seekId) { pool.push(id, id); } }); }
      const N = st.boids.length;
      // Reassign which boid swarms which target ONLY when a new node is found
      // (or the frontier changes). Between discoveries the assignment is stable,
      // so each group settles and stays on its target instead of drifting.
      if (pool) {
        const sig = `${targetIds.join(',')}|${c.seekId}`;
        if (st.divideSig !== sig) { st.divideSig = sig; for (let i = 0; i < N; i++) if (!st.boids[i].pinned) st.boids[i].tid = pool[i % pool.length]; }
      } else { st.divideSig = null; }
      for (let a = 0; a < N; a++) {
        const b = st.boids[a]; let ax = 0, ay = 0, cxs = 0, cys = 0, sx = 0, sy = 0, k = 0;
        for (let cc = 0; cc < N; cc++) { if (cc === a) continue; const dx = st.boids[cc].x - b.x, dy = st.boids[cc].y - b.y, d2 = dx * dx + dy * dy; if (d2 < 40 * 40 && d2 > 0.001) { ax += st.boids[cc].vx; ay += st.boids[cc].vy; cxs += st.boids[cc].x; cys += st.boids[cc].y; if (d2 < 240) { sx -= dx / d2 * 36; sy -= dy / d2 * 36; } k++; } }
        let seek = seekCenter || singleSeek;
        if (pool) {
          if ((!b.tid || !c.found.has(b.tid)) && !b.pinned) b.tid = pool[a % pool.length];
          seek = st.nodes.get(b.tid);
        }

        if (pool) {
          // DIVIDE: travel to the assigned node, then settle into a near-static
          // halo over it. The "on-station" radius is wide enough to hold the
          // whole cluster, so once arrived they damp to a hover instead of
          // orbiting forever. Light separation stops them stacking to one dot.
          if (k) { b.vx += sx * 0.012; b.vy += sy * 0.012; }
          if (seek) {
            const dx = seek.x - b.x, dy = seek.y - b.y, dist = Math.hypot(dx, dy) || 1;
            if (dist > 42) {                                         // in transit → drift in, unhurried
              const spd = 0.8;
              b.vx += (dx / dist * spd - b.vx) * 0.06;
              b.vy += (dy / dist * spd - b.vy) * 0.06;
            } else {                                                 // on station → park as a loose halo
              b.vx += dx / dist * 0.05; b.vy += dy / dist * 0.05;    // gentle tether keeps the cluster centered
              b.vx *= 0.82; b.vy *= 0.82;                            // damp to a near-stop
            }
          }
          b.vx += (Math.random() - 0.5) * 0.022;                     // faint shimmer, not flight
          b.vy += (Math.random() - 0.5) * 0.022;
          const sp = Math.hypot(b.vx, b.vy); if (sp > 0.95) { b.vx = b.vx / sp * 0.95; b.vy = b.vy / sp * 0.95; }
        } else {
          // LIVE flocking (attack / recall) — unchanged.
          if (k) { b.vx += (ax / k - b.vx) * 0.03; b.vy += (ay / k - b.vy) * 0.03; const coh = c.regroup ? 0.006 : 0.0009; b.vx += (cxs / k - b.x) * coh; b.vy += (cys / k - b.y) * coh; b.vx += sx * 0.02; b.vy += sy * 0.02; }
          if (seek) { const dx = seek.x - b.x, dy = seek.y - b.y, dist = Math.hypot(dx, dy) || 1; const g = c.regroup ? 0.16 : 0.11; b.vx += (dx / dist) * g; b.vy += (dy / dist) * g; }
          const sp = Math.hypot(b.vx, b.vy), max = c.idle ? 1.2 : 2.4; if (sp > max) { b.vx = b.vx / sp * max; b.vy = b.vy / sp * max; }
        }
        b.x += b.vx; b.y += b.vy; if (b.x < 0) b.x += w; if (b.x > w) b.x -= w; if (b.y < 0) b.y += h; if (b.y > h) b.y -= h;
        const ang = Math.atan2(b.vy, b.vx); ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(ang); ctx.fillStyle = b.pinned ? 'rgba(15,23,42,0.9)' : 'rgba(37,99,235,0.82)'; ctx.beginPath(); ctx.moveTo(5, 0); ctx.lineTo(-3.5, 2.4); ctx.lineTo(-3.5, -2.4); ctx.closePath(); ctx.fill(); ctx.restore();
        if (a === st.selected) { ctx.beginPath(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#0f172a'; ctx.arc(b.x, b.y, 10, 0, Math.PI * 2); ctx.stroke(); }
      }
      // ONLY the found nodes
      st.nodes.forEach((n, id) => {
        if (!c.found?.has(id)) return;
        const leaked = c.leaked?.has(id); const activeNode = id === c.seekId;
        ctx.beginPath(); ctx.fillStyle = leaked ? '#1e40af' : activeNode ? '#38bdf8' : '#94a3b8'; ctx.arc(n.x, n.y, 6, 0, Math.PI * 2); ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.stroke();
        ctx.font = '600 10px IBM Plex Mono, monospace'; ctx.fillStyle = 'rgba(71,85,105,0.85)'; ctx.textAlign = 'center'; ctx.fillText(n.label, n.x, n.y - 12);
      });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); canvas.removeEventListener('click', onClick); };
  }, [ctrl, interact, targets]);

  return <div ref={wrapRef} className="absolute inset-0"><canvas ref={canvasRef} className="absolute inset-0" /></div>;
}

// The C2 control bar — always shown so it's clear the swarm is commandable:
// redirect to another node, stop (idle), spawn more, recall and think.
function ControlBar({ count, redirecting, onRedirect, onStop, onSpawn, onRecall }) {
  const base = 'inline-flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold border rounded-md cursor-pointer transition-colors';
  const neutral = 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/40';
  return (
    <div className="mt-3 flex items-center gap-2.5 flex-wrap">
      <button onClick={onRedirect} className={`${base} ${redirecting ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white' : neutral}`}><ArrowBendUpRight size={17} weight="bold" /> Redirect</button>
      <button onClick={onStop} className={`${base} ${neutral}`}><Pause size={17} weight="bold" /> Stop</button>
      <button onClick={onSpawn} className={`${base} ${neutral}`}><Plus size={17} weight="bold" /> Spawn more</button>
      <button onClick={onRecall} className={`${base} ${neutral}`}><ArrowUUpLeft size={17} weight="bold" /> Recall &amp; think</button>
      <span className="ml-auto font-tech text-[11px] text-slate-400 dark:text-slate-500">{count} agents</span>
    </div>
  );
}

export function SwarmPage({ live = true, activeRun = null, summary = null }) {
  // Per-run replay payload with fallback to the Penny (default) constants, so
  // other runs are untouched.
  const TARGETS = summary?.swarm?.targets ?? DEFAULT_TARGETS;
  const PENNY_PATH = summary?.swarm?.path ?? DEFAULT_PATH;
  const CAMPAIGN_TURNS = summary?.swarm?.campaignTurns ?? DEFAULT_CAMPAIGN_TURNS;
  const PATH_MAX = CAMPAIGN_TURNS;

  const [mode, setMode] = useState('attacking');
  const [activeId, setActiveId] = useState(TARGETS[1]?.id ?? TARGETS[0].id);
  const [count, setCount] = useState(8);
  const [redirecting, setRedirecting] = useState(false);
  const pb = usePlayback(PATH_MAX, { startAtEnd: true, stepMs: 130 });
  const ctrl = useRef({ count: 0, seekId: null, found: new Set(), leaked: new Set(), idle: false, regroup: false });

  // Canvas redirect interaction, passed by ref so the animation loop reads it
  // without re-subscribing. Live: pick a node for the whole swarm. Replay: the
  // canvas does the two-step (pick an agent, then a node) and pins that agent.
  const interact = useRef({ redirecting: false, live: true, onPickNode: () => {}, onAgentDone: () => {} });
  interact.current.redirecting = redirecting;
  interact.current.live = live;
  interact.current.onPickNode = (id) => { setActiveId(id); setMode(live ? 'attacking' : 'redirected'); setRedirecting(false); };
  interact.current.onAgentDone = () => setRedirecting(false);

  useEffect(() => {
    if (mode !== 'recalling') return undefined;
    const id = setTimeout(() => setMode('thinking'), 2600); return () => clearTimeout(id);
  }, [mode]);

  if (!live) {
    // Past replay follows the playback clock (divide-and-conquer), but the C2
    // controls can override it live: redirect / stop / recall all command the
    // recorded swarm so judges see the harness is real, not a video.
    const reached = PENNY_PATH.filter((p) => p.at <= pb.t);
    const cur = reached[reached.length - 1];
    const found = new Set(reached.map((p) => p.target));
    const leaked = new Set(reached.filter((p) => p.leaked).map((p) => p.target));
    const n = (cur ? 16 : 0) + (count - 8);   // count starts at 8; Spawn adds on top
    if (mode === 'idle') ctrl.current = { count: n, seekId: null, found, leaked, idle: true, regroup: false, divide: false };
    else if (mode === 'recalling' || mode === 'thinking') ctrl.current = { count: n, seekId: 'center', found, leaked, idle: false, regroup: true, divide: false };
    else if (mode === 'redirected') ctrl.current = { count: n, seekId: activeId, found, leaked, idle: false, regroup: false, divide: false };
    else ctrl.current = { count: cur ? n : 0, seekId: cur?.target ?? null, found, leaked, idle: false, regroup: false, divide: true };
  } else if (!activeRun) {
    ctrl.current = { count: 0, seekId: null, found: new Set(), leaked: new Set(), idle: false, regroup: false };
  } else {
    ctrl.current = { count, seekId: mode === 'recalling' || mode === 'thinking' ? 'center' : (mode === 'attacking' ? activeId : null), found: new Set(TARGETS.map((t) => t.id)), leaked: new Set(), idle: mode === 'idle', regroup: mode === 'recalling' || mode === 'thinking' };
  }

  // PAST replay — with the C2 controls always shown and live over the replay.
  if (!live) {
    const cur = [...PENNY_PATH].filter((p) => p.at <= pb.t).pop();
    const status = redirecting ? 'click an agent, then a node, to redirect it'
      : mode === 'idle' ? 'stopped · idle, awaiting orders'
      : mode === 'recalling' ? 'recalling to base'
      : mode === 'thinking' ? 'regrouped · agents talking · spawning research'
      : mode === 'redirected' ? `redirected · ${activeId}`
      : cur ? `retracing · now at ${cur.target}` : 'retracing';
    return (
      <div>
        <p className="text-[13px] text-slate-500 dark:text-slate-400 mb-2">the swarm retraces exactly where it went. <span className="font-tech text-[12px] text-slate-600 dark:text-slate-300">{status}</span></p>
        <div className="border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/40">
          <div className="flex flex-col lg:flex-row">
            <div className={`relative flex-1 min-w-0 ${redirecting ? 'cursor-crosshair' : ''}`} style={{ height: 460 }}>
              <SwarmCanvas ctrl={ctrl} interact={interact} targets={TARGETS} />
              {mode === 'thinking' && <div className="absolute left-1/2 -translate-x-1/2 bottom-5 glass-soft px-3 py-1.5 text-[11px] text-slate-600 dark:text-slate-300 font-tech pointer-events-none">regrouping · agents talking · spawning research</div>}
            </div>
            <div className="w-full lg:w-[380px] shrink-0 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a]" style={{ height: 460 }}>
              <AgentChat t={pb.t} channels={summary?.chat?.channels} agents={summary?.chat?.agents} />
            </div>
          </div>
          <div className="border-t border-slate-200 dark:border-slate-800 py-2 px-2"><Playback pb={pb} label={(tt) => `t${tt}/${pb.max}`} /></div>
        </div>
        <ControlBar
          count={(cur ? 16 : 0) + (count - 8)}
          redirecting={redirecting}
          onRedirect={() => setRedirecting((r) => !r)}
          onStop={() => { setMode('idle'); setRedirecting(false); }}
          onSpawn={() => setCount((c) => Math.min(c + 6, 36))}
          onRecall={() => { setMode('recalling'); setRedirecting(false); }}
        />
      </div>
    );
  }

  // LIVE, no run
  if (!activeRun) {
    return (
      <div>
        <p className="text-[13px] text-slate-500 dark:text-slate-400 mb-2">No active run. The swarm is idle.</p>
        <div className="relative border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/40" style={{ height: 460 }}><SwarmCanvas ctrl={ctrl} interact={interact} targets={TARGETS} /></div>
      </div>
    );
  }

  // LIVE, commandable
  const modeLabel = { idle: 'idle · awaiting orders', attacking: `attacking · ${activeId}`, recalling: 'recalling to base', thinking: 'regrouped · agents talking' }[mode];
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[13px] text-slate-500 dark:text-slate-400">{redirecting ? 'Click a found node to send the swarm there.' : <>Swarm · <span className="font-tech text-[12px] text-slate-600 dark:text-slate-300">{modeLabel}</span></>}</p>
      </div>
      <div className={`relative border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/40 ${redirecting ? 'cursor-crosshair' : ''}`} style={{ height: 460 }}>
        <SwarmCanvas ctrl={ctrl} interact={interact} targets={TARGETS} />
        {mode === 'thinking' && <div className="absolute left-1/2 -translate-x-1/2 bottom-5 glass-soft px-3 py-1.5 text-[11px] text-slate-600 dark:text-slate-300 font-tech pointer-events-none">regrouping · agents talking · spawning research</div>}
      </div>
      <ControlBar
        count={count}
        redirecting={redirecting}
        onRedirect={() => setRedirecting((r) => !r)}
        onStop={() => { setMode('idle'); setRedirecting(false); }}
        onSpawn={() => setCount((c) => Math.min(c + 6, 36))}
        onRecall={() => { setMode('recalling'); setRedirecting(false); }}
      />
    </div>
  );
}
