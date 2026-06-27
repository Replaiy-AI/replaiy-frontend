// ─────────────────────────────────────────────────────────────────
// Route-aware ••• menu sheet.
//
// The ••• button in the persistent mobile top-chrome toggles a
// global `dotsMenuOpen` flag. THIS sheet renders the Conversations
// menu (Done + Settings) for the inbox routes.
//
//   • Inbox (/, /briefing, /archive) → Conversations menu
//       Done · Settings
//
//   • Conversation detail            → no menu (those routes register
//                                      their own leftSlot = back arrow,
//                                      so the ••• button is hidden).
//
// One global sheet. Same `setSheetOpen` linkage as before so the
// bottom nav + FAB hide while the menu is up.
// ─────────────────────────────────────────────────────────────────
import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation } from 'wouter';
import { X } from 'lucide-react';
import { useStilt } from '@/state/StiltContext';
import { APPLE_SPRING } from '@/lib/motion';
import { SECONDARY_NAV, SETTINGS_NAV } from '@/lib/nav';

export function DotsMenuSheet() {
  const { dotsMenuOpen, setDotsMenuOpen, setSheetOpen } = useStilt();
  const [loc, navigate] = useLocation();

  // Drive global sheetOpen so the bottom nav + FAB hide.
  useEffect(() => {
    setSheetOpen(dotsMenuOpen);
    return () => setSheetOpen(false);
  }, [dotsMenuOpen, setSheetOpen]);

  // Conversation detail registers its own leftSlot (back arrow), so the
  // ••• button isn't rendered there at all; we don't open a menu for
  // those routes either as a safety net.
  const isConversationDetail = loc.startsWith('/conversation/');
  if (isConversationDetail) {
    return null;
  }

  // ── CONVERSATIONS menu items ─────────────────────────────────────
  const conversationItems = [...SECONDARY_NAV, SETTINGS_NAV].map((n) => ({
    label: n.label,
    icon: n.icon,
    href: n.href,
    testId: `menu-item-${n.key}`,
  }));

  const close = () => setDotsMenuOpen(false);
  const goNav = (href: string) => {
    close();
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
            onClick={close}
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
            className="fixed left-3 top-16 z-50 w-[260px] glass-strong rounded-3xl p-2 shadow-2xl"
          >
            <SheetHeader label="Conversations" onClose={close} />
            <div className="flex flex-col gap-0.5" data-testid="dots-menu-conversations">
              {conversationItems.map((it) => {
                const I = it.icon;
                return (
                  <button
                    key={it.label}
                    data-testid={it.testId}
                    onClick={() => goNav(it.href)}
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

function SheetHeader({ label, onClose }: { label: string; onClose: () => void }) {
  return (
    <div className="px-3 pt-1.5 pb-2 flex items-center justify-between">
      <span className="text-[11.5px] uppercase tracking-wider font-semibold text-foreground/55">
        {label}
      </span>
      <button
        onClick={onClose}
        aria-label="Close menu"
        className="h-6 w-6 rounded-full flex items-center justify-center text-icon hover-elevate active-elevate-2"
      >
        <X size={14} strokeWidth={1.8} />
      </button>
    </div>
  );
}
