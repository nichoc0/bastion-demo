import { useState, useRef, useEffect } from 'react';
import { Gear, ShieldCheck, Wrench, Plus, Prohibit, CheckCircle, UploadSimple, FileText, Spinner, X, ArrowRight, Clock } from '@phosphor-icons/react';

// Settings — configure my Bastion deployment. Ported from the staging.demo
// (bastion-blue) PolicyConfig and re-themed as a rules-of-engagement guardrail
// console for the autonomous red-team fleet: which agents may call which tools
// against a target, plus live tool-usage telemetry. Store-free; the policy
// upload is simulated locally so it demos end-to-end without a backend.

const AGENT_META = {
  orchestrator: { color: '#0f172a', label: 'Orchestrator' },
  recon: { color: '#64748b', label: 'Recon' },
  attacker: { color: '#334155', label: 'Attacker' },
  verifier: { color: '#94a3b8', label: 'Verifier' },
};

const INITIAL_POLICIES = [
  { id: 1, agent: '*', tool_name: 'drop_table', action: 'block' },
  { id: 2, agent: '*', tool_name: 'delete_record', action: 'block' },
  { id: 3, agent: 'attacker', tool_name: 'send_email', action: 'block' },
  { id: 4, agent: 'attacker', tool_name: 'database_write', action: 'block' },
  { id: 5, agent: '*', tool_name: 'query_knowledge_graph', action: 'allow' },
  { id: 6, agent: 'recon', tool_name: 'read_file', action: 'allow' },
  { id: 7, agent: 'attacker', tool_name: 'store_memory', action: 'allow' },
  { id: 8, agent: '*', tool_name: 'query_external_api', action: 'allow' },
];

const TOOL_STATS = [
  { name: 'query_knowledge_graph', agent: 'orchestrator', count: 418, status: 'allowed' },
  { name: 'read_file', agent: 'recon', count: 262, status: 'allowed' },
  { name: 'store_memory', agent: 'attacker', count: 96, status: 'allowed' },
  { name: 'query_external_api', agent: 'attacker', count: 74, status: 'allowed' },
  { name: 'send_email', agent: 'attacker', count: 3, status: 'blocked' },
  { name: 'drop_table', agent: 'attacker', count: 1, status: 'blocked' },
  { name: 'delete_record', agent: 'attacker', count: 0, status: 'blocked' },
];

const PRESET_TOOLS = [
  'read_file', 'write_file', 'run_command', 'store_memory', 'query_knowledge_graph',
  'query_external_api', 'create_pull_request', 'push_branch', 'install_dependency',
  'send_email', 'database_write', 'delete_file', 'drop_table', 'delete_record',
];

const HISTORY_KEY = 'bastion.policy-upload-history.v1';
const HISTORY_LIMIT = 20;

function loadHistory() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function saveHistory(entries) {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, HISTORY_LIMIT))); } catch { /* non-fatal */ }
}
function appendHistory(entry) {
  const next = [entry, ...loadHistory().filter((e) => e.source !== entry.source)];
  saveHistory(next);
  return next;
}
function removeHistory(source) {
  const next = loadHistory().filter((e) => e.source !== source);
  saveHistory(next);
  return next;
}
function formatRelative(ts) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

function AgentBadge({ agent }) {
  const meta = AGENT_META[agent] || {};
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200">
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: meta.color || '#64748b' }} />
      {meta.label || agent}
    </span>
  );
}

// Build a simulated extraction preview from the uploaded filename so the upload
// flow demos end-to-end with no backend. The triples are illustrative guardrail
// links, not a real parse.
function simulatePreview(filename) {
  const base = filename.replace(/\.[^.]+$/, '');
  const policyId = `policy-${base.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24)}`;
  return {
    policy_id: policyId,
    markdown: [
      `# ${base}`,
      '',
      '## Rules of engagement',
      '- Probes run against canary-only targets with dummy secrets.',
      '- Destructive tools (drop_table, delete_record) are blocked for all agents.',
      '- The attacker agent may not send_email or database_write.',
      '- Findings must be adversarially verified before report.',
    ].join('\n'),
    triples: [
      { h: 'attacker', r: 'must_not', t: 'send_email', matched_existing: true },
      { h: 'attacker', r: 'must_not', t: 'database_write', matched_existing: false },
      { h: '*', r: 'must_not', t: 'drop_table', matched_existing: true },
      { h: 'recon', r: 'may', t: 'read_file', matched_existing: true },
      { h: 'verifier', r: 'requires', t: 'adversarial_verification', matched_existing: false },
    ],
  };
}

