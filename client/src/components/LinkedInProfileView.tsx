// ─────────────────────────────────────────────────────────────────
// LinkedInProfileView · the FULL embedded LinkedIn profile.
//
// This is a genuinely NEW screen (not a duplicate): it shows the complete
// LinkedIn profile of the lead behind a conversation so the user never has to
// leave Replaiy. It pushes in OVER the lead-panel column (the 340px desktop
// aside, or the full-screen mobile lead panel) using the EXACT same push-in
// recipe as the mobile lead panel in ConversationTimeline (initial x:'100%',
// animate x:0, exit x:'100%', APPLE_SPRING).
//
// It REUSES the existing design system rather than inventing anything:
//   • SectionLabel + ReplaiyAvatar (imported from LeadContextPanel / Avatar)
//   • rp-card / lg-card / glass-pill CSS surfaces
//   • ActionPill + the shared mobile top-chrome slot system (priority 300)
//   • APPLE_SPRING from lib/motion
//   • the "Show more" clamp + gradient-fade mask pattern lifted from the
//     StickyConversationSummary in ConversationTimeline (~L424-470)
//
// Renders the full profile: Hero + About + Experience + Education + Skills +
// Activity. The Activity section mirrors LinkedIn's profile Activity tabs with a
// content-type filter (All / Posts / Comments / Reactions) over a chronological
// list, reusing the lead-panel VadikLiquidSwitcher (text variant) for the tabs
// and the existing PostCard for every original post (posts, comment targets and
// reaction targets alike).
// ─────────────────────────────────────────────────────────────────
import { useState, useMemo, useContext, createContext } from 'react';
import type { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, UserPlus, Building2, MapPin, GraduationCap, ChevronRight } from 'lucide-react';
import { APPLE_SPRING } from '@/lib/motion';
import { ReplaiyAvatar } from '@/components/Avatar';
import { SectionLabel } from '@/components/LeadContextPanel';
import { ActionPill } from '@/components/ConversationDetailToolbar';
import { useMobileTopChromeSlot } from '@/components/MobileTopChrome';
import { VadikLiquidSwitcher } from '@/components/VadikLiquidSwitcher';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  engagersFor,
} from '@/data/mockConversations';
import type {
  Conversation,
  LinkedInExperience,
  LinkedInEducation,
  LinkedInPost,
  LinkedInReactionKind,
  LinkedInEngager,
} from '@/data/mockConversations';
// Real LinkedIn BRAND badges (not UI accents). These deliberately use LinkedIn
// brand colours (LinkedIn blue, premium orange, Sales Navigator compass) which
// differ from the app's single #2F6BFF accent — allowed here because they are
// brand marks (like a verified checkmark), NOT UI accents. Use the SVGs as-is;
// never recolour them to #2F6BFF and never reuse these colours elsewhere.
import linkedinFree from '@/assets/linkedin-free.png';
import linkedinPremium from '@/assets/linkedin-premium.png';
import linkedinSalesnav from '@/assets/linkedin-salesnav.png';

const ACCENT = '#2F6BFF';

// Activity content-type filter, mirroring LinkedIn's profile Activity tabs.
type ActivityTab = 'all' | 'posts' | 'comments' | 'reactions';

// Calm muted copy shown when a tab has no items. Same warm tone as the
// lead-panel "not found" lines.
const ACTIVITY_EMPTY: Record<ActivityTab, string> = {
  all: 'No activity yet',
  posts: 'No posts yet',
  comments: 'No comments yet',
  reactions: 'No reactions yet',
};

// ─── Engagers push-in · the kind a tapped count opens ─────────────
// Tapping a post's "X likes" / "Y comments" / "Z reposts" count opens a push-in
// list of the PEOPLE who engaged. These three kinds map 1:1 onto engagersFor().
type EngageKind = 'reactions' | 'comments' | 'reposts';

// Title shown in the engagers view chrome (mobile slot + desktop centered
// title), mirroring LinkedIn's screen titles. Normal case, English only.
const ENGAGE_TITLE: Record<EngageKind, string> = {
  reactions: 'Reactions',
  comments: 'Comments',
  reposts: 'Reposts',
};

// A request to open the engagers view for a specific post + kind. Any PostCard
// anywhere in the profile tree raises this through context; the top-level
// LinkedInProfileView owns the actual push-in view + its chrome, so there is
// exactly ONE engagers view stacked over the profile (never one per card).
interface EngageRequest {
  post: LinkedInPost;
  kind: EngageKind;
}

// Context lets a deeply-nested PostCard's stats buttons open the single
// top-level engagers view without prop-drilling through ActivityItem. Defaults
// to a no-op so a PostCard rendered outside a profile (none today) is inert.
const EngageContext = createContext<(req: EngageRequest) => void>(() => {});

// ─── LinkedIn tier brand badges ───────────────────────────────────
// Driven purely by mail.lead.linkedinProfile.linkedinTier (defaults to 'free').
//   free      → blue "in" badge
//   premium   → orange "in" badge (instead of the blue one)
//   salesnav  → orange "in" badge AND the Sales Navigator compass badge
// So: always exactly one "in" badge, plus the compass appended only for salesnav.
function LinkedInTierBadges({
  tier = 'free',
}: {
  tier?: 'free' | 'premium' | 'salesnav';
}) {
  const inBadge = tier === 'free' ? linkedinFree : linkedinPremium;
  const inAlt =
    tier === 'free' ? 'LinkedIn' : 'LinkedIn Premium';
  return (
    <span
      className="inline-flex items-center gap-1"
      data-testid="profile-tier-badges"
    >
      <img
        src={inBadge}
        alt={inAlt}
        decoding="sync"
        className="h-[18px] w-[18px] shrink-0"
        data-testid="profile-tier-in"
      />
      {tier === 'salesnav' && (
        <img
          src={linkedinSalesnav}
          alt="LinkedIn Sales Navigator"
          decoding="sync"
          className="h-[18px] w-[18px] shrink-0"
          data-testid="profile-tier-salesnav"
        />
      )}
    </span>
  );
}

