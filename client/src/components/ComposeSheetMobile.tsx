// ─────────────────────────────────────────────────────────────────
// ComposeSheetMobile — v32
//
// Mobile compose presentation wrapper. Renders the InlineReplyBar
// (in composeMode + chromeless) inside a bottom sheet (92vh, rounded
// top 28px, flat bottom, glass-strong) on top of a blurred / dimmed
// backdrop showing the inbox underneath.
//
// Pattern is intentionally identical to ContactSheetMobile in
// ContactInfoPanel.tsx: AnimatePresence + spring-up motion, no drag,
// fixed height.
//
// Provided chrome:
//   • Sticky top (56px): [X close]  [Compose + subject pill]  [Send]
//   • Sticky bottom: floating glass pill with B / I / U / list / link /
//     paperclip — wired into InlineReplyBar via imperative ref triggers.
//
// Hidden inside the bar (via the new `chromeless` prop):
//   • Right-side action group in the recipients header (Cc chevron,
//     maximize, close X)
//   • Inline formatting toolbar row
//   • Floating Send circle
//
// Desktop (>=1024px) uses Compose.tsx default path — this component
// never mounts there.
// ─────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useStilt } from '@/state/StiltContext';
import {
  X,
  Send,
  WandSparkles,
  Bold,
  Italic,
  Underline,
  List,
  Link2,
  Paperclip,
} from 'lucide-react';
import { APPLE_SPRING } from '@/lib/motion';
import { DiscardDraftPopover } from './DiscardDraftPopover';

// ─── Shared glass surface recipe ─────────────────────────────────
// Mirrors the recipe used in InlineReplyBar.glassSurfaceStyle() and
// ContactSheetMobile so the sheet visually agrees with the rest of
// the Vadik glass system.
function sheetGlassStyle(): React.CSSProperties {
  return {
    background:
      'linear-gradient(180deg, color-mix(in srgb, var(--vadik-light, #fff) calc(var(--vadik-reflex-light, 1) * 55%), transparent) 0%, color-mix(in srgb, var(--vadik-light, #fff) calc(var(--vadik-reflex-light, 1) * 40%), transparent) 45%, color-mix(in srgb, var(--vadik-light, #fff) calc(var(--vadik-reflex-light, 1) * 30%), transparent) 78%, color-mix(in srgb, var(--vadik-light, #fff) calc(var(--vadik-reflex-light, 1) * 22%), transparent) 100%)',
    backdropFilter: 'blur(24px) saturate(150%)',
    WebkitBackdropFilter: 'blur(24px) saturate(150%)',
    boxShadow:
      'inset 0 0 0 1px color-mix(in srgb, var(--vadik-light, #fff) calc(var(--vadik-reflex-light, 1) * 50%), transparent), inset 1.8px 3px 0 -2px color-mix(in srgb, var(--vadik-light, #fff) calc(var(--vadik-reflex-light, 1) * 80%), transparent), inset -2px -2px 0 -2px color-mix(in srgb, var(--vadik-light, #fff) calc(var(--vadik-reflex-light, 1) * 60%), transparent), 0 1px 5px 0 color-mix(in srgb, var(--vadik-dark, #000) calc(var(--vadik-reflex-dark, 1) * 6%), transparent), 0 -8px 32px 0 color-mix(in srgb, var(--vadik-dark, #000) calc(var(--vadik-reflex-dark, 1) * 12%), transparent)',
  };
}

// Glass pill style for the small floating chrome elements (compose
// pill in the top centre + bottom formatting pill). Slightly more
// solid than the sheet itself so it reads as "above".
function chromePillStyle(): React.CSSProperties {
  return {
    background:
      'linear-gradient(180deg, color-mix(in srgb, var(--vadik-light, #fff) calc(var(--vadik-reflex-light, 1) * 60%), transparent) 0%, color-mix(in srgb, var(--vadik-light, #fff) calc(var(--vadik-reflex-light, 1) * 40%), transparent) 100%)',
    backdropFilter: 'blur(14px) saturate(150%)',
    WebkitBackdropFilter: 'blur(14px) saturate(150%)',
    boxShadow:
      'inset 0 0 0 1px color-mix(in srgb, var(--vadik-light, #fff) calc(var(--vadik-reflex-light, 1) * 50%), transparent), inset 1.8px 3px 0 -2px color-mix(in srgb, var(--vadik-light, #fff) calc(var(--vadik-reflex-light, 1) * 80%), transparent), inset -2px -2px 0 -2px color-mix(in srgb, var(--vadik-light, #fff) calc(var(--vadik-reflex-light, 1) * 50%), transparent), 0 6px 18px 0 color-mix(in srgb, var(--vadik-dark, #000) calc(var(--vadik-reflex-dark, 1) * 10%), transparent)',
  };
}

