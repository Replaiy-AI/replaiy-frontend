// Replaiy — "My AI" landing HUB.
//
// Owner decision: the /ai LANDING is a HUB of three standing cards (Persona,
// Personal knowledge, Workspace knowledge) filling the full width — NOT an
// inbox-style list-detail column. "Your AI" is a settings/hub landing, so a
// 3-column chooser fits better than the list-detail layout.
//
// Clicking a card zooms into that part's DETAIL view (rendered by MijnAi),
// which DOES stay 100% consistent with the inbox (same glass language, same
// detail-card treatment, and the same useMobileTopChromeSlot back-arrow that
// replaces the ••• on mobile).
//
//   • Persona             → /ai/persona
//   • Personal knowledge  → /ai/knowledge-personal
//   • Workspace knowledge → /ai/knowledge-workspace
//
// Below the three cards: the "All items" list (every knowledge question + file)
// with FLAT subtle status tags (like the inbox status words — no glass pills).
// Glass is restrained: the cards and the All-items cluster are the only glass
// containers; icons are plain (no glass bubbles).

import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { useLocation } from 'wouter';
import {
  Sparkles,
  User as UserIcon,
  Building2,
  Lock,
  ChevronRight,
  FileText,
  StickyNote,
  Link2,
  MessageCircleQuestion,
} from 'lucide-react';
import { useStilt } from '@/state/StiltContext';
import { ListRow } from './ListRow';
import { useMobileTopChromeSlot } from './MobileTopChrome';
import { GlassCircleButton, ProfileInitials } from './GlassCircleButton';
import { APPLE_SPRING } from '@/lib/motion';
import remiMascot from '@/assets/replaiy-mascot.png';
import { canEditWorkspaceKnowledge, type Workspace } from '@/data/mockWorkspace';
import type { Persona, KnowledgeBundle, KnowledgeDoc } from '@/data/mockPersona';

const KNOWLEDGE_ICON: Record<KnowledgeDoc['kind'], typeof FileText> = {
  pdf: FileText,
  doc: FileText,
  note: StickyNote,
  link: Link2,
};

// Mobile top-chrome left slot — identical to Inbox/Campaigns so the surfaces
// share one chrome.
function MobileProfileAvatar() {
  return (
    <GlassCircleButton label="Profile" testId="mobile-profile-avatar" showTooltip={false}>
      <ProfileInitials initials="SB" />
    </GlassCircleButton>
  );
}

// ── A hub card — one of the three parts ────────────────────────────
// A tall standing card: plain leading icon (no glass bubble), title, short
// description, and the live summary tag. The whole card is one tap target that
// zooms into the part's detail. Glass = the single stilt-card; nothing nested.
function HubCard({
  icon: Icon,
  title,
  description,
  summary,
  locked,
  to,
  testId,
  index,
}: {
  icon: typeof Sparkles;
  title: string;
  description: string;
  summary: string;
  locked?: boolean;
  to: string;
  testId: string;
  index: number;
}) {
  const [, navigate] = useLocation();
  return (
    <motion.button
      type="button"
      data-testid={testId}
      onClick={() => navigate(to)}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...APPLE_SPRING, delay: 0.05 + index * 0.05 }}
      className="stilt-card rounded-3xl p-5 lg:p-6 text-left flex flex-col h-full min-h-[200px] lg:min-h-[240px] hover-elevate active-elevate-2"
    >
      <div className="flex items-start justify-between">
        <Icon size={26} strokeWidth={1.8} className="shrink-0 text-foreground/70" />
        {locked ? (
          <Lock size={15} strokeWidth={2} className="text-icon-muted shrink-0" />
        ) : (
          <ChevronRight size={18} strokeWidth={2} className="text-icon-muted shrink-0" />
        )}
      </div>
      <h3 className="text-[17px] lg:text-[18px] font-semibold tracking-[-0.01em] text-foreground mt-4">
        {title}
      </h3>
      <p className="text-[13.5px] leading-[1.5] text-foreground/55 mt-1.5 flex-1">
        {description}
      </p>
      {/* Flat summary tag — accent text, not a glass pill. */}
      <div
        className="text-[13px] font-medium tabular-nums mt-4"
        style={{ color: 'var(--ai-accent, #2F6BFF)' }}
      >
        {summary}
      </div>
    </motion.button>
  );
}

