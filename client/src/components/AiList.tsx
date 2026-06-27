// Replaiy — "My AI" list column.
//
// Owner decision (final): My AI is a list-detail surface, a true sibling of the
// Inbox and Campaigns. The THREE parts (Persona, Personal knowledge, Workspace
// knowledge) are rendered as CARDS, STACKED VERTICALLY inside the fixed-width
// LEFT list column — the same column where the inbox shows conversation rows
// and campaigns shows campaign rows. NOT full-width. NOT side-by-side columns.
//
// Selecting a card highlights it and fills the RIGHT detail pane (rendered by
// MijnAi), exactly like opening a conversation or a campaign.
//
//   • Persona             → /ai/persona
//   • Personal knowledge  → /ai/knowledge-personal
//   • Workspace knowledge → /ai/knowledge-workspace
//
// The questions + files live INSIDE each part's detail on the right — the left
// column stays clean (just the three stacked cards). The card design itself is
// unchanged from the approved hub cards: plain leading icon (no glass bubble),
// title, one-line description, a flat blue (#2F6BFF) live summary, chevron (or
// lock) top-right. Restrained glass, Apple springs.

import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { useLocation } from 'wouter';
import { Lock, ChevronRight } from 'lucide-react';
import { useStilt } from '@/state/StiltContext';
import { useMobileTopChromeSlot } from './MobileTopChrome';
import { GlassCircleButton, ProfileInitials } from './GlassCircleButton';
import { ConversionBar } from './CampaignsList';
import { APPLE_SPRING } from '@/lib/motion';
import remiMascot from '@/assets/replaiy-mascot.png';
import iconPersona from '@/assets/ai_icon_persona.png';
import iconPersonal from '@/assets/ai_icon_personal.png';
import iconWorkspace from '@/assets/ai_icon_workspace.png';
import { canEditWorkspaceKnowledge } from '@/data/mockWorkspace';

// Mobile top-chrome left slot — identical to Inbox/Campaigns so the surfaces
// share one chrome.
function MobileProfileAvatar() {
  return (
    <GlassCircleButton label="Profile" testId="mobile-profile-avatar" showTooltip={false}>
      <ProfileInitials initials="SB" />
    </GlassCircleButton>
  );
}

// ── A part card — one of the three parts ───────────────────────────
// The approved hub-card design, now stacked in the left list column. A plain
// leading icon (no glass bubble), title, short description, the live summary
// tag, and a chevron (or lock) top-right. The whole card is one tap target that
// fills the right detail pane. When this part's detail is open the card carries
// the SAME neutral active highlight the inbox/campaigns rows use (bg-foreground
// /[0.05]) plus a subtle accent ring so the selected card reads clearly.
function PartCard({
  iconSrc,
  title,
  description,
  pct,
  locked,
  to,
  testId,
  index,
  active,
}: {
  iconSrc: string;
  title: string;
  description: string;
  /** Setup completion 0..100 — drives the brand gradient bar. */
  pct: number;
  locked?: boolean;
  to: string;
  testId: string;
  index: number;
  active?: boolean;
}) {
  const [, navigate] = useLocation();
  const complete = Math.round(pct) >= 100;
  return (
    <motion.button
      type="button"
      data-testid={testId}
      onClick={() => navigate(to)}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...APPLE_SPRING, delay: 0.05 + index * 0.05 }}
      className={`stilt-card rounded-3xl p-5 text-left flex flex-col w-full hover-elevate active-elevate-2 ${
        active ? 'bg-foreground/[0.05] dark:bg-white/[0.06]' : ''
      }`}
    >
      <div className="flex items-start gap-4">
        {/* Prominent 3D brand icon — same material world as the mascot. */}
        <img
          src={iconSrc}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="shrink-0 w-14 h-14 object-contain select-none pointer-events-none"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-[16.5px] font-semibold tracking-[-0.01em] text-foreground">
              {title}
            </h3>
            {locked ? (
              <Lock size={15} strokeWidth={2} className="text-icon-muted shrink-0 mt-1" />
            ) : (
              <ChevronRight size={18} strokeWidth={2} className="text-icon-muted shrink-0 mt-0.5" />
            )}
          </div>
          <p className="text-[13.5px] leading-[1.5] text-foreground/55 mt-1">{description}</p>
        </div>
      </div>

      {/* Setup completion — the shared brand gradient bar (same as campaign
          rows), here meaning how fully this part is set up. */}
      <div className="mt-4 flex items-center gap-3">
        <div className="flex-1">
          <ConversionBar pct={pct} />
        </div>
        <span
          className="text-[12px] font-medium tabular-nums shrink-0"
          style={{ color: complete ? 'var(--ai-accent, #2F6BFF)' : 'hsl(var(--foreground) / 0.45)' }}
        >
          {complete ? 'Complete' : `${Math.round(pct)}% complete`}
        </span>
      </div>
    </motion.button>
  );
}

