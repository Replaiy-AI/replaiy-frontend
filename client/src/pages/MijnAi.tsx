// ─────────────────────────────────────────────────────────────────
// MijnAi — de "Mijn AI" surface (4e nav-tab).
//
// Eén plek voor alles wat bepaalt hoe je AI zich gedraagt:
//   1. Persona            → tone_profile + strategy_profile (seat-niveau)
//   2. Knowledge          → Persoonlijk | Workspace (rol-gated)
//
// Niks verstopt: de avatar blijft vrij voor later account-gebruik.
//
// Karakter: configuratie (instellen), niet interactie. De toekomstige
// "Training center" wordt een aparte surface waar je je AION traint/test
// en feedback teruggeeft naar deze persona.
//
// Bouwt volledig op design-system primitives (glass-pill, stilt-card,
// hover-elevate, active-elevate-2, ProfileInitials). Geen hand-rolled glass.
// Layout-shell matcht de Briefing-pagina (gold-standard sibling surface):
//   flex flex-col h-full min-h-0 overflow-y-auto + max-w container.
//
// Mock-fase: leest/schrijft lokale kopieën van mockPersona / mockWorkspace
// via React-state. Backend-koppeling (upsert_persona, rag_documents) volgt
// in de API-laag.
// ─────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles,
  Plus,
  FileText,
  StickyNote,
  Link2,
  Trash2,
  Check,
  Lock,
  User as UserIcon,
  Building2,
} from 'lucide-react';
import { ProfileInitials } from '@/components/GlassCircleButton';
import {
  mockPersona,
  type Persona,
  type ToneFormality,
  type ToneLength,
  type StrategyStance,
  type PersonaKnowledgeDoc,
} from '@/data/mockPersona';
import {
  mockWorkspace,
  canEditWorkspaceKnowledge,
  type Workspace,
} from '@/data/mockWorkspace';

