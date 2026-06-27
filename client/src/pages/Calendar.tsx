import {
  AnimatePresence,
  motion,
  useMotionValue,
  useTransform,
  useMotionValueEvent,
  animate,
  type MotionValue,
  type PanInfo,
} from 'framer-motion';
import {
  Sparkles,
  CalendarDays,
  Columns3,
  Grid3x3,
  Search as SearchIcon,
  MoreHorizontal,
  X,
  ChevronLeft,
  ChevronRight,
  Video,
  MapPin,
  Clock,
  Users,
  ArrowRight,
  Check,
  Lock,
  Pencil,
  Share2,
  HelpCircle,
  ExternalLink,
  Mail,
} from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { APPLE_SPRING } from '@/lib/motion';
import { StiltAvatar } from '@/components/Avatar';
import { GlassSegmentedToggle } from '@/components/GlassSegmentedToggle';
import { EventComposer } from '@/components/EventComposer';
import { ResponsiveSheet } from '@/components/ResponsiveSheet';
import {
  RsvpSection,
  ParticipantsSection,
  InlineRsvpToggle,
  useEffectiveRsvp,
} from '@/components/RsvpControls';
import { useMobileTopChromeSlot } from '@/components/MobileTopChrome';
import { useStilt } from '@/state/StiltContext';

import VadikGlass from '@/components/VadikGlass';

// v30.30 — Calendar view-selector dropdown verwijderd. View-switching
// gebeurt nu via de Universal Search modal (context-aware chips).
function CalViewSelectorWrap() {
  return null;
}

function MobileCalProfileAvatar() {
  const { setProfileMenuOpen } = useStilt();
  // v30.30 — Gelijkgetrokken met Mail/Docs (VadikGlass circle recipe i.p.v.
  // de oude glass-pill className). Zorgt dat alle drie surfaces dezelfde
  // avatar styling hebben én dezelfde hoogte, zodat de "Good morning"
  // hero op alle surfaces op exact dezelfde lijn staat.
  return (
    <VadikGlass
      width={52}
      height={52}
      shape="circle"
      data-testid="mobile-profile-avatar-cal"
      aria-label="Profile"
      onClick={() => setProfileMenuOpen(true)}
      wrapperStyle={{ overflow: 'hidden' }}
    >
      <StiltAvatar name="Simon Garner" size={40} />
    </VadikGlass>
  );
}
import {
  mockEvents,
  categoryDot,
  categoryLabel,
  hhmm,
  durationLabel,
  sameDay,
  eventsOn,
  accountInfo,
  type CalEvent,
  type RsvpStatus,
} from '@/data/mockEvents';

type CalView = 'smart' | 'day' | 'week' | 'month';

// ─────────────────────────────────────────────────────────────────
// 4-segment draggable toggle — same physics as the inbox toggle.
// ─────────────────────────────────────────────────────────────────
const SEG_W = 64; // each segment width in px
const SEG_PAD = 4;
const SEG_COUNT = 4;
const SEGS: { key: CalView; icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string; style?: React.CSSProperties }>; label: string }[] = [
  { key: 'smart', icon: Sparkles, label: 'Smart' },
  { key: 'day',   icon: CalendarDays, label: 'Day' },
  { key: 'week',  icon: Columns3, label: 'Week' },
  { key: 'month', icon: Grid3x3, label: 'Month' },
];

function CalToggle({
  view,
  setView,
  swipeProgress,
  swipeDirection,
}: {
  view: CalView;
  setView: (v: CalView) => void;
  swipeProgress?: MotionValue<number>;
  swipeDirection?: 'self-to-next' | 'self-to-prev';
}) {
  return (
    <GlassSegmentedToggle
      testId="cal-toggle"
      pad={SEG_PAD}
      indicatorStyle="glass-rich"
      value={view}
      onChange={setView}
      externalProgress={swipeProgress}
      externalProgressDirection={swipeDirection}
      segments={SEGS.map((s) => ({
        key: s.key,
        icon: s.icon as unknown as import('lucide-react').LucideIcon,
        label: s.label,
        // Active = icon + label; inactive = icon-only (narrower)
        activeWidth: s.key === 'smart' ? 86 : 72,
        inactiveWidth: 40,
        aiTint: s.key === 'smart',
      }))}
    />
  );
}

