import { Browser, DeviceMobile, AirplaneTilt, Buildings, ShieldCheck } from '@phosphor-icons/react';

// Identity art for the arena's fictional companies.
//
// Colour discipline: the range itself is monochrome — marks render in slate so
// the board reads as one calm list. Brand colour only switches on once you are
// INSIDE a target, where it belongs to that company's world rather than to the
// arena chrome. Pass `brand` to light a mark up; omit it for the grey state.

const MARKS = {
  // Northwind Bank — a shield, quartered.
  shield: (
    <>
      <path d="M12 2.5 21 6v6.2c0 5.2-3.6 8.4-9 9.3-5.4-.9-9-4.1-9-9.3V6l9-3.5Z" fill="none" strokeWidth="1.6" />
      <path d="M12 3v18" strokeWidth="1.1" opacity="0.55" />
      <path d="M3.6 11h16.8" strokeWidth="1.1" opacity="0.55" />
    </>
  ),
  // Maple Pharmacy — an apothecary cross.
  cross: (
    <>
      <rect x="3.2" y="3.2" width="17.6" height="17.6" rx="1" fill="none" strokeWidth="1.6" />
      <path d="M12 7.4v9.2M7.4 12h9.2" strokeWidth="2" strokeLinecap="square" />
    </>
  ),
  // Meridian Air — a swept wing.
  wing: (
    <>
      <path d="M2.5 15.5 21 4.5l-4.2 9.2-6.1 1.1-1.5 5-2.1-4.2-4.6-.1Z" fill="none" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M21 4.5 10.7 14.8" strokeWidth="1.1" opacity="0.5" />
    </>
  ),
  // Harborline Residential — a key.
  key: (
    <>
      <circle cx="8" cy="8" r="4.4" fill="none" strokeWidth="1.6" />
      <path d="M11.2 11.2 20.5 20.5" strokeWidth="1.6" strokeLinecap="square" />
      <path d="M16.4 16.4 14 18.8M18.6 18.6 16.2 21" strokeWidth="1.4" strokeLinecap="square" />
    </>
  ),
  // Aegis Mutual — a closed padlock.
  lock: (
    <>
      <rect x="4.2" y="10.4" width="15.6" height="10.4" rx="1" fill="none" strokeWidth="1.6" />
      <path d="M7.8 10.4V7.6a4.2 4.2 0 0 1 8.4 0v2.8" fill="none" strokeWidth="1.6" />
      <path d="M12 14.2v3" strokeWidth="1.6" strokeLinecap="round" />
    </>
  ),
};

export function Mark({ name, brand, size = 24, className = '' }) {
  const glyph = MARKS[name] || MARKS.shield;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      stroke={brand || 'currentColor'}
      fill="none"
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      {glyph}
    </svg>
  );
}

// Where you'd actually meet this agent. Used to skin the transcript so a
// pharmacy SMS thread doesn't look like a claims portal.
export const CHANNELS = {
  'web-chat': { icon: Browser, label: 'Web chat' },
  sms: { icon: DeviceMobile, label: 'SMS' },
  'app-chat': { icon: AirplaneTilt, label: 'In-app chat' },
  portal: { icon: Buildings, label: 'Portal' },
};

export const channelOf = (key) => CHANNELS[key] || CHANNELS['web-chat'];

// Difficulty as a four-segment meter — carries weight without spending colour.
const STEPS = { warmup: 1, standard: 2, hard: 3, brutal: 4 };

export function DifficultyMeter({ level, tone = 'slate' }) {
  const steps = STEPS[level] || 2;
  const on = tone === 'light' ? 'bg-white/80' : 'bg-slate-600 dark:bg-slate-300';
  const off = tone === 'light' ? 'bg-white/25' : 'bg-slate-200 dark:bg-slate-700';
  return (
    <span className="inline-flex items-center gap-[2px]" aria-label={`difficulty: ${level}`}>
      {[1, 2, 3, 4].map((i) => (
        <span key={i} className={`w-[3px] h-[10px] ${i <= steps ? on : off}`} />
      ))}
    </span>
  );
}

export { ShieldCheck };
