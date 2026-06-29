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
// STEP 1 SCOPE: Hero + About + Experience only. Education, Skills and Recent
// Posts are designed in the data layer but NOT rendered yet — see the clearly
// marked TODO markers for steps 2-4 below.
// ─────────────────────────────────────────────────────────────────
import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowUpRight, UserPlus, Building2, MapPin } from 'lucide-react';
import { APPLE_SPRING } from '@/lib/motion';
import { ReplaiyAvatar } from '@/components/Avatar';
import { SectionLabel } from '@/components/LeadContextPanel';
import { ActionPill } from '@/components/ConversationDetailToolbar';
import { useMobileTopChromeSlot } from '@/components/MobileTopChrome';
import type { Conversation, LinkedInExperience } from '@/data/mockConversations';

const ACCENT = '#2F6BFF';

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

  // Resolve the outbound LinkedIn URL the same way LeadContextPanel does: the
  // mock carries a '#' placeholder, so synthesise a believable profile URL
  // from the lead's name when no real URL exists.
  const slug = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const linkedinUrl =
    mail.lead?.linkedinUrl && mail.lead.linkedinUrl !== '#'
      ? mail.lead.linkedinUrl
      : `https://linkedin.com/in/${slug}`;

  const headline = profile?.headline ?? mail.leadHeadline;
  const location = mail.lead?.location ?? mail.leadLocation;
  const followers = profile?.followers;
  const connections = profile?.connections;
  const experience = profile?.experience ?? [];

  return (
    <>
      {/* NOTE: the mobile ProfileChromeSlot is NOT mounted here. Mounting it
          inside this component fails the chrome handoff, because this whole
          component sits inside the parent's <AnimatePresence> and stays mounted
          for the full slide-OUT on close, so the slot would linger and the
          title would keep reading "LinkedIn profile" after Back. Instead the
          parent (LeadContextPanel) mounts <ProfileChromeSlot> tied directly to
          `profileOpen`, OUTSIDE its AnimatePresence, so the chrome hands back
          to the lead panel the instant Back is tapped. Same v-fix-chrome-handoff
          pattern used for LeadPanelChromeSlot. */}
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
        <div className="hidden md:block absolute top-3 left-3 z-[2]">
          <ActionPill testId="profile-back" label="Back to contact" onClick={onClose}>
            <ArrowLeft size={22} strokeWidth={1.7} className="text-icon" />
          </ActionPill>
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
                  {profile?.premium && (
                    <span className="glass-pill rounded-full inline-flex items-center h-[20px] px-2 text-[11px] font-medium text-foreground/70">
                      Premium
                    </span>
                  )}
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

                {/* Actions. Connect is the single blue primary (it is THE one
                    action). View on LinkedIn is a quiet secondary glass pill
                    that opens the profile in a new tab. */}
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
                  <a
                    href={linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="profile-view-linkedin"
                    className="glass-pill inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-[13px] font-medium text-foreground/80 active-elevate-2"
                  >
                    <ArrowUpRight size={15} strokeWidth={1.9} />
                    View on LinkedIn
                  </a>
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

            {/* TODO(step 2) · EDUCATION — render profile.education as a list of
                LinkedInEducation entries (logo, school, degree, years, optional
                description), mirroring the ExperienceEntry layout. Data already
                exists on profile.education. */}

            {/* TODO(step 3) · SKILLS — render profile.skills as rows of pill
                tags (glass-pill, neutral, NOT blue), matching the reference
                Skills section. Data already exists on profile.skills. */}

            {/* TODO(step 4) · RECENT POSTS — render profile.posts as full post
                cards (author avatar/name/headline, time-ago, text with
                "See more" using the same clamp pattern as AboutSection, optional
                image, likes/comments/reposts, Like/Comment/Repost actions,
                scrollable through many posts). Show the "usedByAI" tag on posts
                Replaiy referenced. Data already exists on profile.posts. */}

            {/* TODO(step 4) · The polished compact "LinkedIn profile" preview
                card that triggers this view lives in the Contact tab and
                replaces the TEMPORARY "View full profile" text button used in
                step 1. */}
          </div>
        </div>
      </motion.div>
    </>
  );
}
