// ─────────────────────────────────────────────────────────────────
// GlassPopover — a small, reusable popover that floats above or below its
// trigger. Unlike a Snooze-style pill stack (which only reads well over an
// EMPTY zone), this popover often opens in the middle of busy content, so it
// uses the SAME approved glass recipe as UniversalSearch: a real frosted
// glass sheet (gradient fill + backdrop-blur + soft inset rim shadow, NO hard
// border, NO flat bg-popover) PLUS a subtle LOCAL dim-scrim directly behind
// the surface so the chips / message text behind it fall away and the sheet
// stays readable. The scrim is local (slightly larger than the popover), not
// a full-screen modal dimmer.
//
// API (kept deliberately small + reusable):
//   trigger  — render-prop: (props) => ReactNode. Receives { open, toggle,
//              close } so the caller styles its own glass-pill trigger button
//              and wires onClick={toggle}.
//   children — the popover content (a list, or a search field + list). May be
//              a node or a render-prop receiving { open, toggle, close }.
//   anchor   — 'bottom' opens DOWNWARD (mt-1.5, origin top); 'top' opens
//              UPWARD (bottom-full mb-1.5, origin bottom). Default 'bottom'.
//   width    — Tailwind width class for the floating surface (e.g. 'w-60').
//   surfaceClassName — extra classes appended to the glass surface.
//   testId   — data-testid for the floating surface.
//   onOpenChange — fired with the next open state on every change.
//
// The caller fully controls the content; this component owns open/close state,
// outside-click + Escape dismissal, positioning, motion, the scrim and the
// glass sheet.
// ─────────────────────────────────────────────────────────────────
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { APPLE_SPRING } from '@/lib/motion';

export interface GlassPopoverRenderProps {
  open: boolean;
  toggle: () => void;
  close: () => void;
}

// The frosted glass sheet recipe, mirrored from UniversalSearch. Inline style
// is theme-aware via the `dark` flag (inline styles cannot use dark: variants).
// Alphas are a touch higher than UniversalSearch because we only have a small
// local scrim instead of a full-screen dimmer, so the sheet must carry more of
// the opacity itself.
function sheetStyle(dark: boolean): React.CSSProperties {
  return {
    borderRadius: 22,
    background: dark
      ? 'linear-gradient(180deg, rgba(30,30,34,0.90) 0%, rgba(26,26,30,0.86) 60%, rgba(24,24,28,0.82) 100%)'
      : 'linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(255,255,255,0.94) 60%, rgba(255,255,255,0.92) 100%)',
    backdropFilter: 'blur(20px) saturate(150%)',
    WebkitBackdropFilter: 'blur(20px) saturate(150%)',
    boxShadow: dark
      ? 'inset 0 0 0 1px color-mix(in srgb, #fff 14%, transparent), inset 1.8px 3px 0 -2px color-mix(in srgb, #fff 22%, transparent), inset -2px -2px 0 -2px color-mix(in srgb, #fff 16%, transparent), 0 1px 5px 0 color-mix(in srgb, #000 30%, transparent), 0 24px 64px 0 color-mix(in srgb, #000 50%, transparent)'
      : 'inset 0 0 0 1px color-mix(in srgb, #fff 50%, transparent), inset 1.8px 3px 0 -2px color-mix(in srgb, #fff 80%, transparent), inset -2px -2px 0 -2px color-mix(in srgb, #fff 60%, transparent), 0 1px 5px 0 color-mix(in srgb, #000 6%, transparent), 0 24px 64px 0 color-mix(in srgb, #000 18%, transparent)',
  };
}

export function GlassPopover({
  trigger,
  children,
  anchor = 'bottom',
  width = 'w-60',
  surfaceClassName = '',
  testId,
  onOpenChange,
}: {
  trigger: (props: GlassPopoverRenderProps) => ReactNode;
  children: ReactNode | ((props: GlassPopoverRenderProps) => ReactNode);
  anchor?: 'top' | 'bottom';
  width?: string;
  surfaceClassName?: string;
  testId?: string;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const setOpenState = (next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
  };

  // Track the active theme so the inline glass fill stays dark-aware. The app
  // toggles a `dark` class on <html>; observe it so theme switches re-render.
  useEffect(() => {
    const root = document.documentElement;
    const read = () => setDark(root.classList.contains('dark'));
    read();
    const obs = new MutationObserver(read);
    obs.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  // Close on outside click / Escape.
  useLayoutEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpenState(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenState(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const renderProps: GlassPopoverRenderProps = {
    open,
    toggle: () => setOpenState(!open),
    close: () => setOpenState(false),
  };

  // Position + motion direction follow the anchor.
  const positionClasses =
    anchor === 'top' ? 'bottom-full mb-1.5 left-0' : 'mt-1.5 left-0';
  const transformOrigin = anchor === 'top' ? 'bottom left' : 'top left';
  const y = anchor === 'top' ? 6 : -6;

  return (
    <div ref={ref} className="relative inline-block">
      {trigger(renderProps)}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y, scale: 0.97 }}
            transition={APPLE_SPRING}
            className={`absolute z-30 ${positionClasses} ${width}`}
            style={{ transformOrigin }}
          >
            {/* Local dim-scrim: a FEATHERED radial gradient that sits just
                behind the sheet and fades to fully transparent before the
                edges, so it softens the busy content directly behind the
                popover WITHOUT leaving a hard grey rectangular halo. Center
                alpha is very low in light mode (where any rim is obvious) and
                stronger in dark. Not a full-screen modal dimmer. */}
            <div
              aria-hidden="true"
              className="absolute -inset-4 -z-10 backdrop-blur-[2px] pointer-events-none"
              style={{
                background: dark
                  ? 'radial-gradient(120% 120% at 50% 50%, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.30) 45%, rgba(0,0,0,0) 78%)'
                  : 'radial-gradient(120% 120% at 50% 50%, rgba(0,0,0,0.07) 0%, rgba(0,0,0,0.04) 45%, rgba(0,0,0,0) 78%)',
              }}
            />
            {/* Frosted glass sheet (UniversalSearch recipe). */}
            <div
              data-testid={testId}
              className={`relative overflow-hidden p-1.5 ${surfaceClassName}`}
              style={sheetStyle(dark)}
            >
              {typeof children === 'function' ? children(renderProps) : children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
