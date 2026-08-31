import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Crosshair, ArrowLeft } from '@phosphor-icons/react';
import { fetchChallenges, fetchLeaderboard, getHandle, setHandle as persistHandle } from './arenaClient';
import TargetBoard from './TargetBoard';
import BattlePage from './BattlePage';
import Standings from './Standings';

// Bastion Arena — a standalone panel, not a view inside the dashboard shell.
// It owns the whole viewport: its own header, its own routing, its own
// full-height battle layout. Visual language is the dashboard's (light slate
// surfaces, square corners, font-tech micro-labels, colour reserved for
// identity) so it reads as the same product, not the same page.
//
//   /arena              → target board
//   /arena/standings    → leaderboard
//   /arena/c/<id>       → battle

const HEADER_H = 'h-16';

function parseRoute(pathname = window.location.pathname) {
  const rest = (pathname || '').replace(/^\/arena\/?/, '');
  const parts = rest.split('/').filter(Boolean);
  if (!parts.length) return { view: 'targets' };
  if (parts[0] === 'standings') return { view: 'standings' };
  if (parts[0] === 'c' && parts[1]) return { view: 'battle', id: parts[1] };
  return { view: 'targets' };
}

export default function Arena() {
  const [route, setRoute] = useState(() => parseRoute());
  const [catalog, setCatalog] = useState({ status: 'loading' });
  const [record, setRecord] = useState(null);
  const [handle, setHandleState] = useState(() => getHandle());

  useEffect(() => {
    let live = true;
    fetchChallenges()
      .then((d) => live && setCatalog({ status: 'ready', ...d }))
      .catch((e) => live && setCatalog({ status: 'error', error: String(e.message || e) }));
    return () => { live = false; };
  }, []);

  // The player's own standing, for the lead band.
  useEffect(() => {
    let live = true;
    fetchLeaderboard()
      .then((d) => {
        if (!live) return;
        setRecord((d.leaderboard || []).find((r) => r.player === (handle || 'anonymous')) || null);
      })
      .catch(() => live && setRecord(null));
    return () => { live = false; };
  }, [handle, route.view]);

  useEffect(() => {
    const onPop = () => setRoute(parseRoute());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((path) => {
    window.history.pushState({}, '', path);
    setRoute(parseRoute(path));
    window.scrollTo({ top: 0 });
  }, []);

  const updateHandle = useCallback((next) => {
    const clean = next.replace(/[^\w .-]/g, '').slice(0, 24);
    setHandleState(clean);
    persistHandle(clean);
  }, []);

  const challenge =
    route.view === 'battle' && (catalog.challenges || []).find((c) => c.id === route.id);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#0B1120] font-sans text-slate-800 dark:text-slate-200">
      <ArenaHeader
        route={route}
        navigate={navigate}
        handle={handle}
        onHandle={updateHandle}
        headerH={HEADER_H}
      />

      {catalog.status === 'loading' && (
        <Centered>Loading range…</Centered>
      )}

      {catalog.status === 'error' && (
        <Centered>Arena API unavailable — {catalog.error}</Centered>
      )}

      {catalog.status === 'ready' && route.view === 'battle' && challenge && (
        <BattlePage
          key={challenge.id}
          challenge={challenge}
          handle={handle}
          onHandle={updateHandle}
          onBack={() => navigate('/arena')}
        />
      )}

      {catalog.status === 'ready' && route.view === 'battle' && !challenge && (
        <Centered>
          No such target.{' '}
          <button
            onClick={() => navigate('/arena')}
            className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer bg-transparent border-0 p-0"
          >
            Back to the range
          </button>
        </Centered>
      )}

      {catalog.status === 'ready' && route.view !== 'battle' && (
        <motion.main
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className="flex-1 w-full max-w-[1180px] mx-auto px-6 sm:px-8 py-9"
        >
          <LeadBand challenges={catalog.challenges} record={record} />

          <div className="mt-9">
            {route.view === 'standings'
              ? <Standings challenges={catalog.challenges} />
              : <TargetBoard challenges={catalog.challenges} onOpen={(id) => navigate(`/arena/c/${id}`)} />}
          </div>

          {(catalog.gatewayConfigured === false || catalog.storeBackend === 'memory') && (
            <p className="mt-10 pt-4 border-t border-slate-200 dark:border-slate-800 font-tech text-[10px] text-slate-400 dark:text-slate-500">
              {catalog.gatewayConfigured === false && 'AI_GATEWAY_API_KEY not set — targets will not respond. '}
              {catalog.storeBackend === 'memory' && 'Standings on ephemeral in-memory storage.'}
            </p>
          )}
        </motion.main>
      )}
    </div>
  );
}

function ArenaHeader({ route, navigate, handle, onHandle, headerH }) {
  const tab = (view, label, path) => {
    const on = route.view === view;
    return (
      <button
        onClick={() => navigate(path)}
        className={`h-full px-1 border-b-2 text-[11px] font-bold uppercase tracking-widest transition-colors cursor-pointer bg-transparent ${
          on
            ? 'border-blue-500 text-blue-600 dark:text-blue-400'
            : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'
        }`}
      >
        {label}
      </button>
    );
  };

  return (
    <header
      className={`${headerH} shrink-0 sticky top-0 z-40 border-b border-slate-300 dark:border-slate-800/80 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md px-4 sm:px-6 flex items-center gap-5`}
    >
      <button
        onClick={() => navigate('/arena')}
        className="flex items-center gap-3 shrink-0 cursor-pointer bg-transparent border-0 p-0"
      >
        <span className="text-slate-800 dark:text-slate-100 font-bold tracking-tight text-xl">bastion</span>
        <span className="h-6 w-px bg-slate-200 dark:bg-slate-800" />
        <span className="flex items-center gap-1.5 font-tech text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
          <Crosshair size={13} weight="bold" />
          Arena
        </span>
      </button>

      <nav className="hidden sm:flex items-stretch h-full gap-5 ml-2">
        {tab('targets', 'Targets', '/arena')}
        {tab('standings', 'Standings', '/arena/standings')}
      </nav>

      <div className="ml-auto flex items-center gap-3 shrink-0">
        <div className="hidden sm:flex items-center gap-2">
          <span className="font-tech text-[9px] uppercase tracking-widest text-slate-400 dark:text-slate-500">Handle</span>
          <input
            value={handle}
            onChange={(e) => onHandle(e.target.value)}
            placeholder="anonymous"
            spellCheck={false}
            className="w-[128px] border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0f172a] px-2 h-8 text-[12px] text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
        <a
          href="/"
          className="inline-flex items-center gap-1.5 px-3 h-8 text-[10px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors no-underline"
        >
          <ArrowLeft size={12} weight="bold" />
          <span className="hidden md:inline">Dashboard</span>
        </a>
      </div>
    </header>
  );
}

function LeadBand({ challenges, record }) {
  const objectives = challenges.reduce((n, c) => n + c.objectives.length, 0);
  const points = challenges.reduce((n, c) => n + c.maxPoints, 0);

  return (
    <div className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0f172a]">
      <div className="flex flex-col sm:flex-row sm:items-center gap-5 px-7 py-7">
        <div className="min-w-0">
          <h1 className="text-[20px] font-bold uppercase tracking-widest text-slate-800 dark:text-slate-100 leading-none">
            Break the agent
          </h1>
          <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-2 max-w-[620px] leading-relaxed">
            {challenges.length} defended targets, each holding something it has been told to
            protect. A referee model scores your transcript against that target&apos;s break
            objectives — nothing is self-reported.
          </p>
        </div>
        <div className="sm:ml-auto shrink-0 flex items-center gap-8">
          <Metric value={record?.points ?? 0} label="your points" />
          <Metric value={`${record?.breaks ?? 0}/${objectives}`} label="objectives broken" />
          <Metric value={points.toLocaleString()} label="on the board" muted />
        </div>
      </div>
    </div>
  );
}

function Metric({ value, label, muted }) {
  return (
    <div>
      <div
        className={`text-[24px] font-bold tabular-nums leading-none ${
          muted ? 'text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-100'
        }`}
      >
        {value}
      </div>
      <div className="font-tech text-[9px] uppercase tracking-widest text-slate-400 dark:text-slate-500 mt-2">
        {label}
      </div>
    </div>
  );
}

function Centered({ children }) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <p className="text-[12px] text-slate-400 dark:text-slate-500">{children}</p>
    </div>
  );
}
