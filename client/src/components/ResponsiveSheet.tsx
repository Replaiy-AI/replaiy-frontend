// ─────────────────────────────────────────────────────────────────
// v15 — ResponsiveSheet
//
// A unified wrapper that renders its children as either:
//   • Bottom sheet on < lg (mobile + tablet)
//   • Right-side slide-in panel on ≥ lg (desktop)
//
// Behavior parity with the legacy bottom-sheet pattern:
//   • Backdrop click dismisses
//   • Escape dismisses
//   • Bottom sheet: drag-down dismisses (offset > 140 || velocity > 500)
//   • Right panel: drag-right dismisses (offset > 140 || velocity > 500)
//
// All sheets share the same glass-strong treatment and APPLE_SPRING
// transition so they feel like the same family of surfaces.
//
// Side-effect: drives global `sheetOpen` so the bottom nav + FAB
// fade out while any sheet is up — same as the legacy AiSummarySheet.
// ─────────────────────────────────────────────────────────────────
import { useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { APPLE_SPRING } from '@/lib/motion';
import { useReplaiy } from '@/state/ReplaiyContext';

export type ResponsiveSheetWidth = 'sm' | 'md' | 'lg'; // 340 / 380 / 480

const WIDTH_PX: Record<ResponsiveSheetWidth, number> = {
  sm: 340,
  md: 380,
  lg: 480,
};

interface ResponsiveSheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Width on desktop panel mode. Bottom-sheet ignores this and goes full-width. */
  desktopWidth?: ResponsiveSheetWidth;
  /** Max height for bottom-sheet mode. Default 80vh. */
  mobileMaxHeight?: string;
  /** v30.34 — fullscreen op mobile: 100vh, geen rounded top, geen drag-handle.
     Voor sheets die als volledig scherm moeten voelen (zoals het contact panel). */
  mobileFullscreen?: boolean;
  /** v30.34 — forceer het sheet om mobileMaxHeight te gebruiken als vaste
     hoogte (height) ipv maximum. Voorkomt "springen" als content per state
     verschilt (bv. tabs of editing mode). Default false. */
  mobileFixedHeight?: boolean;
  /** Override for the height of the desktop right-panel. Defaults to full viewport. */
  desktopFullHeight?: boolean;
  /** data-testid prefix */
  testId?: string;
  /** Drive global sheetOpen so bottom-nav/FAB fade. Default true. */
  manageGlobalSheetOpen?: boolean;
  /** z-index override (default 50). */
  zIndex?: number;
}

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia('(min-width: 1024px)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const h = () => setIsDesktop(mq.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);
  return isDesktop;
}

export function ResponsiveSheet({
  open,
  onClose,
  children,
  desktopWidth = 'sm',
  mobileMaxHeight = '80vh',
  mobileFullscreen = false,
  mobileFixedHeight = false,
  desktopFullHeight = true,
  testId = 'responsive-sheet',
  manageGlobalSheetOpen = true,
  zIndex = 50,
}: ResponsiveSheetProps) {
  const isDesktop = useIsDesktop();
  const { setSheetOpen } = useReplaiy();

  useEffect(() => {
    if (!manageGlobalSheetOpen) return;
    setSheetOpen(open);
    return () => setSheetOpen(false);
  }, [open, manageGlobalSheetOpen, setSheetOpen]);

  // Escape dismisses on both.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const widthPx = WIDTH_PX[desktopWidth];

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop — lighter on desktop (panel doesn't take over the screen) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            data-testid={`${testId}-backdrop`}
            className="fixed inset-0 backdrop-blur-[2px]"
            style={{
              zIndex: zIndex - 1,
              background: isDesktop ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.4)',
            }}
          />

          {isDesktop ? (
            // ─── DESKTOP: right-side slide-in panel ───
            <motion.div
              data-testid={testId}
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={APPLE_SPRING}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={{ left: 0, right: 0.3 }}
              onDragEnd={(_, info) => {
                if (info.offset.x > 140 || info.velocity.x > 500) onClose();
              }}
              className="fixed top-0 bottom-0 right-0 glass-strong flex flex-col"
              style={{
                zIndex,
                width: widthPx,
                maxWidth: '90vw',
                borderTopLeftRadius: 28,
                borderBottomLeftRadius: 28,
                height: desktopFullHeight ? '100vh' : undefined,
                boxShadow: '-12px 0 40px rgba(0,0,0,0.18)',
              }}
            >
              {children}
            </motion.div>
          ) : (
            // ─── MOBILE / TABLET: bottom sheet ───
            <motion.div
              data-testid={testId}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={APPLE_SPRING}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.3 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 140 || info.velocity.y > 500) onClose();
              }}
              className="fixed inset-x-0 bottom-0 glass-strong pt-3 flex flex-col"
              style={{
                zIndex,
                maxHeight: mobileMaxHeight,
                // v30.34 — fixed height (ipv maxHeight) zodat het sheet
                // altijd dezelfde y-positie heeft, ongeacht tab/editing
                // content-lengte. Voorkomt het "springen" wanneer je
                // tussen Overview/Contact wisselt of edit-mode toggle't.
                height: mobileFixedHeight ? mobileMaxHeight : undefined,
                // Alleen top rounded, bottom vlak op de schermrand.
                borderRadius: '28px 28px 0 0',
              }}
            >
              {/* Drag handle */}
              <div className="mx-auto h-1 w-10 rounded-full bg-foreground/15 mb-1 shrink-0" />
              {children}
            </motion.div>
          )}
        </>
      )}
    </AnimatePresence>
  );
}
