// ─────────────────────────────────────────────────────────────────
// LeadContextPanel · the right-hand context column of a conversation.
//
// Two tabs:
//   • Overview · the AI mascot TALKS first (a warm, first-person read of how
//     the conversation is going + what phase it is in: interpretation only,
//     never a to-do), then the factual gradient status bar (GoalPill +
//     ConversionBar + stage label, reused 1:1 from the inbox row), then a
//     quiet Context block (location / size / industry + signal bullets).
//   • Contact · a rich lead dossier (Contact / Company / Role), revealed on
//     demand. Locked state shows a tasteful reveal affordance; revealed state
//     is a clean, dense set of copyable rows.
//
// Design system: single blue accent (#2F6BFF). The ONLY colour exception is
// the persona fin colour carried by the talking mascot (activePersona). Real
// glass primitives (rp-card / lg-card / glass-pill), Apple-spring motion, the
// Persona "Example message" soul brought here as a living AI read.
//
// IMPORTANT: there is NO "next best action" element anywhere. The drafts are
// already queued or auto-sent by autopilot, so the AI read is pure
// interpretation of the conversation state, never a recommended action.
// goalStage (No reply -> Replied -> In conversation -> Interested -> Ready)
// stays the single source of truth for how warm / far the thread is.
// ─────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  MapPin,
  Building2,
  Users,
  Lock,
  Copy,
  Check,
  Linkedin,
  Mail,
  Phone,
  Globe,
  Briefcase,
  Sparkles,
  Loader2,
  ArrowUpRight,
  UserPlus,
  ThumbsUp,
  MessageSquare,
  Send,
  CornerUpRight,
  Clock,
} from 'lucide-react';
import type { Conversation } from '@/data/mockConversations';
import { STAGE_META } from '@/data/mockConversations';
import {
  DEFAULT_FLOW,
  FLOW_STEP_META,
  type FlowStep,
  type FlowStepKind,
} from '@/data/mockCampaigns';
import { GoalPill, ConversionBar } from '@/components/CampaignsList';
import { ReplaiyAvatar } from '@/components/Avatar';
import { activePersona } from '@/data/mockPersona';
import { useReplaiy } from '@/state/ReplaiyContext';
import { GlassSegmentedToggle } from '@/components/GlassSegmentedToggle';

const ACCENT = '#2F6BFF';

type Tab = 'overview' | 'contact';

// ── Small em-dash-free normaliser ──────────────────────────────────
// Shared summary / read copy may contain em-dashes; the design system is
// strictly em-dash-free, so normalise to a mid-dot.
function noDash(s: string) {
  return s.replace(/\s*\u2014\s*/g, ' · ');
}

// ── Flow timing model ──────────────────────────────────────────────
// A lead shown in this column is BY DEFINITION already in conversation, so
// every outreach step up to and including the opening message has already
// HAPPENED. We never claim a "current" outreach step. Instead each step is
// either 'done' (executed in the past), 'scheduled' (queued for the near
// future) or 'pending' (not yet scheduled). The real backend will carry true
// timestamps later; until then we synthesise REALISTIC times that are stable
// per lead and vary believably by goalStage.
type FlowStatus = 'done' | 'scheduled' | 'pending';
type GoalStage = keyof typeof STAGE_META;

// The outreach steps that lead up to and including the opening message. For
// any lead shown here, these always happened.
const DONE_BEFORE_MESSAGE: FlowStepKind[] = ['like', 'connect', 'comment', 'message'];

// A tiny, stable, dependency-free string hash. Used to derive a per-lead
// offset from the conversation id so the synthetic times stay stable between
// renders but DO differ from lead to lead.
function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// How long ago (in days) each stage roughly started its outreach. A 'ready'
// lead has been worked longer than a fresh 'in_conversation' one, so its done
// steps sit further in the past and its follow-up has already gone out.
function stageAgeDays(stage: GoalStage): number {
  switch (stage) {
    case 'no_reply':
      return 2;
    case 'replied':
      return 3;
    case 'in_conversation':
      return 4;
    case 'interested':
      return 6;
    case 'ready':
      return 8;
    default:
      return 4;
  }
}

// For later stages a nudge has already gone out, so follow_up reads as done.
function followUpIsDone(stage: GoalStage): boolean {
  return stage === 'ready' || stage === 'interested';
}

export interface FlowTiming {
  status: FlowStatus;
  executedAt?: Date;
  scheduledFor?: Date;
}

