// ─────────────────────────────────────────────────────────────────
// Docs list (v14) — Stilt's 3rd primary surface.
//
// Layout:
//   • Reuses MobileTopChromeShell (••• / center toggle / search) via
//     useMobileTopChromeSlot — same pattern as Inbox + Calendar.
//   • Center toggle: GlassSegmentedToggle (Smart / All).
//   • Body renders Smart sections (Recent / Linked to today / AI suggestions /
//     Pinned) or a chronological All list.
//   • Each row: glass doc-icon circle + title + preview + time.
//
// On tablet/desktop, the same content renders inside the right pane's list
// column. The desktop rail (DesktopRail) gets a Docs item via PRIMARY_NAV.
// ─────────────────────────────────────────────────────────────────
import { useLocation } from 'wouter';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Sparkles,
  List as ListIcon,
  FileText,
  Mail,
  Calendar as CalendarIcon,
  Pin,
  ChevronRight,
} from 'lucide-react';
import {
  motion,
  animate,
  useMotionValue,
  useMotionValueEvent,
  type MotionValue,
} from 'framer-motion';
import { GlassSegmentedToggle } from '@/components/GlassSegmentedToggle';
import { useMobileTopChromeSlot } from '@/components/MobileTopChrome';
import { useStilt } from '@/state/StiltContext';
import { StiltAvatar } from '@/components/Avatar';
import VadikGlass from '@/components/VadikGlass';

function MobileDocsProfileAvatar() {
  const { setProfileMenuOpen } = useStilt();
  // v30.9 — VadikGlass circle (zelfde recipe als overige avatars/circles).
  return (
    <VadikGlass
      width={52}
      height={52}
      shape="circle"
      data-testid="mobile-profile-avatar-docs"
      aria-label="Profile"
      onClick={() => setProfileMenuOpen(true)}
      wrapperStyle={{ overflow: 'hidden' }}
    >
      <StiltAvatar name="Simon Garner" size={40} />
    </VadikGlass>
  );
}
import { mockDocs, docTimeAgo, docsSuggestions, type MockDoc } from '@/data/mockDocs';
import { APPLE_SPRING } from '@/lib/motion';

// Mobile detection — matches the breakpoint used by Inbox / Calendar carousels.
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 768 : false,
  );
  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return isMobile;
}

type DocsView = 'smart' | 'all';

// Top toggle slot — reuses GlassSegmentedToggle. Accepts an optional
// externalProgress MotionValue (0..1) so the indicator follows the carousel
// drag live — same pattern as Inbox + Calendar top toggles.
function DocsToggle({
  view,
  setView,
  swipeProgress,
}: {
  view: DocsView;
  setView: (v: DocsView) => void;
  swipeProgress?: MotionValue<number>;
}) {
  return (
    <GlassSegmentedToggle
      testId="docs-toggle"
      pad={4}
      indicatorStyle="glass-rich"
      value={view}
      onChange={setView}
      externalProgress={swipeProgress}
      externalProgressDirection={view === 'smart' ? 'self-to-next' : 'self-to-prev'}
      segments={[
        {
          key: 'smart',
          icon: Sparkles,
          label: 'Smart',
          activeWidth: 96,
          inactiveWidth: 52,
          aiTint: true,
        },
        {
          key: 'all',
          icon: ListIcon,
          label: 'All',
          activeWidth: 78,
          inactiveWidth: 52,
        },
      ]}
    />
  );
}

