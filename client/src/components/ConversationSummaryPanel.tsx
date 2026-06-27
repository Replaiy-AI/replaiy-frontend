// v30.32 — ConversationSummaryPanel als DELTA-BRIEFING voor lange threads.
//
// Conceptueel: dit panel is GEEN AI-recap van de inhoud (die info zit
// al in de bubbles eronder, en de inbox heeft al gefilterd op "moet je
// hier wat mee"). Dit panel beantwoordt één vraag:
//
//     "Waar zijn we gebleven en wat staat er open?"
//
// Zinvol bij lange threads (≥3 messages) en/of threads waar je een
// tijd niet bent geweest — niet bij single-message conversations.
//
// Layout (V1 uit mockups):
//   1. Hero "where we left off" box (teal accent) — 1-2 zin status
//   2. "Open" list — wie wacht op wat, who-needs-to-do-what
//   3. "Key facts" chips — cijfers/deadlines die je nodig hebt
//   4. Footer actions — Draft reply / Schedule / Snooze
//
// Geen "Ask AI" button meer (functieloos). Geen abstracte "Pending
// actions" — vervangen door concrete "You → / Other → " open items.
import { Sparkles } from 'lucide-react';
import type { Conversation } from '@/data/mockConversations';

// v30.33 — EXACTE editor glass recipe (1:1 copy van glassSurfaceStyle
// uit InlineReplyBar.tsx) + AI teal gloed onderlangs (zelfde recipe als
// de generated-draft state van de editor). Panel = AI-context, dus toont
// altijd de teal glow zoals de editor doet wanneer er een draft is.
function summaryPanelGlassStyle(): React.CSSProperties {
  const baseBackground =
    'linear-gradient(180deg, color-mix(in srgb, var(--vadik-light, #fff) calc(var(--vadik-reflex-light, 1) * 55%), transparent) 0%, color-mix(in srgb, var(--vadik-light, #fff) calc(var(--vadik-reflex-light, 1) * 40%), transparent) 45%, color-mix(in srgb, var(--vadik-light, #fff) calc(var(--vadik-reflex-light, 1) * 30%), transparent) 78%, color-mix(in srgb, var(--vadik-light, #fff) calc(var(--vadik-reflex-light, 1) * 22%), transparent) 100%)';
  // Identiek aan de aiTint in InlineReplyBar (hasAiDraft branch).
  const aiGlow =
    'linear-gradient(180deg, transparent 30%, color-mix(in srgb, var(--ai-accent, #13A89E) var(--ai-glow-strength, 9%), transparent) 100%)';
  return {
    background: `${baseBackground}, ${aiGlow}`,
    backdropFilter: 'blur(20px) saturate(150%)',
    WebkitBackdropFilter: 'blur(20px) saturate(150%)',
    borderRadius: 24,
    boxShadow:
      'inset 0 0 0 1px color-mix(in srgb, var(--vadik-light, #fff) calc(var(--vadik-reflex-light, 1) * 50%), transparent), inset 1.8px 3px 0 -2px color-mix(in srgb, var(--vadik-light, #fff) calc(var(--vadik-reflex-light, 1) * 80%), transparent), inset -2px -2px 0 -2px color-mix(in srgb, var(--vadik-light, #fff) calc(var(--vadik-reflex-light, 1) * 60%), transparent), 0 1px 5px 0 color-mix(in srgb, var(--vadik-dark, #000) calc(var(--vadik-reflex-dark, 1) * 6%), transparent), 0 12px 32px 0 color-mix(in srgb, var(--vadik-dark, #000) calc(var(--vadik-reflex-dark, 1) * 12%), transparent)',
    transition: 'all 220ms cubic-bezier(0.32, 0.72, 0, 1)',
  };
}

interface ConversationSummaryPanelProps {
  mail: Conversation;
  /** Optional close button (mobile bottom-sheet + desktop dismiss). */
  onClose?: () => void;
  /** When true, render without outer card padding (caller controls). */
  bare?: boolean;
  /** Action handlers — caller wires these into the mail-detail context. */
  onDraftReply?: () => void;
  onScheduleEvent?: () => void;
  onSnooze?: () => void;
}

