import { useEffect, useState } from 'react';
import { ArrowsClockwise } from '@phosphor-icons/react';
import { fetchLeaderboard } from './arenaClient';

// Standings. Table styling follows PostureReportView — bordered, uppercase
// micro-headers, tabular numerals in the right-aligned columns.

export default function Standings({ challenges }) {
  const [data, setData] = useState({ status: 'loading' });

  const load = () => {
    fetchLeaderboard()
      .then((r) => setData({ status: 'ready', ...r }))
      .catch((e) => setData({ status: 'error', error: String(e.message || e) }));
  };

  useEffect(load, []);

  const dotFor = (id) => challenges.find((c) => c.id === id)?.dot || '#94a3b8';

  return (
    <div>
      {/* No section heading — the tab above already says Standings. */}
      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-[12px] text-slate-400 dark:text-slate-500">
          each objective scores once per player · ties break on fewest turns
        </span>
        <button
          onClick={load}
          className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer bg-transparent border-0 p-0"
        >
          <ArrowsClockwise size={12} weight="bold" /> Refresh
        </button>
      </div>

      {data.status === 'loading' && (
        <div className="text-[12px] text-slate-400 dark:text-slate-500">Loading standings…</div>
      )}

      {data.status === 'error' && (
        <div className="text-[12px] text-slate-500 dark:text-slate-400">{data.error}</div>
      )}

      {data.status === 'ready' && (
        <>
          {!data.leaderboard.length ? (
            <div className="max-w-[420px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a] px-4 py-3">
              <p className="text-[12px] text-slate-400 dark:text-slate-500">
                Nothing has been broken yet.
              </p>
            </div>
          ) : (
            <table className="w-full text-sm border border-slate-300 dark:border-slate-700 border-collapse">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-widest text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-900">
                  <th className="px-3 py-2 font-semibold border-b border-slate-300 dark:border-slate-700 w-[52px]">#</th>
                  <th className="px-3 py-2 font-semibold border-b border-slate-300 dark:border-slate-700">Player</th>
                  <th className="px-3 py-2 font-semibold border-b border-slate-300 dark:border-slate-700 text-right">Targets</th>
                  <th className="px-3 py-2 font-semibold border-b border-slate-300 dark:border-slate-700 text-right">Breaks</th>
                  <th className="px-3 py-2 font-semibold border-b border-slate-300 dark:border-slate-700 text-right">Turns</th>
                  <th className="px-3 py-2 font-semibold border-b border-slate-300 dark:border-slate-700 text-right">Points</th>
                </tr>
              </thead>
              <tbody>
                {data.leaderboard.map((r) => (
                  <tr key={r.player} className="border-t border-slate-200 dark:border-slate-800">
                    <td className="px-3 py-2 font-tech text-xs tabular-nums text-slate-500 dark:text-slate-400">{r.rank}</td>
                    <td className="px-3 py-2 font-semibold text-slate-800 dark:text-slate-200 text-[13px]">{r.player}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-xs text-slate-600 dark:text-slate-300">{r.challengesBroken}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-xs text-slate-600 dark:text-slate-300">{r.breaks}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-xs text-slate-600 dark:text-slate-300">{r.turns}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-xs font-semibold text-slate-800 dark:text-slate-200">{r.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {data.recent?.length > 0 && (
            <div className="mt-7">
              <h3 className="text-[13px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">
                Recent breaks
              </h3>
              <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a]">
                {data.recent.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center gap-2 px-3 py-1.5 border-b border-slate-100 dark:border-slate-800/60 last:border-b-0"
                  >
                    <span className="rounded-full shrink-0" style={{ width: 6, height: 6, background: dotFor(b.challengeId) }} />
                    <span className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">{b.player}</span>
                    <span className="text-[12px] text-slate-400 dark:text-slate-500">broke</span>
                    <span className="text-[12px] text-slate-600 dark:text-slate-300">{b.challengeName}</span>
                    <span className="ml-auto font-tech text-[10px] tabular-nums text-slate-400 dark:text-slate-500">
                      {b.turns} turns · +{b.points}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
