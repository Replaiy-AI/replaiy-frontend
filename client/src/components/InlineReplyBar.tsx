// ─────────────────────────────────────────────────────────────────
// v30.30 — Inline reply bar (final iteration)
//
// Gedragsmodel (overal: mobile + desktop):
//   • Default = compact strip (1 regel) onderaan de mail-detail pane.
//   • Klik op de strip → groeit naar full editor (chat-style):
//       - Recipients row (To + Cc/Bcc toggle)
//       - Formatting toolbar (B/I/U/list/list/link)
//       - ContentEditable area (auto-grow tot 50vh)
//       - Footer (⌘⏎ hint + send button)
//   • Klik BUITEN editor + tekst is leeg/onveranderd → terug naar compact.
//   • Klik buiten editor + er staat tekst → blijft open (draft niet verliezen).
//   • Auto-save draft per toetsaanslag in localStorage (per mail-id).
//   • Fullscreen knop:
//       - Mobile: editor neemt visible viewport over (zonder keyboard).
//       - Desktop: editor vult kolom 3 (mail-detail pane), met blur op
//         kolom 1+2 + achtergrond (backdrop effect zoals search modal).
//
// Belangrijke regels:
//   • Alle React hooks MOETEN voor de early return staan (anders
//     "Rendered more hooks" crash bij switchen tussen mails).
//   • Geen <button>-in-<button>: VadikGlass rendert intern al een button,
//     dus wrappers gebruiken `div role="button"` of `stopPropagation`.
// ─────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Send,
  Sparkles,
  List,
  X,
  Maximize2,
  Minimize2,
  Plus,
  ChevronDown,
  CornerUpRight,
  Paperclip,
  WandSparkles,
  File as FileIcon,
  Image as ImageIcon,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { APPLE_SPRING } from '@/lib/motion';
import VadikGlass from './VadikGlass';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLocation } from 'wouter';
import { DiscardDraftPopover } from './DiscardDraftPopover';

/** v30.30 — Forward state: leeg To-veld, pre-filled editor met forward-block.
 *  Wanneer aanwezig openen we de bar in forward-mode (expanded + leeg To). */
export interface ForwardContext {
  /** HTML/plain body die als forward-quote in de editor komt. */
  body: string;
  /** Subject met Fwd: prefix. Wordt meegestuurd in onSend payload. */
  subject: string;
  /** Bestanden uit de originele mail/thread, pre-gevuld als chips in de
   *  attachments-row (zoals zelf-geüploade files). Voor mock-data zijn
   *  dit lege File-stubs met de juiste name+size. Het echte forwarden
   *  van binaries gebeurt server-side op basis van de origin mail-id. */
  attachments?: File[];
  /** Optioneel: human-readable label per attachment (fallback voor banner). */
  attachmentLabels?: string[];
}

interface InlineReplyBarProps {
  /** Pre-generated AI draft (rich text or plain). Falsy = leeg veld. */
  aiDraft?: string | null;
  /** Naam van de mail-sender (default recipient name). */
  recipientName?: string;
  /** Email van de mail-sender (default To). */
  recipientEmail?: string;
  /** Unieke mail-id, gebruikt voor localStorage draft-key. */
  mailId?: string;
  /** Wanneer gezet, opent de bar direct in forward-mode (expanded + leeg To
   *  + editor pre-filled met forward-block). Wordt geclear'd na Send. */
  forwardContext?: ForwardContext | null;
  /** Callback om forward-mode te annuleren (parent state resetten). */
  onForwardCancel?: () => void;
  /** v-replaiy — Optioneel: Dismiss-actie. Markeert de draft als afgehandeld
   *  (done/dismissed) en navigeert terug naar de inbox. Rendert de Dismiss
   *  ghost-knop naast de Approve & send-knop wanneer aanwezig. */
  onDismiss?: () => void;
  /** Callback bij Send. kind onderscheidt reply/forward/compose. Subject is
   *  alleen relevant bij forward of compose (bij reply geërfd van thread). */
  onSend: (payload: {
    kind: 'reply' | 'forward' | 'compose';
    html: string;
    subject?: string;
    to: string[];
    cc: string[];
    bcc: string[];
    attachments: File[];
  }) => void;
  /** Optioneel: callback voor edge-case expand (niet getoond in UI). */
  onExpand?: () => void;
  /** Optioneel: roept bij elke expand/collapse change (mobile UI kan de
   *  Forward-button hide'n wanneer expanded). */
  onExpandedChange?: (expanded: boolean) => void;
  /** v31 — Wanneer true: bar opent direct expanded met een Subject row
   *  bovenop. Geen collapsed state, geen forward banner, geen thread
   *  context. Autosave-key wordt `stilt:draft:compose`. Editor placeholder
   *  past zich aan. Gebruikt door pages/Compose.tsx. */
  composeMode?: boolean;
  /** v31 — Optioneel: pre-fill Subject veld (toekomstige forward-to-compose
   *  of reply-to-compose flows). */
  defaultSubject?: string;
  /** v32 — Chromeless mode: hides internal header action buttons (Cc toggle,
   *  fullscreen, close X), formatting toolbar and floating Send pill. The
   *  parent (ComposeSheetMobile wrapper) provides these via its own chrome. */
  chromeless?: boolean;
  /** v32 — Fires whenever the live subject changes (composeMode only).
   *  ComposeSheetMobile uses this to render the live subject preview in its
   *  centered glass pill. */
  onSubjectChange?: (subject: string) => void;
  /** v32 — Imperative-style ref slots. ComposeSheetMobile assigns its own
   *  `.current` hooks so its sticky chrome / bottom toolbar buttons can call
   *  back into the bar (send / format / attach) without prop-drilling state. */
  externalSendTrigger?: { current: (() => void) | null };
  externalFormatTrigger?: {
    current: ((fmt: 'bold' | 'italic' | 'underline' | 'ul' | 'ol' | 'link') => void) | null;
  };
  externalFileTrigger?: { current: (() => void) | null };
  /** v32.1 — ComposeSheetMobile wrapper attaches its close X to this so it
   *  routes through the same discard/save flow as the internal close. */
  externalRequestCloseTrigger?: { current: (() => void) | null };
  /** v33 — Wrapper-owned discard popover support. The wrapper's X click
   *  asks `externalHasContentTrigger?.()` to decide whether to open the
   *  popover or close immediately. When the popover's Save/Discard
   *  buttons fire, the wrapper invokes `externalSaveDraftTrigger`
   *  / `externalDiscardTrigger`. These mirror the bar's internal
   *  handlers so behaviour is consistent across mount points. */
  externalHasContentTrigger?: { current: (() => boolean) | null };
  externalSaveDraftTrigger?: { current: (() => void) | null };
  externalDiscardTrigger?: { current: (() => void) | null };
  /** v32.1 — Called when the user resolves the discard flow with either
   *  "Save as draft" or "Discard". The parent typically navigates back to
   *  the inbox. Not fired on "Cancel". */
  onComposeClose?: () => void;
  /** v34.2 — Published whenever the editor's active inline-format set
   *  changes (e.g. cursor moves into bold text → ['bold'] flows out).
   *  ComposeSheetMobile / ComposeColumnDesktop subscribe to this so their
   *  floating formatting pill can render a glass indicator capsule under
   *  each active toggle — mirroring the Mail/Calendar/Docs tab-pill
   *  active indicator. Empty array when nothing active. */
  onActiveFormatsChange?: (formats: Array<'bold' | 'italic' | 'underline' | 'ul' | 'ol'>) => void;
  /** v36 — Start the bar in the expanded editor state instead of the
   *  collapsed placeholder strip. Used by the mobile reply/forward
   *  fullscreen-sheet wrapper (ComposeSheetMobile in mode='reply' or
   *  'forward'): the parent already decided the editor is open by
   *  mounting the sheet, so the bar should not show its collapsed
   *  placeholder. */
  initialExpanded?: boolean;
  /** v36 — When provided, taps on the collapsed placeholder strip do
   *  NOT expand the bar internally; instead this callback fires and the
   *  parent decides what to do (typically: mount ComposeSheetMobile and
   *  render a fresh chromeless+initialExpanded InlineReplyBar inside).
   *  Used by ConversationTimeline on mobile so the keyboard-friendly
   *  92vh sheet hosts the editor, mirroring Compose. */
  onOpenRequest?: () => void;
  /** v37 — When provided, the desktop maximize ↗ button does NOT toggle
   *  the legacy fullscreen portal; it fires this callback instead. The
   *  parent typically mounts a ComposeColumnDesktop wrapper over the
   *  mail-detail column with a fresh chromeless+initialExpanded
   *  InlineReplyBar inside (focus mode). When omitted, the maximize
   *  button falls back to the in-bar fullscreen portal (backwards
   *  compatibility). */
  onFocusMode?: () => void;
  /** v38 — Fires after the user dismisses the AI draft (either via
   *  Skip-X in the collapsed preview card, or via Discard in the
   *  expanded editor's discard popover). The dismissal is also
   *  persisted in localStorage (`stilt:ai-draft-dismissed:<mailId>`)
   *  so re-opening the bar after a remount doesn't re-inject the
   *  same AI draft. Parents can use this to force-rerender any
   *  sibling UI that derives from the AI draft preview. */
  onSkipAiDraft?: () => void;
}

// v38 — AI draft dismiss markers. Per-mailId (or 'compose') key in
// localStorage. When set, the AI draft must NOT be re-injected on
// remount and the collapsed "Draft generated" preview must hide.
//
// v39 — Semantics tightened: "dismissed" now means "the user has
// interacted with the editor for this mail at all". The moment
// the user touches the editor (any onInput, paste, format, etc.),
// we persist the marker. This is the simplest mental model that
// closes every path the previous fixes missed:
//   • Manual select-all + delete → onInput fires → marker set
//   • Type one letter then delete it → first onInput sets marker
//   • Save Draft popover after edits → handleSaveDraft also sets marker
//   • Discard popover → handleDiscard sets marker (existing)
//   • Skip-X on collapsed preview → handleSkip sets marker (existing)
// We also keep an in-memory backup Set so that even if iOS Safari
// quietly fails a localStorage write inside a framer-motion-animated
// sheet (rare but observed), the marker still works within the same
// session.
const AI_DISMISS_KEY = (id?: string, composeMode?: boolean) =>
  composeMode ? 'stilt:ai-draft-dismissed:compose' : `stilt:ai-draft-dismissed:${id ?? 'unknown'}`;

// v39 — Module-level in-memory backup. Survives component remount
// (which is what we need: a placeholder bar remounts when the sheet
// closes). Doesn't survive page reload — that's fine, localStorage
// covers that case. The two together give us belt-and-braces
// reliability across the buggy iOS Safari path.
const aiDismissMemory = new Set<string>();