export function DocsList() {
  const [, navigate] = useLocation();
  const {
    query,
    setQuery,
    smartMode,
    setSmartMode,
    docsView: globalDocsView,
    setDocsView: setGlobalDocsView,
  } = useStilt();
  // v15.4 — derive Docs local view ('smart' | 'all') from global smartMode.
  // The view-selector pill drives the docsView (recent/pinned/shared/etc.)
  // independently; the smart/all toggle is now the global Smart pill.
  const view: DocsView = smartMode ? 'smart' : 'all';
  const setView = (v: DocsView) => setSmartMode(v === 'smart');
  const isMobile = useIsMobile();

  // Swipe progress (0..1 toward the OTHER mode) — drives the top toggle
  // indicator while the carousel is being dragged. Same pattern as Inbox.
  const swipeProgress = useMotionValue(0);

  // v15.4 — mobile chrome: view-selector + Smart pill (CENTER pair),
  // avatar (LEFT), default search (RIGHT).
  // v30.30 — Mobile Docs view-dropdown verwijderd. View-switching
  // via Universal Search modal.
  const togglePill = useMemo(() => null, []);
  const leftSlot = useMemo(() => <MobileDocsProfileAvatar />, []);
  const slot = useMemo(
    () => ({
      togglePill,
      leftSlot,
      searchPlaceholder: 'Search docs…',
      searchQuery: query,
      setSearchQuery: setQuery,
    }),
    [togglePill, leftSlot, query, setQuery],
  );
  useMobileTopChromeSlot(slot);

  // Apply search filter across all sections
  const filterByQuery = (docs: MockDoc[]) => {
    const q = query.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.preview.toLowerCase().includes(q) ||
        d.tags.some((t) => t.toLowerCase().includes(q)),
    );
  };

  // Smart sections
  const recent = filterByQuery(
    [...mockDocs].sort((a, b) => +new Date(b.lastEdited) - +new Date(a.lastEdited)).slice(0, 4),
  );
  const linkedToday = filterByQuery(mockDocs.filter((d) => d.linkedTo.length > 0));
  const pinned = filterByQuery(mockDocs.filter((d) => d.pinned));
  const all = filterByQuery(
    [...mockDocs].sort((a, b) => +new Date(b.lastEdited) - +new Date(a.lastEdited)),
  );

  return (
    <div className="relative flex flex-col h-full min-h-0">
      {/* Tablet/desktop top chrome — same loose-element pattern as mobile.
          Hidden on mobile because MobileTopChromeShell takes over there. */}
      {/* v15.5 — Smart-toggle has moved into the floating sidebar.
          Column 2 now only carries the view-selector pill on the left. */}
      {/* v30.30 — Desktop Docs view-selector dropdown verwijderd.
          View-switching via Universal Search modal. */}

      {isMobile ? (
        <DocsMobileCarousel
          view={view}
          setView={setView}
          swipeProgress={swipeProgress}
          recent={recent}
          linkedToday={linkedToday}
          pinned={pinned}
          all={all}
          navigate={navigate}
        />
      ) : (
        <div className="flex-1 overflow-y-auto no-scrollbar px-3 lg:px-4 pt-[84px] pb-44 md:pb-6">
          {view === 'smart' ? (
            <SmartView
              recent={recent}
              linkedToday={linkedToday}
              pinned={pinned}
              onOpen={(id) => navigate(`/docs/${id}`)}
              onAcceptSuggestion={(s) => {
                if (s.targetDocId) navigate(`/docs/${s.targetDocId}`);
              }}
            />
          ) : (
            <AllView docs={all} onOpen={(id) => navigate(`/docs/${id}`)} />
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Mobile paged carousel — Smart + All side-by-side.
// Container slides on horizontal drag; updates view at threshold.
// Drives `swipeProgress` motion value so the top toggle morphs in sync.
// Uses dragDirectionLock so vertical scrolling still works.
// Mirrors the InboxList / Calendar carousel pattern exactly.
// ─────────────────────────────────────────────────────────────────
function DocsMobileCarousel({
  view,
  setView,
  swipeProgress,
  recent,
  linkedToday,
  pinned,
  all,
  navigate,
}: {
  view: DocsView;
  setView: (v: DocsView) => void;
  swipeProgress: MotionValue<number>;
  recent: MockDoc[];
  linkedToday: MockDoc[];
  pinned: MockDoc[];
  all: MockDoc[];
  navigate: (path: string) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const widthRef = useRef<number>(typeof window !== 'undefined' ? window.innerWidth : 375);

  // Smart is LEFT page (x = 0), All is RIGHT page (x = -w).
  // Sync x with view when it changes outside drag (e.g. via tap on toggle).
  useEffect(() => {
    const target = view === 'smart' ? 0 : -widthRef.current;
    animate(x, target, APPLE_SPRING);
  }, [view, x]);

  useEffect(() => {
    const update = () => {
      widthRef.current = trackRef.current?.parentElement?.clientWidth || window.innerWidth;
      // Re-snap to current view to keep alignment after rotation/resize.
      x.set(view === 'smart' ? 0 : -widthRef.current);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Map x → swipeProgress (0 = on current mode, 1 = on other mode).
  useMotionValueEvent(x, 'change', (latest) => {
    const w = widthRef.current || 1;
    const restX = view === 'smart' ? 0 : -w;
    const delta = Math.abs(latest - restX) / w;
    swipeProgress.set(Math.min(1, Math.max(0, delta)));
  });

  const onDragEnd = (
    _: unknown,
    info: { offset: { x: number; y: number }; velocity: { x: number } },
  ) => {
    const w = widthRef.current || 1;
    const thresholdPx = w * 0.3;
    const velocity = info.velocity.x;
    const offset = info.offset.x;

    let next: DocsView = view;
    if (view === 'smart') {
      if (offset < -thresholdPx || velocity < -500) next = 'all';
    } else {
      if (offset > thresholdPx || velocity > 500) next = 'smart';
    }

    if (next !== view) {
      setView(next);
      animate(x, next === 'smart' ? 0 : -w, APPLE_SPRING);
    } else {
      animate(x, view === 'smart' ? 0 : -w, APPLE_SPRING);
    }
  };

  return (
    <div
      ref={trackRef}
      className="flex-1 overflow-hidden relative"
      data-testid="docs-mobile-carousel"
    >
      <motion.div
        className="flex h-full"
        style={{ x, width: '200%' }}
        drag="x"
        dragDirectionLock
        dragElastic={0.15}
        dragConstraints={{
          left: -(widthRef.current || 375),
          right: 0,
        }}
        onDragEnd={onDragEnd}
      >
        {/* Smart Docs page — LEFT (primary) */}
        <div
          className="h-full overflow-y-auto no-scrollbar px-3 pt-[84px] pb-44"
          style={{ width: '50%', touchAction: 'pan-y' }}
        >
          <SmartView
            recent={recent}
            linkedToday={linkedToday}
            pinned={pinned}
            onOpen={(id) => navigate(`/docs/${id}`)}
            onAcceptSuggestion={(s) => {
              if (s.targetDocId) navigate(`/docs/${s.targetDocId}`);
            }}
          />
        </div>
        {/* All Docs page — RIGHT */}
        <div
          className="h-full overflow-y-auto no-scrollbar px-3 pt-[84px] pb-44"
          style={{ width: '50%', touchAction: 'pan-y' }}
        >
          <AllView docs={all} onOpen={(id) => navigate(`/docs/${id}`)} />
        </div>
      </motion.div>
    </div>
  );
}

// ───────────────────────── Smart view ─────────────────────────
function SmartView({
  recent,
  linkedToday,
  pinned,
  onOpen,
  onAcceptSuggestion,
}: {
  recent: MockDoc[];
  linkedToday: MockDoc[];
  pinned: MockDoc[];
  onOpen: (id: string) => void;
  onAcceptSuggestion: (s: (typeof docsSuggestions)[number]) => void;
}) {
  return (
    <div className="flex flex-col gap-5 max-w-[760px] mx-auto w-full">
      {recent.length > 0 && (
        <Section label="Recent" testId="docs-section-recent">
          <DocsGroup docs={recent} onOpen={onOpen} />
        </Section>
      )}

      {linkedToday.length > 0 && (
        <Section label="Linked to today" testId="docs-section-linked">
          <DocsGroup docs={linkedToday} onOpen={onOpen} showLinkBadge />
        </Section>
      )}

      {docsSuggestions.length > 0 && (
        <Section label="AI suggestions" testId="docs-section-ai">
          <div className="flex flex-col gap-2">
            {docsSuggestions.map((s) => (
              <SuggestionCard key={s.id} suggestion={s} onAccept={() => onAcceptSuggestion(s)} />
            ))}
          </div>
        </Section>
      )}

      {pinned.length > 0 && (
        <Section label="Pinned" testId="docs-section-pinned">
          <DocsGroup docs={pinned} onOpen={onOpen} showPinBadge />
        </Section>
      )}
    </div>
  );
}

function AllView({ docs, onOpen }: { docs: MockDoc[]; onOpen: (id: string) => void }) {
  return (
    <div className="flex flex-col gap-5 max-w-[760px] mx-auto w-full" data-testid="docs-all-view">
      <Section label={`All docs · ${docs.length}`} testId="docs-section-all">
        <DocsGroup docs={docs} onOpen={onOpen} />
      </Section>
    </div>
  );
}

// Section header
function Section({
  label,
  testId,
  children,
}: {
  label: string;
  testId?: string;
  children: React.ReactNode;
}) {
  return (
    <section data-testid={testId}>
      <div className="px-1.5 mb-2 text-[11.5px] uppercase tracking-wider font-semibold text-foreground/55">
        {label}
      </div>
      {children}
    </section>
  );
}

// Group of doc rows wrapped in a single glass card
function DocsGroup({
  docs,
  onOpen,
  showLinkBadge,
  showPinBadge,
}: {
  docs: MockDoc[];
  onOpen: (id: string) => void;
  showLinkBadge?: boolean;
  showPinBadge?: boolean;
}) {
  return (
    <div className="glass rounded-3xl overflow-hidden">
      {docs.map((d, i) => (
        <div key={d.id}>
          {i > 0 && <div className="ml-[64px] h-px bg-foreground/[0.06] dark:bg-white/[0.06]" />}
          <DocRow doc={d} onOpen={onOpen} showLinkBadge={showLinkBadge} showPinBadge={showPinBadge} />
        </div>
      ))}
    </div>
  );
}

function DocRow({
  doc,
  onOpen,
  showLinkBadge,
  showPinBadge,
}: {
  doc: MockDoc;
  onOpen: (id: string) => void;
  showLinkBadge?: boolean;
  showPinBadge?: boolean;
}) {
  return (
    <button
      onClick={() => onOpen(doc.id)}
      data-testid={`doc-row-${doc.id}`}
      className="w-full px-4 py-3 flex items-start gap-3 text-left hover-elevate active-elevate-2"
    >
      <div className="glass-pill h-9 w-9 rounded-full flex items-center justify-center shrink-0 text-icon">
        <FileText size={15} strokeWidth={1.6} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-semibold text-[14.5px] tracking-[-0.005em] truncate flex items-center gap-1.5">
            {doc.title}
            {showPinBadge && doc.pinned && (
              <Pin size={11} strokeWidth={2} className="text-foreground/45 shrink-0" />
            )}
          </span>
          <span className="text-[12px] text-foreground/55 shrink-0">
            {docTimeAgo(doc.lastEdited)}
          </span>
        </div>
        <div className="text-[13px] text-foreground/65 truncate mt-0.5">{doc.preview}</div>
        {showLinkBadge && doc.linkedTo.length > 0 && (
          <div className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-foreground/55">
            {doc.linkedTo[0].type === 'event' ? (
              <CalendarIcon size={11} strokeWidth={1.8} />
            ) : (
              <Mail size={11} strokeWidth={1.8} />
            )}
            <span className="truncate">
              Linked to {doc.linkedTo[0].label}
            </span>
          </div>
        )}
      </div>
    </button>
  );
}

// AI suggestion card
function SuggestionCard({
  suggestion,
  onAccept,
}: {
  suggestion: (typeof docsSuggestions)[number];
  onAccept: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={APPLE_SPRING}
      className="glass rounded-2xl px-3.5 py-3 flex items-start gap-3"
      data-testid={`docs-suggestion-${suggestion.id}`}
    >
      <div
        className="h-7 w-7 rounded-full flex items-center justify-center shrink-0"
        style={{ background: 'rgba(167, 139, 250, 0.16)' }}
      >
        <Sparkles size={13} strokeWidth={1.8} className="text-icon-muted" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13.5px] leading-[1.45] text-foreground/85">{suggestion.reason}</p>
      </div>
      <button
        onClick={onAccept}
        className="pill glass-strong px-3 py-1 text-[12.5px] font-semibold shrink-0 hover-elevate active-elevate-2 flex items-center gap-1"
        data-testid={`docs-suggestion-action-${suggestion.id}`}
      >
        {suggestion.cta}
        <ChevronRight size={11} strokeWidth={2} />
      </button>
    </motion.div>
  );
}
