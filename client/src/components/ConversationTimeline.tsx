import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, animate } from 'framer-motion';
import {
  ArrowLeft,
  Sparkles,
  FileText,
  Image as ImageIcon,
  ChevronDown,
  ChevronUp,
  CornerUpRight,
} from 'lucide-react';
import { useLocation } from 'wouter';
import { useReplaiy } from '@/state/ReplaiyContext';
import { ReplaiyAvatar } from './Avatar';
import { APPLE_SPRING, APPLE_SPRING_TIGHT } from '@/lib/motion';
import type { Conversation, ThreadMessage, Attachment } from '@/data/mockConversations';
import { useMobileTopChromeSlot } from './MobileTopChrome';
import { IdentityPill, ConversationActionPills, ConversationActionPillsCompact, SubjectPill, SubjectIdentityPill, ActionPill } from './ConversationDetailToolbar';

import { ConversationSummaryPanel, hasSummaryPanelValue } from './ConversationSummaryPanel';
import { LeadContextPanel } from './LeadContextPanel';
import { InlineReplyBar, type ForwardContext } from './InlineReplyBar';
import {
  ComposeSheetMobile,
  useComposeSheetRefs,
} from './ComposeSheetMobile';
import { ComposeColumnDesktop } from './ComposeColumnDesktop';
import type { SnoozeKey } from './ConversationActionCluster';

// ─────────────────────────────────────────────────────────────────
// PanelToggleIcon — the lead-context toggle glyph. A rounded panel frame
// whose vertical divider slides symmetrically to mirror the panel state:
//  • open  → divider sits to the right (right column).
//  • closed → divider slides to the left, mirrored about the centre with
//             the exact same margin on the opposite side.
// Frame spans x=3..21 (centre 12); divider rests 4px in from each side.
// Pure SVG + framer-motion so the stroke language matches lucide icons.
// ─────────────────────────────────────────────────────────────────
function PanelToggleIcon({ open }: { open: boolean }) {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-icon"
    >
      {/* Outer panel frame */}
      <rect x={3} y={4} width={18} height={16} rx={3} />
      {/* Vertical divider — slides left↔right, mirrored about the frame
          centre (12) so the margin is identical on both sides. */}
      <motion.line
        y1={4}
        y2={20}
        initial={false}
        animate={{ x1: open ? 16 : 8, x2: open ? 16 : 8 }}
        transition={APPLE_SPRING}
      />
    </svg>
  );
}

// v36 — Mobile breakpoint mirrors Compose.tsx (1024px). Anything below
// the laptop tier gets the ComposeSheetMobile bottom-sheet host for the
// reply / forward editor, so the keyboard never clips the editor.
function useIsCompactViewport(): boolean {
  const [compact, setCompact] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return !window.matchMedia('(min-width: 1024px)').matches;
  });
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setCompact(!mq.matches);
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return compact;
}

// True at >=1280px — the threshold where all three columns (inbox +
// conversation + lead panel) fit at once. Below it the lead panel REPLACES
// the inbox, so the conversation header behaves differently (left-aligned
// identity, back-to-inbox affordance) vs the wide 3-column desktop.
function useIsWideViewport(): boolean {
  const [wide, setWide] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return window.matchMedia('(min-width: 1280px)').matches;
  });
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1280px)');
    const update = () => setWide(mq.matches);
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return wide;
}