// Strict no em-dash normaliser (the design system bans em-dashes in all
// user-facing text). Shared mock copy is already clean, but we guard anyway.
function noDash(s: string) {
  return s.replace(/\s*\u2014\s*/g, ' ');
}

// Compact follower / connection count, e.g. 5278 -> "5,278". No "·" anywhere.
function formatCount(n: number): string {
  return n.toLocaleString('en-US');
}

// ─── Mobile top-chrome slot for the profile view ──────────────────
// Registered at priority 300 — HIGHER than the lead panel's LeadPanelChromeSlot
// (200) and the conversation's ThreadChromeSlot (100) — so its back button +
// "LinkedIn profile" title WIN while the profile is open. It is mounted by the
// caller tied directly to the `open` boolean (OUTSIDE the exit-animating div),
// so the slot de-registers the instant Back is tapped and the chrome hands back
// to the lead panel immediately, exactly like the v-fix-chrome-handoff pattern.
export function ProfileChromeSlot({ onClose }: { onClose: () => void }) {
  const slot = useMemo(
    () => ({
      priority: 300,
      leftSlot: (
        <ActionPill testId="profile-back" label="Back to contact" onClick={onClose}>
          <ArrowLeft size={22} strokeWidth={1.7} className="text-icon" />
        </ActionPill>
      ),
      togglePill: (
        <div className="inline-flex items-center px-1 h-[52px]">
          <span className="text-[14px] font-semibold tracking-[-0.005em] text-foreground">
            LinkedIn profile
          </span>
        </div>
      ),
      rightSlot: <div style={{ width: 52, height: 52 }} aria-hidden="true" />,
    }),
    [onClose],
  );
  useMobileTopChromeSlot(slot);
  return null;
}

