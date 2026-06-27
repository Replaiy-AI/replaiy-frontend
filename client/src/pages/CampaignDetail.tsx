// Replaiy — Campaign detail + create pane (right column of the split view).
//
// Mirrors MailDetail.tsx structure exactly:
//   • A floating desktop pill row at top-3 (name + on/off + ... overflow).
//   • Separate desktop / mobile scroll containers (max-w-2xl mx-auto content).
//   • Mobile top-chrome registered via useMobileTopChromeSlot (priority 100):
//     leftSlot = ArrowLeft ActionPill → navigate('/campaigns').
//   • Surfaces are real design-system classes only (.stilt-card, .glass-pill,
//     .glass-strong). Blue (var(--ai-accent)) is a RARE micro-accent only —
//     not the fill of large controls. Delete is the single allowed exception
//     using hsl(var(--destructive)).
//
// The detail is ONLY about (1) how the campaign performs — the funnel + key
// metrics, and (2) finetuning it — editable name + editable goal — and (3)
// management (on/off + archive/delete). There is no conversations/messages
// block here: threads live in the Inbox, not in Campaigns.
//
// Route dispatch: id 'new' → create view; existing id → detail; bare
// /campaigns → calm empty state in the right pane (desktop only).

import { useMemo, useState, useRef, useEffect } from 'react';
import { useLocation, useParams } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Target,
  MoreHorizontal,
  Archive,
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
} from 'lucide-react';
import { useStilt } from '@/state/StiltContext';
import {
  GOAL_META,
  WORKSPACE_MEMBERS,
  DEFAULT_FLOW,
  FLOW_STEP_META,
  type Campaign,
  type CampaignGoalType,
  type FlowStepKind,
} from '@/data/mockCampaigns';
import { StiltAvatar } from '@/components/Avatar';
import { ActionPill } from '@/components/MailDetailToolbar';
import { useMobileTopChromeSlot } from '@/components/MobileTopChrome';
import { CampaignToggle } from '@/components/CampaignToggle';
import { conversionPct, replyRatePct } from '@/components/CampaignsList';
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