// ─── Imperative trigger types ────────────────────────────────────
export type FormatKind = 'bold' | 'italic' | 'underline' | 'ul' | 'ol' | 'link';
export type SendRef = { current: (() => void) | null };
export type FormatRef = { current: ((fmt: FormatKind) => void) | null };
export type FileRef = { current: (() => void) | null };
// v32.1 — Close trigger: routes the wrapper's X button through the
// InlineReplyBar's discard/save flow so we don't bypass the dialog.
export type CloseRef = { current: (() => void) | null };
// v33 — Discard-popover triggers. The wrapper now owns the popover
// (anchored to its X), and reads/writes through these refs.
export type HasContentRef = { current: (() => boolean) | null };
export type SaveDraftRef = { current: (() => void) | null };
export type DiscardRef = { current: (() => void) | null };

// ─── Public API ──────────────────────────────────────────────────
export interface ComposeSheetMobileProps {
  /** Live subject string from the bar; rendered as the secondary line
   *  in the centred "Compose" pill. Empty string → secondary line is
   *  replaced by a faint placeholder. */
  subject: string;
  /** Close handler — invoked only as a fallback (e.g. when backdrop
   *  click bypasses the bar). The X button delegates to `closeRef` first
   *  so the discard/save dialog can run. */
  onClose: () => void;
  /** Refs that ComposeSheetMobile invokes when its chrome buttons are
   *  pressed. The InlineReplyBar attaches its internal handlers to
   *  these on every render via the matching `external*Trigger` props. */
  sendRef: SendRef;
  formatRef: FormatRef;
  fileRef: FileRef;
  /** v32.1 — Close request ref. The X in the sheet header calls this,
   *  which routes into the InlineReplyBar's hasComposeContent check and
   *  shows the ConfirmDiscardSheet when there is unsaved content. */
  closeRef?: CloseRef;
  /** v33 — Discard-popover triggers. The wrapper opens its own glass
   *  dropdown popover anchored to the X button when `hasContentRef`
   *  returns true; otherwise the X closes immediately. Save/Discard
   *  items invoke `saveDraftRef` / `discardRef`. */
  hasContentRef?: HasContentRef;
  saveDraftRef?: SaveDraftRef;
  discardRef?: DiscardRef;
  /** v34.2 — Currently active inline formats reported by the bar.
   *  Drives the glass indicator capsule under each format button so
   *  the bottom toolbar mirrors the tab-pill (Mail/Calendar/Docs)
   *  active state behaviour. */
  activeFormats?: Array<'bold' | 'italic' | 'underline' | 'ul' | 'ol'>;
  /** v36 — Sheet mode. Drives ONLY the title text of the centred pill
   *  ("Compose" / "Reply" / "Forward"). All other chrome (X, send,
   *  format pill, layout, motion) is identical across modes — the same
   *  fullscreen-keyboard-friendly editor host is reused for compose,
   *  reply and forward on mobile. The optional `title` override wins if
   *  passed (allows ad-hoc labels). */
  mode?: 'compose' | 'reply' | 'forward';
  title?: string;
  /** v36 — Placeholder string when `subject` is empty. Defaults to
   *  "New message" to preserve existing Compose behaviour. */
  subjectPlaceholder?: string;
  /** The InlineReplyBar instance, configured with composeMode +
   *  chromeless + matching external trigger props. */
  children: ReactNode;
}