// ─── Mobile top-chrome slot for the ENGAGERS view ─────────────────
// Registered at priority 400 — HIGHER than the profile view's ProfileChromeSlot
// (300) — so its back button + the engagement-kind title (Reactions / Comments
// / Reposts) WIN while the engagers view is open, stacked over the profile.
// Mounted by LinkedInProfileView tied directly to the engagers `open` boolean
// (OUTSIDE the exit-animating div), so it de-registers the instant Back is
// tapped and the chrome hands straight back to the profile view's slot (300),
// which re-shows "LinkedIn profile" immediately. Same v-fix-chrome-handoff
// pattern as ProfileChromeSlot / LeadPanelChromeSlot.
export function EngagersChromeSlot({
  title,
  onClose,
}: {
  title: string;
  onClose: () => void;
}) {
  const slot = useMemo(
    () => ({
      priority: 400,
      leftSlot: (
        <ActionPill testId="engagers-back" label="Back to profile" onClick={onClose}>
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
    [title, onClose],
  );
  useMobileTopChromeSlot(slot);
  return null;
}

// ─── About · clamp + gradient-fade + Show more ────────────────────
// Reuses the StickyConversationSummary clamp recipe verbatim (maxHeight cap +
// WebkitMaskImage gradient fade + a Show more / Show less text toggle).
function AboutSection({ about }: { about: string }) {
  const [expanded, setExpanded] = useState(false);
  // ~4-5 lines worth before it is worth clamping.
  const canClamp = about.length > 220;
  return (
    <div>
      <SectionLabel>About</SectionLabel>
      <div className="lg-card rounded-[16px] px-3.5 py-3">
        <div
          className="relative"
          style={
            !expanded && canClamp
              ? {
                  maxHeight: 'calc(1.6em * 5)',
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
            className="text-[13.5px] leading-[1.6] text-foreground/80 m-0 whitespace-pre-line"
            data-testid="profile-about-text"
          >
            {noDash(about)}
          </p>
        </div>
        {canClamp && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            data-testid="profile-about-toggle"
            className="mt-1.5 inline-flex items-center text-[12.5px] font-semibold text-foreground/70 hover-elevate active-elevate-2 rounded-md px-1 -mx-1"
          >
            {expanded ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Experience entry ─────────────────────────────────────────────
// Logo (or a neutral fallback tile) + role (bold) + company + a muted meta
// line. The date range uses "to" instead of any dash (no em / en dashes), and
// the location lives on its OWN muted subline rather than after a "·".
function ExperienceEntry({ item }: { item: LinkedInExperience }) {
  const dateRange = item.end
    ? `${item.start} to ${item.end}`
    : item.start;
  return (
    <div className="flex items-start gap-3 py-2.5" data-testid="profile-experience-item">
      {/* Logo or neutral fallback tile (mirrors the FlowSection icon tile). */}
      {item.logoUrl ? (
        <span className="h-10 w-10 rounded-xl overflow-hidden shrink-0 bg-foreground/[0.06] dark:bg-white/[0.08]">
          <img
            src={item.logoUrl}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </span>
      ) : (
        <span className="h-10 w-10 rounded-xl shrink-0 bg-foreground/[0.06] dark:bg-white/[0.08] flex items-center justify-center">
          <Building2 size={17} strokeWidth={1.8} className="text-foreground/55" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-semibold tracking-[-0.005em] text-foreground leading-snug">
          {noDash(item.role)}
        </div>
        <div className="text-[12.5px] text-foreground/70 leading-snug mt-0.5">
          {noDash(item.company)}
        </div>
        <div className="text-[11.5px] text-foreground/45 leading-snug mt-1 tabular-nums">
          {dateRange}
        </div>
        {item.location && (
          <div className="text-[11.5px] text-foreground/45 leading-snug inline-flex items-center gap-1 mt-0.5">
            <MapPin size={11} strokeWidth={1.8} className="shrink-0" />
            {noDash(item.location)}
          </div>
        )}
        {item.description && (
          <p className="text-[12px] text-foreground/65 leading-[1.5] mt-1.5 m-0">
            {noDash(item.description)}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Education entry ──────────────────────────────────────────────
// Mirrors ExperienceEntry EXACTLY: a logo (or neutral fallback tile) + school
// (bold, like the role) + degree (muted, like the company line) + a muted meta
// line for the date range. The date range uses "to" instead of any dash (no em
// / en dashes), and an optional description sits on its own muted line below,
// matching how ExperienceEntry renders its secondary text. The only difference
// from Experience is the fallback icon (GraduationCap rather than Building2),
// since these are schools, not companies.
function EducationEntry({ item }: { item: LinkedInEducation }) {
  const dateRange =
    item.start && item.end
      ? `${item.start} to ${item.end}`
      : item.start || item.end || '';
  return (
    <div className="flex items-start gap-3 py-2.5" data-testid="profile-education-item">
      {/* Logo or neutral fallback tile (same tile as ExperienceEntry). */}
      {item.logoUrl ? (
        <span className="h-10 w-10 rounded-xl overflow-hidden shrink-0 bg-foreground/[0.06] dark:bg-white/[0.08]">
          <img
            src={item.logoUrl}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </span>
      ) : (
        <span className="h-10 w-10 rounded-xl shrink-0 bg-foreground/[0.06] dark:bg-white/[0.08] flex items-center justify-center">
          <GraduationCap size={17} strokeWidth={1.8} className="text-foreground/55" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-semibold tracking-[-0.005em] text-foreground leading-snug">
          {noDash(item.school)}
        </div>
        {item.degree && (
          <div className="text-[12.5px] text-foreground/70 leading-snug mt-0.5">
            {noDash(item.degree)}
          </div>
        )}
        {dateRange && (
          <div className="text-[11.5px] text-foreground/45 leading-snug mt-1 tabular-nums">
            {dateRange}
          </div>
        )}
        {item.description && (
          <p className="text-[12px] text-foreground/65 leading-[1.5] mt-1.5 m-0">
            {noDash(item.description)}
          </p>
        )}
      </div>
    </div>
  );
}

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
// stats row, separated by a thin hairline divider. The Activity "comment" item
// uses this to nest the profile person's own reply WITHIN the original post
// card, so a comment reads as one unit ("post + the reply on it") rather than
// two sibling cards of equal weight.
function PostCard({
  post,
  nested,
  embedded,
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
}) {
  const [expanded, setExpanded] = useState(false);
  // Same threshold rationale as AboutSection: clamp once it is worth clamping.
  const canClamp = post.text.length > 220;

  // Tappable stats segments. Each non-zero count becomes its OWN <button> that
  // opens the engagers push-in for that kind (likes -> reactions, since
  // LinkedIn files reactions under the likes count). Zero counts are omitted,
  // exactly as before. The visual style is unchanged from the old muted spans:
  // same text scale + muted colour; the only addition is a tasteful underline-
  // on-hover + hover-elevate affordance so it reads as tappable without looking
  // like a bordered button.
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
      {/* Header row · avatar + name/headline stack + time-ago (right). */}
      <div className="flex items-start gap-2.5">
        <ReplaiyAvatar name={post.authorName} src={post.authorAvatarUrl} size={36} />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold tracking-[-0.005em] text-foreground leading-snug truncate">
            {noDash(post.authorName)}
          </div>
          {post.authorHeadline && (
            <div className="text-[11.5px] text-foreground/55 leading-snug truncate">
              {noDash(post.authorHeadline)}
            </div>
          )}
        </div>
        <span className="text-[11.5px] text-foreground/45 leading-snug shrink-0 tabular-nums mt-0.5">
          {noDash(post.timeAgo)}
        </span>
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

      {/* Optional image · rounded, height-capped so one image never dominates. */}
      {post.imageUrl && (
        <div className="mt-3 rounded-xl overflow-hidden bg-foreground/[0.06] dark:bg-white/[0.07]">
          <img
            src={post.imageUrl}
            alt=""
            loading="lazy"
            className="w-full max-h-[240px] object-cover block"
          />
        </div>
      )}

      {/* Stats row · each count is its OWN tappable <button> opening the
          engagers push-in (who reacted / commented / reposted), mirroring
          LinkedIn. Same muted text + spacing as before (never a middot); the
          buttons add only an underline-on-hover + hover-elevate affordance so
          they read as tappable without looking like bordered controls. */}
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

// ─── Activity · reaction label map ────────────────────────────────
// Maps a LinkedInReactionKind to the exact word LinkedIn uses in its reaction
// chips. Kept tiny and local because it is only used by the reaction
// attribution line below.
const REACTION_LABEL: Record<LinkedInReactionKind, string> = {
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
const REACTION_GLYPH: Record<LinkedInReactionKind, string> = {
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
const REACTION_ORDER: LinkedInReactionKind[] = [
  'like', 'celebrate', 'support', 'love', 'insightful', 'funny',
];

// ─── Activity · attribution line ──────────────────────────────────
// The small muted line LinkedIn shows ABOVE a comment / reaction card, e.g.
// "Emma commented on Marcus Lindqvist's post". Em-dash-free and middot-free by
// construction (plain words + a possessive). Reuses the same muted text scale
// as the PostCard headline subline so the family reads consistently.
function ActivityAttribution({
  profileFirstName,
  verb,
  authorName,
  reactionLabel,
}: {
  profileFirstName: string;
  // v-attribution-all — Every Activity item now shows an attribution line, so
  // the verb set grew to cover own posts and reposts, matching LinkedIn 1:1:
  //   'posted'    → "[First] posted this"            (no author/possessive)
  //   'reposted'  → "[First] reposted [author]'s post"
  //   'commented' → "[First] commented on [author]'s post"
  //   'reacted'   → "[First] reacted to [author]'s post"
  // For a QUOTE repost the caller passes verb 'reposted' WITHOUT an authorName
  // to get "[First] reposted this" (the added commentary header carries the
  // original author context instead).
  verb: 'posted' | 'reposted' | 'commented' | 'reacted';
  authorName?: string;
  reactionLabel?: string;
}) {
  // Possessive that handles names already ending in s (e.g. "Sofia Reyes'").
  // Reuses the same rule used elsewhere in this file for the comment/reaction
  // attribution lines, so every possessive in Activity reads identically.
  const trimmed = noDash(authorName ?? '').trim();
  const possessive = /s$/i.test(trimmed) ? `${trimmed}'` : `${trimmed}'s`;
  // The phrase after the verb. "posted this" and the author-less "reposted this"
  // take no possessive; the others read "<prep> <author>'s post".
  const hasAuthor = trimmed.length > 0;
  let tail: ReactNode;
  if (verb === 'posted' || (verb === 'reposted' && !hasAuthor)) {
    tail = <>this</>;
  } else {
    // "commented on ...'s post", "reacted to ...'s post", "reposted ...'s post".
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
        <span className="font-semibold text-foreground/65">{profileFirstName}</span>{' '}
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

// ─── Activity · single activity item ──────────────────────────────
// One row in the Activity list, switching on post.kind:
//   • 'post'     → the original PostCard, unchanged.
//   • 'comment'  → attribution line + the original PostCard with the profile
//                  person's own reply NESTED INSIDE the same card (below a
//                  hairline divider), so the two read as one unit: the post,
//                  and the comment this person left on it. The nested reply is
//                  deliberately lighter and smaller than the post (28px avatar,
//                  smaller muted text, no second card surface) so the eye reads
//                  post (primary) then reply (secondary), never two posts.
//   • 'reaction' → attribution line (with the reaction label chip) + the
//                  original PostCard.
// Reuses PostCard for the original post in every case rather than rebuilding
// any post chrome, and ReplaiyAvatar for the nested reply author.
function ActivityItem({
  post,
  profileFirstName,
  profileName,
  profileAvatar,
}: {
  post: LinkedInPost;
  profileFirstName: string;
  profileName: string;
  profileAvatar?: string;
}) {
  const kind = post.kind ?? 'post';

  if (kind === 'comment') {
    // The profile person's reply, NESTED inside the post card (passed as the
    // PostCard `nested` slot). It is intentionally lighter than a post: a 28px
    // avatar, smaller muted text and NO second card surface, indented from the
    // post body so it reads as a subordinate reply on the post, not a sibling
    // post of equal weight.
    const reply = post.activityComment ? (
      <div
        className="flex items-start gap-2.5"
        data-testid={`activity-comment-${post.id}`}
      >
        <ReplaiyAvatar name={profileName} src={profileAvatar} size={28} />
        <div className="min-w-0 flex-1">
          {/* Just the reply author's name. The redundant "COMMENT" mini-label
              was removed: every Activity item now carries an attribution line
              above the card ("[First] commented on X's post"), which already
              states this is a comment, and the all-caps mini-label violated the
              platform's no-block-letter-labels rule. Normal case throughout. */}
          <span className="text-[12px] font-semibold tracking-[-0.005em] text-foreground leading-snug">
            {noDash(profileName)}
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
          profileFirstName={profileFirstName}
          verb="commented"
          authorName={post.authorName}
        />
        <PostCard post={post} nested={reply} />
      </div>
    );
  }

  if (kind === 'reaction') {
    return (
      <div data-testid={`activity-item-${post.id}`}>
        <ActivityAttribution
          profileFirstName={profileFirstName}
          verb="reacted"
          authorName={post.authorName}
          reactionLabel={
            post.activityReaction ? REACTION_LABEL[post.activityReaction] : undefined
          }
        />
        <PostCard post={post} />
      </div>
    );
  }

  if (kind === 'repost') {
    // The author*/text/image fields describe the ORIGINAL reshared post (by
    // someone else), rendered with the SAME PostCard as everywhere else.
    // TWO variants, switched on activityComment (the profile person's own
    // added text):
    //   • PLAIN reshare (no activityComment): just an attribution line
    //     "[First] reposted [author]'s post" above the original PostCard.
    //     Nothing else — identical chrome to a reaction, different verb.
    //   • QUOTE repost (activityComment present): the person added commentary,
    //     so the attribution reads "[First] reposted this", then a lightweight
    //     commentary HEADER (their ReplaiyAvatar + name + added text) at
    //     primary weight, then the original post rendered INSIDE an inset,
    //     recessed container so it unmistakably reads as embedded reshared
    //     content, not a separate equal post. This mirrors the comment
    //     variant's nesting idea (one card = one unit) but inverted: here the
    //     person's voice is on TOP and the reshared post is the contained body.
    if (post.activityComment) {
      return (
        <div data-testid={`activity-item-${post.id}`}>
          <ActivityAttribution profileFirstName={profileFirstName} verb="reposted" />
          {/* Outer repost card: the person's commentary, then the reshared post
              embedded within the SAME surface so the whole thing reads as one
              repost unit. */}
          <div className="rp-card rounded-[20px] px-4 py-3.5">
            {/* Commentary header: the profile person's added text, at primary
                weight (their avatar + name), so their voice leads. */}
            <div
              className="flex items-start gap-2.5"
              data-testid={`activity-repost-comment-${post.id}`}
            >
              <ReplaiyAvatar name={profileName} src={profileAvatar} size={36} />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold tracking-[-0.005em] text-foreground leading-snug truncate">
                  {noDash(profileName)}
                </div>
                <p className="text-[13px] leading-[1.55] text-foreground/80 m-0 mt-1 whitespace-pre-line break-words">
                  {noDash(post.activityComment)}
                </p>
              </div>
            </div>
            {/* Embedded reshared post: inset, recessed container with its own
                hairline border so it reads as contained content within the
                repost, never a sibling post of equal weight. Reuses PostCard
                verbatim; the inset wrapper supplies the embedded affordance. */}
            <div className="mt-3 rounded-[16px] overflow-hidden border border-foreground/[0.08] dark:border-white/[0.08] bg-foreground/[0.02] dark:bg-white/[0.02]">
              <PostCard post={post} embedded />
            </div>
          </div>
        </div>
      );
    }
    return (
      <div data-testid={`activity-item-${post.id}`}>
        <ActivityAttribution
          profileFirstName={profileFirstName}
          verb="reposted"
          authorName={post.authorName}
        />
        <PostCard post={post} />
      </div>
    );
  }

  // Plain own post — now ALSO carries an attribution line ("[First] posted
  // this") so the All feed reads consistently: every item states what it is.
  return (
    <div data-testid={`activity-item-${post.id}`}>
      <ActivityAttribution profileFirstName={profileFirstName} verb="posted" />
      <PostCard post={post} />
    </div>
  );
}

// ─── Engagers · single person row ─────────────────────────────────
// One person who engaged with the post. Mirrors LinkedIn's reactions /
// comments / reposts list rows: ReplaiyAvatar (44) + name (semibold) + headline
// (muted, truncated). For 'reactions' a tiny reaction glyph + normal-case label
// sits on the trailing edge showing which reaction they gave. For 'comments'
// the person's comment text renders beneath their name/headline (muted, like a
// comment). The WHOLE row is a tappable button carrying a trailing chevron so
// it reads as "open this person"; see EngagersView for what the tap does.
// Reuses ReplaiyAvatar verbatim; no new avatar/row primitive is introduced.
function EngagerRow({
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
          {/* Reaction indicator (reactions kind only): a tiny glyph + a small
              NORMAL-CASE label (e.g. "Insightful"), never all-caps. */}
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
        {/* Comments kind: the person's comment text beneath their identity,
            muted, reading like a comment. */}
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

// ─── Engagers · push-in view ──────────────────────────────────────
// The list of PEOPLE who engaged with a post, pushed in OVER the profile view
// using the EXACT same recipe as LinkedInProfileView itself: a motion.div with
// initial x:'100%' / animate x:0 / exit x:'100%' + APPLE_SPRING, absolute
// inset-0, here at z-[80] so it sits ABOVE the profile view (z-[70]) inside the
// z-[60] lead-panel column. It carries the SAME desktop floating-back ActionPill
// + centered title block and the SAME .mobile-chrome-veil last-child top
// frosting as the profile view. Its MOBILE chrome lives in EngagersChromeSlot
// (priority 400), mounted by the caller on the open boolean (not here), so the
// chrome hands back to the profile's slot (300) the instant Back is tapped.
//
// Content: for 'reactions' a reaction-type filter row (All + only the reaction
// types actually present), reusing VadikLiquidSwitcher (text variant) with
// per-segment widths exactly like the Activity filter; then an EngagerRow per
// person. noDash() guards all text; a muted empty state shows if somehow empty.
function EngagersView({
  post,
  kind,
  onClose,
  onOpenEngager,
}: {
  post: LinkedInPost;
  kind: EngageKind;
  onClose: () => void;
  onOpenEngager: (engager: LinkedInEngager) => void;
}) {
  const isMobile = useIsMobile();
  const engagers = useMemo(() => engagersFor(post, kind), [post, kind]);
  const title = ENGAGE_TITLE[kind];

  // Reaction-type filter (reactions kind only). Tabs = 'all' plus only the
  // reaction types that actually appear in this list, in LinkedIn's order. Each
  // reaction tab is a tiny glyph (LinkedIn's own reactions-modal pattern) so up
  // to seven tabs fit the narrow column; 'All' is a short text segment. Reuses
  // the SAME VadikLiquidSwitcher text variant + per-segment width approach as
  // the Activity filter (scale 0.72, textPaddingX 12).
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
      className="absolute inset-0 z-[80] flex flex-col bg-background overflow-hidden"
    >
      {/* Desktop chrome row · identical to LinkedInProfileView's: floating back
          ActionPill (left, 52px), a truly-centered title, and a 52px right
          spacer to balance it. md:flex only; mobile uses EngagersChromeSlot. */}
      <div className="hidden md:flex items-center justify-between gap-2.5 absolute top-3 left-3 right-3 z-[2] pointer-events-none">
        <div className="pointer-events-auto shrink-0">
          <ActionPill testId="engagers-back" label="Back to profile" onClick={onClose}>
            <ArrowLeft size={22} strokeWidth={1.7} className="text-icon" />
          </ActionPill>
        </div>
        <span className="min-w-0 flex-1 text-center text-[13px] font-semibold tracking-[-0.005em] text-foreground truncate">
          {title}
        </span>
        <div className="shrink-0" style={{ width: 52, height: 52 }} aria-hidden="true" />
      </div>

      {/* Scroll surface · same top padding as the profile view so content
          scrolls UNDER the floating back pill (mobile safe-area+88px, desktop
          72px). */}
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
        <div className="px-4 pb-10 flex flex-col gap-3 pt-[calc(env(safe-area-inset-top,0px)+88px)] md:pt-[72px]">
          {/* Reaction-type filter (reactions kind, when more than one type is
              present — a single type needs no filter). */}
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

      {/* Top frosting veil · same .mobile-chrome-veil last-child trick as the
          profile view (responsive height mobile safe-area+88px / desktop 76px),
          MUST be the last child so it frosts the scroll content painting before
          it, below the floating chrome (z-[2]) but above content (z-[1]). */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 z-[1] h-[calc(env(safe-area-inset-top,0px)+88px)] md:h-[76px] mobile-chrome-veil pointer-events-none"
      />
    </motion.div>
  );
}

export function LinkedInProfileView({
  mail,
  open,
  onClose,
}: {
  mail: Conversation;
  open: boolean;
  onClose: () => void;
}) {
  const profile = mail.lead?.linkedinProfile;
  const name = mail.from.name;
  const avatar = mail.from.avatar;

  const headline = profile?.headline ?? mail.leadHeadline;
  const location = mail.lead?.location ?? mail.leadLocation;
  const followers = profile?.followers;
  const connections = profile?.connections;
  const experience = profile?.experience ?? [];
  const education = profile?.education ?? [];
  const skills = profile?.skills ?? [];
  const posts = profile?.posts ?? [];
  // Account tier drives the LinkedIn brand badge(s) shown after the name.
  const tier = profile?.linkedinTier ?? 'free';

  // ── Activity content-type filter (mirrors LinkedIn's Activity tabs) ──
  // All / Posts / Comments / Reactions, defaulting to All. The array order is
  // treated as chronological, so "All" simply renders posts as-is. The other
  // tabs filter on post.kind (treating an unset kind as 'post'). The first
  // name of the profile person (from mail.from.name) drives the attribution
  // lines on comment / reaction items.
  const [activityTab, setActivityTab] = useState<ActivityTab>('all');
  const isMobile = useIsMobile();
  const profileFirstName = (name ?? '').trim().split(/\s+/)[0] || name;

  // ── Engagers push-in (who reacted / commented / reposted) ──
  // A single engagers view is stacked OVER this profile view at z-[80]. Any
  // PostCard's tapped count raises an EngageRequest through EngageContext; we
  // own the open request + its chrome here. Mounting the EngagersChromeSlot on
  // the open boolean OUTSIDE the engagers exit-animating div (in the top-level
  // fragment) is the v-fix-chrome-handoff pattern: the slot (priority 400)
  // de-registers the instant Back is tapped, so the chrome hands straight back
  // to the profile's slot (300) and the title returns to "LinkedIn profile".
  const [engage, setEngage] = useState<EngageRequest | null>(null);
  const openEngagers = useMemo(() => (req: EngageRequest) => setEngage(req), []);
  const closeEngagers = useMemo(() => () => setEngage(null), []);
  // Row tap: opening a full nested profile for an engager is out of scope (mock
  // engagers have no full LinkedInProfile), so the affordance is intentionally
  // a no-op for now (logged), keeping the chevron + tappable row so the wiring
  // is ready when engager profiles land. The primary deliverable is the
  // clickable counts -> people list with reaction filtering.
  const onOpenEngager = useMemo(
    () => (e: LinkedInEngager) => {
      // eslint-disable-next-line no-console
      console.debug('[engager] open profile (no-op for now):', e.name);
    },
    [],
  );
  const visiblePosts = useMemo(() => {
    // Posts tab = own posts OR reposts. LinkedIn files a repost under the
    // person's "Posts" activity (a repost IS a posting action), so the Posts
    // tab shows kind 'post' (default) and kind 'repost' together. Reposts also
    // appear in All (which renders everything in array order). Comments and
    // Reactions stay filtered to their own kind.
    if (activityTab === 'posts')
      return posts.filter((p) => {
        const k = p.kind ?? 'post';
        return k === 'post' || k === 'repost';
      });
    if (activityTab === 'comments') return posts.filter((p) => p.kind === 'comment');
    if (activityTab === 'reactions') return posts.filter((p) => p.kind === 'reaction');
    return posts;
  }, [posts, activityTab]);

  return (
    <EngageContext.Provider value={openEngagers}>
      {/* NOTE: the mobile ProfileChromeSlot is NOT mounted here. Mounting it
          inside this component fails the chrome handoff, because this whole
          component sits inside the parent's <AnimatePresence> and stays mounted
          for the full slide-OUT on close, so the slot would linger and the
          title would keep reading "LinkedIn profile" after Back. Instead the
          parent (LeadContextPanel) mounts <ProfileChromeSlot> tied directly to
          `profileOpen`, OUTSIDE its AnimatePresence, so the chrome hands back
          to the lead panel the instant Back is tapped. Same v-fix-chrome-handoff
          pattern used for LeadPanelChromeSlot. */}
      {/* Engagers MOBILE chrome slot (priority 400). Mounted here, on the open
          boolean and OUTSIDE the engagers exit-animating div below, so it
          de-registers the instant Back is tapped and the chrome hands straight
          back to the profile's slot (300). Same v-fix-chrome-handoff pattern as
          ProfileChromeSlot is mounted by LeadContextPanel. */}
      {engage && (
        <EngagersChromeSlot title={ENGAGE_TITLE[engage.kind]} onClose={closeEngagers} />
      )}
      <motion.div
        key="linkedin-profile-view"
        data-testid="linkedin-profile-view"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={APPLE_SPRING}
        className="absolute inset-0 z-[70] flex flex-col bg-background overflow-hidden"
      >
        {/* MOBILE back = the shared glass ActionPill registered through
            ProfileChromeSlot at priority 300 (above the lead panel's 200) in
            the mobile top-chrome, exactly like the lead panel reuses
            LeadPanelChromeSlot rather than carrying an in-panel header. There
            is NO hand-rolled header strip here.

            DESKTOP back = the SAME ActionPill component (no new component, no
            header bar), floated top-left over the scroll surface. The mobile
            top-chrome shell is md:hidden so the ProfileChromeSlot never renders
            on desktop; and unlike the desktop lead-panel column (which is
            closed externally from the conversation toolbar), this profile is a
            within-panel push-in opened by an in-panel button, so it genuinely
            needs an in-panel back affordance. We satisfy that by reusing
            ActionPill verbatim (the one back-button primitive used everywhere)
            rather than inventing any new desktop chrome. */}
        {/* Desktop chrome row. Mirrors the mobile MobileTopChrome layout EXACTLY:
            a `justify-between` flex with a left pill (52px), a centered title,
            and an equal-width right spacer (52px). The matched left/right widths
            make the title TRULY centered across the 340px lead-panel column
            (not merely offset by the pill), just like the mobile chrome centers
            its togglePill between leftSlot and the 52px right spacer. */}
        <div className="hidden md:flex items-center justify-between gap-2.5 absolute top-3 left-3 right-3 z-[2] pointer-events-none">
          <div className="pointer-events-auto shrink-0">
            <ActionPill testId="profile-back" label="Back to contact" onClick={onClose}>
              <ArrowLeft size={22} strokeWidth={1.7} className="text-icon" />
            </ActionPill>
          </div>
          {/* Centered title, mirroring the mobile chrome's "LinkedIn profile"
              title so desktop has the same "where am I" context. min-w-0 + the
              equal 52px flanks keep it optically centered without overlapping
              the pill at the narrow 340px width. */}
          <span className="min-w-0 flex-1 text-center text-[13px] font-semibold tracking-[-0.005em] text-foreground truncate">
            LinkedIn profile
          </span>
          {/* Equal-width right spacer to balance the left ActionPill (52px),
              identical to MobileTopChrome's right spacer slot. */}
          <div className="shrink-0" style={{ width: 52, height: 52 }} aria-hidden="true" />
        </div>

        {/* Scroll surface. On BOTH platforms the content scrolls UNDER the
            floating back pill, so we pad the top by the chrome zone. Mobile:
            safe-area + the 88px top-chrome zone (matching the lead panel).
            Desktop: enough to clear the floating ActionPill (52px pill at
            top-3 plus breathing room). */}
        <div
          className="flex-1 min-h-0 overflow-y-auto no-scrollbar"
        >
          <div
            className="px-4 pb-10 flex flex-col gap-5 pt-[calc(env(safe-area-inset-top,0px)+88px)] md:pt-[72px]"
          >
            {/* ── HERO ──────────────────────────────────────────────
                Banner band + overlapping avatar, name + premium / degree
                badges (neutral glass pills, NOT blue), headline, a single
                meta line (location, followers, connections) separated by
                spacing, and two actions: Connect (the one blue primary) +
                View on LinkedIn (secondary, opens in a new tab). */}
            <div className="rp-card rounded-[20px] overflow-hidden">
              {/* Banner band. Uses bannerUrl when present, else a soft neutral
                  gradient (no off-palette colour). */}
              <div
                className="h-24 w-full bg-foreground/[0.06] dark:bg-white/[0.07]"
                style={
                  profile?.bannerUrl
                    ? {
                        backgroundImage: `url(${profile.bannerUrl})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }
                    : undefined
                }
                aria-hidden="true"
              />
              <div className="px-4 pb-4">
                {/* Avatar overlaps the banner, with a background ring so it
                    reads as lifted off the banner. */}
                <div className="-mt-9 mb-2.5">
                  <span className="inline-block rounded-full ring-4 ring-[hsl(var(--background))]">
                    <ReplaiyAvatar name={name} src={avatar} size={72} />
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-foreground m-0 leading-tight">
                    {name}
                  </h2>
                  {/* LinkedIn brand tier badge(s), driven by linkedinTier. These
                      replace the old "Premium" TEXT pill: always one "in" badge
                      (blue=free, orange=premium/salesnav) plus the Sales
                      Navigator compass appended only for salesnav. */}
                  <LinkedInTierBadges tier={tier} />
                  {profile?.degree && (
                    <span className="glass-pill rounded-full inline-flex items-center h-[20px] px-2 text-[11px] font-medium text-foreground/55 tabular-nums">
                      {profile.degree}
                    </span>
                  )}
                </div>

                {headline && (
                  <p className="text-[13px] text-foreground/65 leading-snug mt-1.5 m-0">
                    {noDash(headline)}
                  </p>
                )}

                {/* Meta line: location, followers, connections. Separated by
                    generous spacing, never the "·" field separator. Stats use
                    a thin spaced dot ONLY between numeric stats (acceptable per
                    spec, never as a field separator). */}
                {(location || followers != null || connections != null) && (
                  <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-2.5 text-[12px] text-foreground/55">
                    {location && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={12} strokeWidth={1.8} className="shrink-0" />
                        {noDash(location)}
                      </span>
                    )}
                    {followers != null && (
                      <span className="tabular-nums">
                        {formatCount(followers)} followers
                      </span>
                    )}
                    {connections != null && (
                      <span className="tabular-nums">
                        {formatCount(connections)} connections
                      </span>
                    )}
                  </div>
                )}

                {/* Action. Connect is the single blue primary (it is THE one
                    action). The old "View on LinkedIn" secondary pill was
                    removed: the entire LinkedIn profile (incl. all posts) is
                    embedded in-platform here, so linking out to linkedin.com is
                    redundant. Connect stands alone as the sole hero action. */}
                <div className="flex items-center gap-2.5 mt-4">
                  <button
                    type="button"
                    data-testid="profile-connect"
                    className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-[13px] font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80"
                    style={{ background: ACCENT }}
                  >
                    <UserPlus size={15} strokeWidth={2} />
                    Connect
                  </button>
                </div>
              </div>
            </div>

            {/* ── ABOUT ─────────────────────────────────────────────── */}
            {profile?.about && <AboutSection about={profile.about} />}

            {/* ── EXPERIENCE ────────────────────────────────────────── */}
            {experience.length > 0 && (
              <div>
                <SectionLabel>Experience</SectionLabel>
                <div className="lg-card rounded-[16px] px-3.5 py-1.5">
                  {experience.map((item, i) => (
                    <ExperienceEntry key={`${item.company}-${i}`} item={item} />
                  ))}
                </div>
              </div>
            )}

            {/* ── EDUCATION ─────────────────────────────────────────
                Mirrors the Experience section exactly: SectionLabel +
                an lg-card container holding EducationEntry rows (which
                themselves mirror ExperienceEntry). */}
            {education.length > 0 && (
              <div>
                <SectionLabel>Education</SectionLabel>
                <div className="lg-card rounded-[16px] px-3.5 py-1.5">
                  {education.map((item, i) => (
                    <EducationEntry key={`${item.school}-${i}`} item={item} />
                  ))}
                </div>
              </div>
            )}

            {/* ── SKILLS ────────────────────────────────────────────
                Neutral glass pills (glass-pill, the SAME surface as the
                hero degree pill), wrapped in a flex-wrap. No blue accent.
                The lg-card container matches the Experience/Education
                surface so the three sections read as one family. */}
            {skills.length > 0 && (
              <div>
                <SectionLabel>Skills</SectionLabel>
                <div
                  className="lg-card rounded-[16px] px-3.5 py-3 flex flex-wrap gap-2"
                  data-testid="profile-skills"
                >
                  {skills.map((skill, i) => (
                    <span
                      key={`${skill}-${i}`}
                      data-testid={`profile-skill-${i}`}
                      className="glass-pill rounded-full inline-flex items-center h-[26px] px-3 text-[12px] font-medium text-foreground/70"
                    >
                      {noDash(skill)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* ── ACTIVITY ──────────────────────────────────────────
                LinkedIn's profile "Activity" section, mirrored 1:1: a
                content-type FILTER above a chronological list. The filter is
                the SAME premium VadikLiquidSwitcher (text variant) used by the
                lead-panel Overview/Contact tabs, here with four short segments
                (All / Posts / Comments / Reactions). "All" mixes every item in
                array order (treated as chronological); the other tabs filter on
                post.kind. Each item renders via ActivityItem, which reuses the
                same PostCard for the original post in every case and adds the
                muted attribution line + inset comment (or reaction chip) on top.
                Every post still renders NEUTRALLY: usedByAI is never surfaced.

                Fitting FOUR tabs in the narrow 340px desktop column: the four
                labels differ a lot in length ("All" 16px vs "Comments" 69px at
                13.5px), so a single uniform optionWidth cannot win, sizing it
                for "Comments" makes the track ~385px (overflows the column) and
                leaves "All" with ~70px of empty space (badly over-spaced), while
                shrinking it collides the long labels. So we use the switcher's
                PER-SEGMENT `width` support: each segment is sized to its own
                label + a consistent ~10px breathing margin (All 60 / Posts 85 /
                Comments 134 / Reactions 123, UNSCALED) with a tighter text pad
                (textPaddingX 12 instead of the icon-mode 16). At scale 0.72 the
                track is (24 + 402 + 24) * 0.72 ≈ 324px, fitting inside both the
                ~308–340px desktop column and the centered mobile width, with no
                collision and "All" no longer over-wide. The indicator sizes and
                positions from the ACTIVE segment's own width, so it lands
                exactly under each label regardless of length. Same widths on
                mobile and desktop: the control is identical on both, just
                centered on phone. */}
            {posts.length > 0 && (
              <div data-testid="profile-activity">
                <SectionLabel>Activity</SectionLabel>
                {/* Filter tabs. Mirrors the LeadContextPanel sticky-tab wrapper:
                    full-width centered on mobile, inline (left-aligned) on the
                    fixed desktop column. The pill carries its own glass, so no
                    extra surface wrapper is needed. */}
                <div
                  className={
                    (isMobile ? 'flex justify-center w-full' : 'inline-flex') + ' mb-3'
                  }
                >
                  <VadikLiquidSwitcher<ActivityTab>
                    testId="activity-tab"
                    variant="text"
                    scale={0.72}
                    textPaddingX={12}
                    value={activityTab}
                    onChange={setActivityTab}
                    segments={[
                      { key: 'all', label: 'All', width: 60 },
                      { key: 'posts', label: 'Posts', width: 85 },
                      { key: 'comments', label: 'Comments', width: 134 },
                      { key: 'reactions', label: 'Reactions', width: 123 },
                    ]}
                  />
                </div>

                {visiblePosts.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    {visiblePosts.map((post) => (
                      <ActivityItem
                        key={post.id}
                        post={post}
                        profileFirstName={profileFirstName}
                        profileName={name}
                        profileAvatar={avatar}
                      />
                    ))}
                  </div>
                ) : (
                  <p
                    className="text-[12.5px] text-foreground/40 italic m-0 px-0.5"
                    data-testid="activity-empty"
                  >
                    {ACTIVITY_EMPTY[activityTab]}
                  </p>
                )}
              </div>
            )}

            {/* TODO(step 4) · The polished compact "LinkedIn profile" preview
                card that triggers this view lives in the Contact tab and
                replaces the TEMPORARY "View full profile" text button used in
                step 1. */}
          </div>
        </div>

        {/* v-fix-profile-veil — The shared MobileTopChromeShell veil lives at
            z-30 OUTSIDE this view, but this push-in view sits inside the
            z-[60] lead-panel stacking context at z-[70], so the global veil
            ends up BEHIND the view and cannot frost its scrolling content (the
            name/headline scrolled SHARP through the title + back pill). So the
            view carries its OWN top frosting veil, same `.mobile-chrome-veil`
            recipe, on BOTH platforms (responsive height: mobile safe-area+88px,
            desktop 76px to cover the floating ActionPill zone), sitting above
            the scroll content (z-[1]) but BELOW the floating chrome pills
            (z-[2]) so the back pill + title stay crisp on top while the
            name/badges/headline frost behind them. The masked gradient is
            percentage-based so it scales cleanly to either height.

            CRITICAL: this veil MUST be the LAST CHILD of this motion.div, i.e.
            AFTER the scroll container in the DOM. backdrop-filter only blurs
            what paints BEHIND it, and within this stacking context paint order
            follows DOM order, so the scroll content has to paint first for the
            veil to frost it. Placed before the scroll container it frosts
            nothing and the content scrolls through sharp (the prior regression).
            Exactly the inbox/lead-panel behaviour. */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 z-[1] h-[calc(env(safe-area-inset-top,0px)+88px)] md:h-[76px] mobile-chrome-veil pointer-events-none"
        />

        {/* Engagers push-in, stacked OVER this profile view at z-[80] (above the
            profile's own content + veil). It is a sibling INSIDE this motion.div
            so it shares this push-in's stacking context and slides within the
            same lead-panel column. AnimatePresence drives its own x:'100%' slide
            on open/close. The mobile chrome slot for it is mounted in the
            top-level fragment above (on `engage`), not here, for clean handoff. */}
        <AnimatePresence>
          {engage && (
            <EngagersView
              key={`engagers-${engage.post.id}-${engage.kind}`}
              post={engage.post}
              kind={engage.kind}
              onClose={closeEngagers}
              onOpenEngager={onOpenEngager}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </EngageContext.Provider>
  );
}
