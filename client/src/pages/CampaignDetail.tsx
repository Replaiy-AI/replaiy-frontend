// Replaiy - Campaign detail + create pane (right column of the split view).
//
// Mirrors ConversationDetail.tsx structure exactly:
//   • A floating desktop pill row at top-3 (name + on/off + ... overflow).
//   • Separate desktop / mobile scroll containers (max-w-2xl mx-auto content).
//   • Mobile top-chrome registered via useMobileTopChromeSlot (priority 100):
//     leftSlot = ArrowLeft ActionPill → navigate('/campaigns').
//   • Surfaces are real design-system classes only (.rp-card, .glass-pill,
//     .glass-strong). Blue (var(--ai-accent)) is a RARE micro-accent only -
//     not the fill of large controls. Delete is the single allowed exception
//     using hsl(var(--destructive)).
//
// The detail is ONLY about (1) how the campaign performs - the funnel + key
// metrics, and (2) finetuning it - editable name + editable goal - and (3)
// management (on/off + delete). There is no conversations/messages
// block here: threads live in the Inbox, not in Campaigns.
//
// Route dispatch: id 'new' → create view; existing id → detail; bare
// /campaigns → calm empty state in the right pane (desktop only).

import { useMemo, useState, useRef, useEffect, useId } from 'react';
import { useLocation, useParams } from 'wouter';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  ArrowLeft,
  Target,
  MoreHorizontal,
  Trash2,
  Check,
  Pencil,
  Plus,
  X,
  Users,
  Workflow,
  UserPlus,
  ThumbsUp,
  MessageSquare,
  Send,
  CornerUpRight,
  CalendarClock,
  BadgeCheck,
  CornerUpLeft,
  PlayCircle,
  Sparkles,
  Users2,
  Radar,
  Activity,
  Linkedin,
  Upload,
  FileText,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Languages as LanguagesIcon,
  Clock,
  Globe,
  Wand2,
  Inbox,
  Bot,
  MessageCircle,
  Info,
  Loader2,
  Circle,
} from 'lucide-react';
import { useReplaiy } from '@/state/ReplaiyContext';
import {
  GOAL_META,
  WORKSPACE_MEMBERS,
  DEFAULT_FLOW,
  FLOW_STEP_META,
  FLOW_KINDS_WITH_TEXT,
  LEAD_SOURCE_META,
  WARMTH_META,
  type Campaign,
  type CampaignAudience,
  type CampaignGoalType,
  type FlowStep,
  type FlowStepKind,
  type LeadSourceKind,
  type LeadWarmth,
  type IcpCriteria,
  type SampleLead,
} from '@/data/mockCampaigns';
import { LANGUAGE_LABELS, activePersona, type LanguageCode } from '@/data/mockPersona';
import { ReplaiyAvatar } from '@/components/Avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ActionPill } from '@/components/ConversationDetailToolbar';
import { useMobileTopChromeSlot } from '@/components/MobileTopChrome';
import { GlassToggle } from '@/components/GlassToggle';
import { GlassCircleButton } from '@/components/GlassCircleButton';
import { VadikLiquidSwitcher } from '@/components/VadikLiquidSwitcher';
import { GlassPopover } from '@/components/GlassPopover';
import { conversionPct, replyRatePct } from '@/components/CampaignsList';
import { SectionLabel } from '@/components/LeadContextPanel';
import { ReplaiyLogo } from '@/components/Logo';
import FileDropzone from '@/components/FileDropzone';
import {
  setImportDraft,
  getImportDraft,
  clearImportDraft,
  setImportResult,
  getImportResult,
  clearImportResult,
} from '@/state/importDraft';
import { matchImportTemplate, saveImportTemplate } from '@/state/importTemplates';
import { APPLE_SPRING } from '@/lib/motion';

// ── Overview derived helpers ────────────────────────────────────────
// The model has no time-series, so these derive plausible, stable values
// from the campaign's own fields for the Overview hero + momentum strip.

// Whole days between createdAt and now (never negative). Used for the quiet
// "started N days ago" status line under the hero name.
function daysSinceCreated(campaign: Campaign): number {
  if (!campaign.createdAt) return 0;
  const created = new Date(campaign.createdAt).getTime();
  if (Number.isNaN(created)) return 0;
  const diff = Date.now() - created;
  return Math.max(0, Math.floor(diff / 86_400_000));
}

// A short, human status line for the hero, e.g. "Active, started 12 days ago"
// or "Paused, started today". No middot / em-dash - a plain clause.
function heroStatusLine(campaign: Campaign): string {
  const state =
    campaign.status === 'active'
      ? 'Active'
      : campaign.status === 'paused'
        ? 'Paused'
        : campaign.status === 'archived'
          ? 'Archived'
          : 'Draft';
  const days = daysSinceCreated(campaign);
  const when =
    days === 0 ? 'started today' : days === 1 ? 'started 1 day ago' : `started ${days} days ago`;
  return `${state}, ${when}`;
}

// ── "Your AI" Overview read ─────────────────────────────────────────
// A first-person VERDICT + RECOMMENDATION the user can read on its own to
// answer the only two questions Overview must answer: "How is my campaign
// doing?" and "Do I need to change anything?". This is NOT a stats recap.
//
// Structure (2-3 sentences, warm, first-person, no em-dashes, no middots):
//   1. A plain-language verdict (good / heating up / needs attention).
//   2. The single most important thing to do right now, conditional on the
//      numbers. If replies are waiting, that action wins and points to the
//      inbox; otherwise the recommendation follows the weakest signal
//      (accept rate dipping -> narrow ICP; healthy + nothing pending ->
//      reassure nothing is needed).

// A short, normal-case phase label for under "Your AI" (1-3 words). Mirrors
// the inbox stage label slot. Derived from conversion + reply-rate momentum.
function campaignPhaseLabel(campaign: Campaign): string {
  if (campaign.status === 'paused') return 'Paused';
  if (campaign.status === 'draft') return 'Not started';
  if (campaign.status === 'archived') return 'Archived';
  const conv = conversionPct(campaign);
  const reply = replyRatePct(campaign);
  const replyTrend = kpiTrend(campaign.history?.replyRate);
  if (conv >= 7 || reply >= 55) return 'Performing well';
  if (replyTrend?.dir === 'up' || reply >= 38) return 'Gaining momentum';
  return 'Warming up';
}

// Compose the verdict + recommendation. Clause choice is driven by the
// numbers so the read feels specific and alive.
function campaignAiRead(campaign: Campaign): string {
  const s = campaign.stats;
  const conv = conversionPct(campaign);
  const reply = replyRatePct(campaign);
  const replyTrend = kpiTrend(campaign.history?.replyRate);
  const acceptTrend = kpiTrend(campaign.history?.acceptRate);
  const acceptRate = s.sent === 0 ? 0 : Math.round((s.accepted / s.sent) * 100);
  const waiting = campaign.repliesWaiting;
  const queued = s.found - s.sent;

  // Not-yet-running states: a calm, honest verdict, no pressure.
  if (campaign.status === 'draft') {
    return "This campaign is not live yet. Press start whenever you are ready and I will begin sourcing and reaching out for you.";
  }
  if (campaign.status === 'paused') {
    return `This campaign is paused right now, so nothing is going out. ${
      waiting && waiting > 0
        ? `There ${waiting === 1 ? 'is' : 'are'} still ${waiting} ${waiting === 1 ? 'reply' : 'replies'} waiting for your approval in the inbox.`
        : 'Resume it whenever you want me to pick the conversations back up.'
    }`;
  }

  // ── Active: build a verdict sentence, then a recommendation sentence. ──
  const climbing = replyTrend?.dir === 'up';
  const strong = conv >= 7 || reply >= 55;

  let verdict: string;
  if (strong && climbing) {
    verdict = `This campaign is in great shape. ${s.replied} leads have replied and ${s.goalAchieved} have already converted, and the reply rate is still climbing week over week.`;
  } else if (climbing) {
    verdict = `This campaign is heating up. ${s.replied} leads have replied so far and the reply rate is climbing week over week, so the targeting is landing.`;
  } else if (strong) {
    verdict = `This campaign is doing well. ${s.replied} leads have replied and ${s.goalAchieved} have converted, and things are holding steady.`;
  } else {
    verdict = `This campaign is finding its feet. ${s.replied} leads have replied out of ${fmtNum(s.accepted)} connected, so there is room to sharpen it.`;
  }

  // Recommendation: replies waiting always wins (that is the live action).
  let action: string;
  if (waiting && waiting > 0) {
    action = `Right now ${waiting} ${waiting === 1 ? 'reply is' : 'replies are'} waiting for your approval in the inbox, so that is the one thing worth doing today.`;
  } else if ((acceptTrend?.dir === 'down') || acceptRate < 25) {
    action = 'Accept rate is on the soft side, so I would tighten the audience a little to reach warmer leads.';
  } else if (queued > s.sent * 0.4) {
    action = `There are plenty of leads still queued, so I will keep sending without anything needed from you.`;
  } else {
    action = 'Nothing needs your attention right now, so you can leave me to keep it running.';
  }

  return `${verdict} ${action}`;
}

// ── Overview KPI cards: count-up, sparkline, trend ──────────────────
// The Overview's 4 headline KPIs (Connection requests, Accept rate, Reply
// rate, Goal achieved) get "beleving": numbers count up on mount, each card
// carries a tiny self-drawing sparkline of its ~8-week history, and a small
// trend badge (last vs previous week). Blue (AI_ACCENT) is the only accent;
// positive trend = blue, neutral/negative = muted. No green / red, no chart
// library — sparklines are pure inline SVG.

// Count from 0 to `value` over `durationMs` with an easeOut curve, via
// requestAnimationFrame. Respects prefers-reduced-motion (returns the final
// value instantly). Re-runs whenever `value` changes (e.g. switching campaign
// or remounting the Overview tab).
function useCountUp(value: number, durationMs = 700, enabled = true): number {
  const [display, setDisplay] = useState(enabled ? 0 : value);
  useEffect(() => {
    if (!enabled) {
      setDisplay(value);
      return;
    }
    let raf = 0;
    let start: number | null = null;
    const from = 0;
    const tick = (now: number) => {
      if (start === null) start = now;
      const t = Math.min(1, (now - start) / durationMs);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (value - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else setDisplay(value);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs, enabled]);
  return display;
}

// The four Overview KPIs, derived from the campaign exactly like the old
// CampaignStatStrip: Connection requests = sent, Accept rate = accepted/sent,
// Reply rate = replyRatePct, Goal achieved = conversionPct. `series` is the
// matching ~8-week history (or undefined when the campaign has none).
type OverviewKpi = {
  key: 'connectionRequests' | 'acceptRate' | 'replyRate' | 'goalAchieved';
  label: string;
  value: number; // numeric target for the count-up
  isPercent: boolean;
  series?: number[];
};

function overviewKpis(campaign: Campaign): OverviewKpi[] {
  const s = campaign.stats;
  const acceptRate = s.sent === 0 ? 0 : Math.round((s.accepted / s.sent) * 100);
  const h = campaign.history;
  return [
    {
      key: 'connectionRequests',
      label: 'Connection requests',
      value: s.sent,
      isPercent: false,
      series: h?.connectionRequests,
    },
    {
      key: 'acceptRate',
      label: 'Accept rate',
      value: acceptRate,
      isPercent: true,
      series: h?.acceptRate,
    },
    {
      key: 'replyRate',
      label: 'Reply rate',
      value: replyRatePct(campaign),
      isPercent: true,
      series: h?.replyRate,
    },
    {
      key: 'goalAchieved',
      label: 'Goal achieved',
      value: conversionPct(campaign),
      isPercent: true,
      series: h?.goalAchieved,
    },
  ];
}

// Week-over-week trend from a series: percentage change of the last point vs
// the previous one. Returns null when there is no usable history. `positive`
// drives the badge colour (blue) and arrow direction.
function kpiTrend(
  series?: number[],
): { pct: number; dir: 'up' | 'down' | 'flat' } | null {
  if (!series || series.length < 2) return null;
  const last = series[series.length - 1];
  const prev = series[series.length - 2];
  if (prev === 0) {
    if (last === 0) return { pct: 0, dir: 'flat' };
    return { pct: 100, dir: 'up' };
  }
  const pct = Math.round(((last - prev) / Math.abs(prev)) * 100);
  // A flat week (no rounded change) reads as neutral, not a blue "up".
  if (pct === 0) return { pct: 0, dir: 'flat' };
  return { pct: Math.abs(pct), dir: pct > 0 ? 'up' : 'down' };
}

// A small set of ready-made ICP templates for the "Start from a template"
// picker. Mock only - picking one fills the editable ICP on local state.
const ICP_TEMPLATES: { id: string; name: string; sub: string; icp: IcpCriteria }[] = [
  {
    id: 'founders',
    name: 'SaaS founders',
    sub: 'Early-stage software leaders',
    icp: {
      titles: ['Founder', 'CEO', 'Co-founder'],
      industries: ['SaaS', 'Fintech'],
      companySize: '1-50',
      locations: ['Netherlands', 'Europe'],
      seniority: ['Founder', 'C-level'],
      exclusions: ['Current customers', 'Competitors'],
    },
  },
  {
    id: 'revops',
    name: 'RevOps leaders',
    sub: 'Revenue and sales operations',
    icp: {
      titles: ['Head of RevOps', 'VP Revenue', 'Sales Operations Manager'],
      industries: ['SaaS', 'B2B Services'],
      companySize: '51-500',
      locations: ['Netherlands', 'Belgium', 'DACH'],
      seniority: ['Head', 'VP', 'Manager'],
      exclusions: ['Current customers'],
    },
  },
  {
    id: 'agencies',
    name: 'Agency partnerships',
    sub: 'Owners and partnership leads',
    icp: {
      titles: ['Agency Owner', 'Head of Partnerships'],
      industries: ['Marketing Agencies'],
      companySize: '11-200',
      locations: ['Netherlands'],
      seniority: ['Owner', 'Head'],
      exclusions: ['Current partners'],
    },
  },
];

// Lucide icon per flow-step kind.
const FLOW_ICONS: Record<FlowStepKind, typeof Send> = {
  connect: UserPlus,
  like: ThumbsUp,
  comment: MessageSquare,
  message: Send,
  follow_up: CornerUpRight,
};

// Shared goal-picker config (used by create AND inline edit-in-detail).
const GOAL_ORDER: CampaignGoalType[] = ['meeting', 'demo', 'qualified', 'reply', 'custom'];
const GOAL_ICONS: Record<CampaignGoalType, typeof Target> = {
  meeting: CalendarClock,
  demo: PlayCircle,
  qualified: BadgeCheck,
  reply: CornerUpLeft,
  custom: Sparkles,
};


// The single blue accent, used as a RARE micro-detail only (never the fill of
// large surfaces). Mirrors the Persona/Knowledge gold standard exactly.
const AI_ACCENT = '#2F6BFF';

// ── Shared content-column width ─────────────────────────────────────
// The detail pane shares ONE centered max-width column for BOTH the desktop
// top bar (tabs + Active toggle + overflow) AND all the scrolling content
// (campaign name + each tab's sections). This MATCHES the conversation pane,
// whose timeline + floating toolbar both center on a `maxWidth: 720` column
// inside `px-4 lg:px-6` padding (see ConversationTimeline.tsx). Using the
// identical value here makes the campaign detail and the conversation feel
// like one app: the tabs, the name, and every card all start at the same left
// edge, and the top-bar controls pin to that column's right edge.
const CAMPAIGN_COLUMN_MAX = 720;

// ── Detail tabs ─────────────────────────────────────────────────────
// The detail content is split across four tabs so each view is short and
// scannable instead of one endless scroll. The switcher itself is the SHARED
// VadikLiquidSwitcher (text variant) used by the feed (All/Relevant) and the
// lead panel (Overview/Contact).
type CampaignTab = 'overview' | 'audience' | 'outreach' | 'team';
const CAMPAIGN_TAB_SEGMENTS: { key: CampaignTab; label: string; width: number }[] = [
  { key: 'overview', label: 'Overview', width: 92 },
  { key: 'audience', label: 'Audience', width: 96 },
  { key: 'outreach', label: 'Outreach', width: 96 },
  { key: 'team', label: 'Team', width: 70 },
];

// ====================================================================
// AUDIENCE - who this campaign reaches. Rendered at the TOP of the detail.
// Built as Persona-style sub-blocks: a FineTuneSection-style header (a
// `text-[12.5px] font-semibold` label + a `text-[11.5px] text-foreground/45`
// sub at px-2) followed by content in an `rp-card rounded-3xl`. No
// block-in-block; warmth is carried by label + accent opacity, not colour.
// ====================================================================

// Lucide glyph per discovery source.
const SOURCE_ICONS: Record<LeadSourceKind, typeof Send> = {
  salesnav: Radar,
  signal: Activity,
  engagement: Linkedin,
  import: Upload,
};

// Warmth order for the whole section: warmest first (the source-priority
// story). Used to sort the source rows and the pool pills.
const WARMTH_ORDER: LeadWarmth[] = ['warmest', 'warm', 'cold'];

const fmtNum = (n: number) => n.toLocaleString('en-US');

// Approximate how many leads qualify at a threshold, from the score buckets.
// A bucket counts fully when its whole range sits at or above the threshold,
// partially (linear) when the threshold cuts through it, and not at all below.
function qualifiedCount(
  buckets: { range: string; count: number }[],
  threshold: number,
): number {
  let total = 0;
  for (const b of buckets) {
    const parts = b.range.split('-').map((p) => parseInt(p, 10));
    const lo = Number.isNaN(parts[0]) ? 0 : parts[0];
    const hi = parts.length === 2 && !Number.isNaN(parts[1]) ? parts[1] : lo;
    if (threshold <= lo) {
      total += b.count;
    } else if (threshold > hi) {
      // none
    } else {
      // Threshold cuts through this bucket: take the share at or above it.
      const span = Math.max(1, hi - lo + 1);
      const share = (hi - threshold + 1) / span;
      total += Math.round(b.count * Math.max(0, Math.min(1, share)));
    }
  }
  return total;
}

// ── Section header - the ONE shared header used by EVERY section in this
//    screen, so titles line up + read exactly like the Persona page and the
//    inbox lead panel. The title runs through the SHARED `SectionLabel`
//    component (the single source of truth for the 12.5px / semibold /
//    px-2-inset treatment, identical to Persona's section headers); we only
//    strip its built-in bottom margin here because a muted sub-line follows
//    immediately. A trailing slot keeps an optional quiet affordance (Edit /
//    Add / template) on the title baseline. The sub-line uses the exact same
//    muted treatment + px-2 inset everywhere (11.5px, foreground/45). `sub`
//    is optional so headers can stand alone when they need to.
function AudienceHeader({
  label,
  sub,
  trailing,
}: {
  label: string;
  sub?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <>
      <div className="flex items-center justify-between gap-3 mb-1 [&>*]:mb-0">
        <SectionLabel>{label}</SectionLabel>
        {trailing}
      </div>
      {sub && (
        <p className="px-2 text-[11.5px] leading-[1.45] text-foreground/45 mb-3">
          {sub}
        </p>
      )}
    </>
  );
}

// ── SubLabel - the ONE subordinate label style ──────────────────────
// The single, consistent treatment for a sub-grouping INSIDE a section
// (e.g. "Opening message" vs "Conversation replies" within Sending, or the
// ICP "Titles" / "Industries" groups). Clearly subordinate to SectionLabel:
// smaller (11px), semibold, muted (foreground/45), tight tracking, normal
// case. Used everywhere a sub-heading is needed so the hierarchy reads as
// exactly two levels: SectionLabel (section title) > SubLabel (sub-group).
function SubLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold tracking-[-0.005em] text-foreground/45 mb-2">
      {children}
    </div>
  );
}

// ── The single SELECTED-row treatment ───────────────────────────────
// A chosen option (opening-message / reply-mode / goal / language) is shown
// by a SUBTLE accent: a faint accent tint + a left accent rail + an accent
// check. NEVER by wrapping the row in a second opaque background layer. This
// is the one selected-state pattern used across the whole detail.
function selectedRowClass(selected: boolean): string {
  return selected
    ? 'bg-[#2F6BFF]/[0.06] dark:bg-[#2F6BFF]/[0.10]'
    : '';
}