export function ComposeSheetMobile({
  subject,
  onClose,
  sendRef,
  formatRef,
  fileRef,
  closeRef,
  hasContentRef,
  saveDraftRef,
  discardRef,
  activeFormats = [],
  mode = 'compose',
  title,
  subjectPlaceholder,
  children,
}: ComposeSheetMobileProps) {
  // v36 — Default title per mode. `title` prop wins when supplied.
  const resolvedTitle =
    title ??
    (mode === 'reply' ? 'Reply' : mode === 'forward' ? 'Forward' : 'New message');
  // v33 — Local discard popover state. Anchored to the X button.
  const [discardOpen, setDiscardOpen] = useState(false);
  // v34.1 — Anchor ref for the portal-based DiscardDraftPopover.
  // The popover lives on document.body and reads this ref's
  // getBoundingClientRect() to position itself in viewport coords.
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  // v35 — Collapsed-by-default formatting pill. Starts closed to
  // give the editor maximum room next to the on-screen keyboard;
  // the Aa toggle is always visible and expands the pill rightwards.
  const [formatPillOpen, setFormatPillOpen] = useState(false);
  // v32.2 — Drive the global `sheetOpen` signal while the compose sheet
  // is mounted. This mirrors what ResponsiveSheet does for all other
  // global bottom sheets (ProfileMenu, DotsMenuSheet, ContactInfoPanel,
  // Calendar event sheets, …) and causes the persistent mobile chrome
  // (Profile avatar + Search icon top, bottom nav + FAB) to fade away
  // for the duration of the compose flow. Without this, the SG avatar
  // and search circle floated visually above/behind the sheet's top
  // chrome and looked like leftover UI debris on shorter devices.
  const { setSheetOpen } = useStilt();
  useEffect(() => {
    setSheetOpen(true);
    return () => setSheetOpen(false);
  }, [setSheetOpen]);

  // v32.1 + v33 — Centralised "close requested" handler. If the bar
  // reports unsaved content via `hasContentRef`, we open the local
  // discard popover anchored to our own X. Otherwise we delegate to
  // the bar's `closeRef` (which clears localStorage + navigates), and
  // if even that isn't wired yet, fall back to `onClose`.
  const requestClose = () => {
    const hasContent = hasContentRef?.current?.() ?? false;
    if (hasContent) {
      setDiscardOpen(true);
      return;
    }
    const fn = closeRef?.current;
    if (fn) fn();
    else onClose();
  };

  // Popover actions forward to the bar's own handlers when available,
  // so localStorage cleanup + navigation stay consistent with the
  // legacy in-bar flow.
  const handlePopoverSave = () => {
    setDiscardOpen(false);
    const fn = saveDraftRef?.current;
    if (fn) fn();
    else onClose();
  };
  const handlePopoverDiscard = () => {
    setDiscardOpen(false);
    const fn = discardRef?.current;
    if (fn) fn();
    else onClose();
  };

  // Click-outside on the backdrop also routes through the discard flow,
  // matching the X button behaviour. (User can still dismiss the dialog.)
  const handleBackdropClick = () => requestClose();

  // Invoke a stored imperative trigger. Safe-guards: if the bar has
  // not yet attached its handler (first render race) we no-op rather
  // than crash.
  const fire = (ref: { current: ((...args: any[]) => void) | null }, arg?: any) => {
    const fn = ref.current;
    if (fn) fn(arg);
  };

  return (
    <>
      {/* Backdrop — dim + light blur over inbox/calendar behind. */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={handleBackdropClick}
        data-testid="compose-sheet-backdrop"
        className="fixed inset-0 z-40"
        style={{
          background: 'rgba(0,0,0,0.15)',
          backdropFilter: 'blur(8px) saturate(140%)',
          WebkitBackdropFilter: 'blur(8px) saturate(140%)',
        }}
      />

      {/* Sheet — 92vh, rounded top 28px, flat bottom. */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={APPLE_SPRING}
        data-testid="compose-sheet-mobile"
        className="fixed inset-x-0 bottom-0 z-50 flex flex-col"
        style={{
          height: '92vh',
          borderRadius: '28px 28px 0 0',
          overflow: 'hidden',
          ...sheetGlassStyle(),
        }}
      >
        {/* ─── Sticky top chrome (56px) ───────────────────────────── */}
        <div
          className="shrink-0 flex items-center justify-between gap-3 px-4"
          style={{ height: 56 }}
        >
          {/* Close X — opens the glass discard popover when the bar
             reports unsaved content, otherwise closes the sheet. The
             popover is anchored top-left underneath the X button. */}
          <button
            ref={closeBtnRef}
            type="button"
            data-testid="compose-sheet-close"
            onClick={requestClose}
            aria-label="Close compose"
            className="h-10 w-10 rounded-full flex items-center justify-center text-icon hover-elevate active-elevate-2 shrink-0"
            style={chromePillStyle()}
          >
            <X size={19} strokeWidth={1.75} />
          </button>
          <DiscardDraftPopover
            open={discardOpen}
            onClose={() => setDiscardOpen(false)}
            onSaveDraft={handlePopoverSave}
            onDiscard={handlePopoverDiscard}
            anchorRef={closeBtnRef}
            align="start"
          />

          {/* Compose + subject pill (centred, max-width fit) */}
          <div
            data-testid="compose-sheet-pill"
            className="flex-1 min-w-0 mx-1 flex items-center justify-center"
          >
            <div
              className="inline-flex flex-col items-center justify-center px-4 py-1 rounded-full min-w-0 max-w-full"
              style={{ ...chromePillStyle(), height: 40 }}
            >
              <span className="text-[12.5px] font-semibold tracking-[-0.01em] text-foreground leading-tight">
                {resolvedTitle}
              </span>
              {/* v-replaiy — Subject subtitle removed: LinkedIn outreach has
                 no subject line. */}
              {subject ? (
                <span
                  className="text-[11px] text-foreground/55 leading-tight truncate max-w-[58vw]"
                  title={subject || undefined}
                >
                  {subject}
                </span>
              ) : null}
            </div>
          </div>

          {/* Send */}
          <button
            type="button"
            data-testid="compose-sheet-send"
            onClick={() => fire(sendRef)}
            aria-label="Send message"
            className="h-10 w-10 rounded-full flex items-center justify-center text-icon hover-elevate active-elevate-2 shrink-0"
            style={chromePillStyle()}
          >
            <Send size={19} strokeWidth={1.75} />
          </button>
        </div>

        {/* ─── Scroll area: contains the chromeless InlineReplyBar.
              The bar already manages its own internal scroll for the
              editor body, but we wrap it in a flex-1 column so the
              recipient + subject rows pin to the top and the editor
              auto-grows underneath. Padding-bottom reserves space for
              the floating formatting pill so the editor's last lines
              are never hidden behind it. */}
        <div
          className="flex-1 min-h-0 flex flex-col overflow-hidden"
          style={{ paddingBottom: 72 }}
        >
          {children}
        </div>

        {/* ─── Floating formatting pill (collapsible, anchored right) ────
            v35.1 — Default state is a single round Aa glass-circle
            button pinned to bottom-right (same visual treatment as the
            top-right Send circle). Tapping it expands the pill LEFT-
            wards to reveal B / I / U / list / link / attach; tap again
            to collapse. Right-anchored so the user's typing cursor
            (left side of editor) stays clear. */}
        <div
          className="absolute z-10 pointer-events-none"
          style={{ bottom: 16, right: 16 }}
        >
          {/* v35.2 — Container is sized to its content: a perfect 44x44
             circle when collapsed, and stretches into a pill when the
             format icons slide in on the left. The flex items inside
             carry the actual interactive surfaces. */}
          <div
            className="pointer-events-auto flex items-center rounded-full overflow-hidden"
            style={{ ...chromePillStyle(), height: 44, padding: 2 }}
          >
            {/* Expanded format icons appear to the LEFT of the toggle
                (right-anchored pill grows leftwards). */}
            <AnimatePresence initial={false}>
              {formatPillOpen && (
                <motion.div
                  key="compose-sheet-fmt-expanded"
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 'auto', opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={APPLE_SPRING}
                  className="flex items-center overflow-hidden"
                >
                  <div className="flex items-center pl-1">
            <FormatBtn
              label="Bold"
              testId="compose-sheet-fmt-bold"
              onClick={() => fire(formatRef, 'bold')}
              active={activeFormats.includes('bold')}
            >
              <Bold
                size={17}
                strokeWidth={activeFormats.includes('bold') ? 3.2 : 2.2}
              />
            </FormatBtn>
            <FormatBtn
              label="Italic"
              testId="compose-sheet-fmt-italic"
              onClick={() => fire(formatRef, 'italic')}
              active={activeFormats.includes('italic')}
            >
              <Italic
                size={17}
                strokeWidth={activeFormats.includes('italic') ? 3.2 : 2.2}
              />
            </FormatBtn>
            <FormatBtn
              label="Underline"
              testId="compose-sheet-fmt-underline"
              onClick={() => fire(formatRef, 'underline')}
              active={activeFormats.includes('underline')}
            >
              <Underline
                size={17}
                strokeWidth={activeFormats.includes('underline') ? 3.2 : 2.2}
              />
            </FormatBtn>
            {/* v38.2 — Bulleted-list button removed: users can already
               start a list by typing "- " or "1. " at the start of a
               line (markdown shortcut handled in InlineReplyBar). */}
            <FormatBtn
              label="Insert link"
              testId="compose-sheet-fmt-link"
              onClick={() => fire(formatRef, 'link')}
            >
              <Link2 size={17} strokeWidth={2} />
            </FormatBtn>
            <FormatBtn
              label="Attach file"
              testId="compose-sheet-fmt-attach"
              onClick={() => fire(fileRef)}
            >
              <Paperclip size={17} strokeWidth={2} />
            </FormatBtn>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Toggle — the always-visible right-edge button. Shows a
                pen icon when collapsed ("open formatting") and an X
                when expanded ("close formatting"). The icon swap makes
                it visually distinct from the B/I/U toggles to its left,
                so the user can tell at a glance which one closes the
                pill. */}
            <FormatBtn
              label={formatPillOpen ? 'Hide formatting' : 'Show formatting'}
              testId="compose-sheet-fmt-toggle"
              onClick={() => setFormatPillOpen((v) => !v)}
              active={formatPillOpen}
            >
              {formatPillOpen ? (
                <X size={18} strokeWidth={2} />
              ) : (
                <WandSparkles size={17} strokeWidth={1.9} />
              )}
            </FormatBtn>
          </div>
        </div>
      </motion.div>
    </>
  );
}

function FormatBtn({
  label,
  testId,
  onClick,
  active = false,
  children,
}: {
  label: string;
  testId: string;
  onClick: () => void;
  active?: boolean;
  children: ReactNode;
}) {
  // v34.3 — Apple Mail-style active state: no capsule. Active toggle
  // is signalled purely by icon weight (parent passes a thicker
  // strokeWidth) + a darker foreground colour. Toggles can stack
  // (bold + italic + underline simultaneously) so this stays calm,
  // unlike a glass indicator capsule which would create visual
  // chaos with multiple actives. Inactive uses the standard icon
  // tint; active swaps to full foreground for prominence.
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      onMouseDown={(e) => e.preventDefault()}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={`h-10 w-10 rounded-full flex items-center justify-center active-elevate-2 transition-colors ${
        active ? 'text-foreground' : 'text-icon hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}

// Helper for external consumers: create a fresh ref-bundle for all the
// imperative triggers the InlineReplyBar can attach to. v33 adds the
// hasContentRef / saveDraftRef / discardRef so wrappers can drive the
// new glass dropdown popover anchored to their own X button.
export function useComposeSheetRefs() {
  const sendRef = useRef<(() => void) | null>(null);
  const formatRef = useRef<((fmt: FormatKind) => void) | null>(null);
  const fileRef = useRef<(() => void) | null>(null);
  const closeRef = useRef<(() => void) | null>(null);
  const hasContentRef = useRef<(() => boolean) | null>(null);
  const saveDraftRef = useRef<(() => void) | null>(null);
  const discardRef = useRef<(() => void) | null>(null);
  return {
    sendRef,
    formatRef,
    fileRef,
    closeRef,
    hasContentRef,
    saveDraftRef,
    discardRef,
  };
}

export default ComposeSheetMobile;
