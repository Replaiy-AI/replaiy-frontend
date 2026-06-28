// ─────────────────────────────────────────────────────────────────
// v19 — Middle-pill desktop chrome.
//
// Top row of column 2 (mail-detail) is now four floating glass pills
// + the Inbox dropdown in column 1, all on the same horizontal
// baseline (top=12px, h=52px):
//
//   [Inbox ▾]   [👤 Name]   [Subject: …   ·5 messages · 3 days·]   [✓] [⏰]
//    col 1      Avatar      Subject pill (meta-badge inside)         actions
//
// Exports:
//   • IdentityPill     — avatar + name (clickable → Contact sheet)
//   • SubjectPill      — Subject label + subject text + clickable meta-badge
//   • ConversationActionPills  — two action pills (Done, Snooze). NO Sparkle.
//
// Each component is its own `.lg-pill` floating element. The parent
// is responsible for layout and gap. Sticky behavior is applied at
// the call site so the parent can decide which container is the
// scroll context.
// ─────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CircleCheck, Clock, CornerUpRight, MoreHorizontal } from 'lucide-react';
import { APPLE_SPRING } from '@/lib/motion';
import { ReplaiyAvatar } from './Avatar';
import type { SnoozeKey } from './ConversationActionCluster';
import VadikGlass from './VadikGlass';

const SNOOZE_OPTIONS: { key: SnoozeKey; label: string; hint: string }[] = [
  { key: 'later-today', label: 'Later today', hint: '6pm' },
  { key: 'tomorrow', label: 'Tomorrow', hint: '9am' },
  { key: 'next-week', label: 'Next week', hint: 'Mon 9am' },
  { key: 'pick', label: 'Pick a date', hint: '' },
];

// ─── Identity pill ────────────────────────────────────────────────
// v19 — Slimmed: avatar + name only. No email line, no thread-count
// badge (thread meta moved to SubjectPill). 52px tall to match the
// rest of the top-row baseline.
export function IdentityPill({
  name,
  avatar,
  // Back-compat: callers used to pass meta + threadCount. We swallow
  // them silently — the meta-badge now lives on SubjectPill.
  meta: _meta,
  onOpenContact,
  threadCount: _threadCount,
}: {
  name: string;
  avatar?: string;
  meta?: string;
  onOpenContact: () => void;
  threadCount?: number;
}) {
  return (
    // v30.30 — Plain identity (geen capsule background). iMessage style.
    <button
      type="button"
      data-testid="toolbar-identity"
      onClick={onOpenContact}
      className="inline-flex items-center gap-2.5 px-1 h-[52px] hover:opacity-80 transition-opacity"
      aria-label={`Open contact details for ${name}`}
    >
      <ReplaiyAvatar name={name} src={avatar} size={36} />
      <span className="text-[14px] font-semibold tracking-[-0.005em] text-foreground truncate max-w-[180px]">
        {name}
      </span>
    </button>
  );
}

