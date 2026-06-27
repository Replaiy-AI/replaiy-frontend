// ─────────────────────────────────────────────────────────────────
// ComposeColumnDesktop — v33
//
// Desktop counterpart to ComposeSheetMobile. Provides the SAME glass
// chrome layout (sticky top: X / Compose+subject pill / Send, sticky
// bottom floating formatting pill) but without the sheet shell:
// it simply fills column 3 of the LayoutShell from top to bottom.
//
// The InlineReplyBar is rendered inside in `chromeless` composeMode
// so it hides its own header right-side group, internal formatting
// toolbar row, and floating Send circle — letting this wrapper
// supply that chrome instead.
//
// Mobile (<1024px) uses ComposeSheetMobile and is unchanged. The
// reply / forward use case on MailDetail does not use chromeless and
// is also unaffected.
// ─────────────────────────────────────────────────────────────────
import { useRef, useState, type ReactNode } from 'react';
import {
  X,
  Send,
  Bold,
  Italic,
  Underline,
  List,
  Link2,
  Paperclip,
} from 'lucide-react';
import { DiscardDraftPopover } from './DiscardDraftPopover';

// ─── Shared glass surface recipe (mirrors ComposeSheetMobile) ────
// The same `chromePillStyle` is used for both icon buttons and the
// centre pill in the top bar plus the floating formatting toolbar
// at the bottom, so the desktop chrome visually agrees with mobile.
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

// ─── Imperative trigger types (re-used from mobile sheet) ────────
export type FormatKind = 'bold' | 'italic' | 'underline' | 'ul' | 'ol' | 'link';
export type SendRef = { current: (() => void) | null };
export type FormatRef = { current: ((fmt: FormatKind) => void) | null };
export type FileRef = { current: (() => void) | null };
export type CloseRef = { current: (() => void) | null };
// v33 — Discard popover triggers, anchored to this wrapper's X.
export type HasContentRef = { current: (() => boolean) | null };
export type SaveDraftRef = { current: (() => void) | null };
export type DiscardRef = { current: (() => void) | null };

export interface ComposeColumnDesktopProps {
  /** Live subject string from the bar; rendered as the secondary line
   *  in the centred "Compose" pill. Empty → faint placeholder. */
  subject: string;
  /** Close handler — fallback when the bar's discard trigger has not
   *  yet attached. The X delegates to `closeRef` first. */
  onClose: () => void;
  /** Reserved for future use — the chrome's Send button currently
   *  delegates to `sendRef` (which the bar attaches). */
  onSend?: () => void;
  /** Refs the wrapper invokes when its chrome buttons are pressed.
   *  The InlineReplyBar attaches its internal handlers via the
   *  matching `external*Trigger` props. */
  sendRef: SendRef;
  formatRef: FormatRef;
  fileRef: FileRef;
  closeRef?: CloseRef;
  /** v33 — Discard popover support. When the bar reports unsaved
   *  content via `hasContentRef`, the X opens a glass dropdown
   *  popover anchored to it; otherwise the X closes immediately.
   *  Save / Discard items forward to the bar via `saveDraftRef`
   *  / `discardRef`. */
  hasContentRef?: HasContentRef;
  saveDraftRef?: SaveDraftRef;
  discardRef?: DiscardRef;
  /** v34.2 — Currently active inline formats reported by the bar.
   *  Drives the glass indicator capsule under each format button. */
  activeFormats?: Array<'bold' | 'italic' | 'underline' | 'ul' | 'ol'>;
  /** v37 — Column mode. Drives ONLY the title text of the centred pill
   *  ("Compose" / "Reply" / "Forward"). All other chrome is identical —
   *  the same wrapper hosts compose AND desktop reply/forward focus
   *  mode, mirroring ComposeSheetMobile's `mode` prop. */
  mode?: 'compose' | 'reply' | 'forward';
  /** v37 — Optional explicit title override. Wins over the mode default. */
  title?: string;
  /** v37 — Placeholder string when `subject` is empty. Defaults to
   *  "New message" for compose, "No subject" for reply/forward. */
  subjectPlaceholder?: string;
  /** The InlineReplyBar instance, configured with composeMode +
   *  chromeless + matching external trigger props. */
  children: ReactNode;
}