// ─────────────────────────────────────────────────────────────────
// Date / time helpers
// ─────────────────────────────────────────────────────────────────
function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function relativeDayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (sameDay(d, now)) return 'Today';
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  if (sameDay(d, y)) return 'Yesterday';
  const diff = Math.floor((+new Date(now.toDateString()) - +new Date(d.toDateString())) / 86400000);
  if (diff < 7) {
    return d.toLocaleDateString('en-US', { weekday: 'long' });
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function hhmm(iso: string) {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

// ─────────────────────────────────────────────────────────────────
// Attachment chip (inside a bubble)
// ─────────────────────────────────────────────────────────────────
function BubbleAttachment({ a, mine }: { a: Attachment; mine: boolean }) {
  const Icon = a.kind === 'image' ? ImageIcon : FileText;
  return (
    <div
      className={`mt-2 flex items-center gap-2 rounded-xl px-2.5 py-2 ${
        mine
          ? 'bg-black/[0.06] dark:bg-white/[0.08]'
          : 'bg-white/65 dark:bg-white/[0.06] border border-foreground/[0.05] dark:border-white/[0.06]'
      }`}
    >
      <div className="h-8 w-8 rounded-lg bg-foreground/[0.06] dark:bg-white/[0.08] flex items-center justify-center shrink-0">
        <Icon size={14} strokeWidth={1.7} className="text-icon-muted" />
      </div>
      <div className="min-w-0">
        <div className="text-[12.5px] font-medium truncate text-foreground">{a.name}</div>
        <div className="text-[11px] text-muted-foreground">{a.size}</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Bubble styles (light + dark via CSS class hooks)
// ─────────────────────────────────────────────────────────────────
// v30.31 — BubbleStyles is verwijderd. .rp-bubble styling staat nu
// globaal in index.css (single source of truth via --surface-bubble*
// tokens). Geen <style> tag meer in deze component nodig.
function BubbleStyles() {
  return null;
}

// Reworked Bubble using className hooks so dark mode is automatic.
// v8: long messages (≥ 200 chars) render as a collapsible mail card
// with a fade-out preview and a Show more toggle.
const LONG_MSG_THRESHOLD = 200;

function BubbleV2({
  msg,
  showAvatar,
  showName,
  isLastInRun,
  avatarSrc,
}: {
  msg: ThreadMessage;
  showAvatar: boolean;
  showName: boolean;
  isLastInRun: boolean;
  avatarSrc?: string;
}) {
  const mine = msg.from === 'me';
  const isLong = msg.body.length >= LONG_MSG_THRESHOLD;
  const [expanded, setExpanded] = useState(false);

  const bubble = isLong ? (
    <div
      className="rp-bubble rounded-[20px] text-[15px] leading-[1.5] text-foreground overflow-hidden"
      style={{
        [mine ? 'borderBottomRightRadius' : 'borderBottomLeftRadius']: isLastInRun ? 6 : 20,
      }}
    >
      <motion.div
        layout
        transition={APPLE_SPRING}
        className="relative"
      >
        <div
          className="px-3.5 pt-2.5 relative"
          style={
            expanded
              ? undefined
              : {
                  maxHeight: 74,
                  overflow: 'hidden',
                  WebkitMaskImage:
                    'linear-gradient(to bottom, black 60%, transparent 100%)',
                  maskImage:
                    'linear-gradient(to bottom, black 60%, transparent 100%)',
                }
          }
        >
          <pre
            className="font-sans whitespace-pre-wrap break-words text-[14.5px] leading-[1.5] m-0"
            data-testid={`msg-body-${msg.id}`}
          >
            {msg.body}
          </pre>
        </div>
        {msg.attachments && expanded &&
          msg.attachments.map((a, i) => (
            <div key={i} className="px-3.5">
              <BubbleAttachment a={a} mine={mine} />
            </div>
          ))}
      </motion.div>
      <button
        onClick={() => setExpanded((v) => !v)}
        data-testid={`toggle-long-${msg.id}`}
        className="flex items-center justify-between w-full px-3.5 py-2 mt-1 border-t border-foreground/[0.06] dark:border-white/[0.06] text-[12.5px] font-semibold text-foreground/70 hover-elevate active-elevate-2"
      >
        <span className="inline-flex items-center gap-1">
          {expanded ? (
            <>
              <ChevronUp size={13} strokeWidth={2.2} /> Show less
            </>
          ) : (
            <>
              <ChevronDown size={13} strokeWidth={2.2} /> Show more
            </>
          )}
        </span>
        <span className="text-[10.5px] tabular-nums text-foreground/45 font-normal">
          {hhmm(msg.ts)}
        </span>
      </button>
    </div>
  ) : (
    <div
      className="rp-bubble rounded-[20px] px-3.5 py-2.5 text-[15px] leading-[1.4] text-foreground"
      style={{
        [mine ? 'borderBottomRightRadius' : 'borderBottomLeftRadius']: isLastInRun ? 6 : 20,
      }}
    >
      <pre className="font-sans whitespace-pre-wrap break-words text-[15px] leading-[1.4] m-0">
        {msg.body}
      </pre>
      {msg.attachments?.map((a, i) => (
        <BubbleAttachment key={i} a={a} mine={mine} />
      ))}
      <div
        className={`text-[10.5px] mt-1 tabular-nums ${
          mine ? 'text-right' : 'text-right'
        } ${mine ? 'text-foreground/45 dark:text-white/45' : 'text-foreground/45'}`}
      >
        {hhmm(msg.ts)}
      </div>
    </div>
  );

  if (mine) {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={APPLE_SPRING}
        className="rp-thread-mine flex justify-end"
      >
        <div className="max-w-[78%] flex flex-col items-end">{bubble}</div>
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={APPLE_SPRING}
      className="rp-thread-other flex items-end gap-2"
    >
      <div className="w-8 shrink-0">
        {showAvatar && <ReplaiyAvatar name={msg.authorName} src={avatarSrc} size={32} />}
      </div>
      <div className="max-w-[78%] flex flex-col items-start">
        {showName && (
          <div className="text-[12px] font-medium text-foreground/65 ml-1 mb-1">
            {msg.authorName}
          </div>
        )}
        {bubble}
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Date separator
// ─────────────────────────────────────────────────────────────────
function DaySeparator({ iso }: { iso: string }) {
  return (
    <div className="flex items-center gap-3 my-4 px-1">
      <div className="flex-1 h-px bg-foreground/[0.07] dark:bg-white/[0.07]" />
      <span className="text-[11px] font-medium tracking-wide text-foreground/55 uppercase">
        {relativeDayLabel(iso)}
      </span>
      <div className="flex-1 h-px bg-foreground/[0.07] dark:bg-white/[0.07]" />
    </div>
  );
}

// "New since you last visited" divider — optionally with an AI mini-context line
function NewSinceDivider({ label, context }: { label: string; context?: string }) {
  return (
    <div
      data-testid="new-since-divider"
      className="my-4 px-1"
    >
      <div className="flex items-center gap-2.5">
        <div className="flex-1 h-px bg-foreground/15" />
        <span className="text-[11px] font-semibold tracking-wide text-foreground/55 inline-flex items-center gap-1">
          <Sparkles size={11} strokeWidth={2} className="text-icon-muted" />
          New since {label}
        </span>
        <div className="flex-1 h-px bg-foreground/15" />
      </div>
      {context && (
        <div
          data-testid="new-since-context"
          className="mt-1.5 text-center text-[13px] italic leading-snug text-foreground/55 max-w-[88%] mx-auto"
        >
          {context}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Sticky conversation summary card — pinned to the top of the
// scroll area so it's always visible no matter where you are
// in the thread. Three states:
//   - 'preview': 3-line clamp with bottom gradient-fade + Show more
//   - 'expanded': full height, gradient removed, Show less
//   - 'compact': single-line preview (first 60 chars) once user has
//                scrolled past COMPACT_THRESHOLD inside the thread
// ─────────────────────────────────────────────────────────────────
const COMPACT_THRESHOLD = 200; // px scrolled before auto-collapsing to 1 line

function StickyConversationSummary({
  summary,
  scrollY,
}: {
  summary: string;
  scrollY: number;
}) {
  // User-controlled state: 'preview' | 'expanded'
  // Compact is derived from scrollY UNLESS user has overridden it.
  const [expanded, setExpanded] = useState(false);
  const [forcePreview, setForcePreview] = useState(false);

  // 'compact' state is purely derived from scroll position, unless the user
  // tapped on the compact bar to re-open it.
  const shouldCompact = scrollY > COMPACT_THRESHOLD && !expanded && !forcePreview;

  // Re-arm compact mode whenever scroll falls below threshold.
  useEffect(() => {
    if (scrollY <= COMPACT_THRESHOLD && forcePreview) {
      setForcePreview(false);
    }
  }, [scrollY, forcePreview]);

  // Heuristic: only show Show more if the summary is long enough to clamp.
  // ~3 lines at ~52ch per line ≈ 156 chars. Be permissive.
  const canClamp = summary.length > 140;

  // Compact one-liner: first 60 chars + ellipsis
  const compactPreview =
    summary.length > 60 ? `${summary.slice(0, 60).trimEnd()}…` : summary;

  return (
    <motion.div
      layout
      transition={APPLE_SPRING}
      data-testid="sticky-conversation-summary"
      className="glass-ai rounded-3xl overflow-hidden"
    >
      {shouldCompact ? (
        <button
          type="button"
          onClick={() => setForcePreview(true)}
          data-testid="sticky-summary-compact"
          className="w-full flex items-center gap-2 px-3.5 py-2 text-left hover-elevate active-elevate-2"
        >
          <Sparkles size={12} strokeWidth={2.2} className="text-icon-muted shrink-0" />
          <span className="text-[12.5px] font-medium text-foreground/80 truncate flex-1">
            {compactPreview}
          </span>
          <ChevronDown size={13} strokeWidth={2.2} className="text-icon-muted shrink-0" />
        </button>
      ) : (
        <motion.div layout transition={APPLE_SPRING} className="px-4 py-3.5">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Sparkles size={12} strokeWidth={2.2} className="text-icon-muted" />
            <span className="text-[10.5px] uppercase tracking-wider font-semibold text-foreground/70">
              Conversation summary
            </span>
          </div>
          <motion.div
            layout
            transition={APPLE_SPRING}
            className="relative"
            style={
              !expanded && canClamp
                ? {
                    maxHeight: 'calc(1.5em * 3)',
                    overflow: 'hidden',
                    WebkitMaskImage:
                      'linear-gradient(to bottom, black 55%, transparent 100%)',
                    maskImage:
                      'linear-gradient(to bottom, black 55%, transparent 100%)',
                  }
                : undefined
            }
          >
            <p
              className="text-[14.5px] leading-[1.5] text-foreground/85 m-0"
              data-testid="sticky-summary-text"
            >
              {summary}
            </p>
          </motion.div>
          {canClamp && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              data-testid="sticky-summary-toggle"
              className="mt-1.5 inline-flex items-center gap-1 text-[12.5px] font-semibold text-foreground/70 hover-elevate active-elevate-2 rounded-md px-1 -mx-1"
            >
              {expanded ? (
                <>
                  Show less <ChevronUp size={13} strokeWidth={2.2} />
                </>
              ) : (
                <>
                  Show more <ChevronDown size={13} strokeWidth={2.2} />
                </>
              )}
            </button>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────
export function ConversationTimeline({ mail }: { mail: Conversation }) {
  // v17 — thread view uses the same ConversationActionCluster + Context state.
  // Read global open state so the Context pill reflects it.

  const [, navigate] = useLocation();
  const {
    setConversationStatus,
    setComposePrefill,
    summaryPanelOpen,
    toggleSummaryPanel,
    setSummaryPanelOpen,
    leadPanelOpen,
    toggleLeadPanel,
    setLeadPanelOpen,
  } = useReplaiy();

  // Lead context panel only makes sense when there is something to show.
  const hasLeadContext =
    !!mail.lead ||
    !!mail.aiRead ||
    !!mail.nextAction ||
    !!mail.goalStage ||
    !!mail.leadHeadline;

  // The panel defaults to OPEN (nice on desktop), but on a compact viewport
  // an auto-open slide-over would cover the whole conversation on first
  // load. So on mount, if we are compact, collapse it once — the user can
  // still open it via the chip / toggle. Runs only on the initial mount.
  const didInitLeadPanel = useRef(false);
  useEffect(() => {
    if (didInitLeadPanel.current) return;
    didInitLeadPanel.current = true;
    if (typeof window !== 'undefined' && !window.matchMedia('(min-width: 1024px)').matches) {
      setLeadPanelOpen(false);
    }
  }, [setLeadPanelOpen]);
  // v30.32 — ConversationTimeline rendert nu ALLE conversations (single + thread).
  // Voorheen had SingleConversationDetail een eigen render-tree, wat tot subtiele
  // styling-verschillen leidde tussen "Elena's mail" en "Nora's thread".
  // Nu: als mail.messages leeg is, sintetiseren we één message uit
  // mail.body — het hele thread-systeem werkt dan ook voor single conversations.
  // Replaiy — een NIEUWE lege conversatie (geen messages én geen body)
  // houdt een lege thread: alleen de lead-header bovenin + de reply-balk
  // onderaan, geen synthetische bubble. Bestaande conversations blijven één
  // bubble synthetiseren uit mail.body.
  const messages: ThreadMessage[] =
    mail.messages && mail.messages.length > 0
      ? mail.messages
      : mail.body
        ? [{
            id: `${mail.id}-msg`,
            from: 'other',
            authorName: mail.from.name,
            authorEmail: mail.from.email,
            ts: mail.ts,
            body: mail.body,
            attachments: mail.attachments,
          }]
        : [];
  const lastSeenId = mail.lastSeenMessageId;
  const lastSeenIdx = lastSeenId
    ? messages.findIndex((m) => m.id === lastSeenId)
    : -1;
  const hasNewSince = lastSeenIdx >= 0 && lastSeenIdx < messages.length - 1;
  const firstNewIdx = hasNewSince ? lastSeenIdx + 1 : -1;
  const firstNewIso = firstNewIdx >= 0 ? messages[firstNewIdx].ts : null;

  const containerRef = useRef<HTMLDivElement>(null);
  // v30.32 — Ref op het summary-panel wrapper voor click-outside detect.
  const summaryPanelRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<(HTMLDivElement | null)[]>([]);

  // v30.30 — WhatsApp-style layout: meet de hoogte van de reply bar zodat
  // de scrollable timeline precies de juiste bottom padding krijgt.
  // Wanneer de editor open groeit (50vh / 88vh fullscreen) groeit deze
  // padding mee, en duwt het laatste bericht netjes mee omhoog —
  // berichten staan dus altijd direct boven de reply bar (geen lege
  // ruimte tussenin) en zijn altijd zichtbaar.
  const replyBarWrapRef = useRef<HTMLDivElement>(null);
  const replyBarWrapMobileRef = useRef<HTMLDivElement>(null);
  const [replyBarHeight, setReplyBarHeight] = useState(80);

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;
    // Pak de actieve wrapper (desktop wanneer lg:block visible is, anders mobile).
    const pick = () => {
      const d = replyBarWrapRef.current;
      if (d && d.offsetHeight > 0) return d;
      const m = replyBarWrapMobileRef.current;
      if (m && m.offsetHeight > 0) return m;
      return null;
    };
    let target = pick();
    const ro = new ResizeObserver(() => {
      const el = pick();
      if (el) {
        // v30.30 — Dynamische padding: thread schuift mee omhoog wanneer
        // editor expand'd — net als WhatsApp/iMessage. Geldt voor zowel
        // mobile als desktop.
        setReplyBarHeight(el.offsetHeight);
        // Houd de laatste message in beeld terwijl editor groeit, mits
        // user al onderaan was (binnen 80px).
        const scroll = containerRef.current;
        if (scroll) {
          const near =
            scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight;
          if (near < 80) {
            requestAnimationFrame(() => {
              if (containerRef.current) {
                containerRef.current.scrollTop =
                  containerRef.current.scrollHeight;
              }
            });
          }
        }
      }
    });
    if (target) ro.observe(target);
    // Bij viewport resize (mobile keyboard) opnieuw target picken.
    const onResize = () => {
      const next = pick();
      if (next && next !== target) {
        if (target) ro.unobserve(target);
        ro.observe(next);
        target = next;
        setReplyBarHeight(next.offsetHeight);
      }
    };
    window.addEventListener('resize', onResize);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', onResize);
    };
  }, [mail.id]);

  // v30.30 — Forward state. Wanneer gezet, opent InlineReplyBar in
  // forward-mode (leeg To-veld, editor met forward-block).
  const [forwardContext, setForwardContext] = useState<ForwardContext | null>(null);
  // v30.30 — Mobile: hide Forward-pill naast bar wanneer editor expanded.
  const [replyBarExpanded, setReplyBarExpanded] = useState(false);

  // v36 — Compact viewport flag + mobile reply/forward sheet open state.
  // On mobile, reply and forward share Compose's 92vh sheet host so the
  // on-screen keyboard never clips the editor. The sheet is open when:
  //   (a) the user tapped the inline collapsed placeholder (replySheetOpen),
  //   (b) the user tapped Forward in the top-right action cluster
  //       (forwardContext is set).
  // On desktop the inline reply bar continues to live in the column
  // (unchanged from v35.x).
  const isCompact = useIsCompactViewport();
  const isWide = useIsWideViewport();
  const [replySheetOpen, setReplySheetOpen] = useState(false);
  // Mobile sheet pill subject preview — live updated via onSubjectChange
  // when forwarding (the forward subject is editable). For reply the
  // bar's subject equals the parent mail subject (not editable).
  const [liveReplySubject, setLiveReplySubject] = useState<string>('');
  const [replyActiveFormats, setReplyActiveFormats] = useState<
    Array<'bold' | 'italic' | 'underline' | 'ul' | 'ol'>
  >([]);
  const replySheetRefs = useComposeSheetRefs();

  // v37 — Desktop focus mode state. When user clicks maximize ↗ on the
  // inline desktop reply bar, we mount a ComposeColumnDesktop wrapper
  // over kolom 3 with a fresh chromeless+initialExpanded InlineReplyBar
  // inside, mirroring the mobile sheet pattern. Separate ref bag +
  // separate live state from the mobile sheet path so the two never
  // interfere with each other.
  const [replyFocusOpen, setReplyFocusOpen] = useState(false);
  const [liveFocusSubject, setLiveFocusSubject] = useState<string>('');
  const [focusActiveFormats, setFocusActiveFormats] = useState<
    Array<'bold' | 'italic' | 'underline' | 'ul' | 'ol'>
  >([]);
  const focusSheetRefs = useComposeSheetRefs();
  // v38.1 — Bump counter forces the inline bar to remount whenever an AI
  // draft dismiss happens from elsewhere (focus mode / mobile sheet's
  // Discard popover). Without this, the inline bar holds its own stale
  // `localDismissed` state and re-renders with the dismissed AI text
  // still visible after the focus-mode sheet closes.
  const [aiDismissBump, setAiDismissBump] = useState(0);

  // v-replaiy-2 — The mobile 92vh reply "sheet" is retired. Replaiy chat
  // replies now expand in-place at the bottom of the conversation
  // (WhatsApp/iMessage style). Replaiy has no Forward, so there is no
  // remaining reason to mount ComposeSheetMobile here. We hard-disable it
  // (was: isCompact && (replySheetOpen || !!forwardContext)). The state
  // setters stay defined so the rest of the file compiles unchanged.
  const mobileSheetActive = false;

  // v30.30 — Inline reply / forward send.
  const onSendInline = (payload: {
    kind: 'reply' | 'forward' | 'compose';
    html: string;
    subject?: string;
    to: string[];
    cc: string[];
    bcc: string[];
    attachments: File[];
  }) => {
    // eslint-disable-next-line no-console
    console.log('[Replaiy] thread inline send', { thread: mail.id, ...payload });
    if (payload.kind === 'forward') {
      // Forward voltooid: forward-state resetten, mail blijft 'open'
      // (forward is geen reply naar de afzender, dus geen 'waiting').
      setForwardContext(null);
      navigate('/');
      return;
    }
    setConversationStatus(mail.id, 'waiting');
    navigate('/');
  };

  // v-replaiy — The standalone /compose route was removed in the Stilt
  // cleanup. Replies are always composed inline via the ComposeColumn /
  // ComposeSheet editor below, so "expand to compose" only stages the
  // prefill (the InlineReplyBar onExpand prop is currently inert).
  const onExpandCompose = () => {
    const last = messages[messages.length - 1];
    const replyTo = last && last.from === 'other' ? last.authorEmail : mail.from.email;
    setComposePrefill({
      to: `${mail.from.name} <${replyTo || mail.from.email}>`,
      subject: mail.subject.startsWith('Re:') ? mail.subject : `Re: ${mail.subject}`,
      body: '',
      replyToId: mail.id,
    });
  };

  const isTodayForYou =
    mail.priority === 'high' && mail.status === 'open' && mail.needsReply;
  const aiDraft = isTodayForYou ? (mail as any).smartReplies?.[0] ?? null : null;

  // v30.30 — Forward thread = open inline reply bar in forward-mode.
  // Geen route-switch meer. We bouwen een leesbare forward-quote die
  // chronologisch klopt (oudste → nieuwste) met goede visuele scheiding
  // tussen messages.
  const onForwardThread = () => {
    const fwdSubject = mail.subject.startsWith('Fwd:')
      ? mail.subject
      : `Fwd: ${mail.subject}`;
    const fmtDate = (iso: string) => {
      try {
        const d = new Date(iso);
        return d.toLocaleString(undefined, {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      } catch {
        return iso;
      }
    };
    const escape = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const fmtBody = (s: string) =>
      escape(s || '')
        .replace(/\n\n+/g, '</p><p>')
        .replace(/\n/g, '<br/>');

    const sorted = [...(messages || [])].sort((a, b) =>
      String(a.ts).localeCompare(String(b.ts)),
    );
    // v30.30 — Fallback voor 'me' messages die geen authorEmail hebben:
    // gebruik de eigen mock-email zodat de forward-quote consistent is.
    const MY_EMAIL = 'simon@replaiy.ai';
    const emailFor = (m: typeof sorted[number]) =>
      m.authorEmail || (m.from === 'me' ? MY_EMAIL : undefined);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const participants = Array.from(
      new Set(sorted.map((m) => m.authorName)),
    ).join(', ');

    // Header: thread-meta (geen single 'From' — thread heeft meerdere).
    const headerHtml = `
      <p><br/></p>
      <p style="color:#86868b">—————————— Forwarded conversation ——————————</p>
      <p>
        <strong>Subject:</strong> ${escape(mail.subject)}<br/>
        <strong>Participants:</strong> ${escape(participants)}<br/>
        <strong>Messages:</strong> ${sorted.length}${
          first && last
            ? ` · ${fmtDate(first.ts)} → ${fmtDate(last.ts)}`
            : ''
        }
      </p>
      <p><br/></p>
    `;

    // Per-message blokken: subtiele separator + auteur+email + body.
    const messagesHtml = sorted
      .map((m, i) => {
        const em = emailFor(m);
        return `
          ${i > 0 ? '<p><br/></p>' : ''}
          <p style="color:#86868b">———</p>
          <p><strong>${escape(m.authorName)}</strong>${
            em ? ` &lt;${escape(em)}&gt;` : ''
          }<br/>
          <span style="color:#86868b">${fmtDate(m.ts)}</span></p>
          <p>${fmtBody(m.body || '')}</p>
        `;
      })
      .join('\n');

    // v30.30 — Verzamel alle attachments uit de thread + bouw File-stubs
    // (lege Blobs met juiste name+size). Worden door InlineReplyBar als
    // klikbare chips boven de editor getoond — zelfde UX als zelf-upload.
    const flatAttachments = sorted.flatMap((m) => m.attachments ?? []);
    const parseSize = (s: string) => {
      // mock: '186 KB', '2.3 MB' — alleen voor display, niet kritisch.
      const m = String(s || '').match(/([\d.]+)\s*(KB|MB|B)/i);
      if (!m) return 0;
      const n = parseFloat(m[1]);
      const unit = m[2].toUpperCase();
      return Math.round(n * (unit === 'MB' ? 1024 * 1024 : unit === 'KB' ? 1024 : 1));
    };
    const mimeFor = (kind: string) => {
      switch (kind) {
        case 'pdf': return 'application/pdf';
        case 'image': return 'image/png';
        case 'doc': return 'application/msword';
        case 'sheet': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        case 'zip': return 'application/zip';
        default: return 'application/octet-stream';
      }
    };
    const fileStubs: File[] = flatAttachments.map((a) => {
      const size = parseSize(a.size);
      // Vul met dummy bytes zodat AttachmentChip de juiste size kan tonen.
      const blob = new Blob([new Uint8Array(size > 0 ? Math.min(size, 64 * 1024) : 1)], {
        type: mimeFor(a.kind),
      });
      // File API — als unsupported (zeldzaam), fallback met cast.
      try {
        return new File([blob], a.name, { type: mimeFor(a.kind) });
      } catch {
        return blob as unknown as File;
      }
    });

    const allAttachments = flatAttachments.map((a) => a.name);

    setForwardContext({
      subject: fwdSubject,
      body: `${headerHtml}${messagesHtml}`,
      attachments: fileStubs,
      attachmentLabels: allAttachments,
    });
  };

  // Auto-scroll bij thread open: naar laatste bericht.
  useLayoutEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const id = requestAnimationFrame(() => {
      const root2 = containerRef.current;
      if (root2) root2.scrollTop = root2.scrollHeight;
    });
    return () => cancelAnimationFrame(id);
  }, [mail.id]);

  // v14.3 — Scrubber active dot. Uses offsetTop/offsetHeight relative to the
  // scroll container (NOT getBoundingClientRect). Handles bottom/top edges
  // explicitly so the final dot lights up at the bottom.
  const [activeIdx, setActiveIdx] = useState(messages.length - 1);
  const [scrubberVisible, setScrubberVisible] = useState(true);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // v14.5 tracked scroll position to drive the sticky summary's auto-collapse.
  // v14.6 removed the sticky summary entirely. threadScrollY is no longer
  // consumed by anything in the tree but the scroll handler below still
  // ticks it, so we keep the state to avoid touching unrelated logic.
  const [threadScrollY, setThreadScrollY] = useState(0);

  // v15.1 — AI summary now lives in the unified RightSidePanel.

  // v30.32 — Was: scroll-to-top + auto-collapse on scroll. Niet meer
  // nodig: panel is nu een floating overlay sticky onder de subject-pill,
  // dus altijd zichtbaar zonder thread te bewegen. Scroll van de thread
  // mag gewoon doorgaan ONDER het panel (geen backdrop dat wheel blokt).
  //
  // Click-outside om te sluiten: document mousedown listener. Klik op
  // de meta-badge in de subject-pill toggled éék via z'n eigen click —
  // we negeren die source zodat 'm niet meteen weer sluit.
  useEffect(() => {
    if (!summaryPanelOpen) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      // Click binnen het panel → niets doen.
      if (summaryPanelRef.current?.contains(target)) return;
      // Click op de meta-badge (toggle source) → niets doen, anders
      // sluit-en-heropent het meteen.
      if (target instanceof Element && target.closest('[data-testid="thread-meta-badge"]'))
        return;
      setSummaryPanelOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [summaryPanelOpen, setSummaryPanelOpen]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, clientHeight, scrollHeight } = container;

      // 1. Force last when within 50px of bottom
      if (scrollTop + clientHeight >= scrollHeight - 50) {
        setActiveIdx(Math.max(0, messages.length - 1));
        return;
      }

      // 2. Force first when within 50px of top
      if (scrollTop < 50) {
        setActiveIdx(0);
        return;
      }

      // 3. Otherwise find the first message whose BOTTOM is past viewport center
      const viewportCenter = scrollTop + clientHeight / 2;
      let bestIdx = 0;
      for (let i = 0; i < messageRefs.current.length; i++) {
        const el = messageRefs.current[i];
        if (!el) continue;
        const elTop = el.offsetTop;
        const elBottom = elTop + el.offsetHeight;
        if (elBottom >= viewportCenter) {
          bestIdx = i;
          break;
        }
        bestIdx = i;
      }
      setActiveIdx(bestIdx);
    };

    const onScroll = () => {
      handleScroll();
      setThreadScrollY(container.scrollTop);
      setScrubberVisible(true);
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => setScrubberVisible(false), 1500);
    };

    container.addEventListener('scroll', onScroll, { passive: true });

    // Initial compute — two-frame chain so layout settles after
    // useLayoutEffect set scrollTop = scrollHeight.
    const id1 = requestAnimationFrame(() => {
      const id2 = requestAnimationFrame(() => handleScroll());
      (container as any).__rafId2 = id2;
    });

    return () => {
      container.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(id1);
      if ((container as any).__rafId2) cancelAnimationFrame((container as any).__rafId2);
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [mail.id, messages.length]);

  const jumpTo = (i: number) => {
    const el = messageRefs.current[i];
    const root = containerRef.current;
    if (!el || !root) return;
    const targetTop = el.offsetTop - 80;
    animate(root.scrollTop, targetTop, {
      duration: 0.45,
      ease: [0.32, 0.72, 0, 1],
      onUpdate: (v) => {
        root.scrollTop = v;
      },
    });
  };

  // Compute renderable timeline items: day-separators, new-since divider, bubbles
  type Item =
    | { kind: 'day'; iso: string; key: string }
    | { kind: 'new'; iso: string; key: string }
    | {
        kind: 'msg';
        msg: ThreadMessage;
        idx: number;
        showAvatar: boolean;
        showName: boolean;
        isLastInRun: boolean;
        key: string;
      };

  const items: Item[] = useMemo(() => {
    const out: Item[] = [];
    let lastDay: string | null = null;
    let lastFromKey: string | null = null;
    messages.forEach((m, i) => {
      const d = new Date(m.ts);
      const dayKey = d.toDateString();
      if (dayKey !== lastDay) {
        out.push({ kind: 'day', iso: m.ts, key: `day-${dayKey}` });
        lastDay = dayKey;
        lastFromKey = null; // reset run on new day
      }
      if (firstNewIdx === i) {
        out.push({ kind: 'new', iso: m.ts, key: 'new-since' });
      }
      const fromKey = m.from === 'me' ? 'me' : m.authorName;
      const next = messages[i + 1];
      const nextDayKey = next ? new Date(next.ts).toDateString() : null;
      const nextFromKey = next ? (next.from === 'me' ? 'me' : next.authorName) : null;
      const showAvatar = m.from === 'other' && (lastFromKey !== fromKey);
      const showName = m.from === 'other' && (lastFromKey !== fromKey);
      const isLastInRun =
        !next ||
        nextFromKey !== fromKey ||
        nextDayKey !== dayKey ||
        firstNewIdx === i + 1;
      out.push({
        kind: 'msg',
        msg: m,
        idx: i,
        showAvatar,
        showName,
        isLastInRun,
        key: m.id,
      });
      lastFromKey = fromKey;
    });
    return out;
  }, [messages, firstNewIdx]);

  // Replaiy-regel: niks hardcoded, de data stuurt de foto. Resolve een
  // bericht-avatar door authorName te matchen tegen de lead (mail.from)
  // of een thread-deelnemer. 'me'-berichten krijgen geen src → initials.
  const resolveAuthorAvatar = (m: ThreadMessage): string | undefined => {
    if (m.from === 'me') return undefined;
    if (m.authorName === mail.from.name) return mail.from.avatar;
    const p = mail.threadParticipants?.find((x) => x.name === m.authorName);
    return p?.avatar ?? mail.from.avatar;
  };

  // Title pill: show participant or "X people"
  const titleName = mail.from.name;

  return (
    <div className="flex flex-row h-full min-h-0 relative">
      {/* CENTER column — timeline + chrome + reply bar. flex-1 so it takes
          the full width when the lead panel is closed, and shrinks (not
          crushes) when the panel opens beside it on desktop. */}
      <div className="flex-1 flex flex-col h-full min-h-0 relative min-w-0">
      <BubbleStyles />
      {/* Mobile top chrome: back + identity pill + Done/Snooze actions. */}
      <ThreadChromeSlot
        name={titleName}
        avatar={mail.from.avatar}
        threadCount={messages.length}
        onBack={() => navigate('/')}
        onDone={() => { setConversationStatus(mail.id, 'done'); navigate('/'); }}
        onSnooze={() => { setConversationStatus(mail.id, 'snoozed'); navigate('/'); }}
        onIdentityClick={hasLeadContext ? toggleLeadPanel : undefined}
        chromeHidden={hasLeadContext && leadPanelOpen}
      />

      {/* DESKTOP top pill row (v19.3) — absolutely positioned at top:12px
         on the column 2 root, same baseline as the Inbox dropdown (column 1).
         v19.3: Avatar+Subject group is CENTERED via `justify-center` and the
         Done/Snooze pills are absolutely anchored to the top-right so they
         do NOT affect the centered group's position. */}
      <div
        data-testid="desktop-pill-row"
        className="hidden md:block absolute top-3 inset-x-0 z-30 pointer-events-none"
      >
        {/* Inner band reserves space for the action pills on the RIGHT
           (`pr-[136px]` = 24px right edge + ~112px action cluster + gap),
           then centers the Avatar+Subject group inside the remaining
           space using `justify-center`. The action pills are absolutely
           anchored to the right and DO NOT participate in the center
           calculation. */}
        {/* v30.33 — Symmetrische padding (links én rechts óf een gelijk
           bedrag, óf matchen met de scroll-column l/r) zodat de pill
           visueel gecentreerd staat boven column 3. Eerder zat `pl-4
           lg:pl-6 pr-[136px]` waardoor de center-as ~50px naar links
           verschoof. We reserveren nu aan beide zijden ruimte voor de
           action cluster (136px) zodat de Avatar+Subject groep precies
           in het midden van de viewport-column zit. */}
        {/* Conversation header logic, by state:
           • lead CLOSED → identity pill. Centered on wide (>=1280), left-aligned
             below that (more stable on a narrow center column).
           The identity pill ALWAYS stays visible (it is the conversation
           header and the panel trigger). Alignment:
           • CENTERED when the lead panel is closed AND the screen is wide
             (>=1280) — plenty of room above the conversation.
           • LEFT-aligned when the panel is OPEN (narrow center column) or on
             screens below 1280 — never collides with the action cluster and
             truncates cleanly before the buttons. */}
        {(() => {
          const leftAlign = leadPanelOpen || !isWide;
          return (
            <div
              className={`flex items-center ${leftAlign ? 'justify-start' : 'justify-center'}`}
              style={{
                paddingLeft: leftAlign ? 24 : 136,
                paddingRight: hasLeadContext ? 150 : 136,
              }}
            >
              <div className="pointer-events-auto flex items-center gap-3 min-w-0 max-w-[440px]">
                {/* v30.32 — Combined identity + subject pill (zie
                   ConversationDetailToolbar.tsx). */}
                <SubjectIdentityPill
                  name={titleName}
                  avatar={mail.from.avatar}
                  subject={[mail.leadHeadline, mail.leadCompany].filter(Boolean).join(' · ')}
                  metaLabel={null}
                  onMetaClick={undefined}
                  metaActive={summaryPanelOpen}
                  onIdentityClick={hasLeadContext ? toggleLeadPanel : undefined}
                  identityActive={false}
                />
              </div>
            </div>
          );
        })()}
        <div className="absolute top-0 right-4 lg:right-6 pointer-events-auto flex items-center gap-2">
          {/* v30.30 — Desktop gebruikt nu hetzelfde compact-pattern als
             mobile: Done + ••• overflow met Forward + Snooze + kalender.
             Done staat links, panel-toggle rechts (aan de kant van het
             paneel dat hij opent). */}
          <ConversationActionPillsCompact
            onDone={() => { setConversationStatus(mail.id, 'done'); navigate('/'); }}
            onSnooze={() => { setConversationStatus(mail.id, 'snoozed'); navigate('/'); }}
          />
          {/* Lead-context panel toggle button removed per user request — the
             lead-context column now simply stays open by default (no manual
             toggle). The leadPanelOpen state + toggleLeadPanel stay available
             for any programmatic use. */}
        </div>
      </div>

      {/* v30.32 — Desktop summary panel als floating overlay onder de
         sticky subject-pill (top-3 = 12px, pill h=52, gap 12 → top:78).
         GEEN backdrop overlay — die zou wheel-scroll naar de thread
         erachter blokkeren. Klik-buiten-sluit wordt via document
         mousedown listener afgehandeld (zie useEffect hieronder).

         Geen opacity-fade (gaf backdrop-filter flicker). Alleen Y. */}
      {/* v30.33 — GEEN framer-motion wrapper meer. Een transform op een
         parent (zelfs `translateY`) breekt backdrop-filter context: het
         filter blurt dan alleen elementen BINNEN de transformed parent,
         niet wat erachter op de viewport zit → panel wordt doorzichtig.
         Dit was het verschil met de editor: die zit in een sticky parent
         zonder framer-motion Y-translate. Nu gebruiken we een simpele
         CSS opacity-fade via een state-class. Geen transform = backdrop-
         filter werkt correct = panel toont z'n eigen glass sheen én de
         backdrop blur. */}
      {summaryPanelOpen && (
        <div
          data-testid="floating-summary-wrapper"
          className="hidden md:block absolute top-[78px] inset-x-0 z-20 pointer-events-none px-4 lg:px-6"
        >
          <div
            ref={summaryPanelRef}
            className="mx-auto pointer-events-auto"
            style={{ maxWidth: 720 }}
          >
            <ConversationSummaryPanel mail={mail} />
          </div>
        </div>
      )}

      {/* Scrollable timeline. */}
      <div
        ref={containerRef}
        data-testid="thread-scroll"
        // v30.30 — WhatsApp-style: paddingBottom = werkelijke reply-bar
        // hoogte + kleine ademruimte. Wanneer de editor expand'd, groeit
        // deze padding automatisch mee (ResizeObserver). Resultaat: het
        // laatste bericht staat ALTIJD direct boven de reply bar — geen
        // lege ruimte, geen verstopte berichten.
        className="flex-1 overflow-y-auto no-scrollbar relative"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 86px)',
          paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + ${replyBarHeight + 24}px)`,
        }}

      >

        <div className="pl-4 lg:pl-6 pr-8 lg:pr-10">
        {/* v30.32 — Desktop summary is GEEN onderdeel van de scroll meer.
           Hij staat nu als floating overlay onder de subject-pill, buiten
           deze scroll-container (zie onderaan dit component). Hier alleen
           nog mobile inline. */}

        {/* MOBILE inline summary (sits above subject card when open). */}
        <div className="lg:hidden">
          <div className="mx-auto" style={{ maxWidth: 720 }}>
            <AnimatePresence initial={false}>
              {summaryPanelOpen && (
                <motion.div
                  key="mobile-inline-summary"
                  initial={{ opacity: 0, y: -8, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, y: -8, height: 0 }}
                  transition={APPLE_SPRING}
                  className="overflow-hidden"
                >
                  <div className="pb-3">
                    <ConversationSummaryPanel mail={mail} onClose={() => setSummaryPanelOpen(false)} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        {/* v15 — max-width 720 centered chat column */}
        <div className="mx-auto" style={{ maxWidth: 720 }}>
          {/* v19.2 — Subject card REMOVED from the thread top. The sticky
             SubjectPill in the column-2 chrome is now the single source of
             truth. The thread starts directly with the day-separator + bubbles. */}

          {/* Timeline.
              v12: use real flex gap + flex-shrink:0 on each bubble wrapper
              so the "Show more" expansion can never overlap the next bubble.
              The motion.div on BubbleV2 has `layout` which animates its own
              height; the gap here keeps clearance regardless of state. */}
          <motion.div
            layout
            transition={APPLE_SPRING}
            className="flex flex-col pb-4"
            style={{ gap: 16 }}
          >
            {items.map((it) => {
              if (it.kind === 'day')
                return (
                  <div key={it.key} style={{ flexShrink: 0 }}>
                    <DaySeparator iso={it.iso} />
                  </div>
                );
              if (it.kind === 'new')
                return (
                  <div key={it.key} style={{ flexShrink: 0 }}>
                    <NewSinceDivider
                      label={relativeDayLabel(it.iso)}
                      context={mail.newSinceContext}
                    />
                  </div>
                );
              return (
                <div
                  key={it.key}
                  style={{ flexShrink: 0 }}
                  ref={(el) => {
                    messageRefs.current[it.idx] = el;
                  }}
                >
                  <BubbleV2
                    msg={it.msg}
                    showAvatar={it.showAvatar}
                    showName={it.showName}
                    isLastInRun={it.isLastInRun}
                    avatarSrc={resolveAuthorAvatar(it.msg)}
                  />
                </div>
              );
            })}
          </motion.div>
        </div>

        {/* v30.30 — Scrubber dots verwijderd op verzoek. Voegde geen
           waarde toe in usability test. */}
        </div>
      </div>

      {/* v30.30 — Inline reply bar onderin (desktop).
         v37 — Hidden when the desktop focus mode wrapper is open (we
         render a fresh chromeless InlineReplyBar inside the wrapper). */}
      <div
        ref={replyBarWrapRef}
        // v38.3 — Use right-6 to line up with the Done / … buttons at
        // top-right of the mail thread column (which also use lg:right-6).
        // Was right-4, gave an 8px misalignment between editor right-edge
        // and the Done button column.
        className="hidden lg:block absolute left-6 right-6 bottom-4 z-30"
        style={{ visibility: replyFocusOpen ? 'hidden' : 'visible' }}
      >
        <InlineReplyBar
          key={`inline-desktop-${mail.id}-${aiDismissBump}`}
          aiDraft={aiDraft}
          recipientName={mail.from.name}
          recipientEmail={mail.from.email}
          mailId={mail.id}
          forwardContext={forwardContext}
          onForwardCancel={() => setForwardContext(null)}
          onDismiss={() => { setConversationStatus(mail.id, 'done'); navigate('/'); }}
          onSend={onSendInline}
          onExpand={onExpandCompose}
          onFocusMode={() => setReplyFocusOpen(true)}
          /* v38 — Skip-X in collapsed AI preview persists a dismiss
             marker in localStorage; this callback just lets parents
             react if they ever need to (no-op today). The bar's own
             `localDismissed` state already removes the preview. */
          onSkipAiDraft={() => setAiDismissBump((n) => n + 1)}
        />
      </div>

      {/* v37 — Desktop reply/forward focus mode. Mounts a
         ComposeColumnDesktop wrapper over the mail-detail column with
         identical chrome to compose desktop (X / title pill / Send +
         floating B/I/U/list/link/attach pill). Inside we render a fresh
         chromeless+initialExpanded InlineReplyBar so its sheetMode flag
         flips on (=> forward banner hides its paperclip badge + cancel
         X, edge-to-edge container, no nested glass frame). */}
      {!isCompact && replyFocusOpen && (
        // v36.5 — Desktop focus mode overlay. Solid app-bg layer +
        // higher z-index zo de mailthread inhoud erachter niet meer
        // doorbloedt. We anchoren aan de relative positioned thread
        // container; achtergrond komt van een dedicated bg layer i.p.v.
        // de glass sheet zelf, zodat de glass-recipe (chromePillStyle)
        // op chrome elements zichtbaar blijft tegen een rustige basis.
        <div className="hidden lg:flex absolute inset-0 z-50 flex-col bg-background">
          <ComposeColumnDesktop
            mode="reply"
            subject=""
            onClose={() => {
              setReplyFocusOpen(false);
              setForwardContext(null);
            }}
            sendRef={focusSheetRefs.sendRef}
            formatRef={focusSheetRefs.formatRef}
            fileRef={focusSheetRefs.fileRef}
            closeRef={focusSheetRefs.closeRef}
            hasContentRef={focusSheetRefs.hasContentRef}
            saveDraftRef={focusSheetRefs.saveDraftRef}
            discardRef={focusSheetRefs.discardRef}
            activeFormats={focusActiveFormats}
          >
            <InlineReplyBar
              chromeless
              initialExpanded
              aiDraft={aiDraft}
              recipientName={mail.from.name}
              recipientEmail={mail.from.email}
              mailId={mail.id}
              forwardContext={forwardContext}
              onForwardCancel={() => {
                setForwardContext(null);
                setReplyFocusOpen(false);
              }}
              onSend={(payload) => {
                onSendInline(payload);
                setReplyFocusOpen(false);
              }}
              onSubjectChange={setLiveFocusSubject}
              onActiveFormatsChange={setFocusActiveFormats}
              onComposeClose={() => {
                setReplyFocusOpen(false);
                setForwardContext(null);
              }}
              externalSendTrigger={focusSheetRefs.sendRef}
              externalFormatTrigger={focusSheetRefs.formatRef}
              externalFileTrigger={focusSheetRefs.fileRef}
              externalRequestCloseTrigger={focusSheetRefs.closeRef}
              externalHasContentTrigger={focusSheetRefs.hasContentRef}
              externalSaveDraftTrigger={focusSheetRefs.saveDraftRef}
              externalDiscardTrigger={focusSheetRefs.discardRef}
            />
          </ComposeColumnDesktop>
        </div>
      )}

      {/* v36 — Mobile inline reply placeholder strip.
         Renders the InlineReplyBar in its collapsed state only — a thin
         capsule with "Reply to {sender}\u2026" (or a preview of the
         autosaved draft / AI draft). Tapping it does NOT expand the bar
         in-place anymore; instead `onOpenRequest` lifts the open intent
         to the parent, which mounts a ComposeSheetMobile (92vh sheet)
         with a fresh chromeless+initialExpanded InlineReplyBar inside.
         This mirrors the Compose mobile flow exactly, so the on-screen
         keyboard never clips the editor.
         The collapsed bar here is hidden while the sheet is open so the
         placeholder doesn't peek behind the backdrop. */}
      <div
        ref={replyBarWrapMobileRef}
        className="lg:hidden absolute left-3 right-3 bottom-3 z-30"
        style={{
          paddingBottom: 'env(safe-area-inset-bottom)',
          visibility: mobileSheetActive ? 'hidden' : 'visible',
        }}
      >
        <InlineReplyBar
          key={`inline-mobile-${mail.id}-${aiDismissBump}`}
          aiDraft={aiDraft}
          recipientName={mail.from.name}
          recipientEmail={mail.from.email}
          mailId={mail.id}
          /* No forwardContext here — forward state is owned by the sheet
             instance (below) so this inline placeholder never auto-expands. */
          onDismiss={() => { setConversationStatus(mail.id, 'done'); navigate('/'); }}
          onSend={onSendInline}
          onExpand={onExpandCompose}
          onExpandedChange={setReplyBarExpanded}
          /* v-replaiy-2 — WhatsApp/iMessage-style mobile chat: the reply
             bar now expands IN PLACE at the bottom of the conversation
             (keyboard pushes it up via the dynamic scroll padding +
             ResizeObserver above). We deliberately do NOT pass
             onOpenRequest anymore — that used to lift the open intent to
             the parent and mount a separate 92vh ComposeSheetMobile
             "big screen", which felt like a different page instead of a
             chat. Omitting it lets openEditor() fall through to
             setExpanded(true) for a docked, in-thread editor. */
          /* v38 — Mobile collapsed preview also gets a Skip-X. Marker
             lives in localStorage; this callback is a no-op (the
             bar's own state hides the preview immediately). */
          onSkipAiDraft={() => setAiDismissBump((n) => n + 1)}
        />
      </div>

      {/* v36 — Mobile reply/forward sheet host. Identical chrome to
         ComposeSheetMobile (X / title-pill / Send + floating Pen pill);
         the InlineReplyBar runs chromeless + initialExpanded inside,
         exactly like Compose.tsx does for compose. The `mode` prop only
         swaps the title text ("Reply" / "Forward"); the rest of the
         chrome recipe (glass, blur, motion) is shared. */}
      <AnimatePresence>
        {mobileSheetActive && (
          <ComposeSheetMobile
            key="reply-forward-sheet"
            mode="reply"
            subject=""
            onClose={() => {
              setReplySheetOpen(false);
              setForwardContext(null);
            }}
            sendRef={replySheetRefs.sendRef}
            formatRef={replySheetRefs.formatRef}
            fileRef={replySheetRefs.fileRef}
            closeRef={replySheetRefs.closeRef}
            hasContentRef={replySheetRefs.hasContentRef}
            saveDraftRef={replySheetRefs.saveDraftRef}
            discardRef={replySheetRefs.discardRef}
            activeFormats={replyActiveFormats}
          >
            <InlineReplyBar
              chromeless
              initialExpanded
              aiDraft={aiDraft}
              recipientName={mail.from.name}
              recipientEmail={mail.from.email}
              mailId={mail.id}
              forwardContext={forwardContext}
              onForwardCancel={() => {
                setForwardContext(null);
                setReplySheetOpen(false);
              }}
              onSend={(payload) => {
                onSendInline(payload);
                setReplySheetOpen(false);
              }}
              onSubjectChange={setLiveReplySubject}
              onActiveFormatsChange={setReplyActiveFormats}
              onComposeClose={() => {
                setReplySheetOpen(false);
                setForwardContext(null);
              }}
              externalSendTrigger={replySheetRefs.sendRef}
              externalFormatTrigger={replySheetRefs.formatRef}
              externalFileTrigger={replySheetRefs.fileRef}
              externalRequestCloseTrigger={replySheetRefs.closeRef}
              externalHasContentTrigger={replySheetRefs.hasContentRef}
              externalSaveDraftTrigger={replySheetRefs.saveDraftRef}
              externalDiscardTrigger={replySheetRefs.discardRef}
            />
          </ComposeSheetMobile>
        )}
      </AnimatePresence>
      </div>
      {/* /CENTER column */}

      {/* RIGHT column — Lead context panel (desktop). A real in-flow column
         that animates its width + opacity with APPLE_SPRING so the center
         conversation reflows smoothly beside it. The inbox list (column 1)
         shrinks to a comfortable minimum at the same time (see App.tsx), so
         all three columns stay readable. Hidden below lg; mobile uses the
         slide-over sheet below. */}
      {hasLeadContext && (
        <AnimatePresence initial={false}>
          {leadPanelOpen && (
            <motion.aside
              key="lead-panel-desktop"
              data-testid="lead-panel-desktop"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 340, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={APPLE_SPRING}
              className="hidden md:block h-full min-h-0 shrink-0 overflow-hidden border-l border-foreground/[0.06] dark:border-white/[0.06]"
            >
              <div style={{ width: 340 }} className="h-full min-h-0">
                <LeadContextPanel mail={mail} />
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      )}

      {/* PHONE (<768) full-screen push — no overlay, no scrim. The lead
         context takes the whole screen (the conversation is too narrow for a
         side panel here) and slides in from the right like opening a detail
         view. A back arrow returns to the conversation. Mirrors the
         inbox→conversation push so it feels native, not like a modal. */}
      {hasLeadContext && (
        <AnimatePresence>
          {leadPanelOpen && (
            <motion.div
              key="lead-panel-mobile"
              data-testid="lead-panel-mobile"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={APPLE_SPRING}
              className="md:hidden absolute inset-0 z-[60] flex flex-col bg-background"
            >
              {/* v-mobile-leadpanel-chromereuse — No hand-rolled header here.
                  We REUSE the shared mobile top-chrome system + ActionPill via
                  LeadPanelChromeSlot (registered at priority 200 so it wins
                  over the conversation chrome while open). The panel content
                  sits directly under that floating chrome with the same
                  top spacing the other mobile screens use
                  (safe-area-inset-top + 80px). */}
              {/* v-fix-no-dense-bar — The wrapper no longer pads the content
                  down by 80px. That padding created a DENSE bg-background slab
                  in the top zone where the floating back-pill + "Lead context"
                  title sit, so it read as a solid bar (not glass) with content
                  hidden beneath it — unlike every other mobile screen where
                  content scrolls to the very top behind the floating glass
                  pills. Now the scroll surface fills to the top; LeadContextPanel
                  carries the safe-area + title-zone offset INTERNALLY (mobile)
                  so content scrolls UNDER the title and the lead-tab-fade veil
                  frosts it uniformly, exactly like the inbox. */}
              <LeadPanelChromeSlot onClose={() => setLeadPanelOpen(false)} />
              <div className="flex-1 min-h-0">
                <LeadContextPanel mail={mail} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

function ThreadChromeSlot({
  name,
  avatar,
  threadCount,
  onBack,
  onDone,
  onSnooze,
  onForward,
  onIdentityClick,
  chromeHidden,
}: {
  name: string;
  avatar?: string;
  threadCount: number;
  onBack: () => void;
  onDone?: () => void;
  onSnooze?: () => void;
  onForward?: () => void;
  onIdentityClick?: () => void;
  chromeHidden?: boolean;
}) {
  const slot = useMemo(
    () => ({
      priority: 100,
      // v-mobile-leadpanel — While the full-screen mobile lead panel is open
      // it owns the whole screen (its own back button + "Lead context"
      // header). Hide this conversation top chrome so the back arrow +
      // identity pill + Done circle don't bleed THROUGH the panel (the
      // shell is position:fixed and would otherwise float above the panel).
      // Desktop is unaffected: the shell is md:hidden regardless.
      hidden: chromeHidden,
      leftSlot: (
        <ActionPill testId="button-back" label="Back" onClick={onBack}>
          <ArrowLeft size={22} strokeWidth={1.7} className="text-icon" />
        </ActionPill>
      ),
      togglePill: (
        // v-replaiy — iMessage style: avatar + naam plain (geen capsule).
        // When there is lead context, the identity is the trigger that opens
        // the full-screen lead panel on phone (tap the name). Otherwise it is
        // a plain non-interactive identity.
        onIdentityClick ? (
          <button
            type="button"
            data-testid="contact-pill"
            onClick={onIdentityClick}
            aria-label="Open lead context"
            className="inline-flex items-center gap-2 pl-1 pr-2 h-[52px] rounded-full hover-elevate active-elevate-2"
          >
            <ReplaiyAvatar name={name} src={avatar} size={32} />
            <span className="text-[14px] font-semibold tracking-[-0.005em] truncate max-w-[140px] text-foreground leading-tight">
              {name}
            </span>
            <span className="text-foreground/40 text-[12px] tabular-nums shrink-0">
              {threadCount}
            </span>
          </button>
        ) : (
          <div
            data-testid="contact-pill"
            className="inline-flex items-center gap-2 px-1 h-[52px]"
          >
            <ReplaiyAvatar name={name} src={avatar} size={32} />
            <span className="text-[14px] font-semibold tracking-[-0.005em] truncate max-w-[140px] text-foreground leading-tight">
              {name}
            </span>
            <span className="text-foreground/40 text-[12px] tabular-nums shrink-0">
              {threadCount}
            </span>
          </div>
        )
      ),
      // v30.30 — Mobile: alleen Done als prominent pill + ... overflow met
      // Snooze + Forward in een liquid-glass dropdown.
      rightSlot:
        onDone && onSnooze ? (
          <ConversationActionPillsCompact
            onDone={onDone}
            onSnooze={onSnooze}
            onForward={onForward}
          />
        ) : (
          <div style={{ width: 52, height: 52 }} aria-hidden="true" />
        ),
    }),
    [name, avatar, threadCount, onBack, onDone, onSnooze, onForward, onIdentityClick, chromeHidden],
  );
  useMobileTopChromeSlot(slot);
  return null;
}

// ─── Mobile lead-panel top chrome ─────────────────────────────────
// v-mobile-leadpanel-chromereuse — When the full-screen mobile lead panel is
// open we REUSE the exact same shared mobile top-chrome system + ActionPill as
// every other screen (ConversationDetail, CampaignDetail, MijnAi) instead of a
// hand-rolled flat-arrow header. We register a SECOND slot at a HIGHER
// priority (200) than the conversation's ThreadChromeSlot (100) so it WINS
// while the panel is open; when the panel closes this component renders only
// when leadPanelOpen is true, so its registration goes away and the normal
// conversation chrome (back + identity pill + Done) returns automatically.
//   leftSlot  = ActionPill glass back button → closes the panel.
//   togglePill = centered "Lead context" title (matches CampaignDetail title).
//   rightSlot  = empty 52×52 spacer to keep the title centered.
// Desktop is unaffected: the chrome shell is md:hidden.
function LeadPanelChromeSlot({ onClose }: { onClose: () => void }) {
  const slot = useMemo(
    () => ({
      priority: 200,
      leftSlot: (
        <ActionPill testId="lead-panel-close" label="Back to conversation" onClick={onClose}>
          <ArrowLeft size={22} strokeWidth={1.7} className="text-icon" />
        </ActionPill>
      ),
      togglePill: (
        <div className="inline-flex items-center px-1 h-[52px]">
          <span className="text-[14px] font-semibold tracking-[-0.005em] text-foreground">
            Lead context
          </span>
        </div>
      ),
      rightSlot: <div style={{ width: 52, height: 52 }} aria-hidden="true" />,
    }),
    [onClose],
  );
  useMobileTopChromeSlot(slot);
  return null;
}

function threadSpanLabel(messages: ThreadMessage[]): string {
  if (messages.length < 2) return 'just now';
  const first = new Date(messages[0].ts);
  const last = new Date(messages[messages.length - 1].ts);
  const days = Math.max(
    0,
    Math.floor(
      (+new Date(last.toDateString()) - +new Date(first.toDateString())) / 86400000
    )
  );
  if (days === 0) return 'today';
  if (days === 1) return '2 days';
  return `${days + 1} days`;
}

// Fixed-position scrubber (properly closed JSX, replaces buggy one above)
function ScrubberFixed({
  count,
  activeIndex,
  onJump,
  visible,
}: {
  count: number;
  activeIndex: number;
  onJump: (i: number) => void;
  visible: boolean;
}) {
  if (count <= 1) return null;
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, x: 6 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 6 }}
          transition={APPLE_SPRING_TIGHT}
          data-testid="thread-scrubber"
          className="fixed right-3 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-1.5 py-2.5 px-1.5 rounded-full glass-pill pointer-events-auto"
        >
          {Array.from({ length: count }).map((_, i) => {
            const active = i === activeIndex;
            return (
              <button
                key={i}
                aria-label={`Jump to message ${i + 1}`}
                onClick={() => onJump(i)}
                data-testid={`scrubber-dot-${i}`}
                className="rounded-full transition-all"
                style={{
                  width: active ? 8 : 5,
                  height: active ? 8 : 5,
                  background: active ? 'hsl(var(--foreground))' : 'hsl(var(--foreground) / 0.30)',
                }}
              />
            );
          })}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