// ── An "item" row — one knowledge question or file ─────────────────
type Level = 'personal' | 'workspace';
interface ItemEntry {
  key: string;
  level: Level;
  kind: 'question' | 'file';
  title: string;
  subtitle: string;
  status: string;
  answered?: boolean;
  icon: typeof FileText;
  to: string;
}

function buildItems(persona: Persona, workspace: Workspace): ItemEntry[] {
  const items: ItemEntry[] = [];
  const push = (bundle: KnowledgeBundle, level: Level, to: string) => {
    for (const q of bundle.questions) {
      const answered = q.answer.trim().length > 0;
      items.push({
        key: `${level}-${q.id}`,
        level,
        kind: 'question',
        title: q.question,
        subtitle: level === 'personal' ? 'Personal · Question' : 'Workspace · Question',
        status: answered ? 'Answered' : 'Open',
        answered,
        icon: MessageCircleQuestion,
        to,
      });
    }
    for (const f of bundle.files) {
      items.push({
        key: `${level}-${f.id}`,
        level,
        kind: 'file',
        title: f.title,
        subtitle: level === 'personal' ? 'Personal · File' : 'Workspace · File',
        status: f.meta,
        icon: KNOWLEDGE_ICON[f.kind],
        to,
      });
    }
  };
  push(persona.knowledge, 'personal', '/ai/knowledge-personal');
  push(workspace.knowledge, 'workspace', '/ai/knowledge-workspace');
  return items;
}

function ItemRow({ item }: { item: ItemEntry }) {
  const [, navigate] = useLocation();
  const Icon = item.icon;
  return (
    <ListRow testId={`item-row-${item.key}`} onClick={() => navigate(item.to)}>
      <div className="flex items-center gap-3">
        <Icon size={18} strokeWidth={1.8} className="shrink-0 text-foreground/55" />
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-medium text-foreground leading-snug truncate">
            {item.title}
          </div>
          <div className="text-[12.5px] text-foreground/55 truncate leading-snug">
            {item.subtitle}
          </div>
        </div>
        {/* Flat status tag — like the inbox status words (no glass pill). */}
        {item.kind === 'question' ? (
          <span
            className="shrink-0 inline-flex items-center gap-1.5 text-[12px] font-medium whitespace-nowrap"
            style={{ color: item.answered ? 'var(--ai-accent, #2F6BFF)' : undefined }}
          >
            {!item.answered && (
              <span className="h-1.5 w-1.5 rounded-full bg-foreground/25 shrink-0" />
            )}
            <span className={item.answered ? '' : 'text-foreground/45'}>{item.status}</span>
          </span>
        ) : (
          <span className="shrink-0 text-[12px] text-muted-foreground whitespace-nowrap">
            {item.status}
          </span>
        )}
        <ChevronRight size={16} strokeWidth={2} className="text-icon-muted shrink-0" />
      </div>
    </ListRow>
  );
}

// A labelled section header — label + count, matching the inbox bucket label.
function SectionLabel({ label, count }: { label: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 px-2 mb-2.5">
      <span className="text-[12.5px] font-semibold tracking-[-0.005em]">{label}</span>
      {count !== undefined && <span className="text-[12px] text-muted-foreground">{count}</span>}
    </div>
  );
}