// ── Kleine inline segmented selector op glass-pill basis ──────────
// Lichtgewicht alternatief voor GlassSegmentedToggle (die is icon/nav-
// georiënteerd). Zelfde glass-taal: pill-track + hover/active-elevate.
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
    <div
      data-testid={testId}
      className="glass-pill pill inline-flex items-center p-1 gap-1 w-full"
    >
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
              active
                ? 'text-foreground active-elevate-2'
                : 'text-foreground/55 hover-elevate'
            }`}
            style={
              active
                ? {
                    background:
                      'linear-gradient(180deg, rgba(255,255,255,0.82), rgba(255,255,255,0.60))',
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

// ── Section header (consistent met AiSummarySheet / Briefing) ─────
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

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[12px] font-semibold text-foreground/65 mb-1.5">
      {children}
    </span>
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
  return (
    <textarea
      data-testid={testId}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full resize-none rounded-2xl bg-foreground/[0.035] dark:bg-white/[0.04] px-3.5 py-2.5 text-[14px] leading-[1.5] text-foreground/90 placeholder:text-foreground/35 outline-none focus:bg-foreground/[0.06] dark:focus:bg-white/[0.06] transition-colors"
      style={{ boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.05)' }}
    />
  );
}

// ── Bewerkbare lijst (do's / don'ts) ──────────────────────────────
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
  /** dot kleur — blauw voor do's, neutraal voor don'ts */
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
            aria-label="Verwijder"
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
          aria-label="Toevoegen"
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

const KNOWLEDGE_ICON: Record<PersonaKnowledgeDoc['kind'], typeof FileText> = {
  pdf: FileText,
  doc: FileText,
  note: StickyNote,
  link: Link2,
};

// ── Knowledge-document rij ────────────────────────────────────────
function KnowledgeRow({
  doc,
  onRemove,
  testIdPrefix,
}: {
  doc: PersonaKnowledgeDoc;
  /** undefined = read-only (geen verwijder-knop, bv. workspace zonder rechten). */
  onRemove?: () => void;
  testIdPrefix: string;
}) {
  const Icon = KNOWLEDGE_ICON[doc.kind];
  return (
    <div
      data-testid={`${testIdPrefix}-${doc.id}`}
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
      {onRemove && (
        <button
          type="button"
          aria-label="Verwijder document"
          data-testid={`${testIdPrefix}-remove-${doc.id}`}
          onClick={onRemove}
          className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-icon-muted hover-elevate active-elevate-2"
        >
          <Trash2 size={13} strokeWidth={1.8} />
        </button>
      )}
    </div>
  );
}

export function MijnAi() {
  // Lokale, bewerkbare kopieën (mock-fase).
  const [persona, setPersona] = useState<Persona>(mockPersona);
  const [workspace, setWorkspace] = useState<Workspace>(mockWorkspace);
  // Welk knowledge-niveau is actief.
  const [knowledgeScope, setKnowledgeScope] = useState<'personal' | 'workspace'>('personal');

  const tone = persona.tone;
  const strategy = persona.strategy;
  const canEditWs = canEditWorkspaceKnowledge(workspace.currentRole);

  const patchTone = (p: Partial<typeof tone>) =>
    setPersona((prev) => ({ ...prev, tone: { ...prev.tone, ...p } }));
  const patchStrategy = (p: Partial<typeof strategy>) =>
    setPersona((prev) => ({ ...prev, strategy: { ...prev.strategy, ...p } }));

  const addPersonalDoc = () =>
    setPersona((prev) => ({
      ...prev,
      knowledge: [
        ...prev.knowledge,
        { id: `kn_${Date.now()}`, title: 'Nieuw document', kind: 'doc', hint: 'Nog te uploaden', meta: 'Concept' },
      ],
    }));
  const removePersonalDoc = (id: string) =>
    setPersona((prev) => ({ ...prev, knowledge: prev.knowledge.filter((d) => d.id !== id) }));

  const addWsDoc = () =>
    setWorkspace((prev) => ({
      ...prev,
      knowledge: [
        ...prev.knowledge,
        { id: `ws_${Date.now()}`, title: 'Nieuw document', kind: 'doc', hint: 'Nog te uploaden', meta: 'Concept' },
      ],
    }));
  const removeWsDoc = (id: string) =>
    setWorkspace((prev) => ({ ...prev, knowledge: prev.knowledge.filter((d) => d.id !== id) }));

  return (
    <div className="flex flex-col h-full min-h-0 overflow-y-auto no-scrollbar">
      {/* pt-20 op mobiel: de header moet vrij blijven van de persistente
          mobile top-chrome (avatar + search), die fixed op ~12+52px zweeft
          met content eronder. lg gebruikt de normale pt-10 (geen chrome). */}
      <div className="px-4 lg:px-8 pt-20 lg:pt-10 pb-28 lg:pb-12 max-w-2xl mx-auto w-full">
        {/* Page header */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <div className="flex items-center gap-2 text-foreground/70 mb-2">
            <Sparkles size={14} />
            <span className="text-[11px] uppercase tracking-wider font-semibold">Mijn AI</span>
          </div>
          <div className="flex items-center gap-3.5">
            <div
              className="h-12 w-12 shrink-0 rounded-full glass-pill flex items-center justify-center"
              data-testid="mijn-ai-avatar"
            >
              <ProfileInitials initials={persona.memberInitials} />
            </div>
            <div className="min-w-0">
              <h1 className="text-[24px] lg:text-[28px] font-semibold tracking-[-0.025em] leading-tight truncate">
                {persona.memberName}
              </h1>
              <p className="text-[14px] text-muted-foreground mt-0.5 truncate">{persona.role}</p>
            </div>
          </div>
        </motion.div>

        {/* ── SECTIE 1: Persona ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="mt-8"
        >
          <SectionLabel>Persona</SectionLabel>
          <p className="text-[13px] leading-[1.5] text-foreground/55 -mt-1 mb-4">
            Hoe je AI klinkt en welke strategie hij volgt in jouw LinkedIn-gesprekken.
          </p>

          {/* Tone of voice card */}
          <div className="stilt-card rounded-3xl p-4 lg:p-5 mb-3" data-testid="mijn-ai-tone">
            <div className="text-[13px] font-semibold text-foreground/80 mb-3">Tone of voice</div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <FieldLabel>Taal</FieldLabel>
                <SegmentedPills
                  testId="ai-tone-language"
                  value={tone.language}
                  onChange={(language) => patchTone({ language })}
                  options={[
                    { key: 'nl', label: 'Nederlands' },
                    { key: 'en', label: 'English' },
                  ]}
                />
              </div>
              <div>
                <FieldLabel>Lengte</FieldLabel>
                <SegmentedPills
                  testId="ai-tone-length"
                  value={tone.length}
                  onChange={(length) => patchTone({ length: length as ToneLength })}
                  options={[
                    { key: 'kort', label: 'Kort' },
                    { key: 'gemiddeld', label: 'Gem.' },
                    { key: 'uitgebreid', label: 'Lang' },
                  ]}
                />
              </div>
            </div>

            <div className="mb-3">
              <FieldLabel>Formaliteit</FieldLabel>
              <SegmentedPills
                testId="ai-tone-formality"
                value={tone.formality}
                onChange={(formality) => patchTone({ formality: formality as ToneFormality })}
                options={[
                  { key: 'informeel', label: 'Informeel' },
                  { key: 'neutraal', label: 'Neutraal' },
                  { key: 'formeel', label: 'Formeel' },
                ]}
              />
            </div>

            <div className="mb-4">
              <FieldLabel>Stem</FieldLabel>
              <GlassTextarea
                testId="ai-tone-voice"
                value={tone.voice}
                onChange={(voice) => patchTone({ voice })}
                placeholder="Beschrijf hoe je wilt klinken…"
                rows={4}
              />
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <FieldLabel>Do's</FieldLabel>
                <EditableList
                  testId="ai-tone-dos"
                  accent
                  items={tone.dos}
                  onChange={(dos) => patchTone({ dos })}
                  placeholder="Voeg een do toe…"
                />
              </div>
              <div>
                <FieldLabel>Don'ts</FieldLabel>
                <EditableList
                  testId="ai-tone-donts"
                  accent={false}
                  items={tone.donts}
                  onChange={(donts) => patchTone({ donts })}
                  placeholder="Voeg een don't toe…"
                />
              </div>
            </div>
          </div>

          {/* Strategie card */}
          <div className="stilt-card rounded-3xl p-4 lg:p-5" data-testid="mijn-ai-strategy">
            <div className="text-[13px] font-semibold text-foreground/80 mb-3">Strategie</div>

            <div className="mb-3">
              <FieldLabel>Aanpak</FieldLabel>
              <SegmentedPills
                testId="ai-strategy-stance"
                value={strategy.stance}
                onChange={(stance) => patchStrategy({ stance: stance as StrategyStance })}
                options={[
                  { key: 'geduldig', label: 'Geduldig' },
                  { key: 'gebalanceerd', label: 'Gebalanceerd' },
                  { key: 'push', label: 'Push' },
                ]}
              />
            </div>

            <div className="mb-3">
              <FieldLabel>Kwalificeren</FieldLabel>
              <GlassTextarea
                testId="ai-strategy-qualification"
                value={strategy.qualification}
                onChange={(qualification) => patchStrategy({ qualification })}
                placeholder="Hoe achterhaal je fit en intentie?"
                rows={2}
              />
            </div>

            <div className="mb-3">
              <FieldLabel>Closen</FieldLabel>
              <GlassTextarea
                testId="ai-strategy-closing"
                value={strategy.closing}
                onChange={(closing) => patchStrategy({ closing })}
                placeholder="Hoe en wanneer stel je de volgende stap voor?"
                rows={2}
              />
            </div>

            <div>
              <FieldLabel>Push vs. wachten</FieldLabel>
              <GlassTextarea
                testId="ai-strategy-pushwait"
                value={strategy.pushVsWait}
                onChange={(pushVsWait) => patchStrategy({ pushVsWait })}
                placeholder="Wanneer wacht je liever dan te duwen?"
                rows={2}
              />
            </div>
          </div>
        </motion.div>

        {/* ── SECTIE 2: Knowledge ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="mt-8"
        >
          <SectionLabel>Knowledge</SectionLabel>
          <p className="text-[13px] leading-[1.5] text-foreground/55 -mt-1 mb-4">
            Wat je AI weet — persoonlijk materiaal en bedrijfsbrede kennis.
          </p>

          {/* Niveau-toggle: Persoonlijk | Workspace */}
          <div className="glass-pill pill inline-flex items-center p-1 gap-1 w-full mb-4" data-testid="ai-knowledge-scope">
            {([
              { key: 'personal' as const, label: 'Persoonlijk', icon: UserIcon },
              { key: 'workspace' as const, label: 'Workspace', icon: Building2 },
            ]).map((o) => {
              const active = o.key === knowledgeScope;
              const Icon = o.icon;
              return (
                <button
                  key={o.key}
                  type="button"
                  data-testid={`ai-knowledge-scope-${o.key}`}
                  aria-pressed={active}
                  onClick={() => setKnowledgeScope(o.key)}
                  className={`flex-1 h-9 rounded-full text-[13px] font-medium inline-flex items-center justify-center gap-1.5 transition-colors ${
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
                  <Icon size={14} strokeWidth={1.9} />
                  {o.label}
                  {o.key === 'workspace' && !canEditWs && (
                    <Lock size={11} strokeWidth={2} className="text-icon-muted" />
                  )}
                </button>
              );
            })}
          </div>

          {/* PERSOONLIJK */}
          {knowledgeScope === 'personal' && (
            <div className="flex flex-col gap-2" data-testid="ai-knowledge-personal">
              <p className="text-[12.5px] leading-[1.5] text-foreground/50 mb-1">
                Alleen jouw AI gebruikt dit — schrijfvoorbeelden, je pitch, eigen materiaal.
              </p>
              {persona.knowledge.map((doc) => (
                <KnowledgeRow
                  key={doc.id}
                  doc={doc}
                  testIdPrefix="ai-knowledge-personal-doc"
                  onRemove={() => removePersonalDoc(doc.id)}
                />
              ))}
              <button
                type="button"
                data-testid="ai-knowledge-personal-add"
                onClick={addPersonalDoc}
                className="glass-pill pill h-11 flex items-center justify-center gap-1.5 text-[13.5px] font-semibold text-foreground/70 hover-elevate active-elevate-2"
              >
                <Plus size={15} strokeWidth={2} />
                Document toevoegen
              </button>
            </div>
          )}

          {/* WORKSPACE */}
          {knowledgeScope === 'workspace' && (
            <div className="flex flex-col gap-2" data-testid="ai-knowledge-workspace">
              <p className="text-[12.5px] leading-[1.5] text-foreground/50 mb-1">
                Bedrijfsbrede kennis — prijzen, producten, propositie. Gedeeld met het hele team.
                {!canEditWs && ' Alleen-lezen voor jouw rol.'}
              </p>
              {workspace.knowledge.map((doc) => (
                <KnowledgeRow
                  key={doc.id}
                  doc={doc}
                  testIdPrefix="ai-knowledge-workspace-doc"
                  onRemove={canEditWs ? () => removeWsDoc(doc.id) : undefined}
                />
              ))}
              {canEditWs ? (
                <button
                  type="button"
                  data-testid="ai-knowledge-workspace-add"
                  onClick={addWsDoc}
                  className="glass-pill pill h-11 flex items-center justify-center gap-1.5 text-[13.5px] font-semibold text-foreground/70 hover-elevate active-elevate-2"
                >
                  <Plus size={15} strokeWidth={2} />
                  Document toevoegen
                </button>
              ) : (
                <div
                  data-testid="ai-knowledge-workspace-locked"
                  className="rounded-2xl px-4 py-3 flex items-center gap-2.5 bg-foreground/[0.03] dark:bg-white/[0.03] text-[12.5px] text-foreground/45"
                >
                  <Lock size={13} strokeWidth={2} className="text-icon-muted shrink-0" />
                  Alleen workspace-beheerders kunnen bedrijfskennis aanpassen.
                </div>
              )}
            </div>
          )}
        </motion.div>

        {/* Opslaan — mock confirm (backend upsert volgt) */}
        <button
          type="button"
          data-testid="mijn-ai-save"
          onClick={() => {}}
          className="mt-8 w-full pill h-12 flex items-center justify-center gap-1.5 text-[14px] font-semibold text-white hover-elevate active-elevate-2"
          style={{ background: 'linear-gradient(90deg, #1B3FA8 0%, #2F6BFF 100%)' }}
        >
          <Check size={15} strokeWidth={2.2} />
          Wijzigingen opslaan
        </button>
      </div>
    </div>
  );
}

export default MijnAi;
