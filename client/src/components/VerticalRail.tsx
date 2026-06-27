// ─────────────────────────────────────────────────────────────────
// v15.5 — Floating Liquid-Glass sidebar.
//
//   The desktop sidebar is now a VERTICAL CLONE of the mobile
//   bottom-nav: a stack of floating glass pills, no full-height
//   attached rail, no hard outlines. Each element hovers
//   independently on the canvas with backdrop-blur visible through it.
//
//   Stack (top → bottom):
//     1. GlassSegmentedToggle in orientation="vertical" — 3 segments:
//        Mail / Calendar / Docs. Spring-physics indicator morph using
//        the SAME component that drives the mobile bottom-nav.
//     2. Search circle (52×52 glass-pill)
//     3. + New circle (52×52 glass-pill, contextual)
//     4. Smart-toggle circle (52×52 glass-pill, purple glow when ON,
//        infinite low-intensity pulse when ON)
//     5. flex-1 spacer
//     6. Avatar circle (52×52, opens profile menu)
//
//   No container background. No attached bar. No black outlines.
//   Hover = scale 1.04 on glass circles, 200ms ease-out.
// ─────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Inbox,
  Target,
  Calendar as CalendarIcon,
  Sparkles,
  Search,
  Plus,
  type LucideIcon,
} from 'lucide-react';
import { VadikLiquidSwitcher } from './VadikLiquidSwitcher';
import VadikGlass from './VadikGlass';
import { GlassCircleButton as SharedGlassCircleButton, ProfileInitials } from './GlassCircleButton';

// ─────────────────────────────────────────────────────────────────
// Floating glass-circle button — shared shell for Search/+/Smart/Avatar.
// 52×52, glass-pill recipe, hover scales 1.04, tooltip on hover.
// ─────────────────────────────────────────────────────────────────
// v30.32 — Local GlassCircleButton alias naar centrale shared component.
// Behoud naam zodat de rest van het bestand niet hoeft te wijzigen.
const GlassCircleButton = SharedGlassCircleButton;

interface PrimaryItem {
  key: 'inbox' | 'campaigns' | 'ai' | 'calendar';
  icon: LucideIcon;
  href: string;
  label: string;
}

// v-replaiy — 'Mijn AI' als 4e surface (persona + knowledge).
const PRIMARY: PrimaryItem[] = [
  { key: 'inbox',     icon: Inbox,        href: '/',          label: 'Inbox' },
  { key: 'campaigns', icon: Target,       href: '/campaigns', label: 'Campaigns' },
  { key: 'ai',        icon: Sparkles,     href: '/ai',        label: 'Mijn AI' },
  { key: 'calendar',  icon: CalendarIcon, href: '/calendar',  label: 'Calendar' },
];

export function VerticalRail() {
  const [loc, navigate] = useLocation();

  const tab: 'inbox' | 'campaigns' | 'ai' | 'calendar' = loc.startsWith('/campaigns')
    ? 'campaigns'
    : loc.startsWith('/ai')
      ? 'ai'
      : loc.startsWith('/calendar')
        ? 'calendar'
        : 'inbox';

  // Replaiy has three surfaces (Inbox, Campaigns, Calendar). The + button
  // only adds a new campaign on the Campaigns surface; the inbox has no
  // cold-compose affordance (LinkedIn replies happen inline inside a
  // conversation) and Calendar is a "Coming soon" placeholder.
  const newAction = { href: '/campaigns/new', label: 'New campaign', icon: Plus };
  const NewIcon = newAction.icon;
  const showNew = tab === 'campaigns';

  // v16 — indicator must be a CIRCLE (width === height) inside each 52×52 segment.
  // Track width = 52, pad = 4 → indicator width = 52 - 4*2 = 44.
  // activeWidth = 52, INSET = 4 → indicator height = 52 - 4*2 = 44. ✓ 44×44 circle.
  const SLOT = 52;
  const PAD = 4;
  const INSET = 4;

  return (
    <aside
      data-testid="vertical-rail"
      // Floating column: fixed on the left, vertical stack of independent
      // glass pills. No container background, no border, no attached bar.
      // hidden below lg so mobile/tablet keeps using MobileBottomNav.
      className="hidden lg:flex flex-col items-center fixed left-4 top-4 bottom-4 z-30 gap-2 pointer-events-none"
      style={{ width: 64 }}
    >
      {/* 1. Tab pill — v23.1 Vadik Matveev's Liquid Glass Switcher.
         Direct port of https://codepen.io/fooontic/pen/KwpRaGr. */}
      <motion.div
        data-testid="vertical-nav-pill"
        initial={{ opacity: 0, scale: 0.92, x: -8 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
        className="pointer-events-auto"
      >
        {/* Vadik's pen is 244×70. For the vertical rail we render it
           horizontally first then rotate via orientation="vertical" so
           the proportions are preserved exactly. scale 0.75 gives
           ~183×52.5 which fits our 64px rail width nicely after
           rotation (the 52.5 cross-axis becomes the rail width). */}
        <VadikLiquidSwitcher
          testId="vertical-nav"
          orientation="vertical"
          scale={0.75}
          value={tab}
          onChange={(k) => {
            if (k === 'inbox') navigate('/');
            else if (k === 'campaigns') navigate('/campaigns');
            else if (k === 'ai') navigate('/ai');
            else navigate('/calendar');
          }}
          segments={PRIMARY.map((p) => ({
            key: p.key,
            icon: p.icon,
            label: p.label,
          }))}
        />
      </motion.div>

      {/* 12px gap */}
      <div style={{ height: 4 }} />

      {/* 2. Search */}
      <div className="pointer-events-auto">
        <GlassCircleButton
          label="Search"
          testId="rail-search"
          onClick={() => window.dispatchEvent(new CustomEvent('stilt:open-search'))}
        >
          <Search size={19} strokeWidth={1.75} />
        </GlassCircleButton>
      </div>

      {/* 3. + New — only on the Campaigns surface (adds a new campaign). */}
      {showNew && (
        <div className="pointer-events-auto">
          <GlassCircleButton
            label={newAction.label}
            testId="rail-new"
            onClick={() => navigate(newAction.href)}
          >
            <NewIcon size={19} strokeWidth={1.75} />
          </GlassCircleButton>
        </div>
      )}

      {/* v19 — Smart-toggle removed from chrome. Lives in Settings (AI section) only.
         The smartMode boolean in StiltContext continues to drive behavior. */}

      {/* Spacer */}
      <div className="flex-1" />

      {/* 5. Profile pill at bottom — v-replaiy: the Stilt profile menu was
         removed (fake template UI), but the SB avatar pill stays so we can
         wire it to something later. onClick is a no-op for now. */}
      <div className="pointer-events-auto" style={{ marginBottom: 0 }}>
        <GlassCircleButton
          label="Simon van Basten"
          testId="rail-profile"
        >
          <ProfileInitials initials="SB" />
        </GlassCircleButton>
      </div>
    </aside>
  );
}