function isAiDraftDismissed(mailId?: string, composeMode?: boolean): boolean {
  if (typeof window === 'undefined') return false;
  if (!composeMode && !mailId) return false;
  const key = AI_DISMISS_KEY(mailId, composeMode);
  // v39 — Check in-memory backup first. If set, dismissed regardless
  // of localStorage. (Cheaper and dodges localStorage quirks.)
  if (aiDismissMemory.has(key)) {
    // eslint-disable-next-line no-console
    console.log('[STILT isAiDraftDismissed] hit memory', { key });
    return true;
  }
  try {
    const value = window.localStorage.getItem(key);
    const dismissed = value === '1';
    // eslint-disable-next-line no-console
    console.log('[STILT isAiDraftDismissed] ls read', { key, value, dismissed });
    return dismissed;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.log('[STILT isAiDraftDismissed] ls threw', { key, err });
    return false;
  }
}

function dismissAiDraft(mailId?: string, composeMode?: boolean): void {
  if (typeof window === 'undefined') return;
  if (!composeMode && !mailId) return;
  const key = AI_DISMISS_KEY(mailId, composeMode);
  // v39 — Always set in-memory backup first. This succeeds even if
  // localStorage throws (private mode, quota, framer-motion sheet
  // ancestor restrictions on iOS Safari).
  aiDismissMemory.add(key);
  try {
    window.localStorage.setItem(key, '1');
    // v39 — Read back immediately to verify the write actually landed.
    // iOS Safari has been observed to silently no-op setItem when the
    // calling context is inside a transformed/animated ancestor in
    // certain ITP/private modes. The in-memory backup above already
    // covers that, but logging surfaces the issue if we ever hit it.
    const verify = window.localStorage.getItem(key);
    // eslint-disable-next-line no-console
    console.log('[STILT dismissAiDraft] set+verify', { key, verify, memorySize: aiDismissMemory.size });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.log('[STILT dismissAiDraft] ls threw', { key, err, memorySize: aiDismissMemory.size });
    /* ignore quota / private mode errors — in-memory backup still active */
  }
}

const DRAFT_KEY = (id?: string, composeMode?: boolean) =>
  composeMode ? 'stilt:draft:compose' : `stilt:draft:${id ?? 'unknown'}`;

