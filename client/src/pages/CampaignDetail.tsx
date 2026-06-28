// Replaiy — Campaign detail + create pane (right column of the split view).
//
// Mirrors ConversationDetail.tsx structure exactly:
//   • A floating desktop pill row at top-3 (name + on/off + ... overflow).
//   • Separate desktop / mobile scroll containers (max-w-2xl mx-auto content).
//   • Mobile top-chrome registered via useMobileTopChromeSlot (priority 100):
//     leftSlot = ArrowLeft ActionPill → navigate('/campaigns').
//   • Surfaces are real design-system classes only (.rp-card, .glass-pill,
//     .glass-strong). Blue (var(--ai-accent)) is a RARE micro-accent only —
//     not the fill of large controls. Delete is the single allowed exception
//     using hsl(var(--destructive)).
//
// The detail is ONLY about (1) how the campaign performs — the funnel + key
// metrics, and (2) finetuning it — editable name + editable goal — and (3)
// management (on/off + delete). There is no conversations/messages
// block here: threads live in the Inbox, not in Campaigns.
//
// Route dispatch: id 'new' → create view; existing id → detail; bare
// /campaigns → calm empty state in the right pane (desktop only).

import { useMemo, useState, useRef, useEffect, useId } from 'react';
import { useLocation, useParams } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
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
  SlidersHorizontal,
  ShieldCheck,
  Copy,
} from 'lucide-react';
import { useReplaiy } from '@/state/ReplaiyContext';
import {
  GOAL_META,
  WORKSPACE_MEMBERS,
  DEFAULT_FLOW,
  FLOW_STEP_META,
  LEAD_SOURCE_META,
  WARMTH_META,
  type Campaign,
  type CampaignAudience,
  type CampaignGoalType,
  type FlowStepKind,
  type LeadSourceKind,
  type LeadWarmth,
} from '@/data/mockCampaigns';
import { ReplaiyAvatar } from '@/components/Avatar';
import { ActionPill } from '@/components/ConversationDetailToolbar';
import { useMobileTopChromeSlot } from '@/components/MobileTopChrome';
import { GlassToggle } from '@/components/GlassToggle';
import { conversionPct, replyRatePct } from '@/components/CampaignsList';
import { ReplaiyLogo } from '@/components/Logo';
import { APPLE_SPRING } from '@/lib/motion';

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

// ====================================================================
// AUDIENCE — who this campaign reaches. Rendered at the TOP of the detail.
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

// ── Section header — the EXACT FineTuneSection pattern (label + sub) ─
// A trailing slot keeps an optional quiet affordance (Edit / template) on the
// header baseline, like the Goal card's Edit pill.
function AudienceHeader({
  label,
  sub,
  trailing,
}: {
  label: string;
  sub: string;
  trailing?: React.ReactNode;
}) {
  return (
    <>
      <div className="px-2 mb-1 flex items-center justify-between gap-3">
        <span className="text-[12.5px] font-semibold tracking-[-0.005em] text-foreground">
          {label}
        </span>
        {trailing}
      </div>
      <p className="px-2 text-[11.5px] leading-[1.45] text-foreground/45 mb-3">
        {sub}
      </p>
    </>
  );
}

