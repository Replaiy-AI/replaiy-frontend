// Replaiy — Campaigns list + overview.
//
// Two render modes, driven by the route:
//   • /campaigns            → FULL-WIDTH overview: a roll-up dashboard of all
//                             ACTIVE campaigns (connection requests sent,
//                             reply rate, goals achieved) in the spirit of the
//                             inbox briefing header, then the campaign list.
//   • /campaigns/:id | /new → narrow SPLIT-VIEW left column: just the list
//                             rows (same row component), like InboxList beside
//                             a mail detail.
//
// Design language mirrors InboxList exactly: stilt-card clusters with hairline
// dividers, px-4 py-3 hover-elevate active-elevate rows, glass-pill goal pills,
// tabular-nums for numbers. BLUE (var(--ai-accent)) is reserved for rare micro
// accents only — it is NOT used on switches or on the conversion bars. The
// conversion read-out is calm: a neutral glass track + a muted % number.

import { AnimatePresence, motion } from 'framer-motion';
import { Target } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { useStilt } from '@/state/StiltContext';
import {
  GOAL_META,
  type Campaign,
} from '@/data/mockCampaigns';
import { APPLE_SPRING_LAYOUT } from '@/lib/motion';
import remiMascot from '@/assets/replaiy-mascot.png';
import { GlassToggle } from './GlassToggle';
import { ListRow } from './ListRow';
import { useMobileTopChromeSlot } from './MobileTopChrome';
import { StiltLogo } from '@/components/Logo';
import { GlassCircleButton, ProfileInitials } from './GlassCircleButton';

// v-replaiy — top-left of the mobile chrome. The Stilt profile menu was
// removed (fake template UI), but the SB avatar button stays so we can wire
// it to something later. onClick is a no-op for now. Identical to the inbox
// chrome so Campaigns and Inbox share one chrome.
function MobileProfileAvatar() {
  return (
    <GlassCircleButton
      label="Profile"
      testId="mobile-profile-avatar"
      showTooltip={false}
    >
      <ProfileInitials initials="SB" />
    </GlassCircleButton>
  );
}

// ── Derived metrics ────────────────────────────────────────────────
// conversion% = goalAchieved / found (the whole funnel); replyRate% =
// replied / accepted (how well the conversation lands once they're in).
export function conversionPct(c: Campaign): number {
  if (c.stats.found === 0) return 0;
  return Math.round((c.stats.goalAchieved / c.stats.found) * 100);
}
export function replyRatePct(c: Campaign): number {
  if (c.stats.accepted === 0) return 0;
  return Math.round((c.stats.replied / c.stats.accepted) * 100);
}

// Sort active first, then by created date (newest first). Matches the brief:
// single list, no Active/Other section headers that make rows jump.
export function sortCampaigns(list: Campaign[]): Campaign[] {
  return [...list].sort((a, b) => {
    const aActive = a.status === 'active' ? 0 : 1;
    const bActive = b.status === 'active' ? 0 : 1;
    if (aActive !== bActive) return aActive - bActive;
    return +new Date(b.createdAt) - +new Date(a.createdAt);
  });
}

// ── Goal pill — crisp neutral glass pill with Target icon + label ───
// One neutral treatment (no blue tint). The icon sits at a readable
// foreground opacity so it never looks washed-out / illegible.
function GoalPill({ campaign }: { campaign: Campaign }) {
  const meta = GOAL_META[campaign.goalType];
  const label =
    campaign.goalType === 'custom' && campaign.goalLabel
      ? campaign.goalLabel
      : meta.label;
  return (
    <span className="glass-pill pill inline-flex items-center gap-1.5 h-[24px] pl-2 pr-2.5 text-[12px] font-medium text-foreground/80 max-w-full">
      <Target size={12.5} strokeWidth={2.1} className="text-foreground/55 shrink-0" />
      <span className="truncate">{label}</span>
    </span>
  );
}

