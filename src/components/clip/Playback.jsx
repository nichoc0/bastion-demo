import { Play, Pause, ArrowCounterClockwise } from '@phosphor-icons/react';

// Shared playback bar: play/pause + scrubber + step counter. Drives any
// `at`-bound timeline (agent spawns, graph nodes). Neutral, staging-styled.
export default function Playback({ pb, label }) {
  const { t, setT, max, playing, toggle, restart } = pb;
  return (
    <div className="flex items-center gap-3 px-1">
      <button
        onClick={toggle}
        className="grid place-items-center w-7 h-7 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-500 cursor-pointer transition-colors"
        title={playing ? 'pause' : t >= max ? 'replay' : 'play'}
      >
        {playing ? <Pause size={13} weight="fill" /> : <Play size={13} weight="fill" />}
      </button>
      <button
        onClick={restart}
        className="grid place-items-center w-7 h-7 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer transition-colors"
        title="restart"
      >
        <ArrowCounterClockwise size={13} weight="bold" />
      </button>
      <input
        type="range"
        min={0}
        max={max}
        value={t}
        onChange={(e) => setT(Number(e.target.value))}
        className="flex-1 accent-slate-700 dark:accent-slate-300 cursor-pointer"
      />
      <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500 tabular-nums shrink-0 w-[120px] text-right">
        {label ? label(t) : `${t} / ${max}`}
      </span>
    </div>
  );
}
