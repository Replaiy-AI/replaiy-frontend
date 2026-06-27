// ─────────────────────────────────────────────────────────────────
// MijnAi — the DETAIL pane of the "My AI" list-detail surface.
//
// My AI is a true sibling of the Inbox and Campaigns: a left list column
// (AiList) drives which detail shows here in the right pane, via the /ai
// sub-route. This component renders ONLY the right pane:
//
//   /ai                    → calm empty-state ("Select a part"), like the inbox
//   /ai/persona            → Persona: tone of voice + strategy
//   /ai/knowledge-personal → Personal knowledge: questions + files
//   /ai/knowledge-workspace→ Workspace knowledge: questions + files (role-gated)
//
// Parts (everything serves the same goal — a better AI):
//   1. Persona             → HOW your AI sounds/reacts/thinks
//   2. Personal knowledge  → what YOU teach your AI (questions + files)
//   3. Workspace knowledge → what the COMPANY teaches the AI (questions + files)
//
// State (persona + workspace) lives in StiltContext so this pane and the
// AiList column read/write the same data — exactly like campaigns are shared
// between CampaignsList and CampaignDetail.
//
// Built on design-system primitives (glass-pill, stilt-card, hover-elevate,
// active-elevate-2). Glass is reserved for real containers; small elements
// (status, badges) are flat, matching the inbox's restraint.
// ─────────────────────────────────────────────────────────────────
import { useState, useRef, useLayoutEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation } from 'wouter';
import { APPLE_SPRING } from '@/lib/motion';
import { useMobileTopChromeSlot } from '@/components/MobileTopChrome';
import { ActionPill } from '@/components/ConversationDetailToolbar';
import {
  Sparkles,
  Plus,
  FileText,
  StickyNote,
  Link2,
  Trash2,
  Check,
  Lock,
  ArrowLeft,
  MessageCircleQuestion,
  Files,
} from 'lucide-react';
import { useStilt } from '@/state/StiltContext';
import { StiltLogo } from '@/components/Logo';
import {
  type Persona,
  type ToneFormality,
  type ToneLength,
  type StrategyStance,
  type KnowledgeBundle,
  type KnowledgeDoc,
} from '@/data/mockPersona';
import {
  canEditWorkspaceKnowledge,
  type Workspace,
} from '@/data/mockWorkspace';

// ════════════════════════════════════════════════════════════════
// Shared small primitives
// ════════════════════════════════════════════════════════════════

function SegmentedPills<K extends string>({
  value,
  options,
  onChange,
  testId,
}: {
  value: K;
  options: { key: K; label: string }[];
  onChange: (k: K) => void;
  testId?: string;
}) {
  return (
    <div data-testid={testId} className="glass-pill pill inline-flex items-center p-1 gap-1 w-full">
      {options.map((o) => {
        const active = o.key === value;
        return (
          <button
            key={o.key}
            type="button"
            data-testid={testId ? `${testId}-${o.key}` : undefined}
            aria-pressed={active}
            onClick={() => onChange(o.key)}
            className={`flex-1 h-8 rounded-full text-[13px] font-medium transition-colors ${
              active ? 'text-foreground active-elevate-2' : 'text-foreground/55 hover-elevate'
            }`}
            style={
              active
                ? {
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.82), rgba(255,255,255,0.60))',
                    boxShadow:
                      'inset 0 1px 0 rgba(255,255,255,0.95), inset 0 0 0 1px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.06)',
                  }
                : undefined
            }
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[12px] font-semibold text-foreground/65 mb-1.5">{children}</span>
  );
}

function GlassTextarea({
  value,
  onChange,
  placeholder,
  rows = 3,
  testId,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  testId?: string;
}) {
  // Auto-grow to fit content so answers never clip (rows is the min height).
  // On a narrow phone an answer can wrap to more lines than `rows` — without
  // this the last line would be hidden by the fixed-height textarea.
  const ref = useRef<HTMLTextAreaElement>(null);
  const resize = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };
  // Recalculate on value change.
  useLayoutEffect(() => {
    resize();
  }, [value]);
  // Recalculate after first layout settles (fonts/responsive width) and on any
  // width change. Without this the initial scrollHeight is measured against a
  // not-yet-final width, so wrapped answers can clip on narrow phones. We also
  // wait for web fonts to finish loading because metrics shift line-wrapping,
  // and resize once more on the next frame after that.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const raf = requestAnimationFrame(() => requestAnimationFrame(resize));
    const ro = new ResizeObserver(() => resize());
    ro.observe(el);
    let fontRaf = 0;
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (fonts?.ready) {
      fonts.ready.then(() => {
        fontRaf = requestAnimationFrame(resize);
      });
    }
    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(fontRaf);
      ro.disconnect();
    };
  }, []);
  return (
    <textarea
      ref={ref}
      data-testid={testId}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full resize-none rounded-2xl bg-foreground/[0.035] dark:bg-white/[0.04] px-3.5 py-2.5 text-[14px] leading-[1.5] text-foreground/90 placeholder:text-foreground/35 outline-none focus:bg-foreground/[0.06] dark:focus:bg-white/[0.06] transition-colors overflow-hidden"
      style={{ boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.05)' }}
    />
  );
}

