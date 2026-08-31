import { useState } from 'react';
import { SideNav } from './components/layout/SideNav';
import { TopBar } from './components/layout/TopBar';
import CliLogin from './components/auth/CliLogin';
import DemoGate from './components/auth/DemoGate';
import Docs from './components/views/Docs';
import Arena from './components/arena/Arena';
import CurrentRunsView from './components/clip/CurrentRunsView';
import PastRunsView from './components/clip/PastRunsView';
import EvalsView from './components/clip/EvalsView';
import PostureReportView from './components/clip/PostureReportView';
import SettingsView from './components/clip/SettingsView';
import DashboardView from './components/views/DashboardView';
import CortexView from './components/clip/CortexView';

// clip — clean-slate dashboard.
// The staging.demo shell (sidebar + topbar + main card) kept intact; every
// view emptied to a blank canvas to build on. No data fetching, no changelog,
// no risk rail, no mode toggle.

const VALID_VIEWS = new Set(['dashboard', 'current-runs', 'past-runs', 'cortex', 'evals', 'posture-report', 'settings']);

function detectInitialView() {
  if (typeof window === 'undefined') return 'dashboard';
  let path = window.location.pathname || '/';
  if (path.startsWith('/')) path = path.slice(1);
  const first = (path.split('/')[0] || '').toLowerCase();
  return VALID_VIEWS.has(first) ? first : 'dashboard';
}

const VIEW_LABEL = {
  dashboard: 'Dashboard',
  'current-runs': 'Current Runs',
  'past-runs': 'Past Runs',
  cortex: 'Cortex',
  evals: 'Evals',
  'posture-report': 'Posture Report',
  settings: 'Settings',
};
const VIEW_TAG = {
  dashboard: 'overview',
  'current-runs': 'live',
  'past-runs': 'recorded',
  evals: 'scored',
  'posture-report': 'attestation',
  settings: 'config',
};

export default function App() {
  // /cli-login + /docs keep their dedicated routes (login lives here).
  const routePath = (typeof window !== 'undefined' && window.location.pathname) || '/';
  if (routePath === '/cli-login') return <CliLogin />;
  if (routePath === '/docs') return <Docs />;
  // /arena is a standalone panel that owns the whole viewport — its own header,
  // its own routing — rather than a view inside the dashboard shell.
  if (routePath === '/arena' || routePath.startsWith('/arena/')) return <Arena />;

  const [currentView, setCurrentView] = useState(detectInitialView());
  const [activeRuns, setActiveRuns] = useState([]);
  const [savedDrafts, setSavedDrafts] = useState(() => {
    try {
      const saved = localStorage.getItem('bastion_run_drafts');
      if (saved) return JSON.parse(saved);
      const single = localStorage.getItem('bastion_run_draft');
      return single ? [JSON.parse(single)] : [];
    } catch {
      return [];
    }
  });

  const handleSaveDraft = (draftData, existingDraft) => {
    setSavedDrafts((prev) => {
      let updated;
      if (existingDraft?.id) {
        updated = prev.map((d) => (d.id === existingDraft.id ? { ...draftData, id: existingDraft.id } : d));
      } else {
        const newId = `draft-${Date.now()}`;
        updated = [{ ...draftData, id: newId }, ...prev.filter((d) => d.name !== draftData.name)];
      }
      try {
        localStorage.setItem('bastion_run_drafts', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const handleDeleteDraft = (draftToDelete) => {
    setSavedDrafts((prev) => {
      const updated = prev.filter((d) => (d.id ? d.id !== draftToDelete.id : d.savedAt !== draftToDelete.savedAt));
      try {
        localStorage.setItem('bastion_run_drafts', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const handleStartRun = (runConfig, fromDraft) => {
    const newRun = { ...runConfig, id: `run-${Date.now()}` };
    setActiveRuns((prev) => [newRun, ...prev]);
    if (fromDraft) {
      handleDeleteDraft(fromDraft);
    }
  };

  const handleStopRun = (runToStop) => {
    setActiveRuns((prev) => prev.filter((r) => r.id !== runToStop.id && r.name !== runToStop.name));
  };

  return (
    <DemoGate>
    <div className="min-h-screen font-sans bg-slate-50 dark:bg-[#0B1120] text-slate-800 dark:text-slate-300 flex transition-colors duration-300 tech-grid">
      <SideNav currentView={currentView} setCurrentView={setCurrentView} />

      <main className="flex-1 sm:ml-[220px] h-screen overflow-y-auto overflow-x-hidden flex flex-col pb-16 sm:pb-0 relative z-10">
        <TopBar setCurrentView={setCurrentView} />
        <section className="flex-1 bg-transparent transition-colors duration-300 p-0 sm:p-6">
          <div className={`h-full border-x border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a] shadow-sm relative ${currentView === 'dashboard' || currentView === 'cortex' ? '' : 'px-6 sm:px-10 py-8'}`}>
            {currentView !== 'dashboard' && currentView !== 'cortex' && (
              <div className="flex items-center gap-2 mb-5">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {VIEW_LABEL[currentView] || 'Current Runs'}
                </h1>
              </div>
            )}
            {/* Dashboard → overview. Past Runs → pick a run. Current Runs → New
                Run configuration + running/draft cards. */}
            {currentView === 'dashboard' ? (
              <DashboardView />
            ) : currentView === 'cortex' ? (
              <CortexView />
            ) : currentView === 'evals' ? (
              <EvalsView />
            ) : currentView === 'posture-report' ? (
              <div className="flex items-start justify-center pt-24">
                <div className="border border-slate-300 dark:border-slate-700 bg-white/90 dark:bg-[#0f172a]/90 px-5 py-3 text-center shadow-sm">
                  <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">No posture report yet</div>
                  <div className="text-[12px] text-slate-500 dark:text-slate-400 mt-1">Reports are generated from completed assessment runs.</div>
                </div>
              </div>
            ) : currentView === 'settings' ? (
              <div className="flex items-start justify-center pt-24">
                <div className="border border-slate-300 dark:border-slate-700 bg-white/90 dark:bg-[#0f172a]/90 px-5 py-3 text-center shadow-sm">
                  <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Settings</div>
                  <div className="text-[12px] text-slate-500 dark:text-slate-400 mt-1">Configuration is coming soon.</div>
                </div>
              </div>
            ) : currentView === 'past-runs' ? (
              <PastRunsView />
            ) : (
              <CurrentRunsView
                activeRuns={activeRuns}
                savedDrafts={savedDrafts}
                onStartRun={handleStartRun}
                onStopRun={handleStopRun}
                onSaveDraft={handleSaveDraft}
                onDeleteDraft={handleDeleteDraft}
              />
            )}
          </div>
        </section>
      </main>
    </div>
    </DemoGate>
  );
}
