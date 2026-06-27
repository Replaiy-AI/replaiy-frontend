// ─────────────────────────────────────────────────────────────────
// DocsDetail (v14) — Single doc view with Tiptap editor.
//
// Top chrome: 3 loose elements on mobile (← back / title pill / ••• menu).
// Body:       DocEditor inside a max-w 720px column.
// Right rail (md+): linked items + AI summary + tags.
// Mobile:     a small ⓘ button replaces the rail and opens a bottom sheet.
// ─────────────────────────────────────────────────────────────────
import { useLocation, useParams } from 'wouter';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  MoreHorizontal,
  Share2,
  Copy as CopyIcon,
  FolderInput,
  Pin,
  Trash2,
  Info,
  X,
  Mail,
  Calendar as CalendarIcon,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMobileTopChromeSlot } from '@/components/MobileTopChrome';
import { DocEditor } from '@/components/docs/DocEditor';
import { mockDocs, docTimeAgo, type MockDoc } from '@/data/mockDocs';
import { APPLE_SPRING } from '@/lib/motion';
import type { JSONContent } from '@tiptap/react';

export function DocsDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const isNew = params.id === 'new';

  // Look up the doc (or build a blank one for /docs/new)
  const baseDoc: MockDoc | null = useMemo(() => {
    if (isNew) {
      return {
        id: 'new',
        title: 'Untitled',
        preview: '',
        content: { type: 'doc', content: [{ type: 'heading', attrs: { level: 1 }, content: [] }] },
        lastEdited: new Date().toISOString(),
        pinned: false,
        tags: [],
        linkedTo: [],
        aiSummary: 'New doc — start writing to see a summary.',
      };
    }
    return mockDocs.find((d) => d.id === params.id) ?? null;
  }, [isNew, params.id]);

  const [title, setTitle] = useState(baseDoc?.title ?? '');
  const [content, setContent] = useState<JSONContent>(
    baseDoc?.content ?? { type: 'doc', content: [{ type: 'paragraph' }] },
  );
  const [actionsOpen, setActionsOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  // Keep title in sync when navigating between docs
  useEffect(() => {
    if (baseDoc) {
      setTitle(baseDoc.title);
      setContent(baseDoc.content);
    }
  }, [baseDoc?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stable callbacks so the chrome slot useMemo doesn't recompute on every render
  const onBack = useCallback(() => navigate('/docs'), [navigate]);
  const onMore = useCallback(() => setActionsOpen(true), []);
  const onInfo = useCallback(() => setInfoOpen(true), []);

  // Register chrome slot — back arrow / title pill / ••• overrides
  useDocChromeSlot({ title, onBack, onMore, onInfo });

  if (!baseDoc) {
    return (
      <div className="flex-1 flex items-center justify-center text-foreground/55 text-[14px]">
        Doc not found
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-0 w-full stilt-doc-surface">
      {/* Editor column */}
      <div className="flex-1 min-w-0 overflow-y-auto no-scrollbar pt-[86px] md:pt-[64px] pb-44 md:pb-12 px-5 md:px-10">
        <div className="max-w-[720px] mx-auto w-full" data-testid="doc-detail-column">
          {/* Title — editable inline */}
          <input
            data-testid="doc-title-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Untitled"
            className="w-full bg-transparent outline-none text-[34px] md:text-[40px] font-semibold tracking-[-0.024em] leading-[1.1] mb-5 md:mb-7 placeholder:text-foreground/30"
          />

          <DocEditor initialContent={content} onChange={setContent} />
        </div>
      </div>

      {/* Right rail (md+) */}
      <aside
        className="hidden md:flex flex-col w-[280px] shrink-0 border-l border-foreground/8 pt-[64px] pb-12 px-4 gap-4 overflow-y-auto no-scrollbar"
        data-testid="doc-right-rail"
      >
        <RailContent doc={baseDoc} />
      </aside>

      {/* Mobile-only ⓘ info button — sits below the top chrome */}
      <button
        data-testid="doc-info-button"
        onClick={() => setInfoOpen(true)}
        className="md:hidden fixed top-[80px] right-4 z-30 glass-pill h-9 w-9 rounded-full flex items-center justify-center active-elevate-2 text-icon"
        aria-label="Doc info"
      >
        <Info size={15} strokeWidth={1.6} />
      </button>

      {/* Actions sheet — Share / Duplicate / Move to / Pin / Delete */}
      <AnimatePresence>
        {actionsOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActionsOpen(false)}
              className="fixed inset-0 z-40 bg-black/35 backdrop-blur-[2px]"
            />
            <motion.div
              data-testid="doc-actions-sheet"
              initial={{ y: -10, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -10, opacity: 0, scale: 0.96 }}
              transition={APPLE_SPRING}
              style={{ transformOrigin: 'top right' }}
              className="fixed right-3 top-16 z-50 w-[240px] glass-strong rounded-3xl p-2 shadow-2xl"
            >
              <div className="px-3 pt-1.5 pb-2 flex items-center justify-between">
                <span className="text-[11.5px] uppercase tracking-wider font-semibold text-foreground/55">
                  Doc actions
                </span>
                <button
                  onClick={() => setActionsOpen(false)}
                  aria-label="Close"
                  className="h-6 w-6 rounded-full flex items-center justify-center text-icon hover-elevate active-elevate-2"
                >
                  <X size={14} strokeWidth={1.8} />
                </button>
              </div>
              <div className="flex flex-col gap-0.5">
                <ActionRow icon={Share2} label="Share" onClick={() => setActionsOpen(false)} />
                <ActionRow icon={CopyIcon} label="Duplicate" onClick={() => setActionsOpen(false)} />
                <ActionRow icon={FolderInput} label="Move to…" onClick={() => setActionsOpen(false)} />
                <ActionRow icon={Pin} label={baseDoc.pinned ? 'Unpin' : 'Pin'} onClick={() => setActionsOpen(false)} />
                <ActionRow
                  icon={Trash2}
                  label="Delete"
                  destructive
                  onClick={() => {
                    setActionsOpen(false);
                    navigate('/docs');
                  }}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Mobile info bottom-sheet */}
      <AnimatePresence>
        {infoOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setInfoOpen(false)}
              className="md:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
            />
            <motion.div
              data-testid="doc-info-sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={APPLE_SPRING}
              className="md:hidden fixed inset-x-2 bottom-2 z-50 glass-strong rounded-3xl p-4 shadow-2xl max-h-[70vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11.5px] uppercase tracking-wider font-semibold text-foreground/55">
                  Doc info
                </span>
                <button
                  onClick={() => setInfoOpen(false)}
                  aria-label="Close"
                  className="h-7 w-7 rounded-full flex items-center justify-center text-icon hover-elevate active-elevate-2"
                >
                  <X size={14} strokeWidth={1.8} />
                </button>
              </div>
              <RailContent doc={baseDoc} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ───────────────────────── Chrome slot ─────────────────────────
function useDocChromeSlot({
  title,
  onBack,
  onMore,
  onInfo,
}: {
  title: string;
  onBack: () => void;
  onMore: () => void;
  onInfo: () => void;
}) {
  const slot = useMemo(
    () => ({
      priority: 100,
      hidden: false,
      leftSlot: (
        <button
          data-testid="doc-back"
          onClick={onBack}
          className="glass-pill h-[52px] w-[52px] rounded-full flex items-center justify-center active-elevate-2 shrink-0"
          aria-label="Back to docs"
        >
          <ArrowLeft size={19} strokeWidth={1.75} className="text-icon" />
        </button>
      ),
      togglePill: (
        <div
          className="glass-pill pill inline-flex items-center gap-2 px-4 py-[4px] h-[52px] max-w-[200px]"
          data-testid="doc-title-pill"
        >
          <span className="text-[14px] font-semibold tracking-[-0.005em] truncate text-foreground">
            {title || 'Untitled'}
          </span>
        </div>
      ),
      rightSlot: (
        <button
          data-testid="doc-more"
          onClick={onMore}
          className="glass-pill h-[52px] w-[52px] rounded-full flex items-center justify-center active-elevate-2 shrink-0"
          aria-label="Doc actions"
        >
          <MoreHorizontal size={19} strokeWidth={1.75} className="text-icon" />
        </button>
      ),
    }),
    [title, onBack, onMore],
  );
  // Keep onInfo referenced even though it's accessed by the floating ⓘ button
  void onInfo;
  useMobileTopChromeSlot(slot);
}

// ───────────────────────── Right rail content ─────────────────────────
function RailContent({ doc }: { doc: MockDoc }) {
  return (
    <>
      <RailSection label="Last edited">
        <div className="text-[13.5px] text-foreground/85">{docTimeAgo(doc.lastEdited)}</div>
      </RailSection>

      <RailSection label="Sharing">
        <div className="text-[13.5px] text-foreground/85">Only you</div>
      </RailSection>

      {doc.linkedTo.length > 0 && (
        <RailSection label="Linked items">
          <div className="flex flex-col gap-1.5">
            {doc.linkedTo.map((l, i) => (
              <div
                key={i}
                className="glass rounded-xl px-2.5 py-2 flex items-center gap-2 text-[12.5px]"
              >
                <span className="h-6 w-6 rounded-full flex items-center justify-center bg-foreground/[0.06] dark:bg-white/[0.06] text-foreground/75 shrink-0">
                  {l.type === 'event' ? (
                    <CalendarIcon size={12} strokeWidth={1.7} />
                  ) : (
                    <Mail size={12} strokeWidth={1.7} />
                  )}
                </span>
                <span className="truncate text-foreground/85">{l.label}</span>
              </div>
            ))}
          </div>
        </RailSection>
      )}

      <RailSection
        label={
          <span className="inline-flex items-center gap-1.5">
            <Sparkles size={11} strokeWidth={1.8} className="text-foreground/70" />
            AI summary
          </span>
        }
      >
        <div className="glass rounded-xl px-3 py-2.5 text-[12.5px] leading-[1.5] text-foreground/85">
          {doc.aiSummary}
        </div>
      </RailSection>

      {doc.tags.length > 0 && (
        <RailSection label="Tags">
          <div className="flex flex-wrap gap-1.5">
            {doc.tags.map((t) => (
              <span
                key={t}
                className="pill glass-pill px-2.5 py-0.5 text-[11.5px] font-medium text-foreground/75"
              >
                {t}
              </span>
            ))}
          </div>
        </RailSection>
      )}
    </>
  );
}

function RailSection({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="px-0.5 mb-1.5 text-[10.5px] uppercase tracking-wider font-semibold text-foreground/55">
        {label}
      </div>
      {children}
    </div>
  );
}

function ActionRow({
  icon: Icon,
  label,
  onClick,
  destructive,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 px-3 py-2.5 rounded-2xl text-[14px] font-medium hover-elevate active-elevate-2 text-left"
      style={destructive ? { color: '#FF453A' } : undefined}
    >
      <Icon size={17} strokeWidth={1.6} className="shrink-0" />
      <span>{label}</span>
    </button>
  );
}