export function AiList() {
  const { persona, workspace } = useStilt();

  // Landing hub registers the same mobile top-chrome as Inbox/Campaigns
  // (profile avatar + search). The detail views register their own back-arrow
  // chrome; this component only ever renders on the bare /ai landing.
  const overviewSlot = useMemo(
    () => ({
      leftSlot: <MobileProfileAvatar />,
      searchPlaceholder: 'Search My AI…',
    }),
    [],
  );
  useMobileTopChromeSlot(overviewSlot);

  const t = persona.tone;
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const langLabel = t.language === 'nl' ? 'Dutch' : 'English';
  const canEditWs = canEditWorkspaceKnowledge(workspace.currentRole);

  const pAnswered = persona.knowledge.questions.filter((q) => q.answer.trim()).length;
  const wAnswered = workspace.knowledge.questions.filter((q) => q.answer.trim()).length;
  const pTotal = persona.knowledge.questions.length;
  const wTotal = workspace.knowledge.questions.length;

  const items = useMemo(() => buildItems(persona, workspace), [persona, workspace]);

  return (
    <div className="relative flex flex-col h-full min-h-0 w-full">
      {/* pt-20 on mobile clears the fixed top-chrome (same as the detail). */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-4 lg:px-8 pt-20 lg:pt-10 pb-28 lg:pb-12">
        <div className="w-full max-w-[1100px] mx-auto flex flex-col gap-8 lg:gap-10">
          {/* Greeting header — Remi + heading, mirrors the inbox/campaigns header. */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex flex-row items-start gap-3 sm:gap-4"
          >
            <motion.img
              src={remiMascot}
              alt="Remi, the Replaiy assistant"
              aria-hidden="true"
              draggable={false}
              initial={{ opacity: 0, scale: 0.85, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: [0, -4, 0] }}
              transition={{
                opacity: { duration: 0.4, delay: 0.1 },
                scale: { duration: 0.4, delay: 0.1 },
                y: { duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 0.5 },
              }}
              className="shrink-0 w-[64px] h-[64px] sm:w-[84px] sm:h-[84px] object-contain select-none pointer-events-none"
            />
            <div className="min-w-0">
              <h2 className="text-[26px] lg:text-[30px] font-semibold tracking-[-0.02em] leading-tight">
                Your AI
              </h2>
              <p className="text-[15px] text-foreground/55 mt-2 leading-snug max-w-[560px]">
                Set how your AI sounds and what it knows, so it runs your LinkedIn
                conversations the way you would.
              </p>
            </div>
          </motion.div>

          {/* The three parts as a full-width responsive hub: 3 equal columns on
              desktop, stacking to 1 column on small screens. */}
          {/* No section label here — the "Your AI" page header above already
              names this surface; a second "Your AI" label would be redundant. */}
          <section>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-5">
              <HubCard
                index={0}
                testId="part-persona"
                icon={Sparkles}
                title="Persona"
                description="How your AI sounds, reacts and thinks in every conversation."
                summary={`${cap(t.formality)} · ${langLabel}`}
                to="/ai/persona"
              />
              <HubCard
                index={1}
                testId="part-knowledge-personal"
                icon={UserIcon}
                title="Personal knowledge"
                description="What you teach your AI — context only your conversations use."
                summary={`${pAnswered}/${pTotal} answered`}
                to="/ai/knowledge-personal"
              />
              <HubCard
                index={2}
                testId="part-knowledge-workspace"
                icon={Building2}
                title="Workspace knowledge"
                description="What your company teaches your AI, shared with the whole team."
                summary={`${wAnswered}/${wTotal} answered`}
                locked={!canEditWs}
                to="/ai/knowledge-workspace"
              />
            </div>
          </section>

          {/* All individual knowledge items, flattened — gives the landing body. */}
          <section>
            <SectionLabel label="All items" count={items.length} />
            <div className="stilt-card rounded-3xl overflow-hidden">
              {items.map((item, i) => (
                <div key={item.key}>
                  {i > 0 && (
                    <div className="ml-4 h-px bg-foreground/[0.06] dark:bg-white/[0.06]" />
                  )}
                  <ItemRow item={item} />
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
