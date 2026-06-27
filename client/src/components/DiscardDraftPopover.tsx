// ─────────────────────────────────────────────────────────────────
// DiscardDraftPopover — v33
//
// Compact glass dropdown popover shown when a user attempts to close
// the compose view while it still contains content. Visually mirrors
// the Snooze dropdown in ConversationActionCluster: `lg-sheet` glass surface,
// rounded-2xl, small padding, items in a flex-col list.
//
// Replaces the previous ConfirmDiscardSheet (centered iOS-style alert).
// Anchored to the X close button in each compose wrapper via absolute
// positioning. The parent owns `open` state; this component renders
// nothing when closed and animates in/out via AnimatePresence.
//
// Behaviour:
//   • Click an item → invokes the handler. Popover does NOT auto-close;
//     the parent decides (typically by tearing the compose view down).
//   • Click outside the popover → calls onClose (cancel, no action).
//   • Escape → calls onClose (cancel, no action).
//
// No "Cancel" item — dismissing == cancel.
// ─────────────────────────────────────────────────────────────────
import { AnimatePresence, motion } from 'framer-motion';
import { APPLE_SPRING } from '@/lib/motion';
import { FileText, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState, useLayoutEffect, type CSSProperties, type RefObject } from 'react';
import { createPortal } from 'react-dom';

// ─── Standalone glass surface (works on top of frosted parents) ────
// `.lg-sheet` is too subtle when the popover sits over another glass
// surface (e.g. the compose sheet itself) — the backdrop-filter has
// nothing crisp to blur, so the popover reads flat grey. This recipe
// mirrors the Vadik sheen + rim-shadow stack used elsewhere in the
// app so the popover keeps its glassy look even on glass-over-glass.
function popoverGlassStyle(): CSSProperties {
  return {
    // v34 — Translucent neutral fill + heavy blur so the popover
    // genuinely refracts the content behind it (inbox / mail body /
    // sheet beneath). Avoids the milky-white look that happens when
    // a high-alpha white sheen sits on top of an already-frosted
    // parent. Uses --vadik-glass (a warm neutral grey) at low alpha
    // so light AND dark mode keep their tonal character.
    background:
      'color-mix(in srgb, var(--vadik-glass, #bbbbbc) 18%, transparent)',
    backdropFilter: 'blur(28px) saturate(180%) brightness(1.04)',
    WebkitBackdropFilter: 'blur(28px) saturate(180%) brightness(1.04)',
    boxShadow: [
      // Vadik rim highlight stack — subtle but clearly defines
      // the edge so it reads as a separate glass layer.
      'inset 0 0 0 1px color-mix(in srgb, var(--vadik-light, #fff) calc(var(--vadik-reflex-light, 1) * 18%), transparent)',
      'inset 1.8px 3px 0 -2px color-mix(in srgb, var(--vadik-light, #fff) calc(var(--vadik-reflex-light, 1) * 90%), transparent)',
      'inset -2px -2px 0 -2px color-mix(in srgb, var(--vadik-light, #fff) calc(var(--vadik-reflex-light, 1) * 80%), transparent)',
      'inset -0.3px -1px 4px 0 color-mix(in srgb, var(--vadik-dark, #000) calc(var(--vadik-reflex-dark, 1) * 12%), transparent)',
      // Outer lift — stronger drop so it separates from the
      // frosted compose sheet right beneath it.
      '0 4px 12px 0 color-mix(in srgb, var(--vadik-dark, #000) calc(var(--vadik-reflex-dark, 1) * 14%), transparent)',
      '0 14px 36px 0 color-mix(in srgb, var(--vadik-dark, #000) calc(var(--vadik-reflex-dark, 1) * 16%), transparent)',
    ].join(', '),
  };
}

export interface DiscardDraftPopoverProps {
  open: boolean;
  onClose: () => void;
  onSaveDraft: () => void;
  onDiscard: () => void;
  /** Ref to the anchor element (the X close button). The popover
   *  reads its bounding rect and positions itself in fixed coords
   *  underneath the anchor. Required — portal-based positioning
   *  needs absolute viewport coordinates because the popover is
   *  rendered into `document.body`, OUTSIDE any transform/filter
   *  parent that would otherwise break backdrop-filter. */
  anchorRef: RefObject<HTMLElement>;
  /** Horizontal alignment relative to the anchor.
   *    'start' — popover left edge aligns with anchor left edge.
   *    'end'   — popover right edge aligns with anchor right edge.
   *  Default 'start'. */
  align?: 'start' | 'end';
  /** Vertical gap (px) between the anchor's bottom and the popover
   *  top. Default 8. */
  offset?: number;
  /** Optional transform origin override for the motion entry/exit.
   *  Defaults derived from `align`. */
  transformOrigin?: string;
}

