// Replaiy — Campaign detail + create pane (right column of the split view).
//
// Mirrors MailDetail.tsx structure exactly:
//   • A floating desktop pill row at top-3 (name + on/off + ... overflow).
//   • Separate desktop / mobile scroll containers (max-w-2xl mx-auto content).
//   • Mobile top-chrome registered via useMobileTopChromeSlot (priority 100):
//     leftSlot = ArrowLeft ActionPill → navigate('/campaigns').
//   • Surfaces are real design-system classes only (.stilt-card, .glass-pill,
//     .glass-strong). ONE accent: var(--ai-accent). Delete is the single
//     allowed exception using hsl(var(--destructive)).
//
// Route dispatch (matches App.tsx <Route path="/campaigns/:id"> and the bare
// "/campaigns" route): when the id is 'new' we render the create view (goal
// picker); when it is an existing campaign we render the detail; bare
// /campaigns shows a calm empty state in the right pane (desktop only — on
// mobile the list owns the screen for the overview).

import { useMemo, useState } from 'react';
import { useLocation, useParams } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Target,
  MoreHorizontal,
  Archive,
  Trash2,
  Check,
  Send,
  UserCheck,
  MessageSquare,
  MessagesSquare,
  Trophy,
  CalendarClock,
  BadgeCheck,
  CornerUpLeft,
  PlayCircle,
  Sparkles,
} from 'lucide-react';
import { useStilt } from '@/state/StiltContext';
import {
  GOAL_META,
  type Campaign,
  type CampaignGoalType,
} from '@/data/mockCampaigns';
import { ActionPill } from '@/components/MailDetailToolbar';
import { useMobileTopChromeSlot } from '@/components/MobileTopChrome';
import { CampaignToggle } from '@/components/CampaignToggle';
import { conversionPct } from '@/components/CampaignsList';
import { APPLE_SPRING } from '@/lib/motion';

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

// ── Goal card — what Replaiy steers toward + the hint ───────────────
function GoalCard({ campaign }: { campaign: Campaign }) {
  const meta = GOAL_META[campaign.goalType];
  const label =
    campaign.goalType === 'custom' && campaign.goalLabel
      ? campaign.goalLabel
      : meta.label;
  return (
    <section>
      <div className="px-2 mb-1.5 flex items-center gap-2">
        <span className="text-[12.5px] font-semibold tracking-[-0.005em]">Goal</span>
      </div>
      <div className="stilt-card rounded-3xl px-4 py-4 lg:px-5 lg:py-[18px]">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-xl bg-foreground/[0.06] dark:bg-white/[0.08] flex items-center justify-center shrink-0">
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
      </div>
    </section>
  );
}

