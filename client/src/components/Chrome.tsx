import { Plus, SquarePen, Search, MoreHorizontal, type LucideIcon } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { AnimatePresence, motion } from 'framer-motion';
import { PRIMARY_NAV } from '@/lib/nav';
import { mockEvents } from '@/data/mockEvents';
import { GlassSegmentedToggle } from './GlassSegmentedToggle';
import { VadikLiquidSwitcher } from './VadikLiquidSwitcher';
import VadikGlass from './VadikGlass';
import { StiltAvatar } from './Avatar';
import { GlassCircleButton } from './GlassCircleButton';

// v30.32 — FAB "+" gebruikt nu centrale GlassCircleButton, identiek aan
// Search/Profile/Done/Snooze. Geen duplicate VadikGlass-wrapper meer.
// v31 — In Mail-context tonen we SquarePen i.p.v. Plus (compose affordance).
function FabComposeButton({
  href,
  ariaLabel,
  icon: Icon = Plus,
}: {
  href: string;
  ariaLabel: string;
  icon?: LucideIcon;
}) {
  const [, navigate] = useLocation();
  return (
    <GlassCircleButton
      label={ariaLabel}
      testId="fab-compose"
      onClick={() => navigate(href)}
      showTooltip={false}
    >
      <Icon size={19} strokeWidth={1.75} className="text-icon" />
    </GlassCircleButton>
  );
}

// v15.4 — DesktopRail is now the narrow VerticalRail (72px).
export { VerticalRail as DesktopRail } from './VerticalRail';

// ─────────────────────────────────────────────────────────────────
// v15.3 Desktop sidebar — 288px wide, 52px chrome rhythm.
//
//   • Sidebar width 244 → 288px to fit the 3-up header row:
//       tab pill (52) + search (52) + plus (52)
//   • Sidebar attached to viewport edge (v15.2). Glass treatment.
//   • Header row: [tab pill | search | +] — all 52×52 for visual rhythm.
//   • NO Categories section (v15.3 — user confirmed unused).
//   • Subtle color-tinted icons per context (Snoozed → purple clock,
//     Done → green check, Spam → muted red…).
//   • Hover state on nav items: very subtle glass-fill via existing
//     .hover-elevate.
// ─────────────────────────────────────────────────────────────────

// v30.31 — Perplexity stijl: sidebar nav icons zijn allemaal
// monochroom (foreground). Vroeger had elke nav een iOS-systeem-tint
// (paars / groen / oranje / lichtblauw / rood), maar Perplexity kiest
// voor neutraal en gebruikt kleur alleen voor accent-momenten (AI
// gradient). Lege string = default neutral.
const ICON_TINT: Record<string, string> = {
  inbox: '', snoozed: '', done: '', drafts: '', spam: '',
  today: '', thisweek: '', mycals: '', tz: '',
  recent: '', pinned: '', shared: '', templates: '', trash: '',
};


