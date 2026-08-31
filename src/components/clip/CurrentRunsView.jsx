import { useState } from 'react';
import {
  Plus,
  Play,
  Stop,
  BookmarkSimple,
  Trash,
  ArrowUpRight,
  ShieldCheck,
  Globe,
  TerminalWindow,
  Clock
} from '@phosphor-icons/react';
import NewRunModal from './NewRunModal';
import AllActiveAdmin from './AllActiveAdmin';

function RunningRunCard({ run, onStop }) {
  return (
    <div className="group relative w-[300px] text-left border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a] hover:border-slate-400 dark:hover:border-slate-600 transition-colors">
      {/* Active blue accent strip on left */}
      <span className="absolute left-0 inset-y-0 w-[2px] bg-blue-500" />

      <div className="flex items-center gap-2 px-4 pt-3.5">
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75 pulse-dot" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
        </span>
        <span className="text-[14px] font-bold tracking-tight text-slate-800 dark:text-slate-100 truncate">
          {run.name}
        </span>
        <span className="ml-auto font-tech text-[9px] uppercase tracking-widest text-blue-600 dark:text-blue-400 font-semibold shrink-0">
          RUNNING
        </span>
      </div>

      <div className="px-4 font-tech text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
        {run.endpoint || run.domain || 'target endpoint'}
      </div>

      <div className="flex items-center justify-between px-4 py-2.5 mt-1 font-tech text-[10px] border-t border-slate-100 dark:border-slate-800/60">
        <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
          {run.isVerified ? (
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
              <ShieldCheck size={12} weight="fill" /> Verified
            </span>
          ) : (
            <span className="text-slate-400">Unverified</span>
          )}
          {run.phone && <span>· Voice enabled</span>}
        </div>
        <button
          type="button"
          onClick={() => onStop?.(run)}
          className="inline-flex items-center gap-1 px-2 py-0.5 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-transparent hover:border-rose-200 dark:hover:border-rose-900 transition-colors cursor-pointer"
        >
          <Stop size={11} weight="fill" />
          <span>Stop</span>
        </button>
      </div>
    </div>
  );
}

function DraftRunCard({ draft, onResume, onDelete }) {
  const timeAgo = draft.savedAt
    ? new Date(draft.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'Saved';

  return (
    <div
      onClick={onResume}
      className="group relative w-[300px] text-left border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a] hover:border-slate-400 dark:hover:border-slate-600 transition-colors cursor-pointer"
    >
      {/* Draft amber accent strip on left */}
      <span className="absolute left-0 inset-y-0 w-[2px] bg-amber-400 dark:bg-amber-500" />

      <div className="flex items-center gap-2 px-4 pt-3.5">
        <BookmarkSimple size={13} className="text-amber-500 shrink-0" weight="fill" />
        <span className="text-[14px] font-bold tracking-tight text-slate-800 dark:text-slate-100 truncate">
          {draft.name || 'Untitled Draft'}
        </span>
        <ArrowUpRight
          size={14}
          weight="bold"
          className="ml-auto shrink-0 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 dark:group-hover:text-slate-400 transition-colors"
        />
      </div>

      <div className="px-4 font-tech text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
        {draft.endpoint || 'No endpoint specified yet'}
      </div>

      <div className="flex items-center justify-between px-4 py-2.5 mt-1 font-tech text-[10px] border-t border-slate-100 dark:border-slate-800/60">
        <span className="text-amber-600 dark:text-amber-400 uppercase tracking-wider font-semibold">
          DRAFT
        </span>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-slate-400 dark:text-slate-500">
            {timeAgo}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.(draft);
            }}
            title="Discard draft"
            className="p-0.5 text-slate-300 hover:text-rose-500 transition-colors cursor-pointer"
          >
            <Trash size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CurrentRunsView({
  activeRuns = [],
  savedDrafts = [],
  onStartRun,
  onStopRun,
  onSaveDraft,
  onDeleteDraft,
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDraft, setEditingDraft] = useState(null);

  const handleOpenNew = () => {
    setEditingDraft(null);
    setIsModalOpen(true);
  };

  const handleResumeDraft = (draft) => {
    setEditingDraft(draft);
    setIsModalOpen(true);
  };

  const handleSaveModalDraft = (draftData) => {
    onSaveDraft?.(draftData, editingDraft);
    setIsModalOpen(false);
    setEditingDraft(null);
  };

  const handleStartModalRun = (runConfig) => {
    onStartRun?.(runConfig, editingDraft);
    setIsModalOpen(false);
    setEditingDraft(null);
  };

  const hasItems = activeRuns.length > 0 || savedDrafts.length > 0;

  return (
    <div>
      {/* Top Action Bar */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="text-[12px] font-mono text-slate-500 dark:text-slate-400">
            {activeRuns.length} running · {savedDrafts.length} saved drafts
          </div>
        </div>
        
        <button
          type="button"
          onClick={handleOpenNew}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 text-[12px] font-medium tracking-tight shadow-xs transition-colors cursor-pointer"
        >
          <Plus size={14} weight="bold" />
          <span>New Run</span>
        </button>
      </div>

      {/* Admin-only: every Bastion agent live right now (localhost feed) */}
      <AllActiveAdmin />

      {/* Cards Grid (Blocks one beside another, matching Past Runs layout) */}
      {hasItems ? (
        <div className="flex flex-wrap gap-3">
          {/* Running runs blocks */}
          {activeRuns.map((run) => (
            <RunningRunCard
              key={run.id || run.name}
              run={run}
              onStop={onStopRun}
            />
          ))}

          {/* Saved drafts blocks */}
          {savedDrafts.map((draft) => (
            <DraftRunCard
              key={draft.id || draft.name || draft.savedAt}
              draft={draft}
              onResume={() => handleResumeDraft(draft)}
              onDelete={onDeleteDraft}
            />
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="border border-dashed border-slate-300 dark:border-slate-800 p-12 text-center bg-slate-50/50 dark:bg-slate-900/20">
          <TerminalWindow size={32} className="mx-auto text-slate-400 mb-3" />
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">
            No active runs or saved drafts
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-4">
            Start a new adversarial swarm assessment or save draft configurations for later.
          </p>
          <button
            type="button"
            onClick={handleOpenNew}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 text-xs font-medium cursor-pointer transition-colors"
          >
            <Plus size={14} weight="bold" />
            <span>Configure First Run</span>
          </button>
        </div>
      )}

      {/* New / Edit Run Modal */}
      <NewRunModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingDraft(null);
        }}
        onStartRun={handleStartModalRun}
        onSaveDraft={handleSaveModalDraft}
        initialDraft={editingDraft}
      />
    </div>
  );
}