export function ComposeColumnDesktop({
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
}: ComposeColumnDesktopProps) {
  // v37 — Default title per mode. `title` prop wins when supplied.
  const resolvedTitle =
    title ??
    (mode === 'reply' ? 'Reply' : mode === 'forward' ? 'Forward' : 'New message');
  // v33 — Local popover state.
  const [discardOpen, setDiscardOpen] = useState(false);
  // v34.1 — Anchor ref for the portal-based DiscardDraftPopover.
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  // v32 + v33 — Centralised "close requested" handler. If the bar
  // reports unsaved content via `hasContentRef`, open the glass
  // discard popover anchored to our own X. Otherwise close directly
  // through the bar's `closeRef` (which clears localStorage +
  // navigates), or fall back to `onClose`.
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
  // so localStorage cleanup + navigation stay consistent.
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

  // Invoke a stored imperative trigger. If the bar has not yet
  // attached its handler (first render race) we no-op.
  const fire = (
    ref: { current: ((...args: any[]) => void) | null },
    arg?: any,
  ) => {
    const fn = ref.current;
    if (fn) fn(arg);
  };

  return (
    <div
      data-testid="compose-column-desktop"
      className="relative flex flex-col h-full w-full min-h-0"
    >
      {/* ─── Sticky top chrome (60px) ────────────────────────────── */}
      <div
        className="shrink-0 flex items-center justify-between gap-3 px-5"
        style={{ height: 60 }}
      >
        {/* Close X — opens the glass discard popover when the bar has
           unsaved content. The popover is anchored top-left underneath
           the X button. */}
        <button
          ref={closeBtnRef}
          type="button"
          data-testid="compose-column-close"
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

        {/* Compose + subject pill (centred) */}
        <div
          data-testid="compose-column-pill"
          className="flex-1 min-w-0 mx-1 flex items-center justify-center"
        >
          <div
            className="inline-flex flex-col items-center justify-center px-6 py-1 rounded-full min-w-0 max-w-full"
            style={{ ...chromePillStyle(), height: 40, maxWidth: 360 }}
          >
            <span className="text-[13px] font-semibold tracking-[-0.01em] text-foreground leading-tight">
              {resolvedTitle}
            </span>
            {/* v-replaiy — Subject subtitle removed: LinkedIn outreach has no
               subject line. Only render the secondary line if an explicit
               value is supplied (kept for compatibility). */}
            {subject ? (
              <span
                className="text-[11.5px] text-foreground/55 leading-tight truncate max-w-[280px]"
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
          data-testid="compose-column-send"
          onClick={() => fire(sendRef)}
          aria-label="Send message"
          className="h-10 w-10 rounded-full flex items-center justify-center text-icon hover-elevate active-elevate-2 shrink-0"
          style={chromePillStyle()}
        >
          <Send size={19} strokeWidth={1.75} />
        </button>
      </div>

      {/* ─── Body: the chromeless InlineReplyBar. The bar manages its
            own internal scroll for the editor body; padding-bottom
            reserves space for the floating formatting pill so the
            editor's last lines stay above it. */}
      <div
        className="flex-1 min-h-0 flex flex-col px-6 py-2 overflow-hidden"
        style={{ paddingBottom: 88 }}
      >
        {children}
      </div>

      {/* ─── Floating bottom formatting toolbar (glass pill) ──────── */}
      <div
        className="absolute left-1/2 -translate-x-1/2 z-10 pointer-events-none"
        style={{ bottom: 24, width: '85%', maxWidth: 480 }}
      >
        <div
          className="pointer-events-auto flex items-center justify-between gap-1 px-3 rounded-full"
          style={{ ...chromePillStyle(), height: 52 }}
        >
          <FormatBtn
            label="Bold"
            testId="compose-column-fmt-bold"
            onClick={() => fire(formatRef, 'bold')}
            active={activeFormats.includes('bold')}
          >
            <Bold
              size={18}
              strokeWidth={activeFormats.includes('bold') ? 3.2 : 2.2}
            />
          </FormatBtn>
          <FormatBtn
            label="Italic"
            testId="compose-column-fmt-italic"
            onClick={() => fire(formatRef, 'italic')}
            active={activeFormats.includes('italic')}
          >
            <Italic
              size={18}
              strokeWidth={activeFormats.includes('italic') ? 3.2 : 2.2}
            />
          </FormatBtn>
          <FormatBtn
            label="Underline"
            testId="compose-column-fmt-underline"
            onClick={() => fire(formatRef, 'underline')}
            active={activeFormats.includes('underline')}
          >
            <Underline
              size={18}
              strokeWidth={activeFormats.includes('underline') ? 3.2 : 2.2}
            />
          </FormatBtn>
          {/* v38.2 — Bulleted-list button removed: markdown shortcuts
             ("- " or "1. " at start of line) already create lists. */}
          <FormatBtn
            label="Insert link"
            testId="compose-column-fmt-link"
            onClick={() => fire(formatRef, 'link')}
          >
            <Link2 size={18} strokeWidth={2} />
          </FormatBtn>
          <FormatBtn
            label="Attach file"
            testId="compose-column-fmt-attach"
            onClick={() => fire(fileRef)}
          >
            <Paperclip size={18} strokeWidth={2} />
          </FormatBtn>
        </div>
      </div>
    </div>
  );
}

// Local icon button — same recipe as the mobile sheet's FormatBtn so
// the two glass pills agree pixel-for-pixel in look-and-feel.
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
  // v34.3 — Apple Mail-style active state. See ComposeSheetMobile
  // FormatBtn for rationale (multiple stacked toggles → capsules
  // create visual chaos; icon weight + darker foreground is calmer).
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

export default ComposeColumnDesktop;