export function DiscardDraftPopover({
  open,
  onClose,
  onSaveDraft,
  onDiscard,
  anchorRef,
  align = 'start',
  offset = 8,
  transformOrigin,
}: DiscardDraftPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  // v34.1 — Portal-based positioning. We compute a fixed-viewport
  // rect from the anchor's bounding box so the popover can live in
  // document.body (escaping any transform/filter ancestor that would
  // otherwise neutralise backdrop-filter on the popover itself).
  const [pos, setPos] = useState<{ top: number; left: number; right: number } | null>(null);

  // Recompute position whenever the popover opens, the window is
  // resized, or the page is scrolled. We use useLayoutEffect so the
  // first paint already has correct coordinates (no flash at 0,0).
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setPos({
        top: r.bottom + offset,
        left: r.left,
        right: window.innerWidth - r.right,
      });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, anchorRef, offset]);

  // Escape closes the popover.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Click-outside closes the popover. The anchor element (X button)
  // is also excluded so toggling the X doesn't immediately reopen.
  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      const el = popoverRef.current;
      const anchor = anchorRef.current;
      const target = e.target as Node;
      if (el && el.contains(target)) return;
      if (anchor && anchor.contains(target)) return;
      onClose();
    };
    // Defer by one tick so the opening click doesn't immediately close.
    const id = window.setTimeout(() => {
      document.addEventListener('mousedown', handle);
    }, 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener('mousedown', handle);
    };
  }, [open, onClose, anchorRef]);

  // Compute fixed-viewport position styles. align='end' pins right
  // edge to anchor right edge; default pins left edge to anchor left.
  const resolvedOrigin = transformOrigin ?? (align === 'end' ? 'top right' : 'top left');
  const posStyle: CSSProperties = pos
    ? align === 'end'
      ? { position: 'fixed', top: pos.top, right: pos.right }
      : { position: 'fixed', top: pos.top, left: pos.left }
    : { position: 'fixed', top: -9999, left: -9999 };

  // Render through a portal into document.body so the popover lives
  // OUTSIDE any transform/filter/will-change ancestor. This is what
  // restores real backdrop-filter behaviour — framer-motion sheets,
  // VadikGlass surfaces, and overflow:hidden containers all create
  // stacking/filter contexts that neutralise backdrop-filter for
  // descendants. Living on document.body, the popover blurs the
  // actual page content behind it.
  const portalTarget = typeof document !== 'undefined' ? document.body : null;

  if (!portalTarget) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          ref={popoverRef}
          data-testid="discard-draft-popover"
          initial={{ opacity: 0, y: -6, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.95 }}
          transition={APPLE_SPRING}
          style={{
            ...posStyle,
            transformOrigin: resolvedOrigin,
            ...popoverGlassStyle(),
          }}
          className="z-[60] rounded-2xl p-1.5 min-w-[240px]"
        >
          <div className="flex flex-col gap-0.5">
            {/* Save as draft — neutral */}
            <button
              type="button"
              data-testid="discard-popover-save"
              onClick={onSaveDraft}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13.5px] font-medium hover-elevate active-elevate-2 text-left text-foreground/85"
            >
              <FileText
                size={14}
                strokeWidth={1.7}
                className="text-icon-muted shrink-0"
              />
              <span className="flex flex-col min-w-0 flex-1">
                <span className="leading-tight">Save as draft</span>
                <span className="text-[11px] text-foreground/50 leading-tight mt-0.5">
                  Available in your drafts folder
                </span>
              </span>
            </button>

            {/* Discard — destructive (red) */}
            <button
              type="button"
              data-testid="discard-popover-discard"
              onClick={onDiscard}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13.5px] font-medium hover-elevate active-elevate-2 text-left"
              style={{ color: 'color-mix(in srgb, #e5484d 88%, var(--foreground))' }}
            >
              <Trash2
                size={14}
                strokeWidth={1.7}
                className="shrink-0"
                style={{ color: 'color-mix(in srgb, #e5484d 85%, transparent)' }}
              />
              <span className="flex-1">Discard</span>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    portalTarget,
  );
}

export default DiscardDraftPopover;
