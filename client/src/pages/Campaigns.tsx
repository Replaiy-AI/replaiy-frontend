// Replaiy — Campaigns.
//
// From "coming soon" to a real screen: list campaigns, see each campaign's
// conversion GOAL (the backend campaign model, migratie 0032), and create a
// new campaign by picking a goal. The goal is the heart of Replaiy — it drives
// the draft tone (persona), the funnel endpoint (goal_achieved) and the RL
// learning signal. So the create flow makes the goal the centrepiece.
//
// Design language matches the inbox: stilt-card clusters, one blue accent
// (--ai-accent), glass pills, Remi-free functional header. Mock-data backed
// (like the rest of the preview); wiring to the live RPCs is a later step.

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, Target, Check, X, ChevronRight } from 'lucide-react';
import { APPLE_SPRING } from '@/lib/motion';
import { ResponsiveSheet } from '@/components/ResponsiveSheet';
import { useMobileTopChromeSlot } from '@/components/MobileTopChrome';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  MOCK_CAMPAIGNS,
  GOAL_META,
  STATUS_META,
  type Campaign,
  type CampaignGoalType,
  type CampaignStatus,
} from '@/data/mockCampaigns';

const GOAL_ORDER: CampaignGoalType[] = [
  'meeting',
  'qualified',
  'reply',
  'demo',
  'custom',
];

// ── Status dot colour. Only "active" uses the blue accent (it's the live,
//    positive state); the rest stay neutral so we never introduce a 2nd hue.
function StatusDot({ status }: { status: CampaignStatus }) {
  const isActive = status === 'active';
  return (
    <span
      className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
      style={{
        background: isActive
          ? 'var(--ai-accent, #2F6BFF)'
          : status === 'paused'
            ? 'color-mix(in srgb, var(--foreground) 35%, transparent)'
            : 'color-mix(in srgb, var(--foreground) 20%, transparent)',
      }}
    />
  );
}

// ── Goal pill — neutral glass, with a small target glyph. The goal LABEL is
//    the meaningful bit; we keep it tonally calm (no rainbow per goal type).
function GoalPill({ campaign }: { campaign: Campaign }) {
  const meta = GOAL_META[campaign.goalType];
  const text =
    campaign.goalType === 'custom' && campaign.goalLabel
      ? campaign.goalLabel
      : meta.label;
  return (
    <span
      className="inline-flex items-center gap-1.5 h-7 pl-2 pr-2.5 rounded-full text-[12.5px] font-medium text-foreground/80 max-w-full"
      style={{
        background: 'color-mix(in srgb, var(--ai-accent, #2F6BFF) 8%, transparent)',
        boxShadow:
          'inset 0 0 0 1px color-mix(in srgb, var(--ai-accent, #2F6BFF) 16%, transparent)',
      }}
    >
      <Target
        size={13}
        strokeWidth={2}
        style={{ color: 'var(--ai-accent, #2F6BFF)' }}
        className="shrink-0"
      />
      <span className="truncate">{text}</span>
    </span>
  );
}

function CampaignRow({ campaign }: { campaign: Campaign }) {
  const meta = GOAL_META[campaign.goalType];
  const conversion =
    campaign.stats.leads > 0
      ? Math.round((campaign.stats.goalAchieved / campaign.stats.leads) * 100)
      : 0;
  return (
    <button
      type="button"
      data-testid={`campaign-row-${campaign.id}`}
      className="w-full text-left px-4 py-4 flex items-center gap-4 hover-elevate active-elevate-2"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1.5">
          <StatusDot status={campaign.status} />
          <span className="text-[15px] font-semibold tracking-[-0.01em] truncate">
            {campaign.name}
          </span>
          <span className="text-[12px] text-muted-foreground shrink-0">
            {STATUS_META[campaign.status].label}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <GoalPill campaign={campaign} />
          <span className="text-[12.5px] text-foreground/55">
            {campaign.stats.leads} leads · {campaign.stats.inConversation} in
            conversation
          </span>
        </div>
      </div>
      <div className="shrink-0 text-right hidden sm:block">
        <div className="text-[17px] font-semibold tabular-nums leading-none">
          {campaign.stats.goalAchieved}
        </div>
        <div className="text-[11px] text-muted-foreground mt-1">
          {meta.achieved.toLowerCase()}
          {campaign.stats.leads > 0 ? ` · ${conversion}%` : ''}
        </div>
      </div>
      <ChevronRight
        size={18}
        strokeWidth={2}
        className="shrink-0 text-icon-muted"
      />
    </button>
  );
}

