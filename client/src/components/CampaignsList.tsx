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
// dividers, px-4 py-3 hover-elevate active-elevate-2 rows, glass-pill goal
// pills, one accent (var(--ai-accent)), tabular-nums for numbers.

import { motion } from 'framer-motion';
import { Target, Plus } from 'lucide-react';
import { useMemo } from 'react';
import { useLocation, Link } from 'wouter';
import { useStilt } from '@/state/StiltContext';
import {
  GOAL_META,
  type Campaign,
} from '@/data/mockCampaigns';
import remiMascot from '@/assets/replaiy-mascot.png';
import { CampaignToggle } from './CampaignToggle';
import { useMobileTopChromeSlot } from './MobileTopChrome';

// ── Derived metrics ────────────────────────────────────────────────
// conversion% = goalAchieved / leads ; replyRate% = replies / leads.
export function conversionPct(c: Campaign): number {
  if (c.stats.leads === 0) return 0;
  return Math.round((c.stats.goalAchieved / c.stats.leads) * 100);
}
export function replyRatePct(c: Campaign): number {
  if (c.stats.leads === 0) return 0;
  return Math.round((c.stats.replies / c.stats.leads) * 100);
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

// ── Goal pill — neutral glass pill with Target icon + label ─────────
function GoalPill({ campaign }: { campaign: Campaign }) {
  const meta = GOAL_META[campaign.goalType];
  const label =
    campaign.goalType === 'custom' && campaign.goalLabel
      ? campaign.goalLabel
      : meta.label;
  return (
    <span className="glass-pill pill inline-flex items-center gap-1.5 h-[26px] pl-2 pr-2.5 text-[12px] font-medium text-foreground/75 max-w-full">
      <Target size={12.5} strokeWidth={2} className="text-icon-muted shrink-0" />
      <span className="truncate">{label}</span>
    </span>
  );
}

// ── Thin conversion bar — single accent, neutral track ──────────────
function ConversionBar({ pct }: { pct: number }) {
  const width = Math.max(0, Math.min(100, pct));
  return (
    <div className="h-[3px] w-full rounded-full bg-foreground/[0.08] dark:bg-white/[0.10] overflow-hidden">
      <div
        className="h-full rounded-full"
        style={{ width: `${width}%`, background: 'var(--ai-accent)' }}
      />
    </div>
  );
}

// ── Campaign row — calm, inbox-style ────────────────────────────────
// name + goal pill on the first line; on/off switch + conversion% + thin
// bar below. Clicking the row body navigates; the switch toggles in place.
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
  const isOn = campaign.status === 'active';

  const toggle = (on: boolean) => {
    updateCampaign(campaign.id, { status: on ? 'active' : 'paused' });
  };

  return (
    <div
      data-testid={`campaign-row-${campaign.id}`}
      onClick={() => navigate(`/campaigns/${campaign.id}`)}
      className={`relative cursor-pointer select-none block px-4 py-3 hover-elevate active-elevate-2 ${
        active ? 'bg-foreground/[0.05] dark:bg-white/[0.06]' : ''
      }`}
    >
      {/* Top line: name + goal pill (left), switch (right) */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[14.5px] font-semibold tracking-[-0.005em] text-foreground truncate">
            {campaign.name}
          </div>
          <div className="mt-1.5 flex items-center gap-2 min-w-0">
            <GoalPill campaign={campaign} />
          </div>
        </div>
        {/* Switch — stop propagation so toggling never opens the campaign. */}
        <div
          className="shrink-0 pt-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          <CampaignToggle
            on={isOn}
            onChange={toggle}
            testId={`campaign-toggle-${campaign.id}`}
            ariaLabel={`${isOn ? 'Pause' : 'Activate'} ${campaign.name}`}
          />
        </div>
      </div>

      {/* Bottom line: conversion% + thin bar */}
      <div className="mt-3 flex items-center gap-3">
        <span className="text-[12.5px] text-muted-foreground shrink-0">
          Conversion
        </span>
        <span className="text-[12.5px] font-semibold tabular-nums text-foreground shrink-0">
          {conv}%
        </span>
        <div className="flex-1 min-w-0">
          <ConversionBar pct={conv} />
        </div>
      </div>
    </div>
  );
}

// ── Roll-up stat — one of the three headline numbers ────────────────
function RollupStat({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  return (
    <div className="flex-1 min-w-0 px-4 py-4 lg:px-5 lg:py-[18px]">
      <div className="text-[24px] font-semibold tracking-[-0.02em] leading-none tabular-nums text-foreground">
        {value}
      </div>
      <div className="mt-2 text-[12.5px] text-muted-foreground leading-snug">
        {label}
      </div>
    </div>
  );
}

// ── The campaign list cluster (shared by both modes) ────────────────
function CampaignListCluster({
  list,
  activeId,
}: {
  list: Campaign[];
  activeId?: string;
}) {
  return (
    <div className="stilt-card rounded-3xl overflow-hidden">
      {list.map((c, i) => (
        <div key={c.id}>
          {i > 0 && (
            <div className="ml-4 h-px bg-foreground/[0.06] dark:bg-white/[0.06]" />
          )}
          <CampaignRow campaign={c} active={activeId === c.id} />
        </div>
      ))}
    </div>
  );
}

// ── New campaign pill — reuses the inbox add-account pill styling ───
function NewCampaignButton() {
  return (
    <Link
      href="/campaigns/new"
      data-testid="button-new-campaign"
      className="glass-pill pill inline-flex items-center gap-1.5 h-[34px] px-3.5 text-[13px] font-medium text-foreground/80 hover-elevate active-elevate-2"
    >
      <Plus size={15} strokeWidth={2} className="text-icon" />
      New campaign
    </Link>
  );
}

// ════════════════════════════════════════════════════════════════════
export function CampaignsList() {
  const { campaigns } = useStilt();
  const [loc] = useLocation();

  // Detail/create routes → narrow split-column mode. Bare /campaigns →
  // full overview.
  const isSplit = /^\/campaigns\/.+/.test(loc);
  const idMatch = loc.match(/^\/campaigns\/([^/?#]+)/);
  const activeId =
    idMatch && idMatch[1] !== 'new'
      ? decodeURIComponent(idMatch[1])
      : undefined;

  const sorted = useMemo(() => sortCampaigns(campaigns), [campaigns]);

  // Mobile chrome slot — only when this column owns the screen (overview).
  // In split mode the detail pane registers its own (back arrow) slot.
  useMobileTopChromeSlot(
    isSplit ? null : { searchPlaceholder: 'Search campaigns…' }
  );

  // Roll-up across ACTIVE campaigns only.
  const active = campaigns.filter((c) => c.status === 'active');
  const totalConnects = active.reduce((s, c) => s + c.stats.connectsSent, 0);
  const totalLeads = active.reduce((s, c) => s + c.stats.leads, 0);
  const totalReplies = active.reduce((s, c) => s + c.stats.replies, 0);
  const totalGoals = active.reduce((s, c) => s + c.stats.goalAchieved, 0);
  const weightedReplyRate =
    totalLeads === 0 ? 0 : Math.round((totalReplies / totalLeads) * 100);

  const fmt = (n: number) => n.toLocaleString('en-US');

  // ── Split mode: narrow list column ────────────────────────────────
  if (isSplit) {
    return (
      <div className="relative flex flex-col h-full min-h-0">
        <div className="flex-1 overflow-y-auto no-scrollbar px-3 lg:px-4 pt-4 lg:pt-5 pb-44 lg:pb-6">
          <div className="flex items-center justify-between px-2 mb-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[12.5px] font-semibold tracking-[-0.005em]">
                Campaigns
              </span>
              <span className="text-[12px] text-muted-foreground">
                {sorted.length}
              </span>
            </div>
            <NewCampaignButton />
          </div>
          <CampaignListCluster list={sorted} activeId={activeId} />
        </div>
      </div>
    );
  }

  // ── Overview mode: full-width dashboard + list ────────────────────
  return (
    <div className="relative flex flex-col h-full min-h-0">
      <div className="flex-1 overflow-y-auto no-scrollbar px-3 lg:px-4 pt-4 lg:pt-5 pb-44 lg:pb-6">
        <div className="max-w-2xl mx-auto w-full flex flex-col gap-5 md:gap-6">
          {/* Briefing header — Remi + heading, mirrors the inbox greeting. */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="px-2 pt-1 flex flex-row items-center gap-3 sm:gap-4"
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
                Campaigns
              </h2>
              <p className="text-[15px] text-foreground/70 mt-2 leading-snug">
                <span className="font-semibold text-foreground">
                  {active.length} active campaign{active.length === 1 ? '' : 's'}
                </span>{' '}
                running.{' '}
                <span className="text-foreground/55">
                  {fmt(totalGoals)} goal{totalGoals === 1 ? '' : 's'} achieved so far.
                </span>
              </p>
            </div>
          </motion.div>

          {/* Roll-up stat strip — the three numbers that matter, summed
              across active campaigns. One stilt-card, hairline dividers. */}
          <section>
            <div className="flex items-center gap-2 px-2 mb-1.5">
              <span className="text-[12.5px] font-semibold tracking-[-0.005em]">
                Active overview
              </span>
            </div>
            <div className="stilt-card rounded-3xl overflow-hidden">
              <div className="flex items-stretch divide-x divide-foreground/[0.06] dark:divide-white/[0.06]">
                <RollupStat
                  value={fmt(totalConnects)}
                  label="Connection requests sent"
                />
                <RollupStat
                  value={`${weightedReplyRate}%`}
                  label="Reply rate"
                />
                <RollupStat
                  value={fmt(totalGoals)}
                  label="Goals achieved"
                />
              </div>
            </div>
          </section>

          {/* The list of campaigns. */}
          <section>
            <div className="flex items-center justify-between px-2 mb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[12.5px] font-semibold tracking-[-0.005em]">
                  All campaigns
                </span>
                <span className="text-[12px] text-muted-foreground">
                  {sorted.length}
                </span>
              </div>
              <NewCampaignButton />
            </div>
            {sorted.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                <p className="text-[14px]">No campaigns yet</p>
              </div>
            ) : (
              <CampaignListCluster list={sorted} />
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
