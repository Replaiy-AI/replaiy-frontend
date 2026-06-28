import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MoreHorizontal, Search as SearchIcon, X } from 'lucide-react';
import { APPLE_SPRING } from '@/lib/motion';
import { useReplaiy } from '@/state/ReplaiyContext';
import VadikGlass from './VadikGlass';
import { VadikGlassSurface } from './VadikGlassSurface';

// ─────────────────────────────────────────────────────────────────
// Persistent mobile top-chrome shell.
//
// The shell stays mounted across route changes; the slot CONTENT
// changes per route via useMobileTopChromeSlot.
//
// Each slot can declare:
//   - leftSlot:   React.ReactNode (overrides the default ••• button)
//   - centerSlot: React.ReactNode (always replaces the toggle pill area)
//   - rightSlot:  React.ReactNode (overrides the default search circle)
//
// If the slot omits a side, the default chrome element renders there:
//   - left  default = ••• (opens dotsMenu)
//   - right default = search (expands inline)
// ─────────────────────────────────────────────────────────────────

export interface MobileChromeSlot {
  /** Center content. Usually a SegmentedToggle on list pages, a contact pill on detail pages. */
  togglePill?: React.ReactNode;
  /** Custom left element (overrides default ••• button). */
  leftSlot?: React.ReactNode;
  /** Custom right element (overrides default search button). */
  rightSlot?: React.ReactNode;
  /** Placeholder shown in the search input when open (default search behavior only). */
  searchPlaceholder?: string;
  /** Optional override for the search query state. If omitted, falls back to global `query`. */
  searchQuery?: string;
  setSearchQuery?: (q: string) => void;
  /** Optional override for the "more" button click. Defaults to opening the dots menu. */
  onMore?: () => void;
  /** Hide entire chrome. */
  hidden?: boolean;
  /** Used for ordering when multiple slots register; higher wins. */
  priority?: number;
}

interface SlotRegistry {
  active: MobileChromeSlot | null;
  register: (slot: MobileChromeSlot) => () => void;
}

const Ctx = createContext<SlotRegistry | null>(null);

