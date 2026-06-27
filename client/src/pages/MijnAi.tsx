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
// State (persona + workspace) lives in ReplaiyContext so this pane and the
// AiList column read/write the same data — exactly like campaigns are shared
// between CampaignsList and CampaignDetail.
//
// Built on design-system primitives (glass-pill, rp-card, hover-elevate,
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
  Brain,
  Plus,
  FileText,
  StickyNote,
  Link2,
  Trash2,
  Check,
  Lock,
  ArrowLeft,
  Linkedin,
  Globe,
  UploadCloud,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { useReplaiy } from '@/state/ReplaiyContext';
import { ReplaiyLogo } from '@/components/Logo';
import { PersonaExperience } from '@/components/PersonaExperience';
import iconPersona from '@/assets/ai_icon_persona.png';
import iconPersonal from '@/assets/ai_icon_personal.png';
import iconWorkspace from '@/assets/ai_icon_workspace.png';
import {
  type Persona,
  type ToneFormality,
  type ToneLength,
  type StrategyStance,
  type KnowledgeBundle,
  type KnowledgeDoc,
  type KnowledgeSource,
  type KnowledgeStatus,
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

const FILE_KIND_ICON: Record<NonNullable<KnowledgeDoc['kind']>, typeof FileText> = {
  pdf: FileText,
  doc: FileText,
  note: StickyNote,
  link: Link2,
};

// Icon per source TYPE (linkedin / url / file).
function sourceIcon(src: KnowledgeSource) {
  if (src.type === 'linkedin') return Linkedin;
  if (src.type === 'url') return Globe;
  return FILE_KIND_ICON[src.kind ?? 'doc'];
}

// Small status pill mirroring the backend ingest lifecycle. 'ready' is quiet
// (just the meta text); the others get a small coloured chip.
function SourceStatus({ status }: { status: KnowledgeStatus }) {
  if (status === 'ready') return null;
  if (status === 'connected')
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#2F6BFF]">
        <CheckCircle2 size={12} strokeWidth={2} /> Connected
      </span>
    );
  if (status === 'processing')
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-foreground/50">
        <Loader2 size={12} strokeWidth={2} className="animate-spin" /> Processing
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-500">
      <AlertCircle size={12} strokeWidth={2} /> Failed
    </span>
  );
}

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
  // with a back arrow + centered title. That stays — on mobile the detail
  // covers the full screen, so the back affordance is the only way back.
  // DESKTOP: NO back row. The left AiList cards column is always visible on
  // desktop, so the user goes "back" by clicking another card (exactly like the
  // inbox keeps its list visible). A floating desktop top row would duplicate
  // the in-pane DetailHeader title, so it is intentionally omitted here.
  // `title`/`onBack` are still consumed by the mobile chrome slot elsewhere.
  void title;
  void onBack;
  return (
    <div className="relative flex flex-col h-full min-h-0 overflow-y-auto no-scrollbar">
      {/* pt-20 on mobile clears the fixed mobile top-chrome. On desktop there
          is no floating top row, so only a modest top padding keeps the header
          aligned cleanly. Content is centred in a comfortable max-width column
          (mx-auto) so it never runs full-bleed on a wide desktop pane — the
          SAME treatment the inbox conversation detail uses (max-w-2xl mx-auto). */}
      <div className="px-4 lg:px-6 pt-20 lg:pt-8 pb-28 lg:pb-16">
        <div className="max-w-2xl mx-auto w-full">{children}</div>
      </div>
    </div>
  );
}

// ── DetailHeader — the character-rich header at the top of each detail pane.
// Mirrors the left PartCard's identity (same 3D brand icon) so the left list
// and right detail tie together. A 3D icon, an uppercase eyebrow, the title,
// and a single live summary line describing the part's current state. The
// summary is the same flat blue accent the left cards use for their live tag.
function DetailHeader({
  iconSrc,
  eyebrow,
  title,
  intro,
  summary,
  locked,
}: {
  iconSrc: string;
  eyebrow: string;
  title: string;
  intro: string;
  /** One-line live state, e.g. "Setup 80% complete. English, informal." */
  summary: React.ReactNode;
  locked?: boolean;
}) {
  return (
    <div className="flex items-start gap-4 lg:gap-5 mb-7 lg:mb-8">
      {/* Same prominent 3D brand icon as the matching left card. */}
      <img
        src={iconSrc}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="shrink-0 w-16 h-16 lg:w-[72px] lg:h-[72px] object-contain select-none pointer-events-none -mt-1"
      />
      <div className="min-w-0 flex-1">
        <div className="inline-flex items-center gap-1.5 mb-1.5">
          <Brain size={12} strokeWidth={2.2} className="text-icon-muted" />
          <span className="text-[10.5px] uppercase tracking-[0.12em] font-semibold text-foreground/70">
            {eyebrow}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <h1 className="text-[23px] lg:text-[28px] font-semibold tracking-[-0.025em] leading-tight text-foreground">
            {title}
          </h1>
          {locked && <Lock size={16} strokeWidth={2} className="text-icon-muted shrink-0" />}
        </div>
        <p className="text-[13.5px] leading-[1.5] text-foreground/55 mt-1.5">{intro}</p>
        {summary && (
          <div
            className="mt-3 text-[12.5px] font-medium leading-snug"
            style={{ color: 'var(--ai-accent, #2F6BFF)' }}
          >
            {summary}
          </div>
        )}
      </div>
    </div>
  );
}

