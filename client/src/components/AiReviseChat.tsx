// ─────────────────────────────────────────────────────────────────
// AiReviseChat — a wide "talk to Replaiy" panel that overlays the
// conversation so the user can have a real back-and-forth with the AI to
// reshape the current draft. Quick-adjust chips stay at the top as
// shortcuts; every turn updates the live reply-bar draft.
//
// Built entirely on the existing glass + motion primitives (no external
// chat dependency) so it matches the Persona / Knowledge / Campaign gold
// standard. The actual rewrite is mocked here (frontend phase); the real
// model call + the RL learning signal land in the backend phase.
// ─────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUp, X } from 'lucide-react';
import { APPLE_SPRING } from '@/lib/motion';

export interface AiReviseChatProps {
  open: boolean;
  onClose: () => void;
  /** Active persona colour (#hex) — scopes the accent. */
  accent: string;
  /** Active persona mascot image src. */
  mascot: string;
  /** Read the current draft as plain text. */
  getDraft: () => string;
  /** Write a revised draft back into the reply editor (plain text). */
  setDraft: (text: string) => void;
}

interface ChatTurn {
  id: number;
  role: 'user' | 'ai';
  text: string;
}

const QUICK = ['Shorter', 'Warmer', 'More direct', 'Stronger CTA'];

// Opaque frosted-glass surface (theme-aware via the dark class). More opaque
// than a popover because this panel floats over busy conversation content and
// must stay fully readable.
function surfaceStyle(): React.CSSProperties {
  const dark =
    typeof document !== 'undefined' &&
    document.documentElement.classList.contains('dark');
  return {
    background: dark
      ? 'linear-gradient(180deg, rgba(32,32,36,0.98) 0%, rgba(26,26,30,0.97) 100%)'
      : 'linear-gradient(180deg, rgba(255,255,255,0.99) 0%, rgba(252,252,253,0.98) 100%)',
    backdropFilter: 'blur(24px) saturate(150%)',
    WebkitBackdropFilter: 'blur(24px) saturate(150%)',
    boxShadow: dark
      ? 'inset 0 0 0 1px rgba(255,255,255,0.10), 0 24px 64px rgba(0,0,0,0.55)'
      : 'inset 0 0 0 1px rgba(255,255,255,0.6), 0 1px 4px rgba(0,0,0,0.06), 0 24px 64px rgba(0,0,0,0.18)',
  };
}

// Light, believable local transform so the flow can be felt before the real
// model is wired. Keeps the user's draft, nudges it per instruction.
function mockRewrite(draft: string, instruction: string): { draft: string; note: string } {
  const i = instruction.toLowerCase();
  let next = draft.trim();
  let note = 'Updated the draft.';
  if (i.includes('short')) {
    next = next.split(/(?<=[.!?])\s+/).slice(0, 2).join(' ');
    note = 'Tightened it to the essentials.';
  } else if (i.includes('warm')) {
    next = next.replace(/^/, 'Really glad you said that. ');
    note = 'Made the opening warmer and more human.';
  } else if (i.includes('direct')) {
    next = next.replace(/\b(maybe|perhaps|just|I think)\b/gi, '').replace(/\s{2,}/g, ' ').trim();
    note = 'Cut the hedging and got to the point.';
  } else if (i.includes('cta') || i.includes('call to action')) {
    next = next.replace(/[.?!]\s*$/, '') + '. Does Tuesday or Wednesday at 2pm work for a quick 20 min?';
    note = 'Added a concrete next step.';
  } else {
    note = `Reworked it around: "${instruction}".`;
  }
  return { draft: next, note };
}