/**
 * Returns true if the mail has enough context to warrant a delta-briefing.
 * Single messages or trivial 2-message threads = no panel value.
 */
export function hasSummaryPanelValue(mail: Conversation): boolean {
  if (!mail.isThread) return false;
  const msgCount = mail.messages?.length ?? 0;
  if (msgCount < 3) return false;
  // We need at least a delta sentence to render anything useful.
  return !!(mail.threadDelta || mail.threadAiSummary);
}

export function ConversationSummaryPanel({
  mail,
  onClose,
  bare,
  onDraftReply,
  onScheduleEvent,
  onSnooze,
}: ConversationSummaryPanelProps) {
  // Fall back to threadAiSummary if no specific delta is set (keeps
  // backward-compat with threads that haven't been enriched yet).
  const delta = mail.threadDelta || mail.threadAiSummary;
  const openItems = mail.threadOpenItems || [];
  const keyFacts = mail.threadKeyFacts || [];

  const lastMsgTs = mail.messages?.[mail.messages.length - 1]?.ts ?? mail.ts;
  const lastSeenLabel = formatLastSeen(lastMsgTs);

  return (
    <div
      className={bare ? '' : 'px-5 pt-4 pb-4 relative'}
      style={bare ? undefined : summaryPanelGlassStyle()}
      data-testid="mail-summary-panel"
    >
      {/* v30.32 — Geen X-knop meer. Klik buiten de panel (backdrop in
         caller) sluit het paneel. */}

      {/* v30.33 — Delta met Lucide Sparkles prefix (EXACTE icon van de
         "Draft generated" indicator in de editor). Flex-row met items-
         start zodat sparkle align't met eerste regel; mt-[3px] op icon
         voor optische centering met de cap-height van de tekst. */}
      {delta && (
        <div
          data-testid="thread-delta"
          className="flex items-start gap-2 mb-4"
        >
          <Sparkles
            className="shrink-0 mt-[4px]"
            style={{ width: 13, height: 13, color: 'var(--ai-accent, #13A89E)' }}
            strokeWidth={2}
          />
          <p className="text-[14.5px] leading-[1.5] text-foreground m-0 flex-1">
            {delta}
          </p>
        </div>
      )}

      {/* Open list — who-needs-to-do-what */}
      {openItems.length > 0 && (
        <>
          <div className="text-[11.5px] text-foreground/45 font-medium mb-2">
            Open
          </div>
          <div className="flex flex-col gap-0.5 mb-3">
            {openItems.map((item, i) => (
              <div
                key={i}
                data-testid={`thread-open-item-${i}`}
                className="flex gap-3 text-[13px] leading-[1.5] py-1"
              >
                <span className="shrink-0 min-w-[72px] text-foreground/55 font-medium">
                  {item.who}
                </span>
                <span className="flex-1 text-foreground/90">{item.what}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Key facts as monochrome chips */}
      {keyFacts.length > 0 && (
        <>
          <div className="text-[11.5px] text-foreground/45 font-medium mb-2">
            Key facts
          </div>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {keyFacts.map((fact, i) => (
              <span
                key={i}
                data-testid={`thread-fact-${i}`}
                className="inline-flex items-center text-[11.5px] text-foreground/65 bg-foreground/[0.05] dark:bg-white/[0.07] px-2.5 py-1 rounded-full tabular-nums"
              >
                {fact}
              </span>
            ))}
          </div>
        </>
      )}

      {/* v30.32 — Footer actions weg. User had aangegeven dat Draft +
         Schedule overbodig zijn omdat de reply-bar onderaan al direct
         klikbaar is en Schedule via een andere context kan. Panel is
         nu puur informatief. */}
    </div>
  );
}

function formatLastSeen(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffH = diffMs / (1000 * 60 * 60);
    if (diffH < 1) return 'just now';
    if (diffH < 24) {
      const h = Math.round(diffH);
      return `${h}h ago`;
    }
    if (diffH < 48) {
      return `Yesterday ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
    }
    return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}
