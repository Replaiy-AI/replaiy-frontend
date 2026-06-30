// ─────────────────────────────────────────────────────────────────
// Shared LinkedIn post + engagers machinery.
//
// This module is the SINGLE source of truth for the embedded LinkedIn post
// card and its clickable-engagement interaction (tap a "X likes" / "Y comments"
// / "Z reposts" count -> a push-in list of the PEOPLE who engaged, with a
// reaction-type filter). It was EXTRACTED verbatim from LinkedInProfileView so
// that BOTH the profile view AND the new Feed page render posts and engagers
// from the exact same components (pixel-identical, zero duplication).
//
// Exports:
//   • types: EngageKind, EngageRequest
//   • constants: ENGAGE_TITLE, REACTION_LABEL, REACTION_GLYPH, REACTION_ORDER
//   • helpers: noDash, formatCount
//   • context: EngageContext (+ provider value is owned by the host screen)
//   • components: PostCard, ActivityAttribution, EngagerRow, EngagersView,
//     EngagersChromeSlot
//
// Host screens (LinkedInProfileView, FeedPage) own the engagers OPEN state and
// provide EngageContext + mount EngagersView in their own AnimatePresence, each
// with its own chrome-slot priority. EngagersView / EngagersChromeSlot take a
// `priority` so each host can scope the engagers chrome above its own chrome.
// ─────────────────────────────────────────────────────────────────
import { useState, useMemo, useContext, createContext } from 'react';
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ChevronRight, UserPlus, Plus, Check, Clock } from 'lucide-react';
import { APPLE_SPRING } from '@/lib/motion';
import { ReplaiyAvatar } from '@/components/Avatar';
import { ActionPill } from '@/components/ConversationDetailToolbar';
import { useMobileTopChromeSlot } from '@/components/MobileTopChrome';
import { VadikLiquidSwitcher } from '@/components/VadikLiquidSwitcher';
import { useIsMobile } from '@/hooks/use-mobile';
import { engagersFor } from '@/data/mockConversations';
import type {
  LinkedInPost,
  LinkedInReactionKind,
  LinkedInEngager,
} from '@/data/mockConversations';

// ─── Engagers push-in · the kind a tapped count opens ─────────────
// Tapping a post's "X likes" / "Y comments" / "Z reposts" count opens a push-in
// list of the PEOPLE who engaged. These three kinds map 1:1 onto engagersFor().
export type EngageKind = 'reactions' | 'comments' | 'reposts';

// Title shown in the engagers view chrome (mobile slot + desktop centered
// title), mirroring LinkedIn's screen titles. Normal case, English only.
export const ENGAGE_TITLE: Record<EngageKind, string> = {
  reactions: 'Reactions',
  comments: 'Comments',
  reposts: 'Reposts',
};

// A request to open the engagers view for a specific post + kind. Any PostCard
// anywhere in the tree raises this through context; the top-level host screen
// (profile view or feed) owns the actual push-in view + its chrome, so there is
// exactly ONE engagers view stacked over each host (never one per card).
export interface EngageRequest {
  post: LinkedInPost;
  kind: EngageKind;
}

// Context lets a deeply-nested PostCard's stats buttons open the single
// top-level engagers view without prop-drilling. Defaults to a no-op so a
// PostCard rendered outside a host (none today) is inert.
export const EngageContext = createContext<(req: EngageRequest) => void>(() => {});

// ─── Profile-open context · click a person -> open their full profile ─
// On a real LinkedIn feed you tap a person's NAME or AVATAR to open their full
// profile. Rather than prop-drill a click handler into PostCard's header and
// ActivityItem's actor block, the host provides this context (mirroring the
// EngageContext pattern above). A person's identity becomes clickable ONLY when
// `canOpen(name)` passes, and clicking calls `open(name)`.
//
// The DEFAULT is fully inert: `canOpen` always returns false and `open` is a
// no-op. So any consumer NOT wired by a host (the profile view, the engagers
// list) keeps its names as plain text exactly as before. The FEED provides a
// real value that returns true only for the three pipeline leads.
export interface ProfileOpenValue {
  canOpen: (personName: string) => boolean;
  open: (personName: string) => void;
}
export const ProfileOpenContext = createContext<ProfileOpenValue>({
  canOpen: () => false,
  open: () => {},
});

// Strict no em-dash normaliser (the design system bans em-dashes in all
// user-facing text). Shared mock copy is already clean, but we guard anyway.
export function noDash(s: string) {
  return s.replace(/\s*\u2014\s*/g, ' ');
}

// Compact follower / connection / engagement count, e.g. 5278 -> "5,278".
export function formatCount(n: number): string {
  return n.toLocaleString('en-US');
}

// The single UI accent (mirrors LinkedInProfileView's ACCENT). ACCENT there is
// a module-local const (not exported), so we use the established literal here
// rather than reach across modules. Brand badges are the only other blue.
const ACCENT = '#2F6BFF';

