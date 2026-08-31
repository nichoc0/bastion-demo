import { useState, useMemo } from 'react';
import { UploadSimple, CheckCircle } from '@phosphor-icons/react';
import GraphCanvas from './GraphCanvas';
import Playback from './Playback';
import { useGlobalGraph } from '../../data/useGraph';
import { usePlayback } from '../../data/usePlayback';
import { PENNY_EVENTS } from '../../data/pennyAssessment';

// Two modes, toggle framed top-right:
//   Global     — the live FalkorDB cortex.
//   Assessment — this run's graph. Current Runs: empty. Past Runs: the completed
//                run with the SAME playback scrubber as the Agents tab (same `at`
//                clock), so you can replay the graph assembling. Important nodes
//                feed back into FalkorDB.
export function GraphPage({ live = true, summary = null }) {
  // Per-run event stream with fallback to the Penny (default) events.
  const EVENTS = summary?.events ?? PENNY_EVENTS;
  const [mode, setMode] = useState('assessment');
  const [committed, setCommitted] = useState(null);
  const global = useGlobalGraph();
  const pb = usePlayback(EVENTS.length, { startAtEnd: true });

  // assessment triples revealed up to the playback cursor (empty on a live/no run)
  const revealed = live ? [] : EVENTS.slice(0, pb.t);
  const triples = useMemo(
    () => revealed.filter((e) => e.parent).map((e) => ({ h: e.parent, r: e.rel, t: e.node, source: 'live' })),
    [revealed],
  );
  const latestKey = pb.t > 0 && !live ? EVENTS[pb.t - 1]?.node : null;

  const commit = async () => {
    const important = revealed.filter((e) => e.important);
    const nodes = important.map((e) => ({ label: e.node.split(':').slice(1).join(':'), kind: e.kind, detail: e.detail }));
    const edges = important.filter((e) => e.parent).map((e) => ({ h: e.parent.split(':').slice(1).join(':'), r: e.rel, t: e.node.split(':').slice(1).join(':') }));
    try {
      const res = await fetch('/api/graph/commit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nodes, edges }) });
      const d = await res.json();
      setCommitted(d.error ? { error: d.error } : { merged: d.merged });
    } catch (e) { setCommitted({ error: e.message }); }
  };

  return (
    <div>
      <div className="flex items-start justify-between mb-3">
        <p className="text-[13px] text-slate-500 dark:text-slate-400 max-w-[460px]">
          {mode === 'global'
            ? global.loading ? 'Loading the FalkorDB cortex…' : `${global.triples.length} relations across the cortex.`
            : live ? 'No active run. Nothing is being assessed right now.'
              : `Assessment. ${EVENTS.length} events. Scrub to replay the graph assembling.`}
        </p>
        <div className="inline-flex items-stretch border border-slate-300 dark:border-slate-700 rounded-none overflow-hidden shrink-0">
          {['global', 'assessment'].map((m) => (
            <button key={m} onClick={() => setMode(m)}
              className={`px-3 py-1.5 text-[11px] font-medium capitalize transition-colors cursor-pointer ${m === 'assessment' ? 'border-l border-slate-300 dark:border-slate-700' : ''} ${mode === m ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}>
              {m === 'global' ? 'Global · FalkorDB' : 'Assessment'}
            </button>
          ))}
        </div>
      </div>

      <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a]" style={{ height: 560 }}>
        {mode === 'global' ? (
          <GraphCanvas triples={global.triples} emptyHint={global.error ? `Couldn't read FalkorDB (${global.error})` : 'Cortex is empty.'} />
        ) : (
          <GraphCanvas triples={triples} latestKey={latestKey}
            emptyHint={live ? 'No run in progress. Start an assessment to watch its graph build here.' : 'This run produced no graph.'} />
        )}
      </div>

      {/* assessment past-run: playback scrubber + feed-to-cortex */}
      {mode === 'assessment' && !live && (
        <div className="mt-3 space-y-2">
          <Playback pb={pb} label={(t) => `${triples.length} edges · step ${t}/${pb.max}`} />
          <div className="flex items-center justify-end">
            {committed ? (
              <span className="inline-flex items-center gap-1.5 text-[12px] text-slate-600 dark:text-slate-300">
                <CheckCircle size={14} weight="fill" className="text-slate-500" />
                {committed.error ? `commit failed: ${committed.error}` : `fed ${committed.merged} findings into the cortex`}
              </span>
            ) : (
              <button onClick={commit}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-slate-500 rounded-none cursor-pointer transition-colors"
                title="MERGE the important findings into FalkorDB">
                <UploadSimple size={13} weight="bold" /> Feed findings into cortex
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
