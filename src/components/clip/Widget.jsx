import { motion } from 'framer-motion';
import { CaretLeft, ArrowUpRight } from '@phosphor-icons/react';

// Widget menu uses tiles; clicking a tile opens its full page. A page has a
// Back control that returns to the menu. Neutral by design — colour is
// reserved for identity, never decoration.

export function WidgetTile({ icon: Icon, title, onOpen }) {
  return (
    <button
      onClick={onOpen}
      className="group w-[248px] h-[120px] flex flex-col justify-between p-4 text-left border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a] hover:border-slate-400 dark:hover:border-slate-600 transition-colors cursor-pointer"
    >
      <div className="flex items-start justify-between">
        {Icon && <Icon size={20} weight="duotone" className="text-slate-500 dark:text-slate-400" />}
        <ArrowUpRight size={14} weight="bold" className="text-slate-300 dark:text-slate-600 group-hover:text-slate-500 dark:group-hover:text-slate-400 transition-colors" />
      </div>
      <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">{title}</span>
    </button>
  );
}

export function WidgetPage({ title, onBack, children }) {
  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 mb-5 text-[11px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer bg-transparent border-0 p-0"
      >
        <CaretLeft size={13} weight="bold" /> Back
      </button>
      <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight mb-4">{title}</h2>
      {children}
    </motion.div>
  );
}