// ─── Post header · Connect / Follow action (FEED ONLY) ────────────
// LinkedIn's feed shows a subtle accent text+icon action in the post header's
// top-right: "Connect" (UserPlus) for a person you are not connected to, or
// "Follow" (Plus) for a company / page. It is deliberately LIGHT (accent text +
// icon, NOT a heavy filled pill) because it appears on many posts and must not
// dominate the stream. Clicking is purely client-side here (no backend): the
// button toggles to a calm, muted "Pending" (connect) / "Following" (follow)
// confirmed state so it FEELS real. Local useState keeps each post's button
// independent. Normal case, no all-caps, no em-dash / middot.
function ConnectionAction({
  action,
  postId,
}: {
  action: 'connect' | 'follow';
  postId: string;
}) {
  const [done, setDone] = useState(false);
  // Default (un-toggled) copy + icon, in accent.
  const DefaultIcon = action === 'connect' ? UserPlus : Plus;
  const defaultLabel = action === 'connect' ? 'Connect' : 'Follow';
  // Confirmed (toggled) copy + icon, in muted foreground/55.
  const DoneIcon = action === 'connect' ? Clock : Check;
  const doneLabel = action === 'connect' ? 'Pending' : 'Following';
  const Icon = done ? DoneIcon : DefaultIcon;
  const label = done ? doneLabel : defaultLabel;
  return (
    <button
      type="button"
      onClick={() => setDone((v) => !v)}
      data-testid={`post-${postId}-connect`}
      aria-pressed={done}
      className={
        'shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-1 -mr-1 text-[13px] font-semibold leading-none hover-elevate active-elevate-2 transition-colors ' +
        (done ? 'text-foreground/55' : '')
      }
      style={done ? undefined : { color: ACCENT }}
    >
      <Icon size={15} strokeWidth={2} aria-hidden />
      {label}
    </button>
  );
}

// ─── Activity · reaction label map ────────────────────────────────
// Maps a LinkedInReactionKind to the exact word LinkedIn uses in its reaction
// chips.
export const REACTION_LABEL: Record<LinkedInReactionKind, string> = {
  like: 'Like',
  celebrate: 'Celebrate',
  support: 'Support',
  love: 'Love',
  insightful: 'Insightful',
  funny: 'Funny',
};

// Tiny reaction glyph LinkedIn shows next to each reactor in its reactions
// list. A small emoji is the calmest way to indicate the reaction type without
// adding any new icon primitive or off-palette colour. Used by the engagers
// list (reactions kind) and the reaction filter tabs.
export const REACTION_GLYPH: Record<LinkedInReactionKind, string> = {
  like: '\uD83D\uDC4D',
  celebrate: '\uD83D\uDC4F',
  support: '\uD83E\uDEF6',
  love: '\u2764\uFE0F',
  insightful: '\uD83D\uDCA1',
  funny: '\uD83D\uDE04',
};

// Order in which reaction filter tabs appear (LinkedIn's own ordering), so the
// tab row is stable regardless of the order reactions happen to appear in the
// list. Only types actually present in the list get a tab.
export const REACTION_ORDER: LinkedInReactionKind[] = [
  'like', 'celebrate', 'support', 'love', 'insightful', 'funny',
];

