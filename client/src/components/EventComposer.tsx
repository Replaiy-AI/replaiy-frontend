// ─────────────────────────────────────────────────────────────────
// Event composer (v11 polish v3) — progressive-disclosure form.
//
// v11 changes:
//   • Composer OWNS the top page chrome (X / New event / Edit).
//   • NO internal top bar — sheet starts directly with Title.
//   • Title placeholder lifted to /50 with thicker padding.
//   • Meeting-type SegmentedToggle (None / Video / Location) replaces
//     the separate Video and Location stacked rows.
//   • Below the toggle, a single contextual row appears (smooth height).
//   • Footer no longer has a hard border-line — soft gradient fade.
//   • Account selector is a glass row with "Create on:" label,
//     matching the other stacked-row treatment.
// ─────────────────────────────────────────────────────────────────
import {
  AnimatePresence,
  motion,
} from 'framer-motion';
import {
  Bell,
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronRight,
  Clock,
  Globe,
  ListChecks,
  MapPin,
  Plus,
  Repeat,
  Sparkles,
  Timer,
  Users,
  Video,
  X,
  Check,
  CheckCircle2,
  FileText,
  Mail,
  Slash,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { APPLE_SPRING } from '@/lib/motion';
import { StiltAvatar } from './Avatar';
import { useMobileTopChromeSlot } from '@/components/MobileTopChrome';
import {
  accounts,
  type AccountId,
} from '@/data/mockEvents';

type EventKind = 'event' | 'task' | 'reminder';
type Conference = 'none' | 'meet' | 'zoom' | 'teams' | 'other';
type RepeatOption = 'never' | 'daily' | 'weekly' | 'monthly' | 'custom';
type ReminderOption = '5' | '10' | '30' | '60' | '1440' | 'none';
type MeetingKind = 'none' | 'video' | 'location';
type ExpandedKey =
  | null
  | 'time'
  | 'people'
  | 'reminder'
  | 'repeat'
  | 'timezone'
  | 'description';

interface Template {
  key: string;
  title: string;
  durationMin: number;
  participants: string[];
  description?: string;
}

const TEMPLATES: Template[] = [
  { key: 'weekly', title: 'Weekly sync', durationMin: 30, participants: ['Nora Chen', 'Marcus Webb'], description: 'Weekly product alignment.' },
  { key: '1on1', title: '1:1 with Marcus', durationMin: 30, participants: ['Marcus Webb'], description: 'Catch up, priorities, blockers.' },
  { key: 'coffee', title: 'Coffee chat', durationMin: 45, participants: [], description: '' },
];

const TIME_SUGGESTIONS = [
  { label: 'Tomorrow 14:00', day: 1, hour: 14, minute: 0 },
  { label: 'Thursday 10:30', day: 3, hour: 10, minute: 30 },
  { label: 'Friday 09:00', day: 4, hour: 9, minute: 0 },
];

const EMAIL_SUGGESTIONS = [
  { title: 'Board prep — review whale-spike scenarios', mins: 30, with: ['Nora Chen'] },
  { title: 'Coffee with Marcus', mins: 45, with: ['Marcus Webb'] },
];

function hhmm(h: number, m: number): string {
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function parseTime(s: string): { h: number; m: number } {
  const [h, m] = s.split(':').map((n) => parseInt(n, 10));
  return { h: isFinite(h) ? h : 10, m: isFinite(m) ? m : 0 };
}

function durationMins(start: string, end: string): number {
  const a = parseTime(start);
  const b = parseTime(end);
  const mins = (b.h * 60 + b.m) - (a.h * 60 + a.m);
  return mins > 0 ? mins : 0;
}

function durationLabel(mins: number): string {
  if (mins === 0) return '0 min';
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

function dateLabel(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
}

function addMinutes(time: string, mins: number): string {
  const t = parseTime(time);
  const total = t.h * 60 + t.m + mins;
  const wrapped = ((total % 1440) + 1440) % 1440;
  return hhmm(Math.floor(wrapped / 60), wrapped % 60);
}

function genMeetUrl(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  const pick = (n: number) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `https://meet.google.com/${pick(3)}-${pick(4)}-${pick(3)}`;
}

interface ComposerProps {
  open: boolean;
  onClose: () => void;
  onCreate?: (payload: { title: string; meetUrl?: string }) => void;
}

// Stacked-row primitive — one line collapsed, expandable
function Row({
  icon: Icon,
  label,
  value,
  placeholder,
  expanded,
  onToggle,
  children,
  testId,
}: {
  icon: typeof Bell;
  label: string;
  value?: string;
  placeholder?: string;
  expanded: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
  testId?: string;
}) {
  return (
    <div
      data-testid={testId}
      className={`rounded-2xl transition-colors ${expanded ? 'bg-foreground/[0.04]' : ''}`}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-3 py-3 active-elevate-2 rounded-2xl text-left"
        data-testid={testId ? `${testId}-row` : undefined}
      >
        <Icon size={17} strokeWidth={1.7} className="text-icon-muted shrink-0" />
        <span className="text-[14px] font-medium text-foreground/85 shrink-0">{label}</span>
        <span
          className={`flex-1 min-w-0 truncate text-right text-[13.5px] ${
            value ? 'text-foreground/85' : 'text-foreground/40'
          }`}
        >
          {value || placeholder}
        </span>
        <ChevronRight
          size={14}
          strokeWidth={1.8}
          className={`text-foreground/40 transition-transform ${expanded ? 'rotate-90' : ''}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {expanded && children && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-1">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Composer-owned top chrome
//   • LEFT  = X close
//   • CENTER pill = event-type dropdown (Event / Task / Reminder)
//   • RIGHT = empty (no duplicate action — X already top-left)
// While composer is open this slot wins (priority 200) so the
// calendar's normal chrome stays hidden — no double top bar.
// The center pill IS the event-type selector. Tapping it opens a
// bottom-sheet picker. There is no internal header inside the
// composer sheet — it starts directly with Title.
// ─────────────────────────────────────────────────────────────────
const EVENT_KIND_META: Record<EventKind, { label: string; Icon: typeof CalendarIcon }> = {
  event: { label: 'Event', Icon: CalendarIcon },
  task: { label: 'Task', Icon: ListChecks },
  reminder: { label: 'Reminder', Icon: Bell },
};

function ComposerChromeSlot({
  onClose,
  kind,
  onOpenKindPicker,
}: {
  onClose: () => void;
  kind: EventKind;
  onOpenKindPicker: () => void;
}) {
  const slot = useMemo(
    () => {
      const { label, Icon } = EVENT_KIND_META[kind];
      return {
        priority: 200,
        leftSlot: (
          <button
            data-testid="button-close-composer"
            onClick={onClose}
            className="glass-pill h-[52px] w-[52px] rounded-full flex items-center justify-center active-elevate-2 shrink-0"
            aria-label="Close"
          >
            <X size={22} strokeWidth={1.5} className="text-icon" />
          </button>
        ),
        togglePill: (
          <button
            onClick={onOpenKindPicker}
            data-testid="composer-kind-pill"
            className="glass-pill pill inline-flex items-center gap-2 pl-3.5 pr-3 py-[4px] h-[52px] active-elevate-2"
            aria-label={`Event type: ${label}. Tap to change.`}
          >
            <Icon size={14} strokeWidth={1.8} className="text-icon-muted" />
            <span className="text-[14px] font-semibold tracking-[-0.005em] text-foreground">
              {label}
            </span>
            <ChevronDown size={13} strokeWidth={1.8} className="text-icon-muted" />
          </button>
        ),
        // No right slot — X top-left is enough; no duplicate action.
        rightSlot: <div className="h-[52px] w-[52px] shrink-0" aria-hidden />,
      };
    },
    [onClose, kind, onOpenKindPicker],
  );
  useMobileTopChromeSlot(slot);
  return null;
}

// ─────────────────────────────────────────────────────────────────
// Meeting-type segmented toggle
//   None  | 📹 Video | 📍 Location
// Local component for clean spacing inside the composer body.
// ─────────────────────────────────────────────────────────────────
function MeetingTypeToggle({
  value,
  onChange,
}: {
  value: MeetingKind;
  onChange: (k: MeetingKind) => void;
}) {
  const segs: { k: MeetingKind; icon: typeof Slash; label: string }[] = [
    { k: 'none', icon: Slash, label: 'None' },
    { k: 'video', icon: Video, label: 'Video call' },
    { k: 'location', icon: MapPin, label: 'Location' },
  ];
  return (
    <div
      data-testid="meeting-type-toggle"
      className="glass-pill rounded-full p-1 flex items-center w-full"
      role="tablist"
      aria-label="Meeting type"
    >
      {segs.map((s) => {
        const I = s.icon;
        const active = value === s.k;
        return (
          <button
            key={s.k}
            data-testid={`meeting-type-${s.k}`}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(s.k)}
            className={`flex-1 h-9 inline-flex items-center justify-center gap-1.5 rounded-full text-[12.5px] font-semibold tracking-[-0.005em] transition-colors ${
              active
                ? 'bg-foreground text-background shadow-sm'
                : 'text-foreground/65 hover:text-foreground/85 active-elevate-2'
            }`}
          >
            <I size={14} strokeWidth={1.8} />
            <span>{s.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function EventComposer({ open, onClose, onCreate }: ComposerProps) {
  // v15 — on desktop (≥1024), the composer renders as a right-side panel
  // instead of a bottom sheet. We track the breakpoint locally rather
  // than relying on Tailwind because the motion.div animation, drag
  // direction, and chrome layout all need to switch in lockstep.
  const [isDesktopComposer, setIsDesktopComposer] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia('(min-width: 1024px)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const h = () => setIsDesktopComposer(mq.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);

  const [kind, setKind] = useState<EventKind>('event');
  const [kindPickerOpen, setKindPickerOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState<Date>(new Date());
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('10:30');
  const [allDay, setAllDay] = useState(false);
  const [repeat, setRepeat] = useState<RepeatOption>('never');
  const [timezone, setTimezone] = useState<'CET' | 'UTC' | 'EST' | 'PST'>('CET');
  const [participants, setParticipants] = useState<string[]>([]);
  const [participantInput, setParticipantInput] = useState('');
  const [meetingKind, setMeetingKind] = useState<MeetingKind>('none');
  const [conference, setConference] = useState<Conference>('meet');
  const [otherLink, setOtherLink] = useState('');
  const [location, setLocation] = useState('');
  const [travelTime, setTravelTime] = useState(false);
  const [description, setDescription] = useState('');
  const [reminder, setReminder] = useState<ReminderOption>('10');
  const [account, setAccount] = useState<AccountId>('google');
  const [accountPickerOpen, setAccountPickerOpen] = useState(false);
  const [aiOpen, setAIOpen] = useState(false);
  const [aiTab, setAITab] = useState<'templates' | 'time' | 'email'>('templates');
  const [expanded, setExpanded] = useState<ExpandedKey>(null);
  const [created, setCreated] = useState<null | { meetUrl?: string }>(null);

  const titleRef = useRef<HTMLInputElement>(null);
  const aiRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => titleRef.current?.focus(), 300);
    } else {
      setCreated(null);
      setExpanded(null);
      setAIOpen(false);
    }
  }, [open]);

  // Dismiss AI popover on outside click
  useEffect(() => {
    if (!aiOpen) return;
    const handler = (e: PointerEvent) => {
      if (aiRef.current && !aiRef.current.contains(e.target as Node)) {
        setAIOpen(false);
      }
    };
    document.addEventListener('pointerdown', handler, true);
    return () => document.removeEventListener('pointerdown', handler, true);
  }, [aiOpen]);

  const mins = useMemo(() => durationMins(startTime, endTime), [startTime, endTime]);
  const accountInfo = accounts.find((a) => a.id === account)!;

  const applyTemplate = (tpl: Template) => {
    setTitle(tpl.title);
    setEndTime(addMinutes(startTime, tpl.durationMin));
    setParticipants(tpl.participants);
    if (tpl.description) setDescription(tpl.description);
    setAIOpen(false);
  };

  const applyEmailSuggestion = (s: typeof EMAIL_SUGGESTIONS[number]) => {
    setTitle(s.title);
    setEndTime(addMinutes(startTime, s.mins));
    setParticipants(s.with);
    setAIOpen(false);
  };

  const addParticipant = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || participants.includes(trimmed)) return;
    setParticipants([...participants, trimmed]);
    setParticipantInput('');
  };

  const removeParticipant = (name: string) => {
    setParticipants(participants.filter((p) => p !== name));
  };

  const handleCreate = () => {
    if (!title.trim()) {
      titleRef.current?.focus();
      return;
    }
    const meetUrl =
      meetingKind === 'video'
        ? conference === 'meet'
          ? genMeetUrl()
          : conference === 'zoom'
            ? 'https://zoom.us/j/' + Math.floor(Math.random() * 9000 + 1000)
            : conference === 'teams'
              ? 'https://teams.microsoft.com/l/meetup-join/' + Math.random().toString(36).slice(2, 12)
              : conference === 'other'
                ? otherLink || undefined
                : undefined
        : undefined;
    setCreated({ meetUrl });
    onCreate?.({ title, meetUrl });
    setTimeout(() => onClose(), 1400);
  };

  const conferenceLabel: Record<Conference, string> = {
    none: 'Add conference call',
    meet: 'Google Meet',
    zoom: 'Zoom',
    teams: 'Microsoft Teams',
    other: 'Other link',
  };

  const reminderLabel: Record<ReminderOption, string> = {
    none: 'None',
    '5': '5 minutes before',
    '10': '10 minutes before',
    '30': '30 minutes before',
    '60': '1 hour before',
    '1440': '1 day before',
  };

  const repeatLabel: Record<RepeatOption, string> = {
    never: 'Does not repeat',
    daily: 'Daily',
    weekly: 'Weekly',
    monthly: 'Monthly',
    custom: 'Custom',
  };

  const dateTimeSummary = allDay
    ? `${dateLabel(date)} · All-day`
    : `${dateLabel(date)} · ${startTime} → ${endTime} · ${durationLabel(mins)}`;

  const toggle = (k: Exclude<ExpandedKey, null>) =>
    setExpanded((cur) => (cur === k ? null : k));

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Composer OWNS the page chrome (priority 200) — the center
              pill is the event-type dropdown; no second header anywhere. */}
          <ComposerChromeSlot
            onClose={onClose}
            kind={kind}
            onOpenKindPicker={() => setKindPickerOpen(true)}
          />

          {/* v15 — backdrop on mobile only (desktop backdrop handled by ResponsiveSheet) */}
          {!isDesktopComposer && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
            />
          )}

          {/* Sheet — bottom on mobile, right-side panel on desktop. */}
          <motion.div
            data-testid="event-composer-sheet"
            initial={isDesktopComposer ? { x: '100%' } : { y: '100%' }}
            animate={isDesktopComposer ? { x: 0 } : { y: 0 }}
            exit={isDesktopComposer ? { x: '100%' } : { y: '100%' }}
            transition={APPLE_SPRING}
            drag={isDesktopComposer ? 'x' : 'y'}
            dragConstraints={
              isDesktopComposer
                ? { left: 0, right: 0 }
                : { top: 0, bottom: 0 }
            }
            dragElastic={
              isDesktopComposer
                ? { left: 0, right: 0.25 }
                : { top: 0, bottom: 0.25 }
            }
            onDragEnd={(_, info) => {
              if (isDesktopComposer) {
                if (info.offset.x > 140 || info.velocity.x > 500) onClose();
              } else {
                if (info.offset.y > 140 || info.velocity.y > 500) onClose();
              }
            }}
            className={
              isDesktopComposer
                ? 'fixed top-0 bottom-0 right-0 z-50 glass-strong flex flex-col'
                : 'fixed inset-x-0 bottom-0 z-50 glass-strong rounded-t-[28px] pt-3 pb-5 flex flex-col'
            }
            style={
              isDesktopComposer
                ? {
                    width: 480,
                    maxWidth: '90vw',
                    height: '100vh',
                    borderTopLeftRadius: 28,
                    borderBottomLeftRadius: 28,
                    boxShadow: '-12px 0 40px rgba(0,0,0,0.18)',
                  }
                : { height: 'calc(100vh - 68px)', maxHeight: 'calc(100vh - 68px)' }
            }
          >
            {!isDesktopComposer && (
              <div className="mx-auto h-1 w-10 rounded-full bg-foreground/15 mb-3 shrink-0" />
            )}
            {isDesktopComposer && <div className="shrink-0 pt-3" />}

            {/* SUCCESS overlay */}
            <AnimatePresence>
              {created && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={APPLE_SPRING}
                  className="absolute inset-x-0 top-12 mx-auto w-[260px] glass-strong rounded-3xl p-5 z-10 text-center shadow-2xl"
                >
                  <div className="mx-auto w-12 h-12 rounded-full bg-[#30D158]/15 flex items-center justify-center mb-2">
                    <CheckCircle2 size={28} strokeWidth={1.8} className="text-[#30D158]" />
                  </div>
                  <div className="text-[14px] font-semibold tracking-[-0.005em]">Event created</div>
                  {created.meetUrl && (
                    <div className="text-[11.5px] text-foreground/65 mt-1.5 truncate">
                      {created.meetUrl}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* SCROLLABLE BODY — starts directly with Title (no internal top bar) */}
            <div className="flex-1 overflow-y-auto no-scrollbar px-5 pb-6">
              {/* TITLE + AI button row */}
              <div className="flex items-center gap-2 mb-4 relative">
                <input
                  ref={titleRef}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Title"
                  data-testid="input-event-title"
                  className="flex-1 bg-transparent text-[26px] font-semibold tracking-[-0.02em] outline-none placeholder:text-foreground/50 py-2.5 min-w-0"
                />
                <div ref={aiRef} className="relative shrink-0">
                  <button
                    onClick={() => setAIOpen((o) => !o)}
                    data-testid="button-ai"
                    aria-label="AI assistant"
                    className={`h-10 w-10 rounded-full flex items-center justify-center transition-colors ${
                      aiOpen
                        ? 'bg-foreground/20 ring-1 ring-[#20B8A6]/40'
                        : 'glass-pill active-elevate-2'
                    }`}
                  >
                    <Sparkles size={16} strokeWidth={2} className="text-icon-muted" />
                  </button>
                  <AnimatePresence>
                    {aiOpen && (
                      <motion.div
                        data-testid="ai-popover"
                        initial={{ opacity: 0, y: -6, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.96 }}
                        transition={APPLE_SPRING}
                        style={{ transformOrigin: 'top right' }}
                        className="absolute top-11 right-0 glass-strong rounded-2xl p-2 z-30 w-[280px] shadow-2xl"
                      >
                        <div className="flex items-center gap-1 mb-2 p-0.5 rounded-full bg-foreground/[0.04]">
                          {([
                            { k: 'templates' as const, label: 'Templates', I: Sparkles },
                            { k: 'time' as const, label: 'Find a time', I: Clock },
                            { k: 'email' as const, label: 'From email', I: Mail },
                          ]).map((t) => {
                            const I = t.I;
                            const active = aiTab === t.k;
                            return (
                              <button
                                key={t.k}
                                onClick={() => setAITab(t.k)}
                                data-testid={`ai-tab-${t.k}`}
                                className={`flex-1 flex items-center justify-center gap-1 px-1 py-1.5 rounded-full text-[11.5px] font-semibold transition-colors ${
                                  active ? 'bg-background shadow-sm text-foreground' : 'text-foreground/55'
                                }`}
                              >
                                <I size={11} strokeWidth={2} className={active ? 'text-foreground/70' : ''} />
                                {t.label}
                              </button>
                            );
                          })}
                        </div>

                        {aiTab === 'templates' && (
                          <div className="flex flex-col gap-1" data-testid="ai-templates">
                            {TEMPLATES.map((tpl) => (
                              <button
                                key={tpl.key}
                                onClick={() => applyTemplate(tpl)}
                                data-testid={`template-${tpl.key}`}
                                className="w-full text-left px-3 py-2 rounded-xl hover-elevate active-elevate-2 flex items-center justify-between"
                              >
                                <div>
                                  <div className="text-[13.5px] font-semibold tracking-[-0.005em]">{tpl.title}</div>
                                  <div className="text-[11.5px] text-foreground/55 mt-0.5">
                                    {durationLabel(tpl.durationMin)}{tpl.participants.length ? ` · ${tpl.participants.length} attendees` : ''}
                                  </div>
                                </div>
                                <ChevronRight size={13} className="text-foreground/40" />
                              </button>
                            ))}
                          </div>
                        )}

                        {aiTab === 'time' && (
                          <div className="flex flex-col gap-1" data-testid="ai-find-time">
                            <div className="flex items-center gap-1.5 px-2 py-1">
                              <Sparkles size={10} strokeWidth={2} className="text-foreground/70" />
                              <span className="text-[10.5px] uppercase tracking-wider font-semibold text-foreground/70">
                                Suggested by Stilt
                              </span>
                            </div>
                            {TIME_SUGGESTIONS.map((s) => (
                              <button
                                key={s.label}
                                onClick={() => {
                                  const d = new Date();
                                  d.setDate(d.getDate() + s.day);
                                  setDate(d);
                                  const newStart = hhmm(s.hour, s.minute);
                                  setStartTime(newStart);
                                  setEndTime(addMinutes(newStart, mins || 30));
                                  setAIOpen(false);
                                }}
                                data-testid={`suggestion-${s.day}`}
                                className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover-elevate active-elevate-2 text-left"
                              >
                                <span className="text-[13px] font-medium">{s.label}</span>
                                <span className="text-[11.5px] text-foreground/55">3 of 3 free</span>
                              </button>
                            ))}
                          </div>
                        )}

                        {aiTab === 'email' && (
                          <div className="flex flex-col gap-1" data-testid="ai-from-email">
                            <div className="flex items-center gap-1.5 px-2 py-1">
                              <Mail size={10} strokeWidth={2} className="text-foreground/70" />
                              <span className="text-[10.5px] uppercase tracking-wider font-semibold text-foreground/70">
                                From your inbox
                              </span>
                            </div>
                            {EMAIL_SUGGESTIONS.map((s) => (
                              <button
                                key={s.title}
                                onClick={() => applyEmailSuggestion(s)}
                                data-testid={`email-suggestion-${s.title}`}
                                className="w-full text-left px-3 py-2 rounded-xl hover-elevate active-elevate-2"
                              >
                                <div className="text-[13px] font-semibold tracking-[-0.005em]">{s.title}</div>
                                <div className="text-[11.5px] text-foreground/55 mt-0.5">
                                  {s.mins} min · with {s.with.join(', ')}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* DATE + TIME ROW */}
              <div className="mb-3 flex items-center gap-2">
                <button
                  onClick={() => toggle('time')}
                  data-testid="row-datetime"
                  className="flex-1 min-w-0 glass-pill rounded-2xl px-4 py-2.5 flex items-center gap-2.5 active-elevate-2 hover-elevate text-left"
                >
                  <Clock size={15} strokeWidth={1.7} className="text-foreground/55 shrink-0" />
                  <span className="text-[13.5px] font-medium text-foreground/90 truncate flex-1 tabular-nums">
                    {dateTimeSummary}
                  </span>
                </button>
                <button
                  onClick={() => setAllDay((v) => !v)}
                  data-testid="toggle-all-day"
                  aria-pressed={allDay}
                  className={`shrink-0 h-[42px] px-3 rounded-2xl text-[12px] font-semibold inline-flex items-center gap-1 active-elevate-2 ${
                    allDay
                      ? 'bg-foreground text-background'
                      : 'glass-pill text-foreground/75'
                  }`}
                >
                  All-day
                </button>
              </div>

              {/* DATETIME EXPANDED inline picker */}
              <AnimatePresence initial={false}>
                {expanded === 'time' && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 36 }}
                    className="overflow-hidden mb-3"
                  >
                    <div className="rounded-2xl bg-foreground/[0.04] p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground/55 w-14">Date</span>
                        <input
                          type="date"
                          value={date.toISOString().slice(0, 10)}
                          onChange={(e) => setDate(new Date(e.target.value))}
                          data-testid="input-date"
                          className="glass-pill pill px-3 py-1.5 rounded-full text-[13px] font-medium outline-none focus:ring-2 focus:ring-[#7C5CFA]/30"
                        />
                      </div>
                      {!allDay && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground/55 w-14">Time</span>
                          <input
                            type="time"
                            value={startTime}
                            onChange={(e) => {
                              const newStart = e.target.value;
                              const delta = mins;
                              setStartTime(newStart);
                              setEndTime(addMinutes(newStart, delta || 30));
                            }}
                            data-testid="input-start-time"
                            className="glass-pill pill px-3 py-1.5 rounded-full text-[13px] font-semibold tabular-nums outline-none focus:ring-2 focus:ring-[#7C5CFA]/30 w-[100px]"
                          />
                          <span className="text-foreground/45 text-[13px]">→</span>
                          <input
                            type="time"
                            value={endTime}
                            onChange={(e) => setEndTime(e.target.value)}
                            data-testid="input-end-time"
                            className="glass-pill pill px-3 py-1.5 rounded-full text-[13px] font-semibold tabular-nums outline-none focus:ring-2 focus:ring-[#7C5CFA]/30 w-[100px]"
                          />
                          <span className="text-[12px] text-foreground/55 tabular-nums">
                            {durationLabel(mins)}
                          </span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* MEETING-TYPE SEGMENTED TOGGLE (None / Video / Location) */}
              <div className="mb-2">
                <MeetingTypeToggle value={meetingKind} onChange={setMeetingKind} />
              </div>

              {/* Contextual input row for the chosen meeting type */}
              <AnimatePresence initial={false} mode="wait">
                {meetingKind === 'video' && (
                  <motion.div
                    key="video"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 36 }}
                    className="overflow-hidden"
                  >
                    <div
                      data-testid="meeting-type-video-row"
                      className="mt-2 mb-1 rounded-2xl bg-foreground/[0.04] p-2.5"
                    >
                      <div className="flex flex-wrap items-center gap-1.5">
                        {(['meet', 'zoom', 'teams', 'other'] as const).map((c) => (
                          <button
                            key={c}
                            onClick={() => setConference(c)}
                            data-testid={`conference-${c}`}
                            className={`rounded-full px-3 py-1.5 text-[12.5px] font-semibold inline-flex items-center gap-1.5 active-elevate-2 ${
                              conference === c
                                ? 'bg-foreground text-background'
                                : 'glass-pill text-foreground/75'
                            }`}
                          >
                            <Video size={12} strokeWidth={1.8} />
                            {conferenceLabel[c]}
                          </button>
                        ))}
                      </div>
                      {(conference === 'meet' || conference === 'zoom' || conference === 'teams') && (
                        <div className="mt-2 flex items-center gap-1.5 text-[11.5px] text-foreground/55 px-1">
                          <Sparkles size={10} strokeWidth={2} className="text-foreground/70" />
                          Link will be generated when you create
                        </div>
                      )}
                      {conference === 'other' && (
                        <input
                          value={otherLink}
                          onChange={(e) => setOtherLink(e.target.value)}
                          placeholder="Paste meeting link"
                          className="mt-2 glass-pill pill w-full px-3 py-2 rounded-full text-[13.5px] outline-none focus:ring-2 focus:ring-[#7C5CFA]/30"
                        />
                      )}
                    </div>
                  </motion.div>
                )}
                {meetingKind === 'location' && (
                  <motion.div
                    key="location"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 36 }}
                    className="overflow-hidden"
                  >
                    <div
                      data-testid="meeting-type-location-row"
                      className="mt-2 mb-1 rounded-2xl bg-foreground/[0.04] p-2.5 space-y-2"
                    >
                      <div className="flex items-center gap-2">
                        <MapPin size={15} strokeWidth={1.7} className="text-foreground/55 shrink-0" />
                        <input
                          value={location}
                          onChange={(e) => setLocation(e.target.value)}
                          placeholder="Address or room"
                          data-testid="input-location"
                          className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-foreground/40 py-1.5"
                        />
                      </div>
                      <button
                        onClick={() => setTravelTime((v) => !v)}
                        data-testid="chip-travel-time"
                        className={`rounded-full px-3 py-1.5 inline-flex items-center gap-1.5 text-[12px] font-medium active-elevate-2 ${
                          travelTime
                            ? 'bg-foreground/10 text-foreground/70 ring-1 ring-[#20B8A6]/30'
                            : 'glass-pill text-foreground/75'
                        }`}
                      >
                        <Timer size={11} strokeWidth={1.8} />
                        {travelTime ? 'Travel time added' : 'Add travel time?'}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* STACKED FIELD ROWS — People / Reminder / Repeat / Time zone / Description */}
              <div className="mt-3 space-y-0.5">
                <Row
                  icon={Users}
                  label="People"
                  value={participants.length ? `${participants.length} ${participants.length === 1 ? 'person' : 'people'}` : undefined}
                  placeholder="Add people"
                  expanded={expanded === 'people'}
                  onToggle={() => toggle('people')}
                  testId="row-people"
                >
                  <div className="glass-pill rounded-2xl px-2.5 py-1.5 flex flex-wrap items-center gap-1.5">
                    {participants.map((p) => (
                      <span
                        key={p}
                        className="bg-foreground/[0.06] rounded-full pl-1 pr-2 py-0.5 flex items-center gap-1.5 text-[12.5px] font-medium"
                        data-testid={`chip-participant-${p}`}
                      >
                        <StiltAvatar name={p} size={20} />
                        {p}
                        <button
                          onClick={() => removeParticipant(p)}
                          className="h-4 w-4 rounded-full flex items-center justify-center text-foreground/55 hover:text-foreground/85"
                          aria-label={`Remove ${p}`}
                        >
                          <X size={10} strokeWidth={2} />
                        </button>
                      </span>
                    ))}
                    <input
                      value={participantInput}
                      onChange={(e) => setParticipantInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ',') {
                          e.preventDefault();
                          addParticipant(participantInput);
                        } else if (e.key === 'Backspace' && participantInput === '' && participants.length > 0) {
                          e.preventDefault();
                          setParticipants(participants.slice(0, -1));
                        }
                      }}
                      placeholder={participants.length === 0 ? 'Type a name and press Enter' : 'Add another'}
                      data-testid="input-participants"
                      className="flex-1 min-w-[120px] bg-transparent outline-none text-[13.5px] py-1 placeholder:text-foreground/40"
                    />
                  </div>
                </Row>

                <Row
                  icon={Bell}
                  label="Reminder"
                  value={reminderLabel[reminder]}
                  expanded={expanded === 'reminder'}
                  onToggle={() => toggle('reminder')}
                  testId="row-reminder"
                >
                  <div className="flex flex-col gap-0.5">
                    {(['none', '5', '10', '30', '60', '1440'] as const).map((r) => (
                      <button
                        key={r}
                        onClick={() => setReminder(r)}
                        data-testid={`reminder-${r}`}
                        className="w-full flex items-center px-3 py-2 rounded-xl text-[13.5px] font-medium hover-elevate active-elevate-2 text-left"
                      >
                        {reminderLabel[r]}
                        {reminder === r && <Check size={14} className="ml-auto text-foreground/70" />}
                      </button>
                    ))}
                  </div>
                </Row>

                <Row
                  icon={Repeat}
                  label="Repeat"
                  value={repeatLabel[repeat]}
                  expanded={expanded === 'repeat'}
                  onToggle={() => toggle('repeat')}
                  testId="row-repeat"
                >
                  <div className="flex flex-col gap-0.5">
                    {(['never', 'daily', 'weekly', 'monthly', 'custom'] as const).map((r) => (
                      <button
                        key={r}
                        onClick={() => setRepeat(r)}
                        data-testid={`repeat-${r}`}
                        className="w-full flex items-center px-3 py-2 rounded-xl text-[13.5px] font-medium hover-elevate active-elevate-2 text-left"
                      >
                        {repeatLabel[r]}
                        {repeat === r && <Check size={14} className="ml-auto text-foreground/70" />}
                      </button>
                    ))}
                  </div>
                </Row>

                <Row
                  icon={Globe}
                  label="Time zone"
                  value={timezone}
                  expanded={expanded === 'timezone'}
                  onToggle={() => toggle('timezone')}
                  testId="row-timezone"
                >
                  <div className="flex flex-col gap-0.5">
                    {(['CET', 'UTC', 'EST', 'PST'] as const).map((tz) => (
                      <button
                        key={tz}
                        onClick={() => setTimezone(tz)}
                        data-testid={`timezone-${tz}`}
                        className="w-full flex items-center px-3 py-2 rounded-xl text-[13.5px] font-medium hover-elevate active-elevate-2 text-left"
                      >
                        {tz}
                        {timezone === tz && <Check size={14} className="ml-auto text-foreground/70" />}
                      </button>
                    ))}
                  </div>
                </Row>

                <Row
                  icon={FileText}
                  label="Description"
                  value={description ? description.slice(0, 30) + (description.length > 30 ? '…' : '') : undefined}
                  placeholder="Add description"
                  expanded={expanded === 'description'}
                  onToggle={() => toggle('description')}
                  testId="row-description"
                >
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Notes, agenda, links…"
                    rows={3}
                    data-testid="input-description"
                    className="w-full glass-pill rounded-2xl px-4 py-3 text-[13.5px] outline-none focus:ring-2 focus:ring-[#7C5CFA]/30 placeholder:text-foreground/40 resize-none"
                  />
                </Row>
              </div>

              {/* ACCOUNT — integrated as a card with explicit label */}
              <div className="mt-5">
                <div className="text-[11px] uppercase tracking-wider font-semibold text-foreground/50 mb-1.5 px-1">
                  Create on
                </div>
                <button
                  onClick={() => setAccountPickerOpen(true)}
                  data-testid="button-account"
                  className="w-full glass-pill rounded-2xl px-3 py-3 flex items-center gap-3 active-elevate-2 hover-elevate text-left"
                >
                  <span
                    className="w-3 h-3 rounded-full shrink-0 ring-2 ring-background"
                    style={{ background: accountInfo.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-semibold tracking-[-0.005em] truncate">
                      {accountInfo.provider}
                    </div>
                    <div className="text-[12px] text-foreground/55 truncate">
                      {accountInfo.email}
                    </div>
                  </div>
                  <ChevronDown size={14} className="text-foreground/55 shrink-0" />
                </button>
              </div>
            </div>

            {/* FOOTER — soft top fade gradient instead of a hard line */}
            <div className="relative shrink-0 px-5 pt-3">
              {/* Gradient fade so content slips into the footer rather than
                  being cut by a dark line. */}
              <div
                aria-hidden
                className="pointer-events-none absolute -top-6 inset-x-0 h-6 bg-gradient-to-b from-transparent to-[var(--glass-strong-bg,rgba(255,255,255,0.78))] dark:to-black/40"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={onClose}
                  data-testid="button-composer-cancel"
                  className="glass-pill pill h-[52px] px-5 rounded-full text-[14px] font-medium text-foreground/80 active-elevate-2"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  data-testid="button-composer-create"
                  className="mono-circle pill h-[52px] px-5 rounded-full flex items-center gap-1.5 text-[14px] font-semibold"
                  style={{ width: 'auto' }}
                >
                  <Plus size={15} strokeWidth={2.2} />
                  Create
                </button>
              </div>
            </div>
          </motion.div>

          {/* EVENT-KIND PICKER (bottom sheet) */}
          <AnimatePresence>
            {kindPickerOpen && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setKindPickerOpen(false)}
                  className="fixed inset-0 z-[60] bg-black/40"
                />
                <motion.div
                  data-testid="kind-picker-sheet"
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={APPLE_SPRING}
                  className="fixed inset-x-0 bottom-0 z-[61] glass-strong rounded-t-[28px] pt-3 pb-6 px-5"
                >
                  <div className="mx-auto h-1 w-10 rounded-full bg-foreground/15 mb-4" />
                  <div className="text-[11px] uppercase tracking-wider font-semibold text-foreground/55 mb-2 px-1">
                    Type
                  </div>
                  <div className="flex flex-col gap-1">
                    {(['event', 'task', 'reminder'] as const).map((k) => {
                      const { label, Icon } = EVENT_KIND_META[k];
                      return (
                        <button
                          key={k}
                          onClick={() => {
                            setKind(k);
                            setKindPickerOpen(false);
                          }}
                          data-testid={`kind-option-${k}`}
                          className="flex items-center gap-3 p-3 rounded-2xl hover-elevate active-elevate-2 text-left"
                        >
                          <Icon size={16} strokeWidth={1.8} className="text-foreground/65" />
                          <div className="flex-1 min-w-0">
                            <div className="text-[14px] font-semibold tracking-[-0.005em]">
                              {label}
                            </div>
                          </div>
                          {kind === k && (
                            <Check size={16} strokeWidth={2} className="text-foreground/70 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          {/* ACCOUNT PICKER */}
          <AnimatePresence>
            {accountPickerOpen && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setAccountPickerOpen(false)}
                  className="fixed inset-0 z-[60] bg-black/40"
                />
                <motion.div
                  data-testid="account-picker-sheet"
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={APPLE_SPRING}
                  className="fixed inset-x-0 bottom-0 z-[61] glass-strong rounded-t-[28px] pt-3 pb-6 px-5"
                >
                  <div className="mx-auto h-1 w-10 rounded-full bg-foreground/15 mb-4" />
                  <div className="text-[11px] uppercase tracking-wider font-semibold text-foreground/55 mb-2 px-1">
                    Create on
                  </div>
                  <div className="flex flex-col gap-1">
                    {accounts.filter((a) => a.id !== 'personal').map((a) => (
                      <button
                        key={a.id}
                        onClick={() => { setAccount(a.id); setAccountPickerOpen(false); }}
                        data-testid={`account-option-${a.id}`}
                        className="flex items-center gap-3 p-3 rounded-2xl hover-elevate active-elevate-2 text-left"
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ background: a.color }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-[14px] font-semibold tracking-[-0.005em]">
                            {a.provider}
                          </div>
                          <div className="text-[12px] text-foreground/55 truncate">
                            {a.email}
                          </div>
                        </div>
                        {account === a.id && (
                          <Check size={16} strokeWidth={2} className="text-foreground/70 shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </>
      )}
    </AnimatePresence>
  );
}
