// ─────────────────────────────────────────────────────────────────
// Feed page · the LinkedIn feed as its own full-pane surface.
//
// A SINGLE vertical scrolling stream of posts (not a list+detail split), with
// TWO modes toggled by a switcher at the top:
//   • "LinkedIn" — the normal LinkedIn feed (the full, unfiltered stream).
//   • "Replaiy"   — only the ICP-relevant posts for the user (no noise), each
//     carrying a quiet relevance chip (e.g. "Matches your ICP"). This is the
//     differentiating value: engagement = intent, so the feed doubles as a
//     lead-sourcing surface.
//
// REUSE (zero new post/engagers components):
//   • PostCard + the full clickable-engagement machinery (EngageContext,
//     EngagersView, EngagersChromeSlot) come from the SHARED
//     @/components/linkedin-post module — the SAME ones the profile view uses.
//     Each tapped count opens the engagers push-in with the reaction filter,
//     pixel-identical to the profile.
//   • The mode toggle is the existing VadikLiquidSwitcher (text variant), same
//     style as the Activity tabs and the lead-panel Overview/Contact tabs.
//   • ReplaiyAvatar for all avatars (inside PostCard).
//   • The full-pane scroll container + mobile-chrome-veil frosting mirror
//     Briefing / MijnAi; the title/toggle register via useMobileTopChromeSlot.
//
// The feed owns its OWN engagers state + chrome slot (priority 400, above the
// feed page's own slot at 100), exactly mirroring the profile's 300/400 idea
// but scoped to the feed (which has no profile above it).
// ─────────────────────────────────────────────────────────────────
import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Rss } from 'lucide-react';
import { useMobileTopChromeSlot } from '@/components/MobileTopChrome';
import { VadikLiquidSwitcher } from '@/components/VadikLiquidSwitcher';
import {
  EngageContext,
  EngagersView,
  EngagersChromeSlot,
  ActivityItem,
  ENGAGE_TITLE,
} from '@/components/linkedin-post';
import { MobileProfileAvatar } from '@/components/InboxList';
import type { EngageRequest } from '@/components/linkedin-post';
import type { LinkedInPost, LinkedInEngager } from '@/data/mockConversations';
import { FEED_POSTS, REPLAIY_FEED_POSTS } from '@/data/mockFeed';

const ACCENT = '#2F6BFF';

// The two feed modes. Normal case labels (never all-caps), English only.
type FeedMode = 'linkedin' | 'replaiy';

// ─── Mobile top-chrome slot for the Feed page ─────────────────────
// Registered at priority 100 (same band as MijnAi's detail slot). It carries
// the mode toggle in the center, so the mode switcher lives in the chrome on
// mobile exactly like list pages put their segmented control there. No back
// button (the feed is a top-level nav surface). For CONSISTENCY WITH THE INBOX,
// the left slot is the shared MobileProfileAvatar (the user's profile avatar),
// NOT the default ••• button — same as InboxList sets leftSlot. Search stays on
// the right.
function FeedChromeSlot({
  mode,
  onChange,
}: {
  mode: FeedMode;
  onChange: (m: FeedMode) => void;
}) {
  const slot = useMemo(
    () => ({
      priority: 100,
      leftSlot: <MobileProfileAvatar />,
      togglePill: (
        <div className="inline-flex items-center h-[52px]" data-testid="feed-mode-toggle-mobile">
          <VadikLiquidSwitcher<FeedMode>
            testId="feed-mode"
            variant="text"
            optionWidth={120}
            scale={0.78}
            value={mode}
            onChange={onChange}
            segments={[
              { key: 'linkedin', label: 'LinkedIn' },
              { key: 'replaiy', label: 'Replaiy' },
            ]}
          />
        </div>
      ),
    }),
    [mode, onChange],
  );
  useMobileTopChromeSlot(slot);
  return null;
}

