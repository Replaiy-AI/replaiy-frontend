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
//   autoFlip — when true, the direction is decided on each open from the
//              trigger's viewport position: DOWNWARD by default, flipping to
//              UPWARD only when there is not enough room below AND more room
//              above. Overrides `anchor` while open. Default false (so the
//              plain `anchor` behavior is unchanged for every existing caller).
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
import { createPortal } from 'react-dom';
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
  autoFlip = false,
  align = 'left',
  width = 'w-60',
  surfaceClassName = '',
  className = '',
  testId,
  onOpenChange,
}: {
  trigger: (props: GlassPopoverRenderProps) => ReactNode;
  children: ReactNode | ((props: GlassPopoverRenderProps) => ReactNode);
  anchor?: 'top' | 'bottom';
  /** When true, resolve the open direction from the trigger's viewport
   *  position on each open (down by default, flip up only when cramped
   *  below). Overrides `anchor` while open; `anchor` stays the fallback. */
  autoFlip?: boolean;
  /** Horizontal edge to align the floating surface to the trigger. */
  align?: 'left' | 'right';
  width?: string;
  surfaceClassName?: string;
  /** Extra classes for the OUTER wrapper div. Lets callers make the wrapper
   *  full-width (the default `inline-block` shrink-wraps to the trigger). */
  className?: string;
  testId?: string;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(false);
  // When autoFlip is on, the resolved open direction (measured on each open).
  // Falls back to the `anchor` prop until the first measurement runs.
  const [flipDir, setFlipDir] = useState<'top' | 'bottom'>(anchor);
  // Trigger's viewport rect, used to position the portaled fixed menu.
  const [rect, setRect] = useState<DOMRect | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  // Ref on the portaled menu container. Because the menu is rendered to
  // document.body (outside `ref`), outside-click detection must also treat
  // clicks inside the menu as "inside" — otherwise selecting an option would
  // close the popover before the option's onClick fires.
  const menuRef = useRef<HTMLDivElement>(null);

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

  // With autoFlip, decide the direction from the trigger's viewport position on
  // each open: open DOWNWARD by default, and flip to UPWARD only when there is
  // not enough room below (bottom + estimated menu height would overflow the
  // viewport) AND there is more room above than below. Recomputed every open.
  useLayoutEffect(() => {
    if (!autoFlip || !open || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const MENU_EST = 280;
    const roomBelow = window.innerHeight - r.bottom;
    const roomAbove = r.top;
    const flipUp = r.bottom + MENU_EST > window.innerHeight && roomAbove > roomBelow;
    setFlipDir(flipUp ? 'top' : 'bottom');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, autoFlip]);

  // Measure the trigger rect while open so the portaled fixed menu can be
  // positioned from viewport coordinates. Recompute on scroll (capture phase,
  // passive, to catch any scrolling ancestor) and on resize so the menu tracks
  // the trigger. Cleared + listeners removed on close/unmount.
  useLayoutEffect(() => {
    if (!open) {
      setRect(null);
      return;
    }
    const measure = () => {
      if (ref.current) setRect(ref.current.getBoundingClientRect());
    };
    measure();
    window.addEventListener('scroll', measure, { capture: true, passive: true });
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('scroll', measure, { capture: true } as EventListenerOptions);
      window.removeEventListener('resize', measure);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Close on outside click / Escape.
  useLayoutEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      const inTrigger = ref.current?.contains(target);
      const inMenu = menuRef.current?.contains(target);
      if (!inTrigger && !inMenu) setOpenState(false);
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

  // Position + motion direction follow the resolved direction (autoFlip) or the
  // static anchor; horizontal edge follows align.
  const dir = autoFlip ? flipDir : anchor;
  const transformOrigin = `${dir === 'top' ? 'bottom' : 'top'} ${align}`;
  const y = dir === 'top' ? 6 : -6;

  // Fixed viewport coordinates for the portaled menu, derived from the measured
  // trigger rect. Horizontal: align=left → the menu's left edge hugs the
  // trigger's left (left: rect.left); align=right → the menu's right edge hugs
  // the trigger's right (right: window.innerWidth - rect.right) so we never
  // need to measure the menu width. Vertical: `bottom` drops the menu just
  // below the trigger (top: rect.bottom + 6); `top` anchors the menu's bottom
  // just above the trigger (bottom: window.innerHeight - rect.top + 6).
  const menuStyle: React.CSSProperties | null = rect
    ? {
        position: 'fixed',
        zIndex: 1000,
        transformOrigin,
        ...(align === 'right'
          ? { right: window.innerWidth - rect.right }
          : { left: rect.left }),
        ...(dir === 'top'
          ? { bottom: window.innerHeight - rect.top + 6 }
          : { top: rect.bottom + 6 }),
      }
    : null;

  return (
    <div ref={ref} className={`relative inline-block ${className}`}>
      {trigger(renderProps)}
      {/* Render the floating menu in a portal on document.body so it escapes
          the card's DOM/stacking entirely — nothing (including sibling
          backdrop-filter glass pills) can composite over or through it. */}
      {createPortal(
        <AnimatePresence>
          {open && menuStyle && (
            <motion.div
              ref={menuRef}
              initial={{ opacity: 0, y, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y, scale: 0.97 }}
              transition={APPLE_SPRING}
              className={width}
              style={menuStyle}
            >
              {/* Local dim-scrim: sits EXACTLY behind the sheet (same size +
                  radius, inset-0) so it never sticks out as a larger blurred
                  rectangle behind the rounded popover. It softens the busy
                  content directly behind the sheet without any halo. Stronger in
                  dark, very subtle in light. Not a full-screen modal dimmer. */}
              <div
                aria-hidden="true"
                className="absolute inset-0 -z-10 backdrop-blur-[3px] pointer-events-none"
                style={{
                  borderRadius: 22,
                  background: dark ? 'rgba(0,0,0,0.34)' : 'rgba(0,0,0,0.05)',
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
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}