// ── Create-campaign sheet. Goal picker is the centrepiece. ────────────────
function CreateCampaignSheet({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (c: Campaign) => void;
}) {
  const [name, setName] = useState('');
  const [goalType, setGoalType] = useState<CampaignGoalType>('meeting');
  const [goalLabel, setGoalLabel] = useState('');

  const canCreate =
    name.trim().length > 0 &&
    (goalType !== 'custom' || goalLabel.trim().length > 0);

  function reset() {
    setName('');
    setGoalType('meeting');
    setGoalLabel('');
  }

  function handleCreate() {
    if (!canCreate) return;
    onCreate({
      id: `c${Date.now()}`,
      name: name.trim(),
      goalType,
      goalLabel: goalType === 'custom' ? goalLabel.trim() : undefined,
      status: 'draft',
      stats: { leads: 0, inConversation: 0, goalAchieved: 0 },
      createdAt: new Date().toISOString(),
    });
    reset();
    onClose();
  }

  return (
    <ResponsiveSheet
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      desktopWidth="lg"
      testId="create-campaign-sheet"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <h3 className="text-[18px] font-semibold tracking-[-0.02em]">
          New campaign
        </h3>
        <button
          type="button"
          aria-label="Close"
          onClick={() => {
            reset();
            onClose();
          }}
          className="w-9 h-9 rounded-full flex items-center justify-center text-icon hover-elevate active-elevate-2"
        >
          <X size={18} strokeWidth={2} />
        </button>
      </div>
      <div className="px-5 pb-6 pt-1 flex flex-col gap-6">
        {/* Name */}
        <div className="flex flex-col gap-2">
          <label className="text-[12.5px] font-semibold text-foreground/70">
            Campaign name
          </label>
          <input
            data-testid="input-campaign-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Q3 — Series-B founders"
            className="h-11 px-3.5 rounded-xl bg-foreground/[0.04] text-[16px] outline-none placeholder:text-foreground/35 focus:bg-foreground/[0.06] transition-colors"
            style={{
              boxShadow:
                'inset 0 0 0 1px color-mix(in srgb, var(--foreground) 8%, transparent)',
            }}
          />
        </div>

        {/* Goal — the centrepiece */}
        <div className="flex flex-col gap-2.5">
          <label className="text-[12.5px] font-semibold text-foreground/70">
            Goal
          </label>
          <p className="text-[12.5px] text-foreground/50 -mt-1">
            This is what Replaiy steers every message toward — and what counts
            as a win.
          </p>
          <div className="grid grid-cols-1 gap-2">
            {GOAL_ORDER.map((g) => {
              const meta = GOAL_META[g];
              const selected = goalType === g;
              return (
                <button
                  key={g}
                  type="button"
                  data-testid={`goal-option-${g}`}
                  onClick={() => setGoalType(g)}
                  className="flex items-center gap-3 px-3.5 py-3 rounded-xl text-left transition-colors active-elevate-2"
                  style={{
                    background: selected
                      ? 'color-mix(in srgb, var(--ai-accent, #2F6BFF) 9%, transparent)'
                      : 'color-mix(in srgb, var(--foreground) 3%, transparent)',
                    boxShadow: selected
                      ? 'inset 0 0 0 1.5px color-mix(in srgb, var(--ai-accent, #2F6BFF) 55%, transparent)'
                      : 'inset 0 0 0 1px color-mix(in srgb, var(--foreground) 8%, transparent)',
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-semibold tracking-[-0.01em]">
                      {meta.label}
                    </div>
                    <div className="text-[12.5px] text-foreground/55 mt-0.5">
                      {meta.hint}
                    </div>
                  </div>
                  {selected && (
                    <span
                      className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ background: 'var(--ai-accent, #2F6BFF)' }}
                    >
                      <Check size={13} strokeWidth={3} color="#fff" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Custom label */}
          <AnimatePresence>
            {goalType === 'custom' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
                className="overflow-hidden"
              >
                <input
                  data-testid="input-custom-goal"
                  value={goalLabel}
                  onChange={(e) => setGoalLabel(e.target.value)}
                  placeholder="Describe the outcome (e.g. intro call with their head of partnerships)"
                  className="w-full h-11 px-3.5 mt-1 rounded-xl bg-foreground/[0.04] text-[16px] outline-none placeholder:text-foreground/35 focus:bg-foreground/[0.06] transition-colors"
                  style={{
                    boxShadow:
                      'inset 0 0 0 1px color-mix(in srgb, var(--foreground) 8%, transparent)',
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={() => {
              reset();
              onClose();
            }}
            className="h-10 px-4 rounded-full text-[13.5px] font-medium text-foreground/65 hover-elevate active-elevate-2"
          >
            Cancel
          </button>
          <button
            type="button"
            data-testid="button-create-campaign"
            disabled={!canCreate}
            onClick={handleCreate}
            className="h-10 pl-3.5 pr-4 rounded-full flex items-center gap-1.5 text-[13.5px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              color: '#fff',
              background: 'var(--ai-accent, #2F6BFF)',
              boxShadow:
                '0 6px 18px 0 color-mix(in srgb, var(--ai-accent, #2F6BFF) 30%, transparent), inset 0 1px 0 0 rgba(255,255,255,0.22)',
            }}
          >
            <Plus size={16} strokeWidth={2.4} />
            Create
          </button>
        </div>
      </div>
    </ResponsiveSheet>
  );
}

export default function Campaigns() {
  const isMobile = useIsMobile();
  const [campaigns, setCampaigns] = useState<Campaign[]>(MOCK_CAMPAIGNS);
  const [createOpen, setCreateOpen] = useState(false);

  const active = campaigns.filter((c) => c.status === 'active');
  const others = campaigns.filter((c) => c.status !== 'active');

  // Mobile top chrome: title pill + a New (+) action on the right.
  const slot = useMemo(
    () => ({
      togglePill: (
        <span className="text-[15px] font-semibold tracking-[-0.01em]">
          Campaigns
        </span>
      ),
      rightSlot: (
        <button
          type="button"
          aria-label="New campaign"
          data-testid="button-new-campaign-mobile"
          onClick={() => setCreateOpen(true)}
          className="w-[52px] h-[52px] rounded-full glass-pill flex items-center justify-center active-elevate-2"
        >
          <Plus size={20} strokeWidth={2.2} className="text-icon" />
        </button>
      ),
    }),
    []
  );
  useMobileTopChromeSlot(slot);

  const Section = ({
    label,
    count,
    items,
  }: {
    label: string;
    count: number;
    items: Campaign[];
  }) =>
    items.length === 0 ? null : (
      <section>
        <div className="flex items-center gap-2 px-2 mb-1.5">
          <span className="text-[12.5px] font-semibold tracking-[-0.005em]">
            {label}
          </span>
          <span className="text-[12px] text-muted-foreground">{count}</span>
        </div>
        <div className="stilt-card rounded-3xl overflow-hidden">
          {items.map((c, i) => (
            <div key={c.id}>
              {i > 0 && (
                <div className="ml-4 h-px bg-foreground/[0.06] dark:bg-white/[0.06]" />
              )}
              <CampaignRow campaign={c} />
            </div>
          ))}
        </div>
      </section>
    );

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div
        className={`flex-1 overflow-y-auto no-scrollbar px-3 lg:px-5 ${
          isMobile ? 'pt-[86px]' : 'pt-5 lg:pt-6'
        } pb-44 lg:pb-10`}
      >
        <div className="max-w-3xl mx-auto w-full flex flex-col gap-5 md:gap-6">
          {/* Header — functional (no mascot here; campaigns is a workspace) */}
          {!isMobile && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="px-2 pt-1 flex items-end justify-between gap-4"
            >
              <div className="min-w-0">
                <h2 className="text-[24px] font-semibold tracking-[-0.02em] leading-tight">
                  Campaigns
                </h2>
                <p className="text-[15px] text-foreground/70 mt-2 leading-snug">
                  <span className="font-semibold text-foreground">
                    {active.length} active
                  </span>{' '}
                  · each campaign has a goal Replaiy steers toward.
                </p>
              </div>
              <button
                type="button"
                data-testid="button-new-campaign"
                onClick={() => setCreateOpen(true)}
                className="shrink-0 h-10 pl-3.5 pr-4 rounded-full flex items-center gap-1.5 text-[13.5px] font-semibold transition-all"
                style={{
                  color: '#fff',
                  background: 'var(--ai-accent, #2F6BFF)',
                  boxShadow:
                    '0 6px 18px 0 color-mix(in srgb, var(--ai-accent, #2F6BFF) 30%, transparent), inset 0 1px 0 0 rgba(255,255,255,0.22)',
                }}
              >
                <Plus size={16} strokeWidth={2.4} />
                New campaign
              </button>
            </motion.div>
          )}

          <Section label="Active" count={active.length} items={active} />
          <Section label="Other" count={others.length} items={others} />

          {campaigns.length === 0 && (
            <div className="text-center py-24 text-muted-foreground">
              <p className="text-[14px]">No campaigns yet</p>
            </div>
          )}
        </div>
      </div>

      <CreateCampaignSheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={(c) => setCampaigns((prev) => [c, ...prev])}
      />
    </div>
  );
}