// ─── Subject + Identity combined pill (v30.32) ───────────────────
// Eén pill die avatar + naam + verticale divider + subject + meta-badge
// bevat. Vervangt het oude patroon van IdentityPill + SubjectPill naast
// elkaar (gaf druk silhouet, "Subject:" cruft label, en de naam werd
// regelmatig afgekapt door de pill ernaast).
//
// Mobile: gebruikt nog IdentityPill standalone (kleine surface).
// Desktop chrome: gebruikt deze SubjectIdentityPill.
export function SubjectIdentityPill({
  name,
  avatar,
  subject,
  metaLabel,
  onMetaClick,
  metaActive,
  onIdentityClick,
  identityActive,
}: {
  name: string;
  avatar?: string;
  subject: string;
  metaLabel?: string | null;
  onMetaClick?: () => void;
  metaActive?: boolean;
  /** When set, the identity zone (avatar + name) becomes a button that
   *  toggles the Lead context panel. */
  onIdentityClick?: () => void;
  identityActive?: boolean;
}) {
  // v30.32 — Pill gebruikt nu VadikGlass shape="pill" (zelfde recipe
  // als de Done/Snooze/More action-buttons rechts). Was eerder lg-pill
  // class — die gaf een platter silhouet dan de VadikGlass-buttons
  // ernaast, waardoor het oogde alsof het geen glass-pill was.
  //
  // VadikGlass children worden via z-index 1 boven de glass-layers
  // gerenderd; we wrappen alles in een flex-row binnen de glass.
  return (
    <VadikGlass
      width={420}
      height={52}
      shape="pill"
      data-testid="subject-identity-pill"
      wrapperStyle={{ flex: 1, maxWidth: 640, minWidth: 0 }}
    >
      <div className="flex items-center w-full h-full pl-1.5 pr-1.5">
        {/* Identity zone. When onIdentityClick is set it toggles the Lead
           context panel (the chip IS the panel trigger). Otherwise it is
           a plain, non-interactive identity. */}
        {onIdentityClick ? (
          <button
            type="button"
            data-testid="toolbar-identity"
            onClick={onIdentityClick}
            aria-pressed={!!identityActive}
            aria-label="Toggle lead context"
            className="inline-flex items-center gap-2.5 h-[42px] px-2.5 rounded-full shrink-0 transition-transform hover:scale-[1.02] active:scale-[0.98] hover-elevate active-elevate-2"
          >
            <ReplaiyAvatar name={name} src={avatar} size={32} />
            <span className="text-[14px] font-semibold tracking-[-0.005em] text-foreground truncate max-w-[160px]">
              {name}
            </span>
          </button>
        ) : (
          <div
            data-testid="toolbar-identity"
            className="inline-flex items-center gap-2.5 h-[42px] px-2.5 rounded-full shrink-0"
          >
            <ReplaiyAvatar name={name} src={avatar} size={32} />
            <span className="text-[14px] font-semibold tracking-[-0.005em] text-foreground truncate max-w-[160px]">
              {name}
            </span>
          </div>
        )}

        {/* Vertical hairline divider */}
        <div
          aria-hidden
          className="shrink-0 mx-1"
          style={{ width: 1, height: 26, background: 'hsl(var(--foreground) / 0.10)' }}
        />

        {/* Subject + meta zone */}
        <div className="flex items-center gap-2 min-w-0 flex-1 pl-2 pr-1">
          <span
            data-testid="subject-text"
            className="text-[14px] font-semibold tracking-[-0.005em] text-foreground truncate min-w-0 flex-1"
            title={subject}
          >
            {subject}
          </span>
          {metaLabel && (
            <button
              type="button"
              data-testid="thread-meta-badge"
              onClick={onMetaClick}
              aria-pressed={!!metaActive}
              aria-label={`${metaLabel} — open summary (I)`}
              className={`shrink-0 inline-flex items-center gap-1.5 h-[34px] rounded-full px-3 text-[12px] font-medium tabular-nums whitespace-nowrap transition-transform hover:scale-[1.03] active:scale-[0.98] hover-elevate active-elevate-2 ${
                metaActive
                  ? 'lg-strong text-foreground'
                  : 'bg-foreground/[0.06] dark:bg-white/[0.08] text-foreground/75'
              }`}
            >
              {metaLabel}
            </button>
          )}
        </div>
      </div>
    </VadikGlass>
  );
}

// ─── Subject pill ─────────────────────────────────────────────────
// LEGACY: behouden voor backward-compat. Gebruik bij voorkeur
// SubjectIdentityPill voor desktop chrome.
// v19 NEW. Sits to the right of IdentityPill, flex-grows to fill the
// available horizontal space (capped at 640px), and contains:
//   • "Subject:" label (muted)
//   • email subject (truncates)
//   • inset meta-badge "5 messages · 3 days" — CLICKABLE, opens summary
//
// The subject text itself is non-interactive. Only the meta-badge has
// a click target. Hover state on the meta-badge swaps to .lg-strong so
// it reads as a button.
export function SubjectPill({
  subject,
  metaLabel,
  onMetaClick,
  metaActive,
}: {
  subject: string;
  /** e.g. "5 messages · 3 days" or "Just now". Falsy → no badge. */
  metaLabel?: string | null;
  onMetaClick?: () => void;
  /** When the summary panel is open, the meta-badge stays "lit". */
  metaActive?: boolean;
}) {
  return (
    <div
      data-testid="subject-pill"
      className="lg-pill inline-flex items-center gap-2.5 h-[52px] rounded-full pl-4 pr-1.5 py-1 min-w-0 flex-1 max-w-[420px]"
    >
      <span className="text-[12.5px] font-medium text-muted-foreground shrink-0 tracking-[-0.005em]">
        Subject:
      </span>
      <span
        data-testid="subject-text"
        className="text-[14px] font-semibold tracking-[-0.005em] text-foreground truncate min-w-0 flex-1"
        title={subject}
      >
        {subject}
      </span>
      {metaLabel && (
        <button
          type="button"
          data-testid="thread-meta-badge"
          onClick={onMetaClick}
          aria-pressed={!!metaActive}
          aria-label={`${metaLabel} — open summary (I)`}
          className={`shrink-0 inline-flex items-center gap-1.5 h-[36px] rounded-full px-3 text-[12px] font-medium tabular-nums whitespace-nowrap transition-transform hover:scale-[1.03] active:scale-[0.98] hover-elevate active-elevate-2 ${
            metaActive
              ? 'lg-strong text-foreground'
              : 'bg-foreground/[0.06] dark:bg-white/[0.08] text-foreground/75'
          }`}
        >
          {metaLabel}
        </button>
      )}
    </div>
  );
}

