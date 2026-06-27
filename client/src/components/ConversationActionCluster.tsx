import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CircleCheck, Clock, Sparkles } from 'lucide-react';
import { APPLE_SPRING } from '@/lib/motion';

// ─────────────────────────────────────────────────────────────────
// v17 — ConversationActionCluster
//
// The 3-pill cluster shown on every mail-detail view (top-right):
//
//   [ Done ]  [ Snooze ]  [ Context ]
//
//   • Done    → CircleCheck (emerald-500), commits like swipe-Done
//   • Snooze  → Clock       (amber-500),   opens a small picker
//   • Context → Sparkles    (purple),      toggles RightSidePanel
//
// All three are 52×52 .lg-pill recipe with hover/active states from
// the shared system. Tooltip on hover shows the keyboard shortcut.
//
// 8px gap between pills. Caller positions the cluster (e.g. absolute
// top:16 right:16 inside the mail-detail view).
// ─────────────────────────────────────────────────────────────────

export interface ConversationActionClusterProps {
  onDone: () => void;
  onSnooze: (key: SnoozeKey) => void;
  onToggleContext: () => void;
  contextActive?: boolean;
  /** Optional className applied to the wrapping flex row. */
  className?: string;
  /** v17 — pass smaller (44px) cluster used in mobile top-chrome slot. */
  compact?: boolean;
}

export type SnoozeKey = 'later-today' | 'tomorrow' | 'next-week' | 'pick';

const SNOOZE_OPTIONS: { key: SnoozeKey; label: string; hint: string }[] = [
  { key: 'later-today', label: 'Later today', hint: '6pm' },
  { key: 'tomorrow', label: 'Tomorrow', hint: '9am' },
  { key: 'next-week', label: 'Next week', hint: 'Mon 9am' },
  { key: 'pick', label: 'Pick a date', hint: '' },
];

function Pill({
  testId,
  label,
  ariaPressed,
  onClick,
  children,
  active,
}: {
  testId: string;
  label: string;
  ariaPressed?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div
      className="relative"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button
        data-testid={testId}
        type="button"
        aria-label={label}
        aria-pressed={ariaPressed}
        onClick={onClick}
        className={`lg-pill h-[52px] w-[52px] rounded-full flex items-center justify-center text-icon ${
          active ? 'lg-strong' : ''
        }`}
      >
        {children}
      </button>
      {/* v30.34 — Hover-tooltip weggehaald. Voelt als desktop chrome, en
         de Done/Snooze/Forward iconen spreken voor zichzelf. aria-label
         blijft staan voor screen readers. */}
      <AnimatePresence>
        {false && hover && (
          <motion.div key="tip" />
        )}
      </AnimatePresence>
    </div>
  );
}

export function ConversationActionCluster({
  onDone,
  onSnooze,
  onToggleContext,
  contextActive,
  className,
}: ConversationActionClusterProps) {
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const snoozeWrapRef = useRef<HTMLDivElement>(null);

  // Close snooze picker on outside click / Escape
  useEffect(() => {
    if (!snoozeOpen) return;
    const onPointer = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (snoozeWrapRef.current && !snoozeWrapRef.current.contains(t)) {
        setSnoozeOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSnoozeOpen(false);
    };
    document.addEventListener('pointerdown', onPointer, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [snoozeOpen]);

  return (
    <div
      className={`flex items-center gap-2 ${className ?? ''}`}
      data-testid="mail-action-cluster"
    >
      {/* Done */}
      <Pill testId="button-done" label="Done · E" onClick={onDone}>
        <CircleCheck size={19} strokeWidth={1.75} className="text-icon" />
      </Pill>

      {/* Snooze (with picker) */}
      <div ref={snoozeWrapRef} className="relative">
        <Pill
          testId="button-snooze"
          label="Snooze · S"
          ariaPressed={snoozeOpen}
          onClick={() => setSnoozeOpen((v) => !v)}
        >
          <Clock size={19} strokeWidth={1.75} className="text-icon" />
        </Pill>
        <AnimatePresence>
          {snoozeOpen && (
            <motion.div
              data-testid="snooze-picker"
              initial={{ opacity: 0, y: -6, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.95 }}
              transition={APPLE_SPRING}
              style={{ transformOrigin: 'top right' }}
              className="absolute top-[60px] right-0 z-50 lg-sheet rounded-2xl p-1.5 min-w-[200px]"
            >
              <div className="flex flex-col gap-0.5">
                {SNOOZE_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    data-testid={`snooze-opt-${opt.key}`}
                    onClick={() => {
                      setSnoozeOpen(false);
                      onSnooze(opt.key);
                    }}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13.5px] font-medium hover-elevate active-elevate-2 text-left text-foreground/85"
                  >
                    <Clock size={14} strokeWidth={1.7} className="text-icon-muted shrink-0" />
                    <span className="flex-1">{opt.label}</span>
                    {opt.hint && (
                      <span className="text-[11.5px] text-muted-foreground tabular-nums">
                        · {opt.hint}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Context */}
      <Pill
        testId="button-context"
        label="Context · I"
        ariaPressed={!!contextActive}
        active={contextActive}
        onClick={onToggleContext}
      >
        <Sparkles size={19} strokeWidth={1.75} className="text-icon-accent" />
      </Pill>
    </div>
  );
}