export function InlineReplyBar({
  aiDraft,
  recipientName,
  recipientEmail,
  mailId,
  forwardContext,
  onForwardCancel,
  onDismiss,
  onSend,
  onExpandedChange,
  composeMode = false,
  defaultSubject = '',
  chromeless = false,
  onSubjectChange,
  externalSendTrigger,
  externalFormatTrigger,
  externalFileTrigger,
  externalRequestCloseTrigger,
  externalHasContentTrigger,
  onActiveFormatsChange,
  externalSaveDraftTrigger,
  externalDiscardTrigger,
  onComposeClose,
  initialExpanded = false,
  onOpenRequest,
  onFocusMode,
  onSkipAiDraft,
}: InlineReplyBarProps) {
  const forwardMode = !!forwardContext;
  const [, navigate] = useLocation();
  // v36.3 — sheetMode unifies composeMode and initialExpanded for the
  // "this bar runs as the body of a 92vh bottom sheet" use case. Both
  // share the same rendering needs: edge-to-edge container (no nested
  // glass card frame), flex:1 height fill, no collapsed state. Compose
  // sets composeMode; mobile reply/forward sheet sets initialExpanded.
  // Anywhere we need to treat them identically, we use sheetMode.
  const sheetMode = composeMode || initialExpanded;
  // ─── Hooks (alles vóór early returns; rules-of-hooks) ──────────────
  // v31 — composeMode start direct expanded (geen collapsed state).
  // v36 — initialExpanded (mobile reply/forward sheet) doet hetzelfde.
  const [expanded, setExpanded] = useState(composeMode || initialExpanded);
  // v31 — Subject input, alleen gerenderd in composeMode.
  const [subject, setSubject] = useState<string>(defaultSubject);
  // v30.30 — Notify parent of expand state (for hiding mobile Forward pill).
  // Alleen op expanded-change firen, niet bij elke render.
  const onExpandedChangeRef = useRef(onExpandedChange);
  onExpandedChangeRef.current = onExpandedChange;
  useEffect(() => {
    onExpandedChangeRef.current?.(expanded);
  }, [expanded]);
  const [fullscreen, setFullscreen] = useState(false);
  const [userTouched, setUserTouched] = useState(false);
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());
  const [visibleHeight, setVisibleHeight] = useState<number | null>(null);
  const [linkPromptOpen, setLinkPromptOpen] = useState(false);
  const [linkInput, setLinkInput] = useState('');
  // v30.30 — Desktop fullscreen: meet inline-bar-wrapper edges om de
  // portal exact boven de mail-detail kolom te zetten (zelfde top-inset
  // als de tab-rail links).
  const [fsRect, setFsRect] = useState<{ left: number; right: number } | null>(
    null,
  );
  // Attachments
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();

  // Recipients als chip-arrays.
  const [toRecipients, setToRecipients] = useState<string[]>(() =>
    recipientEmail ? [recipientEmail] : [],
  );
  const [ccRecipients, setCcRecipients] = useState<string[]>([]);
  const [bccRecipients, setBccRecipients] = useState<string[]>([]);
  const [toInput, setToInput] = useState('');
  const [ccInput, setCcInput] = useState('');
  const [bccInput, setBccInput] = useState('');

  const editorRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const toInputRef = useRef<HTMLInputElement>(null);

  // v30.30 — visualViewport tracker tijdelijk gedisabled tijdens crash-debug.
  // setVisibleHeight blijft null, we vallen terug op standaard 50vh/100vh.
  // (Was de oorzaak van een infinite render loop bij thread mails.)

  // v30.30 — storedDraft: lezen 1x bij mailId-verandering uit localStorage.
  // Bewaren in state zodat collapsed-preview het kan tonen zonder per
  // render localStorage te raadplegen (= ref-flapping = re-render loops).
  const [storedDraft, setStoredDraft] = useState<string | null>(null);

  // v38 — Local dismissed state. Mirrors the persistent localStorage
  // marker (`stilt:ai-draft-dismissed:<mailId>`) but keeps the
  // collapsed-preview hidden the moment Skip is clicked without
  // needing a parent rerender. Reset on mailId change so a different
  // thread isn't accidentally hidden by an old click.
  const [localDismissed, setLocalDismissed] = useState<boolean>(() =>
    isAiDraftDismissed(mailId, composeMode),
  );

  // Reset state bij mail-switch + load draft uit localStorage.
  // In forward-mode: To leeg, geen draft uit reply-store, editor gevuld
  // met forward-block uit forwardContext.body.
  // v31 — In composeMode: laad compose-draft, blijf expanded, To leeg.
  useEffect(() => {
    let stored: string | null = null;
    try {
      if (typeof window !== 'undefined' && !forwardContext) {
        if (composeMode) {
          stored = window.localStorage.getItem(DRAFT_KEY(undefined, true));
        } else if (mailId) {
          stored = window.localStorage.getItem(DRAFT_KEY(mailId));
        }
      }
    } catch {
      stored = null;
    }
    setStoredDraft(stored);
    // v38 — Sync local dismissed flag with the persistent marker for
    // the new mailId. Without this, switching to a different thread
    // could inherit the previous mail's dismissed state.
    setLocalDismissed(isAiDraftDismissed(mailId, composeMode));
    setUserTouched(!!stored || !!forwardContext);
    // v36.2 — Honour initialExpanded so the chromeless bar inside the
    // reply/forward sheet stays open after mount. Without this, the
    // mailId/forwardContext useEffect would slam `expanded` back to
    // `false` immediately after mount, which is what produced the
    // "Draft generated" preview card inside an open sheet.
    setExpanded(!!forwardContext || composeMode || initialExpanded);
    setFullscreen(false);
    setShowCcBcc(false);
    setToRecipients(
      forwardContext
        ? []
        : recipientEmail
          ? [recipientEmail]
          : [],
    );
    setCcRecipients([]);
    setBccRecipients([]);
    setToInput('');
    setCcInput('');
    setBccInput('');
    setSubject(defaultSubject);
    // v30.30 — In forward-mode: zaai originele attachments als chips.
    setAttachments(forwardContext?.attachments ? [...forwardContext.attachments] : []);
    if (editorRef.current) {
      // v38 — If the user previously dismissed the AI draft for this
      // mailId, do NOT re-inject `aiDraft` on remount. The dismiss
      // marker survives remount via localStorage, so re-opening the
      // bar (e.g. clicking the placeholder again after a discard)
      // shows an empty editor instead of the AI text.
      const aiDraftDismissed = isAiDraftDismissed(mailId, composeMode);
      const nextHtml = forwardContext
        ? forwardContext.body
        : (stored ?? (aiDraftDismissed ? '' : aiDraft) ?? '');
      // eslint-disable-next-line no-console
      console.log('[STILT mount inject]', {
        mailId,
        composeMode,
        aiDraftDismissed,
        hasStored: !!stored,
        hasAiDraft: !!aiDraft,
        injectedFromForward: !!forwardContext,
        injectedFromStored: !forwardContext && !!stored,
        injectedFromAiDraft: !forwardContext && !stored && !aiDraftDismissed && !!aiDraft,
        nextHtmlPreview: nextHtml.slice(0, 60),
      });
      editorRef.current.innerHTML = nextHtml;
    }
    // In forward- of compose-mode: focus To-veld zodat user direct adressaten kan tikken.
    if (forwardContext || composeMode) {
      setTimeout(() => toInputRef.current?.focus(), 60);
    }
  }, [mailId, aiDraft, recipientEmail, forwardContext, composeMode, defaultSubject]);

  // v30.32 — Externe trigger: bv. "Draft reply" button in summary panel
  // dispatcht `stilt:open-reply`, en deze bar opent dan in expanded mode.
  useEffect(() => {
    const onExternalOpen = () => setExpanded(true);
    window.addEventListener('stilt:open-reply', onExternalOpen);
    return () => window.removeEventListener('stilt:open-reply', onExternalOpen);
  }, []);

  // Wanneer editor expand opent, vul editor met:
  //   • forwardContext.body (forward-mode — altijd forceren, want
  //     de editor-DOM bestaat pas ná expand=true en de eerste useEffect
  //     liep al toen editorRef.current nog null was).
  //   • anders: aiDraft als editor leeg is.
  useEffect(() => {
    if (!expanded || !editorRef.current) return;
    if (forwardContext) {
      // Forward-mode: altijd overschrijven met forward-block.
      editorRef.current.innerHTML = forwardContext.body;
      return;
    }
    // v39.2 — This effect ONLY fills the editor when it's truly empty
    // AND there's an AI draft we haven't dismissed yet AND the user
    // hasn't touched it. Previously the else-branch wrote `''` to the
    // editor, which silently clobbered a freshly-loaded stored draft
    // (the user's "Save as draft" content) when the dismiss marker was
    // also set. Now: only write when we genuinely have an aiDraft to
    // inject. Otherwise leave the editor exactly as the mount-effect
    // set it.
    if (!editorRef.current.innerHTML.trim()) {
      const aiDraftDismissed = isAiDraftDismissed(mailId, composeMode);
      const shouldInject = !aiDraftDismissed && !userTouched && !!aiDraft;
      if (shouldInject) {
        editorRef.current.innerHTML = aiDraft ?? '';
      }
    }
  }, [expanded, aiDraft, forwardContext, mailId, composeMode, userTouched]);

  // v30.30 — Click-outside detector: collapse bij klik buiten editor.
  // Draft is via auto-save in localStorage veilig opgeslagen.
  useEffect(() => {
    if (!expanded) return;
    // Use mousedown (capture true) zodat we de event vangen vóór andere
    // handlers de bubble onderbreken. Listener pas 200ms na expand zodat
    // de openende klik (die op containerRef triggert) niet direct sluit.
    const onMouseDown = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (!t || !containerRef.current) return;
      if (containerRef.current.contains(t)) return;
      // In forward-mode collapsen we niet via click-outside — user moet
      // expliciet annuleren via de X in de forward-banner.
      if (forwardMode) return;
      // v31 — composeMode: nooit collapsen (page-level view, geen
      // strip om naar terug te vallen).
      if (composeMode) return;
      // v36.1 — chromeless: we draaien binnen een sheet wrapper
      // (ComposeSheetMobile) die zelf de open/dicht-state managed via
      // setReplySheetOpen op de parent. Click-outside zou de bar
      // hierbinnen verkeerd collapsen — het bar-frame (containerRef)
      // dekt niet de sheet-chrome (X/title-pill/Send) of de floating
      // Pen-pill, dus elke tap daarop zou de editor sluiten. Skip.
      if (chromeless) return;
      // Final draft-save.
      try {
        if (typeof window !== 'undefined' && mailId) {
          const html = editorRef.current?.innerHTML ?? '';
          const visible = stripHtml(html).replace(/\u00A0/g, '').trim();
          // eslint-disable-next-line no-console
          console.log('[STILT click-outside]', { mailId, html, visible, hasAiDraft: !!aiDraft, dismissed: isAiDraftDismissed(mailId, composeMode) });
          if (visible && html !== (aiDraft ?? '')) {
            window.localStorage.setItem(DRAFT_KEY(mailId), html);
          } else if (!visible) {
            window.localStorage.removeItem(DRAFT_KEY(mailId));
          }
          // v39 — Dismiss on collapse when the user has interacted
          // with the editor. "Interacted" is the `userTouched` flag
          // which flips on the first onInput / paste / format / keydown.
          // Without the `userTouched` gate we'd also dismiss the AI
          // draft when a user just clicks outside the bar without
          // touching anything, which is too aggressive (they may
          // come back wanting the AI suggestion).
          //
          // Previously this branch only ran when `!visible && aiDraft
          // && !isAiDraftDismissed`, which left two holes:
          //   1. If `aiDraft` happened to be null at click-outside
          //      time (parent re-render race), the marker was never
          //      set, and the next remount with a truthy aiDraft
          //      re-injected it.
          //   2. If user typed something then deleted it, the empty
          //      branch only ran if onInput had cleanly fired with
          //      `aiDraft` still truthy.
          // Both are now closed: any touch that flips `userTouched`
          // dismisses on collapse, regardless of editor emptiness.
          if (userTouched && !isAiDraftDismissed(mailId, composeMode)) {
            // eslint-disable-next-line no-console
            console.log('[STILT click-outside dismiss]', { mailId, html });
            dismissAiDraft(mailId, composeMode);
            setLocalDismissed(true);
          }
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.log('[STILT click-outside threw]', { err });
      }
      setExpanded(false);
      setFullscreen(false);
    };
    const id = window.setTimeout(() => {
      document.addEventListener('mousedown', onMouseDown, true);
      document.addEventListener('touchstart', onMouseDown as any, true);
    }, 200);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener('mousedown', onMouseDown, true);
      document.removeEventListener('touchstart', onMouseDown as any, true);
    };
    // forwardMode/composeMode in deps zodat handler refresht bij mode-wissel.
    // userTouched in deps so the closure always reads the latest value
    // when deciding whether to drop the dismiss marker on close.
  }, [expanded, aiDraft, mailId, forwardMode, composeMode, chromeless, userTouched]);

  // v30.30 — Auto-save draft per toetsaanslag. innerHTML → localStorage.
  // Bij Send wordt de key geleegd. Bij re-open wordt 'm weer geladen.
  //
  // v39 — Dismiss-AI-on-any-input. The moment saveDraft runs (driven
  // by onInput / format / paste), we treat that as "user has touched
  // this editor" and persist the dismiss marker so future mounts of
  // this bar won't re-inject the same AI text. This closes the last
  // remaining hole: previously the dismiss only fired when the editor
  // became empty AND aiDraft was still truthy. If a user typed a
  // letter and immediately deleted it, the FIRST onInput (non-empty)
  // didn't dismiss, the SECOND onInput (empty) saw `aiDraft` truthy
  // and dismissed — but only IF the prop hadn't dropped to null in
  // the interim. Belt-and-braces: dismiss on every onInput, full stop.
  const saveDraft = useCallback(() => {
    if (typeof window === 'undefined') return;
    // Niet de reply-draft overschrijven met forward-content.
    if (forwardMode) return;
    // v31 — composeMode gebruikt eigen key; reply-mode vereist mailId.
    if (!composeMode && !mailId) return;
    const key = DRAFT_KEY(mailId, composeMode);
    try {
      const html = editorRef.current?.innerHTML ?? '';
      const visible = stripHtml(html).replace(/\u00A0/g, '').trim();
      // eslint-disable-next-line no-console
      console.log('[STILT saveDraft]', {
        html,
        visible,
        hasAiDraft: !!aiDraft,
        mailId,
        composeMode,
        dismissed: isAiDraftDismissed(mailId, composeMode),
      });
      // v39 — Unconditional dismiss-on-touch. Any keystroke or paste or
      // format change routes through saveDraft → marker is set. We no
      // longer rely on the editor going empty + aiDraft still being a
      // truthy string at exactly that moment, which is the race that
      // broke v38's dismiss path on iOS Safari's mobile sheet.
      if (!isAiDraftDismissed(mailId, composeMode)) {
        // eslint-disable-next-line no-console
        console.log('[STILT dismissing AI draft on touch]', { mailId, composeMode });
        dismissAiDraft(mailId, composeMode);
        setLocalDismissed(true);
      }
      if (visible && html !== (aiDraft ?? '')) {
        window.localStorage.setItem(key, html);
      } else {
        window.localStorage.removeItem(key);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log('[STILT saveDraft] threw', { err });
    }
  }, [mailId, aiDraft, forwardMode, composeMode]);

  // Track actieve formats voor toolbar highlight.
  // v34.6 — Robust against execCommand/selectionchange races.
  //
  // Why we can't trust a single queryCommandState read:
  //   • execCommand fires synchronously, but the browser may not
  //     update the DOM-derived "current style" picture until the next
  //     paint frame. Reading queryCommandState immediately after exec
  //     can return the PRE-exec state, the POST-exec state, or a
  //     half-updated mix — the spec doesn't pin this down.
  //   • selectionchange fires multiple times around an exec because
  //     focus() shifts the selection, then execCommand mutates the
  //     DOM and adjusts the selection again. Each tick is a separate
  //     queryCommandState read with a potentially different answer.
  //
  // Strategy:
  //   1. Sample queryCommandState repeatedly across short timeouts
  //      (next microtask, ~16ms, ~50ms, ~120ms after the exec call).
  //   2. Use the LAST sample — by then the browser has fully settled.
  //   3. While exec is in flight, suppress selectionchange-driven
  //      reads entirely so they can't overwrite our authoritative
  //      post-settle read.
  const suppressSelectionUpdatesRef = useRef(false);
  const readSnapshot = useCallback((): Set<string> => {
    const next = new Set<string>();
    if (typeof document === 'undefined' || !document.queryCommandState) {
      return next;
    }
    try {
      if (document.queryCommandState('bold')) next.add('bold');
      if (document.queryCommandState('italic')) next.add('italic');
      if (document.queryCommandState('underline')) next.add('underline');
      if (document.queryCommandState('insertUnorderedList')) next.add('ul');
      if (document.queryCommandState('insertOrderedList')) next.add('ol');
    } catch {
      // queryCommandState kan throwen in oudere browsers — silent ignore.
    }
    return next;
  }, []);

  const setsEqual = (a: Set<string>, b: Set<string>): boolean => {
    if (a.size !== b.size) return false;
    let ok = true;
    a.forEach((v) => {
      if (!b.has(v)) ok = false;
    });
    return ok;
  };

  // Schedule multiple sampled reads so we always commit the
  // post-settle snapshot. Cancels in-flight reads when called again
  // (e.g. user clicks bold then italic in quick succession).
  const pendingTimersRef = useRef<number[]>([]);
  const clearPendingReads = useCallback(() => {
    for (const id of pendingTimersRef.current) window.clearTimeout(id);
    pendingTimersRef.current = [];
  }, []);
  const commitSnapshot = useCallback(() => {
    const snap = readSnapshot();
    setActiveFormats((prev) => (setsEqual(prev, snap) ? prev : snap));
  }, [readSnapshot]);
  const scheduleSettledRead = useCallback(() => {
    clearPendingReads();
    // Multi-tick sampling: covers "sync", "next paint", "next macrotask",
    // and a generous trailing settle window. Each schedules a fresh read.
    pendingTimersRef.current.push(
      window.setTimeout(commitSnapshot, 0),
      window.setTimeout(commitSnapshot, 30),
      window.setTimeout(commitSnapshot, 120),
    );
  }, [clearPendingReads, commitSnapshot]);

  // Public name kept stable for existing call sites.
  const updateActiveFormats = scheduleSettledRead;

  useEffect(() => () => clearPendingReads(), [clearPendingReads]);

  // v34.9 — Selectionchange-driven resync REMOVED.
  //
  // The previous version listened to `document.selectionchange` and ran
  // queryCommandState to keep the toolbar in sync with the cursor's DOM
  // context. In practice this introduced races: on desktop, every mouse
  // click after a format-icon click would fire selectionchange, and the
  // post-suppress read (queryCommandState, which can lie about pending
  // styles on collapsed selections) would overwrite the optimistic
  // toolbar state set by exec().
  //
  // Net effect: user clicks bold → optimistic toggle adds bold → stray
  // selectionchange tick later reads queryCommandState which returns
  // italic=true (e.g. cursor in an italic span from the aiDraft) →
  // toolbar shows italic active, bold gone. Counterintuitive.
  //
  // We accept the trade-off: when the user mouse-clicks INTO existing
  // bold/italic text, the toolbar doesn't auto-light those formats.
  // The optimistic-toggle model is 100% predictable instead. Apple
  // Mail behaves similarly — the toolbar reflects what you toggled,
  // not what the cursor inherits.
  //
  // (The helpers above — scheduleSettledRead, readSnapshot — are kept
  // for the explicit onFocus call on the editor, which fires only once
  // when focus arrives. That's a cheap, race-free moment to sync.)

  // v34.2 — Publish active formats to external wrapper so the compose
  // chrome's floating formatting pill can render a glass indicator
  // under each active toggle. Serialise to a sorted array key so the
  // effect only fires when the set actually changes (Set identity
  // changes every render otherwise).
  const activeFormatsKey = Array.from(activeFormats).sort().join('|');
  useEffect(() => {
    if (!onActiveFormatsChange) return;
    const arr = activeFormatsKey
      ? (activeFormatsKey.split('|') as Array<'bold' | 'italic' | 'underline' | 'ul' | 'ol'>)
      : [];
    onActiveFormatsChange(arr);
  }, [activeFormatsKey, onActiveFormatsChange]);

  // v30.30 — Reset fsRect zodra fullscreen sluit. Meting gebeurt
  // EENMALIG in de fullscreen-toggle click-handler. Hook MOET hier
  // staan vóór de early returns (rules-of-hooks).
  useEffect(() => {
    if (!fullscreen) setFsRect(null);
  }, [fullscreen]);

  // v32 — Push subject changes naar parent (ComposeSheetMobile rendert
  // de live subject in z'n chrome pill). Alleen relevant in composeMode.
  useEffect(() => {
    if (composeMode) onSubjectChange?.(subject);
  }, [subject, composeMode, onSubjectChange]);

  // execCommand wrapper. Editor moet focus hebben + selectie aanwezig.
  // v34.7 — The single source of truth for the toolbar's active state
  // is now the OPTIMISTIC TOGGLE we apply here, not queryCommandState.
  // Why: on collapsed cursors execCommand uses a browser-internal
  // "pending styles" state that queryCommandState reports somewhat
  // unreliably (timing- and engine-dependent). When the user clicks
  // bold then italic, the toolbar must show BOTH active even if the
  // browser's queryCommandState briefly returns only one.
  //
  // We therefore:
  //   1. Toggle the relevant format in our local Set first (so the
  //      icon reflects the user's intent instantly).
  //   2. Then call execCommand to apply it.
  //   3. Skip the post-exec queryCommandState resync — it can lie.
  //      The selectionchange listener still reconciles when the user
  //      moves the cursor into a different DOM context, so cursor
  //      navigation still picks up real styles correctly.
  const exec = (
    command: string,
    value?: string,
    toggleKey?: 'bold' | 'italic' | 'underline' | 'ul' | 'ol',
  ) => {
    const editor = editorRef.current;
    if (!editor) return;
    const sel = window.getSelection();
    const savedRange =
      sel && sel.rangeCount > 0 && editor.contains(sel.anchorNode)
        ? sel.getRangeAt(0).cloneRange()
        : null;

    suppressSelectionUpdatesRef.current = true;
    editor.focus({ preventScroll: true });
    if (sel) {
      sel.removeAllRanges();
      if (savedRange) {
        sel.addRange(savedRange);
      } else {
        const range = document.createRange();
        range.selectNodeContents(editor);
        range.collapse(false);
        sel.addRange(range);
      }
    }

    // Optimistic toggle BEFORE exec so the user sees their click
    // reflected immediately. List toggles are mutually exclusive
    // with the other list (ul ↔ ol) so flip those accordingly.
    if (toggleKey) {
      setActiveFormats((prev) => {
        const next = new Set(prev);
        if (next.has(toggleKey)) next.delete(toggleKey);
        else next.add(toggleKey);
        if (toggleKey === 'ul') next.delete('ol');
        if (toggleKey === 'ol') next.delete('ul');
        return next;
      });
    }

    document.execCommand(command, false, value);
    if (!userTouched) setUserTouched(true);
    saveDraft();
    // Re-enable selectionchange listening once execCommand's
    // collateral selection events have flushed. We do NOT schedule a
    // queryCommandState resync here — the optimistic toggle above is
    // authoritative for the toolbar.
    window.setTimeout(() => {
      suppressSelectionUpdatesRef.current = false;
    }, 150);
  };

  // v34.8 — Markdown shortcut detector. Runs after every input event
  // (typing). Looks at the text on the current line before the caret
  // and, if it matches one of the supported triggers, deletes those
  // chars and invokes the matching execCommand.
  //
  // Triggers (caret must be RIGHT AFTER the trigger text):
  //   "- "   or "* "   → unordered list
  //   "1. "             → ordered list
  //
  // Notes:
  //   • We only fire when the trigger sits at the very start of the
  //     current line (block).
  //   • We skip when the caret is already inside <li> — execCommand
  //     would toggle the list off and the user would see odd jumps.
  //   • We never trigger inside an existing list, link, or pre block.
  const tryMarkdownShortcut = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (!range.collapsed) return;
    if (!editor.contains(range.startContainer)) return;

    // Caret must be inside a text node (not after an element).
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return;
    const textNode = node as Text;
    const caretOffset = range.startOffset;

    // Skip if already inside a list, link, or pre block.
    let ancestor: Node | null = textNode.parentNode;
    while (ancestor && ancestor !== editor) {
      if (ancestor.nodeType === Node.ELEMENT_NODE) {
        const tag = (ancestor as Element).tagName;
        if (tag === 'LI' || tag === 'UL' || tag === 'OL' || tag === 'A' || tag === 'PRE') {
          return;
        }
      }
      ancestor = ancestor.parentNode;
    }

    // Determine the text on the current line BEFORE the caret. We walk
    // backwards through inline siblings until we hit a block boundary
    // (BR or block-level element). For our editor that's typically a
    // single text node — contenteditable wraps lines in <div> or <p>
    // blocks, so the parent block tells us the line content.
    const block = findBlockParent(textNode, editor);
    const rawLineBefore = textBeforeCaretInBlock(block, textNode, caretOffset);
    // v34.10 — Normalise: contenteditable often inserts NBSP (\u00A0)
    // instead of regular spaces, especially on a freshly empty line.
    // Without this normalisation "- " with an NBSP would never match
    // the literal '- ' string and the shortcut would only fire when
    // the user typed inside existing content (where regular spaces
    // are kept). Replace all NBSPs with regular spaces before
    // comparing.
    const lineTextBefore = rawLineBefore.replace(/\u00A0/g, ' ');

    let trigger: { match: string; command: 'ul' | 'ol' } | null = null;
    if (lineTextBefore === '- ' || lineTextBefore === '* ') {
      trigger = { match: lineTextBefore, command: 'ul' };
    } else if (lineTextBefore === '1. ') {
      trigger = { match: lineTextBefore, command: 'ol' };
    }
    if (!trigger) return;

    // Delete the trigger characters. We rebuild a selection covering
    // exactly the trigger string at the START of the block and then
    // call execCommand('delete') to remove them in an undo-friendly
    // way. Afterwards we invoke our normal exec() with the list cmd
    // so the optimistic toolbar toggle picks it up too.
    const startOfBlock = firstTextOffsetInBlock(block);
    if (!startOfBlock) return;
    const delRange = document.createRange();
    delRange.setStart(startOfBlock.node, startOfBlock.offset);
    delRange.setEnd(textNode, caretOffset);
    sel.removeAllRanges();
    sel.addRange(delRange);
    document.execCommand('delete');

    if (trigger.command === 'ul') {
      exec('insertUnorderedList', undefined, 'ul');
    } else {
      exec('insertOrderedList', undefined, 'ol');
    }
  };

  const handleFormat = (
    fmt: 'bold' | 'italic' | 'underline' | 'ul' | 'ol' | 'link',
  ) => {
    if (fmt === 'bold') exec('bold', undefined, 'bold');
    else if (fmt === 'italic') exec('italic', undefined, 'italic');
    else if (fmt === 'underline') exec('underline', undefined, 'underline');
    else if (fmt === 'ul') exec('insertUnorderedList', undefined, 'ul');
    else if (fmt === 'ol') exec('insertOrderedList', undefined, 'ol');
    else if (fmt === 'link') {
      // Bewaar selectie voor herstel na popup.
      const sel = window.getSelection();
      savedRangeRef.current =
        sel && sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : null;
      setLinkInput('https://');
      setLinkPromptOpen(true);
    }
  };

  const applyLink = (url: string) => {
    if (!url || url === 'https://') {
      setLinkPromptOpen(false);
      return;
    }
    editorRef.current?.focus();
    const sel = window.getSelection();
    if (sel && savedRangeRef.current) {
      sel.removeAllRanges();
      sel.addRange(savedRangeRef.current);
    }
    const hasSelection =
      sel && !sel.isCollapsed && sel.toString().trim().length > 0;
    if (hasSelection) {
      document.execCommand('createLink', false, url);
    } else {
      document.execCommand(
        'insertHTML',
        false,
        `<a href="${url}" target="_blank" rel="noreferrer">${url}</a>&nbsp;`,
      );
    }
    updateActiveFormats();
    if (!userTouched) setUserTouched(true);
    saveDraft();
    setLinkPromptOpen(false);
    savedRangeRef.current = null;
  };

  // Send: serialize HTML, draft uit localStorage halen, parent calls back.
  // In forward-mode: kind='forward' + subject met Fwd: prefix.
  // In compose-mode: kind='compose' + subject uit subject-input.
  // To-veld moet niet leeg zijn voor forward/compose.
  const handleSend = () => {
    const html = editorRef.current?.innerHTML.trim() ?? '';
    const plain = editorRef.current?.innerText.trim() ?? '';
    if (!plain && attachments.length === 0) return;
    if ((forwardMode || composeMode) && toRecipients.length === 0) {
      // Focus To-veld als forward/compose zonder ontvanger.
      toInputRef.current?.focus();
      return;
    }
    if (typeof window !== 'undefined') {
      if (composeMode) {
        window.localStorage.removeItem(DRAFT_KEY(undefined, true));
      } else if (mailId && !forwardMode) {
        window.localStorage.removeItem(DRAFT_KEY(mailId));
      }
    }
    onSend({
      kind: composeMode ? 'compose' : forwardMode ? 'forward' : 'reply',
      html,
      subject: composeMode
        ? subject
        : forwardMode
          ? forwardContext?.subject
          : undefined,
      to: toRecipients,
      cc: ccRecipients,
      bcc: bccRecipients,
      attachments,
    });
  };

  // File upload handlers
  const onFilesPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setAttachments((prev) => [...prev, ...Array.from(files)]);
    e.target.value = '';
  };

  const removeAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  // v32.1 — Discard-flow state for composeMode close. The dialog opens
  // whenever close is requested and the compose has dirty content.
  const [discardOpen, setDiscardOpen] = useState(false);
  // v34.1 — Anchor ref for the portal-based DiscardDraftPopover.
  const composeCloseBtnRef = useRef<HTMLButtonElement>(null);
  // v35.3 — Floating formatting pill state for non-chromeless mode
  // (reply / forward). Mirrors the collapsed-by-default behaviour of
  // ComposeSheetMobile so all three editor surfaces look and feel the
  // same: a single PenLine glass-circle bottom-right that expands
  // leftwards to reveal B / I / U / list / link / attach.
  const [formatPillOpen, setFormatPillOpen] = useState(false);

  // v32.1 — "Has content" detector for the discard flow. Treats body as
  // empty when stripHtml(html) has no non-whitespace characters, and all
  // recipient/subject fields as empty when their string is blank. We also
  // check ccInput/bccInput/toInput because uncommitted text counts as
  // typed content too.
  const hasComposeContent = useCallback(() => {
    // v39.1 — In reply mode the To-field is pre-filled with the
    // original sender. That's not "user content", so it shouldn't
    // trigger the discard popover when the editor is empty. Compose
    // and forward modes do count the recipients because the user
    // actively added them. Same logic for cc/bcc: in reply they
    // start empty, so any value is user-added → counts as content.
    if (!composeMode && !forwardMode) {
      const prefilled = recipientEmail ?? '';
      const extraTo = toRecipients.filter((r) => r !== prefilled);
      if (extraTo.length > 0) return true;
    } else if (toRecipients.length > 0) {
      return true;
    }
    if (ccRecipients.length > 0) return true;
    if (bccRecipients.length > 0) return true;
    if (toInput.trim() || ccInput.trim() || bccInput.trim()) return true;
    if (subject.trim()) return true;
    const html = editorRef.current?.innerHTML ?? '';
    if (stripHtml(html).trim()) return true;
    return false;
  }, [
    composeMode,
    forwardMode,
    recipientEmail,
    toRecipients,
    ccRecipients,
    bccRecipients,
    toInput,
    ccInput,
    bccInput,
    subject,
  ]);

  const finalizeClose = useCallback(() => {
    if (onComposeClose) onComposeClose();
    else navigate('/');
  }, [onComposeClose, navigate]);

  // Public close request — used by the internal X and the wrapper.
  // - No content: close immediately (clear localStorage to be safe).
  // - Content present: open discard sheet.
  const requestClose = useCallback(() => {
    if (!hasComposeContent()) {
      try {
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(DRAFT_KEY(undefined, true));
        }
      } catch {}
      finalizeClose();
      return;
    }
    setDiscardOpen(true);
  }, [hasComposeContent, finalizeClose]);

  const handleSaveDraft = useCallback(() => {
    // Autosave already keeps localStorage in sync per keystroke, but we
    // do one final flush just in case the latest keystroke hadn't fired
    // saveDraft yet (e.g. closing immediately after typing).
    try {
      if (typeof window !== 'undefined') {
        const html = editorRef.current?.innerHTML ?? '';
        const dirty =
          stripHtml(html).trim() || subject.trim() || toRecipients.length > 0;
        // eslint-disable-next-line no-console
        console.log('[STILT handleSaveDraft]', {
          mailId,
          composeMode,
          dirty,
          htmlLen: html.length,
          visibleLen: stripHtml(html).trim().length,
          key: DRAFT_KEY(mailId, composeMode),
        });
        if (composeMode && dirty) {
          window.localStorage.setItem(DRAFT_KEY(undefined, true), html);
          // eslint-disable-next-line no-console
          console.log('[STILT handleSaveDraft wrote compose]', html.slice(0, 60));
        } else if (!composeMode && mailId && stripHtml(html).trim()) {
          // v36 — Reply mode also persists a per-mail draft so the user
          // can reopen the sheet and continue. Forward mode skips this
          // (its body is auto-generated from the thread).
          window.localStorage.setItem(DRAFT_KEY(mailId), html);
          // eslint-disable-next-line no-console
          console.log('[STILT handleSaveDraft wrote reply]', { mailId, len: html.length });
          // Verify read-back
          const readBack = window.localStorage.getItem(DRAFT_KEY(mailId));
          // eslint-disable-next-line no-console
          console.log('[STILT handleSaveDraft readback]', { match: readBack === html, len: readBack?.length });
        } else if (!composeMode && mailId && !stripHtml(html).trim()) {
          // v39 — Reply mode + empty body: previously this branch was a
          // silent no-op, which meant the AI-dismiss marker never got
          // set on the "manually delete all text → close → Save Draft"
          // path. That's exactly the user-reported bug: the autosave-
          // driven dismiss never fired (race / onInput timing), and
          // handleSaveDraft also did nothing, so the AI draft came
          // back on re-open. Now we explicitly clear the autosaved
          // draft AND drop the dismiss marker so the editor stays
          // empty next time.
          window.localStorage.removeItem(DRAFT_KEY(mailId));
        }
      }
    } catch {}
    // v39 — Always persist the dismiss marker on Save Draft. The user
    // explicitly chose "save my work" — they're done with the AI
    // suggestion regardless of whether what they kept is the AI text,
    // their edits, or nothing. Either way the next mount must not
    // re-inject the AI draft on top of (or in place of) the saved
    // result.
    dismissAiDraft(mailId, composeMode);
    setLocalDismissed(true);
    onSkipAiDraft?.();
    setDiscardOpen(false);
    finalizeClose();
  }, [composeMode, mailId, subject, toRecipients, finalizeClose, onSkipAiDraft]);

  const handleDiscard = useCallback(() => {
    try {
      if (typeof window !== 'undefined') {
        // Clear compose draft (legacy) AND per-mail reply draft if any.
        window.localStorage.removeItem(DRAFT_KEY(undefined, true));
        if (mailId) window.localStorage.removeItem(DRAFT_KEY(mailId));
      }
    } catch {}
    // v38 — Persist a dismiss marker so the AI draft prop won't be
    // re-injected the next time this bar mounts for the same mailId
    // (or for compose). This is what fixes the "discard → reopen → AI
    // draft is back" regression: removing the autosave key alone
    // isn't enough because the `aiDraft` prop still flows in.
    dismissAiDraft(mailId, composeMode);
    setLocalDismissed(true);
    // Reset internal state so re-entering compose starts fresh.
    setToRecipients([]);
    setCcRecipients([]);
    setBccRecipients([]);
    setToInput('');
    setCcInput('');
    setBccInput('');
    setSubject('');
    setAttachments([]);
    if (editorRef.current) editorRef.current.innerHTML = '';
    setDiscardOpen(false);
    onSkipAiDraft?.();
    finalizeClose();
  }, [finalizeClose, mailId, composeMode, onSkipAiDraft]);

  // v32 — Wire imperative triggers for ComposeSheetMobile chrome.
  // Refs are assigned on every render so the latest closures (with current
  // state) are visible to the wrapper. Cleared on unmount.
  if (externalSendTrigger) externalSendTrigger.current = handleSend;
  if (externalFormatTrigger) externalFormatTrigger.current = handleFormat;
  if (externalFileTrigger)
    externalFileTrigger.current = () => fileInputRef.current?.click();
  if (externalRequestCloseTrigger)
    externalRequestCloseTrigger.current = requestClose;
  if (externalHasContentTrigger)
    externalHasContentTrigger.current = hasComposeContent;
  if (externalSaveDraftTrigger)
    externalSaveDraftTrigger.current = handleSaveDraft;
  if (externalDiscardTrigger)
    externalDiscardTrigger.current = handleDiscard;
  useEffect(() => {
    return () => {
      if (externalSendTrigger) externalSendTrigger.current = null;
      if (externalFormatTrigger) externalFormatTrigger.current = null;
      if (externalFileTrigger) externalFileTrigger.current = null;
      if (externalRequestCloseTrigger) externalRequestCloseTrigger.current = null;
      if (externalHasContentTrigger) externalHasContentTrigger.current = null;
      if (externalSaveDraftTrigger) externalSaveDraftTrigger.current = null;
      if (externalDiscardTrigger) externalDiscardTrigger.current = null;
    };
  }, [
    externalSendTrigger,
    externalFormatTrigger,
    externalFileTrigger,
    externalRequestCloseTrigger,
    externalHasContentTrigger,
    externalSaveDraftTrigger,
    externalDiscardTrigger,
  ]);

  // Editor keyboard handler.
  const onEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!userTouched) setUserTouched(true);
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
      return;
    }
    // v34.7+ — Keyboard shortcuts route through handleFormat so the
    // optimistic toolbar toggle fires (same path as clicking the
    // formatting icons). Previously these called exec() directly and
    // bypassed the toggleKey argument, leaving the toolbar's active
    // state to be reconciled by queryCommandState — which races and
    // produced the bold/italic swap on desktop where Cmd+B/I/U are
    // the natural way to format.
    if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
      e.preventDefault();
      handleFormat('bold');
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
      e.preventDefault();
      handleFormat('italic');
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'u') {
      e.preventDefault();
      handleFormat('underline');
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      handleFormat('link');
      return;
    }
  };

  const openEditor = () => {
    // v36 — When the parent supplies onOpenRequest (mobile reply/forward
    // path in ConversationTimeline), the parent owns the open intent:
    // it mounts ComposeSheetMobile and renders a fresh chromeless +
    // initialExpanded InlineReplyBar inside. We must NOT expand this
    // collapsed instance — otherwise the user would see the editor
    // momentarily render inline behind the sheet, and toggling state
    // diverges between the two mounts. Just defer to the parent.
    if (onOpenRequest) {
      onOpenRequest();
      return;
    }
    setExpanded(true);
    // v36 — Removed the v35.5 mobile auto-fullscreen branch. On mobile
    // the reply/forward flow is now hosted by ComposeSheetMobile (a
    // 92vh bottom-sheet with chromeless InlineReplyBar inside) just
    // like Compose, which gives the user a keyboard-friendly editor
    // without piggy-backing on the legacy fullscreen portal. Desktop
    // unchanged — the maximize button still toggles `fullscreen`.
    setTimeout(() => editorRef.current?.focus(), 40);
  };

  // Recipients helpers.
  const removeRecipient = (kind: 'to' | 'cc' | 'bcc', email: string) => {
    if (kind === 'to') setToRecipients((r) => r.filter((x) => x !== email));
    if (kind === 'cc') setCcRecipients((r) => r.filter((x) => x !== email));
    if (kind === 'bcc') setBccRecipients((r) => r.filter((x) => x !== email));
  };
  const commitRecipient = (
    kind: 'to' | 'cc' | 'bcc',
    raw: string,
    clear: () => void,
  ) => {
    const v = raw.trim().replace(/,$/, '');
    if (!v) return;
    if (kind === 'to' && !toRecipients.includes(v))
      setToRecipients((r) => [...r, v]);
    if (kind === 'cc' && !ccRecipients.includes(v))
      setCcRecipients((r) => [...r, v]);
    if (kind === 'bcc' && !bccRecipients.includes(v))
      setBccRecipients((r) => [...r, v]);
    clear();
  };

  // ─── Collapsed render ───────────────────────────────────────────────
  if (!expanded) {
    // v30.30 — hasAiDraft: AI heeft een suggested reply en user heeft
    // er nog niet aan getoucht. Triggers subtle gradient tint (V7).
    // v38 — Once the user explicitly skips/discards the AI draft
    // (either via the X-button on this preview card or via the
    // expanded editor's Discard popover), `localDismissed` flips
    // and the persistent localStorage marker also says dismissed.
    // Either signal is enough to hide the preview — we read both
    // so the preview disappears immediately on click (localDismissed)
    // and stays gone across remounts (isAiDraftDismissed).
    const aiDismissed = localDismissed || isAiDraftDismissed(mailId, composeMode);
    const hasAiDraft = !userTouched && !!aiDraft && !storedDraft && !aiDismissed;
    const previewSource =
      storedDraft ?? (aiDraft && !userTouched && !aiDismissed ? aiDraft : '');
    const previewText = previewSource ? stripHtml(previewSource) : '';
    const baseStyle = glassSurfaceStyle();
    // V7 — zachte paars/blauw tint gemengd over de glass-base. Geen icon,
    // geen border, geen animatie. Alleen wanneer er een AI draft is.
    // Subtiele teal glow alleen aan de onderkant — geïnspireerd door
    // iOS 26 "Meldingen met prioriteit" (zachte iridescent edge). Veel
    // lichter dan v30.30 (was 17/12), nu 9/5 + verticaal.
    const aiTint = hasAiDraft
      ? {
          background:
            (baseStyle.background as string) +
            ', linear-gradient(180deg, transparent 30%, color-mix(in srgb, var(--ai-accent, #13A89E) var(--ai-glow-strength, 9%), transparent) 100%)',
        }
      : {};
    return (
      <div
        ref={containerRef}
        data-testid="inline-reply-bar-collapsed"
        role="button"
        tabIndex={0}
        onClick={openEditor}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openEditor();
          }
        }}
        aria-label="Open reply editor"
        className="relative w-full cursor-text"
        style={{ ...baseStyle, ...aiTint }}
      >
        {/* v38 — Skip / dismiss button removed per user request. Dismiss
           flow still available via the Discard popover inside the
           expanded editor (X linksboven → Discard). The dismiss-marker
           plumbing (dismissAiDraft helpers, localDismissed state) stays
           intact so the discard path keeps working. */}
        {/* v30.30 — Wanneer AI draft: 2 regels body voor meer context.
           Anders 1 regel placeholder. Padding past zich aan. */}
        <div
          className="w-full flex items-center px-4"
          style={{
            minHeight: 60,
            paddingTop: hasAiDraft ? 12 : 0,
            paddingBottom: hasAiDraft ? 12 : 0,
            // v38 — Reserve right padding so the 2-line preview text
            // doesn't run under the dismiss X.
            paddingRight: hasAiDraft ? 36 : undefined,
          }}
        >
          {previewText ? (
            <div className="flex-1 min-w-0 flex flex-col">
              {/* iOS-style header: icon + label, fading hairline underneath.
                 Mask zorgt dat lijn naar buiten toe vervaagt — geen harde
                 zwarte streep, leest als zachte scheidslaag. */}
              <div className="flex items-center gap-1.5 pb-1.5 mb-1.5 relative">
                {hasAiDraft && (
                  <Sparkles
                    className="shrink-0"
                    style={{ width: 12, height: 12, color: 'var(--ai-accent, #13A89E)' }}
                    strokeWidth={2}
                  />
                )}
                <span className="text-[11px] tracking-[-0.005em] text-foreground/50">
                  {hasAiDraft ? 'Replaiy draft' : 'Draft'}
                </span>
                <div
                  aria-hidden
                  className="absolute bottom-0 left-0 right-0"
                  style={{
                    height: 1,
                    background:
                      'linear-gradient(90deg, transparent 0%, color-mix(in srgb, currentColor 7%, transparent) 18%, color-mix(in srgb, currentColor 7%, transparent) 82%, transparent 100%)',
                  }}
                />
              </div>
              <span
                className="text-[14.5px] leading-snug tracking-[-0.005em] text-foreground/75"
                style={{
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {previewText}
              </span>
            </div>
          ) : (
            <span className="flex-1 min-w-0 truncate text-[14.5px] leading-snug tracking-[-0.005em] text-foreground/40">
              {`Message ${recipientName ?? 'lead'}…`}
            </span>
          )}
        </div>
      </div>
    );
  }

  // ─── Expanded render ────────────────────────────────────────────────
  // 3 variants:
  //  1) inline (default): zit binnen mail-detail pane via parent's
  //     positioning; max-height 50vh.
  //  2) mobile fullscreen: editor neemt visible viewport over.
  //  3) desktop fullscreen ("kolom 3"): position:fixed binnen mail-pane
  //     area met blur op rest van viewport.
  const containerStyle: React.CSSProperties = (() => {
    if (sheetMode && !fullscreen) {
      // v31 — composeMode (page-level): bar vult de hele kolom-3 hoogte
      // (of mobile fullscreen-pane). Geen maxHeight, geen vaste height —
      // strech via flex:1 binnen de parent flex container. De editor
      // body krijgt zelf flex:1 verderop (reply-editor-content) zodat
      // hij meegroeit met de beschikbare ruimte.
      //
      // v32.1 — In chromeless mode rendert de wrapper (ComposeSheetMobile)
      // al een glass-surface met afgeronde top + flat bottom. Een tweede,
      // genest glass-oppervlak met `borderRadius: 24` zou een rounded
      // bottom binnen het sheet tekenen — precies de zichtbare "stop"
      // die de user rapporteerde. Daarom: chromeless = transparante,
      // edge-to-edge container zonder eigen glass styling.
      if (chromeless) {
        return {
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          height: '100%',
          width: '100%',
          minHeight: 0,
          background: 'transparent',
          borderRadius: 0,
          boxShadow: 'none',
        };
      }
      return {
        ...glassSurfaceStyle(),
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        height: '100%',
        width: '100%',
        minHeight: 0,
      };
    }
    if (fullscreen && isMobile) {
      // v30.30 — Mobile fullscreen: behoud volledig glass-design (zoals
      // image 1), maar groei naar bijna-fullscreen height met ronde
      // hoeken + margin. De portal-wrapper hieronder dekt de viewport;
      // dit element zelf is de echte glass-bar, opgerekt.
      return {
        ...glassSurfaceStyle(),
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
      };
    }
    if (fullscreen && !isMobile) {
      // v30.30 — Desktop fullscreen: container is portal-fixed (zie return
      // hieronder). Hier alleen glass-styling + flex layout zodat hij van
      // top-inset naar bottom-inset uitvult — zelfde hoogte als tab-rail.
      return {
        ...glassSurfaceStyle(),
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
      };
    }
    return {
      ...glassSurfaceStyle(),
      maxHeight: '50vh',
      display: 'flex',
      flexDirection: 'column',
    };
  })();

  // v30.30 — Bouw de expanded UI één keer, en hijs hem in een portal als
  // we mobile-fullscreen zijn (zo overleven we 'position:fixed' onder
  // framer-motion transformed ancestors in MailDetail).
  const expandedNode = (
    <>
      {/* Desktop fullscreen backdrop wordt nu door de portal hieronder
         geleverd (zie return). Hier dus geen inline backdrop meer. */}

      <div
        ref={containerRef}
        data-testid="inline-reply-bar-expanded"
        className="relative w-full"
        style={containerStyle}
      >
        {/* Header: To + Cc/Bcc — identiek in inline en fullscreen.
           v36.5 — `shrink-0` op alle non-editor flex children van de
           containerRef-column. Zonder dit kan een grote contenteditable
           (forward-mode injecteert lange HTML) in iOS Safari de flex
           verdeling laten ontsporen: header/attachments krimpen iets,
           de editor's intrinsic height "lekt" door `flex: 1 1 0%`-
           verdeling en er ontstaat lege grijze ruimte onderaan de
           sheet. `shrink-0` fixt de chrome elementen en geeft de
           overflow-y:auto editor één duidelijke baan om in te scrollen. */}
        <div className="shrink-0 px-4 pt-4 pb-3 border-b border-foreground/[0.06]">
          {/* v-replaiy — Replaiy = LinkedIn outbound: replies always go to the
             conversation's lead. No recipient picker, Cc/Bcc, subject, or
             forward. We keep the header row purely as the home for the
             fullscreen / close action buttons (Stilt's design unchanged). */}
          {/* v-replaiy — duplicate lead-name header removed (name already
             shows in the conversation pill + bubble). `mr-auto` moved to the
             action group so the fullscreen/close buttons stay right-aligned. */}
          <div className="flex items-center gap-3 min-h-[36px]">
            {/* v32.1 — Right-side action group, split:
                • Chevron (Cc/Bcc toggle): ALWAYS visible in sheetMode
                  (compose AND mobile reply/forward sheet — the wrapper
                  does not provide a Cc/Bcc toggle, so the bar itself
                  must surface one). Also visible in non-chromeless
                  desktop reply. v36.3 — reply/forward sheet now also
                  shows it via the sheetMode branch.
                • Maximize: hidden in chromeless + hidden in composeMode.
                • Internal Close X: only in composeMode AND not chromeless
                  (the ComposeSheetMobile wrapper supplies its own close). */}
            {(sheetMode || !chromeless) && (
            <div className="flex items-center gap-0.5 shrink-0 ml-auto">
            {/* v-replaiy — Cc/Bcc toggle removed (LinkedIn has no Cc/Bcc). */}
            {/* Fullscreen toggle. v31 — verborgen in composeMode: er valt
               niks te vergroten, de editor IS de hele kolom al. v32 — ook
               verborgen in chromeless. v36 — ook verborgen op mobile:
               reply/forward op mobile draait nu via ComposeSheetMobile
               (92vh sheet), dus de maximize-knop heeft geen functie meer
               daar. Desktop houdt 'm — daar opent de knop nog steeds de
               kolom-3 fullscreen-portal voor breedere editor-ruimte. */}
            {!composeMode && !chromeless && !isMobile && (
            <button
              type="button"
              data-testid="toggle-fullscreen"
              onClick={() => {
                // v37 — Wanneer parent een onFocusMode callback levert,
                // delegeren we daar naartoe (ConversationTimeline mount
                // dan een ComposeColumnDesktop wrapper over kolom 3,
                // identiek aan compose desktop). Geen legacy fullscreen
                // portal meer; de wrapper levert volledige chrome.
                if (onFocusMode) {
                  onFocusMode();
                  return;
                }
                // v30.30 — Backwards compat: Meet wrapper rect VOOR toggle,
                // zodat de desktop fullscreen portal direct de juiste
                // left/right krijgt (na toggle is containerRef in portal,
                // dan kan je de oorspronkelijke wrapper niet meer bereiken).
                if (!fullscreen && !isMobile) {
                  const wrap =
                    containerRef.current?.parentElement?.getBoundingClientRect();
                  if (wrap)
                    setFsRect({
                      left: wrap.left,
                      right: window.innerWidth - wrap.right,
                    });
                }
                setFullscreen((v) => !v);
              }}
              aria-pressed={fullscreen}
              aria-label={fullscreen ? 'Exit fullscreen' : 'Open fullscreen'}
              className="h-9 w-9 rounded-full flex items-center justify-center text-icon hover-elevate active-elevate-2"
            >
              {fullscreen ? (
                <Minimize2 size={16} strokeWidth={2} />
              ) : (
                <Maximize2 size={16} strokeWidth={2} />
              )}
            </button>
            )}
            {/* v31 — Close button (composeMode only, non-chromeless): user
               moet altijd weg kunnen. In chromeless levert de wrapper de X.
               v32.1 — Triggert nu de discard-flow i.p.v. directe navigate.
               v33     — Discard flow is een glass dropdown popover (zie
               DiscardDraftPopover), anchored aan deze X. We wrappen 'm in
               een `relative` div zodat de absolute popover correct uitlijnt.
               De X zit rechts in de header rij → popover opent linksonder. */}
            {composeMode && !chromeless && (
              <>
                <button
                  ref={composeCloseBtnRef}
                  type="button"
                  data-testid="compose-close"
                  onClick={requestClose}
                  aria-label="Close compose"
                  className="h-9 w-9 rounded-full flex items-center justify-center text-icon hover-elevate active-elevate-2"
                >
                  <X size={16} strokeWidth={2} />
                </button>
                <DiscardDraftPopover
                  open={discardOpen}
                  onClose={() => setDiscardOpen(false)}
                  onSaveDraft={handleSaveDraft}
                  onDiscard={handleDiscard}
                  anchorRef={composeCloseBtnRef}
                  align="end"
                />
              </>
            )}
            </div>
            )}
          </div>

          {/* v-replaiy — Cc/Bcc rows removed (LinkedIn has no Cc/Bcc). */}
        </div>

        {/* v-replaiy — Subject row removed: LinkedIn conversations have no
           subject line. */}

        {/* v35.3 — Inline format strip removed for reply/forward.
           Replaced by a floating collapsible glass pill rendered at the
           bottom of the bar container (see end of this component). The
           pill mirrors ComposeSheetMobile / ComposeColumnDesktop: a
           single PenLine glass-circle that expands leftwards on tap to
           reveal B / I / U / list / link / attach. The numbered-list
           toggle is dropped in favour of the "1. " markdown shortcut,
           keeping the icon count identical to compose. Functionality
           is unchanged — handleFormat / exec are still the underlying
           handlers. */}

        {/* v32 — File input moet ALTIJD in de DOM zijn (ook chromeless),
           anders kan de wrapper-toolbar 'm niet triggeren via
           externalFileTrigger. */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={onFilesPicked}
          className="hidden"
          data-testid="file-input"
        />

        {/* v30.30 — Attachment chips boven editor area. LinkedIn supports
           attachments, so the feature stays exactly as in Stilt. */}
        {attachments.length > 0 && (
          <div className="shrink-0 flex items-center gap-2 px-4 py-2 border-b border-foreground/[0.06] flex-wrap">
            {attachments.map((file, i) => (
              <AttachmentChip
                key={`${file.name}-${i}`}
                file={file}
                onRemove={() => removeAttachment(i)}
              />
            ))}
          </div>
        )}

        {/* Editor area.
           v36.5 — In sheetMode forceren we `height: 0` als baseline
           bovenop `flex-1 basis-0 min-h-0`. Reden: een contenteditable
           met een lange innerHTML (forward-mode injecteert volledige
           mail-thread) heeft een groot intrinsic content-height. In
           iOS Safari (en soms Chrome) wint die intrinsic height het
           van `flex-basis: 0`, waardoor de editor de flex column doet
           overflowen én de `overflow-y: auto` pas áchteraf clipped —
           visueel ontstaat dan lege grijze ruimte tussen de
           (gescrollde) editor-content en de bottom van de sheet.
           `height: 0` als startpunt + `flex-grow: 1` geeft een
           deterministische 0→fill verdeling die in compose-mode ook
           werkt (de editor blijft daar groeien tot beschikbare ruimte). */}
        <div
          ref={editorRef}
          data-testid="reply-editor"
          contentEditable
          suppressContentEditableWarning
          onKeyDown={onEditorKeyDown}
          onInput={() => {
            if (!userTouched) setUserTouched(true);
            saveDraft();
            // v34.8 — Markdown shortcuts at the start of a line:
            //   "- "  or "* "  → unordered list
            //   "1. "          → ordered list
            // We inspect the text immediately before the caret on the
            // current line. If it matches a trigger, we delete those
            // characters and run the corresponding execCommand. Only
            // triggers when the caret is in plain text at the line's
            // start — if the user is already inside a list, nothing
            // happens (execCommand would toggle the list off).
            tryMarkdownShortcut();
            // Auto-scroll caret in view bij typen (mobile keyboard fix).
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0) {
              const range = sel.getRangeAt(0).cloneRange();
              const dummy = document.createElement('span');
              range.insertNode(dummy);
              dummy.scrollIntoView({ block: 'nearest', inline: 'nearest' });
              dummy.parentNode?.removeChild(dummy);
            }
          }}
          style={sheetMode ? { height: 0 } : undefined}
          className={`reply-editor-content overflow-y-auto no-scrollbar px-4 pt-3 text-[14.5px] leading-relaxed tracking-[-0.005em] text-foreground outline-none ${
            sheetMode
              ? 'flex-1 basis-0 min-h-0 pb-4'
              : 'flex-1 min-h-[140px] pb-16'
          }`}
        />
        <style>{`
          .reply-editor-content ul { list-style-type: disc; padding-left: 1.5em; margin: 0.25em 0; }
          .reply-editor-content ol { list-style-type: decimal; padding-left: 1.5em; margin: 0.25em 0; }
          .reply-editor-content li { margin: 0.15em 0; }
          .reply-editor-content a { color: var(--ai-accent, #13A89E); text-decoration: underline; }
        `}</style>

        {/* v36.6 — Send button: floating rechtsonder over de editor.
           Inline reply only (chromeless wrappers provide their own send).
           Style is matched to the Pen-pill on the bottom-left so the
           two bottom buttons read as one consistent pair (same Vadik
           glass recipe + same 40x40 circle metrics). The previous
           VadikGlass 48x48 used a different liquid-glass effect that
           clashed visually with the new Pen-pill. */}
        {!chromeless && (
          <div
            className="absolute z-10 flex items-center gap-2"
            style={{ right: 12, bottom: 12 }}
          >
            {/* v-replaiy — Dismiss + Approve & send as one adjacent pair.
               Dismiss is the quieter ghost button (Stilt's existing neutral
               text-icon/hover-elevate style, no new style); Send stays the
               solid Vadik glass pill. */}
            {onDismiss && (
              <button
                type="button"
                data-testid="button-dismiss-draft"
                aria-label="Dismiss draft"
                onClick={onDismiss}
                className="h-10 px-3.5 rounded-full flex items-center justify-center text-[13px] font-medium text-icon hover:text-foreground hover-elevate active-elevate-2"
              >
                Dismiss
              </button>
            )}
            <button
              type="button"
              data-testid="button-approve-send"
              aria-label="Approve & send"
              onClick={handleSend}
              className="h-10 w-10 rounded-full flex items-center justify-center text-icon hover:text-foreground active-elevate-2"
              style={replyPillStyle()}
            >
              <Send size={17} strokeWidth={1.9} />
            </button>
          </div>
        )}

        {/* v33 — Discard glass popover lives anchored to the internal X
           in non-chromeless mode (see above). In chromeless mode (Mobile
           sheet + Desktop column) the wrapper renders its own anchored
           popover next to its own X close button, so we don't render
           one here.                                                       */}

        {/* Link prompt overlay */}
        {linkPromptOpen && (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center px-4"
            style={{
              background:
                'color-mix(in srgb, var(--vadik-dark, #000) calc(var(--vadik-reflex-dark, 1) * 18%), transparent)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
              borderRadius: 'inherit',
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setLinkPromptOpen(false);
            }}
          >
            <div
              className="w-full max-w-sm flex flex-col gap-3 p-4"
              style={glassSurfaceStyle()}
            >
              <div className="text-[13.5px] font-medium text-foreground/85 px-1">
                Insert link
              </div>
              <input
                type="url"
                data-testid="link-prompt-input"
                autoFocus
                value={linkInput}
                onChange={(e) => setLinkInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    applyLink(linkInput.trim());
                  } else if (e.key === 'Escape') {
                    setLinkPromptOpen(false);
                  }
                }}
                placeholder="https://…"
                className="w-full h-11 px-3 rounded-xl bg-foreground/[0.06] outline-none text-[14px] text-foreground placeholder:text-foreground/40"
              />
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setLinkPromptOpen(false)}
                  className="h-9 px-4 rounded-full text-[13px] font-medium text-foreground/65 hover-elevate active-elevate-2"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  data-testid="link-prompt-apply"
                  onClick={() => applyLink(linkInput.trim())}
                  className="h-9 px-4 rounded-full text-[13px] font-semibold text-background bg-foreground active:bg-foreground/85"
                >
                  Insert
                </button>
              </div>
            </div>
          </div>
        )}

        {/* v35.3 — Floating formatting pill (collapsible).
           Rendered ONLY in non-chromeless mode (reply / forward); in
           chromeless mode the wrapper (ComposeSheetMobile /
           ComposeColumnDesktop) renders its own pill.

           v35.4 — In reply/forward the Send pill lives bottom-right, so
           the formatting pill is anchored bottom-LEFT instead. It
           expands to the right (opposite direction of compose). This
           keeps Send + pen well separated and matches the visual
           balance of the reply bar (recipient on left, actions on
           right).

           Hidden during the link-prompt overlay because that overlay
           covers the editor and the pill would float on top of it. */}
        {!chromeless && !linkPromptOpen && (
          <div
            className="absolute z-10 pointer-events-none"
            style={{ bottom: 12, left: 12 }}
          >
            <div
              className="pointer-events-auto flex items-center rounded-full overflow-hidden"
              style={{ ...replyPillStyle(), height: 40, padding: 2 }}
            >
              <ReplyFormatBtn
                label={formatPillOpen ? 'Hide formatting' : 'Show formatting'}
                testId="reply-fmt-toggle"
                onClick={() => setFormatPillOpen((v) => !v)}
                active={formatPillOpen}
              >
                {formatPillOpen ? (
                  <X size={16} strokeWidth={2} />
                ) : (
                  <WandSparkles size={15} strokeWidth={1.9} />
                )}
              </ReplyFormatBtn>

              <AnimatePresence initial={false}>
                {formatPillOpen && (
                  <motion.div
                    key="reply-fmt-expanded"
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 'auto', opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={APPLE_SPRING}
                    className="flex items-center overflow-hidden"
                  >
                    <div className="flex items-center pr-1">
                      {/* v-replaiy — Rich-text buttons (Bold/Italic/Underline)
                         and the Insert-link button removed: LinkedIn messages
                         have no rich text and auto-detect raw URLs. The media
                         attach button below stays (LinkedIn supports it). */}
                      <ReplyFormatBtn
                        label="Attach file"
                        testId="reply-fmt-attach"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Paperclip size={16} strokeWidth={2} />
                      </ReplyFormatBtn>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>
    </>
  );

  // v30.30 — Mobile fullscreen escapes framer-motion transformed ancestors
  // via een Portal naar document.body (anders breekt position:fixed).
  // De wrapper geeft:
  //   • viewport-dimming blur-backdrop (zoals desktop fullscreen)
  //   • padding rondom de glass-bar (zodat de afgeronde hoeken zichtbaar
  //     blijven en het design exact als image 1 voelt, maar 'opgerekt')
  // De glass-bar zelf (expandedNode > containerStyle) heeft z'n eigen
  // glassSurfaceStyle en groeit binnen deze flex-column.
  if (fullscreen && isMobile && typeof document !== 'undefined') {
    return createPortal(
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
          paddingLeft: 12,
          paddingRight: 12,
          background:
            'color-mix(in srgb, var(--vadik-dark, #000) calc(var(--vadik-reflex-dark, 1) * 14%), transparent)',
          backdropFilter: 'blur(20px) saturate(140%)',
          WebkitBackdropFilter: 'blur(20px) saturate(140%)',
        }}
      >
        {expandedNode}
      </div>,
      document.body,
    );
  }

  // v30.30 — Desktop fullscreen: Portal naar document.body. Container
  // staat fixed met top: 16 + bottom: 16 (matchend met tab-rail inset),
  // left/right uitgelijnd op de inline-bar wrapper rect.
  if (fullscreen && !isMobile && typeof document !== 'undefined' && fsRect) {
    return createPortal(
      <>
        {/* Backdrop — blurred dim over rest van viewport. */}
        <div
          aria-hidden
          onClick={() => setFullscreen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background:
              'color-mix(in srgb, var(--vadik-dark, #000) calc(var(--vadik-reflex-dark, 1) * 18%), transparent)',
            backdropFilter: 'blur(16px) saturate(120%)',
            WebkitBackdropFilter: 'blur(16px) saturate(120%)',
            zIndex: 9998,
          }}
        />
        {/* Fullscreen bar — zelfde top-inset als tab-rail (16px). */}
        <div
          style={{
            position: 'fixed',
            top: 16,
            bottom: 16,
            left: fsRect.left,
            right: fsRect.right,
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {expandedNode}
        </div>
      </>,
      document.body,
    );
  }

  return expandedNode;
}

// ─── Helpers ───────────────────────────────────────────────────────

function ToolbarButton({
  label,
  active,
  onClick,
  children,
  testId,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={!!active}
      className={`h-10 w-10 rounded-lg flex items-center justify-center transition-colors ${
        active
          ? 'bg-foreground/[0.10] text-foreground'
          : 'text-icon hover:bg-foreground/[0.05] hover:text-foreground active-elevate-2'
      }`}
      // Voorkom focus loss bij toolbar click (editor moet focus houden).
      onMouseDown={(e) => e.preventDefault()}
    >
      {children}
    </button>
  );
}

// v30.30 — Attachment chip: filename + size + open/download + remove.
// Klik op de naam = preview (images) of download (rest) via blob URL.
function AttachmentChip({
  file,
  onRemove,
}: {
  file: File;
  onRemove: () => void;
}) {
  const isImage = file.type.startsWith('image/');
  const sizeLabel = file.size > 1024 * 1024
    ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
    : `${(file.size / 1024).toFixed(0)} KB`;
  const openOrDownload = () => {
    try {
      const url = URL.createObjectURL(file);
      if (isImage) {
        window.open(url, '_blank', 'noopener');
      } else {
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      /* ignore */
    }
  };
  return (
    <span
      data-testid={`attachment-${file.name}`}
      className="inline-flex items-center gap-2 h-8 pl-2.5 pr-1 rounded-full bg-foreground/[0.06] text-[12.5px] font-medium tracking-[-0.005em] text-foreground/85"
    >
      <button
        type="button"
        onClick={openOrDownload}
        className="flex items-center gap-2 min-w-0 cursor-pointer transition-colors hover:text-foreground"
        title={isImage ? `Open ${file.name}` : `Download ${file.name}`}
      >
        {isImage ? (
          <ImageIcon size={13} strokeWidth={2} className="text-icon-muted shrink-0" />
        ) : (
          <FileIcon size={13} strokeWidth={2} className="text-icon-muted shrink-0" />
        )}
        <span className="truncate max-w-[180px]">{file.name}</span>
        <span className="text-foreground/45 tabular-nums">{sizeLabel}</span>
      </button>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${file.name}`}
        className="h-6 w-6 rounded-full flex items-center justify-center text-foreground/55 hover:text-foreground hover:bg-foreground/10"
      >
        <X size={12} strokeWidth={2.2} />
      </button>
    </span>
  );
}

function RecipientChip({
  email,
  onRemove,
}: {
  email: string;
  onRemove: () => void;
}) {
  return (
    <span
      data-testid={`recipient-chip-${email}`}
      className="inline-flex items-center gap-1.5 h-8 pl-3 pr-1.5 rounded-full bg-foreground/[0.06] text-[13px] font-medium tracking-[-0.005em] text-foreground/85"
    >
      <span className="truncate max-w-[200px]">{email}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${email}`}
        className="h-6 w-6 rounded-full flex items-center justify-center text-foreground/55 hover:text-foreground hover:bg-foreground/10"
      >
        <X size={13} strokeWidth={2.2} />
      </button>
    </span>
  );
}

// v35.3 — Floating formatting pill recipe for reply / forward.
// Slightly more compact than the compose chrome pill (40px height vs
// 44/52) so it sits comfortably inside the reply-bar without dominating.
function replyPillStyle(): React.CSSProperties {
  return {
    background:
      'linear-gradient(180deg, color-mix(in srgb, var(--vadik-light, #fff) calc(var(--vadik-reflex-light, 1) * 60%), transparent) 0%, color-mix(in srgb, var(--vadik-light, #fff) calc(var(--vadik-reflex-light, 1) * 40%), transparent) 100%)',
    backdropFilter: 'blur(14px) saturate(150%)',
    WebkitBackdropFilter: 'blur(14px) saturate(150%)',
    boxShadow:
      'inset 0 0 0 1px color-mix(in srgb, var(--vadik-light, #fff) calc(var(--vadik-reflex-light, 1) * 50%), transparent), inset 1.8px 3px 0 -2px color-mix(in srgb, var(--vadik-light, #fff) calc(var(--vadik-reflex-light, 1) * 80%), transparent), inset -2px -2px 0 -2px color-mix(in srgb, var(--vadik-light, #fff) calc(var(--vadik-reflex-light, 1) * 50%), transparent), 0 6px 18px 0 color-mix(in srgb, var(--vadik-dark, #000) calc(var(--vadik-reflex-dark, 1) * 10%), transparent)',
  };
}

// Icon button used inside the reply pill. Same Apple Mail-style active
// rule as ComposeSheetMobile.FormatBtn: foreground colour swap and
// thicker stroke when the toggle is on. No glass indicator capsule —
// multi-active stacks (B + I + U) stay readable that way.
function ReplyFormatBtn({
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
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      onMouseDown={(e) => e.preventDefault()}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={`h-9 w-9 rounded-full flex items-center justify-center active-elevate-2 transition-colors ${
        active ? 'text-foreground' : 'text-icon hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}

function glassSurfaceStyle(): React.CSSProperties {
  return {
    background:
      'linear-gradient(180deg, color-mix(in srgb, var(--vadik-light, #fff) calc(var(--vadik-reflex-light, 1) * 55%), transparent) 0%, color-mix(in srgb, var(--vadik-light, #fff) calc(var(--vadik-reflex-light, 1) * 40%), transparent) 45%, color-mix(in srgb, var(--vadik-light, #fff) calc(var(--vadik-reflex-light, 1) * 30%), transparent) 78%, color-mix(in srgb, var(--vadik-light, #fff) calc(var(--vadik-reflex-light, 1) * 22%), transparent) 100%)',
    backdropFilter: 'blur(20px) saturate(150%)',
    WebkitBackdropFilter: 'blur(20px) saturate(150%)',
    borderRadius: 24,
    boxShadow:
      'inset 0 0 0 1px color-mix(in srgb, var(--vadik-light, #fff) calc(var(--vadik-reflex-light, 1) * 50%), transparent), inset 1.8px 3px 0 -2px color-mix(in srgb, var(--vadik-light, #fff) calc(var(--vadik-reflex-light, 1) * 80%), transparent), inset -2px -2px 0 -2px color-mix(in srgb, var(--vadik-light, #fff) calc(var(--vadik-reflex-light, 1) * 60%), transparent), 0 1px 5px 0 color-mix(in srgb, var(--vadik-dark, #000) calc(var(--vadik-reflex-dark, 1) * 6%), transparent), 0 12px 32px 0 color-mix(in srgb, var(--vadik-dark, #000) calc(var(--vadik-reflex-dark, 1) * 12%), transparent)',
    transition: 'all 220ms cubic-bezier(0.32, 0.72, 0, 1)',
  };
}

function stripHtml(html: string): string {
  if (typeof document === 'undefined') return html;
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

// ─── Markdown shortcut helpers (v34.8) ────────────────────────────────────
const BLOCK_TAGS = new Set([
  'DIV', 'P', 'LI', 'BLOCKQUOTE', 'PRE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
]);

// Find the nearest block-level ancestor of `node` within `editor`.
// Falls back to the editor itself when no block wrapper exists (e.g.
// when the user has only typed plain text into an empty contenteditable).
function findBlockParent(node: Node, editor: HTMLElement): HTMLElement {
  let cur: Node | null = node;
  while (cur && cur !== editor) {
    if (cur.nodeType === Node.ELEMENT_NODE) {
      const el = cur as HTMLElement;
      if (BLOCK_TAGS.has(el.tagName)) return el;
    }
    cur = cur.parentNode;
  }
  return editor;
}

// Concatenate the text content of `block` up to (but not including) the
// caret at `caretNode` + `caretOffset`. Stops at the first BR or block
// boundary encountered while walking the DOM in document order. The
// result is exactly what the user sees on the current line before the
// caret.
function textBeforeCaretInBlock(
  block: HTMLElement,
  caretNode: Text,
  caretOffset: number,
): string {
  let collected = '';
  let reached = false;
  const walk = (node: Node): boolean => {
    if (reached) return true;
    if (node === caretNode) {
      collected += (caretNode.data ?? '').slice(0, caretOffset);
      reached = true;
      return true;
    }
    if (node.nodeType === Node.TEXT_NODE) {
      collected += (node as Text).data ?? '';
      return false;
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = (node as Element).tagName;
      if (tag === 'BR') {
        // Hard line break inside the same block resets the visible line.
        collected = '';
        return false;
      }
      let child = node.firstChild;
      while (child) {
        if (walk(child)) return true;
        child = child.nextSibling;
      }
    }
    return false;
  };
  walk(block);
  return collected;
}

// First selectable text position inside `block` — we use this as the
// start of the range we delete when consuming the markdown trigger.
function firstTextOffsetInBlock(
  block: HTMLElement,
): { node: Node; offset: number } | null {
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  const first = walker.nextNode();
  if (first) return { node: first, offset: 0 };
  return { node: block, offset: 0 };
}

export default InlineReplyBar;