// Per-step status + a synthetic timestamp, derived deterministically from the
// conversation id (stable per lead) and goalStage (varies the picture). The
// done steps are spread monotonically across the lead's outreach window so
// earlier steps always read as having happened earlier; the follow-up is
// either a recent 'done' nudge (warm leads) or a calm near-future 'scheduled'
// moment (active leads).
function buildFlowTiming(
  mail: Conversation,
  flow: FlowStep[],
  stage: GoalStage,
): FlowTiming[] {
  const now = Date.now();
  const seed = hashId(mail.id);
  // A small stable per-lead jitter (0..11 hours) so two same-stage leads still
  // differ a little.
  const jitterHours = seed % 12;

  // The done outreach steps span from windowStartDays ago up to the most
  // recent one a few hours / a day ago, scaled by stage.
  const windowStartDays = stageAgeDays(stage);
  const msgIdx = flow.findIndex((f) => f.kind === 'message');

  // Which steps read as done: everything up to + including message, plus
  // follow_up (or any post-message step) when the stage says a nudge went out.
  const doneFlags = flow.map((s, i) => {
    if (DONE_BEFORE_MESSAGE.includes(s.kind)) return true;
    if (msgIdx >= 0 && i > msgIdx) return followUpIsDone(stage);
    return true;
  });
  const doneCount = doneFlags.filter(Boolean).length;

  let doneSeen = 0;
  return flow.map((_step, i) => {
    const isDone = doneFlags[i];
    if (isDone) {
      // Spread done steps monotonically: first done step furthest in the past,
      // last done step most recent. The most recent done step lands a few
      // hours / up to ~1 day ago depending on the per-lead jitter.
      const frac = doneCount <= 1 ? 1 : doneSeen / (doneCount - 1);
      doneSeen++;
      // From windowStartDays ago (frac 0) down to ~0.25 day ago (frac 1).
      const agoDays = windowStartDays - frac * (windowStartDays - 0.25);
      const executedAt = new Date(now - agoDays * DAY_MS - jitterHours * HOUR_MS);
      return { status: 'done' as FlowStatus, executedAt };
    }
    // Scheduled: a calm near-future moment. Warmer active leads are closer to
    // their next touch; the per-lead jitter keeps it believable.
    const baseHours = stage === 'in_conversation' ? 30 : stage === 'replied' ? 40 : 48;
    const scheduledFor = new Date(now + (baseHours + jitterHours) * HOUR_MS);
    return { status: 'scheduled' as FlowStatus, scheduledFor };
  });
}

// ── Relative time formatting · simple, dependency-free, no em-dashes ──
function formatRelativePast(date: Date): string {
  const ms = Date.now() - date.getTime();
  if (ms < 60 * 1000) return 'just now';
  const mins = Math.round(ms / (60 * 1000));
  if (mins < 60) return `${mins} ${mins === 1 ? 'minute' : 'minutes'} ago`;
  const hours = Math.round(ms / HOUR_MS);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.round(ms / DAY_MS);
  if (days < 7) return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  const weeks = Math.round(days / 7);
  return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
}