// ─── Activity · single post card ──────────────────────────────────
// A calm, read-only embedded post card (NOT a copy of LinkedIn's chrome).
// Header row: ReplaiyAvatar + author name (semibold) and truncated headline
// stacked, with timeAgo muted on the right (no "·" separator, pure layout).
// Body: post text using the SAME clamp recipe as AboutSection (maxHeight cap +
// WebkitMaskImage gradient fade + a "See more" / "Show less" toggle). Optional
// image in a rounded, height-capped container. Stats row shows likes /
// comments / reposts as muted counts separated by spacing (never a middot),
// omitting any count that is undefined or zero. usedByAI is deliberately NOT
// surfaced: every post renders neutrally and identically.
//
// `nested` renders OPTIONAL subordinate content INSIDE the card, below the
// stats row, separated by a thin hairline divider.
// `slotBeforeStats` lets a host inject quiet content (e.g. the feed's
// "Matches your ICP" relevance chip) between the body/image and the stats row,
// without touching the card internals.
export function PostCard({
  post,
  nested,
  embedded,
  slotBeforeStats,
  showConnectionAction,
}: {
  post: LinkedInPost;
  nested?: ReactNode;
  // v-repost — When `embedded` the card drops its OWN rp-card surface and
  // becomes transparent padding only, because it is rendered INSIDE the inset
  // reshared-content container of a quote repost (which already supplies the
  // surface + border). Everything else (header, clamp, image, stats) is
  // identical, so a reshared post reads exactly like any other post, just
  // contained. Default (false) keeps the standalone rp-card exactly as before.
  embedded?: boolean;
  // Optional quiet content rendered just above the stats row. Used by the feed
  // for its relevance chip; the profile view never passes it, so the profile
  // card is byte-for-byte identical to before.
  slotBeforeStats?: ReactNode;
  // FEED ONLY opt-in. When true AND post.connectionAction is 'connect' or
  // 'follow', the header's top-right shows the subtle Connect / Follow action
  // (targeting the post AUTHOR). The PROFILE leaves this default (false), so its
  // activity posts never show a per-post action — the profile hero already has
  // the single Connect button, and duplicating it per-post would be wrong.
  showConnectionAction?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  // Same threshold rationale as AboutSection: clamp once it is worth clamping.
  const canClamp = post.text.length > 220;

  // Author identity -> open their full profile, but ONLY when the host's
  // ProfileOpenContext says this person is openable (a pipeline lead in the
  // feed). Otherwise the name/avatar stay plain text/inert, exactly as before.
  const profileCtx = useContext(ProfileOpenContext);
  const authorOpenable = profileCtx.canOpen(post.authorName);
  const openAuthor = () => profileCtx.open(post.authorName);

  // FEED ONLY — the Connect / Follow header action. Shown only when the host
  // opts in (showConnectionAction) AND the post asks for a real action. The
  // action targets the post author. When shown, it claims the header's
  // top-right slot, so timeAgo drops to a small muted line under the headline
  // (mirroring LinkedIn, and keeping the top-right uncrowded on mobile). When
  // NOT shown, timeAgo stays top-right exactly as before (profile unaffected).
  const action = post.connectionAction;
  const showAction =
    !!showConnectionAction && (action === 'connect' || action === 'follow');

  // Tappable stats segments. Each non-zero count becomes its OWN <button> that
  // opens the engagers push-in for that kind (likes -> reactions, since
  // LinkedIn files reactions under the likes count). Zero counts are omitted.
  const openEngagers = useContext(EngageContext);
  const statSegments: { key: EngageKind; label: string; testId: string }[] = [];
  if (post.likes)
    statSegments.push({
      key: 'reactions',
      label: `${formatCount(post.likes)} likes`,
      testId: `post-${post.id}-open-reactions`,
    });
  if (post.comments)
    statSegments.push({
      key: 'comments',
      label: `${formatCount(post.comments)} comments`,
      testId: `post-${post.id}-open-comments`,
    });
  if (post.reposts)
    statSegments.push({
      key: 'reposts',
      label: `${formatCount(post.reposts)} reposts`,
      testId: `post-${post.id}-open-reposts`,
    });

  return (
    <div
      className={
        embedded
          ? 'px-4 py-3.5'
          : 'rp-card rounded-[20px] px-4 py-3.5'
      }
      data-testid={`profile-post-${post.id}`}
    >
      {/* Header row · avatar + name/headline stack + (right) either the time-ago
          (default, profile + actionless feed posts) OR, in the feed when the
          host opts in, the subtle Connect / Follow action. When the action is
          shown it takes the top-right slot and timeAgo drops to a small muted
          line UNDER the headline, so the top-right never crowds on mobile and
          the name/headline keep truncating cleanly. When the author is openable
          (a lead, in the feed) the avatar + name become a clickable affordance
          to push in their full profile; otherwise they render as plain, inert
          identity exactly as before. */}
      <div className="flex items-start gap-2.5">
        {authorOpenable ? (
          <button
            type="button"
            onClick={openAuthor}
            data-testid={`post-${post.id}-open-author-avatar`}
            aria-label={`Open ${noDash(post.authorName)}'s profile`}
            className="shrink-0 rounded-full hover-elevate active-elevate-2"
          >
            <ReplaiyAvatar name={post.authorName} src={post.authorAvatarUrl} size={36} />
          </button>
        ) : (
          <ReplaiyAvatar name={post.authorName} src={post.authorAvatarUrl} size={36} />
        )}
        <div className="min-w-0 flex-1">
          {authorOpenable ? (
            <button
              type="button"
              onClick={openAuthor}
              data-testid={`post-${post.id}-open-author-name`}
              className="block max-w-full text-left text-[13px] font-semibold tracking-[-0.005em] text-foreground leading-snug truncate hover:underline underline-offset-2 cursor-pointer"
            >
              {noDash(post.authorName)}
            </button>
          ) : (
            <div className="text-[13px] font-semibold tracking-[-0.005em] text-foreground leading-snug truncate">
              {noDash(post.authorName)}
            </div>
          )}
          {post.authorHeadline && (
            <div className="text-[11.5px] text-foreground/55 leading-snug truncate">
              {noDash(post.authorHeadline)}
            </div>
          )}
          {/* When the action owns the top-right, timeAgo sits here as a small
              muted line under the headline (LinkedIn-style). */}
          {showAction && (
            <div className="text-[11.5px] text-foreground/45 leading-snug tabular-nums mt-0.5">
              {noDash(post.timeAgo)}
            </div>
          )}
        </div>
        {showAction ? (
          <ConnectionAction action={action as 'connect' | 'follow'} postId={post.id} />
        ) : (
          <span className="text-[11.5px] text-foreground/45 leading-snug shrink-0 tabular-nums mt-0.5">
            {noDash(post.timeAgo)}
          </span>
        )}
      </div>

      {/* Body · clamped post text (AboutSection recipe). */}
      <div
        className="relative mt-2.5"
        style={
          !expanded && canClamp
            ? {
                maxHeight: 'calc(1.55em * 4)',
                overflow: 'hidden',
                WebkitMaskImage:
                  'linear-gradient(to bottom, black 60%, transparent 100%)',
                maskImage:
                  'linear-gradient(to bottom, black 60%, transparent 100%)',
              }
            : undefined
        }
      >
        <p
          className="text-[13px] leading-[1.55] text-foreground/80 m-0 whitespace-pre-line break-words"
          data-testid={`profile-post-text-${post.id}`}
        >
          {noDash(post.text)}
        </p>
      </div>
      {canClamp && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          data-testid={`profile-post-toggle-${post.id}`}
          className="mt-1 inline-flex items-center text-[12.5px] font-semibold text-foreground/70 hover-elevate active-elevate-2 rounded-md px-1 -mx-1"
        >
          {expanded ? 'Show less' : 'See more'}
        </button>
      )}

      {/* Optional media · a post carries AT MOST one media type, mirroring
          LinkedIn (you cannot have a native image AND a link-preview on the
          same post). Render priority: video > image > linkPreview. Mock data
          only ever sets one per post, but the guards keep it deterministic. */}

      {/* Inline video · native <video> with poster + controls, no autoplay
          (calm by default, the user taps play). Same rounded, height-capped
          container as the image so video and image read consistently. */}
      {post.videoUrl ? (
        <div className="mt-3 rounded-xl overflow-hidden bg-foreground/[0.06] dark:bg-white/[0.07]">
          <video
            src={post.videoUrl}
            poster={post.videoPosterUrl}
            controls
            playsInline
            preload="metadata"
            data-testid={`post-${post.id}-video`}
            className="w-full max-h-[360px] object-contain bg-black block"
          />
        </div>
      ) : post.imageUrl ? (
        /* Optional image · rounded, height-capped so one image never dominates. */
        <div className="mt-3 rounded-xl overflow-hidden bg-foreground/[0.06] dark:bg-white/[0.07]">
          <img
            src={post.imageUrl}
            alt=""
            loading="lazy"
            className="w-full max-h-[240px] object-cover block"
          />
        </div>
      ) : post.linkPreview ? (
        /* Link-preview card · a tappable shared-article card. Reuses the EXACT
           embedded-repost inset surface (border + faint fill) used for the
           reshared-content container below, so all inset surfaces match. */
        <a
          href={post.linkPreview.url}
          target="_blank"
          rel="noopener noreferrer"
          data-testid={`post-${post.id}-linkpreview`}
          className="mt-3 flex items-stretch rounded-[12px] overflow-hidden border border-foreground/[0.08] dark:border-white/[0.08] bg-foreground/[0.02] dark:bg-white/[0.02] hover-elevate active-elevate-2"
        >
          {post.linkPreview.imageUrl && (
            <img
              src={post.linkPreview.imageUrl}
              alt=""
              loading="lazy"
              className="w-[96px] sm:w-[112px] shrink-0 self-stretch object-cover bg-foreground/[0.06] dark:bg-white/[0.07]"
            />
          )}
          <div className="min-w-0 flex-1 px-3 py-2.5 flex flex-col justify-center gap-1">
            <div
              className="text-[13px] font-semibold tracking-[-0.005em] text-foreground leading-snug"
              style={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {noDash(post.linkPreview.title)}
            </div>
            <div className="text-[11.5px] text-foreground/50 leading-snug truncate">
              {post.linkPreview.domain}
            </div>
          </div>
        </a>
      ) : null}

      {/* Optional quiet content above the stats (e.g. feed relevance chip). */}
      {slotBeforeStats}

      {/* Stats row · each count is its OWN tappable <button> opening the
          engagers push-in (who reacted / commented / reposted), mirroring
          LinkedIn. */}
      {statSegments.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-3 text-[12px] text-foreground/50 tabular-nums">
          {statSegments.map((s) => (
            <button
              key={s.key}
              type="button"
              data-testid={s.testId}
              onClick={() => openEngagers({ post, kind: s.key })}
              className="rounded-md px-1 -mx-1 hover-elevate active-elevate-2 hover:text-foreground/70 hover:underline underline-offset-2 transition-colors"
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {/* Optional nested content (e.g. the profile person's own comment),
          separated by a hairline divider so it reads as subordinate to the
          post above it, inside the SAME card. */}
      {nested && (
        <div className="mt-3 pt-3 border-t border-foreground/[0.08] dark:border-white/[0.08]">
          {nested}
        </div>
      )}
    </div>
  );
}

// ─── Activity · attribution line ──────────────────────────────────
// The small muted line LinkedIn shows ABOVE a comment / reaction card, e.g.
// "Emma commented on Marcus Lindqvist's post". Em-dash-free and middot-free by
// construction (plain words + a possessive).
export function ActivityAttribution({
  profileFirstName,
  actorName,
  verb,
  authorName,
  reactionLabel,
}: {
  profileFirstName: string;
  // The actor's FULL name, used only for the ProfileOpenContext lookup so the
  // actor's first-name span can become clickable when the actor is openable (a
  // lead, in the feed). Optional: when omitted (or not openable) the name stays
  // plain text exactly as before, so the profile/engagers views are unaffected.
  actorName?: string;
  // v-attribution-all — Every Activity item now shows an attribution line:
  //   'posted'    -> "[First] posted this"            (no author/possessive)
  //   'reposted'  -> "[First] reposted [author]'s post"
  //   'commented' -> "[First] commented on [author]'s post"
  //   'reacted'   -> "[First] reacted to [author]'s post"
  // For a QUOTE repost the caller passes verb 'reposted' WITHOUT an authorName.
  verb: 'posted' | 'reposted' | 'commented' | 'reacted';
  authorName?: string;
  reactionLabel?: string;
}) {
  // Possessive that handles names already ending in s (e.g. "Sofia Reyes'").
  const trimmed = noDash(authorName ?? '').trim();
  const possessive = /s$/i.test(trimmed) ? `${trimmed}'` : `${trimmed}'s`;
  const hasAuthor = trimmed.length > 0;
  // The actor's name is clickable only when the host says it is openable.
  const profileCtx = useContext(ProfileOpenContext);
  const actorOpenable = !!actorName && profileCtx.canOpen(actorName);
  let tail: ReactNode;
  if (verb === 'posted' || (verb === 'reposted' && !hasAuthor)) {
    tail = <>this</>;
  } else {
    const preposition = verb === 'commented' ? 'on ' : verb === 'reacted' ? 'to ' : '';
    tail = (
      <>
        {preposition}
        <span className="font-medium text-foreground/65">{possessive}</span> post
      </>
    );
  }
  return (
    <div className="flex items-center flex-wrap gap-x-1.5 gap-y-0.5 mb-1.5 px-0.5 text-[12px] text-foreground/50 leading-snug">
      <span className="min-w-0">
        {actorOpenable ? (
          <button
            type="button"
            onClick={() => actorName && profileCtx.open(actorName)}
            data-testid="attribution-open-actor"
            className="font-semibold text-foreground/65 hover:underline underline-offset-2 cursor-pointer"
          >
            {profileFirstName}
          </button>
        ) : (
          <span className="font-semibold text-foreground/65">{profileFirstName}</span>
        )}{' '}
        {verb} {tail}
      </span>
      {reactionLabel && (
        <span className="glass-pill rounded-full inline-flex items-center h-[18px] px-2 text-[11px] font-medium text-foreground/60">
          {reactionLabel}
        </span>
      )}
    </div>
  );
}

// ─── Activity · single activity item (EXTRACTED-SHARED) ───────────
// EXTRACTED-SHARED: ActivityItem (one activity row) lives here so BOTH the
// profile Activity tab and the Feed render activity identically. Switches on
// post.kind ('post'|'repost'|'comment'|'reaction'), including quote-reposts.
//
// ACTOR-PER-ITEM: the actor is the PERSON whose activity this is (who reposted /
// commented / reacted / posted). On a PROFILE every item is by the profile
// owner, so the host passes the profile owner's name. In the FEED each item is
// by a DIFFERENT person, so the host passes that item's actor. The author*
// fields on `post` always describe the ORIGINAL post (by someone else for
// repost/comment/reaction). Extracted verbatim from LinkedInProfileView, with
// `profileFirstName/profileName/profileAvatar` renamed to neutral actor* props.
//
// `slotBeforeStats` is threaded straight to the inner PostCard so a host (the
// feed) can inject its quiet relevance chip. The profile never passes it, so
// the profile's cards stay byte-for-byte identical.
export function ActivityItem({
  post,
  actorFirstName,
  actorName,
  actorAvatar,
  slotBeforeStats,
  hidePostedAttribution = false,
  showConnectionAction = false,
}: {
  post: LinkedInPost;
  actorFirstName: string;
  actorName: string;
  actorAvatar?: string;
  slotBeforeStats?: ReactNode;
  // FEED ONLY opt-in, threaded straight to the inner PostCard (exactly like
  // slotBeforeStats) so the feed can surface the per-post Connect / Follow
  // header action. The action always targets the original post's AUTHOR (the
  // person whose content the card header shows), including the original-author
  // card of a repost / comment / reaction item. The PROFILE never passes this,
  // so its activity posts stay byte-for-byte identical (no per-post action).
  showConnectionAction?: boolean;
  // v-feed-no-posted-attribution — In the FEED, a person's OWN plain post shows
  // just the card (their name + headline already live in the PostCard header),
  // with NO "X posted this" line above it, exactly like a real LinkedIn feed.
  // The PROFILE Activity tab leaves this default (false) so it keeps showing
  // "[First] posted this" on every item (an approved per-person activity log).
  // This ONLY affects the plain 'post' branch; repost/comment/reaction keep
  // their attribution line in both hosts.
  hidePostedAttribution?: boolean;
}) {
  const kind = post.kind ?? 'post';

  // The actor's name is clickable in the repost-commentary block only when the
  // host's ProfileOpenContext says it is openable (a lead, in the feed). The
  // default context is inert, so the profile/engagers views are unaffected.
  const profileCtx = useContext(ProfileOpenContext);
  const actorOpenable = profileCtx.canOpen(actorName);
  const openActor = () => profileCtx.open(actorName);

  if (kind === 'comment') {
    const reply = post.activityComment ? (
      <div
        className="flex items-start gap-2.5"
        data-testid={`activity-comment-${post.id}`}
      >
        <ReplaiyAvatar name={actorName} src={actorAvatar} size={28} />
        <div className="min-w-0 flex-1">
          <span className="text-[12px] font-semibold tracking-[-0.005em] text-foreground leading-snug">
            {noDash(actorName)}
          </span>
          <p className="text-[12.5px] leading-[1.5] text-foreground/70 m-0 mt-0.5 break-words">
            {noDash(post.activityComment)}
          </p>
        </div>
      </div>
    ) : undefined;
    return (
      <div data-testid={`activity-item-${post.id}`}>
        <ActivityAttribution
          profileFirstName={actorFirstName}
          actorName={actorName}
          verb="commented"
          authorName={post.authorName}
        />
        <PostCard
          post={post}
          nested={reply}
          slotBeforeStats={slotBeforeStats}
          showConnectionAction={showConnectionAction}
        />
      </div>
    );
  }

  if (kind === 'reaction') {
    return (
      <div data-testid={`activity-item-${post.id}`}>
        <ActivityAttribution
          profileFirstName={actorFirstName}
          actorName={actorName}
          verb="reacted"
          authorName={post.authorName}
          reactionLabel={
            post.activityReaction ? REACTION_LABEL[post.activityReaction] : undefined
          }
        />
        <PostCard
          post={post}
          slotBeforeStats={slotBeforeStats}
          showConnectionAction={showConnectionAction}
        />
      </div>
    );
  }

  if (kind === 'repost') {
    if (post.activityComment) {
      return (
        <div data-testid={`activity-item-${post.id}`}>
          <ActivityAttribution
            profileFirstName={actorFirstName}
            actorName={actorName}
            verb="reposted"
          />
          <div className="rp-card rounded-[20px] px-4 py-3.5">
            <div
              className="flex items-start gap-2.5"
              data-testid={`activity-repost-comment-${post.id}`}
            >
              {actorOpenable ? (
                <button
                  type="button"
                  onClick={openActor}
                  aria-label={`Open ${noDash(actorName)}'s profile`}
                  className="shrink-0 rounded-full hover-elevate active-elevate-2"
                >
                  <ReplaiyAvatar name={actorName} src={actorAvatar} size={36} />
                </button>
              ) : (
                <ReplaiyAvatar name={actorName} src={actorAvatar} size={36} />
              )}
              <div className="min-w-0 flex-1">
                {actorOpenable ? (
                  <button
                    type="button"
                    onClick={openActor}
                    className="block max-w-full text-left text-[13px] font-semibold tracking-[-0.005em] text-foreground leading-snug truncate hover:underline underline-offset-2 cursor-pointer"
                  >
                    {noDash(actorName)}
                  </button>
                ) : (
                  <div className="text-[13px] font-semibold tracking-[-0.005em] text-foreground leading-snug truncate">
                    {noDash(actorName)}
                  </div>
                )}
                <p className="text-[13px] leading-[1.55] text-foreground/80 m-0 mt-1 whitespace-pre-line break-words">
                  {noDash(post.activityComment)}
                </p>
              </div>
            </div>
            {/* Relevance chip (if any) sits between the commentary and the
                embedded post, against the whole repost unit. */}
            {slotBeforeStats}
            <div className="mt-3 rounded-[16px] overflow-hidden border border-foreground/[0.08] dark:border-white/[0.08] bg-foreground/[0.02] dark:bg-white/[0.02]">
              <PostCard post={post} embedded showConnectionAction={showConnectionAction} />
            </div>
          </div>
        </div>
      );
    }
    return (
      <div data-testid={`activity-item-${post.id}`}>
        <ActivityAttribution
          profileFirstName={actorFirstName}
          actorName={actorName}
          verb="reposted"
          authorName={post.authorName}
        />
        <PostCard
          post={post}
          slotBeforeStats={slotBeforeStats}
          showConnectionAction={showConnectionAction}
        />
      </div>
    );
  }

  // Plain post. In the feed (hidePostedAttribution) we render JUST the card,
  // with the post's author in its header and NO "X posted this" line above it.
  // The profile leaves the default, so it still shows "[First] posted this".
  return (
    <div data-testid={`activity-item-${post.id}`}>
      {!hidePostedAttribution && (
        <ActivityAttribution
          profileFirstName={actorFirstName}
          actorName={actorName}
          verb="posted"
        />
      )}
      <PostCard
        post={post}
        slotBeforeStats={slotBeforeStats}
        showConnectionAction={showConnectionAction}
      />
    </div>
  );
}

// ─── Engagers · single person row ─────────────────────────────────
// One person who engaged with the post. Mirrors LinkedIn's reactions /
// comments / reposts list rows: ReplaiyAvatar (44) + name (semibold) + headline
// (muted, truncated). For 'reactions' a tiny reaction glyph + normal-case label
// sits on the trailing edge. For 'comments' the comment text renders beneath.
// The WHOLE row is a tappable button carrying a trailing chevron.
export function EngagerRow({
  engager,
  kind,
  onOpen,
}: {
  engager: LinkedInEngager;
  kind: EngageKind;
  onOpen: (engager: LinkedInEngager) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(engager)}
      data-testid={`engager-${engager.id}`}
      className="w-full text-left rp-card rounded-[16px] px-3.5 py-3 flex items-start gap-3 hover-elevate active-elevate-2"
    >
      <ReplaiyAvatar name={engager.name} src={engager.avatarUrl} size={44} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 text-[14px] font-semibold tracking-[-0.005em] text-foreground leading-snug truncate">
            {noDash(engager.name)}
          </span>
          {kind === 'reactions' && engager.reaction && (
            <span className="shrink-0 inline-flex items-center gap-1 text-[11.5px] text-foreground/55">
              <span aria-hidden className="text-[13px] leading-none">
                {REACTION_GLYPH[engager.reaction]}
              </span>
              {REACTION_LABEL[engager.reaction]}
            </span>
          )}
        </div>
        {engager.headline && (
          <div className="text-[12px] text-foreground/55 leading-snug truncate mt-0.5">
            {noDash(engager.headline)}
          </div>
        )}
        {kind === 'comments' && engager.comment && (
          <p className="text-[12.5px] leading-[1.5] text-foreground/70 m-0 mt-1.5 break-words">
            {noDash(engager.comment)}
          </p>
        )}
      </div>
      {/* Trailing chevron · the "open this person" affordance. */}
      <ChevronRight
        size={16}
        strokeWidth={1.8}
        className="shrink-0 text-foreground/30 mt-0.5"
        aria-hidden
      />
    </button>
  );
}

// ─── Engagers · mobile top-chrome slot ────────────────────────────
// Registered at a host-supplied `priority` so the host can place it ABOVE its
// own chrome. The profile view uses 400 (above its profile slot 300); the feed
// uses 400 (above the feed page's own slot 100). Mounted by the host on the
// engagers `open` boolean and OUTSIDE the engagers exit-animating div, so it
// de-registers the instant Back is tapped and the chrome hands straight back
// to the host's slot. Same v-fix-chrome-handoff pattern as ProfileChromeSlot.
export function EngagersChromeSlot({
  title,
  onClose,
  priority = 400,
  backLabel = 'Back',
}: {
  title: string;
  onClose: () => void;
  priority?: number;
  backLabel?: string;
}) {
  const slot = useMemo(
    () => ({
      priority,
      leftSlot: (
        <ActionPill testId="engagers-back" label={backLabel} onClick={onClose}>
          <ArrowLeft size={22} strokeWidth={1.7} className="text-icon" />
        </ActionPill>
      ),
      togglePill: (
        <div className="inline-flex items-center px-1 h-[52px]">
          <span className="text-[14px] font-semibold tracking-[-0.005em] text-foreground">
            {title}
          </span>
        </div>
      ),
      rightSlot: <div style={{ width: 52, height: 52 }} aria-hidden="true" />,
    }),
    [title, onClose, priority, backLabel],
  );
  useMobileTopChromeSlot(slot);
  return null;
}

// ─── Engagers · push-in view ──────────────────────────────────────
// The list of PEOPLE who engaged with a post, pushed in OVER the host using the
// EXACT same recipe everywhere: a motion.div with initial x:'100%' / animate
// x:0 / exit x:'100%' + APPLE_SPRING, absolute inset-0. `zClass` lets the host
// place it in its own stacking context (profile uses z-[80] over its z-[70]
// view; feed uses z-[80] over its full pane). The desktop floating-back
// ActionPill + centered title + the .mobile-chrome-veil top frosting match the
// profile view; the MOBILE chrome lives in EngagersChromeSlot, mounted by the
// host on the open boolean.
//
// Content: for 'reactions' a reaction-type filter row (All + only the reaction
// types actually present), reusing VadikLiquidSwitcher (text variant); then an
// EngagerRow per person. A muted empty state shows if somehow empty.
export function EngagersView({
  post,
  kind,
  onClose,
  onOpenEngager,
  zClass = 'z-[80]',
  backLabel = 'Back',
}: {
  post: LinkedInPost;
  kind: EngageKind;
  onClose: () => void;
  onOpenEngager: (engager: LinkedInEngager) => void;
  zClass?: string;
  backLabel?: string;
}) {
  const isMobile = useIsMobile();
  const engagers = useMemo(() => engagersFor(post, kind), [post, kind]);
  const title = ENGAGE_TITLE[kind];

  const [reactionFilter, setReactionFilter] = useState<'all' | LinkedInReactionKind>('all');
  const presentReactions = useMemo(() => {
    if (kind !== 'reactions') return [] as LinkedInReactionKind[];
    const set = new Set<LinkedInReactionKind>();
    engagers.forEach((e) => e.reaction && set.add(e.reaction));
    return REACTION_ORDER.filter((r) => set.has(r));
  }, [engagers, kind]);

  const filterSegments = useMemo(() => {
    const segs: { key: 'all' | LinkedInReactionKind; label: string; width: number }[] = [
      { key: 'all', label: 'All', width: 60 },
    ];
    presentReactions.forEach((r) => {
      segs.push({ key: r, label: REACTION_GLYPH[r], width: 50 });
    });
    return segs;
  }, [presentReactions]);

  const visible = useMemo(() => {
    if (kind !== 'reactions' || reactionFilter === 'all') return engagers;
    return engagers.filter((e) => e.reaction === reactionFilter);
  }, [engagers, kind, reactionFilter]);

  return (
    <motion.div
      key="linkedin-engagers-view"
      data-testid="linkedin-engagers-view"
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={APPLE_SPRING}
      className={`absolute inset-0 ${zClass} flex flex-col bg-background overflow-hidden`}
    >
      {/* Desktop chrome row · floating back ActionPill (left, 52px), a truly-
          centered title, and a 52px right spacer. md:flex only; mobile uses
          EngagersChromeSlot. */}
      <div className="hidden md:flex items-center justify-between gap-2.5 absolute top-3 left-3 right-3 z-[2] pointer-events-none">
        <div className="pointer-events-auto shrink-0">
          <ActionPill testId="engagers-back" label={backLabel} onClick={onClose}>
            <ArrowLeft size={22} strokeWidth={1.7} className="text-icon" />
          </ActionPill>
        </div>
        <span className="min-w-0 flex-1 text-center text-[13px] font-semibold tracking-[-0.005em] text-foreground truncate">
          {title}
        </span>
        <div className="shrink-0" style={{ width: 52, height: 52 }} aria-hidden="true" />
      </div>

      {/* Scroll surface · content scrolls UNDER the floating back pill. */}
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
        <div className="px-4 pb-10 flex flex-col gap-3 pt-[calc(env(safe-area-inset-top,0px)+88px)] md:pt-[72px]">
          {kind === 'reactions' && presentReactions.length > 1 && (
            <div className={(isMobile ? 'flex justify-center w-full' : 'inline-flex') + ' mb-1'}>
              <VadikLiquidSwitcher<'all' | LinkedInReactionKind>
                testId="engagers-reaction-filter"
                variant="text"
                scale={0.72}
                textPaddingX={12}
                value={reactionFilter}
                onChange={setReactionFilter}
                segments={filterSegments}
              />
            </div>
          )}

          {visible.length > 0 ? (
            <div className="flex flex-col gap-2">
              {visible.map((e) => (
                <EngagerRow
                  key={e.id}
                  engager={e}
                  kind={kind}
                  onOpen={onOpenEngager}
                />
              ))}
            </div>
          ) : (
            <p
              className="text-[12.5px] text-foreground/40 italic m-0 px-0.5"
              data-testid="engagers-empty"
            >
              No people to show
            </p>
          )}
        </div>
      </div>

      {/* Top frosting veil · same .mobile-chrome-veil last-child trick. MUST be
          the last child so it frosts the scroll content painting before it. */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 z-[1] h-[calc(env(safe-area-inset-top,0px)+88px)] md:h-[76px] mobile-chrome-veil pointer-events-none"
      />
    </motion.div>
  );
}