// ─── Relevance chip · the quiet Replaiy-mode signal ───────────────
// A subtle reason chip shown on Replaiy-mode posts (e.g. "Matches your ICP").
// Blue accent dot + muted normal-case text, on the SAME glass-pill surface used
// elsewhere for small chips. Deliberately quiet so it reads as a signal, not a
// badge that competes with the post.
function RelevanceChip({ reason }: { reason: string }) {
  return (
    <div
      className="mt-3 inline-flex items-center gap-1.5 glass-pill rounded-full h-[22px] pl-2 pr-2.5 text-[11.5px] font-medium text-foreground/70"
      data-testid="feed-relevance-chip"
    >
      <span
        aria-hidden
        className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
        style={{ background: ACCENT }}
      />
      {reason}
    </div>
  );
}

// NOTE — "Add to campaign" hook intentionally NOT rendered.
// The feed is a future lead-sourcing surface, but the Campaigns flow does not
// exist yet, so an "add to campaign" affordance would be premature. When that
// flow ships, the natural attach point is INSIDE FeedItem below (a quiet hook
// under each item / on the engagers push-in). Until then the feed renders
// nothing for it, keeping clean, even vertical spacing between items.

// ─── A single feed item ───────────────────────────────────────────
// Renders the SHARED ActivityItem (the same component the profile Activity tab
// uses), so the feed surfaces the full mix of activity types: plain posts,
// reposts (plain + quote), comments and reactions, each with its attribution
// line on top. The ACTOR is per-item: engagement items (repost/comment/
// reaction) carry their own actor* fields (the person who engaged); plain posts
// have no actor*, so the actor IS the post's author. The Replaiy-mode relevance
// chip is threaded through ActivityItem's slotBeforeStats so it shows on the
// original post exactly as before.
function FeedItem({ post, mode }: { post: LinkedInPost; mode: FeedMode }) {
  // Per-item actor: explicit actor* on engagement items, else the author.
  const actorName = post.actorName ?? post.authorName;
  const actorAvatar = post.actorAvatarUrl ?? post.authorAvatarUrl;
  const actorFirstName = (actorName ?? '').trim().split(/\s+/)[0] || actorName;
  return (
    <div data-testid={`feed-post-${post.id}`}>
      <ActivityItem
        post={post}
        actorFirstName={actorFirstName}
        actorName={actorName}
        actorAvatar={actorAvatar}
        slotBeforeStats={
          mode === 'replaiy' && post.relevanceReason ? (
            <RelevanceChip reason={post.relevanceReason} />
          ) : undefined
        }
      />
    </div>
  );
}