function EditableList({
  items,
  onChange,
  placeholder,
  accent,
  testId,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
  accent: boolean;
  testId?: string;
}) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    onChange([...items, v]);
    setDraft('');
  };
  return (
    <div data-testid={testId} className="flex flex-col gap-1.5">
      {items.map((it, i) => (
        <div
          key={i}
          className="group flex items-start gap-2.5 rounded-xl px-3 py-2 bg-foreground/[0.03] dark:bg-white/[0.03]"
        >
          <span
            className="mt-[7px] h-1.5 w-1.5 rounded-full shrink-0"
            style={{ background: accent ? 'var(--ai-accent, #2F6BFF)' : 'rgba(120,120,130,0.5)' }}
          />
          <span className="flex-1 text-[13.5px] leading-[1.45] text-foreground/85">{it}</span>
          <button
            type="button"
            aria-label="Remove"
            data-testid={testId ? `${testId}-remove-${i}` : undefined}
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 -mr-1 rounded-full flex items-center justify-center text-icon-muted hover-elevate active-elevate-2"
          >
            <Trash2 size={13} strokeWidth={1.8} />
          </button>
        </div>
      ))}
      <div className="flex items-center gap-2 mt-0.5">
        <input
          value={draft}
          data-testid={testId ? `${testId}-input` : undefined}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className="flex-1 rounded-xl bg-foreground/[0.035] dark:bg-white/[0.04] px-3 py-2 text-[13.5px] text-foreground/90 placeholder:text-foreground/35 outline-none focus:bg-foreground/[0.06] transition-colors"
          style={{ boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.05)' }}
        />
        <button
          type="button"
          aria-label="Add"
          data-testid={testId ? `${testId}-add` : undefined}
          onClick={add}
          className="h-8 w-8 shrink-0 rounded-full glass-pill flex items-center justify-center text-icon hover-elevate active-elevate-2"
        >
          <Plus size={15} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

const KNOWLEDGE_ICON: Record<KnowledgeDoc['kind'], typeof FileText> = {
  pdf: FileText,
  doc: FileText,
  note: StickyNote,
  link: Link2,
};

// ════════════════════════════════════════════════════════════════
// Detail-pane shell: scroll container + back affordances on BOTH breakpoints.
// Mobile reuses the top-chrome slot (••• -> back arrow). Desktop renders a
// floating top row mirroring the inbox's desktop-pill-row.
// ════════════════════════════════════════════════════════════════
function ViewShell({
  children,
  title,
  onBack,
}: {
  children: React.ReactNode;
  title: string;
  onBack: () => void;
}) {
  // MOBILE back: the top-chrome slot (MijnAiDetailChromeSlot) replaces the •••
  // with a back arrow. DESKTOP back: a floating top row mirroring the inbox's
  // `desktop-pill-row` (ConversationDetail.tsx) — back ActionPill top-left and a
  // centered plain title. The hub has no persistent list column on desktop, so
  // this is the single way back to /ai (matching how opening an inbox
  // conversation shows a back affordance + centered identity).
  return (
    <div className="relative flex flex-col h-full min-h-0 overflow-y-auto no-scrollbar">
      {/* DESKTOP floating top row — same treatment as the inbox desktop pill
          row: absolutely positioned, top-3, pointer-events gated so only the
          pills are interactive. Back arrow left, plain title centered. */}
      <div
        data-testid="ai-desktop-pill-row"
        className="hidden lg:block absolute top-3 inset-x-0 z-30 pointer-events-none"
      >
        <div className="absolute top-0 left-6 pointer-events-auto">
          <ActionPill testId="button-back" label="Back" onClick={onBack}>
            <ArrowLeft size={22} strokeWidth={1.7} className="text-icon" />
          </ActionPill>
        </div>
        <div className="flex justify-center items-center px-[120px]">
          <div className="pointer-events-auto flex items-center h-[52px] min-w-0 max-w-[640px]">
            <span className="text-[14px] font-semibold tracking-[-0.005em] truncate text-foreground">
              {title}
            </span>
          </div>
        </div>
      </div>

      {/* pt-20 on mobile clears the fixed mobile top-chrome; lg:pt-[76px]
          clears the floating desktop top row (12 top + 52 pill + 12 gap). */}
      <div className="px-4 lg:px-8 pt-20 lg:pt-[76px] pb-28 lg:pb-12 max-w-2xl w-full">
        {children}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-1.5 mb-2.5">
      <Sparkles size={12} strokeWidth={2.2} className="text-icon-muted" />
      <span className="text-[10.5px] uppercase tracking-[0.12em] font-semibold text-foreground/70">
        {children}
      </span>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// PERSONA detail — tone of voice + strategy
// ════════════════════════════════════════════════════════════════
function PersonaDetail({
  persona,
  setPersona,
  onBack,
}: {
  persona: Persona;
  setPersona: React.Dispatch<React.SetStateAction<Persona>>;
  onBack: () => void;
}) {
  const tone = persona.tone;
  const strategy = persona.strategy;
  const patchTone = (p: Partial<typeof tone>) =>
    setPersona((prev) => ({ ...prev, tone: { ...prev.tone, ...p } }));
  const patchStrategy = (p: Partial<typeof strategy>) =>
    setPersona((prev) => ({ ...prev, strategy: { ...prev.strategy, ...p } }));

  return (
    <ViewShell title="Persona" onBack={onBack}>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <SectionLabel>Persona</SectionLabel>
        <h1 className="text-[22px] lg:text-[26px] font-semibold tracking-[-0.025em] leading-tight">
          How your AI sounds &amp; thinks
        </h1>
        <p className="text-[13.5px] leading-[1.5] text-foreground/55 mt-1.5 mb-6">
          The voice and strategy your AI uses in every conversation.
        </p>

        {/* Tone of voice */}
        <div className="stilt-card rounded-3xl p-4 lg:p-5 mb-3" data-testid="persona-tone">
          <div className="text-[13px] font-semibold text-foreground/80 mb-3">Tone of voice</div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <FieldLabel>Language</FieldLabel>
              <SegmentedPills
                testId="tone-language"
                value={tone.language}
                onChange={(language) => patchTone({ language })}
                options={[
                  { key: 'nl', label: 'Dutch' },
                  { key: 'en', label: 'English' },
                ]}
              />
            </div>
            <div>
              <FieldLabel>Length</FieldLabel>
              <SegmentedPills
                testId="tone-length"
                value={tone.length}
                onChange={(length) => patchTone({ length: length as ToneLength })}
                options={[
                  { key: 'short', label: 'Short' },
                  { key: 'medium', label: 'Med.' },
                  { key: 'long', label: 'Long' },
                ]}
              />
            </div>
          </div>
          <div className="mb-3">
            <FieldLabel>Formality</FieldLabel>
            <SegmentedPills
              testId="tone-formality"
              value={tone.formality}
              onChange={(formality) => patchTone({ formality: formality as ToneFormality })}
              options={[
                { key: 'informal', label: 'Informal' },
                { key: 'neutral', label: 'Neutral' },
                { key: 'formal', label: 'Formal' },
              ]}
            />
          </div>
          <div className="mb-4">
            <FieldLabel>Voice</FieldLabel>
            <GlassTextarea
              testId="tone-voice"
              value={tone.voice}
              onChange={(voice) => patchTone({ voice })}
              placeholder="Describe how you want to sound…"
              rows={4}
            />
          </div>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <FieldLabel>Do's</FieldLabel>
              <EditableList
                testId="tone-dos"
                accent
                items={tone.dos}
                onChange={(dos) => patchTone({ dos })}
                placeholder="Add a do…"
              />
            </div>
            <div>
              <FieldLabel>Don'ts</FieldLabel>
              <EditableList
                testId="tone-donts"
                accent={false}
                items={tone.donts}
                onChange={(donts) => patchTone({ donts })}
                placeholder="Add a don't…"
              />
            </div>
          </div>
        </div>

        {/* Strategy */}
        <div className="stilt-card rounded-3xl p-4 lg:p-5" data-testid="persona-strategy">
          <div className="text-[13px] font-semibold text-foreground/80 mb-3">Strategy</div>
          <div className="mb-3">
            <FieldLabel>Approach</FieldLabel>
            <SegmentedPills
              testId="strategy-stance"
              value={strategy.stance}
              onChange={(stance) => patchStrategy({ stance: stance as StrategyStance })}
              options={[
                { key: 'patient', label: 'Patient' },
                { key: 'balanced', label: 'Balanced' },
                { key: 'push', label: 'Push' },
              ]}
            />
          </div>
          <div className="mb-3">
            <FieldLabel>Qualifying</FieldLabel>
            <GlassTextarea
              testId="strategy-qualification"
              value={strategy.qualification}
              onChange={(qualification) => patchStrategy({ qualification })}
              placeholder="How do you surface fit and intent?"
              rows={2}
            />
          </div>
          <div className="mb-3">
            <FieldLabel>Closing</FieldLabel>
            <GlassTextarea
              testId="strategy-closing"
              value={strategy.closing}
              onChange={(closing) => patchStrategy({ closing })}
              placeholder="How and when do you suggest the next step?"
              rows={2}
            />
          </div>
          <div>
            <FieldLabel>Push vs. wait</FieldLabel>
            <GlassTextarea
              testId="strategy-pushwait"
              value={strategy.pushVsWait}
              onChange={(pushVsWait) => patchStrategy({ pushVsWait })}
              placeholder="When would you rather wait than push?"
              rows={2}
            />
          </div>
        </div>

        <SaveButton testId="persona-save" onClick={onBack} />
      </motion.div>
    </ViewShell>
  );
}

// ════════════════════════════════════════════════════════════════
// KNOWLEDGE detail — questions (Q&A) + files. Shared by personal and
// workspace; workspace can be read-only (role gating).
// ════════════════════════════════════════════════════════════════
function KnowledgeDetail({
  scope,
  bundle,
  setBundle,
  editable,
  onBack,
}: {
  scope: 'personal' | 'workspace';
  bundle: KnowledgeBundle;
  setBundle: (updater: (prev: KnowledgeBundle) => KnowledgeBundle) => void;
  editable: boolean;
  onBack: () => void;
}) {
  const isPersonal = scope === 'personal';
  const title = isPersonal ? 'Personal knowledge' : 'Workspace knowledge';
  const intro = isPersonal
    ? 'Only your AI uses this — answer a few questions or add your own material.'
    : 'Company-wide knowledge, shared with your whole team.' +
      (editable ? '' : ' Read-only for your role.');

  const setAnswer = (id: string, answer: string) =>
    setBundle((prev) => ({
      ...prev,
      questions: prev.questions.map((q) => (q.id === id ? { ...q, answer } : q)),
    }));

  const addFile = () =>
    setBundle((prev) => ({
      ...prev,
      files: [
        ...prev.files,
        { id: `f_${Date.now()}`, title: 'New document', kind: 'doc', hint: 'Not uploaded yet', meta: 'Draft' },
      ],
    }));
  const removeFile = (id: string) =>
    setBundle((prev) => ({ ...prev, files: prev.files.filter((f) => f.id !== id) }));

  return (
    <ViewShell title={title} onBack={onBack}>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <SectionLabel>{isPersonal ? 'Personal' : 'Workspace'}</SectionLabel>
        <div className="flex items-center gap-2">
          <h1 className="text-[22px] lg:text-[26px] font-semibold tracking-[-0.025em] leading-tight">{title}</h1>
          {!editable && <Lock size={16} strokeWidth={2} className="text-icon-muted" />}
        </div>
        <p className="text-[13.5px] leading-[1.5] text-foreground/55 mt-1.5 mb-6">{intro}</p>

        {/* ── Questions ── */}
        <div className="flex items-center gap-1.5 mb-3">
          <MessageCircleQuestion size={14} strokeWidth={2} className="text-icon-muted" />
          <span className="text-[13px] font-semibold text-foreground/80">Questions</span>
        </div>
        <div className="flex flex-col gap-3 mb-7" data-testid={`knowledge-${scope}-questions`}>
          {bundle.questions.map((q) => (
            <div key={q.id} className="stilt-card rounded-2xl p-4" data-testid={`question-${q.id}`}>
              <div className="text-[14px] font-medium text-foreground leading-snug">{q.question}</div>
              {q.hint && <div className="text-[12px] text-foreground/45 mt-0.5 mb-2.5">{q.hint}</div>}
              {editable ? (
                <GlassTextarea
                  testId={`answer-${q.id}`}
                  value={q.answer}
                  onChange={(v) => setAnswer(q.id, v)}
                  placeholder="Your answer…"
                  rows={3}
                />
              ) : (
                <p className="text-[13.5px] leading-[1.5] text-foreground/80 mt-1 whitespace-pre-wrap">
                  {q.answer || <span className="text-foreground/35">Not answered yet</span>}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* ── Files ── */}
        <div className="flex items-center gap-1.5 mb-3">
          <Files size={14} strokeWidth={2} className="text-icon-muted" />
          <span className="text-[13px] font-semibold text-foreground/80">Files</span>
        </div>
        <div className="flex flex-col gap-2" data-testid={`knowledge-${scope}-files`}>
          {bundle.files.map((doc) => {
            const Icon = KNOWLEDGE_ICON[doc.kind];
            return (
              <div
                key={doc.id}
                data-testid={`file-${doc.id}`}
                className="group stilt-card rounded-2xl px-3.5 py-3 flex items-center gap-3 hover-elevate"
              >
                <div className="h-9 w-9 shrink-0 rounded-xl glass-pill flex items-center justify-center text-icon">
                  <Icon size={16} strokeWidth={1.8} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-medium text-foreground truncate">{doc.title}</div>
                  <div className="text-[12px] text-foreground/50 truncate">{doc.hint}</div>
                </div>
                <span className="text-[11.5px] text-foreground/40 shrink-0">{doc.meta}</span>
                {editable && (
                  <button
                    type="button"
                    aria-label="Remove document"
                    data-testid={`file-remove-${doc.id}`}
                    onClick={() => removeFile(doc.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-icon-muted hover-elevate active-elevate-2"
                  >
                    <Trash2 size={13} strokeWidth={1.8} />
                  </button>
                )}
              </div>
            );
          })}
          {editable ? (
            <button
              type="button"
              data-testid={`knowledge-${scope}-add`}
              onClick={addFile}
              className="glass-pill pill h-11 flex items-center justify-center gap-1.5 text-[13.5px] font-semibold text-foreground/70 hover-elevate active-elevate-2"
            >
              <Plus size={15} strokeWidth={2} />
              Add document
            </button>
          ) : (
            <div
              data-testid={`knowledge-${scope}-locked`}
              className="rounded-2xl px-4 py-3 flex items-center gap-2.5 bg-foreground/[0.03] dark:bg-white/[0.03] text-[12.5px] text-foreground/45"
            >
              <Lock size={13} strokeWidth={2} className="text-icon-muted shrink-0" />
              Only workspace admins can edit company knowledge.
            </div>
          )}
        </div>

        {editable && <SaveButton testId={`knowledge-${scope}-save`} onClick={onBack} />}
      </motion.div>
    </ViewShell>
  );
}

function SaveButton({ testId, onClick }: { testId: string; onClick: () => void }) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      className="mt-8 w-full pill h-12 flex items-center justify-center gap-1.5 text-[14px] font-semibold text-white hover-elevate active-elevate-2"
      style={{ background: 'linear-gradient(90deg, #1B3FA8 0%, #2F6BFF 100%)' }}
    >
      <Check size={15} strokeWidth={2.2} />
      Save changes
    </button>
  );
}

// ════════════════════════════════════════════════════════════════
// Empty-state — bare /ai, before a part is selected. Mirrors the inbox's
// "Select a conversation" empty detail (same StiltLogo + copy shape). On
// desktop the list column sits beside this; on mobile bare /ai shows the
// full-screen list instead, so this reads mainly as a desktop affordance.
// ════════════════════════════════════════════════════════════════
function EmptyAiDetail() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
      <div className="mb-4">
        <StiltLogo size={56} />
      </div>
      <h2 className="text-[20px] font-semibold tracking-[-0.02em]">Select a part</h2>
      <p className="text-[14px] text-muted-foreground mt-1.5 max-w-xs">
        Choose your persona or a knowledge area to shape how your AI sounds and
        what it knows.
      </p>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Mobile top-chrome for an open detail. This is the SAME mechanism the inbox
// uses (see ConversationDetail's ConversationDetailChromeSlot): registering a
// `leftSlot` REPLACES the default ••• button with a back arrow in the same
// position — so there is exactly ONE button, not two stacked elements. The
// center togglePill shows a plain title so the user knows where they are.
function MijnAiDetailChromeSlot({
  title,
  onBack,
}: {
  title: string;
  onBack: () => void;
}) {
  const slot = useMemo(
    () => ({
      priority: 100,
      leftSlot: (
        <ActionPill testId="button-back" label="Back" onClick={onBack}>
          <ArrowLeft size={22} strokeWidth={1.7} className="text-icon" />
        </ActionPill>
      ),
      togglePill: (
        <div
          data-testid="mijn-ai-title"
          className="inline-flex items-center px-1 h-[52px]"
        >
          <span className="text-[14px] font-semibold tracking-[-0.005em] truncate max-w-[200px] text-foreground">
            {title}
          </span>
        </div>
      ),
    }),
    [title, onBack],
  );
  useMobileTopChromeSlot(slot);
  return null;
}

// ════════════════════════════════════════════════════════════════
// Router-aware DETAIL pane. Reads the /ai sub-route and renders the matching
// detail (or the empty-state for bare /ai). State comes from StiltContext so
// edits here reflect live in the AiList column. Each detail enters with an
// Apple-spring slide, mirroring opening a conversation/campaign.
// ════════════════════════════════════════════════════════════════
export function MijnAi() {
  const [loc, navigate] = useLocation();
  const { persona, setPersona, workspace, setWorkspace } = useStilt();

  const canEditWs = canEditWorkspaceKnowledge(workspace.currentRole);

  // Which sub-view? Derived from the hash route.
  const view: 'empty' | 'persona' | 'kp' | 'kw' = loc.startsWith('/ai/persona')
    ? 'persona'
    : loc.startsWith('/ai/knowledge-personal')
      ? 'kp'
      : loc.startsWith('/ai/knowledge-workspace')
        ? 'kw'
        : 'empty';

  const back = () => navigate('/ai');

  // Plain title shown in the mobile top-chrome center, mirroring how the inbox
  // shows the contact name when a conversation is open.
  const detailTitle =
    view === 'persona'
      ? 'Persona'
      : view === 'kp'
        ? 'Personal knowledge'
        : view === 'kw'
          ? 'Workspace knowledge'
          : '';

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* On mobile, an open detail swaps the default ••• for a back arrow in the
          SAME chrome position (one button, not two) — exactly like the inbox. */}
      {view !== 'empty' && (
        <MijnAiDetailChromeSlot title={detailTitle} onBack={back} />
      )}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={view}
          initial={{ opacity: 0, x: view === 'empty' ? 0 : 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: view === 'empty' ? 0 : 16 }}
          transition={APPLE_SPRING}
          className="absolute inset-0 flex flex-col"
        >
          {view === 'empty' && <EmptyAiDetail />}
          {view === 'persona' && (
            <PersonaDetail persona={persona} setPersona={setPersona} onBack={back} />
          )}
          {view === 'kp' && (
            <KnowledgeDetail
              scope="personal"
              bundle={persona.knowledge}
              setBundle={(updater) =>
                setPersona((prev) => ({ ...prev, knowledge: updater(prev.knowledge) }))
              }
              editable
              onBack={back}
            />
          )}
          {view === 'kw' && (
            <KnowledgeDetail
              scope="workspace"
              bundle={workspace.knowledge}
              setBundle={(updater) =>
                setWorkspace((prev) => ({ ...prev, knowledge: updater(prev.knowledge) }))
              }
              editable={canEditWs}
              onBack={back}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export default MijnAi;
