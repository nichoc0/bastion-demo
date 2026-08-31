import { ArrowRight } from '@phosphor-icons/react';
import { Mark, DifficultyMeter, channelOf } from './ArenaArt';

// The range roster. Each row is a situation you're about to walk into, not a
// spec sheet: who you're talking to, where, and why you're there.
//
// Deliberately monochrome — the marks render grey and no brand colour appears
// anywhere on this page. Colour is what you get when you step inside a target.

export default function TargetBoard({ challenges, onOpen }) {
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-3">
        <h2 className="text-[13px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
          Targets
        </h2>
        <span className="text-[12px] text-slate-400 dark:text-slate-500">
          five agents doing real jobs at companies that don&apos;t exist
        </span>
      </div>

      <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a]">
        {challenges.map((c) => (
          <ScenarioRow key={c.id} c={c} onOpen={() => onOpen(c.id)} />
        ))}
      </div>
    </div>
  );
}

function ScenarioRow({ c, onOpen }) {
  const channel = channelOf(c.channel);
  const ChannelIcon = channel.icon;

  return (
    <button
      onClick={onOpen}
      className="group w-full text-left flex items-start gap-4 px-4 py-4 border-b border-slate-100 dark:border-slate-800/60 last:border-b-0 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
    >
      {/* company mark — grey here, lit only inside the target */}
      <span className="shrink-0 w-11 h-11 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">
        <Mark name={c.mark} size={22} />
      </span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[14px] font-bold tracking-tight text-slate-900 dark:text-white">
            {c.agent}
          </span>
          <span className="text-[12.5px] text-slate-500 dark:text-slate-400">{c.company}</span>
          <span className="inline-flex items-center gap-1 border border-slate-200 dark:border-slate-800 px-1.5 py-0.5 font-tech text-[9px] uppercase tracking-widest text-slate-400 dark:text-slate-500">
            <ChannelIcon size={10} weight="bold" />
            {c.channelLabel}
          </span>
        </div>

        <p className="text-[12.5px] leading-relaxed text-slate-600 dark:text-slate-300 mt-1.5 max-w-[620px]">
          {c.scenario}
        </p>

        <div className="flex items-center gap-x-4 gap-y-1 flex-wrap mt-2">
          {c.objectives.map((o) => (
            <span key={o.id} className="flex items-baseline gap-1.5">
              <span className="text-[11.5px] text-slate-500 dark:text-slate-400">{o.label}</span>
              <span className="font-tech text-[10px] tabular-nums text-slate-400 dark:text-slate-500">
                {o.points}
              </span>
            </span>
          ))}
        </div>
      </div>

      <div className="shrink-0 flex flex-col items-end gap-2 pl-2">
        <span className="font-tech text-[15px] font-semibold tabular-nums text-slate-700 dark:text-slate-200 leading-none">
          {c.maxPoints}
        </span>
        <span className="flex items-center gap-1.5">
          <DifficultyMeter level={c.difficulty} />
          <span className="font-tech text-[9px] uppercase tracking-widest text-slate-400 dark:text-slate-500">
            {c.difficulty}
          </span>
        </span>
        <span className="mt-1 inline-flex items-center gap-1.5 px-3 h-8 text-[10px] font-bold uppercase tracking-widest border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 group-hover:border-blue-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          Engage
          <ArrowRight size={11} weight="bold" />
        </span>
      </div>
    </button>
  );
}