export function AiList() {
  const { persona, workspace } = useStilt();
  const [loc] = useLocation();

  // The list column NEVER changes shape when a part is open — exactly like the
  // inbox/campaigns. The opened part is simply highlighted via `active`; its
  // detail renders in the right pane. A detail being open also suppresses this
  // column's mobile chrome (on mobile the detail covers the screen and registers
  // its own back-arrow chrome).
  const detailOpen = /^\/ai\/.+/.test(loc);

  // Mobile chrome slot — only when this column owns the screen (bare /ai).
  // leftSlot = profile circle (identical to the inbox); without it the chrome
  // falls back to a ••• that opens the mail dots-menu — wrong here.
  const overviewSlot = useMemo(
    () => ({
      leftSlot: <MobileProfileAvatar />,
      searchPlaceholder: 'Search My AI…',
    }),
    [],
  );
  useMobileTopChromeSlot(detailOpen ? null : overviewSlot);

  const t = persona.tone;
  const canEditWs = canEditWorkspaceKnowledge(workspace.currentRole);

  // ── Setup completion per part (0..100), feeding the brand gradient bar ──
  // Persona: share of the meaningful tone+strategy fields that are filled in.
  const personaFields = [
    t.voice,
    persona.strategy.qualification,
    persona.strategy.closing,
    persona.strategy.pushVsWait,
  ];
  const personaFilled =
    personaFields.filter((v) => v && v.trim()).length +
    (t.dos.length ? 1 : 0) +
    (t.donts.length ? 1 : 0);
  const personaPct = (personaFilled / (personaFields.length + 2)) * 100;

  // Knowledge: share of intake questions answered (files are a bonus, not
  // required for "complete").
  const pQ = persona.knowledge.questions;
  const wQ = workspace.knowledge.questions;
  const personalPct = pQ.length ? (pQ.filter((q) => q.answer.trim()).length / pQ.length) * 100 : 0;
  const workspacePct = wQ.length ? (wQ.filter((q) => q.answer.trim()).length / wQ.length) * 100 : 0;

  // ── One single list layout, always (inbox/campaigns parity) ────────
  return (
    <div className="relative flex flex-col h-full min-h-0">
      <div className="flex-1 overflow-y-auto no-scrollbar px-3 lg:px-4 pt-[86px] lg:pt-5 pb-44 lg:pb-6">
        {/* Same parent-wrapper entrance the inbox/campaigns lists use
            (opacity 0 y:6 → 0, duration 0.22), then the briefing header plays
            its own intro on top — so switching to My AI animates with identical
            polish/timing to switching to the Inbox or Campaigns. */}
        <motion.div
          key="my-ai"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          className="max-w-2xl w-full flex flex-col gap-5 md:gap-6"
        >
          {/* Briefing header — Remi + heading, mirrors the inbox/campaigns
              greeting at list-column scale. */}
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
                Your AI
              </h2>
              <p className="text-[15px] text-foreground/70 mt-2 leading-snug">
                Set how your AI sounds and what it knows, so it runs your LinkedIn
                conversations the way you would.
              </p>
            </div>
          </motion.div>

          {/* The three parts as cards, STACKED vertically in the left column.
              Selecting a card opens that part's detail on the right. */}
          <section className="flex flex-col gap-3">
            <PartCard
              index={0}
              testId="part-persona"
              iconSrc={iconPersona}
              title="Persona"
              description="The voice, tone and strategy your AI uses to reply. This is what makes it sound like you."
              pct={personaPct}
              to="/ai/persona"
              active={loc.startsWith('/ai/persona')}
            />
            <PartCard
              index={1}
              testId="part-knowledge-personal"
              iconSrc={iconPersonal}
              title="Personal knowledge"
              description="Your own notes, writing samples and answers. Only your conversations draw on this."
              pct={personalPct}
              to="/ai/knowledge-personal"
              active={loc.startsWith('/ai/knowledge-personal')}
            />
            <PartCard
              index={2}
              testId="part-knowledge-workspace"
              iconSrc={iconWorkspace}
              title="Workspace knowledge"
              description="Company facts every teammate's AI shares: what you sell, who it is for and how you handle objections."
              pct={workspacePct}
              locked={!canEditWs}
              to="/ai/knowledge-workspace"
              active={loc.startsWith('/ai/knowledge-workspace')}
            />
          </section>
        </motion.div>
      </div>
    </div>
  );
}
