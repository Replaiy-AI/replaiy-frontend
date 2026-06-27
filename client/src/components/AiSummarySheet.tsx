// ─────────────────────────────────────────────────────────────────
// v15 — AI Summary sheet (was bottom-only; now responsive).
//
// Uses ResponsiveSheet so it renders as a right-side slide-in panel
// on desktop (≥1024px) and a bottom sheet on mobile/tablet (<1024).
// Content and dismiss semantics are unchanged.
// ─────────────────────────────────────────────────────────────────
import { Sparkles, X, ArrowRight } from 'lucide-react';
import { ResponsiveSheet } from './ResponsiveSheet';

interface AiSummarySheetProps {
  open: boolean;
  onClose: () => void;
  summary: string;
  pendingActions?: string[];
}

export function AiSummarySheet({ open, onClose, summary, pendingActions }: AiSummarySheetProps) {
  return (
    <ResponsiveSheet
      open={open}
      onClose={onClose}
      desktopWidth="sm"
      testId="ai-summary-sheet"
    >
      {/* Section header row */}
      <div className="px-5 pt-2 pb-3 flex items-center justify-between shrink-0">
        <div className="inline-flex items-center gap-1.5">
          <Sparkles size={12} strokeWidth={2.2} className="text-icon-muted" />
          <span
            className="text-[10.5px] uppercase tracking-[0.12em] font-semibold text-foreground/70"
            data-testid="ai-summary-section-conversation"
          >
            Conversation
          </span>
        </div>
        <button
          onClick={onClose}
          aria-label="Close summary"
          data-testid="button-close-summary"
          className="h-8 w-8 rounded-full flex items-center justify-center text-icon hover-elevate active-elevate-2"
        >
          <X size={16} strokeWidth={1.8} />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-5 pb-6">
        <p
          className="text-[15.5px] leading-[1.55] text-foreground/90 m-0"
          data-testid="ai-summary-text"
        >
          {summary}
        </p>

        {pendingActions && pendingActions.length > 0 && (
          <>
            <div className="my-5 h-px bg-foreground/[0.08] dark:bg-white/[0.08]" />

            <div className="inline-flex items-center gap-1.5 mb-2.5">
              <Sparkles size={12} strokeWidth={2.2} className="text-icon-muted" />
              <span
                className="text-[10.5px] uppercase tracking-[0.12em] font-semibold text-foreground/70"
                data-testid="ai-summary-section-pending"
              >
                Pending actions
              </span>
            </div>
            <ul className="flex flex-col gap-2 m-0 p-0 list-none">
              {pendingActions.map((action, i) => (
                <li
                  key={i}
                  data-testid={`pending-action-${i}`}
                  className="flex items-start gap-2.5 text-[14.5px] leading-[1.5] text-foreground/85"
                >
                  <span className="mt-[9px] h-1.5 w-1.5 rounded-full shrink-0" style={{ background: 'var(--ai-accent, #13A89E)' }} />
                  <span>{action}</span>
                </li>
              ))}
            </ul>
          </>
        )}

        {/* Hint button */}
        <button
          type="button"
          onClick={onClose}
          data-testid="button-ask-ai"
          className="mt-6 w-full glass-pill pill h-11 flex items-center justify-center gap-1.5 text-[13.5px] font-semibold text-foreground/70 hover-elevate active-elevate-2"
        >
          Ask AI about this thread
          <ArrowRight size={14} strokeWidth={2} />
        </button>
      </div>
    </ResponsiveSheet>
  );
}
