import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CaretRight, ArrowBendDownRight } from '@phosphor-icons/react';
import { CHANNELS, CHAT_AGENTS } from '../../data/agentChat';

// AgentChat — the orchestrator group chat for a recorded run, on the shared
// playback clock. One main channel + collapsible side-threads that spawn when
// two agents hand off correlated work. Messages reveal as at <= t, so it scrubs
// in lockstep with the swarm. Identity = a colored dot; a leak is a quiet blue
// spine, not a badge. Mono only for timestamps.

function Dot({ id, size = 7, agents = CHAT_AGENTS }) {
  const a = agents[id] || {};
  if (a.hub) return <span className="rounded-full bg-slate-900 dark:bg-slate-100 shrink-0" style={{ width: size, height: size }} />;
  return <span className="rounded-full shrink-0" style={{ width: size, height: size, background: a.color }} />;
}

function renderText(text, agents = CHAT_AGENTS) {
  return text.split(/(@[a-z·]+)/gi).map((part, i) => {
    if (part.startsWith('@')) {
      const key = part.slice(1);
      const ag = Object.values(agents).find((a) => a.short === key);
      return <span key={i} style={{ color: ag?.color || '#64748b' }} className="font-medium">{part}</span>;
    }
    return <span key={i}>{part}</span>;
  });
}

function Message({ m, agents = CHAT_AGENTS }) {
  const a = agents[m.from] || {};
  const handoff = m.kind === 'handoff';
  return (
    <motion.div
      initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
      className={`px-3 py-1.5 ${m.leak ? 'bg-blue-50/50 dark:bg-blue-500/[0.05]' : ''}`}
      style={m.leak ? { boxShadow: 'inset 2px 0 0 #1d4ed8' } : undefined}
    >
      <div className="flex items-center gap-1.5">
        <Dot id={m.from} agents={agents} />
        <span className="text-[11.5px] font-semibold text-slate-700 dark:text-slate-200">{a.name}</span>
        {handoff && (
          <span className="inline-flex items-center gap-0.5 text-[9px] text-slate-400 dark:text-slate-500">
            <ArrowBendDownRight size={9} weight="bold" />{agents[m.to]?.short ?? m.to}
          </span>
        )}
        <span className="ml-auto font-tech text-[9px] text-slate-300 dark:text-slate-600 tabular-nums">t{m.at}</span>
      </div>
      <p className="text-[12px] leading-snug text-slate-600 dark:text-slate-300 mt-0.5 pl-[13px]">{renderText(m.text, agents)}</p>
    </motion.div>
  );
}

function Channel({ ch, t, open, onToggle, agents = CHAT_AGENTS }) {
  const shown = ch.messages.filter((m) => m.at <= t);
  const last = shown[shown.length - 1];
  const pinging = last && last.at === t && t > 0;

  return (
    <div className="border-b border-slate-100 dark:border-slate-800/60 last:border-b-0">
      <button onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors cursor-pointer">
        <motion.span animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.15 }} className="text-slate-300 dark:text-slate-600 shrink-0">
          <CaretRight size={11} weight="bold" />
        </motion.span>
        <span className={ch.kind === 'main' ? 'text-[12px] font-semibold text-slate-700 dark:text-slate-200' : 'text-[12px] text-slate-500 dark:text-slate-400'}>
          {ch.kind === 'main' ? ch.name : `#${ch.name}`}
        </span>
        <span className="flex items-center gap-1 ml-1.5 shrink-0">
          {ch.participants.map((p) => <Dot key={p} id={p} size={6} agents={agents} />)}
        </span>
        <span className="ml-auto flex items-center gap-2 shrink-0">
          {ch.cid && <span className="font-tech text-[9px] text-slate-300 dark:text-slate-600 hidden sm:inline">{ch.cid}</span>}
          {pinging && <motion.span className="w-1.5 h-1.5 rounded-full bg-blue-500" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1, repeat: Infinity }} />}
          <span className="font-tech text-[10px] text-slate-300 dark:text-slate-600 tabular-nums">{shown.length}</span>
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && shown.length > 0 && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="pb-1">
              {shown.map((m, i) => <Message key={i} m={m} agents={agents} />)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function AgentChat({ t, channels, agents }) {
  // Per-run channels/agents with fallback to the imported Penny defaults, so
  // other runs are untouched.
  const CH = channels ?? CHANNELS;
  const AG = agents ?? CHAT_AGENTS;
  const [open, setOpen] = useState({ main: true });
  const scrollRef = useRef(null);

  // auto-expand a channel the moment a message lands in it (threads pop open as
  // hand-offs happen). Manual collapse sticks until the next message.
  useEffect(() => {
    setOpen((prev) => {
      let next = prev;
      for (const ch of CH) {
        if (ch.messages.some((m) => m.at === t) && !prev[ch.id]) {
          if (next === prev) next = { ...prev };
          next[ch.id] = true;
        }
      }
      return next;
    });
  }, [t, CH]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [t, open]);

  const total = CH.reduce((n, ch) => n + ch.messages.filter((m) => m.at <= t).length, 0);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 h-9 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <span className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">Agent chat</span>
        <span className="ml-auto font-tech text-[10px] text-slate-300 dark:text-slate-600 tabular-nums">{total}</span>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {CH.map((ch) => (
          <Channel key={ch.id} ch={ch} t={t} agents={AG} open={!!open[ch.id]} onToggle={() => setOpen((p) => ({ ...p, [ch.id]: !p[ch.id] }))} />
        ))}
      </div>
    </div>
  );
}