// In-pane section header — the SAME treatment the inbox/campaigns lists use
// above each card cluster: a small semibold label and an optional muted count,
// at px-2 mb-1.5 (see InboxList SmartInboxView "Needs your approval"). Reusing
// this exact pattern keeps the detail panes pixel-consistent with the lists.
function SectionHeader({
  children,
  count,
}: {
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <div className="flex items-center gap-2 px-2 mb-1.5">
      <span className="text-[12.5px] font-semibold tracking-[-0.005em]">{children}</span>
      {count !== undefined && (
        <span className="text-[12px] text-muted-foreground">{count}</span>
      )}
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
  // Fine-tuning any control moves the persona off its preset into "custom"
  // (activePresetId = null), so the preset cards no longer show as selected.
  const patchTone = (p: Partial<typeof tone>) =>
    setPersona((prev) => ({ ...prev, activePresetId: null, tone: { ...prev.tone, ...p } }));
  const patchStrategy = (p: Partial<typeof strategy>) =>
    setPersona((prev) => ({ ...prev, activePresetId: null, strategy: { ...prev.strategy, ...p } }));

  return (
    <ViewShell title="Persona" onBack={onBack}>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        {/* Living top: preset personalities + live mascot preview. */}
        <PersonaExperience persona={persona} setPersona={setPersona} />

        {/* Optional fine-tuning, for users who want to go beyond a preset. */}
        <div className="flex items-center gap-3 mt-8 mb-1 px-2">
          <span className="text-[12.5px] font-semibold tracking-[-0.005em] text-foreground/80">
            Fine-tune
          </span>
          <span className="text-[12px] text-foreground/45">Optional, adjust anything by hand</span>
          <div className="flex-1 h-px bg-foreground/[0.08] dark:bg-white/[0.08]" />
        </div>
        <div className="flex flex-col gap-5 md:gap-6">
        {/* Tone of voice */}
        <section>
        <SectionHeader>Tone of voice</SectionHeader>
        <div className="rp-card rounded-3xl p-5 lg:p-6" data-testid="persona-tone">
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
        </section>

        {/* Strategy */}
        <section>
        <SectionHeader>Strategy</SectionHeader>
        <div className="rp-card rounded-3xl p-5 lg:p-6" data-testid="persona-strategy">
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
        </section>
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
    ? 'Only your AI uses this. Answer a few questions or add your own material.'
    : 'Company-wide knowledge, shared with your whole team.' +
      (editable ? '' : ' Read-only for your role.');
  const headerIcon = isPersonal ? iconPersonal : iconWorkspace;

  // Live one-line header summary. Counts answered questions + sources.
  const answeredCount = bundle.questions.filter((q) => q.answer.trim()).length;
  const srcCount = bundle.sources.length;
  const headerSummary = `${answeredCount} of ${bundle.questions.length} questions answered. ${srcCount} ${srcCount === 1 ? 'source' : 'sources'}.`;

  // ── Q&A ──
  const setAnswer = (id: string, answer: string) =>
    setBundle((prev) => ({
      ...prev,
      questions: prev.questions.map((q) => (q.id === id ? { ...q, answer } : q)),
    }));
  const addQuestion = () =>
    setBundle((prev) => ({
      ...prev,
      questions: [
        ...prev.questions,
        { id: `q_${Date.now()}`, question: 'New question', answer: '', custom: true },
      ],
    }));
  const editQuestion = (id: string, question: string) =>
    setBundle((prev) => ({
      ...prev,
      questions: prev.questions.map((q) => (q.id === id ? { ...q, question } : q)),
    }));
  const removeQuestion = (id: string) =>
    setBundle((prev) => ({ ...prev, questions: prev.questions.filter((q) => q.id !== id) }));

  // ── Sources (files + urls + linkedin) ──
  const removeSource = (id: string) =>
    setBundle((prev) => ({ ...prev, sources: prev.sources.filter((s) => s.id !== id) }));

  // Mock the backend ingest: a new source starts 'processing', then flips to
  // 'ready' after a moment. The real backend will drive this status for real.
  const ingest = (src: KnowledgeSource) => {
    setBundle((prev) => ({ ...prev, sources: [...prev.sources, src] }));
    setTimeout(() => {
      setBundle((prev) => ({
        ...prev,
        sources: prev.sources.map((s) => (s.id === src.id ? { ...s, status: 'ready' } : s)),
      }));
    }, 2200);
  };

  const addFiles = (files: FileList | File[]) => {
    Array.from(files).forEach((file, i) => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      const kind: KnowledgeDoc['kind'] = ext === 'pdf' ? 'pdf' : 'doc';
      const kb = Math.max(1, Math.round(file.size / 1024));
      const meta = kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
      ingest({
        id: `f_${Date.now()}_${i}`,
        type: 'file',
        title: file.name,
        kind,
        hint: 'Uploaded document',
        meta,
        status: 'processing',
      });
    });
  };

  const addUrl = (raw: string) => {
    let url = raw.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    let domain = url;
    try {
      domain = new URL(url).hostname.replace(/^www\./, '');
    } catch {
      /* keep raw */
    }
    ingest({
      id: `u_${Date.now()}`,
      type: 'url',
      title: domain,
      url,
      hint: 'Web page — the AI reads it for context',
      meta: domain,
      status: 'processing',
    });
  };

  return (
    <ViewShell title={title} onBack={onBack}>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <DetailHeader
          iconSrc={headerIcon}
          eyebrow={isPersonal ? 'Personal' : 'Workspace'}
          title={title}
          intro={intro}
          summary={headerSummary}
          locked={!editable}
        />

        <div className="flex flex-col gap-5 md:gap-6">
        {/* ── Questions ── */}
        <section>
        <SectionHeader count={bundle.questions.length}>Questions</SectionHeader>
        <div className="flex flex-col gap-3" data-testid={`knowledge-${scope}-questions`}>
          {bundle.questions.map((q) => (
            <div key={q.id} className="group rp-card rounded-3xl p-4 lg:p-5" data-testid={`question-${q.id}`}>
              <div className="flex items-start gap-2">
                {editable && q.custom ? (
                  <input
                    value={q.question}
                    onChange={(e) => editQuestion(q.id, e.target.value)}
                    data-testid={`question-edit-${q.id}`}
                    className="flex-1 bg-transparent text-[14px] font-medium text-foreground leading-snug outline-none placeholder:text-foreground/35"
                    placeholder="Your question…"
                  />
                ) : (
                  <div className="flex-1 text-[14px] font-medium text-foreground leading-snug">{q.question}</div>
                )}
                {editable && q.custom && (
                  <button
                    type="button"
                    aria-label="Remove question"
                    data-testid={`question-remove-${q.id}`}
                    onClick={() => removeQuestion(q.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-icon-muted hover-elevate active-elevate-2"
                  >
                    <Trash2 size={13} strokeWidth={1.8} />
                  </button>
                )}
              </div>
              {q.hint && <div className="text-[12px] text-foreground/45 mt-1">{q.hint}</div>}
              <div className="mt-3">
              {editable ? (
                <GlassTextarea
                  testId={`answer-${q.id}`}
                  value={q.answer}
                  onChange={(v) => setAnswer(q.id, v)}
                  placeholder="Your answer…"
                  rows={3}
                />
              ) : (
                <p className="text-[13.5px] leading-[1.5] text-foreground/80 whitespace-pre-wrap">
                  {q.answer || <span className="text-foreground/35">Not answered yet</span>}
                </p>
              )}
              </div>
            </div>
          ))}
          {editable && (
            <button
              type="button"
              data-testid={`knowledge-${scope}-add-question`}
              onClick={addQuestion}
              className="glass-pill pill h-11 flex items-center justify-center gap-1.5 text-[13.5px] font-semibold text-foreground/70 hover-elevate active-elevate-2"
            >
              <Plus size={15} strokeWidth={2} />
              Add your own question
            </button>
          )}
        </div>
        </section>

        {/* ── Sources (LinkedIn / website / files) ── */}
        <section>
        <SectionHeader count={bundle.sources.length}>Sources</SectionHeader>
        <div className="flex flex-col gap-3" data-testid={`knowledge-${scope}-sources`}>
          {bundle.sources.length > 0 && (
            <div className="rp-card rounded-3xl overflow-hidden">
              {bundle.sources.map((src, i) => {
                const Icon = sourceIcon(src);
                const canRemove = editable && src.type !== 'linkedin';
                return (
                  <div key={src.id}>
                    {i > 0 && (
                      <div className="ml-[60px] h-px bg-foreground/[0.06] dark:bg-white/[0.06]" />
                    )}
                    <div
                      data-testid={`source-${src.id}`}
                      className="group px-4 py-3 flex items-center gap-3 hover-elevate active-elevate-2"
                    >
                      <div className="h-9 w-9 shrink-0 rounded-xl glass-pill flex items-center justify-center text-icon">
                        <Icon size={16} strokeWidth={1.8} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[14px] font-medium text-foreground truncate">{src.title}</span>
                          <SourceStatus status={src.status} />
                        </div>
                        <div className="text-[12px] text-foreground/50 truncate">{src.hint}</div>
                      </div>
                      <span className="text-[11.5px] text-foreground/40 shrink-0">{src.meta}</span>
                      {canRemove && (
                        <button
                          type="button"
                          aria-label="Remove source"
                          data-testid={`source-remove-${src.id}`}
                          onClick={() => removeSource(src.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-icon-muted hover-elevate active-elevate-2"
                        >
                          <Trash2 size={13} strokeWidth={1.8} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {editable ? (
            <SourceAdders scope={scope} onFiles={addFiles} onUrl={addUrl} />
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
        </section>
        </div>

        {/* Auto-save: changes are kept live; no explicit Save button. */}
      </motion.div>
    </ViewShell>
  );
}

// ── Source adders: drag-&-drop file upload + add-URL row ──────────
function SourceAdders({
  scope,
  onFiles,
  onUrl,
}: {
  scope: 'personal' | 'workspace';
  onFiles: (files: FileList | File[]) => void;
  onUrl: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [urlOpen, setUrlOpen] = useState(false);
  const [urlVal, setUrlVal] = useState('');

  const submitUrl = () => {
    if (urlVal.trim()) {
      onUrl(urlVal);
      setUrlVal('');
      setUrlOpen(false);
    }
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div
        data-testid={`knowledge-${scope}-dropzone`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files?.length) onFiles(e.dataTransfer.files);
        }}
        className={`cursor-pointer rounded-2xl border border-dashed px-4 py-5 flex flex-col items-center justify-center gap-1.5 text-center transition-colors ${
          dragging
            ? 'border-[#2F6BFF] bg-[#2F6BFF]/[0.06]'
            : 'border-foreground/15 hover:border-foreground/30 bg-foreground/[0.02] dark:bg-white/[0.02]'
        }`}
      >
        <UploadCloud size={20} strokeWidth={1.8} className="text-icon-muted" />
        <div className="text-[13px] font-medium text-foreground/75">
          Drop files here, or click to upload
        </div>
        <div className="text-[11.5px] text-foreground/40">PDF, DOC, TXT</div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.txt,.md"
          className="hidden"
          data-testid={`knowledge-${scope}-file-input`}
          onChange={(e) => {
            if (e.target.files?.length) onFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {urlOpen ? (
        <div className="flex items-center gap-2">
          <input
            autoFocus
            value={urlVal}
            onChange={(e) => setUrlVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitUrl();
              if (e.key === 'Escape') {
                setUrlOpen(false);
                setUrlVal('');
              }
            }}
            placeholder="https://your-website.com"
            data-testid={`knowledge-${scope}-url-input`}
            className="flex-1 rounded-xl bg-foreground/[0.035] dark:bg-white/[0.04] px-3 py-2.5 text-[13.5px] text-foreground/90 placeholder:text-foreground/35 outline-none focus:bg-foreground/[0.06] transition-colors"
          />
          <button
            type="button"
            onClick={submitUrl}
            data-testid={`knowledge-${scope}-url-submit`}
            className="pill h-10 px-4 flex items-center gap-1.5 text-[13px] font-semibold text-white hover-elevate active-elevate-2"
            style={{ background: '#2F6BFF' }}
          >
            Add
          </button>
        </div>
      ) : (
        <button
          type="button"
          data-testid={`knowledge-${scope}-add-url`}
          onClick={() => setUrlOpen(true)}
          className="glass-pill pill h-11 flex items-center justify-center gap-1.5 text-[13.5px] font-semibold text-foreground/70 hover-elevate active-elevate-2"
        >
          <Globe size={15} strokeWidth={2} />
          Add a website or URL
        </button>
      )}
    </div>
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
// "Select a conversation" empty detail (same ReplaiyLogo + copy shape). On
// desktop the list column sits beside this; on mobile bare /ai shows the
// full-screen list instead, so this reads mainly as a desktop affordance.
// ════════════════════════════════════════════════════════════════
function EmptyAiDetail() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
      <div className="mb-4">
        <ReplaiyLogo size={56} />
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
// detail (or the empty-state for bare /ai). State comes from ReplaiyContext so
// edits here reflect live in the AiList column. Each detail enters with an
// Apple-spring slide, mirroring opening a conversation/campaign.
// ════════════════════════════════════════════════════════════════
export function MijnAi() {
  const [loc, navigate] = useLocation();
  const { persona, setPersona, workspace, setWorkspace } = useReplaiy();

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