// ─────────────────────────────────────────────────────────────────
// Top chrome — same pattern as the inbox: 3 separated elements.
// ─────────────────────────────────────────────────────────────────
function CalTopChrome({
  view,
  setView,
  searchOpen,
  setSearchOpen,
  query,
  setQuery,
  swipeProgress,
  swipeDirection,
}: {
  view: CalView;
  setView: (v: CalView) => void;
  searchOpen: boolean;
  setSearchOpen: (b: boolean) => void;
  query: string;
  setQuery: (q: string) => void;
  swipeProgress?: MotionValue<number>;
  swipeDirection?: 'self-to-next' | 'self-to-prev';
}) {
  return (
    // DESKTOP / TABLET only. On mobile this is rendered by the persistent
    // MobileTopChromeShell (registered via useMobileTopChromeSlot below).
    // v15.3: desktop/tablet now shows just the centered Smart/Day/Week/Month
    // toggle. Search lives in the sidebar universal search (⌘K).
    // v15.4 — desktop chrome: view-selector pill (LEFT) + Smart toggle (RIGHT).
    // v15.5 — Smart-toggle moved to the floating sidebar. Column 2 now
    // only carries the view-selector pill on the left.
    <div className="hidden lg:flex absolute top-3 inset-x-0 z-30 pointer-events-none items-center justify-start px-3 lg:px-4 gap-3">
      <div className="pointer-events-auto">
        <CalViewSelectorWrap />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Small AI sparkle chip
// ─────────────────────────────────────────────────────────────────
function AISparkChip({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-1.5 mt-1.5">
      <Sparkles size={11} strokeWidth={2} className="text-icon-muted mt-[3px] shrink-0" />
      <span className="text-[12px] text-foreground/65 italic leading-snug">{text}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Event card (used in Smart + Day views)
// ─────────────────────────────────────────────────────────────────
function EventCard({
  evt,
  onTap,
  variant = 'normal',
}: {
  evt: CalEvent;
  onTap: () => void;
  variant?: 'normal' | 'ai';
}) {
  const yourRsvp = useEffectiveRsvp(evt);
  const needsResponse = yourRsvp === 'pending';
  return (
    <button
      onClick={onTap}
      data-testid={`event-${evt.id}`}
      className={`text-left w-full ${variant === 'ai' ? 'glass-ai' : 'glass'} rounded-3xl px-4 py-3.5 hover-elevate active-elevate-2 relative overflow-hidden`}
    >
      {/* Monochrome card — account & category meta moved to detail sheet */}
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-[64px]">
          <div className="text-[13px] font-semibold tabular-nums text-foreground">
            {hhmm(evt.start)}
          </div>
          <div className="text-[11.5px] text-muted-foreground tabular-nums">
            {durationLabel(evt.start, evt.end)}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {evt.isFocusBlock && (
              <Lock size={12} strokeWidth={2} className="text-icon-muted shrink-0" />
            )}
            <span className="text-[14.5px] font-semibold tracking-[-0.005em] text-foreground truncate">
              {evt.title}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-[12px] text-muted-foreground">
            {evt.videoLink && (
              <span className="inline-flex items-center gap-1">
                <Video size={11} strokeWidth={1.8} /> Video
              </span>
            )}
            {evt.location && (
              <span className="inline-flex items-center gap-1 truncate max-w-[150px]">
                <MapPin size={11} strokeWidth={1.8} /> {evt.location}
              </span>
            )}
            {evt.participants && evt.participants.length > 0 && (
              <span className="inline-flex items-center gap-1">
                <Users size={11} strokeWidth={1.8} /> {evt.participants.length}
              </span>
            )}
            {needsResponse && (
              <span
                data-testid={`respond-chip-${evt.id}`}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-medium text-foreground/70 bg-foreground/12 dark:bg-foreground/16 ring-1 ring-foreground/20"
              >
                <Sparkles size={10} strokeWidth={2.2} /> Respond
              </span>
            )}
          </div>
          {evt.aiContext && <AISparkChip text={evt.aiContext} />}
        </div>
      </div>
    </button>
  );
}

// ──────────────────────────────────────────────────────────────
// Pending invite card — used by "Needs your response" section in Smart view
// Embeds an inline RSVP toggle. Fades out smoothly once the user responds.
// ──────────────────────────────────────────────────────────────
function PendingInviteCard({ evt, onOpen }: { evt: CalEvent; onOpen: () => void }) {
  const effective = useEffectiveRsvp(evt);
  const shouldShow = !effective || effective === 'pending';
  return (
    <AnimatePresence initial={false}>
      {shouldShow && (
        <motion.div
          key={evt.id}
          layout
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.25, ease: [0.32, 0.72, 0, 1] } }}
          className="glass-ai rounded-3xl px-4 py-3.5"
          data-testid={`pending-invite-${evt.id}`}
        >
          <button
            onClick={onOpen}
            className="w-full text-left hover-elevate rounded-2xl -mx-1.5 px-1.5 py-0.5 active-elevate-2"
          >
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-[64px]">
                <div className="text-[13px] font-semibold tabular-nums text-foreground">
                  {hhmm(evt.start)}
                </div>
                <div className="text-[11.5px] text-muted-foreground tabular-nums">
                  {new Date(evt.start).toLocaleDateString('en-US', { weekday: 'short' })}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[14.5px] font-semibold tracking-[-0.005em] text-foreground truncate">
                  {evt.title}
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-[12px] text-muted-foreground">
                  {evt.videoLink && (
                    <span className="inline-flex items-center gap-1">
                      <Video size={11} strokeWidth={1.8} /> Video
                    </span>
                  )}
                  {evt.participants && evt.participants.length > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <Users size={11} strokeWidth={1.8} /> {evt.participants.length}
                    </span>
                  )}
                </div>
                {(evt.rsvpReason || evt.aiContext) && (
                  <div className="flex items-start gap-1.5 mt-1.5">
                    <Sparkles size={11} strokeWidth={2} className="text-icon-muted mt-[3px] shrink-0" />
                    <span className="text-[12px] text-foreground/70 italic leading-snug">
                      {evt.rsvpReason || evt.aiContext}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </button>
          <div className="mt-3">
            <InlineRsvpToggle evt={evt} size="sm" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────────
// SMART VIEW
// ─────────────────────────────────────────────────────────────────
function SmartView({
  events,
  openEvent,
}: {
  events: CalEvent[];
  openEvent: (e: CalEvent) => void;
}) {
  const { rsvpOverrides } = useStilt();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const todayEvents = useMemo(() => eventsOn(new Date(), events), [events]);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowEvents = useMemo(() => eventsOn(tomorrow, events), [events]);

  const focusToday = todayEvents.filter((e) => e.aiContext && !e.isSuggestion).slice(0, 3);
  const rescheduleSuggestions = events.filter((e) => e.aiSuggestReschedule);
  const focusSuggestions = events.filter((e) => e.isSuggestion);
  // Pending invites: events with rsvpStatus 'pending' AND no override OR override is still 'pending'
  const pendingInvites = useMemo(
    () => events.filter((e) => {
      const eff = rsvpOverrides[e.id] ?? e.rsvpStatus;
      return eff === 'pending';
    }),
    [events, rsvpOverrides]
  );
  const firstPending = pendingInvites[0];
  const firstPendingWhen = firstPending
    ? `${new Date(firstPending.start).toLocaleDateString('en-US', { weekday: 'long' })} ${hhmm(firstPending.start)}`
    : null;

  return (
    <div className="flex flex-col gap-4">
      {/* v22.3 — Day briefing: pure text, same treatment as Smart Inbox.
         No card frame, no "DAY BRIEFING" caps label, no sparkle. */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="px-2 pt-1"
      >
        <h2 className="text-[22px] font-semibold tracking-[-0.02em] leading-tight">
          {greeting}, Simon.
        </h2>
        <p className="text-[14px] text-foreground/70 mt-2 leading-snug">
          <span className="font-semibold text-foreground">{tomorrowEvents.length} meetings</span> tomorrow, both before noon. Your afternoon is open —{' '}
          <span className="text-foreground/55">
            Marcus suggested a working session, free slot 14:00–16:00 if you want to confirm.
          </span>
          {pendingInvites.length > 0 && (
            <>
              {' '}
              <span className="font-semibold text-foreground">
                {pendingInvites.length} invite{pendingInvites.length > 1 ? 's' : ''} need{pendingInvites.length > 1 ? '' : 's'} your response
              </span>
              {firstPending && firstPendingWhen && (
                <> — {firstPending.title} ({firstPendingWhen}).</>
              )}
            </>
          )}
        </p>
      </motion.div>

      {/* Needs your response */}
      {pendingInvites.length > 0 && (
        <section data-testid="needs-response-section">
          <div className="flex items-center gap-1.5 px-2 mb-1.5">
            <Mail size={13} strokeWidth={2} className="text-icon-muted" />
            <span className="text-[12.5px] font-semibold tracking-[-0.005em]">Needs your response</span>
            <span className="text-[12px] text-muted-foreground">· {pendingInvites.length}</span>
          </div>
          <div className="flex flex-col gap-2">
            {pendingInvites.map((e) => (
              <PendingInviteCard key={e.id} evt={e} onOpen={() => openEvent(e)} />
            ))}
          </div>
        </section>
      )}

      {/* Today's focus */}
      {focusToday.length > 0 && (
        <section>
          <div className="flex items-center gap-1.5 px-2 mb-1.5">
            <Sparkles size={13} strokeWidth={2} className="text-icon-muted" />
            <span className="text-[12.5px] font-semibold tracking-[-0.005em]">Today's focus</span>
            <span className="text-[12px] text-muted-foreground">· {focusToday.length}</span>
          </div>
          <div className="flex flex-col gap-2">
            {focusToday.map((e) => (
              <EventCard key={e.id} evt={e} onTap={() => openEvent(e)} variant="ai" />
            ))}
          </div>
        </section>
      )}

      {/* Reschedule suggestions */}
      {rescheduleSuggestions.length > 0 && (
        <section>
          <div className="flex items-center gap-1.5 px-2 mb-1.5">
            <Clock size={13} strokeWidth={2} className="text-icon-muted" />
            <span className="text-[12.5px] font-semibold tracking-[-0.005em]">Reschedule suggestions</span>
            <span className="text-[12px] text-muted-foreground">· {rescheduleSuggestions.length}</span>
          </div>
          <div className="flex flex-col gap-2">
            {rescheduleSuggestions.map((e) => (
              <EventCard key={e.id} evt={e} onTap={() => openEvent(e)} />
            ))}
          </div>
        </section>
      )}

      {/* Hidden time / focus block suggestions */}
      {focusSuggestions.length > 0 && (
        <section>
          <div className="flex items-center gap-1.5 px-2 mb-1.5">
            <Lock size={13} strokeWidth={2} className="text-icon-muted" />
            <span className="text-[12.5px] font-semibold tracking-[-0.005em]">Hidden time</span>
            <span className="text-[12px] text-muted-foreground">· deep work blocks AI found</span>
          </div>
          <div className="flex flex-col gap-2">
            {focusSuggestions.map((e) => {
              const d = new Date(e.start);
              const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short' });
              return (
                <button
                  key={e.id}
                  onClick={() => openEvent(e)}
                  className="text-left w-full glass-ai rounded-3xl px-4 py-3.5 hover-elevate active-elevate-2 flex items-center gap-3"
                >
                  <div className="h-10 w-10 rounded-2xl bg-foreground/15 flex items-center justify-center shrink-0">
                    <Lock size={16} strokeWidth={1.8} className="text-icon-muted" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-semibold tracking-[-0.005em]">
                      {dayLabel} {hhmm(e.start)}–{hhmm(e.end)} · {durationLabel(e.start, e.end)} block
                    </div>
                    {e.aiContext && (
                      <div className="text-[12.5px] text-foreground/65 leading-snug mt-0.5">
                        {e.aiContext}
                      </div>
                    )}
                  </div>
                  <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-foreground/70 shrink-0">
                    Claim <ArrowRight size={12} strokeWidth={2.2} />
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// DAY VIEW
// ─────────────────────────────────────────────────────────────────
function DateHeader({
  date,
  onPrev,
  onNext,
  label,
}: {
  date: Date;
  onPrev: () => void;
  onNext: () => void;
  label: string;
}) {
  const dateStr = date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  return (
    <div className="flex items-center justify-between glass-pill pill px-2 py-1.5 mb-3">
      <button
        onClick={onPrev}
        aria-label="Previous"
        className="h-8 w-8 rounded-full flex items-center justify-center text-icon hover-elevate active-elevate-2"
      >
        <ChevronLeft size={16} strokeWidth={1.8} />
      </button>
      <div className="flex-1 text-center">
        <div className="text-[14px] font-semibold tracking-[-0.005em]">{dateStr}</div>
        <div className="text-[11px] text-muted-foreground -mt-0.5">{label}</div>
      </div>
      <button
        onClick={onNext}
        aria-label="Next"
        className="h-8 w-8 rounded-full flex items-center justify-center text-icon hover-elevate active-elevate-2"
      >
        <ChevronRight size={16} strokeWidth={1.8} />
      </button>
    </div>
  );
}

function DayView({
  date,
  setDate,
  events,
  openEvent,
}: {
  date: Date;
  setDate: (d: Date) => void;
  events: CalEvent[];
  openEvent: (e: CalEvent) => void;
}) {
  const dayEvts = useMemo(() => eventsOn(date, events), [date, events]);
  const isToday = sameDay(date, new Date());
  const labelDate = new Date();
  labelDate.setDate(labelDate.getDate() + 1);
  const isTomorrow = sameDay(date, labelDate);
  const label = isToday ? 'Today' : isTomorrow ? 'Tomorrow' : '';

  const prev = () => {
    const d = new Date(date);
    d.setDate(d.getDate() - 1);
    setDate(d);
  };
  const next = () => {
    const d = new Date(date);
    d.setDate(d.getDate() + 1);
    setDate(d);
  };

  // Compute gaps between events for "free" markers
  const items: Array<{ kind: 'evt'; e: CalEvent } | { kind: 'gap'; mins: number }> = [];
  for (let i = 0; i < dayEvts.length; i++) {
    items.push({ kind: 'evt', e: dayEvts[i] });
    const next = dayEvts[i + 1];
    if (next) {
      const gapMs = +new Date(next.start) - +new Date(dayEvts[i].end);
      const mins = Math.floor(gapMs / 60000);
      if (mins >= 30) items.push({ kind: 'gap', mins });
    }
  }

  return (
    <div className="flex flex-col">
      <DateHeader date={date} onPrev={prev} onNext={next} label={label} />
      {dayEvts.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-[14px]">No events on this day</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((it, i) => {
            if (it.kind === 'evt') {
              return <EventCard key={it.e.id} evt={it.e} onTap={() => openEvent(it.e)} />;
            }
            const h = Math.floor(it.mins / 60);
            const m = it.mins % 60;
            const lbl = h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`;
            return (
              <div key={`gap-${i}`} className="px-4 py-2 text-center text-[11.5px] text-foreground/45 italic">
                {lbl} free
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// WEEK VIEW
// ─────────────────────────────────────────────────────────────────
function startOfWeek(d: Date): Date {
  const out = new Date(d);
  const jsDay = out.getDay(); // 0=Sun..6=Sat
  const back = jsDay === 0 ? 6 : jsDay - 1; // Monday
  out.setDate(out.getDate() - back);
  out.setHours(0, 0, 0, 0);
  return out;
}

function WeekView({
  date,
  setDate,
  setView,
  events,
  openEvent,
}: {
  date: Date;
  setDate: (d: Date) => void;
  setView: (v: CalView) => void;
  events: CalEvent[];
  openEvent: (e: CalEvent) => void;
}) {
  const weekStart = useMemo(() => startOfWeek(date), [date]);
  const days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
  const last = new Date(weekStart);
  last.setDate(last.getDate() + 6);
  const rangeLabel = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — ${last.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

  const prev = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setDate(d);
  };
  const next = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setDate(d);
  };

  const today = new Date();

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between glass-pill pill px-2 py-1.5 mb-3">
        <button onClick={prev} aria-label="Previous week" className="h-8 w-8 rounded-full flex items-center justify-center text-icon hover-elevate active-elevate-2">
          <ChevronLeft size={16} strokeWidth={1.8} />
        </button>
        <div className="text-[14px] font-semibold tracking-[-0.005em]">{rangeLabel}</div>
        <button onClick={next} aria-label="Next week" className="h-8 w-8 rounded-full flex items-center justify-center text-icon hover-elevate active-elevate-2">
          <ChevronRight size={16} strokeWidth={1.8} />
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {days.map((d) => {
          const dayEvts = eventsOn(d, events);
          const isCurr = sameDay(d, today);
          return (
            <div
              key={d.toISOString()}
              className={`glass rounded-3xl px-3 py-2.5 ${isCurr ? 'ring-1 ring-foreground/25 bg-foreground/[0.04]' : ''}`}
            >
              <button
                onClick={() => {
                  setDate(d);
                  setView('day');
                }}
                className="flex items-center justify-between w-full mb-1.5"
              >
                <div className="flex items-baseline gap-2">
                  <span className={`text-[11px] uppercase tracking-wider font-semibold ${isCurr ? 'text-foreground/70' : 'text-foreground/55'}`}>
                    {d.toLocaleDateString('en-US', { weekday: 'short' })}
                  </span>
                  <span className={`text-[16px] font-semibold tabular-nums ${isCurr ? 'text-foreground/70' : ''}`}>
                    {d.getDate()}
                  </span>
                </div>
                <span className="text-[11.5px] text-muted-foreground">
                  {dayEvts.length === 0 ? 'free' : `${dayEvts.length}`}
                </span>
              </button>
              {dayEvts.length > 0 && (
                <div className="flex flex-col gap-1">
                  {dayEvts.slice(0, 3).map((e) => (
                    <button
                      key={e.id}
                      onClick={() => openEvent(e)}
                      className="flex items-center gap-2 text-left rounded-xl px-2 py-1.5 hover-elevate active-elevate-2 bg-foreground/[0.03] dark:bg-white/[0.04]"
                    >
                      <span
                        className="w-1 h-4 rounded-full shrink-0"
                        style={{ background: categoryDot(e.category) }}
                      />
                      <span className="text-[12.5px] font-medium truncate flex-1">{e.title}</span>
                      <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                        {hhmm(e.start)}
                      </span>
                    </button>
                  ))}
                  {dayEvts.length > 3 && (
                    <div className="text-[11px] text-foreground/55 pl-3">
                      +{dayEvts.length - 3} more
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// MONTH VIEW
// ─────────────────────────────────────────────────────────────────
function MonthView({
  date,
  setDate,
  setView,
  events,
}: {
  date: Date;
  setDate: (d: Date) => void;
  setView: (v: CalView) => void;
  events: CalEvent[];
}) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const firstWeekday = first.getDay(); // 0..6 Sun-Sat
  const offsetMon = firstWeekday === 0 ? 6 : firstWeekday - 1;
  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const cells: Array<Date | null> = [];
  for (let i = 0; i < offsetMon; i++) cells.push(null);
  for (let i = 1; i <= daysInMonth; i++) cells.push(new Date(date.getFullYear(), date.getMonth(), i));
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const today = new Date();

  const prev = () => {
    const d = new Date(date);
    d.setMonth(d.getMonth() - 1);
    setDate(d);
  };
  const next = () => {
    const d = new Date(date);
    d.setMonth(d.getMonth() + 1);
    setDate(d);
  };

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between glass-pill pill px-2 py-1.5 mb-3">
        <button onClick={prev} aria-label="Previous month" className="h-8 w-8 rounded-full flex items-center justify-center text-icon hover-elevate active-elevate-2">
          <ChevronLeft size={16} strokeWidth={1.8} />
        </button>
        <div className="text-[14px] font-semibold tracking-[-0.005em]">{monthLabel}</div>
        <button onClick={next} aria-label="Next month" className="h-8 w-8 rounded-full flex items-center justify-center text-icon hover-elevate active-elevate-2">
          <ChevronRight size={16} strokeWidth={1.8} />
        </button>
      </div>

      <div className="glass rounded-3xl p-3">
        <div className="grid grid-cols-7 gap-1 mb-1.5">
          {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d) => (
            <div key={d} className="text-center text-[10.5px] uppercase tracking-wider font-semibold text-foreground/55">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (!d) return <div key={`empty-${i}`} className="aspect-square" />;
            const dayEvts = eventsOn(d, events);
            const isToday = sameDay(d, today);
            return (
              <button
                key={d.toISOString()}
                onClick={() => {
                  setDate(d);
                  setView('day');
                }}
                className="aspect-square rounded-xl flex flex-col items-center justify-center relative hover-elevate active-elevate-2 p-1"
              >
                <span
                  className={`text-[12.5px] font-semibold tabular-nums ${
                    isToday
                      ? 'text-white bg-foreground h-6 w-6 rounded-full flex items-center justify-center'
                      : 'text-foreground/80'
                  }`}
                >
                  {d.getDate()}
                </span>
                {dayEvts.length > 0 && (
                  <div className="flex items-center gap-[2px] mt-1">
                    {dayEvts.slice(0, 3).map((e) => (
                      <span
                        key={e.id}
                        className="w-[5px] h-[5px] rounded-full"
                        style={{ background: categoryDot(e.category) }}
                      />
                    ))}
                    {dayEvts.length > 3 && (
                      <span className="text-[9px] font-semibold text-foreground/55 ml-0.5">
                        +{dayEvts.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// EVENT DETAIL SHEET
// ─────────────────────────────────────────────────────────────────
function EventDetailSheet({
  evt,
  onClose,
}: {
  evt: CalEvent | null;
  onClose: () => void;
}) {
  return (
    <ResponsiveSheet
      open={!!evt}
      onClose={onClose}
      desktopWidth="md"
      testId="event-detail-sheet"
    >
      {evt && (
        <div className="flex-1 overflow-y-auto no-scrollbar px-5 pb-6 pt-1">
            {/* Top action row — small glass circle buttons in top-right */}
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <h2 className="text-[20px] font-semibold tracking-[-0.018em] leading-tight">{evt.title}</h2>
                <div className="text-[13px] text-muted-foreground mt-1">
                  {new Date(evt.start).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} · {hhmm(evt.start)}–{hhmm(evt.end)} · {categoryLabel(evt.category)}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  aria-label="Edit event"
                  data-testid="event-edit"
                  className="glass-pill h-[52px] w-[52px] rounded-full flex items-center justify-center text-icon active-elevate-2"
                >
                  <Pencil size={19} strokeWidth={1.75} />
                </button>
                <button
                  aria-label="Share event"
                  data-testid="event-share"
                  className="glass-pill h-[52px] w-[52px] rounded-full flex items-center justify-center text-icon active-elevate-2"
                >
                  <Share2 size={19} strokeWidth={1.75} />
                </button>
                <button
                  aria-label="More options"
                  data-testid="event-more"
                  className="glass-pill h-[52px] w-[52px] rounded-full flex items-center justify-center text-icon active-elevate-2"
                >
                  <MoreHorizontal size={19} strokeWidth={1.75} />
                </button>
              </div>
            </div>

            {evt.aiContext && (
              <div className="glass-ai rounded-2xl p-3 mt-4">
                <div className="flex items-start gap-1.5">
                  <Sparkles size={12} strokeWidth={2.2} className="text-icon-muted mt-[3px] shrink-0" />
                  <p className="text-[13px] text-foreground/85 leading-snug">{evt.aiContext}</p>
                </div>
              </div>
            )}

            {evt.videoLink && (
              <div className="mt-4 flex items-center gap-2 text-[13px]">
                <Video size={14} strokeWidth={1.7} className="text-icon-muted shrink-0" />
                <a href={evt.videoLink} className="text-foreground/70 underline truncate" data-testid="event-video-link">
                  {evt.videoLink}
                </a>
              </div>
            )}

            {evt.location && (
              <div className="mt-2 flex items-center gap-2 text-[13px]">
                <MapPin size={14} strokeWidth={1.7} className="text-icon-muted shrink-0" />
                <span className="text-foreground/85 truncate flex-1">{evt.location}</span>
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(evt.location)}`}
                  className="text-foreground/70 text-[12px] inline-flex items-center gap-0.5 shrink-0"
                >
                  Open in Maps <ExternalLink size={10} strokeWidth={2} />
                </a>
              </div>
            )}

            {/* RSVP — your response */}
            <RsvpSection evt={evt} />

            {/* Participants */}
            {evt.participants && evt.participants.length > 0 && (
              <ParticipantsSection participants={evt.participants} />
            )}

            {evt.description && (
              <p className="text-[13.5px] leading-relaxed text-foreground/80 mt-4">
                {evt.description}
              </p>
            )}

            {/* Account meta */}
            {(() => {
              const acct = accountInfo(evt.account);
              if (!acct) return null;
              return (
                <div className="mt-5 pt-4 border-t border-foreground/[0.08] flex items-center gap-2.5">
                  <span
                    aria-hidden
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ background: acct.color }}
                  />
                  <div className="text-[12.5px] text-muted-foreground">
                    On <span className="text-foreground/80 font-medium">{acct.provider}</span>
                    {acct.email !== 'personal' && (
                      <> · <span className="text-foreground/75">{acct.email}</span></>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Bottom primary action — only the Join button if video; otherwise nothing */}
            {evt.videoLink && (
              <div className="flex items-center justify-end mt-6">
                <a
                  href={evt.videoLink}
                  data-testid="event-join"
                  className="pill h-11 px-5 rounded-full flex items-center gap-1.5 text-[14px] font-semibold bg-foreground text-background active-elevate-2"
                >
                  <Video size={15} strokeWidth={2} /> Join
                </a>
              </div>
            )}
        </div>
      )}
    </ResponsiveSheet>
  );
}

// ─────────────────────────────────────────────────────────────────
// Calendar page (root)
// ─────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────
// Mobile paged carousel — 4 segments side-by-side (Smart / Day / Week / Month).
// Container slides on horizontal drag; updates `view` at threshold.
// Drives `swipeProgress` motion value so the top toggle morphs in sync.
// Uses dragDirectionLock so vertical scrolling inside each page still works.
// ─────────────────────────────────────────────────────────────────
const VIEW_KEYS: CalView[] = ['smart', 'day', 'week', 'month'];

function CalendarCarousel({
  view,
  setView,
  swipeProgress,
  setSwipeDirection,
  date,
  setDate,
  events,
  openEvent,
}: {
  view: CalView;
  setView: (v: CalView) => void;
  swipeProgress: MotionValue<number>;
  setSwipeDirection: (d: 'self-to-next' | 'self-to-prev') => void;
  date: Date;
  setDate: (d: Date) => void;
  events: CalEvent[];
  openEvent: (e: CalEvent) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const widthRef = useRef<number>(typeof window !== 'undefined' ? window.innerWidth : 375);
  const activeIdx = VIEW_KEYS.indexOf(view);

  // Sync x when view changes from outside (tap on toggle).
  useEffect(() => {
    const w = widthRef.current;
    animate(x, -activeIdx * w, APPLE_SPRING);
  }, [activeIdx, x]);

  // Resize observer — re-snap to current page on width change.
  useEffect(() => {
    const update = () => {
      widthRef.current = trackRef.current?.parentElement?.clientWidth || window.innerWidth;
      x.set(-VIEW_KEYS.indexOf(view) * widthRef.current);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Map x → swipeProgress (0..1 toward next/prev). Direction inferred from drag sign.
  useMotionValueEvent(x, 'change', (latest) => {
    const w = widthRef.current || 1;
    const restX = -activeIdx * w;
    const delta = latest - restX; // negative = dragging left (toward next), positive = right (toward prev)
    if (delta < 0) {
      setSwipeDirection('self-to-next');
    } else if (delta > 0) {
      setSwipeDirection('self-to-prev');
    }
    swipeProgress.set(Math.min(1, Math.abs(delta) / w));
  });

  const onDragEnd = (
    _: unknown,
    info: { offset: { x: number; y: number }; velocity: { x: number } }
  ) => {
    const w = widthRef.current || 1;
    const thresholdPx = w * 0.3;
    const velocity = info.velocity.x;
    const offset = info.offset.x;

    let nextIdx = activeIdx;
    if (offset < -thresholdPx || velocity < -500) {
      nextIdx = Math.min(VIEW_KEYS.length - 1, activeIdx + 1);
    } else if (offset > thresholdPx || velocity > 500) {
      nextIdx = Math.max(0, activeIdx - 1);
    }

    if (nextIdx !== activeIdx) {
      setView(VIEW_KEYS[nextIdx]);
      animate(x, -nextIdx * w, APPLE_SPRING);
    } else {
      animate(x, -activeIdx * w, APPLE_SPRING);
    }
    // After settle, reset progress + direction
    setTimeout(() => swipeProgress.set(0), 350);
  };

  // Drag constraints — clamp to first/last page.
  const w = widthRef.current || 375;
  return (
    <div
      ref={trackRef}
      className="flex-1 relative"
      style={{ overflow: 'hidden', width: '100%', maxWidth: '100vw' }}
    >
      <motion.div
        className="flex h-full"
        style={{ x, width: `${VIEW_KEYS.length * 100}%`, willChange: 'transform' }}
        drag="x"
        dragDirectionLock
        dragElastic={0.12}
        dragConstraints={{ left: -(VIEW_KEYS.length - 1) * w, right: 0 }}
        onDragEnd={onDragEnd}
      >
        <div
          className="h-full overflow-y-auto no-scrollbar px-3 pt-[86px] pb-44"
          style={{ width: `${100 / VIEW_KEYS.length}%`, touchAction: 'pan-y' }}
        >
          <div className="max-w-2xl mx-auto">
            <SmartView events={events} openEvent={openEvent} />
          </div>
        </div>
        <div
          className="h-full overflow-y-auto no-scrollbar px-3 pt-[86px] pb-44"
          style={{ width: `${100 / VIEW_KEYS.length}%`, touchAction: 'pan-y' }}
        >
          <div className="max-w-2xl mx-auto">
            <DayView date={date} setDate={setDate} events={events} openEvent={openEvent} />
          </div>
        </div>
        <div
          className="h-full overflow-y-auto no-scrollbar px-3 pt-[86px] pb-44"
          style={{ width: `${100 / VIEW_KEYS.length}%`, touchAction: 'pan-y' }}
        >
          <div className="max-w-2xl mx-auto">
            <WeekView date={date} setDate={setDate} setView={setView} events={events} openEvent={openEvent} />
          </div>
        </div>
        <div
          className="h-full overflow-y-auto no-scrollbar px-3 pt-[86px] pb-44"
          style={{ width: `${100 / VIEW_KEYS.length}%`, touchAction: 'pan-y' }}
        >
          <div className="max-w-2xl mx-auto">
            <MonthView date={date} setDate={setDate} setView={setView} events={events} />
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export function CalendarPage() {
  const [loc] = useLocation();
  const {
    setSheetOpen,
    accountVisible,
    smartMode,
    setSmartMode,
    calView: globalCalView,
    setCalView: setGlobalCalView,
    setProfileMenuOpen,
  } = useStilt();
  // v15.4 — derive local CalView ('smart' | 'day' | 'week' | 'month') from
  // the global smartMode toggle + the view-selector pill (today/week/month/upcoming).
  const view: CalView = smartMode
    ? 'smart'
    : globalCalView === 'today'
      ? 'day'
      : globalCalView === 'week'
        ? 'week'
        : globalCalView === 'month'
          ? 'month'
          : 'day'; // upcoming → day list scrolled forward
  const setView = (v: CalView) => {
    if (v === 'smart') setSmartMode(true);
    else {
      setSmartMode(false);
      setGlobalCalView(v === 'day' ? 'today' : (v as any));
    }
  };
  const [date, setDate] = useState(new Date());
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [openEvt, setOpenEvt] = useState<CalEvent | null>(null);
  const [newEventOpen, setNewEventOpen] = useState(loc.startsWith('/calendar/new'));

  // Mobile detection — md breakpoint at 768px.
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : true
  );
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Swipe progress motion value — shared between carousel and top toggle.
  const swipeProgress = useMotionValue(0);
  const [swipeDirection, setSwipeDirection] = useState<'self-to-next' | 'self-to-prev'>('self-to-next');

  useEffect(() => {
    setNewEventOpen(loc.startsWith('/calendar/new'));
  }, [loc]);

  // Drive global sheetOpen flag so bottom nav + FAB hide whenever ANY sheet is open
  useEffect(() => {
    setSheetOpen(!!openEvt || newEventOpen);
    return () => setSheetOpen(false);
  }, [openEvt, newEventOpen, setSheetOpen]);

  const filtered = useMemo(() => {
    // Filter by visible accounts FIRST (always)
    const acctFiltered = mockEvents.filter((e) => accountVisible[e.account] !== false);
    const q = query.trim().toLowerCase();
    if (!q) return acctFiltered;
    return acctFiltered.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        (e.location || '').toLowerCase().includes(q) ||
        (e.participants || []).some((p) => p.name.toLowerCase().includes(q))
    );
  }, [query, accountVisible]);

  // Register our slot into the persistent mobile chrome shell. Only fires
  // on mobile (the shell itself is md:hidden). swipeProgress is a stable
  // MotionValue so the deps list is short.
  // v15.4 — mobile chrome: view-selector + Smart pill (CENTER pair),
  // avatar (LEFT), default search (RIGHT).
  // v30.30 — Mobile Calendar view-dropdown verwijderd. View-switching
  // via Universal Search modal.
  const calTogglePill = useMemo(() => null, []);
  const calLeftSlot = useMemo(() => <MobileCalProfileAvatar />, []);
  const calSlot = useMemo(
    () => ({
      togglePill: calTogglePill,
      leftSlot: calLeftSlot,
      searchPlaceholder: 'Search events…',
      searchQuery: query,
      setSearchQuery: setQuery,
    }),
    [calTogglePill, calLeftSlot, query, setQuery]
  );
  useMobileTopChromeSlot(calSlot);

  return (
    <div className="relative flex flex-col h-full min-h-0">
      <CalTopChrome
        view={view}
        setView={setView}
        searchOpen={searchOpen}
        setSearchOpen={setSearchOpen}
        query={query}
        setQuery={setQuery}
        swipeProgress={isMobile ? swipeProgress : undefined}
        swipeDirection={isMobile ? swipeDirection : undefined}
      />

      {isMobile ? (
        <CalendarCarousel
          view={view}
          setView={setView}
          swipeProgress={swipeProgress}
          setSwipeDirection={setSwipeDirection}
          date={date}
          setDate={setDate}
          events={filtered}
          openEvent={setOpenEvt}
        />
      ) : (
        <div className="flex-1 overflow-y-auto no-scrollbar px-3 lg:px-4 pt-[86px] lg:pt-5 pb-44 lg:pb-6">
          <div className="max-w-2xl mx-auto">
            <AnimatePresence mode="wait">
              {view === 'smart' && (
                <motion.div
                  key="smart"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.22 }}
                >
                  <SmartView events={filtered} openEvent={setOpenEvt} />
                </motion.div>
              )}
              {view === 'day' && (
                <motion.div
                  key="day"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.22 }}
                >
                  <DayView date={date} setDate={setDate} events={filtered} openEvent={setOpenEvt} />
                </motion.div>
              )}
              {view === 'week' && (
                <motion.div
                  key="week"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.22 }}
                >
                  <WeekView date={date} setDate={setDate} setView={setView} events={filtered} openEvent={setOpenEvt} />
                </motion.div>
              )}
              {view === 'month' && (
                <motion.div
                  key="month"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.22 }}
                >
                  <MonthView date={date} setDate={setDate} setView={setView} events={filtered} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      <EventDetailSheet evt={openEvt} onClose={() => setOpenEvt(null)} />
      <EventComposer open={newEventOpen} onClose={() => setNewEventOpen(false)} />
    </div>
  );
}