// ════════════════════════════════════════════════════════════════════
// Dispatcher — keep universal hooks at the top (rules-of-hooks safe),
// then delegate to the create view or the detail view, or an empty state.
export default function CampaignDetail() {
  const params = useParams<{ id?: string }>();
  const { campaigns } = useStilt();
  const id = params.id;

  if (id === 'new') {
    return <CampaignCreate key="new" />;
  }

  const campaign = id ? campaigns.find((c) => c.id === id) : undefined;

  if (!id) {
    // Bare /campaigns in the right pane (desktop). The list/overview owns the
    // screen; this is just the calm placeholder behind it.
    return (
      <div className="hidden lg:flex flex-1 flex-col items-center justify-center text-center text-muted-foreground p-8">
        <p className="text-[14px]">Select a campaign to see its funnel</p>
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

// ── Overflow (... ) menu — glass-strong dropdown, Archive + Delete ──
function OverflowMenu({
  campaign,
  align = 'desktop',
}: {
  campaign: Campaign;
  align?: 'desktop' | 'mobile';
}) {
  const [, navigate] = useLocation();
  const { updateCampaign } = useStilt();
  const [open, setOpen] = useState(false);

  const archive = () => {
    setOpen(false);
    updateCampaign(campaign.id, { status: 'archived' });
    navigate('/campaigns');
  };
  // Mock data has no remove; archiving + leaving is the closest honest action.
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
                <button
                  role="menuitem"
                  data-testid="action-archive"
                  onClick={archive}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-2xl text-[14px] font-medium hover-elevate active-elevate-2 text-left text-foreground"
                >
                  <Archive size={17} strokeWidth={1.6} className="shrink-0 text-icon" />
                  <span>Archive</span>
                </button>
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
    <div className="stilt-card rounded-3xl overflow-hidden">
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
  const { updateCampaign } = useStilt();
  const [editing, setEditing] = useState(false);
  const [goalType, setGoalType] = useState<CampaignGoalType>(campaign.goalType);
  const [customLabel, setCustomLabel] = useState(campaign.goalLabel ?? '');

  const meta = GOAL_META[campaign.goalType];
  const label =
    campaign.goalType === 'custom' && campaign.goalLabel
      ? campaign.goalLabel
      : meta.label;

  const beginEdit = () => {
    setGoalType(campaign.goalType);
    setCustomLabel(campaign.goalLabel ?? '');
    setEditing(true);
  };

  const canSave = goalType !== 'custom' || customLabel.trim().length > 0;

  const save = () => {
    if (!canSave) return;
    updateCampaign(campaign.id, {
      goalType,
      goalLabel: goalType === 'custom' ? customLabel.trim() : undefined,
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
            className="stilt-card rounded-3xl px-4 py-4 lg:px-5 lg:py-[18px]"
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
                  {meta.hint}
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

  // SVG geometry. We draw one continuous band: at each stage boundary the
  // band's half-height is proportional to value/top, symmetric around the
  // vertical centre. A smooth path connects the boundaries.
  const N = stages.length;
  const W = 720;
  const H = 150;
  const padX = 6;
  const midY = H / 2;
  const maxHalf = H / 2 - 8;
  const colW = (W - padX * 2) / N;

  // x at the centre of each column (where the count sits) and at boundaries.
  const colCenter = (i: number) => padX + colW * (i + 0.5);
  const half = (v: number) => Math.max(2.5, (v / top) * maxHalf);

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

      <div className="stilt-card rounded-3xl px-3 py-4 lg:px-4 lg:py-5">
        {/* Horizontal scroll on narrow screens; the SVG keeps a min width so
            stages never crush together. */}
        <div className="overflow-x-auto no-scrollbar -mx-1 px-1">
          <div className="min-w-[560px]">
            {/* Stage headers — name + count, aligned to each column. */}
            <div
              className="grid"
              style={{ gridTemplateColumns: `repeat(${N}, minmax(0, 1fr))` }}
            >
              {stages.map((st, i) => (
                <div
                  key={st.key}
                  data-testid={`funnel-stage-${st.key}`}
                  className={`px-1 ${i === 0 ? 'text-left' : 'text-left'}`}
                >
                  <div className="text-[11.5px] uppercase tracking-[0.04em] text-muted-foreground truncate">
                    {st.label}
                  </div>
                  <div className="mt-0.5 text-[18px] font-semibold tracking-[-0.01em] tabular-nums text-foreground leading-none">
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
                  <linearGradient id="funnel-fill" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="var(--ai-accent)" stopOpacity="0.10" />
                    <stop offset="45%" stopColor="var(--ai-accent)" stopOpacity="0.22" />
                    <stop offset="80%" stopColor="var(--ai-accent)" stopOpacity="0.42" />
                    <stop offset="100%" stopColor="var(--ai-accent)" stopOpacity="0.62" />
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
                <path d={bandPath} fill="url(#funnel-fill)" />
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
      <div className="stilt-card rounded-3xl px-4 py-3 lg:px-5 lg:py-3.5">
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
  const { updateCampaign } = useStilt();
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

      <div className="stilt-card rounded-3xl px-2 py-1.5">
        {assigned.length === 0 && !picking ? (
          <div className="px-2 py-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-foreground/[0.06] dark:bg-white/[0.08] flex items-center justify-center shrink-0">
              <Users size={16} strokeWidth={1.8} className="text-foreground/55" />
            </div>
            <p className="text-[13px] text-muted-foreground leading-snug">
              No seats assigned yet — add a teammate to run this campaign.
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
                  <StiltAvatar name={m.name} src={m.avatar} size={36} className="shrink-0" />
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
            <div className="mt-2 stilt-card rounded-3xl px-2 py-1.5">
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
                        <StiltAvatar name={m.name} src={m.avatar} size={36} className="shrink-0" />
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
  const { updateCampaign } = useStilt();
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
          <div className="inline-flex items-center gap-2 px-1 h-[52px] max-w-[200px]">
            <span className="text-[14px] font-semibold tracking-[-0.005em] truncate text-foreground">
              {campaign.name}
            </span>
          </div>
        ),
        rightSlot: (
          <div className="flex items-center gap-2">
            <CampaignToggle
              on={isOn}
              onChange={toggle}
              testId="campaign-toggle-detail-mobile"
              ariaLabel={`${isOn ? 'Pause' : 'Activate'} ${campaign.name}`}
            />
            <OverflowMenu campaign={campaign} align="mobile" />
          </div>
        ),
      }),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [campaign.id, campaign.name, isOn],
    ),
  );

  // Editable name field (shared by desktop header + mobile body heading).
  // Plain render helper (NOT a nested component) so the <input> keeps its
  // identity across keystroke re-renders and never loses focus.
  const renderNameField = (size: 'lg' | 'md') =>
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
      {/* Mobile-only editable heading (desktop edits via the floating header). */}
      <div className="lg:hidden px-1">
        {renderNameField('md')}
      </div>
      <FunnelCard campaign={campaign} />
      <GoalCard campaign={campaign} />
      <FlowCard campaign={campaign} />
      <TeamCard campaign={campaign} />
    </motion.div>
  );

  return (
    <div className="flex flex-col h-full min-h-0 relative">
      {/* DESKTOP floating top pill row — editable name (left) + switch +
          overflow (right), on the same top:12 baseline as MailDetail. */}
      <div
        data-testid="campaign-desktop-header"
        className="hidden lg:block absolute top-3 inset-x-0 z-30 pointer-events-none"
      >
        <div className="flex items-center justify-between gap-3 px-4 lg:px-6">
          <div className="pointer-events-auto min-w-0 flex items-center h-[52px]">
            {renderNameField('lg')}
          </div>
          <div className="pointer-events-auto flex items-center gap-3 shrink-0">
            <CampaignToggle
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
        className="flex lg:hidden flex-col flex-1 min-h-0 overflow-y-auto no-scrollbar px-4 pb-28"
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
  const { addCampaign } = useStilt();
  const [name, setName] = useState('');
  const [goalType, setGoalType] = useState<CampaignGoalType>('meeting');
  const [customLabel, setCustomLabel] = useState('');

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
        <div className="stilt-card rounded-3xl px-4 py-3">
          <input
            data-testid="input-campaign-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Q3 — Series-B founders"
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
        className="flex lg:hidden flex-col flex-1 min-h-0 overflow-y-auto no-scrollbar px-4 pb-28"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 80px)' }}
      >
        {body}
      </div>
    </div>
  );
}
