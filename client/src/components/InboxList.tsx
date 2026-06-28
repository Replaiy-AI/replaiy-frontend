import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
  useMotionValueEvent,
  animate,
  type MotionValue,
} from 'framer-motion';
import {
  MoreHorizontal,
  X,
  Sparkles,
  Inbox as InboxIcon,
  Clock,
  ChevronDown,
  Send,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useReplaiy } from '@/state/ReplaiyContext';
import { useParams, useLocation, Link } from 'wouter';
import { ConversationRow } from './ConversationRow';
import { ListRow } from './ListRow';
import { ReplaiyAvatar } from './Avatar';
import remiMascot from '@/assets/replaiy-mascot.png';
import VadikGlass from './VadikGlass';
import { ReplaiyLogo } from '@/components/Logo';
import { GlassCircleButton, ProfileInitials } from './GlassCircleButton';
import { timeBucket, timeAgo, stateTag, formatInboxTime } from '@/lib/avatar';
import { useInboxSettings } from '@/lib/inboxSettings';
import { APPLE_SPRING } from '@/lib/motion';
import type { Conversation } from '@/data/mockConversations';
import { STAGE_META } from '@/data/mockConversations';
import { GoalPill, ConversionBar } from './CampaignsList';
import { SECONDARY_NAV, SETTINGS_NAV } from '@/lib/nav';
import { GlassSegmentedToggle } from './GlassSegmentedToggle';
import { useMobileTopChromeSlot } from './MobileTopChrome';


const BUCKET_LABEL: Record<string, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  thisWeek: 'This Week',
  earlier: 'Earlier',
};

// ─────────────────────────────────────────────────────────────────
// Inbox top toggle — single source of truth = GlassSegmentedToggle.
// Same component as the Calendar 4-way toggle. Two segments:
//   • Smart Inbox  (sparkle icon, AI tint, label "Smart")
//   • Inbox        (inbox icon, label "Inbox")
// The carousel `swipeProgress` (0..1 toward the OTHER mode) is
// piped through externalProgress so the indicator morphs in sync
// with a horizontal screen swipe.
// ─────────────────────────────────────────────────────────────────
function SegmentedToggle({
  viewMode,
  setViewMode,
  swipeProgress,
}: {
  viewMode: 'inbox' | 'smart';
  setViewMode: (m: 'inbox' | 'smart') => void;
  swipeProgress: MotionValue<number>;
}) {
  return (
    <GlassSegmentedToggle
      testId="inbox-toggle"
      pad={4}
      indicatorStyle="glass-rich"
      value={viewMode}
      onChange={setViewMode}
      externalProgress={swipeProgress}
      externalProgressDirection={viewMode === 'smart' ? 'self-to-next' : 'self-to-prev'}
      segments={[
        {
          key: 'smart',
          icon: Sparkles,
          label: 'Smart',
          // Active = icon(18) + gap(6) + "Smart"(~46) + pad(6+6) = 82
          // Match the calendar Smart segment width for visual parity.
          activeWidth: 86,
          inactiveWidth: 40,
          aiTint: true,
        },
        {
          key: 'inbox',
          icon: InboxIcon,
          label: 'Inbox',
          // Active = icon(18) + gap(6) + "Inbox"(~40) + pad(6+6) = 76
          activeWidth: 80,
          inactiveWidth: 40,
        },
      ]}
    />
  );
}

// ─────────────────────────────────────────────────────────────────
// Top chrome — three separated floating glass elements.
// Now uses .glass-pill-dynamic with --glass-alpha / --glass-blur
// driven by scroll position (Feature 3).
// v30.30 — TopChrome + ConversationViewSelectorWrap volledig verwijderd. De mail
// view-selector leeft nu in de Universal Search modal (context-aware chips)
// en de desktop/tablet column 2 heeft geen eigen top-chrome meer nodig.