export function Feed() {
  const [mode, setMode] = useState<FeedMode>('linkedin');

  // LinkedIn mode = the full unfiltered stream in natural reverse-chronological
  // order (as you're used to). Replaiy mode = engagement-by-pipeline/ICP
  // prioritized to the top, then ICP posts, with non-relevant noise dropped
  // (the prioritization is precomputed in REPLAIY_FEED_POSTS).
  const posts = useMemo(
    () => (mode === 'replaiy' ? REPLAIY_FEED_POSTS : FEED_POSTS),
    [mode],
  );

  // ── Engagers push-in (who reacted / commented / reposted) ──
  // The feed owns its OWN single engagers view, stacked over the feed pane.
  // Any PostCard's tapped count raises an EngageRequest through EngageContext;
  // we open it here. The mobile EngagersChromeSlot mounts on the open boolean
  // OUTSIDE the engagers exit-animating div (the v-fix-chrome-handoff pattern),
  // at priority 400 — above the feed page's own slot (100) — so Back hands the
  // chrome straight back to the feed's title + toggle.
  const [engage, setEngage] = useState<EngageRequest | null>(null);
  const openEngagers = useMemo(() => (req: EngageRequest) => setEngage(req), []);
  const closeEngagers = useMemo(() => () => setEngage(null), []);
  // Opening a full nested profile for an engager is out of scope here (same as
  // the profile view): keep the row tappable + chevron so the wiring is ready.
  const onOpenEngager = useMemo(
    () => (e: LinkedInEngager) => {
      // eslint-disable-next-line no-console
      console.debug('[feed engager] open profile (no-op for now):', e.name);
    },
    [],
  );

  return (
    <EngageContext.Provider value={openEngagers}>
      {/* Feed mobile chrome (title + mode toggle), priority 100. */}
      <FeedChromeSlot mode={mode} onChange={setMode} />
      {/* Engagers mobile chrome slot (priority 400), mounted on the open boolean
          OUTSIDE the engagers exit-animating div for clean handoff. */}
      {engage && (
        <EngagersChromeSlot
          title={ENGAGE_TITLE[engage.kind]}
          onClose={closeEngagers}
          priority={400}
          backLabel="Back to feed"
        />
      )}

      {/* Full-pane scroll container, same recipe as Briefing / MijnAi. The
          relative + overflow-hidden makes the engagers push-in (absolute
          inset-0) slide within this pane only. */}
      <div className="relative flex flex-col h-full min-h-0 overflow-hidden">
        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
          <div className="px-4 lg:px-8 pt-[calc(env(safe-area-inset-top,0px)+96px)] md:pt-6 pb-24 lg:pb-12 max-w-2xl mx-auto w-full">
            {/* Desktop header · title + the mode toggle. Mobile gets the toggle
                from the top-chrome slot, so this header is md:flex only. */}
            <div className="hidden md:flex items-center justify-between gap-3 mb-5">
              <div className="flex items-center gap-2 min-w-0">
                <Rss size={18} strokeWidth={1.8} className="text-icon shrink-0" />
                <h1 className="text-[22px] font-semibold tracking-[-0.02em] leading-tight m-0">
                  Feed
                </h1>
              </div>
              <VadikLiquidSwitcher<FeedMode>
                testId="feed-mode-desktop"
                variant="text"
                optionWidth={120}
                scale={0.78}
                value={mode}
                onChange={setMode}
                segments={[
                  { key: 'linkedin', label: 'LinkedIn' },
                  { key: 'replaiy', label: 'Replaiy' },
                ]}
              />
            </div>

            {/* Replaiy-mode intro line · a calm one-liner explaining the filter,
                only in Replaiy mode. Muted, normal case. */}
            {mode === 'replaiy' && (
              <p
                className="text-[13px] text-foreground/55 leading-snug mb-4 px-0.5 md:px-0"
                data-testid="feed-replaiy-intro"
              >
                Engagement is intent, so the people in your pipeline reposting,
                commenting and reacting come first, then posts that match your
                ideal customer profile. The noise is filtered out.
              </p>
            )}

            {/* The feed · one vertical stream. AnimatePresence cross-fades the
                set when the mode flips so it does not jump. */}
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={mode}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
                className="flex flex-col gap-3"
              >
                {posts.length > 0 ? (
                  posts.map((post) => (
                    <FeedItem key={post.id} post={post} mode={mode} />
                  ))
                ) : (
                  <p
                    className="text-[12.5px] text-foreground/40 italic m-0 px-0.5"
                    data-testid="feed-empty"
                  >
                    No relevant posts yet
                  </p>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Top frosting veil · same .mobile-chrome-veil last-child trick as the
            profile view, so feed content frosts behind the floating mobile
            chrome instead of scrolling through sharp. Mobile only (md:hidden):
            on desktop the chrome lives inline in the scroll content. MUST be the
            last child so it frosts the scroll content painting before it. */}
        <div
          aria-hidden
          className="md:hidden absolute inset-x-0 top-0 z-[1] h-[calc(env(safe-area-inset-top,0px)+88px)] mobile-chrome-veil pointer-events-none"
        />

        {/* Engagers push-in, stacked OVER the feed at z-[80]. Sibling INSIDE
            this pane so it slides within the feed column. The mobile chrome for
            it lives in EngagersChromeSlot above (on `engage`), not here. */}
        <AnimatePresence>
          {engage && (
            <EngagersView
              key={`feed-engagers-${engage.post.id}-${engage.kind}`}
              post={engage.post}
              kind={engage.kind}
              onClose={closeEngagers}
              onOpenEngager={onOpenEngager}
              zClass="z-[80]"
              backLabel="Back to feed"
            />
          )}
        </AnimatePresence>
      </div>
    </EngageContext.Provider>
  );
}
