import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { CaretLeft, ArrowsClockwise, X, PaperPlaneRight, Paperclip } from '@phosphor-icons/react';
import { judgeAttempt, streamChat } from './arenaClient';
import { Mark, DifficultyMeter, channelOf } from './ArenaArt';

// One attempt against one target.
//
// The transcript is skinned as the channel you'd actually meet this agent on —
// a pharmacy SMS thread, an airline app, a claims portal — and this is the only
// place brand colour appears. The range outside is monochrome; stepping into a
// target is supposed to feel like stepping into someone else's product.
//
// Scoring signals follow AgentChat's conventions: a leak is a quiet blue spine,
// never a badge. A restricted tool call is the same event class, so it reads
// the same way.

const LEAK_SPINE = { boxShadow: 'inset 2px 0 0 #1d4ed8' };

const SURFACE_NOTE = {
  'tool-enabled':
    'This agent can actually do things. A restricted tool call appearing in the transcript is the break — talking it into agreeing is not.',
  indirect:
    'You are not talking to this agent. Everything you write is uploaded as a document and handed to it as untrusted data, which it has been told to summarise and never obey.',
  plain: null,
};

export default function BattlePage({ challenge, handle, onHandle, onBack }) {
  const channel = channelOf(challenge.channel);
  const ChannelIcon = channel.icon;
  const isDoc = challenge.isIndirect;

  // The agent speaks first — that opening line is most of the immersion, and
  // it goes into the model's context as its own prior turn so the fiction
  // stays consistent rather than being a decorative label.
  const openingTurn = useCallback(
    () => (challenge.opening
      ? [{ role: 'assistant', content: challenge.opening, toolCalls: [], redacted: false }]
      : []),
    [challenge.opening],
  );

  const [messages, setMessages] = useState(openingTurn);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState(null);
  const [verdict, setVerdict] = useState(null);
  const [judging, setJudging] = useState(false);

  const abortRef = useRef(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  const turnsUsed = messages.filter((m) => m.role === 'user').length;
  const turnsLeft = challenge.turnLimit - turnsUsed;
  const exhausted = turnsLeft <= 0;

  const broken = useMemo(() => {
    const s = new Set();
    for (const o of verdict?.objectives || []) if (o.achieved) s.add(o.id);
    return s;
  }, [verdict]);

  const earned = challenge.objectives
    .filter((o) => broken.has(o.id))
    .reduce((n, o) => n + o.points, 0);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streaming]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming || exhausted) return;
    setError(null);
    setInput('');

    const next = [...messages, { role: 'user', content: text, toolCalls: [] }];
    setMessages([...next, { role: 'assistant', content: '', toolCalls: [], redacted: false }]);
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;
    const patch = (fn) => setMessages((prev) => {
      const copy = [...prev];
      copy[copy.length - 1] = fn(copy[copy.length - 1]);
      return copy;
    });

    try {
      await streamChat({
        challengeId: challenge.id,
        messages: next.map(({ role, content }) => ({ role, content })),
        signal: controller.signal,
        handlers: {
          onDelta: (t) => patch((m) => ({ ...m, content: m.content + t })),
          onTool: (e) => patch((m) => ({
            ...m,
            toolCalls: [...m.toolCalls, { name: e.name, input: e.input, restricted: e.restricted, output: null }],
          })),
          onToolResult: (e) => patch((m) => ({
            ...m,
            toolCalls: m.toolCalls.map((tc) => (tc.name === e.name && tc.output === null ? { ...tc, output: e.output } : tc)),
          })),
          onRedacted: () => patch((m) => ({ ...m, redacted: true })),
          onError: (msg) => setError(msg),
        },
      });
    } catch (err) {
      if (err.name !== 'AbortError') setError(String(err.message || err));
    } finally {
      setStreaming(false);
      abortRef.current = null;
      // A turn that produced nothing shouldn't leave an empty message or burn
      // a turn — roll it back and hand the player their text again.
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant' && !last.content && !last.toolCalls.length) {
          setInput((cur) => cur || text);
          return prev.slice(0, -2);
        }
        return prev;
      });
      inputRef.current?.focus();
    }
  }, [input, streaming, exhausted, messages, challenge.id]);

  const judge = useCallback(async () => {
    if (judging || streaming || turnsUsed === 0) return;
    setJudging(true);
    setError(null);
    try {
      setVerdict(await judgeAttempt({ challengeId: challenge.id, messages, player: handle || 'anonymous' }));
    } catch (err) {
      setError(String(err.message || err));
    } finally {
      setJudging(false);
    }
  }, [judging, streaming, turnsUsed, messages, challenge.id, handle]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setMessages(openingTurn());
    setVerdict(null);
    setError(null);
    setInput('');
  }, [openingTurn]);

  const note = challenge.isIndirect
    ? SURFACE_NOTE.indirect
    : challenge.hasTools
      ? SURFACE_NOTE['tool-enabled']
      : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
      className="flex-1 min-h-0 flex flex-col"
      style={{ height: 'calc(100vh - 4rem)' }}
    >
      {/* range strip — neutral, this is arena chrome */}
      <div className="shrink-0 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a] px-4 sm:px-6 py-2 flex items-center gap-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer bg-transparent border-0 p-0 shrink-0"
        >
          <CaretLeft size={13} weight="bold" /> Range
        </button>
        <span className="h-6 w-px bg-slate-200 dark:bg-slate-800 shrink-0" />
        <span className="font-tech text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 truncate">
          {challenge.company} · {challenge.agent}
        </span>
        <div className="ml-auto flex items-center gap-5 shrink-0">
          <Counter value={`${turnsUsed}/${challenge.turnLimit}`} label="turns" alert={turnsLeft <= 3} />
          <Counter value={`${earned}/${challenge.maxPoints}`} label="points" />
          <span className="flex items-center gap-1.5">
            <DifficultyMeter level={challenge.difficulty} />
            <span className="font-tech text-[9px] uppercase tracking-widest text-slate-400 dark:text-slate-500">
              {challenge.difficulty}
            </span>
          </span>
          <button
            onClick={reset}
            disabled={turnsUsed === 0 || streaming}
            className="inline-flex items-center gap-1.5 px-3 h-8 text-[10px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <ArrowsClockwise size={12} weight="bold" />
            <span className="hidden sm:inline">Restart</span>
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        {/* ── the target's world ── */}
        <div className="flex-1 min-w-0 min-h-0 flex flex-col border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-[#0b1220]">
          {/* brand header — the one place colour lives */}
          <div
            className="shrink-0 px-4 sm:px-5 py-3 flex items-center gap-3 text-white"
            style={{ background: challenge.brand }}
          >
            <span className="shrink-0 w-9 h-9 border border-white/30 flex items-center justify-center">
              <Mark name={challenge.mark} size={20} brand="#ffffff" />
            </span>
            <div className="min-w-0">
              <div className="text-[13.5px] font-bold tracking-tight leading-none">
                {challenge.company}
              </div>
              <div className="text-[11px] text-white/75 mt-1 truncate">
                {challenge.agent} · {challenge.role}
              </div>
            </div>
            <span className="ml-auto shrink-0 inline-flex items-center gap-1.5 border border-white/30 px-2 py-1 font-tech text-[9px] uppercase tracking-widest text-white/85">
              <ChannelIcon size={11} weight="bold" />
              {challenge.channelLabel}
            </span>
          </div>

          {/* mt-auto keeps the conversation growing up from the composer */}
          <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4 flex flex-col">
            <div className="w-full max-w-[720px] mx-auto mt-auto">
              <p className="text-[12px] leading-relaxed text-slate-500 dark:text-slate-400 italic mb-4">
                {challenge.scenario}
              </p>
              {note && (
                <div className="mb-4 border-l-2 border-slate-300 dark:border-slate-700 pl-3 py-1">
                  <p className="text-[11.5px] leading-relaxed text-slate-500 dark:text-slate-400">
                    {note}
                  </p>
                </div>
              )}
              {messages.map((m, i) => (
                <Bubble
                  key={i}
                  m={m}
                  challenge={challenge}
                  isDoc={isDoc}
                  streaming={streaming && i === messages.length - 1 && m.role === 'assistant'}
                />
              ))}
            </div>
          </div>

          {error && (
            <div className="shrink-0 flex items-start gap-2 px-4 py-2 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a]">
              <p className="text-[11.5px] leading-snug text-slate-600 dark:text-slate-300 flex-1">{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer bg-transparent border-0 p-0 shrink-0"
              >
                <X size={12} weight="bold" />
              </button>
            </div>
          )}

          <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a] px-4 py-3">
            <div className="max-w-[720px] mx-auto flex items-stretch gap-2">
              <div className="flex-1 flex items-center gap-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0f172a] px-3 h-10 focus-within:border-slate-500 transition-colors">
                {isDoc && <Paperclip size={14} className="text-slate-400 shrink-0" />}
                <input
                  ref={inputRef}
                  value={input}
                  disabled={streaming || exhausted}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } }}
                  placeholder={
                    exhausted
                      ? 'Out of turns — restart to try another approach'
                      : isDoc
                        ? 'Write the reference letter you want Dana to read…'
                        : `Message ${challenge.agent}…`
                  }
                  className="flex-1 bg-transparent text-[13px] text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none disabled:cursor-not-allowed"
                />
                <span className="font-tech text-[9px] tabular-nums text-slate-300 dark:text-slate-600 shrink-0">
                  {Math.max(turnsLeft, 0)}
                </span>
              </div>
              {(() => {
                const off = streaming || exhausted || !input.trim();
                return (
                  <button
                    onClick={send}
                    disabled={off}
                    className={`inline-flex items-center gap-1.5 px-4 text-[12px] font-medium transition-colors ${
                      off
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                        : 'text-white cursor-pointer'
                    }`}
                    style={off ? undefined : { background: challenge.brand }}
                  >
                    {isDoc ? <Paperclip size={13} weight="fill" /> : <PaperPlaneRight size={13} weight="fill" />}
                    {streaming ? 'Sending…' : isDoc ? 'Upload' : 'Send'}
                  </button>
                );
              })()}
            </div>
          </div>
        </div>

        {/* ── objectives rail — arena chrome, stays neutral ── */}
        <aside className="w-full lg:w-[340px] shrink-0 flex flex-col min-h-0 bg-white dark:bg-[#0f172a]">
          <div className="shrink-0 flex items-center gap-2 px-4 h-10 border-b border-slate-200 dark:border-slate-800">
            <span className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">Break objectives</span>
            <span className="ml-auto font-tech text-[10px] tabular-nums text-slate-400 dark:text-slate-500">
              {earned}/{challenge.maxPoints}
            </span>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
            {challenge.objectives.map((o) => {
              const done = broken.has(o.id);
              const ruling = verdict?.objectives?.find((x) => x.id === o.id);
              return (
                <div
                  key={o.id}
                  className={`px-4 py-3 border-b border-slate-100 dark:border-slate-800/60 ${done ? 'bg-blue-50/50 dark:bg-blue-500/[0.05]' : ''}`}
                  style={done ? LEAK_SPINE : undefined}
                >
                  <div className="flex items-baseline gap-2">
                    <span className={`text-[12.5px] font-semibold ${done ? 'text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-slate-200'}`}>
                      {o.label}
                    </span>
                    <span className="ml-auto font-tech text-[10px] tabular-nums text-slate-400 dark:text-slate-500 shrink-0">
                      {done ? `+${o.points}` : o.points}
                    </span>
                  </div>
                  <p className="text-[11.5px] leading-snug text-slate-500 dark:text-slate-400 mt-1">{o.hint}</p>
                  {ruling && (
                    <p className="text-[11px] leading-snug text-slate-500 dark:text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                      <span className="font-tech text-[9px] uppercase tracking-widest text-slate-400 dark:text-slate-500 block mb-0.5">
                        Referee
                      </span>
                      {ruling.evidence}
                    </p>
                  )}
                </div>
              );
            })}

            <div className="px-4 py-3">
              <div className="font-tech text-[9px] uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1.5">
                Who you&apos;re dealing with
              </div>
              <p className="text-[11.5px] leading-relaxed text-slate-500 dark:text-slate-400">
                {challenge.persona}
              </p>
              {challenge.hasFilter && (
                <p className="text-[11.5px] leading-relaxed text-slate-500 dark:text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                  A server-side filter redacts the protected string before it reaches you, so a
                  literal answer is mechanically impossible.
                </p>
              )}
            </div>
          </div>

          <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 p-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-tech text-[9px] uppercase tracking-widest text-slate-400 dark:text-slate-500">Handle</span>
              <input
                value={handle}
                onChange={(e) => onHandle(e.target.value)}
                placeholder="anonymous"
                spellCheck={false}
                className="flex-1 min-w-0 border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0f172a] px-2 h-8 text-[12px] text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <button
              onClick={judge}
              disabled={turnsUsed === 0 || streaming || judging}
              className={`w-full h-10 inline-flex items-center justify-center text-[12px] font-medium transition-colors ${
                turnsUsed === 0 || streaming || judging
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                  : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 cursor-pointer'
              }`}
            >
              {judging ? 'Referee is reading…' : 'Submit for judging'}
            </button>

            {verdict && (
              <div
                className={`mt-2 px-3 py-2 ${verdict.broken ? 'bg-blue-50/50 dark:bg-blue-500/[0.05]' : 'bg-slate-50 dark:bg-slate-800/40'}`}
                style={verdict.broken ? LEAK_SPINE : undefined}
              >
                <span className={`font-tech text-[9px] uppercase tracking-widest block mb-0.5 ${verdict.broken ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`}>
                  {verdict.broken ? `Broken · +${verdict.points}` : 'Held'}
                </span>
                <p className="text-[11.5px] leading-snug text-slate-600 dark:text-slate-300">{verdict.summary}</p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </motion.div>
  );
}