// ─────────────────────────────────────────────────────────────────
// Inbox mode — chronological time-grouped
// ─────────────────────────────────────────────────────────────────
function InboxModeList({ items, params }: { items: Conversation[]; params: { id?: string } | null }) {
  const groups = useMemo(() => {
    const g: Record<string, Conversation[]> = { today: [], yesterday: [], thisWeek: [], earlier: [] };
    for (const m of items) g[timeBucket(m.ts)].push(m);
    for (const k of Object.keys(g)) g[k].sort((a, b) => +new Date(b.ts) - +new Date(a.ts));
    return g;
  }, [items]);

  return (
    <>
      {(['today', 'yesterday', 'thisWeek', 'earlier'] as const).map((bucket) => {
        const list = groups[bucket];
        if (list.length === 0) return null;
        return (
          <div key={bucket} className="mt-4 md:mt-5 first:mt-0">
            <div className="px-2 pb-1.5 section-header">{BUCKET_LABEL[bucket]}</div>
            {/* v15.2 — removed `layout` from list + per-row wrappers.
                Layout animation during a horizontal drag was the main
                cause of swipe stutter (FLIP-style reflows of siblings
                fighting the drag transform). Row removal still animates
                via AnimatePresence height/opacity exit. */}
            <div className="rp-card rounded-3xl overflow-hidden">
              <AnimatePresence initial={false}>
                {list.map((m, i) => (
                  <motion.div
                    key={m.id}
                    transition={APPLE_SPRING}
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    {i > 0 && (
                      <div className="ml-[64px] h-px bg-foreground/[0.06] dark:bg-white/[0.06]" />
                    )}
                    <ConversationRow mail={m} active={params?.id === m.id} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        );
      })}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// Smart Inbox mode
// ─────────────────────────────────────────────────────────────────
// LEGACY — the old italic AI-reasoning line. No longer the default tier-2
// (Phase 3 replaced it with the campaign-style goal pill + progress bar +
// stage label). Kept defined for any future opt-in / search-result use.
function SmartReasoningChip({ text }: { text: string }) {
  // v19 — italic body in dark muted gray; only the leading sparkle stays purple.
  return (
    <div className="flex items-start gap-1.5 mt-1.5">
      <Sparkles size={11} strokeWidth={2} className="mt-[3px] shrink-0" style={{ color: 'var(--ai-accent)' }} />
      <span className="text-[12px] text-foreground/70 italic leading-snug">{text}</span>
    </div>
  );
}

// ── Conversation progress line — campaign-row parity ────────────────
// The tier-2 line of every conversation row, mirroring CampaignRow's tier-2
// 1:1: the SAME goal pill (left), the SAME quiet neutral ConversionBar
// (middle), and a plain-text AI stage read-out (right). Bar fill is driven
// purely by the stage's progress% — neutral glass, no sentiment colour.
function ConversationProgressLine({ mail }: { mail: Conversation }) {
  const goalType = mail.goalType ?? 'meeting';
  const stage = mail.goalStage ?? 'no_reply';
  const meta = STAGE_META[stage];
  return (
    <div className="mt-2 flex items-center gap-2.5 min-w-0">
      <span className="shrink-0 max-w-[48%] min-w-0">
        <GoalPill goalType={goalType} />
      </span>
      <span className="flex-1 min-w-0 flex items-center">
        <ConversionBar pct={meta.progress} />
      </span>
      <span className="shrink-0 text-[12px] text-muted-foreground whitespace-nowrap">
        {meta.label}
      </span>
    </div>
  );
}

// v15.2 — Smart Inbox card content (without wrapper). Used INSIDE a
// SwipeableRow when the section supports swipe, or inside a plain Link
// when it doesn't (e.g. Auto-quieted is already AI-handled).
function SmartConversationContent({
  mail,
  showReasoning,
  reasoningText,
}: {
  mail: Conversation;
  showReasoning?: boolean;
  reasoningText?: string;
}) {
  const [{ showTimestamps }] = useInboxSettings();
  // Phase 3 — the tier-2 line is now the campaign-style goal pill + neutral
  // progress bar + AI stage label (ConversationProgressLine). `showReasoning`
  // / `reasoningText` are retained on the signature for compatibility but the
  // default row no longer renders the old italic reasoning chip.
  void reasoningText; void showReasoning;
  return (
    <div className="flex items-start gap-3">
      <ReplaiyAvatar name={mail.from.name} src={mail.from.avatar} size={36} className="shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-semibold text-[14.5px] truncate tracking-[-0.005em]">
              {mail.from.name}
            </span>
            {mail.isThread && mail.threadCount && (
              <span
                className="shrink-0 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full px-1 text-[10.5px] font-semibold tabular-nums bg-foreground/[0.08] dark:bg-white/[0.10] text-foreground/70"
                aria-label={`${mail.threadCount} messages`}
              >
                {mail.threadCount}
              </span>
            )}
          </div>
          {/* v30.34 — één consistente timestamp per row, gated door
             settings.showTimestamps. Geen status-prefix meer (geen "New·"
             of "Waiting·") — status zit al in de Smart Inbox sectie. */}
          {showTimestamps && (
            <span className="text-[12px] text-muted-foreground shrink-0 tabular-nums whitespace-nowrap">
              {formatInboxTime(mail.ts)}
            </span>
          )}
        </div>
        {/* Subtitle = the campaign this conversation belongs to (more useful
            at-a-glance than role/company, which lives in the detail view). */}
        <div className="text-[13.5px] text-foreground/80 truncate leading-snug">
          {mail.campaignName ?? mail.subject}
        </div>
        {/* Phase 3 — campaign-row-style progress line (goal pill + neutral
            bar + AI stage). Replaces the old italic SmartReasoningChip. */}
        <ConversationProgressLine mail={mail} />
      </div>
    </div>
  );
}

// Smart Inbox card — v17: swipe gesture removed. Plain clickable surface
// that navigates to the mail detail. Same styling as before.
function SmartConversationRow({
  mail,
  showReasoning,
  reasoningText,
  active,
}: {
  mail: Conversation;
  showReasoning?: boolean;
  reasoningText?: string;
  active?: boolean;
}) {
  const [, navigate] = useLocation();

  return (
    <ListRow
      testId={`smart-row-${mail.id}`}
      onClick={() => navigate(`/conversation/${mail.id}`)}
      active={active}
    >
      <SmartConversationContent mail={mail} showReasoning={showReasoning} reasoningText={reasoningText} />
    </ListRow>
  );
}

// Non-swipeable Smart Inbox card — used in Auto-quieted (already done).
function SmartConversationRowStatic({ mail, active }: { mail: Conversation; active?: boolean }) {
  return (
    <Link
      href={`/conversation/${mail.id}`}
      data-testid={`smart-row-${mail.id}`}
      className={`block px-4 py-3 hover-elevate active-elevate-2 ${active ? 'bg-foreground/[0.05] dark:bg-white/[0.06]' : ''}`}
    >
      <SmartConversationContent mail={mail} />
    </Link>
  );
}

function SmartInboxView({ conversations, setConversationStatus, params }: { conversations: Conversation[]; setConversationStatus: (id: string, s: any) => void; params?: { id?: string } | null }) {
  const activeId = params?.id;

  // v-replaiy — drie buckets:
  //   • Needs your approval = pending drafts (high/open/needsReply),
  //     gesorteerd op confidence (hoog → laag).
  //   • Waiting on reply    = verstuurd, wacht op antwoord (status waiting).
  //   • Auto-sent today     = automatisch verstuurd (isAutoSent), ingeklapt.
  const needsApproval = conversations
    .filter((m) => m.priority === 'high' && m.status === 'open' && m.needsReply)
    .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
  const waiting = conversations.filter((m) => m.status === 'waiting');
  const autoSent = conversations.filter((m) => (m as any).isAutoSent === true);

  const [autoSentOpen, setAutoSentOpen] = useState(false);

  const avgConfidence = needsApproval.length
    ? Math.round(
        needsApproval.reduce((s, m) => s + (m.confidence ?? 0), 0) / needsApproval.length
      )
    : 0;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      {/* v22.3 — Smart Inbox greeting: pure text. No card frame, no caps
         label, no sparkle. The greeting itself is the entry point; AI
         signals live on the per-mail rows. */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="px-2 pt-1"
      >
        {/* Top row: Remi mascot sits beside the greeting title only. The
           sub-text then flows full-width underneath, so the title needs less
           horizontal room and the inbox column keeps its width even with the
           lead panel open. */}
        <div className="flex flex-row items-center gap-3 sm:gap-4">
          {/* Remi — Replaiy AI-mascotte. Vriendelijk begroetend element naast de
             greeting. Zachte float-animatie, ingetogen; breekt de premium look niet. */}
          <motion.img
            src={remiMascot}
            alt="Remi, the Replaiy assistant"
            aria-hidden="true"
            draggable={false}
            initial={{ opacity: 0, scale: 0.85, y: 6 }}
            animate={{
              opacity: 1,
              scale: 1,
              y: [0, -4, 0],
            }}
            transition={{
              opacity: { duration: 0.4, delay: 0.1 },
              scale: { duration: 0.4, delay: 0.1 },
              y: { duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 0.5 },
            }}
            className="shrink-0 w-[64px] h-[64px] sm:w-[84px] sm:h-[84px] object-contain select-none pointer-events-none"
          />
          <h2 className="min-w-0 text-[24px] font-semibold tracking-[-0.02em] leading-tight">
            {greeting}, Simon.
          </h2>
        </div>
        <p className="text-[15px] text-foreground/70 mt-3 leading-snug">
          <span className="font-semibold text-foreground">
            {needsApproval.length} draft{needsApproval.length === 1 ? '' : 's'}
          </span>{' '}
          need your approval.{' '}
          <span className="text-foreground/55">
            {autoSent.length} {autoSent.length === 1 ? 'was' : 'were'} auto-sent overnight.
          </span>
          {avgConfidence > 0 && (
            <>
              {' '}
              <span className="text-foreground/55">Avg confidence {avgConfidence}%.</span>
            </>
          )}
        </p>
      </motion.div>

      {needsApproval.length > 0 && (
        <section>
          <div className="flex items-center gap-2 px-2 mb-1.5">
            <span className="text-[12.5px] font-semibold tracking-[-0.005em]">Needs your approval</span>
            <span className="text-[12px] text-muted-foreground">{needsApproval.length}</span>
          </div>
          <div className="rp-card rounded-3xl overflow-hidden">
            {needsApproval.map((m, i) => {
              // ≥90% confidence: laat zien WAAROM Replaiy 'm niet automatisch
              // verstuurde (holdReason). Anders de strategie-reden.
              const reasoning =
                (m.confidence ?? 0) >= 90 && m.holdReason ? m.holdReason : m.aiReasoning;
              return (
                <div key={m.id}>
                  {i > 0 && <div className="ml-[64px] h-px bg-foreground/[0.06] dark:bg-white/[0.06]" />}
                  <SmartConversationRow
                    mail={m}
                    showReasoning
                    reasoningText={reasoning}
                    active={activeId === m.id}
                  />
                </div>
              );
            })}
          </div>
        </section>
      )}

      {waiting.length > 0 && (
        <section>
          <div className="flex items-center gap-2 px-2 mb-1.5">
            <span className="text-[12.5px] font-semibold tracking-[-0.005em]">Waiting on reply</span>
            <span className="text-[12px] text-muted-foreground">{waiting.length}</span>
          </div>
          <div className="rp-card rounded-3xl overflow-hidden">
            {waiting.map((m, i) => (
              <div key={m.id}>
                {i > 0 && <div className="ml-[64px] h-px bg-foreground/[0.06] dark:bg-white/[0.06]" />}
                <SmartConversationRow mail={m} active={activeId === m.id} />
              </div>
            ))}
          </div>
        </section>
      )}

      {autoSent.length > 0 && (
        <section>
          <button
            data-testid="button-autosent-toggle"
            onClick={() => setAutoSentOpen((o) => !o)}
            className="w-full glass rounded-3xl px-4 py-3.5 flex items-center justify-between hover-elevate active-elevate-2"
          >
            <div className="flex items-center gap-2">
              <Send size={14} strokeWidth={2} className="text-icon-muted" />
              <span className="text-[13.5px] font-medium">Auto-sent today</span>
              <span className="text-[12.5px] text-muted-foreground">
                · {autoSent.length} auto-sent today
              </span>
            </div>
            <motion.span animate={{ rotate: autoSentOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronDown size={16} className="text-icon-muted" />
            </motion.span>
          </button>
          <AnimatePresence initial={false}>
            {autoSentOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22 }}
                className="overflow-hidden"
              >
                <div className="rp-card rounded-3xl overflow-hidden mt-2">
                  {autoSent.map((m, i) => (
                    <div key={m.id}>
                      {i > 0 && <div className="ml-[64px] h-px bg-foreground/[0.06] dark:bg-white/[0.06]" />}
                      <SmartConversationRowStatic mail={m} active={activeId === m.id} />
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Hook: viewport width responsive flag.
// ─────────────────────────────────────────────────────────────────
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window === 'undefined' ? false : window.innerWidth < 768
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const h = () => setIsMobile(mq.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);
  return isMobile;
}

// ─────────────────────────────────────────────────────────────────
// Mobile paged carousel — Inbox + Smart Inbox side-by-side.
// Container slides on horizontal drag; updates viewMode at threshold.
// Drives `swipeProgress` motion value so the top toggle morphs in sync.
// Uses dragDirectionLock so vertical scrolling still works.
// ─────────────────────────────────────────────────────────────────
function MobileCarousel({
  viewMode,
  setViewMode,
  swipeProgress,
  inboxItems,
  params,
  conversations,
  setConversationStatus,
}: {
  viewMode: 'inbox' | 'smart';
  setViewMode: (m: 'inbox' | 'smart') => void;
  swipeProgress: MotionValue<number>;
  inboxItems: Conversation[];
  params: { id?: string } | null;
  conversations: Conversation[];
  setConversationStatus: (id: string, s: any) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const widthRef = useRef<number>(typeof window !== 'undefined' ? window.innerWidth : 375);

  // Smart is LEFT page (x = 0), Inbox is RIGHT page (x = -w).
  // Sync x with viewMode when it changes outside drag (e.g. via tap on toggle).
  useEffect(() => {
    const target = viewMode === 'smart' ? 0 : -widthRef.current;
    animate(x, target, APPLE_SPRING);
  }, [viewMode, x]);

  useEffect(() => {
    const update = () => {
      widthRef.current = trackRef.current?.parentElement?.clientWidth || window.innerWidth;
      // re-snap to current viewMode
      x.set(viewMode === 'smart' ? 0 : -widthRef.current);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Map x → swipeProgress (0 = on current mode, 1 = on other mode).
  useMotionValueEvent(x, 'change', (latest) => {
    const w = widthRef.current || 1;
    const restX = viewMode === 'smart' ? 0 : -w;
    const delta = Math.abs(latest - restX) / w;
    swipeProgress.set(Math.min(1, Math.max(0, delta)));
  });

  const onDragEnd = (
    _: unknown,
    info: { offset: { x: number; y: number }; velocity: { x: number } }
  ) => {
    const w = widthRef.current || 1;
    const thresholdPx = w * 0.3;
    const velocity = info.velocity.x;
    const offset = info.offset.x;

    let next: 'inbox' | 'smart' = viewMode;
    if (viewMode === 'smart') {
      if (offset < -thresholdPx || velocity < -500) next = 'inbox';
    } else {
      if (offset > thresholdPx || velocity > 500) next = 'smart';
    }

    if (next !== viewMode) {
      setViewMode(next);
      animate(x, next === 'smart' ? 0 : -w, APPLE_SPRING);
    } else {
      animate(x, viewMode === 'smart' ? 0 : -w, APPLE_SPRING);
    }
  };

  return (
    <div
      ref={trackRef}
      className="flex-1 relative"
      style={{ overflow: 'hidden', width: '100%', maxWidth: '100vw' }}
    >
      <motion.div
        className="flex h-full"
        style={{ x, width: '200%', willChange: 'transform' }}
        drag="x"
        dragDirectionLock
        dragElastic={0.12}
        dragConstraints={{
          left: -(widthRef.current || 375),
          right: 0,
        }}
        onDragEnd={onDragEnd}
      >
        {/* Smart Inbox page — LEFT (primary) */}
        <div
          className="h-full overflow-y-auto no-scrollbar px-3 pt-[86px] pb-44"
          style={{ width: '50%', flexShrink: 0, touchAction: 'pan-y' }}
        >
          <SmartInboxView conversations={conversations} setConversationStatus={setConversationStatus} params={params} />
        </div>
        {/* Inbox page — RIGHT */}
        <div
          className="h-full overflow-y-auto no-scrollbar px-3 pt-[86px] pb-44"
          style={{ width: '50%', flexShrink: 0, touchAction: 'pan-y' }}
        >
          <InboxModeList items={inboxItems} params={params} />
          {inboxItems.length === 0 && (
            <div className="text-center py-20 text-muted-foreground">
              <p className="text-[14px]">All caught up</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────

// v15.4 — Avatar button used at the top-left of mobile chrome.
// v30.9 — Vervangen door VadikGlass shape="circle" (zelfde recipe als de
// werkende mobile +/Search/Done/Snooze/Forward en desktop sidebar circles).
// `overflow:hidden` op de wrapperStyle zodat de avatar binnen de cirkel blijft.
// v-replaiy — the Replaiy profile menu was removed (all fake template UI),
// but the SB avatar button stays as the mobile top-chrome left slot so we
// can wire it to something later (saves rebuilding). onClick is a no-op
// for now. Kept consistent with CampaignsList.
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

export function InboxList() {
  const {
    conversations,
    smartMode,
    setSmartMode,
    conversationView,
    setConversationView,
    query,
    setConversationStatus,
  } = useReplaiy();
  // Map global smartMode → viewMode-style flag for the existing carousel.
  const viewMode: 'inbox' | 'smart' = smartMode ? 'smart' : 'inbox';
  const setViewMode = (m: 'inbox' | 'smart') => setSmartMode(m === 'smart');
  // v30.34 — useParams() returnt alleen waarde als de component BINNEN
  // een matched <Route>. InboxList rendert als top-level (split pane),
  // dus parsen we de conversation-id zelf uit de URL zodat de selected-
  // highlight werkt wanneer er een gesprek open is in kolom 3.
  // (Route is /conversation/:id sinds de Mail→Conversation rename.)
  const [pathname] = useLocation();
  const conversationIdMatch = pathname.match(/^\/conversation\/([^/?#]+)/);
  const params: { id?: string } | null = conversationIdMatch
    ? { id: decodeURIComponent(conversationIdMatch[1]) }
    : null;
  const isMobile = useIsMobile();

  // Scroll container (desktop / non-carousel use).
  const scrollRef = useRef<HTMLDivElement>(null);
  // Inner scroll for the mobile carousel pages — we want any page to drive
  // glass thickening, but since drag carries entire track, listen on track wrapper.
  const carouselScrollRef = useRef<HTMLDivElement>(null);

  // Track scroll y across whichever container is active.
  const scrollY = useMotionValue(0);
  useEffect(() => {
    const el = isMobile ? null : scrollRef.current;
    if (!el) {
      // Mobile: attach a listener via capture on the carousel pages.
      const handler = (e: Event) => {
        const t = e.target as HTMLElement;
        if (t && t.scrollTop !== undefined) scrollY.set(t.scrollTop);
      };
      document.addEventListener('scroll', handler, true);
      return () => document.removeEventListener('scroll', handler, true);
    }
    const onScroll = () => scrollY.set(el.scrollTop);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [isMobile, scrollY]);

  // Dynamic glass values driven by scrollY.
  const glassAlpha = useTransform(scrollY, [0, 80], [0.35, 0.55], { clamp: true });
  const glassBlur = useTransform(scrollY, [0, 80], [24, 36], { clamp: true });

  // Mirror onto document root so the bottom nav (rendered in Chrome.tsx)
  // can read the same dynamic values via CSS variables.
  useMotionValueEvent(glassAlpha, 'change', (v) => {
    document.documentElement.style.setProperty('--bottom-glass-alpha', String(v));
  });
  useMotionValueEvent(glassBlur, 'change', (v) => {
    document.documentElement.style.setProperty('--bottom-glass-blur', String(v));
  });

  // Swipe progress motion value — used by both carousel + toggle.
  const swipeProgress = useMotionValue(0);

  // v19.1 — mobile chrome: avatar (LEFT), view-selector dropdown (CENTER),
  // default search (RIGHT). Smart toggle pill removed from chrome; lives in
  // Settings (AI section) only.
  // v30.29 — Mobile mail view-dropdown verwijderd; view-switching
  // gebeurt nu via Universal Search modal.
  const togglePill = useMemo(() => null, []);
  const leftSlot = useMemo(() => <MobileProfileAvatar />, []);
  const inboxSlot = useMemo(
    () => ({
      togglePill,
      leftSlot,
      searchPlaceholder: 'Search conversations…',
    }),
    [togglePill, leftSlot]
  );
  useMobileTopChromeSlot(inboxSlot);

  // v15.4 — filter by view-selector (conversationView).
  const inboxItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matchesQ = (m: Conversation) =>
      !q ||
      m.from.name.toLowerCase().includes(q) ||
      m.subject.toLowerCase().includes(q) ||
      m.preview.toLowerCase().includes(q) ||
      m.body.toLowerCase().includes(q);
    return conversations.filter((m) => {
      if (conversationView === 'done') return m.status === 'done' && matchesQ(m);
      if (conversationView === 'snoozed') return m.status === 'snoozed' && matchesQ(m);
      if (conversationView === 'sent') return (m as any).isSent === true && matchesQ(m);
      if (conversationView === 'drafts') return (m as any).isDraft === true && matchesQ(m);
      if (conversationView === 'spam') return m.category === 'promo' && matchesQ(m);
      // Sent emails never appear in inbox
      if ((m as any).isSent === true) return false;
      // Default inbox — primary + fyi + newsletter, non-done.
      if (m.status === 'done') return false;
      if (
        m.category !== 'primary' &&
        m.category !== 'fyi' &&
        m.category !== 'newsletter'
      )
        return false;
      return matchesQ(m);
    });
  }, [conversations, query, conversationView]);

  return (
    <div className="relative flex flex-col h-full min-h-0">
      {isMobile ? (
        <div ref={carouselScrollRef} className="flex-1 min-h-0 flex">
          <MobileCarousel
            viewMode={viewMode}
            setViewMode={setViewMode}
            swipeProgress={swipeProgress}
            inboxItems={inboxItems}
            params={params}
            conversations={conversations}
            setConversationStatus={setConversationStatus}
          />
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto no-scrollbar px-3 lg:px-4 pt-4 lg:pt-5 pb-44 lg:pb-6"
        >
          <AnimatePresence mode="wait">
            {viewMode === 'inbox' ? (
              <motion.div
                key="inbox"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.22 }}
              >
                <InboxModeList items={inboxItems} params={params} />
                {inboxItems.length === 0 && (
                  <div className="text-center py-20 text-muted-foreground">
                    <p className="text-[14px]">All caught up</p>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="smart"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.22 }}
              >
                <SmartInboxView conversations={conversations} setConversationStatus={setConversationStatus} params={params} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
      {/* DotsMenuSheet is route-aware and mounted at the layout level. */}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// (legacy) Dots menu sheet — superseded by the route-aware sheet in
// client/src/components/DotsMenuSheet.tsx (mounted from App.tsx).
// ─────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _LegacyDotsMenuSheet() {
  const { dotsMenuOpen, setDotsMenuOpen, setSheetOpen } = useReplaiy();
  const [, navigate] = useLocation();

  // Drive global sheetOpen so bottom nav + FAB hide while menu is up
  useEffect(() => {
    setSheetOpen(dotsMenuOpen);
    return () => setSheetOpen(false);
  }, [dotsMenuOpen, setSheetOpen]);

  // Source of truth: SECONDARY_NAV + Settings, same array used by the
  // desktop side rail. Adding an item to lib/nav.ts updates BOTH surfaces.
  const items = [...SECONDARY_NAV, SETTINGS_NAV].map((n) => ({
    label: n.label,
    icon: n.icon,
    href: n.href,
    testId: `menu-item-${n.key}`,
  }));

  const go = (href: string) => {
    setDotsMenuOpen(false);
    navigate(href);
  };

  return (
    <AnimatePresence>
      {dotsMenuOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDotsMenuOpen(false)}
            className="fixed inset-0 z-40 bg-black/35 backdrop-blur-[2px]"
            data-testid="dots-menu-overlay"
          />
          <motion.div
            data-testid="dots-menu-sheet"
            initial={{ y: -10, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -10, opacity: 0, scale: 0.96 }}
            transition={APPLE_SPRING}
            style={{ transformOrigin: 'top left' }}
            className="fixed left-3 top-16 z-50 w-[240px] glass-strong rounded-3xl p-2 shadow-2xl"
          >
            <div className="px-3 pt-1.5 pb-2 flex items-center justify-between">
              <span className="text-[11.5px] uppercase tracking-wider font-semibold text-foreground/55">
                Conversations
              </span>
              <button
                onClick={() => setDotsMenuOpen(false)}
                aria-label="Close menu"
                className="h-6 w-6 rounded-full flex items-center justify-center text-icon hover-elevate active-elevate-2"
              >
                <X size={14} strokeWidth={1.8} />
              </button>
            </div>
            <div className="flex flex-col gap-0.5">
              {items.map((it) => {
                const I = it.icon;
                return (
                  <button
                    key={it.label}
                    data-testid={it.testId}
                    onClick={() => go(it.href)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-2xl text-[14px] font-medium text-foreground hover-elevate active-elevate-2 text-left"
                  >
                    <I size={17} strokeWidth={1.6} className="text-foreground/75 shrink-0" />
                    <span>{it.label}</span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