export function MobileTopChromeProvider({ children }: { children: React.ReactNode }) {
  const slotsRef = useRef<Map<number, MobileChromeSlot>>(new Map());
  const idRef = useRef(0);
  const [active, setActive] = useState<MobileChromeSlot | null>(null);

  const recompute = () => {
    const all = Array.from(slotsRef.current.entries());
    if (all.length === 0) {
      setActive(null);
      return;
    }
    all.sort((a, b) => {
      const pa = a[1].priority ?? 0;
      const pb = b[1].priority ?? 0;
      if (pa !== pb) return pb - pa;
      return b[0] - a[0];
    });
    setActive(all[0][1]);
  };

  const register = (slot: MobileChromeSlot) => {
    const id = ++idRef.current;
    slotsRef.current.set(id, slot);
    recompute();
    return () => {
      slotsRef.current.delete(id);
      recompute();
    };
  };

  const value = useMemo<SlotRegistry>(() => ({ active, register }), [active]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMobileTopChromeSlot(slot: MobileChromeSlot | null | undefined) {
  const reg = useContext(Ctx);
  useEffect(() => {
    if (!reg || !slot) return;
    const unreg = reg.register(slot);
    return unreg;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    reg,
    slot?.togglePill,
    slot?.leftSlot,
    slot?.rightSlot,
    slot?.searchPlaceholder,
    slot?.searchQuery,
    slot?.setSearchQuery,
    slot?.onMore,
    slot?.hidden,
    slot?.priority,
  ]);
}

export function MobileTopChromeShell() {
  const reg = useContext(Ctx);
  const active = reg?.active ?? null;
  const {
    setDotsMenuOpen,
    query: globalQuery,
    setQuery: setGlobalQuery,
    sheetOpen,
  } = useReplaiy();
  const [searchOpen, setSearchOpen] = useState(false);

  const searchQuery = active?.searchQuery ?? globalQuery;
  const setSearchQuery = active?.setSearchQuery ?? setGlobalQuery;
  const searchPlaceholder = active?.searchPlaceholder ?? 'Search mail…';

  // Close search whenever the active slot changes
  useEffect(() => {
    setSearchOpen(false);
  }, [active?.searchPlaceholder, active?.leftSlot, active?.rightSlot]);

  if (active?.hidden) return null;
  // v32.2 — Hide the persistent mobile top-chrome (Profile avatar +
  // Search circle) whenever any global bottom-sheet/overlay is open.
  // Mirrors the bottom-nav/FAB fade in MobileBottomNav so the visible
  // top "glass debris" doesn't float above the sheet (most visible in
  // the Compose flow on shorter devices).
  if (sheetOpen) return null;

  const hasCustomLeft = !!active?.leftSlot;
  const hasCustomRight = !!active?.rightSlot;

  return (
    <>
      {/* No backdrop veil — the 3 chrome elements are independently floating
          glass pills. Content scrolls UNDERNEATH them and is blurred only
          by each pill's own backdrop-filter. Visible whitespace gaps
          between the three elements expose the canvas/content behind. */}
      <div
        className="md:hidden fixed inset-x-0 z-40 pointer-events-none flex items-center justify-between px-4 gap-3"
        style={{ top: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
      >
      {/* LEFT — custom or default ••• */}
      <AnimatePresence initial={false} mode="popLayout">
        {!searchOpen && (
          hasCustomLeft ? (
            <motion.div
              key="left-custom"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={APPLE_SPRING}
              className="pointer-events-auto shrink-0"
            >
              {active!.leftSlot}
            </motion.div>
          ) : (
            <motion.button
              key="more"
              data-testid="button-mobile-more"
              onClick={() => (active?.onMore ? active.onMore() : setDotsMenuOpen(true))}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={APPLE_SPRING}
              className="glass-pill h-[52px] w-[52px] rounded-full flex items-center justify-center text-icon active-elevate-2 pointer-events-auto shrink-0"
              aria-label="More"
            >
              <MoreHorizontal size={19} strokeWidth={1.75} />
            </motion.button>
          )
        )}

        {/* CENTER — togglePill content */}
        {!searchOpen && (
          <motion.div
            key="center-slot"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={APPLE_SPRING}
            style={{ height: 52 }}
            className="pointer-events-auto"
          >
            {active?.togglePill ?? (
              // Reserve space when no page has registered yet so the
              // right element doesn't shift to the center.
              <div style={{ width: 0, height: 52 }} />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* RIGHT — custom or default search */}
      {hasCustomRight && !searchOpen ? (
        <motion.div
          key="right-custom"
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.85 }}
          transition={APPLE_SPRING}
          className="pointer-events-auto shrink-0"
        >
          {active!.rightSlot}
        </motion.div>
      ) : (
        // v30.29 — Mobile search opent nu DE Universal Search modal
        // (zelfde modal als desktop, met view-categorie chips en
        // multi-section resultaten). Geen morphing inline-bar meer.
        // De `searchOpen` state hieronder is niet meer gebruikt voor
        // de inline-balk, maar we laten 'm staan voor backward-compat
        // met andere callsites die deze modus nog nodig hebben.
        <motion.div
          key="search-toggle"
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.85 }}
          transition={APPLE_SPRING}
          className="pointer-events-auto shrink-0"
        >
          <VadikGlass
            width={52}
            height={52}
            shape="circle"
            data-testid="button-search-toggle"
            aria-label="Search"
            onClick={() => window.dispatchEvent(new CustomEvent('replaiy:open-search'))}
          >
              <SearchIcon size={19} strokeWidth={1.75} className="text-icon" />
          </VadikGlass>
        </motion.div>
      )}
      </div>
    </>
  );
}
