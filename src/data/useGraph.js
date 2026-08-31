import { useEffect, useState } from 'react';
import { PENNY_EVENTS } from './pennyAssessment';

// Global mode — the FalkorDB cortex. Tries the live runner first (/api/graph);
// when that errors or comes back empty (no FalkorDB linked, e.g. the static
// demo deploy), falls back to the bundled cortex snapshot so the graph is
// always populated. The snapshot ships in public/static-api/ and is served
// directly by both vite dev and Vercel.
const SNAPSHOT_URL = `${(import.meta.env.BASE_URL || '/').replace(/\/$/, '')}/static-api/kg-triples.json`;

export function useGlobalGraph() {
  const [state, setState] = useState({ triples: [], loading: true, error: null });
  useEffect(() => {
    let cancelled = false;
    const loadSnapshot = () =>
      fetch(SNAPSHOT_URL, { cache: 'no-store' })
        .then((r) => r.json())
        .then((d) => { if (!cancelled) setState({ triples: d.triples || [], loading: false, error: null }); })
        .catch((e) => { if (!cancelled) setState({ triples: [], loading: false, error: e.message }); });

    fetch('/api/graph', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => {
        if (cancelled) return undefined;
        const triples = d.triples || [];
        if (triples.length > 0) { setState({ triples, loading: false, error: null }); return undefined; }
        return loadSnapshot(); // live cortex empty → show the bundled snapshot
      })
      .catch(() => { if (!cancelled) return loadSnapshot(); });
    return () => { cancelled = true; };
  }, []);
  return state;
}

// Assessment mode.
//   live  (Current Runs) — nothing is running, so the graph is empty.
//   !live (Past Runs)    — a completed assessment, fully loaded and static.
// Every node stays bound to its source event (PENNY_EVENTS), so a step-through
// "replay" control can be added later without changing the data model.
// `commit()` feeds the important findings back into FalkorDB.
export function useAssessment({ live = true } = {}) {
  const [committed, setCommitted] = useState(null);

  // Current = empty; Past = the full completed run.
  const emitted = live ? [] : PENNY_EVENTS;
  const triples = emitted
    .filter((e) => e.parent)
    .map((e) => ({ h: e.parent, r: e.rel, t: e.node, source: 'live' }));
  const empty = emitted.length === 0;
  const done = !empty;

  const commit = async () => {
    const important = emitted.filter((e) => e.important);
    const nodes = important.map((e) => ({ label: e.node.split(':').slice(1).join(':'), kind: e.kind, detail: e.detail }));
    const edges = important.filter((e) => e.parent).map((e) => ({ h: e.parent.split(':').slice(1).join(':'), r: e.rel, t: e.node.split(':').slice(1).join(':') }));
    try {
      const res = await fetch('/api/graph/commit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nodes, edges }) });
      const d = await res.json();
      setCommitted(d.error ? { error: d.error } : { merged: d.merged, linked: d.linked });
    } catch (e) {
      setCommitted({ error: e.message });
    }
  };

  return { triples, emitted, empty, done, total: PENNY_EVENTS.length, committed, commit };
}