export function AiReviseChat({
  open,
  onClose,
  accent,
  mascot,
  getDraft,
  setDraft,
}: AiReviseChatProps) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);

  // Reset the thread each time the panel opens fresh.
  useEffect(() => {
    if (open) {
      setTurns([]);
      setInput('');
      setThinking(false);
    }
  }, [open]);

  // Keep the thread scrolled to the latest turn.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns, thinking]);

  const send = (instruction: string) => {
    const trimmed = instruction.trim();
    if (!trimmed || thinking) return;
    setInput('');
    const userTurn: ChatTurn = { id: ++idRef.current, role: 'user', text: trimmed };
    setTurns((t) => [...t, userTurn]);
    setThinking(true);
    window.setTimeout(() => {
      const { draft, note } = mockRewrite(getDraft(), trimmed);
      setDraft(draft);
      setTurns((t) => [...t, { id: ++idRef.current, role: 'ai', text: note }]);
      setThinking(false);
    }, 750);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="ai-revise-chat"
          data-testid="ai-revise-chat"
          initial={{ opacity: 0, y: 12, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.985 }}
          transition={APPLE_SPRING}
          style={{
            ['--ai-accent' as never]: accent,
            ...surfaceStyle(),
          }}
          className="absolute left-1/2 -translate-x-1/2 bottom-full mb-3 z-40 w-[min(560px,calc(100%-24px))] flex flex-col rounded-[26px] overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center gap-2.5 px-4 pt-3.5 pb-3 shrink-0">
            <img
              src={mascot}
              alt=""
              aria-hidden
              className="w-8 h-8 object-contain shrink-0 select-none pointer-events-none"
            />
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-semibold text-foreground leading-tight">
                Revise with Replaiy
              </div>
              <div className="text-[11.5px] text-foreground/45 leading-tight">
                Talk it through — your draft updates live
              </div>
            </div>
            <button
              type="button"
              data-testid="ai-revise-chat-close"
              aria-label="Close"
              onClick={onClose}
              className="h-8 w-8 inline-flex items-center justify-center rounded-full hover-elevate active-elevate-2 shrink-0"
            >
              <X size={17} strokeWidth={1.9} className="text-icon" />
            </button>
          </div>

          {/* Quick adjustments */}
          <div className="flex flex-wrap gap-1.5 px-4 pb-2 shrink-0">
            {QUICK.map((q) => (
              <button
                key={q}
                type="button"
                data-testid={`ai-revise-quick-${q.replace(/\s+/g, '-').toLowerCase()}`}
                onClick={() => send(q)}
                className="glass-pill pill h-[28px] px-2.5 text-[12px] font-medium text-foreground/80 hover-elevate active-elevate-2"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Thread */}
          <div
            ref={scrollRef}
            className="flex-1 min-h-0 max-h-[300px] overflow-y-auto no-scrollbar px-4 py-2 flex flex-col gap-2.5"
          >
            {turns.length === 0 && !thinking && (
              <div className="text-[12.5px] text-foreground/45 leading-snug py-1">
                Pick a quick adjustment above, or tell Replaiy exactly what to change —
                for example "mention our case study" or "make it less salesy".
              </div>
            )}
            {turns.map((t) =>
              t.role === 'user' ? (
                <div key={t.id} className="self-end max-w-[78%]">
                  <div
                    className="px-3 py-2 rounded-2xl text-[13px] leading-snug text-white"
                    style={{ background: 'var(--ai-accent)' }}
                  >
                    {t.text}
                  </div>
                </div>
              ) : (
                <div key={t.id} className="self-start max-w-[82%] flex items-start gap-2">
                  <img
                    src={mascot}
                    alt=""
                    aria-hidden
                    className="w-5 h-5 object-contain shrink-0 mt-0.5 select-none pointer-events-none"
                  />
                  <div className="rp-card rounded-2xl px-3 py-2 text-[13px] leading-snug text-foreground/80">
                    {t.text}
                  </div>
                </div>
              ),
            )}
            {thinking && (
              <div className="self-start flex items-center gap-2 pl-1">
                <img
                  src={mascot}
                  alt=""
                  aria-hidden
                  className="w-5 h-5 object-contain shrink-0 select-none pointer-events-none animate-pulse"
                />
                <span className="text-[12.5px] text-foreground/45">Replaiy is rewriting…</span>
              </div>
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-center gap-2 m-3 mt-2 rounded-full px-3 py-1.5 shrink-0 glass-pill"
          >
            <input
              data-testid="ai-revise-chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Tell Replaiy what to change…"
              className="flex-1 min-w-0 bg-transparent outline-none text-[13.5px] text-foreground placeholder:text-foreground/40 py-1"
            />
            <button
              type="submit"
              data-testid="ai-revise-chat-send"
              aria-label="Send"
              disabled={!input.trim() || thinking}
              className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 disabled:opacity-40 transition-opacity"
              style={{ color: '#fff', background: 'var(--ai-accent)' }}
            >
              <ArrowUp size={16} strokeWidth={2.4} />
            </button>
          </form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
