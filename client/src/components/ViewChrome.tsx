// ─────────────────────────────────────────────────────────────────
// v15.4 — Column 2 top chrome: View-selector dropdown + Smart-toggle.
//
// Used by Mail / Calendar / Docs surfaces. Same component, surface-
// specific items wired via props.
// ─────────────────────────────────────────────────────────────────
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  Sparkles,
  Inbox,
  Clock,
  CircleCheck,
  Send,
  FileEdit,
  Ban,
  Calendar,
  CalendarRange,
  CalendarDays,
  CalendarClock,
  FileClock,
  Pin,
  Share2,
  LayoutTemplate,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { useStilt, type MailView, type CalView, type DocsView } from '@/state/StiltContext';
import { APPLE_SPRING } from '@/lib/motion';
import { VadikGlassSurface } from './VadikGlassSurface';
import { VadikLiquidMenu } from './VadikLiquidMenu';

// ─────────────────────────────────────────────────────────────────
// Per-surface view definitions.
// ─────────────────────────────────────────────────────────────────
export interface ViewOption<K extends string = string> {
  key: K;
  label: string;
  icon: LucideIcon;
  tint?: string;
}

// v30.31 — Perplexity stijl: monochrome view-options, geen iOS
// systeem-tints. Tints worden voor mail/cal/docs niet meer gezet.
export const MAIL_VIEW_OPTIONS: ViewOption<MailView>[] = [
  { key: 'inbox',   label: 'Inbox',   icon: Inbox },
  { key: 'snoozed', label: 'Snoozed', icon: Clock },
  { key: 'sent',    label: 'Sent',    icon: Send },
  { key: 'done',    label: 'Done',    icon: CircleCheck },
  { key: 'drafts',  label: 'Drafts',  icon: FileEdit },
  { key: 'spam',    label: 'Spam',    icon: Ban },
];

export const CAL_VIEW_OPTIONS: ViewOption<CalView>[] = [
  { key: 'today',    label: 'Today',     icon: Calendar },
  { key: 'week',     label: 'This week', icon: CalendarRange },
  { key: 'month',    label: 'Month',     icon: CalendarDays },
  { key: 'upcoming', label: 'Upcoming',  icon: CalendarClock },
];

export const DOCS_VIEW_OPTIONS: ViewOption<DocsView>[] = [
  { key: 'recent',    label: 'Recent',    icon: FileClock },
  { key: 'pinned',    label: 'Pinned',    icon: Pin },
  { key: 'shared',    label: 'Shared',    icon: Share2 },
  { key: 'templates', label: 'Templates', icon: LayoutTemplate },
  { key: 'trash',     label: 'Trash',     icon: Trash2 },
];

// ─────────────────────────────────────────────────────────────────
// View-selector dropdown pill.
// ─────────────────────────────────────────────────────────────────
export function ViewSelectorPill<K extends string>({
  value,
  onChange,
  options,
  testId = 'view-selector',
}: {
  value: K;
  onChange: (k: K) => void;
  options: ViewOption<K>[];
  testId?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.key === value) || options[0];
  const Icon = current.icon;

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', handle);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  // v30.10 — Inbox/View dropdown pill: vervangen door VadikGlassSurface
  // capsule (zelfde recipe als alle andere glass elementen die werken).
  // De button zelf is een transparante click-target waarbinnen de Surface
  // het visuele werk doet. Dropdown panel óók via VadikGlassSurface met
  // custom radius (24px ronding zoals voorheen) zodat alles consistent is.
  return (
    <div ref={ref} className="relative">
      <button
        data-testid={`${testId}-pill`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          background: 'transparent',
          border: 'none',
          padding: 0,
          margin: 0,
          cursor: 'pointer',
          appearance: 'none',
          WebkitAppearance: 'none',
        }}
      >
        <VadikGlassSurface width="auto" height={52}>
          <span className="flex items-center gap-2 px-4 text-[14px] font-medium tracking-[-0.005em]">
            <Icon
              size={16}
              strokeWidth={1.8}
              style={current.tint ? { color: current.tint } : undefined}
              className={!current.tint ? 'text-icon' : ''}
            />
            <span>{current.label}</span>
            <motion.span
              animate={{ rotate: open ? 180 : 0 }}
              transition={{ duration: 0.18 }}
              className="text-icon-muted"
            >
              <ChevronDown size={15} strokeWidth={1.8} />
            </motion.span>
          </span>
        </VadikGlassSurface>
      </button>
      <AnimatePresence>
        {open && (
          // v30.27 — Open-animatie versimpeld tot alleen translate-Y +
          // fade. Scale weggehaald omdat die op het glass element een
          // "eerst doorzichtig dan glass" stotter gaf (twee transitions
          // over elkaar). Nu komt het glass direct correct in beeld.
          <motion.div
            data-testid={`${testId}-dropdown`}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16, ease: [0.4, 0, 0.2, 1] }}
            className="absolute top-[58px] left-0 z-50 min-w-[200px]"
            role="listbox"
          >
            <VadikLiquidMenu
              testId={testId}
              options={options}
              value={value}
              onChange={(k) => {
                // v30.27 — setOpen(false) delayen tot na de slide-
                // animatie (~440ms) zodat je de indicator naar het
                // gekozen item ziet glijden voordat de dropdown sluit.
                onChange(k);
                window.setTimeout(() => setOpen(false), 360);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Smart-toggle global pill.
// ─────────────────────────────────────────────────────────────────
export function SmartTogglePill() {
  const { smartMode, setSmartMode } = useStilt();
  return (
    <button
      data-testid="smart-toggle-pill"
      onClick={() => setSmartMode(!smartMode)}
      aria-pressed={smartMode}
      aria-label={smartMode ? 'Smart mode on' : 'Smart mode off'}
      className={`h-[52px] px-4 rounded-full flex items-center gap-2 text-[14px] font-medium tracking-[-0.005em] active-elevate-2 transition-colors ${
        smartMode
          ? 'glass-pill text-foreground'
          : 'glass-pill text-foreground/60'
      }`}
      style={
        smartMode
          ? {
              boxShadow:
                'inset 0 1px 0 rgba(255,255,255,1), inset 0 -1px 0 rgba(0,0,0,0.06), inset 0 0 0 1px rgba(167,139,250,0.28), 0 12px 32px rgba(99,102,241,0.10), 0 4px 12px rgba(0,0,0,0.04)',
            }
          : undefined
      }
    >
      <Sparkles
        size={15}
        strokeWidth={1.9}
        className={smartMode ? 'text-foreground' : 'text-foreground/45'}
      />
      <span>Smart</span>
    </button>
  );
}

// v30.30 — ColumnTopChrome verwijderd. Werd nergens meer gebruikt sinds
// Mail/Calendar/Docs view-selectors verhuisd zijn naar Universal Search.
