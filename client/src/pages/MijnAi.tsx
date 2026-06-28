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
  Languages as LanguagesIcon,
  Sparkles,
  ChevronDown,
  Search,
  X,
} from 'lucide-react';
import { useReplaiy } from '@/state/ReplaiyContext';
import { ReplaiyLogo } from '@/components/Logo';
import { PersonaExperience, CUSTOM_AGENT_GOLD } from '@/components/PersonaExperience';
import { GlassPopover } from '@/components/GlassPopover';
import mascotCustomGold from '@/assets/preset_custom_gold.png';
import iconPersona from '@/assets/ai_icon_persona.png';
import iconPersonal from '@/assets/ai_icon_personal.png';
import iconWorkspace from '@/assets/ai_icon_workspace.png';
import {
  LANGUAGE_LABELS,
  DRIVE_LABELS,
  DRIVE_SUBLINES,
  type Persona,
  type LanguageCode,
  type Drive,
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

function GlassTextarea({
  value,
  onChange,
  placeholder,
  rows = 3,
  testId,
  bare = false,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  testId?: string;
  /** When true, the textarea has NO surface of its own (no background, border,
   *  radius, inset shadow or padding): the surrounding rp-card IS the field, so
   *  the user types straight into the card instead of into a framed block-in-
   *  block. Only the text styling + auto-grow behaviour is kept. */
  bare?: boolean;
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
      className={
        bare
          ? 'w-full resize-none bg-transparent p-0 text-[14px] leading-[1.5] text-foreground/90 placeholder:text-foreground/35 outline-none overflow-hidden'
          : 'w-full resize-none rounded-2xl bg-foreground/[0.035] dark:bg-white/[0.04] px-3.5 py-2.5 text-[14px] leading-[1.5] text-foreground/90 placeholder:text-foreground/35 outline-none focus:bg-foreground/[0.06] dark:focus:bg-white/[0.06] transition-colors overflow-hidden'
      }
      style={bare ? undefined : { boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.05)' }}
    />
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
// Fine-tune primitives — Languages, Voice, Anything-else.
// Built only on design-system glass (glass, glass-pill, glass-strong,
// hover-elevate, active-elevate-2) and Apple springs. The ONE accent is
// blue #2F6BFF (--ai-accent). No native <select>.
// ════════════════════════════════════════════════════════════════

const AI_ACCENT = '#2F6BFF';

// The curated set of POPULAR languages shown as quick-tap chips, in order.
// Any other language is reachable through the searchable "More languages"
// popover, and any selected non-popular language is also surfaced as a chip.
const POPULAR_LANGUAGES: LanguageCode[] = ['en', 'nl', 'de', 'fr', 'es', 'it', 'pt'];

// A small, restated section header that matches the top of the pane
// (PersonaExperience): a semibold label + a muted sub-line.
function FineTuneSection({
  label,
  sub,
  children,
  locked = false,
}: {
  label: string;
  sub: string;
  children: React.ReactNode;
  /** Shows a gold "Locked" badge next to the section label (custom agent). */
  locked?: boolean;
}) {
  return (
    <section>
      <div className="px-2 mb-1 flex items-center justify-between gap-3">
        <span className="text-[12.5px] font-semibold tracking-[-0.005em] text-foreground">
          {label}
        </span>
        {locked && <LockBadge />}
      </div>
      <p className="px-2 text-[11.5px] leading-[1.45] text-foreground/45 mb-3">{sub}</p>
      {children}
    </section>
  );
}

// One selectable language chip. Toggles on/off. Selected = blue accent fill
// + check; unselected = quiet glass pill that lifts on hover.
function LanguageChip({
  label,
  active,
  onToggle,
  testId,
}: {
  label: string;
  active: boolean;
  onToggle: () => void;
  testId?: string;
}) {
  return (
    <motion.button
      type="button"
      data-testid={testId}
      aria-pressed={active}
      onClick={onToggle}
      whileTap={{ scale: 0.95 }}
      transition={APPLE_SPRING}
      className={`relative inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-[13px] font-medium transition-colors ${
        active
          ? 'text-white active-elevate-2'
          : 'glass-pill text-foreground/70 hover-elevate active-elevate-2'
      }`}
      style={
        active
          ? {
              background: AI_ACCENT,
              boxShadow:
                'inset 0 1px 0 rgba(255,255,255,0.28), 0 4px 14px -6px rgba(47,107,255,0.7)',
            }
          : undefined
      }
    >
      <AnimatePresence initial={false} mode="wait">
        {active && (
          <motion.span
            key="check"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 13, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={APPLE_SPRING}
            className="inline-flex items-center justify-center overflow-hidden"
          >
            <Check size={13} strokeWidth={2.6} className="text-white" />
          </motion.span>
        )}
      </AnimatePresence>
      {label}
    </motion.button>
  );
}

// The fallback-language picker. A glass-pill trigger that opens a compact
// floating glass popover of options (NOT a native select), built on the shared
// GlassPopover (same glass-pill surface as SnoozePopover). Chooses the single
// language used when a lead speaks something the user does not.
function FallbackPicker({
  value,
  onChange,
}: {
  value: LanguageCode;
  onChange: (code: LanguageCode) => void;
}) {
  // Searchable, identical pattern to MoreLanguagesPicker (query + autofocus on
  // open, reset on close, w-60, divider under the search row, empty-state). The
  // only difference is SINGLE-select: picking a language fires onChange and
  // closes the popover (no toggling, no staying open).
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const codes = Object.keys(LANGUAGE_LABELS) as LanguageCode[];
  const q = query.trim().toLowerCase();
  const filtered = q
    ? codes.filter((code) => LANGUAGE_LABELS[code].toLowerCase().includes(q))
    : codes;

  return (
    <GlassPopover
      anchor="top"
      align="right"
      width="w-60"
      testId="fallback-language-menu"
      onOpenChange={(next) => {
        if (next) {
          requestAnimationFrame(() => inputRef.current?.focus());
        } else {
          setQuery('');
        }
      }}
      trigger={({ open, toggle }) => (
        <button
          type="button"
          data-testid="fallback-language-trigger"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={toggle}
          className="glass-pill inline-flex items-center gap-1.5 h-9 pl-3.5 pr-3 rounded-full text-[13px] font-medium text-foreground/80 hover-elevate active-elevate-2"
        >
          {LANGUAGE_LABELS[value]}
          <motion.span animate={{ rotate: open ? 180 : 0 }} transition={APPLE_SPRING} className="inline-flex">
            <ChevronDown size={14} strokeWidth={2} className="text-icon-muted" />
          </motion.span>
        </button>
      )}
    >
      {({ close }) => (
        <>
          <div className="flex items-center gap-2 h-9 px-2.5 mb-1">
            <Search size={15} strokeWidth={1.8} className="shrink-0 text-foreground/75" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search language"
              data-testid="fallback-language-search"
              className="flex-1 min-w-0 bg-transparent border-0 outline-none text-[13px] text-foreground placeholder:text-foreground/40"
            />
          </div>
          <div className="h-px bg-foreground/[0.07] dark:bg-white/[0.07] mx-1 mb-1" />
          <div className="max-h-64 overflow-y-auto no-scrollbar" role="listbox">
            {filtered.length === 0 ? (
              <div className="px-2.5 py-3 text-[12.5px] text-foreground/45">
                No languages found
              </div>
            ) : (
              filtered.map((code) => {
                const selected = code === value;
                return (
                  <button
                    key={code}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    data-testid={`fallback-language-${code}`}
                    onClick={() => {
                      onChange(code);
                      close();
                    }}
                    className={`w-full flex items-center justify-between gap-2 h-9 px-2.5 rounded-xl text-[13px] text-left transition-colors hover-elevate active-elevate-2 ${
                      selected ? 'font-semibold text-foreground' : 'text-foreground/70'
                    }`}
                  >
                    {LANGUAGE_LABELS[code]}
                    {selected && <Check size={14} strokeWidth={2.6} style={{ color: AI_ACCENT }} />}
                  </button>
                );
              })
            )}
          </div>
        </>
      )}
    </GlassPopover>
  );
}

// The "More languages" picker. A glass-pill trigger (styled exactly like the
// FallbackPicker trigger) that opens a SEARCHABLE popover listing every
// language. Built on the shared GlassPopover (same floating glass-pill surface
// as SnoozePopover, no hard border/fill/shadow). It opens UPWARD (anchor 'top')
// so it never falls over the Fallback row below. Each row toggles that language
// on/off via onToggle and shows a blue Check when selected; the popover stays
// open after a toggle so several languages can be added in one go and the chips
// row updates live.
function MoreLanguagesPicker({
  selected,
  onToggle,
}: {
  selected: LanguageCode[];
  onToggle: (code: LanguageCode) => void;
}) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const codes = Object.keys(LANGUAGE_LABELS) as LanguageCode[];
  const q = query.trim().toLowerCase();
  const filtered = q
    ? codes.filter((code) => LANGUAGE_LABELS[code].toLowerCase().includes(q))
    : codes;

  return (
    <GlassPopover
      anchor="top"
      width="w-60"
      testId="more-languages-menu"
      onOpenChange={(next) => {
        if (next) {
          requestAnimationFrame(() => inputRef.current?.focus());
        } else {
          setQuery('');
        }
      }}
      trigger={({ open, toggle }) => (
        <button
          type="button"
          data-testid="more-languages-trigger"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={toggle}
          className="glass-pill inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-[13px] font-medium text-foreground/80 hover-elevate active-elevate-2"
        >
          <Plus size={14} strokeWidth={2.2} className="text-icon-muted" />
          More languages
        </button>
      )}
    >
      <div className="flex items-center gap-2 h-9 px-2.5 mb-1">
        <Search size={15} strokeWidth={1.8} className="shrink-0 text-foreground/75" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search languages"
          data-testid="more-languages-search"
          className="flex-1 min-w-0 bg-transparent border-0 outline-none text-[13px] text-foreground placeholder:text-foreground/40"
        />
      </div>
      <div className="h-px bg-foreground/[0.07] dark:bg-white/[0.07] mx-1 mb-1" />
      <div className="max-h-64 overflow-y-auto no-scrollbar" role="listbox">
        {filtered.length === 0 ? (
          <div className="px-2.5 py-3 text-[12.5px] text-foreground/45">
            No languages found
          </div>
        ) : (
          filtered.map((code) => {
            const isOn = selected.includes(code);
            return (
              <button
                key={code}
                type="button"
                role="option"
                aria-selected={isOn}
                data-testid={`more-language-${code}`}
                onClick={() => onToggle(code)}
                className={`w-full flex items-center justify-between gap-2 h-9 px-2.5 rounded-xl text-[13px] text-left transition-colors hover-elevate active-elevate-2 ${
                  isOn ? 'font-semibold text-foreground' : 'text-foreground/70'
                }`}
              >
                {LANGUAGE_LABELS[code]}
                {isOn && <Check size={14} strokeWidth={2.6} style={{ color: AI_ACCENT }} />}
              </button>
            );
          })
        )}
      </div>
    </GlassPopover>
  );
}

// ════════════════════════════════════════════════════════════════
// PERSONA detail — personality preset + fine-tune (languages, voice, more)
// ════════════════════════════════════════════════════════════════
// -- CUSTOM AGENT read-only teaser (Coming soon) --------------------
// A peek at how a fully custom agent is configured. Everything is
// non-interactive: gated behind a future paid plan. Gold accent (#C59011) is
// used ONLY here and on the Custom agent card; blue stays the single UI accent
// everywhere else.

// The example configuration shown in the read-only panel. Local to this
// surface, and structured into the four agreed groups: Identity, Strategy,
// Guardrails, Advanced. It reflects a custom agent CLONED from the user's
// selected personality (Warm & Personal), then ready to fine-tune.
const CUSTOM_AGENT_PREVIEW = {
  // ── Identity ──────────────────────────────────────────────────
  voice:
    'Direct, warm and human. Talks like a founder who is genuinely interested, no sales talk, no cliches. Short sentences, the occasional wink.',
  formality: 'neutral' as 'informal' | 'neutral' | 'formal',
  length: 'short' as 'short' | 'medium',
  // ── Strategy ──────────────────────────────────────────────────
  drive: 'balanced' as Drive,
  qualifying: 'thorough' as 'light' | 'thorough',
  // ── Guardrails ────────────────────────────────────────────────
  dos: [
    'Lead with a specific, genuine observation',
    'Ask one sharp qualifying question',
    "Mirror the lead's energy and language",
  ],
  donts: [
    'No generic openers',
    'No pitching before understanding fit',
    'No pressure when intent is unclear',
  ],
  // ── Advanced ──────────────────────────────────────────────────
  customInstructions:
    'Optional. Add precise instructions that layer on top of the settings above, e.g. "Always reference their latest funding round if relevant."',
} as const;

// A small gold lock chip used near custom-agent group headers and on locked
// controls. Gold (#C59011) is the ONLY non-blue accent, reserved for custom.
function LockBadge({ label = 'Locked' }: { label?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-semibold"
      style={{ color: CUSTOM_AGENT_GOLD }}
    >
      <Lock size={10} strokeWidth={2.6} />
      {label}
    </span>
  );
}

// A DISABLED segmented control that looks like the real future toggle: glass
// track, the active segment filled in blue, the rest quiet. Non-interactive
// (cursor-default, no focus ring, reduced opacity) so it reads as "this is
// what you will be able to configure", premium, not greyed-out-broken.
function LockedSegmented({
  options,
  activeValue,
  testId,
}: {
  options: { value: string; label: string }[];
  activeValue: string;
  testId?: string;
}) {
  return (
    <div
      data-testid={testId}
      aria-disabled="true"
      className="glass-pill inline-flex items-center gap-1 p-1 rounded-full cursor-default select-none opacity-75"
    >
      {options.map((opt) => {
        const active = opt.value === activeValue;
        return (
          <span
            key={opt.value}
            className={`inline-flex items-center justify-center h-8 px-4 rounded-full text-[13px] font-medium transition-colors ${
              active ? 'text-white' : 'text-foreground/55'
            }`}
            style={
              active
                ? {
                    background: AI_ACCENT,
                    boxShadow:
                      'inset 0 1px 0 rgba(255,255,255,0.28), 0 4px 14px -6px rgba(47,107,255,0.7)',
                  }
                : undefined
            }
          >
            {opt.label}
          </span>
        );
      })}
    </div>
  );
}

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
  // Whether the Custom agent card is the active selection. This is pure UI
  // state (it deliberately does NOT touch persona.activePresetId, so it never
  // breaks applyPreset / resolvers). Selecting the custom agent reveals the
  // inline custom fine-tune section below; picking a normal preset OR editing
  // any standard control clears it (selection is mutually exclusive).
  const [customSelected, setCustomSelected] = useState(false);
  // Fine-tuning any control moves the persona off its preset into "custom"
  // (activePresetId = null), so the preset cards no longer show as selected.
  // Editing a standard control also leaves the custom-agent selection.
  const patchTone = (p: Partial<typeof tone>) => {
    setCustomSelected(false);
    setPersona((prev) => ({ ...prev, activePresetId: null, tone: { ...prev.tone, ...p } }));
  };

  // The languages the user can hold a meeting in. Toggling never empties the
  // set below one (you must speak at least one language). All ~15 labels.
  const toggleLanguage = (code: LanguageCode) => {
    const has = tone.languages.includes(code);
    if (has && tone.languages.length === 1) return; // keep at least one
    const next = has
      ? tone.languages.filter((c) => c !== code)
      : [...tone.languages, code];
    // If the fallback is no longer a spoken language, move it to the first one.
    const fallbackOk = next.includes(tone.fallbackLanguage);
    patchTone({
      languages: next,
      fallbackLanguage: fallbackOk ? tone.fallbackLanguage : next[0],
    });
  };

  // The chips shown in the row = popular set + any selected non-popular
  // languages (e.g. Japanese), de-duplicated. Popular order first, then any
  // extra selected ones after, so newly added languages stay visible/removable.
  const visibleLanguageCodes = useMemo(() => {
    const extras = tone.languages.filter((c) => !POPULAR_LANGUAGES.includes(c));
    return [...POPULAR_LANGUAGES, ...extras];
  }, [tone.languages]);

  // ── Reusable interactive sections ──────────────────────────────
  // The Languages card and the Anything-else section are identical in the
  // standard Fine-tune and the inline Custom-agent section (languages are the
  // user's own, so they stay live in both). Factored out so both render the
  // EXACT same JSX, keeping the two views pixel-consistent.
  const languagesSection = (
    <FineTuneSection
      label="Languages you speak"
      sub="Your AI replies in each lead's own language automatically. It only moves a lead to a live conversation in a language you speak, so you are never booked into one you cannot hold."
    >
      <div className="rp-card rounded-3xl p-5 lg:p-6" data-testid="persona-languages">
        <div className="flex items-center gap-2 mb-3">
          <LanguagesIcon size={15} strokeWidth={1.9} style={{ color: AI_ACCENT }} />
          <span className="text-[12px] font-semibold text-foreground/65">
            I can hold a live conversation in
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2" data-testid="tone-languages">
          {visibleLanguageCodes.map((code) => (
            <LanguageChip
              key={code}
              testId={`tone-language-${code}`}
              label={LANGUAGE_LABELS[code]}
              active={tone.languages.includes(code)}
              onToggle={() => toggleLanguage(code)}
            />
          ))}
          <MoreLanguagesPicker selected={tone.languages} onToggle={toggleLanguage} />
        </div>

        <div className="h-px bg-foreground/[0.07] dark:bg-white/[0.07] my-5" />

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <div className="min-w-0">
            <div className="text-[12px] font-semibold text-foreground/65">
              Fallback language
            </div>
            <div className="text-[11.5px] leading-[1.45] text-foreground/45 mt-0.5 max-w-sm">
              Used when a lead speaks a language you have not selected above.
            </div>
          </div>
          <FallbackPicker
            value={tone.fallbackLanguage}
            onChange={(fallbackLanguage) => patchTone({ fallbackLanguage })}
          />
        </div>
      </div>
    </FineTuneSection>
  );

  const anythingElseSection = (
    <FineTuneSection
      label="Anything else?"
      sub='A few personal style rules for how your AI writes, like "keep it casual" or "never use exclamation marks". For facts about your product or pricing, use Workspace knowledge.'
    >
      <div className="rp-card rounded-3xl p-5 lg:p-6" data-testid="persona-extra">
        <GlassTextarea
          bare
          testId="tone-extra-notes"
          value={tone.extraNotes}
          onChange={(extraNotes) => patchTone({ extraNotes })}
          placeholder="e.g. no em-dashes, keep it casual, never use exclamation marks"
          rows={3}
        />
      </div>
    </FineTuneSection>
  );

  return (
    <ViewShell title="Persona" onBack={onBack}>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        {/* Living top: preset personalities + live mascot preview. The custom
            agent card now selects like a preset (mutually exclusive). */}
        <PersonaExperience
          persona={persona}
          setPersona={setPersona}
          customActive={customSelected}
          onSelectCustom={() => setCustomSelected(true)}
          onPresetPicked={() => setCustomSelected(false)}
        />

        {/* Fine-tune — switches on the selection. With a normal preset (or no
            custom selection) the standard Fine-tune shows; selecting the custom
            agent reveals the inline custom section in the SAME container,
            spacing and design (just more, mostly read-only, fields). */}
        <AnimatePresence mode="wait" initial={false}>
          {customSelected ? (
            <motion.div
              key="custom"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={APPLE_SPRING}
              className="flex flex-col gap-6 md:gap-7 mt-8"
              data-testid="custom-agent-inline"
            >
              {/* Compact lead-in: gold Coming soon pill + one line of copy. */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-2">
                <span
                  className="glass-pill inline-flex items-center gap-1 h-[22px] px-2 rounded-full text-[11px] font-semibold"
                  style={{ color: CUSTOM_AGENT_GOLD }}
                >
                  <Lock size={10} strokeWidth={2.6} />
                  Coming soon
                </span>
                <span className="text-[11.5px] leading-[1.45] text-foreground/45">
                  Your custom agent starts from your selected personality, then you fine-tune every detail.
                </span>
              </div>

              {/* Languages: same live card as the standard view (the
                  languages are the user's own, so they stay editable here). */}
              {languagesSection}

              {/* GROUP A: Identity, who your agent is. One rp-card, fields
                  separated by hairline dividers (same rhythm as the standard
                  Languages card). No block-in-block. */}
              <FineTuneSection label="Identity" sub="Who your agent is." locked>
                <div className="rp-card rounded-3xl p-5 lg:p-6">
                  {/* Voice: label + read-only text straight in the card (the
                      card IS the field, like the bare GlassTextarea). */}
                  <div className="text-[12px] font-semibold text-foreground/65 mb-2">Voice</div>
                  <div className="text-[14px] leading-[1.5] text-foreground/90">
                    {CUSTOM_AGENT_PREVIEW.voice}
                  </div>

                  <div className="h-px bg-foreground/[0.07] dark:bg-white/[0.07] my-5" />

                  {/* Formality: label + disabled segmented control on one row. */}
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
                    <span className="text-[12px] font-semibold text-foreground/65">Formality</span>
                    <LockedSegmented
                      testId="custom-formality"
                      activeValue={CUSTOM_AGENT_PREVIEW.formality}
                      options={[
                        { value: 'informal', label: 'Informal' },
                        { value: 'neutral', label: 'Neutral' },
                        { value: 'formal', label: 'Formal' },
                      ]}
                    />
                  </div>

                  <div className="h-px bg-foreground/[0.07] dark:bg-white/[0.07] my-5" />

                  {/* Message length: label + disabled segmented control. */}
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
                    <span className="text-[12px] font-semibold text-foreground/65">Message length</span>
                    <LockedSegmented
                      testId="custom-length"
                      activeValue={CUSTOM_AGENT_PREVIEW.length}
                      options={[
                        { value: 'short', label: 'Short' },
                        { value: 'medium', label: 'Medium' },
                      ]}
                    />
                  </div>
                </div>
              </FineTuneSection>

              {/* GROUP B: Strategy, how it works toward your goal. The Drive
                  axis replaces the old approach + closing + push rows. One
                  rp-card, hairline divider between the two controls. */}
              <FineTuneSection label="Strategy" sub="How it works toward your goal." locked>
                <div className="rp-card rounded-3xl p-5 lg:p-6">
                  {/* Drive: the KEY simplification, one 3-segment control. */}
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
                    <div className="min-w-0">
                      <span className="text-[12px] font-semibold text-foreground/65">Drive</span>
                      <div className="text-[11.5px] leading-[1.45] text-foreground/45 mt-0.5">
                        {DRIVE_SUBLINES[CUSTOM_AGENT_PREVIEW.drive]}
                      </div>
                    </div>
                    <LockedSegmented
                      testId="custom-drive"
                      activeValue={CUSTOM_AGENT_PREVIEW.drive}
                      options={[
                        { value: 'patient', label: DRIVE_LABELS.patient },
                        { value: 'balanced', label: DRIVE_LABELS.balanced },
                        { value: 'assertive', label: DRIVE_LABELS.assertive },
                      ]}
                    />
                  </div>

                  <div className="h-px bg-foreground/[0.07] dark:bg-white/[0.07] my-5" />

                  {/* Qualifying depth: label + disabled segmented control. */}
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
                    <span className="text-[12px] font-semibold text-foreground/65">Qualifying depth</span>
                    <LockedSegmented
                      testId="custom-qualifying"
                      activeValue={CUSTOM_AGENT_PREVIEW.qualifying}
                      options={[
                        { value: 'light', label: 'Light' },
                        { value: 'thorough', label: 'Thorough' },
                      ]}
                    />
                  </div>
                </div>
              </FineTuneSection>

              {/* GROUP C: Guardrails, the rules it always follows. One rp-card,
                  two columns of plain text rules (no inner cards). */}
              <FineTuneSection label="Guardrails" sub="The rules it always follows." locked>
                <div className="rp-card rounded-3xl p-5 lg:p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
                    <div>
                      <div className="text-[12px] font-semibold text-foreground/65 mb-2">Always do</div>
                      <ul className="flex flex-col gap-2">
                        {CUSTOM_AGENT_PREVIEW.dos.map((item) => (
                          <li
                            key={item}
                            className="flex items-start gap-2 text-[14px] leading-[1.5] text-foreground/90"
                          >
                            <Check
                              size={14}
                              strokeWidth={2.4}
                              className="mt-0.5 shrink-0"
                              style={{ color: AI_ACCENT }}
                            />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <div className="text-[12px] font-semibold text-foreground/65 mb-2">Never do</div>
                      <ul className="flex flex-col gap-2">
                        {CUSTOM_AGENT_PREVIEW.donts.map((item) => (
                          <li
                            key={item}
                            className="flex items-start gap-2 text-[14px] leading-[1.5] text-foreground/90"
                          >
                            <X
                              size={14}
                              strokeWidth={2.4}
                              className="mt-0.5 shrink-0 text-foreground/40"
                            />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </FineTuneSection>

              {/* GROUP D: Advanced, optional, for fine control. One rp-card,
                  the instructions text straight in the card (no inner block). */}
              <FineTuneSection label="Advanced" sub="Optional custom instructions, for fine control." locked>
                <div className="rp-card rounded-3xl p-5 lg:p-6">
                  <div className="text-[14px] leading-[1.5] text-foreground/55">
                    {CUSTOM_AGENT_PREVIEW.customInstructions}
                  </div>
                </div>
              </FineTuneSection>

              {/* Single gold upgrade button. Tasteful, does nothing yet. */}
              <div className="px-2">
                <motion.button
                  type="button"
                  data-testid="custom-agent-upgrade"
                  whileTap={{ scale: 0.97 }}
                  transition={APPLE_SPRING}
                  className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl text-white text-[14px] font-semibold hover-elevate active-elevate-2"
                  style={{
                    background: CUSTOM_AGENT_GOLD,
                    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.28), 0 6px 20px -6px ${CUSTOM_AGENT_GOLD}aa`,
                  }}
                >
                  <Sparkles size={15} strokeWidth={2.2} />
                  Upgrade to customize
                </motion.button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="standard"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={APPLE_SPRING}
              className="flex flex-col gap-6 md:gap-7 mt-8"
            >
              {/* Languages */}
              {languagesSection}

              {/* Voice is NOT a standard control: it is set by the chosen
                  personality under the hood, and is editable only in the custom
                  agent. Personal style tweaks go in "Anything else?" below. */}

              {/* Anything else? */}
              {anythingElseSection}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Auto-save: changes are kept live; no explicit Save button. */}
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
      hint: 'Web page, the AI reads it for context',
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

        <div className="flex flex-col gap-6 md:gap-7">
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
              {/* Hairline between question and answer, matching Persona's
                  field rhythm (h-px divider, my-4). The answer then sits
                  DIRECTLY in this card via the `bare` GlassTextarea, so
                  there is no inner framed box (no block-in-block). */}
              <div className="h-px bg-foreground/[0.07] dark:bg-white/[0.07] my-4" />
              {editable ? (
                <GlassTextarea
                  bare
                  testId={`answer-${q.id}`}
                  value={q.answer}
                  onChange={(v) => setAnswer(q.id, v)}
                  placeholder="Your answer…"
                  rows={2}
                />
              ) : (
                <p className="text-[13.5px] leading-[1.5] text-foreground/80 whitespace-pre-wrap">
                  {q.answer || <span className="text-foreground/35">Not answered yet</span>}
                </p>
              )}
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