function formatRelativeFuture(date: Date): string {
  const ms = date.getTime() - Date.now();
  if (ms <= 0) return 'shortly';
  const hours = Math.round(ms / HOUR_MS);
  if (hours < 20) return `in ~${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  // Within roughly the next day: show "tomorrow ~HH:MM".
  const days = Math.round(ms / DAY_MS);
  if (days <= 1) {
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `tomorrow ~${hh}:${mm}`;
  }
  return `in ~${days} days`;
}

// ── Quiet uppercase section label (Persona-page rhythm) ────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-foreground/40 mb-2.5">
      {children}
    </div>
  );
}

// ── A quiet labelled context row (icon + label + value) ────────────
function ContextRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2.5 py-[7px]">
      <Icon size={14} strokeWidth={1.8} className="text-icon-muted shrink-0" />
      <span className="text-[12.5px] text-foreground/45 w-[58px] shrink-0">{label}</span>
      <span className="text-[12.5px] text-foreground/85 truncate">{value}</span>
    </div>
  );
}

// ── Lucide icon per flow-step kind (mirrors CampaignDetail's FLOW_ICONS) ──
const FLOW_ICONS: Record<FlowStepKind, typeof Send> = {
  connect: UserPlus,
  like: ThumbsUp,
  comment: MessageSquare,
  message: Send,
  follow_up: CornerUpRight,
};

function MetaLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2.5">
      <span className="text-[11.5px] text-foreground/40 w-[64px] shrink-0">{label}</span>
      <span className="text-[12px] font-medium text-foreground/75 truncate min-w-0">
        {value}
      </span>
    </div>
  );
}

// ── FLOW section · a vertical top-to-bottom timeline ──────────────
// Same look as the CampaignDetail Flow card (icon rail + connector line +
// label + a time pill + hint), wrapped in an lg-card to match Context /
// Signals. Status comes from buildFlowTiming, which reflects that a lead shown
// here is already in conversation: the outreach steps up to + including the
// opening message are DONE, and the follow-up is either DONE (warm leads) or
// SCHEDULED for a calm near-future moment (active leads).
//
// VISUAL RESTRAINT (matches the CampaignDetail Flow card): NEUTRAL grey icon
// tiles + a single thin NEUTRAL connector throughout, exactly like the
// campaign flow. Blue is a rare micro-accent only: (1) the small check badge
// on done steps is the sole "done" signal, and (2) the soft-blue future-time
// pill on the scheduled step is the sole "upcoming" signal. No blue tiles, no
// blue connector trail, no blue labels. Done time pills ("X ago") stay muted;
// the scheduled clock badge stays neutral so the blue pill is the only blue.
// We never claim a hard "Step N of M" and never emphasise a "current" step.
function FlowSection({
  flow,
  timing,
}: {
  flow: FlowStep[];
  timing: FlowTiming[];
}) {
  return (
    <div data-testid="lead-flow-section">
      <SectionLabel>Flow</SectionLabel>
      <div className="lg-card rounded-[16px] px-3.5 py-2.5">
        <div className="flex flex-col">
          {flow.map((step, i) => {
            const meta = FLOW_STEP_META[step.kind];
            const Icon = FLOW_ICONS[step.kind];
            const t = timing[i];
            const last = i === flow.length - 1;
            const isDone = t.status === 'done';
            const isScheduled = t.status === 'scheduled';
            // The time pill text: relative past for done, soft future for
            // scheduled, a quiet "after previous" for pending.
            const timeText = isDone
              ? t.executedAt
                ? formatRelativePast(t.executedAt)
                : null
              : isScheduled
                ? t.scheduledFor
                  ? formatRelativeFuture(t.scheduledFor)
                  : null
                : 'after previous';
            return (
              <div
                key={`${step.kind}-${i}`}
                data-testid={`flow-step-${step.kind}-${i}`}
                className="flex items-start gap-3 py-2"
              >
                {/* Icon rail + connector line. NEUTRAL grey tile + thin
                    neutral connector throughout, exactly like CampaignDetail.
                    Blue appears only as the tiny done-check badge; the
                    scheduled clock badge stays neutral so the blue future-time
                    pill is the sole blue on a scheduled step. */}
                <div className="relative flex flex-col items-center shrink-0">
                  <div className="relative h-8 w-8 rounded-xl bg-foreground/[0.06] dark:bg-white/[0.08] flex items-center justify-center">
                    <Icon size={15} strokeWidth={1.9} className="text-foreground/65" />
                    {isDone && (
                      <span
                        aria-hidden
                        className="absolute -right-1 -bottom-1 h-3.5 w-3.5 rounded-full flex items-center justify-center"
                        style={{ background: ACCENT }}
                      >
                        <Check size={9} strokeWidth={3} className="text-white" />
                      </span>
                    )}
                    {isScheduled && (
                      <span
                        aria-hidden
                        className="absolute -right-1 -bottom-1 h-3.5 w-3.5 rounded-full flex items-center justify-center bg-foreground/[0.10] dark:bg-white/[0.14]"
                      >
                        <Clock size={9} strokeWidth={2.4} className="text-foreground/55" />
                      </span>
                    )}
                  </div>
                  {!last && (
                    <span
                      aria-hidden="true"
                      className="absolute top-8 h-[calc(100%-1rem)] w-px bg-foreground/[0.10] dark:bg-white/[0.12]"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="text-[12.5px] font-semibold tracking-[-0.005em] truncate"
                      style={{
                        color:
                          isDone || isScheduled
                            ? 'var(--foreground)'
                            : 'hsl(var(--foreground) / 0.5)',
                      }}
                    >
                      {noDash(meta.label)}
                    </span>
                    {timeText && (
                      <span
                        className="shrink-0 glass-pill rounded-full inline-flex items-center h-[20px] px-2 text-[10.5px] font-medium tabular-nums whitespace-nowrap"
                        style={{
                          color: isScheduled
                            ? ACCENT
                            : 'hsl(var(--foreground) / 0.5)',
                        }}
                      >
                        {timeText}
                      </span>
                    )}
                  </div>
                  <p
                    className="mt-0.5 text-[11.5px] leading-snug m-0"
                    style={{
                      color:
                        isDone || isScheduled
                          ? 'hsl(var(--foreground) / 0.5)'
                          : 'hsl(var(--foreground) / 0.38)',
                    }}
                  >
                    {noDash(meta.hint)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── A copyable dossier row · quiet, dense, with a copy affordance ───
function DossierRow({
  icon: Icon,
  label,
  value,
  href,
  copyValue,
  testId,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
  /** When set, the row is a link (LinkedIn / website) with an external glyph. */
  href?: string;
  /** When set, the row is copyable with a copy / check glyph. */
  copyValue?: string;
  testId?: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    if (copyValue == null) return;
    try {
      navigator.clipboard?.writeText(copyValue);
    } catch {
      /* clipboard not available in this context */
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  const inner = (
    <>
      <Icon size={14} strokeWidth={1.8} className="text-icon-muted shrink-0" />
      <span className="text-[11px] text-foreground/40 w-[58px] shrink-0">{label}</span>
      <span className="text-[12.5px] text-foreground/90 truncate flex-1">{value}</span>
      {href ? (
        <ArrowUpRight size={14} strokeWidth={1.9} style={{ color: ACCENT }} className="shrink-0" />
      ) : copied ? (
        <Check size={13} strokeWidth={2.2} style={{ color: ACCENT }} className="shrink-0" />
      ) : copyValue != null ? (
        <Copy size={13} strokeWidth={1.8} className="text-icon-muted shrink-0" />
      ) : null}
    </>
  );

  const cls =
    'w-full flex items-center gap-2.5 py-2 text-left rounded-lg px-1.5 -mx-1.5 hover-elevate active-elevate-2';

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        data-testid={testId}
        className={cls}
      >
        {inner}
      </a>
    );
  }
  return (
    <button type="button" onClick={copy} data-testid={testId} className={cls}>
      {inner}
    </button>
  );
}

// ── Per-field enrichment state (Apollo-style) ──────────────────────
// Only email + phone cost credits, so each is revealed on demand and moves
// through three states: 'locked' (masked, with an Access affordance),
// 'searching' (a brief lookup spinner) and 'resolved' (either the real value
// as a copyable DossierRow, or a calm not-found line). State is INDEPENDENT
// per field and reset whenever the lead changes.
type FieldState = 'locked' | 'searching' | 'resolved';

// ── An enrichable contact row · email / phone (locked -> searching -> resolved)
// In the locked state it shows the label + a subtle dotted placeholder + a
// small blue "Access" pill (the actionable unlock). On click it goes straight
// to a brief "Searching..." beat (no confirmation popup), then resolves: if a
// value exists it renders a copyable DossierRow (with the existing copy testid);
// if not, a quiet "No verified ... found" line. No credit numbers anywhere.
function EnrichableRow({
  icon: Icon,
  label,
  value,
  state,
  notFoundText,
  onAccess,
  accessTestId,
  copyTestId,
}: {
  icon: typeof Mail;
  label: string;
  /** The resolved value when found; undefined means the lookup found nothing. */
  value?: string;
  state: FieldState;
  notFoundText: string;
  onAccess: () => void;
  accessTestId: string;
  copyTestId: string;
}) {
  // Resolved + found -> reuse the copyable DossierRow verbatim (copy testid).
  if (state === 'resolved' && value) {
    return (
      <DossierRow
        icon={Icon}
        label={label}
        value={value}
        copyValue={value}
        testId={copyTestId}
      />
    );
  }

  // Resolved + not found -> a calm, muted line (no value, no error-red).
  if (state === 'resolved' && !value) {
    return (
      <div className="flex items-center gap-2.5 py-2 px-1.5 -mx-1.5">
        <Icon size={14} strokeWidth={1.8} className="text-icon-muted shrink-0" />
        <span className="text-[11px] text-foreground/40 w-[58px] shrink-0">{label}</span>
        <span className="text-[12px] text-foreground/40 italic truncate flex-1">
          {notFoundText}
        </span>
      </div>
    );
  }

  // Locked / searching -> label + (placeholder | spinner) + access affordance.
  const searching = state === 'searching';
  return (
    <div className="flex items-center gap-2.5 py-2 px-1.5 -mx-1.5">
      <Icon size={14} strokeWidth={1.8} className="text-icon-muted shrink-0" />
      <span className="text-[11px] text-foreground/40 w-[58px] shrink-0">{label}</span>
      {searching ? (
        <span className="flex items-center gap-1.5 flex-1 min-w-0 text-[12px] text-foreground/45">
          <Loader2 size={13} strokeWidth={2.2} className="animate-spin shrink-0" />
          Searching...
        </span>
      ) : (
        <span
          aria-hidden
          className="flex-1 min-w-0 overflow-hidden whitespace-nowrap text-[13px] tracking-[0.16em] text-foreground/25 select-none"
        >
          • • • • •
        </span>
      )}
      <button
        type="button"
        data-testid={accessTestId}
        onClick={onAccess}
        disabled={searching}
        className="shrink-0 glass-pill rounded-full inline-flex items-center gap-1 h-[24px] pl-2 pr-2.5 text-[11px] font-semibold whitespace-nowrap transition-transform hover:scale-[1.03] active:scale-[0.97] disabled:opacity-60 disabled:hover:scale-100"
        style={{ color: ACCENT }}
      >
        <Lock size={11} strokeWidth={2.2} />
        Access {label.toLowerCase()}
      </button>
    </div>
  );
}

export function LeadContextPanel({ mail }: { mail: Conversation }) {
  const [tab, setTab] = useState<Tab>('overview');

  // ── Per-field enrichment state for email + phone, keyed per lead ──
  // Each field is independent. We reset both to 'locked' whenever the lead
  // changes (the component is reused across conversations), so opening a new
  // lead always shows the gated fields locked again, never stuck revealed from
  // a previous lead. Pending search timers are cleared on lead switch / unmount.
  const [emailState, setEmailState] = useState<FieldState>('locked');
  const [phoneState, setPhoneState] = useState<FieldState>('locked');
  const timersRef = useRef<number[]>([]);

  // Live persona drives the talking mascot avatar + its fin colour, exactly
  // like the AI-draft avatar in the reply bar. Active "warm" = the blue-fin
  // mascot, so the column feels like the Persona page Simon loves.
  const { persona: livePersona } = useReplaiy();
  const persona = activePersona(livePersona);

  const lead = mail.lead;
  const title = lead?.title ?? mail.leadHeadline;
  const company = lead?.company ?? mail.leadCompany;

  // Conversation status · reuse the EXACT inbox-row treatment.
  const goalType = mail.goalType ?? 'meeting';
  const stage = mail.goalStage ?? 'no_reply';
  const stageMeta = STAGE_META[stage];

  const hasContext =
    !!lead &&
    (!!lead.location || !!lead.companySize || !!lead.industry || (lead.signals?.length ?? 0) > 0);
  const hasContact = !!lead && (!!lead.email || !!lead.phone || !!lead.linkedinUrl);
  const hasCompany =
    !!lead && (!!lead.company || !!lead.industry || !!lead.companySize || !!lead.location);

  const linkedinHref = lead?.linkedinUrl && lead.linkedinUrl !== '#' ? lead.linkedinUrl : undefined;

  // The AI read text, em-dash-free. Pure interpretation, never an action.
  const readText = mail.aiRead ? noDash(mail.aiRead) : null;

  // Campaign context · what campaign this lead lives in, its goal, and the
  // per-lead flow. The conversation carries no flow of its own, so we use the
  // campaign DEFAULT_FLOW. buildFlowTiming then derives per-step done /
  // scheduled status + a stable, per-lead synthetic time from the conversation
  // id and goalStage (never a counter, never a "current" outreach step).
  const campaignName = mail.campaignName;
  const flow = DEFAULT_FLOW;
  const flowTiming = buildFlowTiming(mail, flow, stage);
  // ICP fit · defined per campaign. Shown as a quiet key/value, omitted if null.
  const fitScore = lead?.fitScore ?? null;

  // ── Reset per-field enrichment whenever the lead changes ──────────
  // The panel is reused across conversations, so when mail.id changes we drop
  // both fields back to 'locked' and clear any pending search timers. This
  // guarantees a freshly opened lead shows email / phone gated again, never
  // stuck on a previous lead's revealed value.
  useEffect(() => {
    setEmailState('locked');
    setPhoneState('locked');
    return () => {
      timersRef.current.forEach((id) => window.clearTimeout(id));
      timersRef.current = [];
    };
  }, [mail.id]);

  // The "found" result comes straight from the mock lead data: a field that
  // exists resolves to that value, an absent field resolves to not-found. We
  // keep the ~1s "Searching..." beat in BOTH cases so the lookup always reads.
  function runSearch(setState: (s: FieldState) => void) {
    setState('searching');
    // 900-1400ms, randomised slightly so email + phone don't resolve in lockstep.
    const delay = 950 + Math.floor(Math.random() * 450);
    const id = window.setTimeout(() => setState('resolved'), delay);
    timersRef.current.push(id);
  }

  const accessEmail = () => {
    if (emailState === 'locked') runSearch(setEmailState);
  };
  const accessPhone = () => {
    if (phoneState === 'locked') runSearch(setPhoneState);
  };
  // Reveal all · triggers both gated fields at once; each still runs its own
  // independent search -> resolve. Only fires the fields still locked.
  const revealAll = () => {
    if (emailState === 'locked') runSearch(setEmailState);
    if (phoneState === 'locked') runSearch(setPhoneState);
  };
  const anyLocked = emailState === 'locked' || phoneState === 'locked';

  return (
    <div
      data-testid="lead-context-panel"
      className="h-full overflow-y-auto no-scrollbar"
    >
      {/* ── Tab control (sticky, transparent) ───────────────────────────
          Mirrors the platform's TopBar pattern (Chrome.tsx ~L173): the header
          is `sticky top-0 z-20 bg-transparent pointer-events-none`, so the
          content scrolls visibly BEHIND it and the wheel/scroll events pass
          through to the scroll surface. NO opaque fill and NO custom backdrop
          bar — the glass pill (lg-card) carries its OWN blur, which frosts
          whatever scrolls behind it, exactly like the nav/inbox tabs. The
          pill wrapper re-enables `pointer-events-auto` so the toggle stays
          interactive. `pb-3` spacing under the pill keeps the first card from
          tucking under the tabs on initial load. */}
      <div className="sticky top-0 z-20 bg-transparent pointer-events-none px-4 pt-4 pb-3">
        <div
          className="lg-card rounded-full inline-flex pointer-events-auto"
          style={{ height: 34 }}
        >
          <GlassSegmentedToggle<Tab>
            testId="lead-tab"
            pad={4}
            hideIcons
            indicatorStyle="glass-rich"
            value={tab}
            onChange={setTab}
            segments={[
              { key: 'overview', label: 'Overview', activeWidth: 158, inactiveWidth: 142 },
              { key: 'contact', label: 'Contact', activeWidth: 158, inactiveWidth: 142 },
            ]}
          />
        </div>
      </div>

      {/* Content area. The sticky tabs above scroll-overlap this content, so
          the cards softly pass behind the glass pill as you scroll. */}
      <div className="px-4 pb-6">
        <AnimatePresence mode="wait">
          {tab === 'overview' ? (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
              className="flex flex-col gap-5"
            >
              {/* 1 · THE AI, TALKING. The hero. Mascot as a living sender,
                     a first-person read of how the conversation is going. */}
              <div
                className="rp-card rounded-[20px] px-4 pt-3.5 pb-3.5"
                style={{ ['--ai-accent' as never]: persona.color }}
              >
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="relative w-[36px] h-[36px] shrink-0 flex items-center justify-center">
                    {/* Soft persona-colour podium behind the mascot, so it
                        reads as a character (Persona-page treatment). */}
                    <motion.span
                      aria-hidden
                      className="absolute inset-[-2px] rounded-full"
                      style={{
                        background: `radial-gradient(circle at 50% 50%, ${persona.color}, transparent 68%)`,
                        filter: 'blur(7px)',
                        opacity: 0.5,
                      }}
                      animate={{ opacity: [0.42, 0.58, 0.42] }}
                      transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
                    />
                    <motion.img
                      src={persona.mascot}
                      alt=""
                      aria-hidden
                      draggable={false}
                      className="relative w-[36px] h-[36px] object-contain select-none pointer-events-none"
                      animate={{ y: [0, -2.5, 0] }}
                      transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  </div>
                  <div className="min-w-0 leading-tight">
                    <div className="text-[13px] font-semibold tracking-[-0.01em] text-foreground">
                      Your AI
                    </div>
                    {/* The conversation phase · the exact same stage label the
                        inbox row uses, for platform consistency. No dot. */}
                    <div className="text-[11.5px] text-foreground/45 mt-0.5">
                      {stageMeta.label}
                    </div>
                  </div>
                </div>

                {readText && (
                  <p className="text-[13.5px] leading-[1.55] text-foreground/80 m-0">{readText}</p>
                )}

                {/* Status bar · goal pill + gradient ConversionBar + stage
                    label, reused 1:1 from the inbox row, folded INTO the AI
                    card under the summary. The AI tells the story and shows
                    where the conversation stands in one place. */}
                <div className="mt-3.5 pt-3.5 border-t border-foreground/[0.07] flex items-center gap-2.5 min-w-0">
                  <span className="shrink-0">
                    <GoalPill goalType={goalType} />
                  </span>
                  <span className="flex-1 min-w-0 flex items-center">
                    <ConversionBar pct={stageMeta.progress} />
                  </span>
                  <span className="shrink-0 text-[12px] font-medium text-foreground/65 whitespace-nowrap">
                    {stageMeta.label}
                  </span>
                </div>

                {/* Campaign + ICP fit · folded into the AI card as quiet
                    key/value lines. The goal is already shown by the GoalPill
                    above, so we don't restate it. Separation is purely spatial
                    — never a "·" between label and value. */}
                {(campaignName || fitScore != null) && (
                  <div className="mt-3 pt-3 border-t border-foreground/[0.07] flex flex-col gap-1.5">
                    {campaignName && (
                      <MetaLine label="Campaign" value={noDash(campaignName)} />
                    )}
                    {fitScore != null && (
                      <MetaLine label="ICP fit" value={`${fitScore}%`} />
                    )}
                  </div>
                )}
              </div>

              {/* 2 · Context. Quiet, secondary. What the AI knows. */}
              {hasContext && (
                <div>
                  <SectionLabel>Context</SectionLabel>
                  <div className="lg-card rounded-[16px] px-3.5 py-1.5">
                    {lead?.location && (
                      <ContextRow icon={MapPin} label="Location" value={lead.location} />
                    )}
                    {lead?.companySize && (
                      <ContextRow icon={Users} label="Size" value={lead.companySize} />
                    )}
                    {lead?.industry && (
                      <ContextRow icon={Building2} label="Industry" value={lead.industry} />
                    )}
                  </div>
                </div>
              )}

              {/* 3 · Signals. A proper section that mirrors Context exactly,
                     same header + glass card + row rhythm, so the two read as
                     a consistent pair (no floating bullets). */}
              {(lead?.signals?.length ?? 0) > 0 && (
                <div>
                  <SectionLabel>Signals</SectionLabel>
                  {/* Signals rows mirror the Context rows' rhythm: same card
                      padding, same gap, same even vertical spacing. There is no
                      label/value pair (each is a sentence), so a small accent
                      marker stands in for the Context icon — nudged down to sit
                      on the first line — and the text gets a comfortable
                      line-height so rows breathe instead of cramping. */}
                  <div className="lg-card rounded-[16px] px-3.5 py-1.5">
                    {lead!.signals!.map((s, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2.5 py-[7px] text-[12.5px] text-foreground/85 leading-[1.5]"
                      >
                        <span
                          aria-hidden
                          className="mt-[7px] h-[5px] w-[5px] rounded-full shrink-0"
                          style={{ background: ACCENT, opacity: 0.85 }}
                        />
                        <span className="flex-1 min-w-0">{noDash(s)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 4 · Flow. The campaign's per-lead action sequence as a
                     vertical timeline, with per-step status. Sits last,
                     under Signals, mirroring the CampaignDetail Flow card. */}
              <FlowSection flow={flow} timing={flowTiming} />
            </motion.div>
          ) : (
            <motion.div
              key="contact"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
              className="flex flex-col gap-5"
            >
              {/* Lead identity card · the strong opening, mirroring the
                  Overview AI card (same rp-card glass treatment + rhythm).
                  Avatar + name + title / company sit inside the card; a quiet
                  ICP-fit line and the LinkedIn action live in a divided footer.
                  LinkedIn is not credit-gated, so it belongs with identity
                  here (not in the gated Contact section). */}
              <div className="rp-card rounded-[20px] px-4 pt-3.5 pb-3">
                <div className="flex items-center gap-3">
                  <ReplaiyAvatar name={mail.from.name} src={mail.from.avatar} size={42} className="shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[14.5px] font-semibold tracking-[-0.01em] text-foreground truncate">
                      {mail.from.name}
                    </div>
                    {/* Title and company separated purely by spatial layout,
                        never a "·" between label and value. */}
                    <div className="text-[12px] text-foreground/50 truncate leading-snug">
                      {title && company
                        ? `${title} at ${company}`
                        : title || company || 'Lead'}
                    </div>
                  </div>
                </div>

                {(fitScore != null || lead?.linkedinUrl) && (
                  <div className="mt-3 pt-3 border-t border-foreground/[0.07] flex items-center justify-between gap-2">
                    {fitScore != null ? (
                      <MetaLine label="ICP fit" value={`${fitScore}%`} />
                    ) : (
                      <span />
                    )}
                    {lead?.linkedinUrl && (
                      <a
                        href={linkedinHref ?? '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-testid="open-linkedin"
                        className="shrink-0 glass-pill rounded-full inline-flex items-center gap-1.5 h-[24px] pl-2 pr-2.5 text-[11px] font-semibold whitespace-nowrap transition-transform hover:scale-[1.03] active:scale-[0.97]"
                        style={{ color: ACCENT }}
                      >
                        <Linkedin size={12} strokeWidth={2} />
                        LinkedIn
                        <ArrowUpRight size={12} strokeWidth={2} />
                      </a>
                    )}
                  </div>
                )}
              </div>

              {!hasContact && !hasCompany ? (
                <div className="text-[12.5px] text-foreground/45 leading-relaxed">
                  No contact details on file yet.
                </div>
              ) : (
                /* Apollo-style dossier. Company / Role / LinkedIn are shown
                   immediately (not credit-gated); only email + phone are
                   revealed on demand, each through its own locked -> searching
                   -> resolved flow. */
                <>
                  {/* 1 · Contact. The two credit-gated fields: email + phone,
                         each per-field enrichable. A quiet "Reveal all" link
                         sits in the section header to unlock both at once when
                         any is still locked. LinkedIn lives in the identity
                         card above (it is not credit-gated). */}
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-foreground/40">
                        Contact
                      </div>
                      {anyLocked && (
                        <button
                          type="button"
                          data-testid="reveal-all-contact"
                          onClick={revealAll}
                          className="text-[11px] font-semibold tracking-[-0.005em] transition-opacity hover:opacity-70"
                          style={{ color: ACCENT }}
                        >
                          Reveal all
                        </button>
                      )}
                    </div>
                    <div className="lg-card rounded-[16px] px-3.5 py-1">
                      <EnrichableRow
                        icon={Mail}
                        label="Email"
                        value={lead?.email}
                        state={emailState}
                        notFoundText="No verified email found"
                        onAccess={accessEmail}
                        accessTestId="access-email"
                        copyTestId="copy-email"
                      />
                      <EnrichableRow
                        icon={Phone}
                        label="Phone"
                        value={lead?.phone}
                        state={phoneState}
                        notFoundText="No phone number found"
                        onAccess={accessPhone}
                        accessTestId="access-phone"
                        copyTestId="copy-phone"
                      />
                    </div>
                  </div>

                  {hasCompany && (
                    <div>
                      <SectionLabel>Company</SectionLabel>
                      <div className="lg-card rounded-[16px] px-3.5 py-1">
                        {lead?.company && (
                          <DossierRow
                            icon={Building2}
                            label="Company"
                            value={lead.company}
                            copyValue={lead.company}
                          />
                        )}
                        {lead?.industry && (
                          <DossierRow icon={Globe} label="Industry" value={lead.industry} />
                        )}
                        {lead?.companySize && (
                          <DossierRow icon={Users} label="Size" value={lead.companySize} />
                        )}
                        {lead?.location && (
                          <DossierRow icon={MapPin} label="Location" value={lead.location} />
                        )}
                      </div>
                    </div>
                  )}

                  {title && (
                    <div>
                      <SectionLabel>Role</SectionLabel>
                      <div className="lg-card rounded-[16px] px-3.5 py-1">
                        <DossierRow icon={Briefcase} label="Title" value={title} />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 text-[11px] text-foreground/40">
                    <Sparkles size={12} strokeWidth={2} style={{ color: ACCENT }} className="shrink-0" />
                    Email and phone are enriched on demand
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