// Small read-only chip - quiet glass pill. Used for ICP criteria. `muted`
// renders exclusions distinctly (lower contrast + a small minus), no red.
function IcpChip({ label, muted = false }: { label: string; muted?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 h-[28px] px-3 rounded-full text-[12.5px] font-medium bg-foreground/[0.05] dark:bg-white/[0.06] ${
        muted ? 'text-foreground/45' : 'text-foreground/80'
      }`}
    >
      {muted && (
        <span aria-hidden="true" className="text-foreground/35 leading-none">
          &minus;
        </span>
      )}
      {label}
    </span>
  );
}

// One labelled ICP group: a small caption + a wrap of chips. Sits DIRECTLY in
// the parent card (no inner box) so there is no block-in-block.
function IcpGroup({
  caption,
  values,
  muted = false,
}: {
  caption: string;
  values: string[];
  muted?: boolean;
}) {
  if (values.length === 0) return null;
  return (
    <div>
      <SubLabel>{caption}</SubLabel>
      <div className="flex flex-wrap items-center gap-2">
        {values.map((v) => (
          <IcpChip key={v} label={v} muted={muted} />
        ))}
      </div>
    </div>
  );
}

// ── A) Audience pool - live breakdown + score histogram + health line ─
// Takes the live (local-state) threshold so the health one-liner and the
// "View leads" affordance stay in sync with the slider below.
function AudiencePoolCard({
  audience,
  threshold,
  onViewLeads,
}: {
  audience: CampaignAudience;
  threshold: number;
  onViewLeads: () => void;
}) {
  const { pool, scoreBuckets } = audience;
  const total = pool.cold + pool.warm + pool.warmest;
  const maxBucket = Math.max(1, ...scoreBuckets.map((b) => b.count));

  // Audience-health one-liner: warmest count + share of the pool that sits at
  // or above the live ICP bar. Computed from the score buckets.
  const bucketTotal = Math.max(1, scoreBuckets.reduce((a, b) => a + b.count, 0));
  const abovePct = Math.round((qualifiedCount(scoreBuckets, threshold) / bucketTotal) * 100);
  const hasLeads = total > 0;

  return (
    <section>
      <AudienceHeader label="Audience" sub="Who this campaign reaches." />
      <div className="rp-card rounded-3xl p-5 lg:p-6" data-testid="audience-pool">
        {/* Big live total. Warmth now lives ONLY at Sources, so the pool stays
            calm: total -> one-line health sentence -> histogram -> View leads. */}
        <div className="min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[34px] font-semibold tracking-[-0.02em] tabular-nums text-foreground leading-none">
              {fmtNum(total)}
            </span>
            <span className="text-[13px] text-foreground/45">in pool</span>
          </div>
        </div>

        {/* Audience-health one-liner - quality at a glance, single line. */}
        {hasLeads && (
          <p
            data-testid="audience-health"
            className="mt-3 text-[12.5px] text-foreground/55 leading-snug"
          >
            Strong audience:{' '}
            <span className="font-semibold text-foreground/75 tabular-nums">
              {fmtNum(pool.warmest)}
            </span>{' '}
            warmest leads,{' '}
            <span className="font-semibold text-foreground/75 tabular-nums">{abovePct}%</span>{' '}
            above your ICP bar.
          </p>
        )}

        <div className="h-px bg-foreground/[0.07] dark:bg-white/[0.07] my-5" />

        {/* Tiny ICP-score distribution - quality, not just quantity. One
            hue (accent) deepening with score; a quiet horizontal histogram. */}
        <div className="flex items-center justify-between gap-3 mb-2.5">
          <SubLabel>ICP-score spread</SubLabel>
          <span className="text-[11.5px] text-foreground/45 pb-2">higher is a better fit</span>
        </div>
        <div className="flex flex-col gap-1.5" data-testid="audience-histogram">
          {scoreBuckets.map((b, i) => {
            // Accent opacity deepens toward the top bucket (best fit first).
            const opacity = 0.85 - i * 0.13;
            return (
              <div key={b.range} className="flex items-center gap-2.5">
                <span className="w-[52px] shrink-0 text-[11px] tabular-nums text-foreground/55">
                  {b.range}
                </span>
                <div className="flex-1 h-[8px] rounded-full bg-foreground/[0.06] dark:bg-white/[0.06] overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(b.count / maxBucket) * 100}%`,
                      background: AI_ACCENT,
                      opacity: Math.max(0.22, opacity),
                    }}
                  />
                </div>
                <span className="w-[40px] shrink-0 text-right text-[11px] tabular-nums text-foreground/55">
                  {fmtNum(b.count)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Quiet "View leads" affordance - opens a preview of sample leads. */}
        {hasLeads && (
          <div className="mt-5 flex items-center justify-between gap-3">
            <span className="text-[11.5px] text-foreground/45">A sample of who is in your pool</span>
            <button
              type="button"
              data-testid="button-view-leads"
              onClick={onViewLeads}
              className="glass-pill pill inline-flex items-center gap-1.5 h-[30px] pl-3 pr-2.5 text-[12.5px] font-medium text-foreground/80 hover-elevate active-elevate-2"
            >
              View leads
              <ChevronRight size={14} strokeWidth={2.2} className="text-foreground/45" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}


// ── B) Sources - toggle rows in ONE card, warmest first ─────────────
function AudienceSourcesCard({ audience, campaignId }: { audience: CampaignAudience; campaignId: string }) {
  const [, navigate] = useLocation();
  // Manual-import confirmation. The actual import now happens on the dedicated
  // mapping screen (CampaignImportView); when it completes it writes the result
  // into the importDraft module store. We read that here on render so the
  // "{N} leads imported" confirmation shows after returning. No backend.
  const result = getImportResult();
  const importedCount = result && result.campaignId === campaignId ? result.count : null;
  // Representational: local toggle state, no backend write this round. When we
  // return straight after an import, the Manual-import source is shown ON (you
  // just imported through it) so the confirmation is visible without a manual
  // re-toggle.
  const [sources, setSources] = useState(() =>
    importedCount !== null
      ? audience.sources.map((s) => (s.kind === 'import' ? { ...s, enabled: true } : s))
      : audience.sources,
  );
  const reduceMotion = useReducedMotion();
  // Force a re-render after clearing the module-store result on "Import more".
  const [, bump] = useState(0);

  // Accept a selected/dropped CSV: parse it client-side (real headers + first
  // ~5 data rows), stash the parsed draft in the module store, and navigate to
  // the column-mapping screen. Pragmatic CSV split: first non-empty line is the
  // header row, comma-separated; no CSV library. The mapping screen owns the
  // Import action now, so we no longer show an inline preview here.
  const acceptFile = (file: File | null | undefined) => {
    if (!file) return;
    const go = (headers: string[], rows: string[][], total: number) => {
      setImportDraft({ campaignId, filename: file.name, headers, rows, total });
      navigate('/campaigns/' + campaignId + '/import');
    };
    const fallback = Math.max(12, Math.min(5000, Math.round(file.size / 64) || 128));
    const split = (line: string) => line.split(',').map((c) => c.trim());
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length === 0) {
        go(['Column 1'], [], fallback);
        return;
      }
      const headers = split(lines[0]);
      const dataLines = lines.slice(1);
      const rows = dataLines.slice(0, 5).map(split);
      const total = dataLines.length > 0 ? dataLines.length : fallback;
      go(headers, rows, total);
    };
    reader.onerror = () => go(['Column 1'], [], fallback);
    try {
      reader.readAsText(file);
    } catch {
      go(['Column 1'], [], fallback);
    }
  };

  // "Import more" clears the stored result (and any leftover draft) and resets
  // the confirmation back to the dropzone.
  const importMore = () => {
    clearImportResult();
    clearImportDraft();
    bump((n) => n + 1);
  };
  // Warmest first, then warm, then cold; import (cold) naturally lands last.
  const ordered = useMemo(
    () =>
      [...sources].sort(
        (a, b) =>
          WARMTH_ORDER.indexOf(LEAD_SOURCE_META[a.kind].warmth) -
          WARMTH_ORDER.indexOf(LEAD_SOURCE_META[b.kind].warmth),
      ),
    [sources],
  );

  const toggle = (kind: LeadSourceKind, on: boolean) =>
    setSources((prev) =>
      prev.map((s) => (s.kind === kind ? { ...s, enabled: on } : s)),
    );

  return (
    <section>
      <AudienceHeader label="Sources" sub="Where leads come from, warmest first." />
      <div className="rp-card rounded-3xl overflow-hidden" data-testid="audience-sources">
        {ordered.map((src, i) => {
          const meta = LEAD_SOURCE_META[src.kind];
          const Icon = SOURCE_ICONS[src.kind];
          return (
            <div key={src.kind}>
              {i > 0 && (
                <div className="ml-[60px] h-px bg-foreground/[0.06] dark:bg-white/[0.06]" />
              )}
              <div
                data-testid={`source-row-${src.kind}`}
                className="px-4 py-3.5 flex items-center gap-3"
              >
                <div className="h-9 w-9 rounded-xl bg-foreground/[0.06] dark:bg-white/[0.08] flex items-center justify-center shrink-0">
                  <Icon size={16} strokeWidth={1.9} className="text-foreground/70" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-medium text-foreground truncate">
                      {meta.label}
                    </span>
                    <span className="glass-pill inline-flex items-center h-[18px] px-1.5 rounded-full text-[10.5px] font-medium text-foreground/45 shrink-0">
                      {WARMTH_META[meta.warmth].label}
                    </span>
                  </div>
                  <div className="text-[12px] text-foreground/50 truncate">{meta.hint}</div>
                </div>
                {src.enabled && src.found > 0 && (
                  <span className="text-[11.5px] tabular-nums text-foreground/40 shrink-0">
                    {fmtNum(src.found)} found
                  </span>
                )}
                <GlassToggle
                  on={src.enabled}
                  onChange={(v) => toggle(src.kind, v)}
                  testId={`source-toggle-${src.kind}`}
                  ariaLabel={`${src.enabled ? 'Disable' : 'Enable'} ${meta.label}`}
                />
              </div>
              {/* Manual import, when on, shows the SHARED FileDropzone.
                  Dropping a CSV parses it, stashes the draft, and navigates to
                  the column-mapping screen (which owns the Import action). After
                  a successful import it becomes the calm "N leads imported"
                  confirmation with "Import more". */}
              {src.kind === 'import' && src.enabled && (
                <div className="px-4 pb-3.5 -mt-1 pl-[76px]">
                  {importedCount === null ? (
                    <div className="flex flex-col gap-2.5">
                      {/* Drop surface is the SHARED FileDropzone, identical to
                          the knowledge upload. Dropping a CSV opens the
                          column-mapping screen (no silent auto-import). */}
                      <FileDropzone
                        testId="source-import-dropzone"
                        accept=".csv,text/csv"
                        onFiles={(files) => acceptFile(files[0])}
                        primaryLabel="Drop a CSV here, or click to choose"
                        secondaryLabel="One lead per row"
                      />
                    </div>
                  ) : (
                    <div className="rounded-2xl bg-foreground/[0.04] dark:bg-white/[0.05] px-3.5 py-3">
                      <motion.div
                        initial={reduceMotion ? false : { opacity: 0, y: 2 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                        className="flex items-center justify-between gap-2.5"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Check
                            size={15}
                            strokeWidth={2.4}
                            className="shrink-0"
                            style={{ color: AI_ACCENT }}
                          />
                          <span className="text-[12.5px] text-foreground/70 truncate">
                            <span className="font-semibold text-foreground/85 tabular-nums">
                              {fmtNum(importedCount)}
                            </span>{' '}
                            leads imported
                          </span>
                        </div>
                        <button
                          type="button"
                          data-testid="source-import-more"
                          onClick={importMore}
                          className="shrink-0 text-[12px] font-medium text-foreground/50 hover:text-foreground/75 transition-colors"
                        >
                          Import more
                        </button>
                      </motion.div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── C) Ideal customer (ICP) - always-editable chip groups on local state ─
// Calm Persona/knowledge language: chips are always removable (hover-revealed)
// and every group has an inline add-input, no Edit mode. "Start from a
// template" is a quiet bottom affordance that fills the ICP via a popover.
function AudienceIcpCard({ audience }: { audience: CampaignAudience }) {
  const [icp, setIcp] = useState<IcpCriteria>(audience.icp);

  const empty =
    icp.titles.length === 0 &&
    icp.industries.length === 0 &&
    !icp.companySize &&
    icp.locations.length === 0 &&
    icp.seniority.length === 0 &&
    icp.exclusions.length === 0;

  // Add / remove helpers for the array fields, on local state only.
  type ArrayKey = 'titles' | 'industries' | 'locations' | 'seniority' | 'exclusions';
  const removeAt = (key: ArrayKey, value: string) =>
    setIcp((prev) => ({ ...prev, [key]: prev[key].filter((v) => v !== value) }));
  const addTo = (key: ArrayKey, value: string) => {
    const v = value.trim();
    if (!v) return;
    setIcp((prev) => (prev[key].includes(v) ? prev : { ...prev, [key]: [...prev[key], v] }));
  };
  // Company size is a single value; edit it inline with the same chip rhythm.
  const setCompanySize = (v: string) =>
    setIcp((prev) => ({ ...prev, companySize: v.trim() }));

  // A small quiet "Start from a template" action lives in the header trailing
  // slot (top-right, aligned) instead of floating loosely at the card bottom.
  // It is a template picker, not an edit-mode toggle, so a header action reads
  // cleaner here and keeps the card body uncluttered.
  const templateAction = (
    <GlassPopover
      anchor="bottom"
      align="right"
      width="w-64"
      testId="icp-template-menu"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          data-testid="button-icp-template"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={toggle}
          className="glass-pill pill inline-flex items-center gap-1.5 h-[30px] pl-2.5 pr-3 text-[12.5px] font-medium text-foreground/70 hover-elevate active-elevate-2"
        >
          <Plus size={14} strokeWidth={2} className="text-foreground/55" />
          Start from a template
        </button>
      )}
    >
      {({ close }) => (
        <div className="flex flex-col">
          {ICP_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              data-testid={`icp-template-${t.id}`}
              onClick={() => {
                setIcp(t.icp);
                close();
              }}
              className="w-full text-left px-2.5 py-2 rounded-xl hover-elevate active-elevate-2"
            >
              <div className="text-[13px] font-semibold text-foreground">{t.name}</div>
              <div className="text-[11.5px] text-foreground/50 leading-snug">{t.sub}</div>
            </button>
          ))}
        </div>
      )}
    </GlassPopover>
  );

  return (
    <section>
      <AudienceHeader
        label="Ideal customer"
        sub="The profile we match leads against."
        trailing={templateAction}
      />
      <div className="rp-card rounded-3xl p-5 lg:p-6" data-testid="audience-icp">
        {empty && (
          <p className="text-[13px] text-foreground/45 leading-snug mb-5">
            No ideal customer defined yet. Add criteria below or start from a
            template to set who this reaches.
          </p>
        )}
        <div className="flex flex-col gap-5">
          <IcpEditableGroup
            caption="Titles"
            field="titles"
            values={icp.titles}
            onRemove={removeAt}
            onAdd={addTo}
          />
          <IcpEditableGroup
            caption="Industries"
            field="industries"
            values={icp.industries}
            onRemove={removeAt}
            onAdd={addTo}
          />
          <IcpSingleValueGroup
            caption="Company size"
            value={icp.companySize}
            placeholder="Add"
            onChange={setCompanySize}
          />
          <IcpEditableGroup
            caption="Locations"
            field="locations"
            values={icp.locations}
            onRemove={removeAt}
            onAdd={addTo}
          />
          <IcpEditableGroup
            caption="Seniority"
            field="seniority"
            values={icp.seniority}
            onRemove={removeAt}
            onAdd={addTo}
          />
          <div className="h-px bg-foreground/[0.07] dark:bg-white/[0.07]" />
          <IcpEditableGroup
            caption="Exclusions"
            field="exclusions"
            values={icp.exclusions}
            muted
            onRemove={removeAt}
            onAdd={addTo}
          />
        </div>
      </div>
    </section>
  );
}

// One always-editable ICP group: caption + chips + an inline add-input. Each
// chip has a hover-revealed remove control (the calm knowledge pattern); the
// add-input is always present so there is no Edit mode. Sits directly in the
// parent card (no inner box) so there is no block-in-block.
function IcpEditableGroup({
  caption,
  field,
  values,
  muted = false,
  onRemove,
  onAdd,
}: {
  caption: string;
  field: 'titles' | 'industries' | 'locations' | 'seniority' | 'exclusions';
  values: string[];
  muted?: boolean;
  onRemove: (key: typeof field, value: string) => void;
  onAdd: (key: typeof field, value: string) => void;
}) {
  const [draft, setDraft] = useState('');
  return (
    <div>
      <SubLabel>{caption}</SubLabel>
      <div className="flex flex-wrap items-center gap-2">
        {values.map((v) => (
          <span
            key={v}
            className={`group inline-flex items-center gap-1 h-[28px] pl-3 pr-1.5 rounded-full text-[12.5px] font-medium bg-foreground/[0.05] dark:bg-white/[0.06] ${
              muted ? 'text-foreground/45' : 'text-foreground/80'
            }`}
          >
            {muted && (
              <span aria-hidden="true" className="text-foreground/35 leading-none">
                &minus;
              </span>
            )}
            {v}
            <button
              type="button"
              data-testid={`icp-remove-${field}-${v}`}
              onClick={() => onRemove(field, v)}
              aria-label={`Remove ${v}`}
              className="opacity-0 group-hover:opacity-100 transition-opacity h-[18px] w-[18px] rounded-full flex items-center justify-center text-foreground/40 hover-elevate active-elevate-2"
            >
              <X size={11} strokeWidth={2.4} />
            </button>
          </span>
        ))}
        <input
          data-testid={`icp-add-${field}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onAdd(field, draft);
              setDraft('');
            }
          }}
          onBlur={() => {
            if (draft.trim()) {
              onAdd(field, draft);
              setDraft('');
            }
          }}
          placeholder="Add"
          className="h-[28px] w-[110px] bg-foreground/[0.04] dark:bg-white/[0.05] rounded-full px-3 outline-none text-[12.5px] text-foreground placeholder:text-foreground/40"
        />
      </div>
    </div>
  );
}

// A single-value ICP group (e.g. Company size). Mirrors IcpEditableGroup's
// caption + chip + inline add-input rhythm exactly so every ICP row aligns: a
// removable chip when set, or a chip-shaped add-input when empty. Editing in
// place, no Edit mode, flat (non-blur) backgrounds.
function IcpSingleValueGroup({
  caption,
  value,
  placeholder = 'Add',
  onChange,
}: {
  caption: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  const [draft, setDraft] = useState('');
  return (
    <div>
      <SubLabel>{caption}</SubLabel>
      <div className="flex flex-wrap items-center gap-2">
        {value ? (
          <span className="group inline-flex items-center gap-1 h-[28px] pl-3 pr-1.5 rounded-full text-[12.5px] font-medium bg-foreground/[0.05] dark:bg-white/[0.06] text-foreground/80">
            {value}
            <button
              type="button"
              data-testid="icp-remove-companySize"
              onClick={() => onChange('')}
              aria-label={`Remove ${value}`}
              className="opacity-0 group-hover:opacity-100 transition-opacity h-[18px] w-[18px] rounded-full flex items-center justify-center text-foreground/40 hover-elevate active-elevate-2"
            >
              <X size={11} strokeWidth={2.4} />
            </button>
          </span>
        ) : (
          <input
            data-testid="icp-add-companySize"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && draft.trim()) {
                onChange(draft);
                setDraft('');
              }
            }}
            onBlur={() => {
              if (draft.trim()) {
                onChange(draft);
                setDraft('');
              }
            }}
            placeholder={placeholder}
            className="h-[28px] w-[110px] bg-foreground/[0.04] dark:bg-white/[0.05] rounded-full px-3 outline-none text-[12.5px] text-foreground placeholder:text-foreground/40"
          />
        )}
      </div>
    </div>
  );
}

// ── D) ICP score - DRAGGABLE threshold slider + live qualified count
// A real range input styled to match, updating local state. Shows the live
// "X of N leads qualify" computed from the score buckets as you drag. This is
// the ICP fit threshold, consistent with the inbox "ICP fit" language.
function AudienceThresholdCard({
  audience,
  value,
  onChange,
}: {
  audience: CampaignAudience;
  value: number;
  onChange: (v: number) => void;
}) {
  const poolTotal = audience.pool.cold + audience.pool.warm + audience.pool.warmest;
  const qualify = qualifiedCount(audience.scoreBuckets, value);

  return (
    <section>
      <AudienceHeader
        label="Minimum ICP score"
        sub="Only leads above this score get contacted."
      />
      <div className="rp-card rounded-3xl p-5 lg:p-6" data-testid="audience-threshold">
        {/* Draggable slider + inline value: a flex row where the range track
            grows and the {value}% sits to its right, vertically centered. The
            real range input is invisible but on top of a styled track + filled
            progress + knob, so it drags naturally while matching the design
            system exactly. */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 h-[16px] flex items-center" data-testid="threshold-slider">
            <div className="absolute inset-x-0 h-[8px] rounded-full bg-foreground/[0.06] dark:bg-white/[0.06]" />
            <div
              className="absolute left-0 h-[8px] rounded-full"
              style={{
                width: `${value}%`,
                background: 'linear-gradient(90deg, #1B3FA8 0%, #2F6BFF 100%)',
                opacity: 0.92,
              }}
            />
            <span
              aria-hidden="true"
              className="absolute top-1/2 h-[16px] w-[16px] -translate-y-1/2 -translate-x-1/2 rounded-full bg-white pointer-events-none"
              style={{
                left: `${value}%`,
                boxShadow:
                  '0 1px 1px rgba(0,0,0,0.05), 0 2px 6px rgba(8,10,18,0.22), inset 0 1px 0.5px rgba(255,255,255,0.95)',
              }}
            />
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={value}
              data-testid="threshold-range"
              aria-label="Minimum ICP score"
              onChange={(e) => onChange(parseInt(e.target.value, 10))}
              className="relative w-full h-[16px] cursor-pointer appearance-none bg-transparent m-0 opacity-0"
            />
          </div>
          <span className="shrink-0 min-w-[48px] text-right text-[15px] font-semibold tabular-nums text-foreground">
            {value}%
          </span>
        </div>

        {/* Live qualified count - recomputes as you drag. */}
        <div className="mt-3.5 flex items-center gap-1.5" data-testid="threshold-qualified">
          <span className="text-[13px] font-semibold text-foreground tabular-nums">
            {fmtNum(qualify)}
          </span>
          <span className="text-[13px] text-foreground/55">
            of {fmtNum(poolTotal)} leads qualify
          </span>
        </div>
        <p className="mt-2 text-[12.5px] text-foreground/50 leading-snug">
          Leads below {value}% are still sourced and enriched, but never
          contacted. Source broad, reach out to the best fits only.
        </p>
      </div>
    </section>
  );
}

// ── E) Auto-suppress - four toggles in ONE card ─────────────────────
const SUPPRESS_ROWS: {
  key: keyof CampaignAudience['suppress'];
  label: string;
  hint: string;
}[] = [
  {
    key: 'inOtherCampaigns',
    label: 'Already in another campaign',
    hint: 'Never approach a lead two teammates are working at once',
  },
  {
    key: 'alreadyContacted',
    label: 'Already contacted',
    hint: 'Skip anyone your team has reached before',
  },
  {
    key: 'existingConnections',
    label: 'Existing connections',
    hint: 'Leave people you already know out of cold outreach',
  },
  {
    key: 'inActiveConversation',
    label: 'Already in conversation',
    hint: 'If a teammate is in an active conversation, others can still connect or like, but will not start a competing one',
  },
];

function AudienceSuppressCard({ audience }: { audience: CampaignAudience }) {
  const [suppress, setSuppress] = useState(audience.suppress);
  const toggle = (key: keyof CampaignAudience['suppress'], on: boolean) =>
    setSuppress((prev) => ({ ...prev, [key]: on }));

  return (
    <section>
      <AudienceHeader
        label="Skip the wrong people"
        sub="Avoid double or awkward outreach."
      />
      <div className="rp-card rounded-3xl overflow-hidden" data-testid="audience-suppress">
        {SUPPRESS_ROWS.map((row, i) => (
          <div key={row.key}>
            {i > 0 && (
              <div className="ml-4 h-px bg-foreground/[0.06] dark:bg-white/[0.06]" />
            )}
            <div
              data-testid={`suppress-row-${row.key}`}
              className="px-4 py-3.5 flex items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-medium text-foreground">{row.label}</div>
                <div className="text-[12px] text-foreground/50 leading-snug">{row.hint}</div>
              </div>
              <GlassToggle
                on={suppress[row.key]}
                onChange={(v) => toggle(row.key, v)}
                testId={`suppress-toggle-${row.key}`}
                ariaLabel={`${suppress[row.key] ? 'Disable' : 'Enable'} ${row.label}`}
              />
            </div>
          </div>
        ))}
      </div>
      {/* Subtle notes under Sources - same quiet style as the compliance line
          (no blue Sparkles block). Enrichment sits here because it is what
          happens to leads as they come in via the sources above. */}
      <p
        data-testid="audience-enrichment-note"
        className="px-2 mt-2.5 flex items-center gap-1.5 text-[11.5px] text-foreground/45 leading-snug"
      >
        <Sparkles size={13} strokeWidth={1.9} className="shrink-0 text-foreground/35" />
        Every lead is auto-enriched with company data, recent activity and signals.
      </p>
      <p
        data-testid="audience-compliance"
        className="px-2 mt-1.5 flex items-center gap-1.5 text-[11.5px] text-foreground/45 leading-snug"
      >
        <ShieldCheck size={13} strokeWidth={1.9} className="shrink-0 text-foreground/35" />
        Outreach stays within safe, human limits. No private data, no spam.
      </p>
    </section>
  );
}

// ── View-leads, full-screen route ───────────────────────────────────
// The audience preview is its OWN screen (no overlay/sheet), reached at
// /campaigns/:id/leads and dispatched from CampaignDetail. It mirrors the
// detail view's shell: a centered CAMPAIGN_COLUMN_MAX (720) column, a desktop
// floating top bar at top-3 (back button top-left, on the same h-[52px]
// baseline as the detail toolbar), and the mobile back button registered via
// useMobileTopChromeSlot. Unlike the tabbed detail (which has no desktop back
// button) the leads screen has no tabs, so it DOES get a desktop back button.
// The lead rows are the EXACT markup that previously lived in ViewLeadsSheet -
// only moved out of the sheet, never restyled.
function CampaignLeadsView({ campaign }: { campaign: Campaign }) {
  const [, navigate] = useLocation();
  const leads = campaign.audience?.sampleLeads ?? [];
  const back = () => navigate('/campaigns/' + campaign.id);
  const reduced = useReducedMotion();

  // Live persona drives the small talking-mascot avatar that marks each AI
  // insight, exactly like the inbox AI-voice and the Overview "Your AI" card.
  // We never mark AI with a sparkle - the mascot IS our AI voice.
  const { persona: livePersona, updateCampaign } = useReplaiy();
  const p = activePersona(livePersona); // { color, mascot }

  // ── Progressive (background) enrichment ──────────────────────────
  // Freshly imported leads land instantly with identity known but marked
  // enriching:true. Here we reveal each one live and drive a progress bar,
  // mirroring Clay/Apollo/HeyReach. This is a VIEW-LOCAL concern: we do NOT
  // mutate the store on every tick (that would thrash re-renders). We track
  // which visible enriching rows are still pending in local state and a
  // numeric enrichedCount that climbs toward the full batch total, then clear
  // the store flags ONCE on completion so re-entry shows them settled.
  const enrichingIdx = useMemo(
    () =>
      leads.reduce<number[]>((acc, l, i) => {
        if (l.enriching === true) acc.push(i);
        return acc;
      }, []),
    [leads],
  );
  // The progress-bar denominator: the batch total from the import result if
  // it belongs to this campaign (may be 485 while only 6 rows are visible),
  // else the count of enriching visible leads.
  const importResult = getImportResult();
  const batchTotal =
    importResult && importResult.campaignId === campaign.id && importResult.enrichingTotal
      ? importResult.enrichingTotal
      : enrichingIdx.length;
  const hasEnriching = enrichingIdx.length > 0;

  // Local reveal state: indices (into `leads`) that have finished enriching,
  // and enrichedCount climbing 0 -> batchTotal for the bar.
  const [doneIdx, setDoneIdx] = useState<Set<number>>(() => new Set());
  const [enrichedCount, setEnrichedCount] = useState(0);
  const clearedRef = useRef(false);

  useEffect(() => {
    if (!hasEnriching) return;
    // Reset local reveal each time we (re)enter with enriching leads.
    setDoneIdx(new Set());
    setEnrichedCount(0);
    clearedRef.current = false;

    let mounted = true;
    const pending = [...enrichingIdx];
    // 485 can't finish in 3s: pace the bar over ~8-12s of ongoing background
    // work. Reduced motion finishes in ~1s but still shows the bar briefly.
    const tick = reduced ? 260 : 620;
    const stepChunk = Math.max(1, Math.ceil(batchTotal / (reduced ? 4 : 16)));

    const complete = () => {
      if (!mounted) return;
      setEnrichedCount(batchTotal);
      // Settle the store ONCE so leaving and returning shows enriched rows.
      if (!clearedRef.current) {
        clearedRef.current = true;
        const aud = campaign.audience;
        if (aud && (aud.sampleLeads ?? []).some((l) => l.enriching)) {
          updateCampaign(campaign.id, {
            audience: {
              ...aud,
              sampleLeads: (aud.sampleLeads ?? []).map((l) =>
                l.enriching ? { ...l, enriching: false } : l,
              ),
            },
          });
        }
      }
    };

    const id = setInterval(() => {
      if (!mounted) return;
      // (a) reveal the next visible enriching row.
      const next = pending.shift();
      if (next !== undefined) {
        setDoneIdx((prev) => {
          const nextSet = new Set(prev);
          nextSet.add(next);
          return nextSet;
        });
      }
      // (b) advance the counter toward batchTotal by a realistic chunk.
      setEnrichedCount((c) => {
        const advanced = Math.min(batchTotal, c + stepChunk);
        return advanced;
      });
      // Stop once both the visible rows and the counter are done.
      if (pending.length === 0) {
        setEnrichedCount((c) => {
          if (c >= batchTotal) {
            clearInterval(id);
            complete();
            return batchTotal;
          }
          return c;
        });
      }
    }, tick);

    return () => {
      mounted = false;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign.id, hasEnriching, batchTotal, reduced]);

  // A visible lead is still enriching for display if the store marked it
  // enriching AND our local reveal hasn't flipped it done yet.
  const isEnriching = (lead: SampleLead, i: number): boolean =>
    lead.enriching === true && !doneIdx.has(i);

  // The progress row shows while the batch is still enriching (counter < total).
  const enrichedDone = Math.min(enrichedCount, batchTotal);
  const showProgress = hasEnriching && enrichedDone < batchTotal;

  // Opening a lead's full profile from this routed full-screen view would need
  // significant plumbing (the profile-open context lives in the inbox/feed
  // shells, not here). Per the brief we keep the row clickable + chevron but
  // make the click a safe no-op for now rather than building a new flow.
  const openLead = () => {
    /* safe no-op: full profile open is not wired into this routed view yet */
  };

  // Mobile chrome - back arrow (left), same pattern as the detail's button-back.
  useMobileTopChromeSlot(
    useMemo(
      () => ({
        priority: 100,
        leftSlot: (
          <ActionPill testId="button-back-leads" label="Back" onClick={back}>
            <ArrowLeft size={20} strokeWidth={1.7} className="text-icon" />
          </ActionPill>
        ),
      }),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [campaign.id],
    ),
  );

  // Title + sub + the lead list - shared by desktop and mobile bodies.
  const body = (
    <div className="mx-auto w-full" style={{ maxWidth: CAMPAIGN_COLUMN_MAX }}>
      {/* Mobile title lives in the body (the back button sits in the mobile
          chrome slot, not the body). On desktop the title moved BESIDE the
          back button in the floating top bar, so this block is lg:hidden to
          avoid a double render. */}
      <div className="lg:hidden px-1 mb-4">
        <h1 className="text-[19px] font-semibold tracking-[-0.02em] text-foreground">
          Leads in this audience
        </h1>
        <p className="text-[12.5px] text-foreground/50 leading-snug mt-1">
          A view of the people in this audience.
        </p>
      </div>

      {/* Live enrichment progress: calm counter + thin bar that advances as
          background enrichment fills in. Fades out on completion. */}
      <AnimatePresence initial={false}>
        {showProgress && (
          <motion.div
            className="px-1 mb-4"
            initial={reduced ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={reduced ? { duration: 0 } : { duration: 0.28, ease: 'easeInOut' }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[12.5px] text-foreground/60 tabular-nums">
                Enriching {fmtNum(enrichedDone)} of {fmtNum(batchTotal)} leads
              </span>
            </div>
            <div className="h-1 rounded-full bg-foreground/[0.08] overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${batchTotal > 0 ? (enrichedDone / batchTotal) * 100 : 0}%`,
                  background: 'linear-gradient(90deg, #1B3FA8 0%, #2F6BFF 100%)',
                  transition: reduced ? 'none' : 'width 0.5s ease',
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="rp-card rounded-3xl px-3 py-1.5">
        {leads.length === 0 && (
          <p className="px-2 py-8 text-center text-[13px] text-foreground/45">
            No leads yet. Import a CSV or turn on a source to start building this audience.
          </p>
        )}
        <div className="flex flex-col">
          {leads.map((lead, i) => {
            // While still enriching, identity (avatar + name + title/company)
            // is known instantly; warmth, insight and score fill in live.
            const enriching = isEnriching(lead, i);
            const revealTransition = reduced ? { duration: 0 } : { ...APPLE_SPRING };
            return (
            <div key={`${lead.name}-${i}`}>
              {i > 0 && (
                <div className="ml-[70px] h-px bg-foreground/[0.06] dark:bg-white/[0.06]" />
              )}
              {/* Each lead is the canonical person row (mirrors EngagerRow):
                  a tappable button with ReplaiyAvatar 44 + name + headline +
                  trailing chevron. The AI insight beneath is marked by our
                  small talking mascot, never a sparkle. */}
              <button
                type="button"
                onClick={openLead}
                data-testid={`view-lead-${i}`}
                className="w-full text-left rounded-[16px] px-3.5 py-3 flex items-start gap-3 hover-elevate active-elevate-2"
              >
                <ReplaiyAvatar name={lead.name} src={lead.avatar} size={44} className="shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 text-[14px] font-semibold tracking-[-0.005em] text-foreground leading-snug truncate">
                      {lead.name}
                    </span>
                    {enriching ? (
                      // Muted "Enriching" pill keeps the row height stable while
                      // the real warmth label is still being resolved.
                      <span className="glass-pill inline-flex items-center h-[18px] px-1.5 rounded-full text-[10.5px] font-medium text-foreground/40 shrink-0">
                        Enriching
                      </span>
                    ) : (
                      <motion.span
                        initial={reduced ? false : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={revealTransition}
                        className="glass-pill inline-flex items-center h-[18px] px-1.5 rounded-full text-[10.5px] font-medium text-foreground/45 shrink-0"
                      >
                        {WARMTH_META[lead.warmth].label}
                      </motion.span>
                    )}
                  </div>
                  <div className="text-[12px] text-foreground/55 leading-snug truncate mt-0.5">
                    {lead.title} at {lead.company}
                  </div>
                  {/* AI insight - what your AI noticed. Marked by the bare
                      persona mascot (the AI voice), NEVER a hard background
                      disc and never a sparkle. Same treatment as the inbox /
                      Overview "Your AI" mascot: the mascot image alone. */}
                  {enriching ? (
                    <div className="mt-1.5 flex items-center">
                      <Skeleton className="h-[12px] w-40 rounded" />
                    </div>
                  ) : (
                    <motion.div
                      initial={reduced ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={revealTransition}
                      className="mt-1.5 flex items-start gap-1.5"
                    >
                      <img
                        src={p.mascot}
                        alt=""
                        aria-hidden
                        draggable={false}
                        className="shrink-0 mt-[1px] w-[16px] h-[16px] object-contain select-none pointer-events-none"
                      />
                      <span className="text-[12px] text-foreground/60 leading-snug">
                        {lead.insight}
                      </span>
                    </motion.div>
                  )}
                </div>
                <div className="shrink-0 flex items-center gap-2 mt-0.5">
                  {enriching ? (
                    <Skeleton className="h-[14px] w-9 rounded-full" />
                  ) : (
                    <motion.span
                      initial={reduced ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={revealTransition}
                      className="text-[12px] font-semibold tabular-nums text-foreground/70"
                    >
                      {lead.matchScore}%
                    </motion.span>
                  )}
                  {/* Trailing chevron - the "open this lead" affordance. */}
                  <ChevronRight
                    size={16}
                    strokeWidth={1.8}
                    className="shrink-0 text-foreground/30"
                    aria-hidden
                  />
                </div>
              </button>
            </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full min-h-0 relative">
      {/* DESKTOP floating top bar - back button top-left, on the SAME top-3 /
          h-[52px] baseline as the campaign detail toolbar, inside the SAME
          centered 720 column. The leads screen has no tabs, so unlike the
          detail it DOES carry a back button on desktop. */}
      <div
        data-testid="campaign-leads-desktop-header"
        className="hidden lg:block absolute top-3 inset-x-0 z-30 pointer-events-none px-4 lg:px-6"
      >
        <div
          className="mx-auto flex items-center gap-3 h-[52px]"
          style={{ maxWidth: CAMPAIGN_COLUMN_MAX }}
        >
          <div className="pointer-events-auto">
            <ActionPill testId="button-back-leads" label="Back" onClick={back}>
              <ArrowLeft size={20} strokeWidth={1.7} className="text-icon" />
            </ActionPill>
          </div>
          {/* Title sits BESIDE the back button on the same 52px row. Single
              line, sized to fit; no subline in the bar (see body/progress). */}
          <div className="pointer-events-auto min-w-0">
            <h1 className="text-[17px] font-semibold tracking-[-0.02em] text-foreground truncate">
              Leads in this audience
            </h1>
          </div>
        </div>
      </div>

      {/* DESKTOP scroll container - paddingTop clears the floating top bar,
          matching the detail pane so the leads content starts at the same
          vertical position. */}
      <div
        data-testid="campaign-leads-scroll"
        className="hidden lg:flex flex-col flex-1 min-h-0 overflow-y-auto no-scrollbar pb-10"
        style={{ paddingTop: 86 }}
      >
        <div className="flex-1 px-4 lg:px-6">{body}</div>
      </div>

      {/* MOBILE scroll container - content sits under the floating chrome. */}
      <div
        className="flex lg:hidden flex-col flex-1 min-h-0 overflow-y-auto no-scrollbar px-4 pb-32"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 80px)' }}
      >
        {body}
      </div>

      {/* DESKTOP top frosting veil - same recipe as the detail pane so content
          frosts softly behind the floating top bar. */}
      <div
        aria-hidden
        className="hidden lg:block absolute inset-x-0 top-0 z-20 h-[86px] mobile-chrome-veil pointer-events-none"
      />
    </div>
  );
}

// -- CSV import: column-mapping screen, full-screen route -----------
// Reached at /campaigns/:id/import and dispatched from CampaignDetail. Mirrors
// CampaignLeadsView's shell EXACTLY: a centered CAMPAIGN_COLUMN_MAX (720)
// column, a desktop floating top bar at top-3 with a back button on the same
// h-[52px] baseline, a desktop frosting veil, and the mobile back button
// registered via useMobileTopChromeSlot. This is the Apollo/HeyReach-style
// step where the user matches their file's columns to Replaiy fields before a
// (mock) import. It reads the parsed CSV from the importDraft module store.

// The compact core Replaiy field set for LinkedIn outbound (matches the lead
// shape). LinkedIn URL is the required field: without it there is no import.
type ReplaiyFieldKey =
  | 'linkedin'
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'phone'
  | 'company'
  | 'jobTitle';

const REPLAIY_FIELDS: {
  key: ReplaiyFieldKey;
  label: string;
  required?: boolean;
  // Lowercased needles: a header maps here if it contains any of these.
  match: string[];
}[] = [
  {
    key: 'linkedin',
    label: 'LinkedIn URL',
    required: true,
    match: ['linkedin', 'profile url', 'profile', 'li url'],
  },
  { key: 'firstName', label: 'First name', match: ['first', 'firstname', 'voornaam', 'given'] },
  {
    key: 'lastName',
    label: 'Last name',
    match: ['last', 'lastname', 'achternaam', 'surname', 'family'],
  },
  { key: 'email', label: 'Email', match: ['email', 'e-mail', 'mail'] },
  { key: 'phone', label: 'Phone', match: ['phone', 'tel', 'mobile', 'telefoon', 'number'] },
  { key: 'company', label: 'Company', match: ['company', 'organization', 'org', 'bedrijf', 'account'] },
  { key: 'jobTitle', label: 'Job title', match: ['title', 'job', 'role', 'position', 'functie'] },
];

// Sentinel value for the "Don't import" option (Radix Select values must be
// non-empty strings, so we can't use '').
const DONT_IMPORT = '__none__';

// Auto-map: for each Replaiy field, pick the first CSV header (by column index)
// whose lowercased/trimmed name contains any of the field's needles. Each
// header maps to at most one field (first field to claim it wins), so two
// fields never share a column. Unmatched fields default to "Don't import".
function autoMap(headers: string[]): Record<ReplaiyFieldKey, string> {
  const norm = headers.map((h) => h.trim().toLowerCase());
  const taken = new Set<number>();
  const out = {} as Record<ReplaiyFieldKey, string>;
  for (const field of REPLAIY_FIELDS) {
    let picked = DONT_IMPORT;
    for (let i = 0; i < norm.length; i++) {
      if (taken.has(i)) continue;
      if (field.match.some((needle) => norm[i].includes(needle))) {
        picked = String(i);
        taken.add(i);
        break;
      }
    }
    out[field.key] = picked;
  }
  return out;
}

// Enrichment step labels for the progress moment. Step 1's label is built at
// render time from the filename; the rest are static.
const ENRICH_STEPS: string[] = [
  'Verifying profiles on LinkedIn',
  'Enriching with company data and signals',
  'Scoring against your ICP',
  'Removing duplicates',
];

function CampaignImportView({ campaign }: { campaign: Campaign }) {
  const [, navigate] = useLocation();
  const back = () => navigate('/campaigns/' + campaign.id);

  // Persona for the mascot + soft radial glow, read EXACTLY like CampaignAiHero.
  const { persona: livePersona, updateCampaign } = useReplaiy();
  const persona = activePersona(livePersona); // { color, mascot }
  const reduced = useReducedMotion() === true;

  // Read the parsed CSV once from the module store. If the user hit the URL
  // directly (or opened a different campaign's import), the draft is empty or
  // mismatched and we show a calm empty state.
  const draft = getImportDraft();
  const valid = !!draft && draft.campaignId === campaign.id;

  const headers = valid ? draft!.headers : [];
  const rows = valid ? draft!.rows : [];
  const total = valid ? draft!.total : 0;
  const filename = valid ? draft!.filename : '';

  // Recognize the file: if the incoming headers match a saved import layout
  // closely enough, we prefill the whole mapping and show a calm banner (like
  // Apollo / HeyReach saved mappings). Computed once from the headers.
  const matched = useMemo(
    () => (valid ? matchImportTemplate(headers) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [valid, headers.join('|')],
  );

  // Resolve a template's NAME-based mapping into this file's INDEX-based shape
  // (the same shape autoMap returns). For each Replaiy field we look up the
  // template's stored header name in the current headers (normalized compare);
  // found -> that column index as a string, else "Don't import". Keys the
  // template doesn't cover also default to "Don't import", so it stays robust
  // to column reordering between files.
  const resolveTemplateMapping = (
    template: NonNullable<ReturnType<typeof matchImportTemplate>>,
  ): Record<ReplaiyFieldKey, string> => {
    const norm = headers.map((h) => h.trim().toLowerCase());
    const out = {} as Record<ReplaiyFieldKey, string>;
    for (const field of REPLAIY_FIELDS) {
      const wantName = template.mapping[field.key];
      if (!wantName || wantName === DONT_IMPORT) {
        out[field.key] = DONT_IMPORT;
        continue;
      }
      const idx = norm.indexOf(wantName.trim().toLowerCase());
      out[field.key] = idx >= 0 ? String(idx) : DONT_IMPORT;
    }
    return out;
  };

  // The current field -> CSV-column mapping. Prefilled from a recognized
  // template when one matches, else auto-mapped on load; the user can override
  // each row via the glass column picker (GlassPopover).
  const [mapping, setMapping] = useState<Record<ReplaiyFieldKey, string>>(() =>
    valid
      ? matched
        ? resolveTemplateMapping(matched)
        : autoMap(headers)
      : ({} as Record<ReplaiyFieldKey, string>),
  );

  // The recognized layout name drives the banner. Dismissable: clearing it only
  // hides the note, the prefilled mapping stays.
  const [recognizedName, setRecognizedName] = useState<string | null>(matched?.name ?? null);

  // Mobile chrome - back arrow (left), same pattern as the leads view.
  useMobileTopChromeSlot(
    useMemo(
      () => ({
        priority: 100,
        leftSlot: (
          <ActionPill testId="button-back-import" label="Back" onClick={back}>
            <ArrowLeft size={20} strokeWidth={1.7} className="text-icon" />
          </ActionPill>
        ),
      }),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [campaign.id],
    ),
  );

  // First non-empty sample value for a given CSV column index, for the inline
  // "e.g. {value}" preview so the user can spot a wrong column at a glance.
  const exampleFor = (colStr: string): string | null => {
    if (colStr === DONT_IMPORT) return null;
    const col = Number(colStr);
    for (const row of rows) {
      const v = (row[col] ?? '').trim();
      if (v) return v;
    }
    return null;
  };

  // LinkedIn URL is required: the import is blocked until it is mapped to a
  // real CSV column (not "Don't import").
  const linkedinMapped = (mapping.linkedin ?? DONT_IMPORT) !== DONT_IMPORT;

  // -- Import enrichment phase state machine -------------------------
  // 'mapping' shows the column mapping screen (the default). Clicking Import
  // moves to 'enriching' (a live progress moment, no navigation yet); when the
  // last enrichment step completes we move to 'done' (the result summary).
  const [phase, setPhase] = useState<'mapping' | 'enriching' | 'done'>('mapping');
  // Which enrichment step is currently active (0-based). Steps before it are
  // done, the one at this index is spinning, steps after are pending. When it
  // reaches STEP_COUNT every step is done and we flip to 'done'.
  const STEP_COUNT = 5;
  const [activeStep, setActiveStep] = useState(0);

  // Believable, stable import stats derived once from the total. Duplicates is
  // a small slice; verified/enriched are the net kept; net is what lands in the
  // pool; aboveIcp is a scannable quality signal.
  const stats = useMemo(() => {
    const duplicates = Math.max(0, Math.round(total * 0.03));
    const verified = total - duplicates;
    const net = total - duplicates;
    const aboveIcp = Math.round(total * 0.61);
    return { duplicates, verified, net, aboveIcp };
  }, [total]);

  // Apply the result + pool bump EXACTLY ONCE, even across re-renders or React
  // strict-mode double invokes. Guarded by a ref.
  const appliedRef = useRef(false);
  const applyResult = () => {
    if (appliedRef.current) return;
    appliedRef.current = true;
    // Audience "N leads imported" line matches the summary headline (total).
    // The third arg is the enrichment batch total: the leads view uses it as the
    // progress-bar denominator ("Enriching {done} of {total} leads").
    setImportResult(campaign.id, total, total);
    // Land the net imported leads in the campaign pool, distributed across
    // warmth tiers: most cold, some warm, a few warmest. Preserve the rest of
    // the audience object.
    const aud = campaign.audience;
    if (aud) {
      const net = stats.net;
      const addWarmest = Math.round(net * 0.12);
      const addWarm = Math.round(net * 0.24);
      const addCold = net - addWarmest - addWarm;

      // Build a few REAL sample leads from the parsed CSV rows using the
      // current mapping, so the people the user just imported actually show up
      // in "View leads" (not only as a bumped pool count). Each field reads its
      // mapped CSV column (DONT_IMPORT means unmapped -> empty). Warmth is
      // spread so the list reads realistically; matchScore is deterministic per
      // index (no reshuffle on re-render); insight is a short enrichment line
      // with no provider name. Avatar reuses the same field the existing
      // sampleLeads use (a string src): empty string, so ReplaiyAvatar renders
      // the name's initials fallback rather than inventing a new avatar system.
      const cellFor = (row: string[], key: ReplaiyFieldKey): string => {
        const colStr = mapping[key] ?? DONT_IMPORT;
        if (colStr === DONT_IMPORT) return '';
        return (row[Number(colStr)] ?? '').trim();
      };
      const linkedinSlug = (row: string[]): string => {
        const raw = cellFor(row, 'linkedin');
        if (!raw) return '';
        const cleaned = raw.replace(/\/+$/, '');
        const seg = cleaned.split('/').filter(Boolean).pop() ?? '';
        return seg.replace(/[-_]+/g, ' ').trim();
      };
      const INSIGHTS = [
        'Recently active on LinkedIn',
        'Company matches your ICP',
        "Posted about their team's priorities",
        'New to a leadership role',
        'Hiring on their team right now',
      ];
      const warmthFor = (i: number): LeadWarmth =>
        i === 0 ? 'warmest' : i <= 2 ? 'warm' : 'cold';
      const scoreFor = (i: number): number => {
        // Deterministic, believable, higher for warmer. Derived from index so
        // it never reshuffles across re-renders.
        if (i === 0) return 90 + ((i * 7) % 7); // ~90-96 (warmest)
        if (i <= 2) return 78 + ((i * 5) % 9); // ~78-86 (warm)
        return 62 + ((i * 3) % 11); // ~62-72 (cold)
      };
      const importedLeads: SampleLead[] = rows.slice(0, 6).map((row, i) => {
        const first = cellFor(row, 'firstName');
        const last = cellFor(row, 'lastName');
        const name = `${first} ${last}`.trim() || linkedinSlug(row) || 'Imported lead';
        return {
          name,
          title: cellFor(row, 'jobTitle'),
          company: cellFor(row, 'company'),
          warmth: warmthFor(i),
          matchScore: scoreFor(i),
          insight: INSIGHTS[i % INSIGHTS.length],
          avatar: '',
          // Land immediately with identity known; enrichment runs in the
          // background and fills the rest live in the leads view.
          enriching: true,
        };
      });

      updateCampaign(campaign.id, {
        audience: {
          ...aud,
          // Show the freshly imported people first in "View leads".
          sampleLeads: [...importedLeads, ...(aud.sampleLeads ?? [])],
          pool: {
            cold: aud.pool.cold + addCold,
            warm: aud.pool.warm + addWarm,
            warmest: aud.pool.warmest + addWarmest,
          },
        },
      });
    }

    // Remember this layout so the next matching file is recognized and
    // prefilled. Store the mapping by header NAME (robust to reordering): for
    // each field, a real column index resolves to the normalized header name
    // at that index; "don't import" stays as the sentinel. Dedupes by
    // fingerprint in the store, so re-importing the same layout updates rather
    // than duplicates. Runs once inside the appliedRef guard.
    const norm = headers.map((h) => h.trim().toLowerCase());
    const mappingByHeaderName: Record<string, string> = {};
    for (const field of REPLAIY_FIELDS) {
      const colStr = mapping[field.key] ?? DONT_IMPORT;
      mappingByHeaderName[field.key] =
        colStr === DONT_IMPORT ? DONT_IMPORT : norm[Number(colStr)] ?? DONT_IMPORT;
    }
    const templateName = filename.replace(/\.[^.]+$/, '').trim() || 'Imported layout';
    saveImportTemplate(templateName, headers, mappingByHeaderName);
  };

  // Drive the enrichment steps once we enter 'enriching'. Chained setTimeouts
  // advance activeStep ~600-750ms per step (~3.2-3.8s total). When reduced
  // motion is set, go near-instant. Cleaned up on unmount; guarded so the
  // result is applied exactly once even if the effect is torn down mid-run.
  useEffect(() => {
    if (phase !== 'enriching') return;
    let mounted = true;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const finish = () => {
      if (!mounted) return;
      applyResult();
      setPhase('done');
    };

    if (reduced) {
      setActiveStep(STEP_COUNT);
      timers.push(setTimeout(finish, 400));
    } else {
      const perStep = 680; // ms each step spends active
      for (let i = 1; i <= STEP_COUNT; i++) {
        timers.push(
          setTimeout(() => {
            if (mounted) setActiveStep(i);
          }, perStep * i),
        );
      }
      timers.push(setTimeout(finish, perStep * STEP_COUNT + 120));
    }

    return () => {
      mounted = false;
      timers.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, reduced]);

  const onImport = () => {
    setActiveStep(0);
    setPhase('enriching');
  };

  // Both summary actions clear the draft, then navigate.
  const onViewLeads = () => {
    clearImportDraft();
    navigate('/campaigns/' + campaign.id + '/leads');
  };
  const onBackToAudience = () => {
    clearImportDraft();
    back();
  };

  // Hero-scale mascot for the breathing full-screen enrichment moments,
  // REUSING the CampaignAiHero / PersonaExperience recipe: a soft
  // persona-colour radial glow + gentle idle breathing (mascot ~84-88px, glow
  // blur 11, y:[0,-4,0]), reduced-motion safe. `size` sets the box.
  const heroMascot = (size: number) => (
    <div
      className="relative shrink-0 flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <motion.span
        aria-hidden
        className="absolute inset-[-6px] rounded-full"
        style={{
          background: `radial-gradient(circle at 50% 48%, ${persona.color}, transparent 68%)`,
          filter: 'blur(11px)',
          opacity: 0.5,
        }}
        animate={reduced ? undefined : { opacity: [0.42, 0.6, 0.42] }}
        transition={
          reduced ? undefined : { duration: 3.4, repeat: Infinity, ease: 'easeInOut' }
        }
      />
      <motion.img
        src={persona.mascot}
        alt=""
        aria-hidden
        draggable={false}
        className="relative object-contain select-none pointer-events-none"
        style={{ width: size, height: size }}
        animate={reduced ? undefined : { y: [0, -4, 0] }}
        transition={
          reduced ? undefined : { duration: 3.6, repeat: Infinity, ease: 'easeInOut' }
        }
      />
    </div>
  );

  // -- Empty state (no valid draft) ----------------------------------
  const emptyBody = (
    <div className="mx-auto w-full" style={{ maxWidth: CAMPAIGN_COLUMN_MAX }}>
      <div className="rp-card rounded-3xl px-6 py-12 flex flex-col items-center text-center">
        <div className="h-11 w-11 rounded-2xl bg-foreground/[0.06] dark:bg-white/[0.08] flex items-center justify-center mb-3">
          <Upload size={18} strokeWidth={1.9} className="text-foreground/60" />
        </div>
        <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-foreground">
          Nothing to import
        </h2>
        <p className="text-[12.5px] text-foreground/50 leading-snug mt-1.5 max-w-xs">
          Nothing to import. Go back and drop a CSV.
        </p>
        <button
          type="button"
          data-testid="button-back-import-empty"
          onClick={back}
          className="mt-5 inline-flex items-center h-[34px] px-4 rounded-full text-[12.5px] font-semibold hover-elevate active-elevate-2"
          style={{ color: AI_ACCENT }}
        >
          Go back
        </button>
      </div>
    </div>
  );

  // -- Mapping body (valid draft) ------------------------------------
  const mappingBody = (
    <div className="mx-auto w-full" style={{ maxWidth: CAMPAIGN_COLUMN_MAX }}>
      <div className="px-1 mb-4">
        <h1 className="text-[20px] font-semibold tracking-[-0.02em] text-foreground">
          Map your columns
        </h1>
        <p className="text-[12.5px] text-foreground/50 leading-snug mt-1">
          Match your file's columns to Replaiy fields. We filled in the obvious ones.
        </p>
        <div className="mt-2 flex items-center gap-2 text-[12px] text-foreground/55">
          <FileText size={14} strokeWidth={1.9} className="text-icon-muted shrink-0" />
          <span className="truncate">
            {filename},{' '}
            <span className="tabular-nums font-medium text-foreground/70">{fmtNum(total)}</span>{' '}
            leads
          </span>
        </div>
      </div>

      {/* Recognized layout banner: when the incoming file matched a saved
          import layout we prefilled the whole mapping, so this calm inline row
          tells the user we did it (like Apollo / HeyReach saved mappings). A
          soft accent-tinted row, NOT a hard card: no border, very light tint.
          Nothing locks - every row stays editable, and "Dismiss" only hides
          this note. Reused inline-note tone, AI_ACCENT, motion + APPLE_SPRING. */}
      {recognizedName && (
        <motion.div
          data-testid="import-recognized-banner"
          initial={reduced ? false : { opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduced ? undefined : APPLE_SPRING}
          className="mb-3 rounded-2xl px-3.5 py-2.5 flex items-center gap-2.5"
          style={{ background: 'rgba(47,107,255,0.06)' }}
        >
          <span
            aria-hidden
            className="flex items-center justify-center w-[22px] h-[22px] rounded-full shrink-0"
            style={{ background: 'rgba(47,107,255,0.12)' }}
          >
            <Check size={13} strokeWidth={2.6} style={{ color: AI_ACCENT }} />
          </span>
          <span className="text-[12.5px] text-foreground/70 leading-snug">
            Recognized your{' '}
            <span className="font-medium text-foreground/85">{recognizedName}</span> layout,
            mapping applied.
          </span>
          <button
            type="button"
            data-testid="button-dismiss-recognized"
            onClick={() => setRecognizedName(null)}
            className="ml-auto shrink-0 text-[12px] text-foreground/45 hover:text-foreground/70"
          >
            Dismiss
          </button>
        </motion.div>
      )}

      {/* The mapping rows: one per Replaiy field. Each has the field name (+ a
          "required" hint on LinkedIn URL), a glass column picker
          (GlassPopover) to pick the CSV column (or "Don't import"), and an
          inline "e.g. {value}" preview from the mapped column so a wrong column
          is easy to spot. One calm rp-card, rows separated by hairlines, no
          hard borders. Stacks cleanly on mobile (field label + preview above,
          full-width picker below); side by side on md+. */}
      <div className="rp-card rounded-3xl">
        {REPLAIY_FIELDS.map((field, i) => {
          const value = mapping[field.key] ?? DONT_IMPORT;
          const example = exampleFor(value);
          return (
            <div key={field.key}>
              {i > 0 && (
                <div className="ml-4 h-px bg-foreground/[0.06] dark:bg-white/[0.06]" />
              )}
              <div
                data-testid={`import-map-row-${field.key}`}
                className="px-4 py-3.5 flex flex-col md:flex-row md:items-center gap-2 md:gap-4"
              >
                <div className="md:w-[200px] md:shrink-0 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13.5px] font-medium text-foreground">
                      {field.label}
                    </span>
                    {field.required && (
                      <span
                        className="inline-flex items-center h-[18px] px-1.5 rounded-full text-[10.5px] font-medium"
                        style={{ color: AI_ACCENT, background: 'rgba(47,107,255,0.10)' }}
                      >
                        required
                      </span>
                    )}
                  </div>
                  {/* Inline example value from the mapped column - the preview. */}
                  <div className="text-[11.5px] text-foreground/45 leading-snug mt-0.5 truncate">
                    {example ? `e.g. ${example}` : 'Not mapped'}
                  </div>
                </div>
                <div className="min-w-0 md:flex-1">
                  {/* Column picker: the SHARED GlassPopover (glass, no hard
                      border), same pattern as the language picker. Trigger is a
                      full-width glass pill showing the current mapping or
                      "Don't import"; the menu lists "Don't import" first, then
                      every CSV header, with an accent Check on the selected one.
                      The picker STRETCHES to fill the row so every pill lines up
                      on BOTH the left and right edges (full-width on mobile and
                      desktop). Uses autoFlip so it opens DOWNWARD when there is
                      room and flips UPWARD only near the bottom of the screen;
                      anchor="bottom" is the safe fallback for the top row. */}
                  <GlassPopover
                    anchor="bottom"
                    autoFlip
                    align="left"
                    width="w-64"
                    className="w-full"
                    testId={`import-map-menu-${field.key}`}
                    trigger={({ open, toggle }) => (
                      <button
                        type="button"
                        data-testid={`import-map-select-${field.key}`}
                        aria-haspopup="listbox"
                        aria-expanded={open}
                        onClick={toggle}
                        className="glass-pill pill w-full inline-flex items-center justify-between gap-1.5 h-[36px] px-3 text-[13px] text-foreground/80 hover-elevate active-elevate-2"
                      >
                        <span className="truncate">
                          {value === DONT_IMPORT
                            ? "Don't import"
                            : headers[Number(value)]?.trim() || `Column ${Number(value) + 1}`}
                        </span>
                        <motion.span
                          animate={{ rotate: open ? 180 : 0 }}
                          transition={APPLE_SPRING}
                          className="inline-flex shrink-0"
                        >
                          <ChevronDown size={15} strokeWidth={2} className="text-foreground/40" />
                        </motion.span>
                      </button>
                    )}
                  >
                    {({ close }) => (
                      <div className="max-h-64 overflow-y-auto no-scrollbar" role="listbox">
                        {[DONT_IMPORT, ...headers.map((_, ci) => String(ci))].map((opt) => {
                          const selected = opt === value;
                          const optLabel =
                            opt === DONT_IMPORT
                              ? "Don't import"
                              : headers[Number(opt)]?.trim() || `Column ${Number(opt) + 1}`;
                          return (
                            <button
                              key={opt}
                              type="button"
                              role="option"
                              aria-selected={selected}
                              data-testid={`import-map-option-${field.key}-${opt}`}
                              onClick={() => {
                                setMapping((prev) => ({ ...prev, [field.key]: opt }));
                                close();
                              }}
                              className={`w-full flex items-center justify-between gap-2 text-left px-2.5 py-2 rounded-xl hover-elevate active-elevate-2 text-[13px] ${
                                selected ? 'font-semibold text-foreground' : 'text-foreground/70'
                              }`}
                            >
                              <span className="truncate">{optLabel}</span>
                              {selected && (
                                <Check size={14} strokeWidth={2.6} className="shrink-0" style={{ color: AI_ACCENT }} />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </GlassPopover>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Trust note: CSV values are a starting point, LinkedIn is the source of
          truth. Quiet inline line (same style as the Audience compliance /
          sending notes), NOT a card. Sits UNDER the mapping card, close to the
          Import action, so it reassures the user right before they commit. */}
      <p
        data-testid="import-verify-note"
        className="px-2 mt-3 flex items-start gap-1.5 text-[11.5px] text-foreground/45 leading-snug"
      >
        <ShieldCheck size={13} strokeWidth={1.9} className="shrink-0 mt-[2px] text-foreground/35" />
        Replaiy verifies names, roles and companies against each LinkedIn profile, so your
        messages stay accurate.
      </p>

      {/* Bottom action: the primary Import button on the right. The round back
          button top-left is the single back affordance (consistent with the
          leads view), so there is no redundant text "Back" here. When LinkedIn
          URL is not yet mapped the button is disabled and a calm inline hint on
          the left explains why. Import uses the app's solid-accent action style
          (solid blue, white text, glow). */}
      <div className="mt-6 flex items-center justify-between">
        {!linkedinMapped ? (
          <div className="flex items-center gap-1.5 text-[12px] text-foreground/50">
            <Info size={14} strokeWidth={1.9} className="shrink-0 text-foreground/40" />
            <span>Map LinkedIn URL to continue.</span>
          </div>
        ) : (
          <span />
        )}
        <button
          type="button"
          data-testid="button-import-commit"
          onClick={onImport}
          disabled={!linkedinMapped}
          className="inline-flex items-center justify-center h-11 px-5 rounded-full text-[13px] font-semibold text-white hover-elevate active-elevate-2 disabled:opacity-40 disabled:pointer-events-none"
          style={{
            background: AI_ACCENT,
            boxShadow:
              '0 6px 18px 0 color-mix(in srgb, #2F6BFF 32%, transparent), inset 0 1px 0 0 rgba(255,255,255,0.22)',
          }}
        >
          Import {fmtNum(total)} leads
        </button>
      </div>
    </div>
  );

  // -- Enriching body (phase 'enriching') ----------------------------
  // A breathing full-screen MOMENT (not a boxed card): the hero mascot + soft
  // persona glow, calm copy, and a calm centered 5-step checklist. Content is
  // centered vertically + horizontally and fills the body, with generous air
  // between the mascot, heading, subline, and the list.
  const stepLabels = [`Reading ${filename}`, ...ENRICH_STEPS];
  const enrichingBody = (
    <div
      className="mx-auto w-full flex flex-col items-center justify-center text-center min-h-[70vh] px-6"
      style={{ maxWidth: CAMPAIGN_COLUMN_MAX }}
    >
      {heroMascot(88)}
      <h2 className="text-xl font-semibold tracking-tight text-foreground mt-8">
        Enriching your leads
      </h2>
      <p className="text-[13.5px] text-foreground/55 leading-[1.5] mt-3 max-w-[420px]">
        Verifying every lead against LinkedIn so your outreach stays accurate.
      </p>

      {/* 5-step checklist as a calm centered column (no card, no borders).
          States: done (Check on soft accent chip), active (spinning Loader2 in
          AI_ACCENT), pending (hollow Circle). Left-aligned within the column so
          the ticks line up; the only subtle ring is the 16px status chip. */}
      <div className="w-full max-w-[340px] mt-10 flex flex-col text-left">
        {stepLabels.map((label, i) => {
          const done = i < activeStep;
          const active = i === activeStep;
          return (
            <div key={i} className="flex items-center gap-3 py-2">
              <span className="relative flex items-center justify-center w-4 h-4 shrink-0">
                {done ? (
                  <span
                    className="flex items-center justify-center w-4 h-4 rounded-full"
                    style={{ background: 'rgba(47,107,255,0.12)' }}
                  >
                    <Check size={11} strokeWidth={3} style={{ color: AI_ACCENT }} />
                  </span>
                ) : active ? (
                  <Loader2 size={15} strokeWidth={2.4} className="animate-spin" style={{ color: AI_ACCENT }} />
                ) : (
                  <Circle size={14} strokeWidth={2} className="text-foreground/25" />
                )}
              </span>
              <span
                className={`text-[13px] leading-snug truncate ${
                  done || active ? 'text-foreground/80' : 'text-foreground/40'
                }`}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );

  // -- Result summary body (phase 'done') ----------------------------
  // A breathing full-screen success MOMENT (not a boxed card): the hero mascot
  // + glow with a small AI_ACCENT check badge, the headline count, a clean
  // centered stats BAND (no boxes), and two actions. The block rises in gently
  // on mount (reduced-motion safe).
  // Honest kickoff stats: enrichment has STARTED, not finished. No numbers that
  // imply completion (no "Verified on LinkedIn" / "Above your ICP bar").
  const doneStats = [
    { label: 'In your pool', value: stats.net },
    { label: 'Being enriched', value: total },
    { label: 'Duplicates skipped', value: stats.duplicates },
  ];
  const doneBody = (
    <motion.div
      className="mx-auto w-full flex flex-col items-center justify-center text-center min-h-[70vh] px-6"
      style={{ maxWidth: CAMPAIGN_COLUMN_MAX }}
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduced ? undefined : APPLE_SPRING}
    >
      <div className="relative">
        {heroMascot(84)}
        {/* Small accent check badge on the mascot corner. */}
        <span
          aria-hidden
          className="absolute right-0 bottom-0 flex items-center justify-center w-[22px] h-[22px] rounded-full"
          style={{
            background: AI_ACCENT,
            boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.22)',
          }}
        >
          <Check size={13} strokeWidth={3.2} className="text-white" />
        </span>
      </div>

      <h2 className="text-xl font-semibold tracking-tight text-foreground tabular-nums mt-8">
        {fmtNum(total)} leads imported
      </h2>

      {/* Honest subline: enrichment runs in the background, this is a kickoff. */}
      <p className="mt-3 text-[13px] leading-relaxed text-foreground/55 max-w-[440px]">
        We are enriching them in the background, verifying each one on LinkedIn
        and pulling signals. You can keep working while this runs.
      </p>

      {/* Clean centered stats band: value over label, no boxes. Stacked on
          mobile, a single row on desktop with thin hairline dividers between. */}
      <div className="mt-8 grid grid-cols-2 gap-y-6 gap-x-10 sm:flex sm:items-center sm:gap-0">
        {doneStats.map((s, i) => (
          <div key={i} className="flex items-stretch">
            {i > 0 && (
              <span
                aria-hidden
                className="hidden sm:block w-px self-stretch bg-foreground/10 mx-7"
              />
            )}
            <div className="flex flex-col items-center">
              <span className="text-[18px] font-semibold text-foreground tabular-nums leading-none">
                {fmtNum(s.value)}
              </span>
              <span className="text-[11.5px] text-foreground/45 leading-snug mt-1.5">
                {s.label}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Actions: primary solid-accent "View leads", quiet "Back to audience". */}
      <div className="w-full max-w-[340px] mt-10 flex flex-col items-center gap-3">
        <button
          type="button"
          data-testid="button-import-view-leads"
          onClick={onViewLeads}
          className="w-full inline-flex items-center justify-center h-11 px-5 rounded-full text-[13px] font-semibold text-white hover-elevate active-elevate-2"
          style={{
            background: AI_ACCENT,
            boxShadow:
              '0 6px 18px 0 color-mix(in srgb, #2F6BFF 32%, transparent), inset 0 1px 0 0 rgba(255,255,255,0.22)',
          }}
        >
          View leads
        </button>
        <button
          type="button"
          data-testid="button-import-back-audience"
          onClick={onBackToAudience}
          className="inline-flex items-center h-9 px-4 rounded-full text-[12.5px] font-medium text-foreground/55 hover-elevate active-elevate-2"
        >
          Back to audience
        </button>
      </div>
    </motion.div>
  );

  const body = !valid
    ? emptyBody
    : phase === 'enriching'
      ? enrichingBody
      : phase === 'done'
        ? doneBody
        : mappingBody;

  return (
    <div className="flex flex-col h-full min-h-0 relative">
      {/* DESKTOP floating top bar - back button top-left, same top-3 / h-[52px]
          baseline and centered 720 column as the leads view. */}
      <div
        data-testid="campaign-import-desktop-header"
        className="hidden lg:block absolute top-3 inset-x-0 z-30 pointer-events-none px-4 lg:px-6"
      >
        <div
          className="mx-auto flex items-center h-[52px]"
          style={{ maxWidth: CAMPAIGN_COLUMN_MAX }}
        >
          <div className="pointer-events-auto">
            <ActionPill testId="button-back-import" label="Back" onClick={back}>
              <ArrowLeft size={20} strokeWidth={1.7} className="text-icon" />
            </ActionPill>
          </div>
        </div>
      </div>

      {/* DESKTOP scroll container - paddingTop clears the floating top bar. */}
      <div
        data-testid="campaign-import-scroll"
        className="hidden lg:flex flex-col flex-1 min-h-0 overflow-y-auto no-scrollbar pb-10"
        style={{ paddingTop: 86 }}
      >
        <div className="flex-1 px-4 lg:px-6">{body}</div>
      </div>

      {/* MOBILE scroll container - content sits under the floating chrome. */}
      <div
        className="flex lg:hidden flex-col flex-1 min-h-0 overflow-y-auto no-scrollbar px-4 pb-32"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 80px)' }}
      >
        {body}
      </div>

      {/* DESKTOP top frosting veil - same recipe as the leads view. */}
      <div
        aria-hidden
        className="hidden lg:block absolute inset-x-0 top-0 z-20 h-[86px] mobile-chrome-veil pointer-events-none"
      />
    </div>
  );
}


// ── The whole Audience section, in agreed order ─────────────────────
// Threshold + view-leads live here so the pool health line, the slider, and
// the preview all read from one source of truth (local state).
function AudienceSection({ campaign }: { campaign: Campaign }) {
  const [, navigate] = useLocation();
  const audience = campaign.audience;
  const [threshold, setThreshold] = useState(audience?.matchThreshold ?? 70);
  if (!audience) return null;
  return (
    <div className="flex flex-col gap-6 md:gap-7">
      {/* v-leads-route — "View leads" now navigates to a full-screen route
          (/campaigns/:id/leads) instead of opening an overlay sheet. */}
      <AudiencePoolCard
        audience={audience}
        threshold={threshold}
        onViewLeads={() => navigate('/campaigns/' + campaign.id + '/leads')}
      />
      <AudienceSourcesCard audience={audience} campaignId={campaign.id} />
      <AudienceIcpCard audience={audience} />
      <AudienceThresholdCard audience={audience} value={threshold} onChange={setThreshold} />
      <AudienceSuppressCard audience={audience} />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// Dispatcher - keep universal hooks at the top (rules-of-hooks safe),
// then delegate to the create view or the detail view, or an empty state.
export default function CampaignDetail() {
  const params = useParams<{ id?: string }>();
  const [loc] = useLocation();
  const { campaigns } = useReplaiy();
  const id = params.id;

  // v-leads-route — detect the /campaigns/:id/leads sub-route. The leads view
  // is a full-screen route (no overlay/sheet) reached from the Audience tab's
  // "View leads" button; when present we render CampaignLeadsView instead of
  // the tabbed detail.
  const showingLeads = /\/campaigns\/[^/]+\/leads\/?$/.test(loc);

  // v-import-route — detect the /campaigns/:id/import sub-route. Dropping a CSV
  // in the Sources dropzone parses it, stashes the draft in the importDraft
  // module store, and navigates here; we render the full-screen mapping screen
  // (CampaignImportView) instead of the tabbed detail, same pattern as leads.
  const showingImport = /\/campaigns\/[^/]+\/import\/?$/.test(loc);

  if (id === 'new') {
    return <CampaignCreate key="new" />;
  }

  const campaign = id ? campaigns.find((c) => c.id === id) : undefined;

  if (showingLeads) {
    if (!campaign) return <CampaignMissing key="missing-leads" />;
    return <CampaignLeadsView campaign={campaign} key={`${campaign.id}-leads`} />;
  }

  if (showingImport) {
    if (!campaign) return <CampaignMissing key="missing-import" />;
    return <CampaignImportView campaign={campaign} key={`${campaign.id}-import`} />;
  }

  if (!id) {
    // Bare /campaigns in the right pane (desktop). The list/overview owns the
    // screen; this is the calm placeholder behind it - given the SAME polished
    // treatment as the inbox EmptyDetail (Replaiy mark + h2 + one helper line)
    // so Campaigns and Inbox feel identical. Same classNames / typography.
    return (
      <div className="hidden lg:flex flex-1 flex-col items-center justify-center text-center px-8">
        <div className="mb-4">
          <ReplaiyLogo size={56} />
        </div>
        <h2 className="text-[20px] font-semibold tracking-[-0.02em]">Select a campaign</h2>
        <p className="text-[14px] text-muted-foreground mt-1.5 max-w-xs">
          Choose a campaign to see its funnel, flow and results. You can
          fine-tune its goal and team from here too.
        </p>
      </div>
    );
  }

  if (!campaign) {
    return <CampaignMissing key="missing" />;
  }

  return <CampaignDetailView campaign={campaign} key={campaign.id} />;
}

// ── Missing campaign - graceful, with a way back ────────────────────
function CampaignMissing() {
  const [, navigate] = useLocation();
  useMobileTopChromeSlot(
    useMemo(
      () => ({
        priority: 100,
        leftSlot: (
          <ActionPill
            testId="button-back"
            label="Back"
            onClick={() => navigate('/campaigns')}
          >
            <ArrowLeft size={20} strokeWidth={1.7} className="text-icon" />
          </ActionPill>
        ),
      }),
      [navigate],
    ),
  );
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center text-muted-foreground p-8">
      <p className="text-[14px]">This campaign no longer exists</p>
    </div>
  );
}

// ── Overflow (... ) menu - glass-strong dropdown, Rename + Delete ───
// The switch (active/paused) owns enable/disable; this menu only renames or
// removes. Archive was redundant alongside Paused, so it's gone entirely.
function OverflowMenu({
  campaign,
  onRename,
}: {
  campaign: Campaign;
  onRename?: () => void;
}) {
  const [, navigate] = useLocation();
  const { updateCampaign } = useReplaiy();

  // Mock data has no hard remove; marking the campaign archived + leaving the
  // detail is the closest honest "delete" action against the mock store.
  const del = () => {
    updateCampaign(campaign.id, { status: 'archived' });
    navigate('/campaigns');
  };

  // The trigger is the SHARED GlassCircleButton (the same glass affordance as
  // CampaignsList's search / new buttons), wrapping MoreHorizontal. The menu
  // itself is the SHARED GlassPopover, so this overflow reuses existing
  // components end to end instead of a hand-rolled button + dropdown.
  return (
    <GlassPopover
      anchor="bottom"
      align="right"
      width="w-[200px]"
      testId="campaign-actions-menu"
      trigger={({ open, toggle }) => (
        <div data-active={open || undefined}>
          <GlassCircleButton
            label="Campaign actions"
            testId="button-campaign-overflow"
            onClick={toggle}
            ariaPressed={open}
            size={44}
          >
            <MoreHorizontal size={19} strokeWidth={1.9} className="text-icon" />
          </GlassCircleButton>
        </div>
      )}
    >
      {({ close }) => (
        <div className="flex flex-col gap-0.5">
          {onRename && (
            <button
              role="menuitem"
              data-testid="action-rename"
              onClick={() => {
                close();
                onRename();
              }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-2xl text-[14px] font-medium hover-elevate active-elevate-2 text-left text-foreground"
            >
              <Pencil size={17} strokeWidth={1.6} className="shrink-0 text-icon" />
              <span>Rename</span>
            </button>
          )}
          <button
            role="menuitem"
            data-testid="action-delete"
            onClick={() => {
              close();
              del();
            }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-2xl text-[14px] font-medium hover-elevate active-elevate-2 text-left"
            style={{ color: 'hsl(var(--destructive))' }}
          >
            <Trash2 size={17} strokeWidth={1.6} className="shrink-0" />
            <span>Delete</span>
          </button>
        </div>
      )}
    </GlassPopover>
  );
}

// ── Inline goal picker - reused by the create view AND the editable
//    goal card in the detail. Same treatment in both places. ─────────
function GoalPicker({
  goalType,
  customLabel,
  onPick,
  onCustomLabel,
}: {
  goalType: CampaignGoalType;
  customLabel: string;
  onPick: (g: CampaignGoalType) => void;
  onCustomLabel: (v: string) => void;
}) {
  // One glass cluster of rows (inbox / Settings language): hairline
  // dividers, NO per-row boxed icon, NO coloured border. Selection is a
  // subtle neutral fill + a small muted check - calm, not a loud frame.
  return (
    <div className="rp-card rounded-3xl overflow-hidden">
      {GOAL_ORDER.map((g, i) => {
        const meta = GOAL_META[g];
        const Icon = GOAL_ICONS[g];
        const selected = goalType === g;
        return (
          <div key={g}>
            {i > 0 && (
              <div className="ml-4 h-px bg-foreground/[0.06] dark:bg-white/[0.06]" />
            )}
            <button
              type="button"
              data-testid={`goal-option-${g}`}
              onClick={() => onPick(g)}
              aria-pressed={selected}
              className={`w-full text-left px-4 py-3.5 hover-elevate active-elevate-2 ${selectedRowClass(
                selected,
              )}`}
            >
              <div className="flex items-center gap-3">
                {/* Small plain glyph, no background box. */}
                <Icon
                  size={16}
                  strokeWidth={1.9}
                  className="shrink-0"
                  style={{ color: selected ? AI_ACCENT : undefined }}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[14.5px] font-semibold tracking-[-0.005em] text-foreground">
                    {meta.label}
                  </div>
                  <div className="text-[12.5px] text-muted-foreground leading-snug mt-0.5">
                    {meta.hint}
                  </div>
                </div>
                {/* Quiet selection mark - a small accent check, no filled box. */}
                {selected && (
                  <Check
                    size={17}
                    strokeWidth={2.6}
                    className="shrink-0"
                    style={{ color: AI_ACCENT }}
                  />
                )}
              </div>
              {/* Custom → a calm inline field, revealed when selected. The
                  standard goals need nothing extra; only Custom asks you to
                  define the outcome. A hairline separates it and the field is
                  bare (no grey box), exactly like a knowledge answer. */}
              {g === 'custom' && selected && (
                <div className="mt-3.5 pt-3.5 ml-7 border-t border-foreground/[0.07] dark:border-white/[0.07]" onClick={(e) => e.stopPropagation()}>
                  <input
                    data-testid="input-custom-goal"
                    value={customLabel}
                    onChange={(e) => onCustomLabel(e.target.value)}
                    placeholder="Describe the outcome in your own words…"
                    className="w-full bg-transparent outline-none text-[14px] leading-[1.5] text-foreground placeholder:text-foreground/40"
                  />
                </div>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}

// Language section: auto-match (default) or a fixed language.
// Two quiet rows in one card: "Match each lead's language automatically"
// (default) and "Use a fixed language" with a glass language picker. When
// fixed, a helper notes it runs only on seats who speak that language.
function LanguageSection({ campaign }: { campaign: Campaign }) {
  const [mode, setMode] = useState<'auto' | 'fixed'>(campaign.language?.mode ?? 'auto');
  const [fixed, setFixed] = useState<LanguageCode>(campaign.language?.fixed ?? 'en');

  const ROWS: { value: 'auto' | 'fixed'; label: string; hint: string }[] = [
    {
      value: 'auto',
      label: "Match each lead's language automatically",
      hint: 'Replies follow whatever language the lead writes in.',
    },
    {
      value: 'fixed',
      label: 'Use a fixed language',
      hint: 'Every conversation in this campaign runs in one language.',
    },
  ];

  return (
    <section>
      <AudienceHeader
        label="Language"
        sub="What language this campaign reaches out in."
      />
      <div className="rp-card rounded-3xl overflow-hidden" data-testid="campaign-language">
        {ROWS.map((row, i) => {
          const selected = mode === row.value;
          return (
            <div key={row.value}>
              {i > 0 && (
                <div className="ml-4 h-px bg-foreground/[0.06] dark:bg-white/[0.06]" />
              )}
              <button
                type="button"
                data-testid={`language-option-${row.value}`}
                onClick={() => setMode(row.value)}
                aria-pressed={selected}
                className={`w-full text-left px-4 py-3.5 hover-elevate active-elevate-2 ${selectedRowClass(
                  selected,
                )}`}
              >
                <div className="flex items-center gap-3">
                  <LanguagesIcon
                    size={16}
                    strokeWidth={1.9}
                    className="shrink-0"
                    style={{ color: selected ? AI_ACCENT : undefined }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-semibold tracking-[-0.005em] text-foreground">
                      {row.label}
                    </div>
                    <div className="text-[12.5px] text-muted-foreground leading-snug mt-0.5">
                      {row.hint}
                    </div>
                  </div>
                  {selected && (
                    <Check size={17} strokeWidth={2.6} className="shrink-0" style={{ color: AI_ACCENT }} />
                  )}
                </div>
              </button>
              {row.value === 'fixed' && selected && (
                <div className="px-4 pb-4 pl-[52px] flex flex-col gap-2.5" onClick={(e) => e.stopPropagation()}>
                  <CampaignLanguagePicker value={fixed} onChange={setFixed} />
                  <p className="text-[12px] text-foreground/50 leading-snug">
                    Runs only on seats who speak {LANGUAGE_LABELS[fixed]}, from
                    the languages each teammate lists in their persona.
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// A searchable glass language picker, built on the shared GlassPopover, in the
// exact pattern of the Persona FallbackPicker (single-select, w-60, search).
function CampaignLanguagePicker({
  value,
  onChange,
}: {
  value: LanguageCode;
  onChange: (code: LanguageCode) => void;
}) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const codes = Object.keys(LANGUAGE_LABELS) as LanguageCode[];
  const q = query.trim().toLowerCase();
  const filtered = q
    ? codes.filter((code) => LANGUAGE_LABELS[code].toLowerCase().includes(q))
    : codes;

  return (
    <GlassPopover
      anchor="bottom"
      align="left"
      width="w-60"
      testId="campaign-language-menu"
      onOpenChange={(next) => {
        if (next) requestAnimationFrame(() => inputRef.current?.focus());
        else setQuery('');
      }}
      trigger={({ open, toggle }) => (
        <button
          type="button"
          data-testid="campaign-language-trigger"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={toggle}
          className="glass-pill inline-flex items-center gap-1.5 h-9 pl-3.5 pr-3 rounded-full text-[13px] font-medium text-foreground/80 hover-elevate active-elevate-2 self-start"
        >
          {LANGUAGE_LABELS[value]}
          <motion.span animate={{ rotate: open ? 180 : 0 }} transition={APPLE_SPRING} className="inline-flex">
            <ChevronDown size={14} strokeWidth={2} className="text-icon-muted" />
          </motion.span>
        </button>
      )}
    >
      {({ close }) => (
        <>
          <div className="flex items-center gap-2 h-9 px-2.5 mb-1">
            <Globe size={15} strokeWidth={1.8} className="shrink-0 text-foreground/75" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search language"
              data-testid="campaign-language-search"
              className="flex-1 min-w-0 bg-transparent border-0 outline-none text-[13px] text-foreground placeholder:text-foreground/40"
            />
          </div>
          <div className="h-px bg-foreground/[0.07] dark:bg-white/[0.07] mx-1 mb-1" />
          <div className="max-h-64 overflow-y-auto no-scrollbar" role="listbox">
            {filtered.length === 0 ? (
              <div className="px-2.5 py-3 text-[12.5px] text-foreground/45">No languages found</div>
            ) : (
              filtered.map((code) => {
                const selected = code === value;
                return (
                  <button
                    key={code}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    data-testid={`campaign-language-${code}`}
                    onClick={() => {
                      onChange(code);
                      close();
                    }}
                    className={`w-full flex items-center justify-between gap-2 h-9 px-2.5 rounded-xl text-[13px] text-left transition-colors hover-elevate active-elevate-2 ${
                      selected ? 'font-semibold text-foreground' : 'text-foreground/70'
                    }`}
                  >
                    {LANGUAGE_LABELS[code]}
                    {selected && <Check size={14} strokeWidth={2.6} style={{ color: AI_ACCENT }} />}
                  </button>
                );
              })
            )}
          </div>
        </>
      )}
    </GlassPopover>
  );
}

// Send timing section: automated actions only.
// A master toggle "Send at sensible local hours". When on, a representational
// work window + a note that it uses the lead's local time with a fallback.
// A clear line that it applies to automated actions only.
function TimingSection({ campaign }: { campaign: Campaign }) {
  const [enabled, setEnabled] = useState(campaign.timing?.enabled ?? true);
  const windowLabel = campaign.timing?.window ?? 'Weekdays, 8:00 to 18:00';

  return (
    <section>
      <AudienceHeader label="Send timing" sub="When automated actions go out." />
      <div className="rp-card rounded-3xl p-5 lg:p-6" data-testid="campaign-timing">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 shrink-0 rounded-xl bg-foreground/[0.06] dark:bg-white/[0.08] flex items-center justify-center">
            <Clock size={16} strokeWidth={1.9} style={{ color: AI_ACCENT }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-semibold tracking-[-0.005em] text-foreground">
              Send at sensible local hours
            </div>
            <div className="text-[12.5px] text-foreground/50 leading-snug">
              Hold automated actions until a natural time of day.
            </div>
          </div>
          <GlassToggle
            on={enabled}
            onChange={setEnabled}
            testId="timing-toggle"
            ariaLabel={`${enabled ? 'Disable' : 'Enable'} send timing`}
          />
        </div>

        <AnimatePresence initial={false}>
          {enabled && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="overflow-hidden"
            >
              <div className="h-px bg-foreground/[0.07] dark:bg-white/[0.07] my-5" />
              <div className="flex items-center justify-between gap-3">
                <div className="text-[11px] font-semibold tracking-[-0.005em] text-foreground/45">Work window</div>
                <span
                  data-testid="timing-window"
                  className="glass-pill inline-flex items-center gap-1.5 h-[28px] px-3 rounded-full text-[12.5px] font-medium text-foreground/80"
                >
                  <Clock size={12} strokeWidth={2} className="text-foreground/45" />
                  {windowLabel}
                </span>
              </div>
              <p className="mt-3 text-[12.5px] text-foreground/50 leading-snug">
                Uses each lead's local time where known, with a fallback to your
                timezone.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-4 flex items-start gap-1.5">
          <ShieldCheck size={13} strokeWidth={1.9} className="shrink-0 mt-[2px] text-foreground/35" />
          <p className="text-[11.5px] text-foreground/45 leading-snug">
            Applies to automated actions only. Manual approvals send when you
            approve them.
          </p>
        </div>
      </div>
    </section>
  );
}

// Sending - how Replaiy reaches out and replies.
// Two 2-choice selectors, styled EXACTLY like the Language section's
// two-option pattern (one rp-card, hairline-divided button rows, a leading
// glyph, label + hint, a quiet selection check, and a revealed area under the
// active row). Concerns outreach BEHAVIOUR, so it sits right by Send timing.
//
// Controlled by the parent (CampaignDetailView) so the opener choice can
// cross-link into the Flow's opener step: the parent owns opener / reply
// state, seeds it from the campaign, and passes the same opener down to the
// Flow. No backend write this round (visual / optimistic).
function SendingSection({
  opener,
  onOpenerMode,
  onOpenerText,
  reply,
  onReply,
}: {
  opener: { mode: 'ai' | 'fixed'; fixedText: string };
  onOpenerMode: (mode: 'ai' | 'fixed') => void;
  onOpenerText: (text: string) => void;
  reply: 'review' | 'autopilot';
  onReply: (mode: 'review' | 'autopilot') => void;
}) {
  // One row in a 2-choice selector. Flat row inside the shared card: hairline
  // divider above (except the first), a leading glyph, label + hint, and the
  // single selected treatment (accent tint + accent check, NO nested block).
  function ChoiceRow({
    selected,
    onSelect,
    icon: Icon,
    label,
    hint,
    testId,
    first,
    children,
  }: {
    selected: boolean;
    onSelect: () => void;
    icon: typeof Wand2;
    label: string;
    hint: string;
    testId: string;
    first: boolean;
    children?: React.ReactNode;
  }) {
    return (
      <div>
        {!first && (
          <div className="ml-4 h-px bg-foreground/[0.06] dark:bg-white/[0.06]" />
        )}
        <button
          type="button"
          data-testid={testId}
          onClick={onSelect}
          aria-pressed={selected}
          className={`w-full text-left px-4 py-3.5 hover-elevate active-elevate-2 ${selectedRowClass(
            selected,
          )}`}
        >
          <div className="flex items-center gap-3">
            <Icon
              size={16}
              strokeWidth={1.9}
              className="shrink-0"
              style={{ color: selected ? AI_ACCENT : undefined }}
            />
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-semibold tracking-[-0.005em] text-foreground">
                {label}
              </div>
              <div className="text-[12.5px] text-muted-foreground leading-snug mt-0.5">
                {hint}
              </div>
            </div>
            {selected && (
              <Check size={17} strokeWidth={2.6} className="shrink-0" style={{ color: AI_ACCENT }} />
            )}
          </div>
        </button>
        {children}
      </div>
    );
  }

  return (
    <section>
      <AudienceHeader
        label="Sending"
        sub="How Replaiy reaches out and replies."
      />

      {/* ONE card for the whole section. The two sub-groups (Opening message /
          Conversation replies) are SubLabel headings INSIDE the card, divided
          by a single hairline, option rows flat beneath. No card-in-card;
          selection is accent tint + accent check; the revealed fixed-opener
          field is a flat field in the same card. */}
      <div className="rp-card rounded-3xl overflow-hidden" data-testid="campaign-sending">
      {/* Opening message - AI writes each opener, or one fixed opener. */}
      <div className="px-4 pt-4 pb-1">
        <SubLabel>Opening message</SubLabel>
      </div>
      <div data-testid="sending-opener">
        <ChoiceRow
          first
          selected={opener.mode === 'ai'}
          onSelect={() => onOpenerMode('ai')}
          icon={Wand2}
          label="Replaiy writes each opener"
          hint="The first message is personalized per lead from their profile and signals."
          testId="opener-option-ai"
        />
        <ChoiceRow
          first={false}
          selected={opener.mode === 'fixed'}
          onSelect={() => onOpenerMode('fixed')}
          icon={MessageCircle}
          label="Use a fixed opening message"
          hint="One opener for everyone in this campaign."
          testId="opener-option-fixed"
        >
          <AnimatePresence initial={false}>
            {opener.mode === 'fixed' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="overflow-hidden"
              >
                <div
                  className="px-4 pb-4 pl-[52px] flex flex-col gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <textarea
                    data-testid="opener-fixed-text"
                    value={opener.fixedText}
                    onChange={(e) => onOpenerText(e.target.value)}
                    rows={3}
                    placeholder="Write your opener. Use firstName or company to personalize."
                    className="w-full resize-none bg-foreground/[0.04] dark:bg-white/[0.04] rounded-2xl px-3.5 py-3 outline-none text-[13.5px] leading-relaxed text-foreground placeholder:text-foreground/40"
                  />
                  <p className="text-[12px] text-foreground/45 leading-snug">
                    Tip: variables like {'{{firstName}}'} and {'{{company}}'} fill in from each lead.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </ChoiceRow>
      </div>

      {/* Group divider - the two sub-groups sit in ONE card, no nesting. */}
      <div className="h-px bg-foreground/[0.06] dark:bg-white/[0.06]" />

      {/* Conversation replies - review everything, or autopilot. */}
      <div className="px-4 pt-4 pb-1">
        <SubLabel>Conversation replies</SubLabel>
      </div>
      <div data-testid="sending-reply">
        <ChoiceRow
          first
          selected={reply === 'review'}
          onSelect={() => onReply('review')}
          icon={Inbox}
          label="Review everything"
          hint="Every AI reply waits for your approval in the inbox."
          testId="reply-option-review"
        />
        <ChoiceRow
          first={false}
          selected={reply === 'autopilot'}
          onSelect={() => onReply('autopilot')}
          icon={Bot}
          label="Autopilot"
          hint="Replaiy sends replies automatically, and holds back low-confidence ones to your inbox for approval."
          testId="reply-option-autopilot"
        />
      </div>
      </div>

      {/* Quiet note: automated sending honours the work window + safe limits. */}
      <p
        data-testid="sending-note"
        className="px-2 mt-2.5 flex items-start gap-1.5 text-[11.5px] text-foreground/45 leading-snug"
      >
        <ShieldCheck size={13} strokeWidth={1.9} className="shrink-0 mt-[2px] text-foreground/35" />
        Automated sending respects your work window and stays within LinkedIn
        safe limits.
      </p>
    </section>
  );
}

// ── Overview KPI sparkline (pure inline SVG) ────────────────────────
// A tiny single-stroke line of the KPI's ~8-week history, normalised into a
// small viewBox. The path draws itself on mount via framer-motion pathLength
// 0 -> 1 (skipped under reduced motion). No axes, no labels, no chart lib.
// Renders nothing when there is too little history to draw a line.
function KpiSparkline({
  series,
  delay = 0,
  reduced = false,
}: {
  series?: number[];
  delay?: number;
  reduced?: boolean;
}) {
  if (!series || series.length < 2) return null;
  const W = 100;
  const H = 30;
  const PAD = 2;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  const n = series.length;
  const points = series.map((v, i) => {
    const x = PAD + (i / (n - 1)) * (W - PAD * 2);
    const y = H - PAD - ((v - min) / span) * (H - PAD * 2);
    return [x, y] as const;
  });
  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`)
    .join(' ');
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="mt-2.5 w-full"
      height={30}
      aria-hidden="true"
      style={{ display: 'block' }}
    >
      <motion.path
        d={d}
        fill="none"
        stroke={AI_ACCENT}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        initial={reduced ? false : { pathLength: 0, opacity: 0 }}
        animate={reduced ? { pathLength: 1, opacity: 1 } : { pathLength: 1, opacity: 1 }}
        transition={reduced ? { duration: 0 } : { duration: 0.6, ease: 'easeOut', delay }}
      />
    </svg>
  );
}

// ── Overview KPI card ───────────────────────────────────────────────
// One KPI per rp-card: big count-up number, label, self-drawing sparkline,
// and a small week-over-week trend badge (positive = the only blue, with an
// up-arrow; neutral/negative = muted with a down-arrow). Renders gracefully
// when there is no history (no sparkline, no badge), never crashes.
function OverviewKpiCard({
  kpi,
  index,
  reduced,
}: {
  kpi: OverviewKpi;
  index: number;
  reduced: boolean;
}) {
  const animated = useCountUp(kpi.value, 700, !reduced);
  const shown = reduced ? kpi.value : Math.round(animated);
  const display = kpi.isPercent ? `${shown}%` : fmtNum(shown);
  const trend = kpiTrend(kpi.series);
  return (
    <motion.div
      data-testid={`overview-kpi-${kpi.key}`}
      className="rp-card rounded-3xl px-3 py-3.5 lg:px-4 lg:py-[18px] min-w-0 hover-elevate"
      initial={reduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduced ? { duration: 0 } : { duration: 0.32, ease: 'easeOut', delay: index * 0.05 }}
    >
      <div className="flex items-start justify-between gap-2">
        <div
          className="text-[22px] lg:text-[24px] font-semibold tracking-[-0.02em] leading-none tabular-nums text-foreground"
          data-testid={`overview-kpi-value-${kpi.key}`}
        >
          {display}
        </div>
        {trend && (
          <span
            className="shrink-0 inline-flex items-center gap-0.5 text-[11px] font-medium leading-none tabular-nums"
            style={{ color: trend.dir === 'up' ? AI_ACCENT : undefined }}
          >
            {trend.dir === 'up' ? (
              <ArrowUpRight size={12} strokeWidth={2.4} aria-hidden="true" />
            ) : trend.dir === 'down' ? (
              <ArrowDownRight
                size={12}
                strokeWidth={2.4}
                aria-hidden="true"
                className="text-foreground/45"
              />
            ) : null}
            <span className={trend.dir === 'up' ? '' : 'text-foreground/45'}>
              {trend.pct}%
            </span>
          </span>
        )}
      </div>
      <div className="mt-2 text-[12px] lg:text-[12.5px] text-muted-foreground leading-snug">
        {kpi.label}
      </div>
      <KpiSparkline series={kpi.series} delay={reduced ? 0 : 0.15 + index * 0.07} reduced={reduced} />
    </motion.div>
  );
}

// The 4 Overview KPI cards in a responsive grid (2 cols mobile, 4 desktop) —
// same breakpoints as the old CampaignStatStrip, but each KPI is now its own
// rp-card with trend + sparkline (richer than the old flat divided bar).
function OverviewKpiCards({ campaign }: { campaign: Campaign }) {
  const reducedRaw = useReducedMotion();
  const reduced = reducedRaw === true;
  const kpis = overviewKpis(campaign);
  return (
    <section data-testid="overview-kpis">
      {/* Section header so Overview matches the rhythm of every other tab
          (Audience / Sources / Funnel / Goal each carry an AudienceHeader). */}
      <AudienceHeader label="Performance" sub="How this campaign is doing." />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpis.map((kpi, i) => (
          <OverviewKpiCard key={kpi.key} kpi={kpi} index={i} reduced={reduced} />
        ))}
      </div>
    </section>
  );
}

// ── Goal card - what Replaiy steers toward, calm inline auto-save ───
// Persona/knowledge language: ONE always-editable selectable cluster, no
// "Edit" mode and no Save/Cancel. The standard goals carry their own hint, so
// there is no extra description field; only Custom reveals a calm inline field
// to define the outcome yourself. Picks persist on change via updateCampaign.
function GoalCard({ campaign }: { campaign: Campaign }) {
  const { updateCampaign } = useReplaiy();
  // Local mirrors so typing stays smooth; each change persists immediately.
  const [goalType, setGoalType] = useState<CampaignGoalType>(campaign.goalType);
  const [customLabel, setCustomLabel] = useState(campaign.goalLabel ?? '');

  // Keep local state in sync if the campaign changes underneath us.
  useEffect(() => {
    setGoalType(campaign.goalType);
    setCustomLabel(campaign.goalLabel ?? '');
  }, [campaign.id, campaign.goalType, campaign.goalLabel]);

  // Persist a goal-type pick straight away (auto-save, no Save button).
  const pickGoal = (g: CampaignGoalType) => {
    setGoalType(g);
    updateCampaign(campaign.id, {
      goalType: g,
      goalLabel: g === 'custom' ? customLabel.trim() || undefined : undefined,
    });
  };
  // Custom label edits persist on change.
  const editCustomLabel = (v: string) => {
    setCustomLabel(v);
    updateCampaign(campaign.id, {
      goalType: 'custom',
      goalLabel: v.trim() || undefined,
    });
  };

  return (
    <section>
      <AudienceHeader
        label="Goal"
        sub="What the AI drives every conversation toward."
      />

      {/* Goal TYPE - always visible, selectable. The standard goals carry
          their own hint, so there is no extra description field; only Custom
          reveals a calm inline field to define the outcome yourself. */}
      <GoalPicker
        goalType={goalType}
        customLabel={customLabel}
        onPick={pickGoal}
        onCustomLabel={editCustomLabel}
      />
    </section>
  );
}

// ── Funnel ──────────────────────────────────────────────────────────
// A single FLOWING funnel shape that narrows left-to-right (emulating the
// clean dashboard reference - NOT rainbow bars). Each stage: name + count
// on top, drop-off % shown BETWEEN consecutive stages, and one monochrome
// fill that subtly DEEPENS toward the goal. Rendered as a layered SVG so
// the band stays crisp at any width. Responsive: horizontally scrolls on
// mobile rather than squishing.
function FunnelCard({ campaign }: { campaign: Campaign }) {
  const meta = GOAL_META[campaign.goalType];
  const s = campaign.stats;
  const top = Math.max(1, s.found);

  const stages = [
    { key: 'found', label: 'Found', value: s.found },
    { key: 'sent', label: 'Sent', value: s.sent },
    { key: 'accepted', label: 'Accepted', value: s.accepted },
    { key: 'messaged', label: 'Messaged', value: s.messaged },
    { key: 'replied', label: 'Replied', value: s.replied },
    { key: 'goal', label: meta.achievedShort, value: s.goalAchieved },
  ];

  const fmt = (n: number) => n.toLocaleString('en-US');

  // Unique gradient id per instance - the detail renders a desktop AND a
  // mobile copy of this card; a shared id would let the mobile path point at
  // the desktop gradient, which lives in a display:none subtree and never
  // paints. useId keeps each band filled on its own screen.
  const gradId = useId().replace(/:/g, '') + '-funnel';

  // SVG geometry. One continuous band that starts at FULL height (the first
  // stage fills the band, like the reference) and pinches in toward the goal.
  // We map each stage's share-of-top through a gentle curve with a visible
  // floor so later (small) stages never collapse into an empty strip.
  const N = stages.length;
  const W = 720;
  const H = 80; // tighter, denser band - less dead vertical space on desktop, still readable on mobile
  const padX = 6;
  const midY = H / 2;
  const maxHalf = H / 2 - 6;
  const minHalf = maxHalf * 0.16; // floor so the tail stays substantial
  const colW = (W - padX * 2) / N;

  // x at the centre of each column (where the count sits) and at boundaries.
  const colCenter = (i: number) => padX + colW * (i + 0.5);
  // First stage = full height; others scale by share-of-top through a sqrt
  // ease (softer than linear) and are clamped to [minHalf, maxHalf].
  const half = (v: number) => {
    const share = v / top; // 0..1
    const eased = Math.sqrt(share); // gentle: small values stay readable
    return Math.max(minHalf, Math.min(maxHalf, eased * maxHalf));
  };

  // Build a smooth top edge then mirror for the bottom. Sample points at the
  // centre of each column so the wave reads as a funnel that pinches in.
  const pts = stages.map((st, i) => ({ x: colCenter(i), h: half(st.value) }));

  // Smooth path through the top edge (Catmull-Rom-ish via quadratic midpoints).
  function topEdge(): string {
    const first = pts[0];
    let d = `M ${padX} ${midY - first.h} L ${first.x} ${midY - first.h}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const mx = (a.x + b.x) / 2;
      d += ` C ${mx} ${midY - a.h}, ${mx} ${midY - b.h}, ${b.x} ${midY - b.h}`;
    }
    d += ` L ${W - padX} ${midY - pts[pts.length - 1].h}`;
    return d;
  }
  function bottomEdge(): string {
    const last = pts[pts.length - 1];
    let d = ` L ${W - padX} ${midY + last.h}`;
    for (let i = pts.length - 1; i > 0; i--) {
      const a = pts[i];
      const b = pts[i - 1];
      const mx = (a.x + b.x) / 2;
      d += ` C ${mx} ${midY + a.h}, ${mx} ${midY + b.h}, ${b.x} ${midY + b.h}`;
    }
    d += ` L ${padX} ${midY + pts[0].h} Z`;
    return d;
  }
  const bandPath = topEdge() + bottomEdge();

  return (
    <section>
      <AudienceHeader label="Funnel" sub="How leads move toward your goal." />

      <div className="rp-card rounded-3xl px-3 py-3.5 lg:px-4 lg:py-4">
        {/* Funnel fits the card width on every screen - no horizontal scroll.
            Stage typography scales down on mobile so all stages read at once,
            exactly like the reference dashboard. */}
        <div>
          <div>
            {/* Stage headers - name + count, aligned to each column. */}
            <div
              className="grid"
              style={{ gridTemplateColumns: `repeat(${N}, minmax(0, 1fr))` }}
            >
              {stages.map((st, i) => (
                <div
                  key={st.key}
                  data-testid={`funnel-stage-${st.key}`}
                  className="px-0.5 lg:px-1 text-left"
                >
                  <div className="text-[10.5px] lg:text-[12px] font-medium tracking-[-0.005em] text-muted-foreground truncate">
                    {st.label}
                  </div>
                  <div className="mt-0.5 text-[13px] lg:text-[18px] font-semibold tracking-[-0.01em] tabular-nums text-foreground leading-none">
                    {fmt(st.value)}
                  </div>
                </div>
              ))}
            </div>

            {/* The flowing funnel band. */}
            <div className="relative mt-3">
              <svg
                viewBox={`0 0 ${W} ${H}`}
                width="100%"
                height={H}
                preserveAspectRatio="none"
                role="img"
                aria-label="Funnel from found to goal"
              >
                <defs>
                  {/* ONE hue: a soft accent tint that deepens left→right.
                      Built from --ai-accent at rising alpha - calm, not loud. */}
                  <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#2F6BFF" stopOpacity="0.14" />
                    <stop offset="45%" stopColor="#2F6BFF" stopOpacity="0.30" />
                    <stop offset="80%" stopColor="#2F6BFF" stopOpacity="0.52" />
                    <stop offset="100%" stopColor="#2F6BFF" stopOpacity="0.78" />
                  </linearGradient>
                </defs>
                {/* Column separators - faint, so eyes can map count→band. */}
                {stages.map((_, i) =>
                  i === 0 ? null : (
                    <line
                      key={i}
                      x1={padX + colW * i}
                      y1={6}
                      x2={padX + colW * i}
                      y2={H - 6}
                      stroke="hsl(var(--foreground) / 0.05)"
                      strokeWidth={1}
                    />
                  ),
                )}
                <path d={bandPath} fill={`url(#${gradId})`} />
              </svg>

              {/* Drop-off % chips, centred on each boundary between stages. */}
              <div className="pointer-events-none absolute inset-0">
                {stages.slice(0, -1).map((st, i) => {
                  const next = stages[i + 1];
                  const drop =
                    st.value === 0
                      ? 0
                      : Math.round(((next.value - st.value) / st.value) * 100);
                  const leftPct = ((i + 1) / N) * 100;
                  return (
                    <div
                      key={st.key}
                      data-testid={`funnel-drop-${st.key}`}
                      className="absolute -translate-x-1/2 -translate-y-1/2"
                      style={{ left: `${leftPct}%`, top: '50%' }}
                    >
                      <span className="glass-pill pill inline-flex items-center gap-1 h-[22px] px-2 text-[11px] font-medium tabular-nums text-foreground/75 whitespace-nowrap">
                        {drop}% →
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// Flow card - the action sequence Replaiy runs per lead, now editable in a
// LIMITED way. Step TYPE / order / add / delete are NOT editable yet (a later
// phase). Editable per step: (1) the TIMING label (tap the timing pill to edit
// it inline), and (2) for steps that SEND text (connect opener, message,
// follow_up) the MESSAGE COPY (tap the step to expand an editable textarea).
//
// Cross-link: the connect step is the OPENER, so it respects Sending ->
// Opening message. When opener mode is "ai" it reads "Replaiy personalizes
// this" and is NOT a free-text field; when "fixed" it shows + edits the one
// fixed opener (kept in sync with the Sending section through the parent).
// Message / Follow-up stay editable regardless. All edits are local state.
function FlowCard({
  campaign,
  openerMode,
  openerFixedText,
  onOpenerText,
}: {
  campaign: Campaign;
  openerMode: 'ai' | 'fixed';
  openerFixedText: string;
  onOpenerText: (text: string) => void;
}) {
  // Local, optimistic copy of the flow steps (timing + per-step text).
  const [steps, setSteps] = useState<FlowStep[]>(
    () => (campaign.flow ?? DEFAULT_FLOW).map((s) => ({ ...s })),
  );
  // Which step is expanded for editing (single open at a time), and which
  // step's timing is in inline-edit mode.
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [timingEditIdx, setTimingEditIdx] = useState<number | null>(null);

  const setTiming = (i: number, value: string) =>
    setSteps((prev) => prev.map((s, j) => (j === i ? { ...s, timingLabel: value } : s)));
  const setText = (i: number, value: string) =>
    setSteps((prev) => prev.map((s, j) => (j === i ? { ...s, text: value } : s)));

  return (
    <section>
      <AudienceHeader
        label="Flow"
        sub="The steps Replaiy runs for each lead. Tap a step to edit its timing and message."
        trailing={
          <span className="glass-pill pill inline-flex items-center h-[22px] px-2.5 text-[11px] font-medium text-foreground/55 whitespace-nowrap">
            {steps.length} steps
          </span>
        }
      />
      <div className="rp-card rounded-3xl px-4 py-3 lg:px-5 lg:py-3.5">
        <div className="flex flex-col">
          {steps.map((step, i) => {
            const meta = FLOW_STEP_META[step.kind];
            const Icon = FLOW_ICONS[step.kind];
            const last = i === steps.length - 1;
            const timing = step.timingLabel ?? step.delay ?? '';
            const isConnect = step.kind === 'connect';
            // The connect opener is AI-personalized (not editable here) when
            // Sending opener mode is "ai".
            const aiOpener = isConnect && openerMode === 'ai';
            // Does this step send editable text? connect only when fixed.
            const sendsText =
              FLOW_KINDS_WITH_TEXT.includes(step.kind) && !aiOpener;
            const expandable = sendsText || aiOpener;
            const open = openIdx === i;
            const editingTiming = timingEditIdx === i;

            return (
              <div
                key={`${step.kind}-${i}`}
                data-testid={`flow-step-${step.kind}-${i}`}
                className="flex items-start gap-3 py-2.5"
              >
                {/* Icon rail + connector line. */}
                <div className="relative flex flex-col items-center shrink-0">
                  <div className="h-8 w-8 rounded-xl bg-foreground/[0.06] dark:bg-white/[0.08] flex items-center justify-center">
                    <Icon size={15} strokeWidth={1.9} className="text-foreground/65" />
                  </div>
                  {!last && (
                    <span
                      aria-hidden="true"
                      className="absolute top-8 h-[calc(100%+4px)] w-px bg-foreground/[0.10] dark:bg-white/[0.12]"
                    />
                  )}
                </div>

                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex items-center justify-between gap-2">
                    {/* Label - taps to expand the editable copy (when the step
                        has anything to reveal). */}
                    {expandable ? (
                      <button
                        type="button"
                        data-testid={`flow-step-toggle-${i}`}
                        onClick={() => setOpenIdx(open ? null : i)}
                        aria-expanded={open}
                        className="group min-w-0 flex items-center gap-1.5 text-left rounded-lg -mx-1 px-1 hover-elevate active-elevate-2"
                      >
                        <span className="text-[14px] font-semibold tracking-[-0.005em] text-foreground truncate">
                          {meta.label}
                        </span>
                        <motion.span
                          animate={{ rotate: open ? 90 : 0 }}
                          transition={APPLE_SPRING}
                          className="inline-flex shrink-0"
                        >
                          <ChevronRight
                            size={14}
                            strokeWidth={2.2}
                            className="text-foreground/35 group-hover:text-foreground/60 transition-colors"
                          />
                        </motion.span>
                      </button>
                    ) : (
                      <span className="text-[14px] font-semibold tracking-[-0.005em] text-foreground truncate">
                        {meta.label}
                      </span>
                    )}

                    {/* Editable timing - tap the pill to edit it inline. */}
                    {editingTiming ? (
                      <input
                        autoFocus
                        data-testid={`flow-timing-input-${i}`}
                        value={timing}
                        onChange={(e) => setTiming(i, e.target.value)}
                        onBlur={() => setTimingEditIdx(null)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === 'Escape') setTimingEditIdx(null);
                        }}
                        placeholder="e.g. Day 2"
                        className="shrink-0 w-[96px] h-[24px] text-center bg-foreground/[0.04] dark:bg-white/[0.04] rounded-full px-2 outline-none text-[11.5px] font-medium text-foreground placeholder:text-foreground/40"
                      />
                    ) : (
                      <button
                        type="button"
                        data-testid={`flow-timing-${i}`}
                        onClick={() => setTimingEditIdx(i)}
                        className="shrink-0 glass-pill pill inline-flex items-center gap-1 h-[22px] px-2 text-[11px] font-medium tabular-nums text-foreground/70 whitespace-nowrap hover-elevate active-elevate-2"
                      >
                        {timing || 'Set timing'}
                        <Pencil size={10} strokeWidth={2} className="text-foreground/35" />
                      </button>
                    )}
                  </div>

                  <p className="mt-0.5 text-[12.5px] text-muted-foreground leading-snug">
                    {meta.hint}
                  </p>

                  {/* Expanded editor: AI-personalized opener note, OR an
                      editable message textarea for text-sending steps. */}
                  <AnimatePresence initial={false}>
                    {open && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                        className="overflow-hidden"
                      >
                        {aiOpener ? (
                          <div
                            data-testid={`flow-opener-ai-${i}`}
                            className="mt-2.5 flex items-start gap-2 rounded-2xl bg-foreground/[0.04] dark:bg-white/[0.04] px-3.5 py-3"
                          >
                            <Wand2
                              size={14}
                              strokeWidth={1.9}
                              style={{ color: AI_ACCENT }}
                              className="shrink-0 mt-[1px]"
                            />
                            <p className="text-[12.5px] text-foreground/60 leading-snug">
                              Replaiy personalizes this opener per lead. To write a
                              single fixed opener, switch Opening message in Sending.
                            </p>
                          </div>
                        ) : (
                          <div className="mt-2.5 flex flex-col gap-1.5">
                            <textarea
                              data-testid={`flow-step-text-${i}`}
                              value={isConnect ? openerFixedText : step.text ?? ''}
                              onChange={(e) =>
                                isConnect ? onOpenerText(e.target.value) : setText(i, e.target.value)
                              }
                              rows={3}
                              placeholder="Write this message. Use firstName or company to personalize."
                              className="w-full resize-none bg-foreground/[0.04] dark:bg-white/[0.04] rounded-2xl px-3.5 py-3 outline-none text-[13.5px] leading-relaxed text-foreground placeholder:text-foreground/40"
                            />
                            {isConnect && (
                              <p className="text-[12px] text-foreground/45 leading-snug">
                                This is your fixed opener, shared with the Sending
                                section.
                              </p>
                            )}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── Team card - which workspace seats run this campaign ─────────────
// Shows assigned members as avatar + name/role rows. A small "+ Add"
// opens an inline glass list of all workspace members to toggle on/off.
// Persists via updateCampaign(id, { memberIds }).
function TeamCard({ campaign }: { campaign: Campaign }) {
  const { updateCampaign } = useReplaiy();
  const [picking, setPicking] = useState(false);

  const assigned = WORKSPACE_MEMBERS.filter((m) =>
    campaign.memberIds.includes(m.id),
  );

  const toggleMember = (id: string) => {
    const next = campaign.memberIds.includes(id)
      ? campaign.memberIds.filter((x) => x !== id)
      : [...campaign.memberIds, id];
    updateCampaign(campaign.id, { memberIds: next });
  };

  return (
    <section>
      <AudienceHeader
        label="Running from"
        sub="The teammates whose agents run this campaign."
        trailing={
          <button
            type="button"
            data-testid="button-toggle-member-picker"
            onClick={() => setPicking((v) => !v)}
            aria-expanded={picking}
            className="glass-pill pill inline-flex items-center gap-1.5 h-[26px] pl-2 pr-2.5 text-[12px] font-medium text-foreground/75 hover-elevate active-elevate-2"
          >
            {picking ? (
              <X size={12} strokeWidth={2.2} className="text-foreground/55" />
            ) : (
              <Plus size={12} strokeWidth={2.2} className="text-foreground/55" />
            )}
            {picking ? 'Done' : 'Add'}
          </button>
        }
      />

      <div className="rp-card rounded-3xl px-2 py-1.5">
        {assigned.length === 0 && !picking ? (
          <div className="px-2 py-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-foreground/[0.06] dark:bg-white/[0.08] flex items-center justify-center shrink-0">
              <Users size={16} strokeWidth={1.8} className="text-foreground/55" />
            </div>
            <p className="text-[13px] text-muted-foreground leading-snug">
              No seats assigned yet. Add a teammate to run this campaign.
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            {assigned.map((m, i) => (
              <div key={m.id}>
                {i > 0 && (
                  <div className="ml-[52px] h-px bg-foreground/[0.06] dark:bg-white/[0.06]" />
                )}
                <div
                  data-testid={`member-assigned-${m.id}`}
                  className="flex items-center gap-3 px-2 py-2"
                >
                  <ReplaiyAvatar name={m.name} src={m.avatar} size={36} className="shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-semibold tracking-[-0.005em] text-foreground truncate">
                      {m.name}
                    </div>
                    <div className="text-[12px] text-muted-foreground truncate">{m.role}</div>
                  </div>
                  {m.personaName && (
                    <span
                      data-testid={`member-persona-${m.id}`}
                      className="shrink-0 glass-pill pill inline-flex items-center gap-1.5 h-[24px] px-2.5 text-[11.5px] font-medium text-foreground/65 whitespace-nowrap"
                    >
                      <Sparkles size={11} strokeWidth={1.9} style={{ color: 'var(--ai-accent)' }} />
                      {m.personaName}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Inline picker - all workspace members, toggleable. */}
      <AnimatePresence initial={false}>
        {picking && (
          <motion.div
            initial={{ opacity: 0, y: 4, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -4, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="mt-2 rp-card rounded-3xl px-2 py-1.5">
              <div className="flex flex-col">
                {WORKSPACE_MEMBERS.map((m, i) => {
                  const on = campaign.memberIds.includes(m.id);
                  return (
                    <div key={m.id}>
                      {i > 0 && (
                        <div className="ml-[52px] h-px bg-foreground/[0.06] dark:bg-white/[0.06]" />
                      )}
                      <button
                        type="button"
                        data-testid={`member-toggle-${m.id}`}
                        onClick={() => toggleMember(m.id)}
                        aria-pressed={on}
                        className={`w-full flex items-center gap-3 px-2 py-2 rounded-2xl text-left hover-elevate active-elevate-2 ${
                          on ? 'bg-foreground/[0.05] dark:bg-white/[0.06]' : ''
                        }`}
                      >
                        <ReplaiyAvatar name={m.name} src={m.avatar} size={36} className="shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="text-[13.5px] font-semibold tracking-[-0.005em] text-foreground truncate">
                            {m.name}
                          </div>
                          <div className="text-[12px] text-muted-foreground truncate">{m.role}</div>
                        </div>
                        {/* Quiet selection mark - small muted check, no filled circle. */}
                        {on && (
                          <Check size={16} strokeWidth={2.4} className="shrink-0 text-foreground/70" />
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

// ── "Your AI" Overview hero ─────────────────────────────────────────
// The summary hero, MIRRORING the inbox 3rd-column "THE AI, TALKING" block
// (LeadContextPanel ~lines 925-986) 1:1: an rp-card tinted with the active
// persona colour via --ai-accent, a 36x36 mascot avatar with a pulsing
// radial-gradient podium glow + a gently floating mascot, "Your AI" + a short
// phase label, a first-person verdict-and-recommendation read, then a divider
// and a compact status strip (goal pill + AI_ACCENT progress bar + stage).
// Persona is read EXACTLY like LeadContextPanel. Motion respects
// prefers-reduced-motion (static mascot + glow when reduced).
function CampaignAiHero({ campaign }: { campaign: Campaign }) {
  const { persona: livePersona } = useReplaiy();
  const persona = activePersona(livePersona); // { color, mascot }
  const reduced = useReducedMotion() === true;

  const read = campaignAiRead(campaign);
  const phase = campaignPhaseLabel(campaign);

  return (
    <div
      data-testid="overview-ai-hero"
      className="rp-card rounded-[20px] px-4 pt-3.5 pb-3.5"
      style={{ ['--ai-accent' as never]: persona.color }}
    >
      <div className="flex items-center gap-2.5 mb-3">
        <div className="relative w-[36px] h-[36px] shrink-0 flex items-center justify-center">
          {/* Soft persona-colour podium behind the mascot. */}
          <motion.span
            aria-hidden
            className="absolute inset-[-2px] rounded-full"
            style={{
              background: `radial-gradient(circle at 50% 50%, ${persona.color}, transparent 68%)`,
              filter: 'blur(7px)',
              opacity: 0.5,
            }}
            animate={reduced ? undefined : { opacity: [0.42, 0.58, 0.42] }}
            transition={
              reduced
                ? undefined
                : { duration: 3.4, repeat: Infinity, ease: 'easeInOut' }
            }
          />
          <motion.img
            src={persona.mascot}
            alt=""
            aria-hidden
            draggable={false}
            className="relative w-[36px] h-[36px] object-contain select-none pointer-events-none"
            animate={reduced ? undefined : { y: [0, -2.5, 0] }}
            transition={
              reduced
                ? undefined
                : { duration: 3.6, repeat: Infinity, ease: 'easeInOut' }
            }
          />
        </div>
        <div className="min-w-0 leading-tight">
          <div className="text-[13px] font-semibold tracking-[-0.01em] text-foreground">
            Your AI
          </div>
          <div className="text-[11.5px] text-foreground/45 mt-0.5">{phase}</div>
        </div>
      </div>

      <p
        data-testid="overview-ai-read"
        className="text-[13.5px] leading-[1.55] text-foreground/80 m-0"
      >
        {read}
      </p>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// Detail view
function CampaignDetailView({ campaign }: { campaign: Campaign }) {
  const [, navigate] = useLocation();
  const { updateCampaign } = useReplaiy();
  const isOn = campaign.status === 'active';

  const toggle = (on: boolean) =>
    updateCampaign(campaign.id, { status: on ? 'active' : 'paused' });

  // ── Sending behaviour - lifted here so the opener choice cross-links
  //    into the Flow's opener step. Local / optimistic this round. ─────
  const [openerMode, setOpenerMode] = useState<'ai' | 'fixed'>(
    campaign.opener?.mode ?? 'ai',
  );
  const [openerFixedText, setOpenerFixedText] = useState(
    campaign.opener?.fixedText ?? '',
  );
  const [replyMode, setReplyMode] = useState<'review' | 'autopilot'>(
    campaign.replyMode ?? 'review',
  );

  // ── Tabs - split the (previously endless) scroll into four scannable
  //    tabs, using the SAME VadikLiquidSwitcher (text variant) the feed and
  //    lead panel use. Default Overview. Local state only. ──────────────
  // When we return here straight after a CSV import, open on Audience so the
  // "{N} leads imported" confirmation is visible (the import lives there),
  // instead of dumping the user back on Overview.
  const [tab, setTab] = useState<CampaignTab>(() => {
    const r = getImportResult();
    return r && r.campaignId === campaign.id ? 'audience' : 'overview';
  });

  // ── Inline editable name ──────────────────────────────────────────
  // Calm Persona-style: the name is ALWAYS a direct inline-editable field
  // (an <input> styled exactly like the heading) — no pencil, no edit mode.
  // The OverflowMenu "Rename" entry simply focuses this input.
  const [draftName, setDraftName] = useState(campaign.name);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Keep the local draft in sync if the campaign name changes elsewhere
  // (e.g. a different campaign loaded into the same view).
  useEffect(() => {
    setDraftName(campaign.name);
  }, [campaign.name]);

  const beginNameEdit = () => {
    nameInputRef.current?.focus();
    nameInputRef.current?.select();
  };
  const commitName = () => {
    const next = draftName.trim();
    if (next.length > 0 && next !== campaign.name) {
      updateCampaign(campaign.id, { name: next });
    } else if (next.length === 0) {
      // Empty is not a valid name — restore the current name.
      setDraftName(campaign.name);
    }
  };
  const cancelName = () => {
    setDraftName(campaign.name);
    nameInputRef.current?.blur();
  };

  // Mobile chrome - back arrow (left) + campaign name (center) + overflow.
  useMobileTopChromeSlot(
    useMemo(
      () => ({
        priority: 100,
        leftSlot: (
          <ActionPill
            testId="button-back"
            label="Back"
            onClick={() => navigate('/campaigns')}
          >
            <ArrowLeft size={20} strokeWidth={1.7} className="text-icon" />
          </ActionPill>
        ),
        // v-tabs-in-topbar — Name no longer lives in the center chrome pill; it
        // moves into the body as an inline-editable field below the tabs. The
        // mobile top chrome keeps only back (left) + toggle/overflow (right);
        // the tab switcher sits just under the chrome at the top of the body.
        rightSlot: (
          <div className="flex items-center gap-1.5">
            <span
              data-testid="campaign-status-label-mobile"
              className="text-[12px] font-medium text-foreground/65"
            >
              {isOn ? 'Active' : 'Paused'}
            </span>
            <GlassToggle
              on={isOn}
              onChange={toggle}
              testId="campaign-toggle-detail-mobile"
              ariaLabel={`${isOn ? 'Pause' : 'Activate'} ${campaign.name}`}
            />
            <OverflowMenu campaign={campaign} onRename={beginNameEdit} />
          </div>
        ),
      }),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [campaign.id, campaign.name, isOn, draftName],
    ),
  );

  // Editable name field (shared by desktop header + mobile body heading).
  // Calm Persona/knowledge style: ALWAYS a bare <input> styled to look exactly
  // like the heading (transparent, no border until focus, same size/weight).
  // Click to place the cursor and type; commit on blur/Enter, cancel on Esc.
  // No pencil affordance. A very subtle hover-elevate hints it is editable.
  // Plain render helper (NOT a nested component) so the <input> keeps its
  // identity across keystroke re-renders and never loses focus.
  const renderNameField = (size: 'lg') => (
    <input
      ref={nameInputRef}
      data-testid="input-edit-name"
      value={draftName}
      onChange={(e) => setDraftName(e.target.value)}
      onBlur={commitName}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') cancelName();
      }}
      aria-label="Campaign name"
      className={`w-full max-w-full bg-transparent outline-none rounded-lg px-1 -mx-1 hover-elevate text-foreground font-semibold tracking-[-0.02em] ${
        size === 'lg' ? 'text-[20px]' : 'text-[22px]'
      }`}
    />
  );

  // ── Overview hero ─────────────────────────────────────────────────
  // A crafted (not bare) header for the Overview tab: the large editable
  // name REUSES the shared `renderNameField('lg')` inline-edit (same testids
  // / commit logic, nothing rebuilt), with a quiet status line beneath it
  // ("Active, started 12 days ago"). No card border, no middot, no em-dash -
  // just the polished hero treatment the user asked for.
  const overviewHero = (
    <section data-testid="overview-hero">
      <div className="min-w-0">{renderNameField('lg')}</div>
      <p
        data-testid="overview-hero-status"
        className="mt-1.5 px-1 text-[12.5px] leading-snug text-foreground/45"
      >
        {heroStatusLine(campaign)}
      </p>
    </section>
  );

  // Per-tab content. Each tab shows ONLY its own sections so the screen stays
  // short and scannable instead of one endless scroll. Sections keep all their
  // existing content + functionality; they are only regrouped under tabs.
  const tabContent: Record<CampaignTab, React.ReactNode> = {
    // Overview - the crafted hero (name + status), then the 4 rich KPI cards
    // (the headline data, now with per-KPI trend + sparkline + count-up), the
    // funnel as the heart, and the goal last. No nav tab-links, no duplicate
    // momentum line - those added noise without adding value.
    overview: (
      <>
        {overviewHero}
        <CampaignAiHero campaign={campaign} />
        <OverviewKpiCards campaign={campaign} />
        <FunnelCard campaign={campaign} />
        <GoalCard campaign={campaign} />
      </>
    ),
    // Audience - who this campaign reaches (pool + sources + ICP + match
    // quality + skip-the-wrong-people, all inside AudienceSection).
    audience: <AudienceSection campaign={campaign} />,
    // Outreach - how it reaches out and replies.
    outreach: (
      <>
        <FlowCard
          campaign={campaign}
          openerMode={openerMode}
          openerFixedText={openerFixedText}
          onOpenerText={setOpenerFixedText}
        />
        <SendingSection
          opener={{ mode: openerMode, fixedText: openerFixedText }}
          onOpenerMode={setOpenerMode}
          onOpenerText={setOpenerFixedText}
          reply={replyMode}
          onReply={setReplyMode}
        />
        <TimingSection campaign={campaign} />
        <LanguageSection campaign={campaign} />
      </>
    ),
    // Team - which seats run this campaign.
    team: <TeamCard campaign={campaign} />,
  };

  const body = (
    <div className="mx-auto w-full" style={{ maxWidth: CAMPAIGN_COLUMN_MAX }}>
      {/* v-tabs-in-topbar — On DESKTOP the tab switcher lives in the top bar
          (top-left of the pane), so the body does NOT repeat it. On MOBILE the
          top chrome is already full (back + toggle + overflow), so the tabs sit
          just under the chrome at the top of the body — same shared
          VadikLiquidSwitcher (text variant) the feed and lead panel use. */}
      <div className="lg:hidden flex justify-center w-full mb-5">
        <VadikLiquidSwitcher<CampaignTab>
          testId="campaign-tab"
          variant="text"
          scale={0.78}
          textPaddingX={10}
          value={tab}
          onChange={setTab}
          segments={CAMPAIGN_TAB_SEGMENTS}
        />
      </div>

      {/* The campaign name is the SINGLE name treatment for the whole detail
          and now lives ONLY in the Overview hero (large, inline-editable, same
          renderNameField + testids). The other tabs (audience / outreach /
          team) drop the repeated name field entirely - the user already knows
          which campaign they are in, and each of those tabs carries its own
          AudienceHeader section titles, so they read clean without it. */}

      {/* Only the active tab's sections render - short, scannable, no endless
          scroll. A light cross-fade on switch, same feel as the lead panel. */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
          className="flex flex-col gap-6 md:gap-7"
        >
          {tabContent[tab]}
        </motion.div>
      </AnimatePresence>
    </div>
  );

  return (
    <div className="flex flex-col h-full min-h-0 relative">
      {/* DESKTOP floating top bar - tab switcher (top-left) + switch +
          overflow (right), on the same top:12 baseline as ConversationDetail.
          v-tabs-in-topbar: the tabs now live HERE, in the top bar, instead of
          below a title; the campaign name moved into the body as an editable
          field. */}
      <div
        data-testid="campaign-desktop-header"
        className="hidden lg:block absolute top-3 inset-x-0 z-30 pointer-events-none px-4 lg:px-6"
      >
        {/* v-grid-align — The top bar's content sits in the SAME centered
            column as the body: an `mx-auto` wrapper with the SAME max-width
            inside the SAME `px-4 lg:px-6` padding (applied on the parent). This
            makes the tabs (left) line up exactly with the campaign name and the
            content cards below, and pins the Active toggle + overflow to that
            column's right edge — one shared grid, like the conversation
            toolbar. The whole row is vertically centered on a single h-[52px]
            baseline so no element floats at a different height. */}
        <div
          className="mx-auto flex items-center justify-between gap-3 h-[52px]"
          style={{ maxWidth: CAMPAIGN_COLUMN_MAX }}
        >
          <div className="pointer-events-auto min-w-0 flex items-center">
            <VadikLiquidSwitcher<CampaignTab>
              testId="campaign-tab-desktop"
              variant="text"
              scale={0.78}
              textPaddingX={10}
              value={tab}
              onChange={setTab}
              segments={CAMPAIGN_TAB_SEGMENTS}
            />
          </div>
          <div className="pointer-events-auto flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2">
              {/* Small text label so the toggle has clear context. */}
              <span
                data-testid="campaign-status-label"
                className="text-[13px] font-medium text-foreground/65"
              >
                {isOn ? 'Active' : 'Paused'}
              </span>
              <GlassToggle
                on={isOn}
                onChange={toggle}
                testId="campaign-toggle-detail"
                ariaLabel={`${isOn ? 'Pause' : 'Activate'} ${campaign.name}`}
              />
            </div>
            <OverflowMenu campaign={campaign} onRename={beginNameEdit} />
          </div>
        </div>
      </div>

      {/* DESKTOP scroll container — paddingTop clears the floating top bar AND
          matches the conversation pane's first-content height (toolbar top-3 =
          12px + 52px pill + ~22px breathing room ≈ 86px) so the campaign detail
          starts at the SAME vertical position as the conversation content. The
          `px-4 lg:px-6` here mirrors the top bar's padding, so the centered
          column lines up exactly between the bar and the body. */}
      <div
        data-testid="campaign-detail-scroll"
        className="hidden lg:flex flex-col flex-1 min-h-0 overflow-y-auto no-scrollbar pb-10"
        style={{ paddingTop: 86 }}
      >
        <div className="flex-1 px-4 lg:px-6">{body}</div>
      </div>

      {/* MOBILE scroll container - content sits under the floating chrome. */}
      <div
        className="flex lg:hidden flex-col flex-1 min-h-0 overflow-y-auto no-scrollbar px-4 pb-32"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 80px)' }}
      >
        {body}
      </div>

      {/* DESKTOP top frosting veil — same .mobile-chrome-veil recipe as the
          engagers/profile push-ins, so detail content frosts softly behind the
          floating top bar instead of scrolling through sharp (the "410 in pool"
          leak). MUST be the LAST CHILD of this stable, non-transformed pane
          container: backdrop-filter only blurs what paints BEHIND it in DOM
          order, and a transform on any ancestor would break the filter context
          (see ConversationTimeline note) — this container has no transform, so
          the blur renders. z-20 sits ABOVE the scroll content but BELOW the
          z-30 top-bar pills/toggle, and pointer-events-none lets scroll + clicks
          pass through so the tabs/toggle/••• stay interactive. h-[86px] matches
          the desktop scroll container's paddingTop so the fade ends cleanly just
          below the top-bar pill row. Desktop only (hidden lg:block) — mobile
          relies on the floating glass chrome pills. */}
      <div
        aria-hidden
        className="hidden lg:block absolute inset-x-0 top-0 z-20 h-[86px] mobile-chrome-veil pointer-events-none"
      />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// Create view - goal picker is the centrepiece.
function CampaignCreate() {
  const [, navigate] = useLocation();
  const { addCampaign } = useReplaiy();
  const [name, setName] = useState('');
  const [goalType, setGoalType] = useState<CampaignGoalType>('meeting');
  const [customLabel, setCustomLabel] = useState('');
  const [goalDescription, setGoalDescription] = useState('');

  const canCreate =
    name.trim().length > 0 &&
    (goalType !== 'custom' || customLabel.trim().length > 0);

  const create = () => {
    if (!canCreate) return;
    const id = `c-${Date.now().toString(36)}`;
    const campaign: Campaign = {
      id,
      name: name.trim(),
      goalType,
      goalLabel: goalType === 'custom' ? customLabel.trim() : undefined,
      goalDescription: goalDescription.trim() || undefined,
      status: 'draft',
      memberIds: [],
      // flow omitted → falls back to DEFAULT_FLOW.
      stats: { found: 0, sent: 0, accepted: 0, messaged: 0, replied: 0, goalAchieved: 0 },
      createdAt: new Date().toISOString(),
    };
    addCampaign(campaign);
    navigate(`/campaigns/${id}`);
  };

  // Mobile chrome - back arrow → /campaigns.
  useMobileTopChromeSlot(
    useMemo(
      () => ({
        priority: 100,
        leftSlot: (
          <ActionPill
            testId="button-back"
            label="Back"
            onClick={() => navigate('/campaigns')}
          >
            <ArrowLeft size={20} strokeWidth={1.7} className="text-icon" />
          </ActionPill>
        ),
        togglePill: (
          <div className="inline-flex items-center px-1 h-[52px]">
            <span className="text-[14px] font-semibold tracking-[-0.005em] text-foreground">
              New campaign
            </span>
          </div>
        ),
      }),
      [navigate],
    ),
  );

  const body = (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="max-w-2xl mx-auto w-full flex flex-col gap-6"
    >
      {/* Heading */}
      <div className="px-1">
        <h1 className="text-[24px] font-semibold tracking-[-0.02em] leading-tight">
          New campaign
        </h1>
        <p className="text-[14px] text-muted-foreground mt-1.5 leading-snug">
          Name it, then pick the outcome Replaiy should steer every conversation toward.
        </p>
      </div>

      {/* Name */}
      <section>
        <SectionLabel>Name</SectionLabel>
        <div className="rp-card rounded-3xl px-4 py-3">
          <input
            data-testid="input-campaign-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Q3, Series-B founders"
            className="w-full bg-transparent outline-none text-[16px] text-foreground placeholder:text-muted-foreground"
          />
        </div>
      </section>

      {/* Goal picker - the centrepiece (shared component). */}
      <section>
        <SectionLabel>Goal</SectionLabel>
        <GoalPicker
          goalType={goalType}
          customLabel={customLabel}
          onPick={setGoalType}
          onCustomLabel={setCustomLabel}
        />
      </section>

      {/* Goal description - short, human line shown as the row subtitle. */}
      <section>
        <div className="flex items-baseline justify-between gap-2 mb-1 [&>*]:mb-0">
          <SectionLabel>Description</SectionLabel>
          <span className="px-2 text-[11.5px] text-foreground/45">Optional</span>
        </div>
        <div className="rp-card rounded-3xl px-4 py-3">
          <input
            data-testid="input-campaign-description"
            value={goalDescription}
            onChange={(e) => setGoalDescription(e.target.value)}
            placeholder="e.g. Book a 20-min intro call about reply quality"
            className="w-full bg-transparent outline-none text-[15px] text-foreground placeholder:text-muted-foreground"
          />
        </div>
      </section>

      {/* Actions */}
      <div className="flex items-center gap-2 px-1 pt-1">
        <button
          type="button"
          data-testid="button-create-campaign"
          onClick={create}
          disabled={!canCreate}
          className="glass-pill pill inline-flex items-center gap-1.5 h-[40px] px-5 text-[14px] font-semibold text-white hover-elevate active-elevate-2 disabled:opacity-40 disabled:pointer-events-none"
          style={{ background: 'var(--ai-accent)' }}
        >
          Create campaign
        </button>
        <button
          type="button"
          data-testid="button-cancel-campaign"
          onClick={() => navigate('/campaigns')}
          className="glass-pill pill inline-flex items-center h-[40px] px-4 text-[14px] font-medium text-foreground/80 hover-elevate active-elevate-2"
        >
          Cancel
        </button>
      </div>
    </motion.div>
  );

  return (
    <div className="flex flex-col h-full min-h-0 relative">
      {/* DESKTOP scroll container. */}
      <div
        data-testid="campaign-create-scroll"
        className="hidden lg:flex flex-col flex-1 min-h-0 overflow-y-auto no-scrollbar pb-10"
        style={{ paddingTop: 32 }}
      >
        <div className="flex-1 px-4 lg:px-6">{body}</div>
      </div>

      {/* MOBILE scroll container. */}
      <div
        className="flex lg:hidden flex-col flex-1 min-h-0 overflow-y-auto no-scrollbar px-4 pb-32"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 80px)' }}
      >
        {body}
      </div>
    </div>
  );
}