// Small read-only chip — quiet glass pill. Used for ICP criteria. `muted`
// renders exclusions distinctly (lower contrast + a small minus), no red.
function IcpChip({ label, muted = false }: { label: string; muted?: boolean }) {
  return (
    <span
      className={`glass-pill inline-flex items-center gap-1 h-[28px] px-3 rounded-full text-[12.5px] font-medium ${
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
      <div className="text-[12px] font-semibold text-foreground/65 mb-2">
        {caption}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {values.map((v) => (
          <IcpChip key={v} label={v} muted={muted} />
        ))}
      </div>
    </div>
  );
}

// ── A) Audience pool — live breakdown + score histogram ─────────────
function AudiencePoolCard({ audience }: { audience: CampaignAudience }) {
  const { pool, scoreBuckets } = audience;
  const total = pool.cold + pool.warm + pool.warmest;
  const maxBucket = Math.max(1, ...scoreBuckets.map((b) => b.count));

  return (
    <section>
      <AudienceHeader label="Audience" sub="Who this campaign reaches." />
      <div className="rp-card rounded-3xl p-5 lg:p-6" data-testid="audience-pool">
        {/* Big live total + warmth breakdown pills (warmest first). */}
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5">
              <span className="text-[34px] font-semibold tracking-[-0.02em] tabular-nums text-foreground leading-none">
                {fmtNum(total)}
              </span>
              <span className="text-[13px] text-foreground/45">in pool</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2" data-testid="audience-warmth">
            {WARMTH_ORDER.map((w) => (
              <span
                key={w}
                className="glass-pill inline-flex items-center gap-1.5 h-[26px] px-2.5 rounded-full text-[12px] font-medium text-foreground/70"
              >
                <span
                  aria-hidden="true"
                  className="inline-block h-[7px] w-[7px] rounded-full"
                  style={{ background: AI_ACCENT, opacity: WARMTH_META[w].tint }}
                />
                <span className="tabular-nums text-foreground/85">{fmtNum(pool[w])}</span>
                {WARMTH_META[w].label}
              </span>
            ))}
          </div>
        </div>

        <div className="h-px bg-foreground/[0.07] dark:bg-white/[0.07] my-5" />

        {/* Tiny match-score distribution — quality, not just quantity. One
            hue (accent) deepening with score; a quiet horizontal histogram. */}
        <div className="flex items-center justify-between gap-3 mb-2.5">
          <span className="text-[12px] font-semibold text-foreground/65">
            Match-score spread
          </span>
          <span className="text-[11.5px] text-foreground/45">higher is a better fit</span>
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
      </div>
    </section>
  );
}

// ── B) Sources — toggle rows in ONE card, warmest first ─────────────
function AudienceSourcesCard({ audience }: { audience: CampaignAudience }) {
  // Representational: local toggle state, no backend write this round.
  const [sources, setSources] = useState(audience.sources);
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
                <div className="h-9 w-9 shrink-0 rounded-xl glass-pill flex items-center justify-center text-icon">
                  <Icon size={16} strokeWidth={1.8} />
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
              {/* Manual import, when on, offers a quiet upload affordance. */}
              {src.kind === 'import' && src.enabled && (
                <div className="px-4 pb-3.5 -mt-1 pl-[76px]">
                  <button
                    type="button"
                    data-testid="source-import-upload"
                    className="glass-pill pill inline-flex items-center gap-1.5 h-[30px] px-3 text-[12.5px] font-medium text-foreground/75 hover-elevate active-elevate-2"
                  >
                    <Upload size={13} strokeWidth={2} className="text-foreground/55" />
                    Upload CSV or paste URLs
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── C) Ideal customer (ICP) — labelled chip groups, read-only ───────
function AudienceIcpCard({ audience }: { audience: CampaignAudience }) {
  const { icp } = audience;
  const empty =
    icp.titles.length === 0 &&
    icp.industries.length === 0 &&
    !icp.companySize &&
    icp.locations.length === 0 &&
    icp.seniority.length === 0 &&
    icp.exclusions.length === 0;

  return (
    <section>
      <AudienceHeader
        label="Ideal customer"
        sub="The profile we match leads against."
        trailing={
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              data-testid="button-icp-template"
              className="glass-pill pill inline-flex items-center gap-1.5 h-[26px] pl-2 pr-2.5 text-[12px] font-medium text-foreground/75 hover-elevate active-elevate-2"
            >
              <Copy size={12} strokeWidth={2} className="text-foreground/55" />
              Start from a template
            </button>
            <button
              type="button"
              data-testid="button-icp-edit"
              className="glass-pill pill inline-flex items-center gap-1.5 h-[26px] pl-2 pr-2.5 text-[12px] font-medium text-foreground/75 hover-elevate active-elevate-2"
            >
              <Pencil size={12} strokeWidth={2} className="text-foreground/55" />
              Edit
            </button>
          </div>
        }
      />
      <div className="rp-card rounded-3xl p-5 lg:p-6" data-testid="audience-icp">
        {empty ? (
          <p className="text-[13px] text-foreground/45 leading-snug">
            No ideal customer defined yet. Start from a template or clone another
            campaign to set who this reaches.
          </p>
        ) : (
          <div className="flex flex-col gap-5">
            <IcpGroup caption="Titles" values={icp.titles} />
            <IcpGroup caption="Industries" values={icp.industries} />
            {icp.companySize && (
              <IcpGroup caption="Company size" values={[icp.companySize]} />
            )}
            <IcpGroup caption="Locations" values={icp.locations} />
            <IcpGroup caption="Seniority" values={icp.seniority} />
            {icp.exclusions.length > 0 && (
              <>
                <div className="h-px bg-foreground/[0.07] dark:bg-white/[0.07]" />
                <IcpGroup caption="Exclusions" values={icp.exclusions} muted />
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

// ── D) Match quality — representational threshold slider ────────────
function AudienceThresholdCard({ audience }: { audience: CampaignAudience }) {
  const value = audience.matchThreshold;
  return (
    <section>
      <AudienceHeader
        label="Match quality"
        sub="Only contact leads above your bar."
      />
      <div className="rp-card rounded-3xl p-5 lg:p-6" data-testid="audience-threshold">
        <div className="flex items-baseline justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={15} strokeWidth={1.9} style={{ color: AI_ACCENT }} />
            <span className="text-[12px] font-semibold text-foreground/65">
              Minimum match score
            </span>
          </div>
          <span className="text-[15px] font-semibold tabular-nums text-foreground">
            {value}%
          </span>
        </div>
        {/* Representational slider — a filled track to the threshold with a
            quiet knob. Read-only this round (no drag logic). */}
        <div
          className="relative h-[8px] rounded-full bg-foreground/[0.06] dark:bg-white/[0.06]"
          role="img"
          aria-label={`${value}% minimum match`}
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ width: `${value}%`, background: AI_ACCENT, opacity: 0.8 }}
          />
          <span
            aria-hidden="true"
            className="absolute top-1/2 h-[16px] w-[16px] -translate-y-1/2 -translate-x-1/2 rounded-full bg-white"
            style={{
              left: `${value}%`,
              boxShadow:
                '0 1px 1px rgba(0,0,0,0.05), 0 2px 6px rgba(8,10,18,0.22), inset 0 1px 0.5px rgba(255,255,255,0.95)',
            }}
          />
        </div>
        <p className="mt-3.5 text-[12.5px] text-foreground/50 leading-snug">
          Leads below {value}% are still sourced and enriched, but never
          contacted. Source broad, reach out to the best fits only.
        </p>
      </div>
    </section>
  );
}

// ── E) Auto-suppress — three toggles in ONE card ────────────────────
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
    </section>
  );
}

// ── F) Smarter over time — subtle phase-2 self-learning teaser ──────
function AudienceSmarterHint() {
  return (
    <div
      data-testid="audience-smarter-hint"
      className="rounded-2xl px-4 py-3 flex items-center gap-2.5 bg-foreground/[0.03] dark:bg-white/[0.03]"
    >
      <Sparkles size={14} strokeWidth={2} style={{ color: AI_ACCENT }} className="shrink-0" />
      <p className="text-[12.5px] text-foreground/55 leading-snug">
        This audience gets smarter as you use it. Replaiy learns which leads
        convert and refines your ICP.
      </p>
    </div>
  );
}

// ── The whole Audience section, in agreed order ─────────────────────
function AudienceSection({ campaign }: { campaign: Campaign }) {
  const audience = campaign.audience;
  if (!audience) return null;
  return (
    <div className="flex flex-col gap-6 md:gap-7">
      <AudiencePoolCard audience={audience} />
      <AudienceSourcesCard audience={audience} />
      <AudienceIcpCard audience={audience} />
      <AudienceThresholdCard audience={audience} />
      <AudienceSuppressCard audience={audience} />
      <AudienceSmarterHint />
    </div>
  );
}


// ════════════════════════════════════════════════════════════════════
// Dispatcher — keep universal hooks at the top (rules-of-hooks safe),
// then delegate to the create view or the detail view, or an empty state.
export default function CampaignDetail() {
  const params = useParams<{ id?: string }>();
  const { campaigns } = useReplaiy();
  const id = params.id;

  if (id === 'new') {
    return <CampaignCreate key="new" />;
  }

  const campaign = id ? campaigns.find((c) => c.id === id) : undefined;

  if (!id) {
    // Bare /campaigns in the right pane (desktop). The list/overview owns the
    // screen; this is the calm placeholder behind it — given the SAME polished
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

// ── Missing campaign — graceful, with a way back ────────────────────
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
            <ArrowLeft size={22} strokeWidth={1.7} className="text-icon" />
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

// ── Overflow (... ) menu — glass-strong dropdown, Rename + Delete ───
// The switch (active/paused) owns enable/disable; this menu only renames or
// removes. Archive was redundant alongside Paused, so it's gone entirely.
function OverflowMenu({
  campaign,
  align = 'desktop',
  onRename,
}: {
  campaign: Campaign;
  align?: 'desktop' | 'mobile';
  onRename?: () => void;
}) {
  const [, navigate] = useLocation();
  const { updateCampaign } = useReplaiy();
  const [open, setOpen] = useState(false);

  // Mock data has no hard remove; marking the campaign archived + leaving the
  // detail is the closest honest "delete" action against the mock store.
  const del = () => {
    setOpen(false);
    updateCampaign(campaign.id, { status: 'archived' });
    navigate('/campaigns');
  };

  return (
    <div className="relative">
      <button
        type="button"
        data-testid="button-campaign-overflow"
        aria-label="Campaign actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="h-[34px] w-[34px] rounded-full flex items-center justify-center text-icon hover-elevate active-elevate-2"
      >
        <MoreHorizontal size={19} strokeWidth={1.9} />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />
            <motion.div
              data-testid="campaign-actions-menu"
              role="menu"
              initial={{ y: -8, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -8, opacity: 0, scale: 0.97 }}
              transition={APPLE_SPRING}
              style={{ transformOrigin: 'top right' }}
              className={`absolute z-50 ${
                align === 'mobile' ? 'right-0 top-[42px]' : 'right-0 top-[42px]'
              } w-[200px] glass-strong rounded-3xl p-2 shadow-2xl`}
            >
              <div className="flex flex-col gap-0.5">
                {onRename && (
                  <button
                    role="menuitem"
                    data-testid="action-rename"
                    onClick={() => {
                      setOpen(false);
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
                  onClick={del}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-2xl text-[14px] font-medium hover-elevate active-elevate-2 text-left"
                  style={{ color: 'hsl(var(--destructive))' }}
                >
                  <Trash2 size={17} strokeWidth={1.6} className="shrink-0" />
                  <span>Delete</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Inline goal picker — reused by the create view AND the editable
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
  // subtle neutral fill + a small muted check — calm, not a loud frame.
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
              className={`w-full text-left px-4 py-3.5 hover-elevate active-elevate-2 ${
                selected ? 'bg-foreground/[0.05] dark:bg-white/[0.06]' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Small plain glyph, no background box. */}
                <Icon
                  size={16}
                  strokeWidth={1.9}
                  className={`shrink-0 ${selected ? 'text-foreground/70' : 'text-foreground/40'}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[14.5px] font-semibold tracking-[-0.005em] text-foreground">
                    {meta.label}
                  </div>
                  <div className="text-[12.5px] text-muted-foreground leading-snug mt-0.5">
                    {meta.hint}
                  </div>
                </div>
                {/* Quiet selection mark — small muted check, no filled circle. */}
                {selected && (
                  <Check
                    size={17}
                    strokeWidth={2.4}
                    className="shrink-0 text-foreground/70"
                  />
                )}
              </div>
              {/* Custom → free-text field, revealed inline when selected. */}
              {g === 'custom' && selected && (
                <div className="mt-3 ml-7" onClick={(e) => e.stopPropagation()}>
                  <input
                    data-testid="input-custom-goal"
                    value={customLabel}
                    onChange={(e) => onCustomLabel(e.target.value)}
                    placeholder="Describe the outcome in your own words…"
                    className="w-full bg-foreground/[0.04] dark:bg-white/[0.06] rounded-2xl px-3.5 py-2.5 outline-none text-[16px] text-foreground placeholder:text-muted-foreground"
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

// ── Goal card — what Replaiy steers toward, now editable in place ───
// View mode shows the goal + hint with an Edit affordance. Editing reveals
// the same goal picker the create view uses, and persists via updateCampaign.
function GoalCard({ campaign }: { campaign: Campaign }) {
  const { updateCampaign } = useReplaiy();
  const [editing, setEditing] = useState(false);
  const [goalType, setGoalType] = useState<CampaignGoalType>(campaign.goalType);
  const [customLabel, setCustomLabel] = useState(campaign.goalLabel ?? '');
  const [goalDescription, setGoalDescription] = useState(campaign.goalDescription ?? '');

  const meta = GOAL_META[campaign.goalType];
  const label =
    campaign.goalType === 'custom' && campaign.goalLabel
      ? campaign.goalLabel
      : meta.label;
  // View-mode subtitle: the campaign's own description if set, else the
  // generic goal hint as a sensible fallback.
  const description = campaign.goalDescription?.trim() || meta.hint;

  const beginEdit = () => {
    setGoalType(campaign.goalType);
    setCustomLabel(campaign.goalLabel ?? '');
    setGoalDescription(campaign.goalDescription ?? '');
    setEditing(true);
  };

  const canSave = goalType !== 'custom' || customLabel.trim().length > 0;

  const save = () => {
    if (!canSave) return;
    updateCampaign(campaign.id, {
      goalType,
      goalLabel: goalType === 'custom' ? customLabel.trim() : undefined,
      goalDescription: goalDescription.trim() || undefined,
    });
    setEditing(false);
  };

  return (
    <section>
      <div className="px-2 mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[12.5px] font-semibold tracking-[-0.005em]">Goal</span>
        {!editing && (
          <button
            type="button"
            data-testid="button-edit-goal"
            onClick={beginEdit}
            className="glass-pill pill inline-flex items-center gap-1.5 h-[26px] pl-2 pr-2.5 text-[12px] font-medium text-foreground/75 hover-elevate active-elevate-2"
          >
            <Pencil size={12} strokeWidth={2} className="text-foreground/55" />
            Edit
          </button>
        )}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {editing ? (
          <motion.div
            key="edit"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="flex flex-col gap-3"
          >
            <GoalPicker
              goalType={goalType}
              customLabel={customLabel}
              onPick={setGoalType}
              onCustomLabel={setCustomLabel}
            />
            {/* Editable goal description — same field shown on the row. */}
            <div className="rp-card rounded-3xl px-4 py-3">
              <input
                data-testid="input-edit-goal-description"
                value={goalDescription}
                onChange={(e) => setGoalDescription(e.target.value)}
                placeholder="Short description, e.g. Book a 20-min intro call"
                className="w-full bg-transparent outline-none text-[14px] text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div className="flex items-center gap-2 px-1">
              <button
                type="button"
                data-testid="button-save-goal"
                onClick={save}
                disabled={!canSave}
                className="glass-pill pill inline-flex items-center h-[34px] px-4 text-[13px] font-semibold text-foreground hover-elevate active-elevate-2 disabled:opacity-40 disabled:pointer-events-none"
              >
                Save goal
              </button>
              <button
                type="button"
                data-testid="button-cancel-goal"
                onClick={() => setEditing(false)}
                className="glass-pill pill inline-flex items-center h-[34px] px-4 text-[13px] font-medium text-foreground/75 hover-elevate active-elevate-2"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="view"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="rp-card rounded-3xl px-4 py-4 lg:px-5 lg:py-[18px]"
          >
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-xl bg-foreground/[0.06] dark:bg-white/[0.08] flex items-center justify-center shrink-0">
                {/* Goal icon — small, neutral. A single accent micro-detail. */}
                <Target size={16} strokeWidth={1.9} style={{ color: 'var(--ai-accent)' }} />
              </div>
              <div className="min-w-0">
                <div className="text-[15px] font-semibold tracking-[-0.005em] text-foreground leading-snug">
                  {label}
                </div>
                <p className="mt-1 text-[13px] text-muted-foreground leading-snug">
                  {description}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

// ── Funnel ──────────────────────────────────────────────────────────
// A single FLOWING funnel shape that narrows left-to-right (emulating the
// clean dashboard reference — NOT rainbow bars). Each stage: name + count
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

  const conv = conversionPct(campaign);
  const reply = replyRatePct(campaign);
  const fmt = (n: number) => n.toLocaleString('en-US');

  // Unique gradient id per instance — the detail renders a desktop AND a
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
  const H = 96; // shorter, denser band — no tall empty box on mobile
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
      <div className="px-2 mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[12.5px] font-semibold tracking-[-0.005em]">Funnel</span>
        <div className="flex items-center gap-3 text-[12px] text-muted-foreground">
          <span>
            <span className="font-semibold text-foreground tabular-nums">{reply}%</span>{' '}
            reply
          </span>
          <span className="h-3 w-px bg-foreground/15" aria-hidden="true" />
          <span>
            <span className="font-semibold text-foreground tabular-nums">{conv}%</span>{' '}
            conversion
          </span>
        </div>
      </div>

      <div className="rp-card rounded-3xl px-3 py-4 lg:px-4 lg:py-5">
        {/* Funnel fits the card width on every screen — no horizontal scroll.
            Stage typography scales down on mobile so all stages read at once,
            exactly like the reference dashboard. */}
        <div>
          <div>
            {/* Stage headers — name + count, aligned to each column. */}
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
                  <div className="text-[8.5px] lg:text-[11.5px] uppercase tracking-[0.02em] lg:tracking-[0.04em] text-muted-foreground truncate">
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
                      Built from --ai-accent at rising alpha — calm, not loud. */}
                  <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#2F6BFF" stopOpacity="0.14" />
                    <stop offset="45%" stopColor="#2F6BFF" stopOpacity="0.30" />
                    <stop offset="80%" stopColor="#2F6BFF" stopOpacity="0.52" />
                    <stop offset="100%" stopColor="#2F6BFF" stopOpacity="0.78" />
                  </linearGradient>
                </defs>
                {/* Column separators — faint, so eyes can map count→band. */}
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

// ── Flow card — READ-ONLY action sequence Replaiy runs per lead ─────
// A clean vertical sequence: icon + label + hint, with the delay on the
// right. A connector line ties the steps together. Clearly read-only —
// an "Editing soon" hint, no drag-and-drop.
function FlowCard({ campaign }: { campaign: Campaign }) {
  const flow = campaign.flow ?? DEFAULT_FLOW;
  return (
    <section>
      <div className="px-2 mb-1.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[12.5px] font-semibold tracking-[-0.005em]">Flow</span>
          <span className="text-[12px] text-muted-foreground">{flow.length} steps</span>
        </div>
        <span className="text-[11.5px] text-muted-foreground">Editing soon</span>
      </div>
      <div className="rp-card rounded-3xl px-4 py-3 lg:px-5 lg:py-3.5">
        <div className="flex flex-col">
          {flow.map((step, i) => {
            const meta = FLOW_STEP_META[step.kind];
            const Icon = FLOW_ICONS[step.kind];
            const last = i === flow.length - 1;
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
                    <span className="text-[14px] font-semibold tracking-[-0.005em] text-foreground truncate">
                      {meta.label}
                    </span>
                    {step.delay && (
                      <span className="shrink-0 glass-pill pill inline-flex items-center h-[22px] px-2 text-[11px] font-medium tabular-nums text-foreground/70 whitespace-nowrap">
                        {step.delay}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[12.5px] text-muted-foreground leading-snug">
                    {meta.hint}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── Team card — which workspace seats run this campaign ─────────────
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
      <div className="px-2 mb-1.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[12.5px] font-semibold tracking-[-0.005em]">Running from</span>
          <span className="text-[12px] text-muted-foreground">
            {assigned.length} {assigned.length === 1 ? 'seat' : 'seats'}
          </span>
        </div>
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
      </div>

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
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Inline picker — all workspace members, toggleable. */}
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
                        {/* Quiet selection mark — small muted check, no filled circle. */}
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

// ════════════════════════════════════════════════════════════════════
// Detail view
function CampaignDetailView({ campaign }: { campaign: Campaign }) {
  const [, navigate] = useLocation();
  const { updateCampaign } = useReplaiy();
  const isOn = campaign.status === 'active';

  const toggle = (on: boolean) =>
    updateCampaign(campaign.id, { status: on ? 'active' : 'paused' });

  // ── Inline editable name ──────────────────────────────────────────
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(campaign.name);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingName) {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }
  }, [editingName]);

  const beginNameEdit = () => {
    setDraftName(campaign.name);
    setEditingName(true);
  };
  const commitName = () => {
    const next = draftName.trim();
    if (next.length > 0 && next !== campaign.name) {
      updateCampaign(campaign.id, { name: next });
    }
    setEditingName(false);
  };
  const cancelName = () => {
    setDraftName(campaign.name);
    setEditingName(false);
  };

  // Mobile chrome — back arrow (left) + campaign name (center) + overflow.
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
            <ArrowLeft size={22} strokeWidth={1.7} className="text-icon" />
          </ActionPill>
        ),
        togglePill: (
          <div className="inline-flex items-center gap-2 px-1 h-[52px] max-w-[210px]">
            {editingName ? (
              <input
                ref={nameInputRef}
                data-testid="input-edit-name-mobile"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onBlur={commitName}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitName();
                  if (e.key === 'Escape') cancelName();
                }}
                className="bg-transparent outline-none border-b border-foreground/20 focus:border-foreground/40 text-foreground text-[14px] font-semibold tracking-[-0.005em] w-full max-w-full"
              />
            ) : (
              <span className="text-[14px] font-semibold tracking-[-0.005em] truncate text-foreground">
                {campaign.name}
              </span>
            )}
          </div>
        ),
        rightSlot: (
          <div className="flex items-center gap-2">
            <GlassToggle
              on={isOn}
              onChange={toggle}
              testId="campaign-toggle-detail-mobile"
              ariaLabel={`${isOn ? 'Pause' : 'Activate'} ${campaign.name}`}
            />
            <OverflowMenu campaign={campaign} align="mobile" onRename={beginNameEdit} />
          </div>
        ),
      }),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [campaign.id, campaign.name, isOn, editingName, draftName],
    ),
  );

  // Editable name field (shared by desktop header + mobile body heading).
  // Plain render helper (NOT a nested component) so the <input> keeps its
  // identity across keystroke re-renders and never loses focus.
  const renderNameField = (size: 'lg') =>
    editingName ? (
      <input
        ref={nameInputRef}
        data-testid="input-edit-name"
        value={draftName}
        onChange={(e) => setDraftName(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commitName();
          if (e.key === 'Escape') cancelName();
        }}
        className={`bg-transparent outline-none border-b border-foreground/20 focus:border-foreground/40 text-foreground font-semibold tracking-[-0.02em] ${
          size === 'lg' ? 'text-[20px]' : 'text-[22px]'
        } w-full max-w-full`}
      />
    ) : (
      <button
        type="button"
        data-testid="button-edit-name"
        onClick={beginNameEdit}
        className="group inline-flex items-center gap-1.5 min-w-0 text-left rounded-lg hover-elevate active-elevate-2 px-1 -mx-1"
      >
        <span
          className={`font-semibold tracking-[-0.02em] text-foreground truncate ${
            size === 'lg' ? 'text-[20px]' : 'text-[22px]'
          }`}
        >
          {campaign.name}
        </span>
        <Pencil
          size={size === 'lg' ? 14 : 15}
          strokeWidth={2}
          className="shrink-0 text-foreground/35 group-hover:text-foreground/60 transition-colors"
        />
      </button>
    );

  const body = (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="max-w-2xl mx-auto w-full flex flex-col gap-5"
    >
      {/* Name lives ONLY in the top chrome (mobile) / floating header
          (desktop) — never duplicated in the body, exactly like the inbox
          conversation. Rename on mobile is reached via the ··· menu. */}
      {/* Audience — who this campaign reaches. The big one; sits at the TOP.
          (Round 1: the Funnel/Goal/Flow/Running-from blocks below are left
          as-is and restyled next round.) */}
      <AudienceSection campaign={campaign} />
      <FunnelCard campaign={campaign} />
      <GoalCard campaign={campaign} />
      <FlowCard campaign={campaign} />
      <TeamCard campaign={campaign} />
    </motion.div>
  );

  return (
    <div className="flex flex-col h-full min-h-0 relative">
      {/* DESKTOP floating top pill row — editable name (left) + switch +
          overflow (right), on the same top:12 baseline as ConversationDetail. */}
      <div
        data-testid="campaign-desktop-header"
        className="hidden lg:block absolute top-3 inset-x-0 z-30 pointer-events-none"
      >
        <div className="flex items-center justify-between gap-3 px-4 lg:px-6">
          <div className="pointer-events-auto min-w-0 flex items-center h-[52px]">
            {renderNameField('lg')}
          </div>
          <div className="pointer-events-auto flex items-center gap-3 shrink-0">
            <GlassToggle
              on={isOn}
              onChange={toggle}
              testId="campaign-toggle-detail"
              ariaLabel={`${isOn ? 'Pause' : 'Activate'} ${campaign.name}`}
            />
            <OverflowMenu campaign={campaign} />
          </div>
        </div>
      </div>

      {/* DESKTOP scroll container — pt 76 clears the floating header. */}
      <div
        data-testid="campaign-detail-scroll"
        className="hidden lg:flex flex-col flex-1 min-h-0 overflow-y-auto no-scrollbar pb-10"
        style={{ paddingTop: 76 }}
      >
        <div className="flex-1 px-4 lg:px-6">{body}</div>
      </div>

      {/* MOBILE scroll container — content sits under the floating chrome. */}
      <div
        className="flex lg:hidden flex-col flex-1 min-h-0 overflow-y-auto no-scrollbar px-4 pb-32"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 80px)' }}
      >
        {body}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// Create view — goal picker is the centrepiece.
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

  // Mobile chrome — back arrow → /campaigns.
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
            <ArrowLeft size={22} strokeWidth={1.7} className="text-icon" />
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
        <div className="px-2 mb-1.5">
          <span className="text-[12.5px] font-semibold tracking-[-0.005em]">Name</span>
        </div>
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

      {/* Goal picker — the centrepiece (shared component). */}
      <section>
        <div className="px-2 mb-1.5">
          <span className="text-[12.5px] font-semibold tracking-[-0.005em]">Goal</span>
        </div>
        <GoalPicker
          goalType={goalType}
          customLabel={customLabel}
          onPick={setGoalType}
          onCustomLabel={setCustomLabel}
        />
      </section>

      {/* Goal description — short, human line shown as the row subtitle. */}
      <section>
        <div className="px-2 mb-1.5 flex items-baseline justify-between gap-2">
          <span className="text-[12.5px] font-semibold tracking-[-0.005em]">Description</span>
          <span className="text-[11.5px] text-muted-foreground">Optional</span>
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