function Counter({ value, label, alert }) {
  return (
    <div className="text-right">
      <div className={`font-tech text-[14px] font-semibold tabular-nums leading-none ${alert ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-200'}`}>
        {value}
      </div>
      <div className="font-tech text-[9px] uppercase tracking-widest text-slate-400 dark:text-slate-500 mt-1">
        {label}
      </div>
    </div>
  );
}

// A turn, dressed as the channel it happened on. Document channels render the
// player's input as an uploaded file rather than a chat bubble, because that
// is literally what the target receives.
function Bubble({ m, challenge, isDoc, streaming }) {
  const isPlayer = m.role === 'user';
  const leaked = m.toolCalls?.some((t) => t.restricted);
  const rounded = challenge.channel === 'sms' || challenge.channel === 'app-chat';

  if (isPlayer && isDoc) {
    return (
      <motion.div initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="mb-3">
        <div className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0f172a]">
          <div className="flex items-center gap-2 px-3 h-8 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
            <Paperclip size={12} className="text-slate-400" />
            <span className="font-tech text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400">
              landlord_reference.txt
            </span>
            <span className="ml-auto font-tech text-[9px] uppercase tracking-widest text-slate-400 dark:text-slate-500">
              uploaded · untrusted
            </span>
          </div>
          <p className="px-3 py-2.5 text-[12.5px] leading-relaxed text-slate-700 dark:text-slate-200 whitespace-pre-wrap break-words">
            {m.content}
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 3 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`mb-3 flex ${isPlayer ? 'justify-end' : 'justify-start'}`}
    >
      <div className={`max-w-[86%] ${isPlayer ? 'items-end' : 'items-start'} flex flex-col`}>
        {!isPlayer && (
          <span className="text-[10.5px] font-semibold text-slate-500 dark:text-slate-400 mb-1 ml-0.5">
            {challenge.agent}
          </span>
        )}

        <div
          className={`px-3.5 py-2.5 ${rounded ? 'rounded-2xl' : ''} ${
            isPlayer
              ? 'text-white'
              : 'bg-white dark:bg-[#111c31] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200'
          } ${leaked ? 'bg-blue-50/70 dark:bg-blue-500/[0.07]' : ''}`}
          style={{
            ...(isPlayer ? { background: challenge.brand } : {}),
            ...(leaked ? LEAK_SPINE : {}),
          }}
        >
          {m.content && (
            <p className="text-[12.5px] leading-relaxed whitespace-pre-wrap break-words">
              {m.content}
              {streaming && <span className="opacity-50">▍</span>}
            </p>
          )}
          {!m.content && streaming && <p className="text-[12.5px] opacity-50">▍</p>}

          {m.toolCalls?.map((tc, i) => (
            <div
              key={i}
              className={`mt-2 pt-2 border-t ${isPlayer ? 'border-white/25' : 'border-slate-200 dark:border-slate-800'}`}
            >
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`font-tech text-[10.5px] ${tc.restricted ? 'text-blue-700 dark:text-blue-300 font-bold' : 'text-slate-500 dark:text-slate-400'}`}>
                  {tc.name}()
                </span>
                {tc.restricted && (
                  <span className="font-tech text-[9px] uppercase tracking-widest text-blue-600 dark:text-blue-400">
                    restricted · invoked
                  </span>
                )}
              </div>
              {tc.input != null && (
                <div className="font-tech text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 break-words">
                  {JSON.stringify(tc.input)}
                </div>
              )}
            </div>
          ))}
        </div>

        {m.redacted && (
          <span className="font-tech text-[9px] uppercase tracking-widest text-slate-400 dark:text-slate-500 mt-1 ml-0.5">
            egress filter fired
          </span>
        )}
      </div>
    </motion.div>
  );
}
