import { useState, useEffect, useId } from 'react';
import {
  X,
  Play,
  BookmarkSimple,
  Globe,
  Phone,
  TerminalWindow,
  Copy,
  Check,
  ShieldCheck,
  ShieldWarning,
  Info,
  CircleNotch
} from '@phosphor-icons/react';

function extractDomain(urlStr) {
  if (!urlStr) return '';
  try {
    const formatted = urlStr.startsWith('http://') || urlStr.startsWith('https://') || urlStr.startsWith('ws://') || urlStr.startsWith('wss://')
      ? urlStr
      : `https://${urlStr}`;
    const parsed = new URL(formatted);
    return parsed.hostname;
  } catch {
    return '';
  }
}

export default function NewRunModal({
  isOpen,
  onClose,
  onStartRun,
  onSaveDraft,
  initialDraft = null,
}) {
  const generatedTokenSuffix = useId().replace(/[:]/g, '');
  const [name, setName] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [phone, setPhone] = useState('');
  const [customDomain, setCustomDomain] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [validationError, setValidationError] = useState('');
  // Kept above the early return so the hook order is stable across renders.
  const [randomNonce] = useState(() => (Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)).slice(0, 24));

  // Hydrate draft or reset on open
  useEffect(() => {
    if (isOpen) {
      if (initialDraft) {
        setName(initialDraft.name || '');
        setEndpoint(initialDraft.endpoint || '');
        setPhone(initialDraft.phone || '');
        setCustomDomain(initialDraft.customDomain || '');
        setIsVerified(Boolean(initialDraft.isVerified));
      } else {
        setName(`run-${new Date().toISOString().slice(0, 10)}-${Math.floor(100 + Math.random() * 900)}`);
        setEndpoint('');
        setPhone('');
        setCustomDomain('');
        setIsVerified(false);
      }
      setIsStarting(false);
      setIsVerifying(false);
      setValidationError('');
    }
  }, [isOpen, initialDraft]);

  if (!isOpen) return null;

  const targetDomain = customDomain.trim() || extractDomain(endpoint) || 'target-agent.internal';
  const verificationToken = initialDraft?.verificationToken || `bastion-site-verification=bst_${randomNonce}`;

  const handleCopyToken = () => {
    navigator.clipboard.writeText(verificationToken);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const handleVerifyDomain = async () => {
    if (!endpoint && !customDomain) {
      setValidationError('Enter an LLM agent endpoint or domain first.');
      return;
    }
    setValidationError('');
    setIsVerifying(true);

    try {
      const res = await fetch('/api/verify-domain', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          domain: targetDomain,
          token: verificationToken,
        }),
      });

      const data = await res.json();
      if (data.verified) {
        setIsVerified(true);
        setValidationError('');
      } else {
        setIsVerified(false);
        setValidationError(data.error || 'Verification token not found in DNS TXT records.');
      }
    } catch (err) {
      setValidationError(`Verification request failed: ${err.message || err}`);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSaveForLater = () => {
    if (isStarting) return; // Unclickable if run has started
    const draftData = {
      name: name.trim() || 'Untitled Run Draft',
      endpoint: endpoint.trim(),
      phone: phone.trim(),
      customDomain: customDomain.trim(),
      verificationToken,
      isVerified,
      savedAt: Date.now(),
    };
    onSaveDraft?.(draftData);
    onClose?.();
  };

  const handleStart = async () => {
    if (!endpoint.trim()) {
      setValidationError('Please specify the LLM agent endpoint before starting.');
      return;
    }
    setValidationError('');
    setIsStarting(true);

    let verifiedStatus = isVerified;

    // Real-time pre-flight verification check on launch
    try {
      const res = await fetch('/api/verify-domain', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          domain: targetDomain,
          token: verificationToken,
        }),
      });
      const data = await res.json();
      if (data.verified) {
        verifiedStatus = true;
      }
    } catch {
      // Continue with current verifiedStatus if network/offline
    }

    const runConfig = {
      name: name.trim() || `run-${targetDomain}`,
      platform: 'custom-target',
      endpoint: endpoint.trim(),
      phone: phone.trim(),
      domain: targetDomain,
      verificationToken,
      isVerified: verifiedStatus,
      startedAt: new Date().toISOString(),
    };

    setTimeout(() => {
      onStartRun?.(runConfig);
      onClose?.();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-[2px] transition-opacity"
        onClick={() => !isStarting && onClose?.()}
      />

      {/* Dialog Card */}
      <div className="relative w-full max-w-2xl bg-white dark:bg-[#0f172a] border border-slate-300 dark:border-slate-700 shadow-2xl z-10 my-auto text-slate-800 dark:text-slate-200">
        
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center font-bold text-xs">
              <TerminalWindow size={16} weight="bold" />
            </div>
            <div>
              <h2 className="text-[14px] font-semibold text-slate-900 dark:text-white tracking-tight uppercase">
                Configure New Adversarial Run
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Deploy Bastion swarm agents to red-team your LLM endpoint
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isStarting}
            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-5 text-[13px]">
          {validationError && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-[12px]">
              <ShieldWarning size={16} className="shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Target / Run Name */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Run Identifier / Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isStarting}
              placeholder="e.g. production-support-bot-v2"
              className="w-full h-10 px-3 border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0b1120] text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-slate-500 transition-colors"
            />
          </div>

          {/* LLM Agent Endpoint (Required) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                LLM Agent Endpoint <span className="text-rose-500">*</span>
              </label>
              <span className="text-[10px] text-slate-400">HTTP REST or WebSocket URL</span>
            </div>
            <div className="flex items-center border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0b1120] px-3 h-10">
              <Globe size={15} className="text-slate-400 shrink-0 mr-2" />
              <input
                type="url"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                disabled={isStarting}
                placeholder="https://api.yourdomain.com/v1/chat/completions"
                className="flex-1 bg-transparent text-[13px] text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
              />
            </div>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              Target endpoint where Bastion swarm agents will send structured conversational probes and tool payloads.
            </p>
          </div>

          {/* Phone Number (Optional) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Phone Number <span className="text-[10px] font-normal text-slate-400">(Optional)</span>
              </label>
              <span className="text-[10px] text-slate-400">Voice agent testing & incident alerts</span>
            </div>
            <div className="flex items-center border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0b1120] px-3 h-10">
              <Phone size={15} className="text-slate-400 shrink-0 mr-2" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={isStarting}
                placeholder="+1 (555) 019-2834"
                className="flex-1 bg-transparent text-[13px] text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
              />
            </div>
          </div>

          {/* Domain Verification Panel */}
          <div className="border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0b1120]/60 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className={isVerified ? 'text-emerald-500' : 'text-slate-400'} />
                <span className="text-[12px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  Domain Ownership Verification
                </span>
              </div>
              <span
                className={`text-[10px] uppercase tracking-widest px-2 py-0.5 font-semibold ${
                  isVerified
                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                    : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                }`}
              >
                {isVerified ? 'Verified Domain' : 'Verification Required'}
              </span>
            </div>
            
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">
              To assure authorization, verify that you own <strong className="text-slate-700 dark:text-slate-300">{targetDomain}</strong> by adding a DNS TXT record to your domain.
            </p>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                <span>DNS TXT Record Value:</span>
                <span className="text-[10px] text-slate-400">Host: @ or {targetDomain}</span>
              </div>
              
              <div className="flex items-center gap-2">
                <div className="flex-1 font-mono text-[11px] bg-white dark:bg-[#060b14] border border-slate-300 dark:border-slate-700 px-3 py-2 text-slate-800 dark:text-slate-200 select-all truncate">
                  {verificationToken}
                </div>
                <button
                  type="button"
                  onClick={handleCopyToken}
                  className="px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 text-[11px] font-medium inline-flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
                >
                  {copiedToken ? (
                    <>
                      <Check size={13} className="text-emerald-500" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy size={13} />
                      <span>Copy TXT</span>
                    </>
                  )}
                </button>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  <Info size={13} />
                  <span>Checks DNS TXT records for {targetDomain}.</span>
                </div>
                <button
                  type="button"
                  onClick={handleVerifyDomain}
                  disabled={isVerifying || isVerified || isStarting}
                  className={`px-3 py-1.5 text-[11px] font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                    isVerified
                      ? 'bg-emerald-600 text-white cursor-default'
                      : isVerifying
                      ? 'bg-slate-200 dark:bg-slate-800 text-slate-500 cursor-wait'
                      : 'border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {isVerifying && <CircleNotch size={12} className="animate-spin" />}
                  {isVerified ? (
                    <>
                      <Check size={12} weight="bold" /> Domain Verified
                    </>
                  ) : (
                    'Verify Ownership'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer with Action Buttons in Corner */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
          <button
            type="button"
            onClick={onClose}
            disabled={isStarting}
            className="text-[12px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>

          {/* Corner Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveForLater}
              disabled={isStarting}
              title={isStarting ? 'Cannot save once run is launched' : 'Save draft inputs for later'}
              className={`inline-flex items-center gap-1.5 px-4 h-9 text-[12px] font-medium border border-slate-300 dark:border-slate-700 transition-colors ${
                isStarting
                  ? 'bg-slate-100 dark:bg-slate-800/40 text-slate-400 dark:text-slate-600 cursor-not-allowed border-dashed'
                  : 'bg-white dark:bg-[#0f172a] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer'
              }`}
            >
              <BookmarkSimple size={14} weight="bold" />
              <span>Save for later</span>
            </button>

            <button
              type="button"
              onClick={handleStart}
              disabled={isStarting}
              className={`inline-flex items-center gap-1.5 px-5 h-9 text-[12px] font-medium transition-colors ${
                isStarting
                  ? 'bg-blue-600 text-white cursor-wait'
                  : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 cursor-pointer'
              }`}
            >
              {isStarting ? (
                <>
                  <CircleNotch size={14} className="animate-spin" />
                  <span>Launching Swarm…</span>
                </>
              ) : (
                <>
                  <Play size={14} weight="fill" />
                  <span>Start Run</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