// ─── Single action pill ───────────────────────────────────────────
// 52×52 round glass pill — same size as the Identity pill height so all
// pills sit on the same baseline.
export function ActionPill({
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
  return (
    <div className="relative">
      {/* v26 — Done/Snooze actiepillen krijgen de volledige Vadik
           liquid-glass behandeling. VadikGlass deelt z'n filter +
           box-shadow met de tab-pill, en bevat de iOS Safari fallback.
           v30.30 — Hover-tooltip verwijderd, aria-label blijft voor screen readers. */}
      <VadikGlass
        width={52}
        height={52}
        shape="circle"
        data-testid={testId}
        aria-label={label}
        aria-pressed={ariaPressed}
        onClick={onClick}
        wrapperStyle={
          active
            ? {
                boxShadow:
                  'inset 0 0 0 1.5px rgba(255,255,255,0.45), 0 6px 16px rgba(0,0,0,0.10)',
              }
            : undefined
        }
      >
        {children}
      </VadikGlass>
      {/* (Hover-tooltip verwijderd op verzoek) */}
      {/* sentinel om JSX-balance bestaande sluitings-tags te behouden: */}
      <AnimatePresence>
        {false && (
          <motion.div className="hidden">
            {label}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Loose action-pills row (Done · Snooze) ───────────────────────
// v19 — Sparkle/Context pill REMOVED. Summary toggling now lives on
// SubjectPill's meta-badge. Two pills with gap-2.
// v30.30 — Forward toegevoegd in dezelfde top-right row als Done en Snooze.
export function ConversationActionPills({
  onDone,
  onSnooze,
  onForward,
  order = 'done-snooze-forward',
}: {
  onDone: () => void;
  onSnooze: (key: SnoozeKey) => void;
  onForward?: () => void;
  /** v30.30 — Volgorde van de pills. Desktop = done-snooze-forward,
   *  mobile rightSlot = forward-snooze-done. */
  order?: 'done-snooze-forward' | 'forward-snooze-done';
  /** Legacy props — accepted for back-compat with older callers. */
  onToggleContext?: () => void;
  contextActive?: boolean;
}) {
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  // v30.30 — Inline kalender state (Spark/Apple Mail stijl).
  const [showCalendar, setShowCalendar] = useState(false);
  const [pickedDate, setPickedDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d;
  });
  const snoozeWrapRef = useRef<HTMLDivElement>(null);

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

  const donePill = (
    <ActionPill key="done" testId="button-done" label="Done · E" onClick={onDone}>
      <CircleCheck size={19} strokeWidth={1.75} className="text-icon" />
    </ActionPill>
  );
  const forwardPill = onForward ? (
    <ActionPill key="forward" testId="button-forward" label="Forward · F" onClick={onForward}>
      <CornerUpRight size={19} strokeWidth={1.75} className="text-icon" />
    </ActionPill>
  ) : null;
  const snoozePill = (
    <div key="snooze" ref={snoozeWrapRef} className="relative">
      <ActionPill
        testId="button-snooze"
        label="Snooze · S"
        ariaPressed={snoozeOpen}
        onClick={() => {
          setSnoozeOpen((v) => !v);
          setShowCalendar(false);
        }}
      >
        <Clock size={19} strokeWidth={1.75} className="text-icon" />
      </ActionPill>
      <AnimatePresence>
        {snoozeOpen && (
          <motion.div
            data-testid="snooze-picker"
            initial={{ opacity: 0, y: -6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.95 }}
            transition={APPLE_SPRING}
            style={{
              transformOrigin: 'top right',
              background:
                'linear-gradient(180deg, color-mix(in srgb, var(--vadik-light, #fff) calc(var(--vadik-reflex-light, 1) * 55%), transparent) 0%, color-mix(in srgb, var(--vadik-light, #fff) calc(var(--vadik-reflex-light, 1) * 40%), transparent) 60%, color-mix(in srgb, var(--vadik-light, #fff) calc(var(--vadik-reflex-light, 1) * 30%), transparent) 100%)',
              backdropFilter: 'blur(24px) saturate(160%)',
              WebkitBackdropFilter: 'blur(24px) saturate(160%)',
              boxShadow:
                'inset 0 0 0 1px color-mix(in srgb, var(--vadik-light, #fff) calc(var(--vadik-reflex-light, 1) * 50%), transparent), inset 1.8px 3px 0 -2px color-mix(in srgb, var(--vadik-light, #fff) calc(var(--vadik-reflex-light, 1) * 80%), transparent), 0 2px 8px 0 color-mix(in srgb, var(--vadik-dark, #000) calc(var(--vadik-reflex-dark, 1) * 8%), transparent), 0 12px 32px 0 color-mix(in srgb, var(--vadik-dark, #000) calc(var(--vadik-reflex-dark, 1) * 14%), transparent)',
            }}
            className="absolute top-[60px] right-0 z-50 rounded-2xl p-1.5 w-[280px]"
          >
            <div className="flex flex-col gap-0.5">
              {SNOOZE_OPTIONS.filter((opt) => opt.key !== 'pick').map((opt) => (
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
                      {opt.hint}
                    </span>
                  )}
                </button>
              ))}
              {/* Inline 'Pick a date' met expand-kalender */}
              <button
                type="button"
                data-testid="snooze-opt-pick"
                onClick={() => setShowCalendar((v) => !v)}
                aria-pressed={showCalendar}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13.5px] font-medium hover-elevate active-elevate-2 text-left text-foreground/85"
              >
                <Clock size={14} strokeWidth={1.7} className="text-icon-muted shrink-0" />
                <span className="flex-1">Pick a date</span>
                <span className="text-[11.5px] text-foreground/40 tabular-nums">
                  {showCalendar
                    ? pickedDate.toLocaleDateString(undefined, {
                        day: 'numeric',
                        month: 'short',
                      })
                    : '›'}
                </span>
              </button>
              <AnimatePresence>
                {showCalendar && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
                    className="overflow-hidden"
                  >
                    <MiniCalendar value={pickedDate} onChange={setPickedDate} />
                    <div className="flex items-center justify-end gap-1.5 px-2 pb-1">
                      <button
                        type="button"
                        onClick={() => setShowCalendar(false)}
                        className="px-3 py-1.5 rounded-full text-[12.5px] font-medium text-foreground/65 hover-elevate active-elevate-2"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        data-testid="snooze-confirm"
                        onClick={() => {
                          setSnoozeOpen(false);
                          setShowCalendar(false);
                          onSnooze('pick');
                        }}
                        className="px-3.5 py-1.5 rounded-full text-[12.5px] font-semibold bg-foreground text-background hover-elevate active-elevate-2"
                      >
                        Snooze
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  // v30.30 — Bouw pills in de juiste volgorde voor desktop vs mobile.
  const pills =
    order === 'forward-snooze-done'
      ? [forwardPill, snoozePill, donePill].filter(Boolean)
      : [donePill, snoozePill, forwardPill].filter(Boolean);

  return (
    <div
      data-testid="mail-action-pills"
      className="flex items-center gap-2"
    >
      {pills}
    </div>
  );
}

// ─── Inline mini calendar (Spark/Apple Mail stijl) ───────────────
// v30.30 — Custom kalender-grid in liquid-glass. Geen native input.
// Klein, compact, past binnen de dropdown.
function MiniCalendar({
  value,
  onChange,
}: {
  value: Date;
  onChange: (d: Date) => void;
}) {
  const [viewMonth, setViewMonth] = useState(
    new Date(value.getFullYear(), value.getMonth(), 1),
  );
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monthLabel = viewMonth.toLocaleString(undefined, {
    month: 'long',
    year: 'numeric',
  });
  // Bereken cellen: 7 kolommen, 6 rijen max. Start op maandag.
  const firstOfMonth = new Date(viewMonth);
  const startDay = (firstOfMonth.getDay() + 6) % 7; // 0=Mon
  const daysInMonth = new Date(
    viewMonth.getFullYear(),
    viewMonth.getMonth() + 1,
    0,
  ).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  return (
    <div className="px-2 pb-2 pt-1">
      <div className="flex items-center justify-between px-2 pb-1.5">
        <button
          type="button"
          onClick={() =>
            setViewMonth(
              new Date(
                viewMonth.getFullYear(),
                viewMonth.getMonth() - 1,
                1,
              ),
            )
          }
          className="h-7 w-7 rounded-full flex items-center justify-center text-foreground/60 hover-elevate active-elevate-2"
          aria-label="Previous month"
        >
          ‹
        </button>
        <span className="text-[12.5px] font-semibold text-foreground capitalize">
          {monthLabel}
        </span>
        <button
          type="button"
          onClick={() =>
            setViewMonth(
              new Date(
                viewMonth.getFullYear(),
                viewMonth.getMonth() + 1,
                1,
              ),
            )
          }
          className="h-7 w-7 rounded-full flex items-center justify-center text-foreground/60 hover-elevate active-elevate-2"
          aria-label="Next month"
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 px-1">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <div
            key={i}
            className="text-[10px] text-foreground/40 font-medium text-center h-5 flex items-center justify-center"
          >
            {d}
          </div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={i} className="h-7 w-7" />;
          const past = d < today;
          const selected = sameDay(d, value);
          const isToday = sameDay(d, today);
          return (
            <button
              key={i}
              type="button"
              disabled={past}
              onClick={() => onChange(d)}
              className={
                'h-7 w-7 rounded-full text-[12px] font-medium flex items-center justify-center transition-colors ' +
                (selected
                  ? 'bg-foreground text-background'
                  : past
                    ? 'text-foreground/25 cursor-not-allowed'
                    : isToday
                      ? 'text-foreground bg-foreground/10 hover:bg-foreground/15'
                      : 'text-foreground/80 hover:bg-foreground/10')
              }
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Compact action pills (mobile) ─────────────────────────
// v30.30 — Mobile-only compact variant: Done als enige zichtbare actie
// plus een ••• overflow dat een liquid-glass dropdown opent met Forward
// + Snooze opties + inline kalender (Spark stijl, geen modal).
export function ConversationActionPillsCompact({
  onDone,
}: {
  onDone: () => void;
  // v-replaiy-3 — onSnooze/onForward kept in the type for call-site
  // compatibility but no longer rendered. The ··· overflow (Snooze /
  // Forward / calendar) is removed: the only top-right action is ✓ Done.
  // "Wegboeken" of a draft = ✓ Done while a draft is open (reason inferred
  // or micro-asked — see learning concept). Forward doesn't exist in
  // Replaiy; Snooze added inbox clutter without a clear sales purpose.
  onSnooze?: (key: SnoozeKey) => void;
  onForward?: () => void;
}) {
  return (
    <div className="flex items-center gap-2 relative">
      <ActionPill testId="button-done" label="Done" onClick={onDone}>
        <CircleCheck size={19} strokeWidth={1.75} className="text-icon" />
      </ActionPill>
    </div>
  );
}

// ─── Back-compat shim ─────────────────────────────────────────────
interface ConversationDetailToolbarProps {
  name: string;
  meta?: string;
  onOpenContact: () => void;
  onDone: () => void;
  onSnooze: (key: SnoozeKey) => void;
  onToggleContext?: () => void;
  contextActive?: boolean;
}

export function ConversationDetailToolbar({
  name,
  onOpenContact,
  onDone,
  onSnooze,
}: ConversationDetailToolbarProps) {
  return (
    <div
      data-testid="mail-detail-toolbar"
      className="flex items-center justify-between gap-3"
    >
      <IdentityPill name={name} onOpenContact={onOpenContact} />
      <ConversationActionPills onDone={onDone} onSnooze={onSnooze} />
    </div>
  );
}