function PolicyUploadCard() {
  const [stage, setStage] = useState('idle');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [history, setHistory] = useState(() => loadHistory());
  const inputRef = useRef(null);

  useEffect(() => { setHistory(loadHistory()); }, []);

  const handleFiles = (files) => {
    if (!files || files.length === 0) return;
    const f = files[0];
    setFile(f);
    setStage('uploading');
    setPreview(null);
    setTimeout(() => {
      setPreview(simulatePreview(f.name));
      setStage('preview');
    }, 900);
  };

  const handleCommit = () => {
    if (!preview) return;
    setStage('committing');
    const filename = file?.name || preview.policy_id || 'unknown';
    setTimeout(() => {
      setHistory(appendHistory({
        source: `policy-upload:${filename}`,
        filename,
        policyId: preview.policy_id || null,
        tripleCount: preview.triples?.length ?? 0,
        uploadedAt: Date.now(),
      }));
      setStage('committed');
    }, 800);
  };

  const handleReset = () => { setStage('idle'); setFile(null); setPreview(null); };
  const removeFromHistory = (source) => setHistory(removeHistory(source));

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-none overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center gap-2">
        <UploadSimple size={16} weight="bold" className="text-slate-400 dark:text-slate-500" />
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Upload Policy Document</h3>
        <span className="ml-auto text-[10px] text-slate-500">.md · .txt · .pdf</span>
      </div>

      <div className="p-5 space-y-4">
        {stage === 'idle' && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-none p-8 text-center cursor-pointer transition-colors ${
              dragOver ? 'border-slate-400 bg-slate-50 dark:bg-slate-800/40' : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/30'
            }`}
          >
            <UploadSimple size={28} weight="bold" className="text-slate-400 mx-auto mb-2" />
            <p className="text-[12px] text-slate-700 dark:text-slate-300 font-semibold">Drop a rules-of-engagement document here</p>
            <p className="text-[11px] text-slate-500 mt-1">or click to browse — we&apos;ll extract the guardrails and link them to your knowledge graph</p>
            <input ref={inputRef} type="file" accept=".md,.txt,.pdf" className="hidden" onChange={(e) => handleFiles(e.target.files)} />
          </div>
        )}

        {stage === 'uploading' && (
          <div className="border border-slate-200 dark:border-slate-700 p-5 flex items-center gap-3">
            <Spinner size={18} className="text-slate-400 dark:text-slate-500 animate-spin" />
            <div className="flex-1">
              <div className="text-[12px] font-semibold text-slate-700 dark:text-slate-300">Extracting guardrails from {file?.name}...</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Mapping content to the policy schema and existing knowledge-graph entities</div>
            </div>
          </div>
        )}

        {stage === 'preview' && preview && (
          <PolicyPreview file={file} preview={preview} onCommit={handleCommit} onCancel={handleReset} />
        )}

        {stage === 'committing' && (
          <div className="border border-slate-200 dark:border-slate-700 p-5 flex items-center gap-3">
            <Spinner size={18} className="text-slate-400 dark:text-slate-500 animate-spin" />
            <span className="text-[12px] font-semibold text-slate-700 dark:text-slate-300">Saving policy and linking to the knowledge graph...</span>
          </div>
        )}

        {stage === 'committed' && (
          <div className="border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-5 flex items-center gap-3">
            <CheckCircle size={18} weight="fill" className="text-slate-500 dark:text-slate-400" />
            <div className="flex-1">
              <div className="text-[12px] font-semibold text-slate-800 dark:text-slate-100">Policy saved and linked.</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {preview?.triples?.length ?? 0} new connections added to the knowledge graph
                <span className="inline-flex items-center gap-1 ml-1.5 px-1.5 py-0.5 border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-400/10">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                  <span className="text-[9px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300">Uploaded</span>
                </span>
              </div>
            </div>
            <button onClick={handleReset} className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer bg-transparent">
              Upload another
            </button>
          </div>
        )}

        {history.length > 0 && (
          <div className="pt-1">
            <div className="flex items-center gap-2 mb-2">
              <Clock size={12} className="text-slate-500" />
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Previously uploaded ({history.length})</h4>
            </div>
            <ul className="border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800/50">
              {history.map((entry) => (
                <li key={entry.source} className="flex items-center gap-3 px-3 py-2">
                  <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" title="Uploaded source" />
                  <FileText size={14} className="text-slate-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-mono font-semibold text-slate-800 dark:text-slate-200 truncate">{entry.filename}</div>
                    <div className="text-[10px] text-slate-500 flex items-center gap-2">
                      <span>{entry.tripleCount} {entry.tripleCount === 1 ? 'connection' : 'connections'}</span>
                      <span className="text-slate-300 dark:text-slate-700">·</span>
                      <span>{formatRelative(entry.uploadedAt)}</span>
                      {entry.policyId && (<><span className="text-slate-300 dark:text-slate-700">·</span><span className="font-mono">{entry.policyId}</span></>)}
                    </div>
                  </div>
                  <button onClick={() => removeFromHistory(entry.source)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer bg-transparent border-0 p-1" title="Remove from history">
                    <X size={12} weight="bold" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function PolicyPreview({ file, preview, onCommit, onCancel }) {
  const triples = preview.triples || [];
  return (
    <div className="border border-slate-200 dark:border-slate-700 divide-y divide-slate-200 dark:divide-slate-800">
      <div className="px-4 py-3 flex items-center gap-2 bg-slate-50 dark:bg-slate-800/40">
        <FileText size={14} className="text-slate-400 dark:text-slate-500" />
        <span className="text-[11px] font-mono font-bold text-slate-700 dark:text-slate-200">{file?.name}</span>
        <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">Preview</span>
      </div>
      <div className="px-4 py-3">
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">Generated policy ({preview.policy_id || 'unnamed'})</div>
        <pre className="text-[11px] font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 max-h-[280px] overflow-y-auto">
          {preview.markdown || '(no markdown returned)'}
        </pre>
      </div>
      <div className="px-4 py-3">
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">
          Proposed knowledge-graph links · {triples.length} {triples.length === 1 ? 'connection' : 'connections'}
        </div>
        <ul className="space-y-1.5 max-h-[200px] overflow-y-auto">
          {triples.map((t, i) => (
            <li key={i} className="text-[11px] font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3 py-2 flex items-center gap-2 flex-wrap">
              <span className="text-slate-600 dark:text-slate-400 break-all">{t.h}</span>
              <ArrowRight size={10} weight="bold" className="text-slate-400 dark:text-slate-500" />
              <span className="text-slate-600 dark:text-slate-300">{t.r}</span>
              <ArrowRight size={10} weight="bold" className="text-slate-400 dark:text-slate-500" />
              <span className="text-slate-600 dark:text-slate-400 break-all">{t.t}</span>
              {t.matched_existing && <span className="ml-auto text-[9px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">existing</span>}
            </li>
          ))}
        </ul>
      </div>
      <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-end gap-2">
        <button onClick={onCancel} className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer bg-transparent">Cancel</button>
        <button onClick={onCommit} className="px-5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer border-none">Save &amp; Link</button>
      </div>
    </div>
  );
}

function ActionBadge({ action }) {
  if (action === 'block') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900">
        <Prohibit size={10} weight="bold" /> Block
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-transparent text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-600">
      <CheckCircle size={10} weight="bold" /> Allow
    </span>
  );
}

function StatusBadge({ status }) {
  if (status === 'blocked') {
    return <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900">Blocked</span>;
  }
  return <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">Allowed</span>;
}

export default function SettingsView() {
  const [formAgent, setFormAgent] = useState('*');
  const [formTool, setFormTool] = useState('');
  const [formAction, setFormAction] = useState('block');
  const [policies, setPolicies] = useState(INITIAL_POLICIES);

  const handleAdd = () => {
    if (!formTool.trim()) return;
    setPolicies([...policies, { id: policies.length + 1, agent: formAgent, tool_name: formTool.trim(), action: formAction }]);
    setFormTool('');
  };

  const agentOptions = ['*', ...Object.keys(AGENT_META)];
  const maxCount = Math.max(...TOOL_STATS.map((t) => t.count), 1);

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-6 pb-12">
      <div className="flex items-center gap-3">
        <Gear size={24} weight="bold" className="text-slate-400" />
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Rules of Engagement</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Hard guardrails on the autonomous attack fleet — the attacker agents recon and probe, but destructive and exfiltration tools are blocked so every run stays canary-only and in-scope.</p>
        </div>
      </div>

      <PolicyUploadCard />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Policies */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-none overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center gap-2">
            <ShieldCheck size={16} weight="bold" className="text-slate-400 dark:text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Active Policies</h3>
            <span className="ml-auto text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5">{policies.length} rules</span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
            <div className="grid grid-cols-[1fr_1fr_80px] gap-3 px-5 py-2.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">
              <span>Agent</span><span>Tool</span><span>Action</span>
            </div>
            {policies.map((policy) => (
              <div key={policy.id} className="grid grid-cols-[1fr_1fr_80px] gap-3 px-5 py-3 items-center hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                <div>
                  {policy.agent === '*' ? (
                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">All Agents</span>
                  ) : (
                    <AgentBadge agent={policy.agent} />
                  )}
                </div>
                <span className="text-[11px] font-mono font-bold text-slate-800 dark:text-slate-200">{policy.tool_name}</span>
                <ActionBadge action={policy.action} />
              </div>
            ))}
          </div>
        </div>

        {/* Tool Usage Stats */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-none overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center gap-2">
            <Wrench size={16} weight="bold" className="text-slate-400 dark:text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Tool Usage Stats</h3>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
            <div className="grid grid-cols-[1fr_80px_80px_80px] gap-3 px-5 py-2.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">
              <span>Tool</span><span>Agent</span><span className="text-right">Calls</span><span>Status</span>
            </div>
            {TOOL_STATS.map((tool) => {
              const barWidth = (tool.count / maxCount) * 100;
              return (
                <div key={tool.name} className="grid grid-cols-[1fr_80px_80px_80px] gap-3 px-5 py-3 items-center hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <div>
                    <span className="text-[11px] font-mono font-bold text-slate-800 dark:text-slate-200">{tool.name}</span>
                    <div className="h-1 w-full bg-slate-100 dark:bg-slate-800 mt-1.5 overflow-hidden">
                      <div className={`h-full ${tool.status === 'blocked' ? 'bg-slate-300 dark:bg-slate-700' : 'bg-slate-500 dark:bg-slate-400'}`} style={{ width: `${barWidth}%` }} />
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-500 font-bold">{tool.agent}</span>
                  <span className="text-[11px] font-mono font-bold text-slate-800 dark:text-slate-200 text-right">{tool.count}</span>
                  <StatusBadge status={tool.status} />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Add Policy Form */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-none overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center gap-2">
          <Plus size={16} weight="bold" className="text-slate-400 dark:text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Add Policy</h3>
        </div>
        <div className="p-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
            <div className="flex-1 w-full sm:w-auto">
              <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">Agent</label>
              <select value={formAgent} onChange={(e) => setFormAgent(e.target.value)} className="w-full px-3 py-2 text-[11px] font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 cursor-pointer rounded-none">
                {agentOptions.map((a) => (
                  <option key={a} value={a}>{a === '*' ? 'All Agents (*)' : AGENT_META[a]?.label || a}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 w-full sm:w-auto">
              <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">Tool Name</label>
              <select value={formTool} onChange={(e) => setFormTool(e.target.value)} className="w-full px-3 py-2 text-[11px] font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-none cursor-pointer">
                <option value="">Select tool...</option>
                {PRESET_TOOLS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">Action</label>
              <div className="flex">
                <button onClick={() => setFormAction('block')} className={`px-4 py-2 text-[10px] font-bold uppercase tracking-wider border cursor-pointer transition-colors rounded-none ${formAction === 'block' ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 border-slate-800 dark:border-slate-200' : 'bg-transparent text-slate-500 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>Block</button>
                <button onClick={() => setFormAction('allow')} className={`px-4 py-2 text-[10px] font-bold uppercase tracking-wider border border-l-0 cursor-pointer transition-colors rounded-none ${formAction === 'allow' ? 'bg-slate-400 dark:bg-slate-500 text-white border-slate-400 dark:border-slate-500' : 'bg-transparent text-slate-500 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>Allow</button>
              </div>
            </div>
            <button onClick={handleAdd} disabled={!formTool.trim()} className={`px-5 py-2 text-[11px] font-bold uppercase tracking-wider transition-colors cursor-pointer rounded-none border-none ${formTool.trim() ? 'bg-slate-800 dark:bg-slate-200 hover:bg-slate-700 dark:hover:bg-white text-white dark:text-slate-900' : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'}`}>Add Rule</button>
          </div>
        </div>
      </div>
    </div>
  );
}