// ── Conversion read-out — calm neutral glass bar, muted % ───────────
// NO accent fill. A quiet foreground-tinted track + fill, so the list
// reads as a calm column rather than a row of coloured meters.
function ConversionBar({ pct, dim }: { pct: number; dim?: boolean }) {
  const width = Math.max(0, Math.min(100, pct));
  return (
    <div className="h-[4px] w-full rounded-full bg-foreground/[0.06] dark:bg-white/[0.08] overflow-hidden">
      <div
        className={`h-full rounded-full ${
          dim ? 'bg-foreground/20 dark:bg-white/20' : 'bg-foreground/35 dark:bg-white/40'
        }`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

// ── Campaign row — calm, inbox-style, anchored by a leading dot ─────
// A leading status dot gives the row weight (like SmartMailRow's avatar)
// so rows don't float. Inactive (off) campaigns desaturate + dim. The
// conversion % is integrated into the meta line — no repeated "Conversion"
// label per row.
export function CampaignRow({
  campaign,
  active,
}: {
  campaign: Campaign;
  active?: boolean;
}) {
  const [, navigate] = useLocation();
  const { updateCampaign } = useStilt();
  const conv = conversionPct(campaign);
  const statusOn = campaign.status === 'active';

  // Optimistic local state so the switch flips + wobbles INSTANTLY on tap
  // (immediate feedback, like the nav pills), while the actual status write —
  // which relocates the row between Active/Paused — is delayed until the 440ms
  // liquid animation has played. Without the optimistic state the switch would
  // sit dead for the whole delay and then jump. `isOn` drives the switch; the
  // delayed write drives the re-sort.
  const [isOn, setIsOn] = useState(statusOn);
  useEffect(() => setIsOn(statusOn), [statusOn]);
  const toggle = (next: boolean) => {
    setIsOn(next); // instant visual flip + wobble
    window.setTimeout(() => {
      updateCampaign(campaign.id, { status: next ? 'active' : 'paused' });
    }, 520); // let the full liquid animation play before the row relocates
  };

  return (
    <ListRow
      testId={`campaign-row-${campaign.id}`}
      onClick={() => navigate(`/campaigns/${campaign.id}`)}
      active={active}
      className={isOn ? '' : 'opacity-[0.62]'}
    >
      <div className="min-w-0">
        {/* Tier 1: name + switch. */}
        <div className="flex items-center justify-between gap-3">
          <div className="text-[14.5px] font-semibold tracking-[-0.005em] text-foreground truncate min-w-0">
            {campaign.name}
          </div>
          {/* Switch — stop propagation so toggling never opens the campaign. */}
          <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
            <GlassToggle
              on={isOn}
              onChange={toggle}
              testId={`campaign-toggle-${campaign.id}`}
              ariaLabel={`${isOn ? 'Pause' : 'Activate'} ${campaign.name}`}
            />
          </div>
        </div>

        {/* Tier 2: a single aligned line — goal pill, the quiet neutral
            conversion bar filling the middle, then the % read-out. All
            vertically centered on one clean baseline. */}
        <div className="mt-2 flex items-center gap-2.5 min-w-0">
          {/* shrink-0 so the pill keeps its size for normal labels; capped so a
              long custom label truncates instead of crowding out the bar. */}
          <span className="shrink-0 max-w-[48%] min-w-0">
            <GoalPill campaign={campaign} />
          </span>
          <span className="flex-1 min-w-0 flex items-center">
            <ConversionBar pct={conv} dim={!isOn} />
          </span>
          <span className="shrink-0 text-[12px] text-muted-foreground tabular-nums whitespace-nowrap">
            <span className="font-semibold text-foreground/85">{conv}%</span> conv.
          </span>
        </div>
      </div>
    </ListRow>
  );
}

// ── Roll-up stat — one of the four headline numbers ─────────────────
// Sized so four sit comfortably across on desktop and 2x2 on a phone.
function RollupStat({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  return (
    <div className="flex-1 min-w-0 px-3 py-3.5 lg:px-4 lg:py-[18px]">
      <div className="text-[22px] lg:text-[24px] font-semibold tracking-[-0.02em] leading-none tabular-nums text-foreground">
        {value}
      </div>
      <div className="mt-2 text-[12px] lg:text-[12.5px] text-muted-foreground leading-snug">
        {label}
      </div>
    </div>
  );
}

// ── A labelled campaign section — one inbox-style bucket ────────────
// Mirrors the inbox buckets ("Needs your approval" / "Waiting on reply"):
// a small section header (label + count) above its own stilt-card cluster.
// Rows are wrapped in motion `layout` items inside an AnimatePresence so that
// when a campaign is toggled Active↔Paused it GLIDES/cross-fades to the other
// section instead of teleporting. Empty sections render nothing (inbox parity).
function CampaignSection({
  label,
  list,
  activeId,
}: {
  label: string;
  list: Campaign[];
  activeId?: string;
}) {
  if (list.length === 0) return null;
  return (
    <section>
      <div className="flex items-center gap-2 px-2 mb-1.5">
        <span className="text-[12.5px] font-semibold tracking-[-0.005em]">{label}</span>
        <span className="text-[12px] text-muted-foreground">{list.length}</span>
      </div>
      <div className="stilt-card rounded-3xl overflow-hidden">
        <AnimatePresence initial={false}>
          {list.map((c, i) => (
            <motion.div
              key={c.id}
              layout
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={APPLE_SPRING_LAYOUT}
            >
              {/* Hairline divider — same left-indented hairline the inbox uses
                  between rows. */}
              {i > 0 && (
                <div className="ml-4 h-px bg-foreground/[0.06] dark:bg-white/[0.06]" />
              )}
              <CampaignRow campaign={c} active={activeId === c.id} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </section>
  );
}

// Creating a campaign is handled by the single floating + button in the
// bottom chrome (consistent with Inbox/Calendar) — no duplicate in-list pill.

// ════════════════════════════════════════════════════════════════════
export function CampaignsList() {
  const { campaigns } = useStilt();
  const [loc] = useLocation();

  // The list column NEVER changes shape when you open a campaign — exactly
  // like the inbox. The opened campaign is simply highlighted via activeId;
  // the detail renders in the right pane. (A campaign being open is only used
  // to suppress this column's mobile chrome, since on mobile the detail pane
  // covers the screen and registers its own back-arrow chrome.)
  const detailOpen = /^\/campaigns\/.+/.test(loc);
  const idMatch = loc.match(/^\/campaigns\/([^/?#]+)/);
  const activeId =
    idMatch && idMatch[1] !== 'new'
      ? decodeURIComponent(idMatch[1])
      : undefined;

  // Split into the two inbox-style buckets. Within each bucket keep the same
  // newest-first ordering the single list used (sortCampaigns also pushes
  // active first, which is a no-op within a single-status bucket).
  const activeList = useMemo(
    () => sortCampaigns(campaigns.filter((c) => c.status === 'active')),
    [campaigns],
  );
  const pausedList = useMemo(
    () => sortCampaigns(campaigns.filter((c) => c.status !== 'active')),
    [campaigns],
  );
  const totalCount = campaigns.length;

  // Mobile chrome slot — only when this column owns the screen.
  // leftSlot = profile circle (identical to the inbox); without it the chrome
  // falls back to a ••• that opens the mail dots-menu — wrong here.
  const overviewSlot = useMemo(
    () => ({
      leftSlot: <MobileProfileAvatar />,
      searchPlaceholder: 'Search campaigns…',
    }),
    [],
  );
  useMobileTopChromeSlot(detailOpen ? null : overviewSlot);

  // Roll-up across ACTIVE campaigns only.
  const active = campaigns.filter((c) => c.status === 'active');
  const totalSent = active.reduce((s, c) => s + c.stats.sent, 0);
  const totalAccepted = active.reduce((s, c) => s + c.stats.accepted, 0);
  const totalReplied = active.reduce((s, c) => s + c.stats.replied, 0);
  const totalGoals = active.reduce((s, c) => s + c.stats.goalAchieved, 0);
  // Four headline rates, all guarded against divide-by-zero.
  const acceptRate =
    totalSent === 0 ? 0 : Math.round((totalAccepted / totalSent) * 100);
  const goalRate =
    totalSent === 0 ? 0 : Math.round((totalGoals / totalSent) * 100);
  const weightedReplyRate =
    totalAccepted === 0 ? 0 : Math.round((totalReplied / totalAccepted) * 100);

  const fmt = (n: number) => n.toLocaleString('en-US');

  // ── One single layout, always (inbox parity) ──────────────────────
  return (
    <div className="relative flex flex-col h-full min-h-0">
      <div className="flex-1 overflow-y-auto no-scrollbar px-3 lg:px-4 pt-[86px] lg:pt-5 pb-44 lg:pb-6">
        {/* Same width as before, just left-aligned (no mx-auto centering) so
            the content starts at the left like the inbox. The whole column
            fades up together on entry — the SAME parent-wrapper entrance the
            inbox list uses (initial opacity:0 y:6 → 0, duration 0.22). The
            briefing header + mascot then play their own intro on top, exactly
            like the inbox greeting, so switching to Campaigns animates with
            identical polish/timing to switching to the Inbox. */}
        <motion.div
          key="campaigns"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          className="max-w-2xl w-full flex flex-col gap-5 md:gap-6"
        >
          {/* Briefing header — Remi + heading, mirrors the inbox greeting. */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="px-2 pt-1 flex flex-row items-start gap-3 sm:gap-4"
          >
            <motion.img
              src={remiMascot}
              alt="Remi, the Replaiy assistant"
              aria-hidden="true"
              draggable={false}
              initial={{ opacity: 0, scale: 0.85, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: [0, -4, 0] }}
              transition={{
                opacity: { duration: 0.4, delay: 0.1 },
                scale: { duration: 0.4, delay: 0.1 },
                y: { duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 0.5 },
              }}
              className="shrink-0 w-[64px] h-[64px] sm:w-[84px] sm:h-[84px] object-contain select-none pointer-events-none"
            />
            <div className="min-w-0">
              <h2 className="text-[24px] font-semibold tracking-[-0.02em] leading-tight">
                Your campaigns
              </h2>
              <p className="text-[15px] text-foreground/70 mt-2 leading-snug">
                <span className="font-semibold text-foreground">
                  {active.length} active campaign{active.length === 1 ? '' : 's'}
                </span>{' '}
                running.{' '}
                <span className="text-foreground/55">
                  {fmt(totalSent)} connection requests sent, {weightedReplyRate}% reply
                  rate, {fmt(totalGoals)} goal{totalGoals === 1 ? '' : 's'} achieved so
                  far.
                </span>
              </p>
            </div>
          </motion.div>

          {/* Roll-up stat strip — the four numbers that matter, summed across
              active campaigns. One stilt-card, hairline dividers. Four across
              on desktop; on a phone they wrap to a clean 2x2 grid using the
              same hairline dividers and the same RollupStat cells. */}
          <section>
            <div className="flex items-center gap-2 px-2 mb-1.5">
              <span className="text-[12.5px] font-semibold tracking-[-0.005em]">
                Active overview
              </span>
            </div>
            <div className="stilt-card rounded-3xl overflow-hidden">
              {/* grid: 2 cols on phone (2x2), 4 cols from sm up (one row).
                  Hairlines via per-cell borders (the same hairline colour as
                  the original divide-x strip). On phone: left border on the
                  right column + top border on the bottom row. From sm up: a
                  single row with left borders between cells, no top borders. */}
              <div className="grid grid-cols-2 sm:grid-cols-[1.45fr_1fr_1fr_1fr] [&>*]:border-foreground/[0.06] dark:[&>*]:border-white/[0.06] [&>*:nth-child(even)]:border-l [&>*:nth-child(n+3)]:border-t sm:[&>*]:border-l sm:[&>*:first-child]:border-l-0 sm:[&>*:nth-child(n+3)]:border-t-0">
                <RollupStat
                  value={fmt(totalSent)}
                  label="Connection requests"
                />
                <RollupStat
                  value={`${acceptRate}%`}
                  label="Accept rate"
                />
                <RollupStat
                  value={`${weightedReplyRate}%`}
                  label="Reply rate"
                />
                <RollupStat
                  value={`${goalRate}%`}
                  label="Goal achieved"
                />
              </div>
            </div>
          </section>

          {/* The list of campaigns — split into Active + Paused buckets, exactly
              like the inbox renders its "Needs your approval" / "Waiting on
              reply" buckets. Empty buckets render nothing. Toggling a campaign
              animates the row between the two sections via framer-motion
              `layout` + AnimatePresence on the Apple spring. */}
          {totalCount === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <p className="text-[14px]">No campaigns yet</p>
            </div>
          ) : (
            <>
              <CampaignSection label="Active" list={activeList} activeId={activeId} />
              <CampaignSection label="Paused" list={pausedList} activeId={activeId} />
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