export function MobileBottomNav() {
  const [loc, setLoc] = useLocation();
  const { sheetOpen, rsvpOverrides } = useStilt();

  if (
    loc.startsWith('/compose') ||
    loc.startsWith('/mail/')
  ) {
    return null;
  }

  const fabHref = loc.startsWith('/calendar')
    ? '/calendar/new'
    : loc.startsWith('/campaigns')
      ? '/campaigns'
      : '/compose';
  const fabLabel = loc.startsWith('/calendar')
    ? 'New event'
    : loc.startsWith('/campaigns')
      ? 'New campaign'
      : 'New message';
  // v31 — Inbox FAB krijgt SquarePen (nieuwe outreach); Campaigns/Calendar blijven Plus.
  const fabIcon: LucideIcon =
    loc.startsWith('/calendar') || loc.startsWith('/campaigns') ? Plus : SquarePen;

  const navValue: 'inbox' | 'campaigns' | 'calendar' = loc.startsWith('/calendar')
    ? 'calendar'
    : loc.startsWith('/campaigns')
      ? 'campaigns'
      : 'inbox';

  // v30.32 — Pending-invite dot op tab-pill verwijderd; was visueel ruis
  // bovenop de calendar segment en niet consistent met de rest van het
  // Perplexity-design. Pending invites worden in-context getoond.


  return (
    <div className="lg:hidden fixed bottom-4 inset-x-0 z-30 pointer-events-none flex items-center px-4 gap-2.5">
      <AnimatePresence>
        {!sheetOpen && (
          <motion.div
            key="bottom-nav-pill"
            data-testid="bottom-nav-pill"
            initial={{ opacity: 0, scale: 0.92, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 8 }}
            transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
            className="pointer-events-auto relative"
          >
            <VadikLiquidSwitcher
              testId="bottom-nav"
              orientation="horizontal"
              scale={0.85}
              value={navValue}
              onChange={(k) => {
                if (k === 'inbox') setLoc('/');
                else if (k === 'campaigns') setLoc('/campaigns');
                else setLoc('/calendar');
              }}
              segments={[
                { key: 'inbox',     icon: PRIMARY_NAV[0].icon, label: 'Inbox' },
                { key: 'campaigns', icon: PRIMARY_NAV[1].icon, label: 'Campaigns' },
                { key: 'calendar',  icon: PRIMARY_NAV[2].icon, label: 'Calendar' },
              ]}
            />

          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!sheetOpen && (
          <motion.div
            key="fab"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
            className="ml-auto pointer-events-auto"
          >
            {/* v30.3 — FAB "+" gebruikt nu VadikButton (1-op-1 DOM-recipe
                van de werkende tab-pill: outer <div> + inner <fieldset>).
                Doel: bewijzen dat 1-segment Vadik glass schoon rendert op
                iOS Safari met content erachter. Als deze clean is, kunnen
                we de Reply pill ook naar VadikButton porten. */}
            <FabComposeButton href={fabHref} ariaLabel={fabLabel} icon={fabIcon} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

import { useStilt } from '@/state/StiltContext';

// v15.4 — Tablet rail: keep the bottom nav (mobile pattern) since tablets
// are still touch-first. TabletLeftRail therefore renders nothing; both
// mobile + tablet share the same MobileBottomNav + MobileTopChrome.
export function TabletLeftRail() {
  return null;
}

export function TopBar({
  title,
  showSearch = true,
  showMore = true,
  rightSlot,
}: {
  title?: React.ReactNode;
  showSearch?: boolean;
  showMore?: boolean;
  rightSlot?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-5 lg:px-6 pt-3 pb-2 lg:py-4 sticky top-0 z-20 bg-transparent pointer-events-none">
      <div className="flex items-center gap-2 pointer-events-auto">
        {showMore && (
          <button
            data-testid="button-more"
            className="h-10 w-10 rounded-full glass-pill flex items-center justify-center active-elevate-2"
            aria-label="More"
          >
            <MoreHorizontal size={19} strokeWidth={1.75} className="text-icon" />
          </button>
        )}
      </div>
      <div className="flex-1 flex items-center justify-center min-w-0 pointer-events-auto">{title}</div>
      <div className="flex items-center gap-2 pointer-events-auto">
        {rightSlot}
        {showSearch && (
          // v30.6 — Search icon vervangen door VadikGlass shape="circle"
          // (zelfde recipe als Done/Snooze/Forward/+, die werken op iOS).
          // Was: 40×40 glass-pill div met UA-button artifacts.
          // 44×44 om visueel beter te balanceren met de +-FAB (52) en
          // toch compacter te blijven in de top-bar.
          <GlassCircleButton
            label="Search"
            testId="button-search"
            onClick={() => window.dispatchEvent(new CustomEvent('stilt:open-search'))}
            showTooltip={false}
            size={44}
          >
            <Search size={19} strokeWidth={1.75} className="text-icon" />
          </GlassCircleButton>
        )}
      </div>
    </div>
  );
}