// ── Funnel ──────────────────────────────────────────────────────────
// Connection requests → Accepted (leads) → Replied → In conversation →
// [goal]. Each stage shows count + % of the top stage. Non-final stages
// use a neutral bar; only the goal stage uses the accent. An overall
// conversion% sits in the header.
function FunnelCard({ campaign }: { campaign: Campaign }) {
  const meta = GOAL_META[campaign.goalType];
  const s = campaign.stats;
  const top = Math.max(1, s.connectsSent);

  const stages: {
    key: string;
    label: string;
    icon: typeof Send;
    value: number;
    accent?: boolean;
  }[] = [
    { key: 'sent', label: 'Connection requests', icon: Send, value: s.connectsSent },
    { key: 'leads', label: 'Accepted · leads', icon: UserCheck, value: s.leads },
    { key: 'replied', label: 'Replied', icon: MessageSquare, value: s.replies },
    { key: 'inconv', label: 'In conversation', icon: MessagesSquare, value: s.inConversation },
    {
      key: 'goal',
      label: meta.achieved,
      icon: Trophy,
      value: s.goalAchieved,
      accent: true,
    },
  ];

  const conv = conversionPct(campaign);
  const fmt = (n: number) => n.toLocaleString('en-US');

  return (
    <section>
      <div className="px-2 mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[12.5px] font-semibold tracking-[-0.005em]">Funnel</span>
        <span className="text-[12px] text-muted-foreground">
          <span className="font-semibold text-foreground tabular-nums">{conv}%</span>{' '}
          conversion
        </span>
      </div>
      <div className="stilt-card rounded-3xl overflow-hidden">
        {stages.map((stage, i) => {
          const pct = Math.round((stage.value / top) * 100);
          const Icon = stage.icon;
          return (
            <div key={stage.key}>
              {i > 0 && (
                <div className="ml-4 h-px bg-foreground/[0.06] dark:bg-white/[0.06]" />
              )}
              <div className="px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="h-7 w-7 rounded-lg bg-foreground/[0.06] dark:bg-white/[0.08] flex items-center justify-center shrink-0">
                    <Icon
                      size={14}
                      strokeWidth={1.9}
                      style={stage.accent ? { color: 'var(--ai-accent)' } : undefined}
                      className={stage.accent ? '' : 'text-icon-muted'}
                    />
                  </div>
                  <span className="text-[14px] font-medium text-foreground/90 truncate flex-1 min-w-0">
                    {stage.label}
                  </span>
                  <span className="text-[14px] font-semibold tabular-nums text-foreground shrink-0">
                    {fmt(stage.value)}
                  </span>
                  <span className="text-[12px] text-muted-foreground tabular-nums shrink-0 w-[42px] text-right">
                    {pct}%
                  </span>
                </div>
                <div className="mt-2.5 ml-10 h-[3px] rounded-full bg-foreground/[0.08] dark:bg-white/[0.10] overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(0, Math.min(100, pct))}%`,
                      background: stage.accent
                        ? 'var(--ai-accent)'
                        : 'hsl(var(--foreground) / 0.28)',
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── Conversations placeholder ───────────────────────────────────────
function ConversationsCard({ campaign }: { campaign: Campaign }) {
  const inConv = campaign.stats.inConversation;
  return (
    <section>
      <div className="px-2 mb-1.5 flex items-center gap-2">
        <span className="text-[12.5px] font-semibold tracking-[-0.005em]">Conversations</span>
        {inConv > 0 && (
          <span className="text-[12px] text-muted-foreground tabular-nums">{inConv}</span>
        )}
      </div>
      <div className="stilt-card rounded-3xl px-4 py-8 flex flex-col items-center text-center">
        <div className="h-10 w-10 rounded-2xl bg-foreground/[0.06] dark:bg-white/[0.08] flex items-center justify-center mb-3">
          <MessagesSquare size={18} strokeWidth={1.7} className="text-icon-muted" />
        </div>
        <p className="text-[13.5px] text-muted-foreground leading-snug max-w-[280px]">
          {inConv > 0
            ? `${inConv} live thread${inConv === 1 ? '' : 's'} will appear here — every lead Replaiy is talking to, in one place.`
            : 'Once leads start replying, their conversations will show up here.'}
        </p>
      </div>
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

  const body = (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="max-w-2xl mx-auto w-full flex flex-col gap-5"
    >
      <GoalCard campaign={campaign} />
      <FunnelCard campaign={campaign} />
      <ConversationsCard campaign={campaign} />
    </motion.div>
  );

  return (
    <div className="flex flex-col h-full min-h-0 relative">
      {/* DESKTOP floating top pill row — name (left) + switch + overflow
          (right), on the same top:12 baseline as MailDetail. */}
      <div
        data-testid="campaign-desktop-header"
        className="hidden lg:block absolute top-3 inset-x-0 z-30 pointer-events-none"
      >
        <div className="flex items-center justify-between gap-3 px-4 lg:px-6">
          <div className="pointer-events-auto min-w-0 flex items-center h-[52px]">
            <h1 className="text-[20px] font-semibold tracking-[-0.02em] text-foreground truncate">
              {campaign.name}
            </h1>
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
const GOAL_ORDER: CampaignGoalType[] = ['meeting', 'demo', 'qualified', 'reply', 'custom'];
const GOAL_ICONS: Record<CampaignGoalType, typeof Target> = {
  meeting: CalendarClock,
  demo: PlayCircle,
  qualified: BadgeCheck,
  reply: CornerUpLeft,
  custom: Sparkles,
};

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
      stats: { connectsSent: 0, leads: 0, inConversation: 0, replies: 0, goalAchieved: 0 },
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

      {/* Goal picker — the centrepiece. */}
      <section>
        <div className="px-2 mb-1.5">
          <span className="text-[12.5px] font-semibold tracking-[-0.005em]">Goal</span>
        </div>
        <div className="flex flex-col gap-2">
          {GOAL_ORDER.map((g) => {
            const meta = GOAL_META[g];
            const Icon = GOAL_ICONS[g];
            const selected = goalType === g;
            return (
              <button
                key={g}
                type="button"
                data-testid={`goal-option-${g}`}
                onClick={() => setGoalType(g)}
                aria-pressed={selected}
                className="stilt-card rounded-3xl px-4 py-3.5 text-left hover-elevate active-elevate-2 transition-shadow"
                style={
                  selected
                    ? { boxShadow: 'inset 0 0 0 1.5px var(--ai-accent)' }
                    : undefined
                }
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-foreground/[0.06] dark:bg-white/[0.08] flex items-center justify-center shrink-0">
                    <Icon
                      size={16}
                      strokeWidth={1.9}
                      style={selected ? { color: 'var(--ai-accent)' } : undefined}
                      className={selected ? '' : 'text-icon-muted'}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[14.5px] font-semibold tracking-[-0.005em] text-foreground">
                      {meta.label}
                    </div>
                    <div className="text-[12.5px] text-muted-foreground leading-snug mt-0.5">
                      {meta.hint}
                    </div>
                  </div>
                  <div
                    className="h-[22px] w-[22px] rounded-full flex items-center justify-center shrink-0"
                    style={
                      selected
                        ? { background: 'var(--ai-accent)' }
                        : { boxShadow: 'inset 0 0 0 1.5px hsl(var(--foreground) / 0.20)' }
                    }
                  >
                    {selected && <Check size={13} strokeWidth={3} className="text-white" />}
                  </div>
                </div>
                {/* Custom → free-text field, revealed inline when selected. */}
                {g === 'custom' && selected && (
                  <div className="mt-3 ml-12">
                    <input
                      data-testid="input-custom-goal"
                      value={customLabel}
                      onChange={(e) => setCustomLabel(e.target.value)}
                      placeholder="Describe the outcome in your own words…"
                      className="w-full bg-foreground/[0.04] dark:bg-white/[0.06] rounded-2xl px-3.5 py-2.5 outline-none text-[16px] text-foreground placeholder:text-muted-foreground"
                    />
                  </div>
                )}
              </button>
            );
          })}
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
        className="flex lg:hidden flex-col flex-1 min-h-0 overflow-y-auto no-scrollbar px-4 pb-28"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 80px)' }}
      >
        {body}
      </div>
    </div>
  );
}
