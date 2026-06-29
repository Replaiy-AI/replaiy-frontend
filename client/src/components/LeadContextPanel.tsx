// ─────────────────────────────────────────────────────────────────
// LeadContextPanel · the right-hand context column of a conversation.
//
// Two tabs:
//   • Overview · the AI mascot TALKS first (a warm, first-person read of how
//     the conversation is going + what phase it is in: interpretation only,
//     never a to-do), then the factual gradient status bar (GoalPill +
//     ConversionBar + stage label, reused 1:1 from the inbox row), then a
//     quiet Context block (location / size / industry + signal bullets).
//   • Contact · a rich lead dossier (Contact / Company / Role), revealed on
//     demand. Locked state shows a tasteful reveal affordance; revealed state
//     is a clean, dense set of copyable rows.
//
// Design system: single blue accent (#2F6BFF). The ONLY colour exception is
// the persona fin colour carried by the talking mascot (activePersona). Real
// glass primitives (rp-card / lg-card / glass-pill), Apple-spring motion, the
// Persona "Example message" soul brought here as a living AI read.
//
// IMPORTANT: there is NO "next best action" element anywhere. The drafts are
// already queued or auto-sent by autopilot, so the AI read is pure
// interpretation of the conversation state, never a recommended action.
// goalStage (No reply -> Replied -> In conversation -> Interested -> Ready)
// stays the single source of truth for how warm / far the thread is.
// ─────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  MapPin,
  Building2,
  Users,
  Lock,
  Copy,
  Check,
  Linkedin,
  Mail,
  Phone,
  Globe,
  Briefcase,
  Sparkles,
  ArrowUpRight,
  UserPlus,
  ThumbsUp,
  MessageSquare,
  Send,
  CornerUpRight,
} from 'lucide-react';
import type { Conversation } from '@/data/mockConversations';
import { STAGE_META } from '@/data/mockConversations';
import {
  DEFAULT_FLOW,
  FLOW_STEP_META,
  type FlowStep,
  type FlowStepKind,
} from '@/data/mockCampaigns';
import { GoalPill, ConversionBar } from '@/components/CampaignsList';
import { ReplaiyAvatar } from '@/components/Avatar';
import { activePersona } from '@/data/mockPersona';
import { useReplaiy } from '@/state/ReplaiyContext';
import { APPLE_SPRING } from '@/lib/motion';

const ACCENT = '#2F6BFF';

type Tab = 'overview' | 'contact';

// ── Small em-dash-free normaliser ──────────────────────────────────
// Shared summary / read copy may contain em-dashes; the design system is
// strictly em-dash-free, so normalise to a mid-dot.
function noDash(s: string) {
  return s.replace(/\s*\u2014\s*/g, ' · ');
}

// ── Soft flow-position derivation ──────────────────────────────────
// A conversation carries NO step index and NO per-lead flow, so we never
// claim a precise "Step N of M". Instead we softly map goalStage onto the
// campaign's DEFAULT_FLOW kinds to gently emphasise roughly where the lead
// sits. This is a visual hint only — if the kind isn't in the flow, nothing
// is highlighted. Returns the FlowStepKind to softly emphasise, or null.
function softCurrentStepKind(
  stage: keyof typeof STAGE_META,
): FlowStep['kind'] | null {
  switch (stage) {
    case 'no_reply':
      // Invite is out, conversation not yet open.
      return 'connect';
    case 'replied':
    case 'in_conversation':
      // The conversation is open · the message step.
      return 'message';
    case 'interested':
    case 'ready':
      // Warm and late · nudging toward the goal.
      return 'follow_up';
    default:
      return null;
  }
}

// ── Quiet uppercase section label (Persona-page rhythm) ────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-foreground/40 mb-2.5">
      {children}
    </div>
  );
}

// ── A quiet labelled context row (icon + label + value) ────────────
function ContextRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2.5 py-[7px]">
      <Icon size={14} strokeWidth={1.8} className="text-icon-muted shrink-0" />
      <span className="text-[12.5px] text-foreground/45 w-[58px] shrink-0">{label}</span>
      <span className="text-[12.5px] text-foreground/85 truncate">{value}</span>
    </div>
  );
}

// ── Lucide icon per flow-step kind (mirrors CampaignDetail's FLOW_ICONS) ──
const FLOW_ICONS: Record<FlowStepKind, typeof Send> = {
  connect: UserPlus,
  like: ThumbsUp,
  comment: MessageSquare,
  message: Send,
  follow_up: CornerUpRight,
};

type FlowStatus = 'done' | 'current' | 'todo';

function flowStatuses(
  flow: FlowStep[],
  currentKind: FlowStep['kind'] | null,
): FlowStatus[] {
  const currentIdx =
    currentKind == null ? -1 : flow.findIndex((s) => s.kind === currentKind);
  return flow.map((_, i) => {
    if (currentIdx < 0) return 'todo';
    if (i < currentIdx) return 'done';
    if (i === currentIdx) return 'current';
    return 'todo';
  });
}

function MetaLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2.5">
      <span className="text-[11.5px] text-foreground/40 w-[64px] shrink-0">{label}</span>
      <span className="text-[12px] font-medium text-foreground/75 truncate min-w-0">
        {value}
      </span>
    </div>
  );
}

// ── FLOW section · a vertical top-to-bottom timeline ──────────────────
// Mirrors the CampaignDetail Flow card (icon rail + connector line + label +
// delay pill + hint), wrapped in an lg-card to match Context / Signals. Adds
// a per-step status derived softly from goalStage: done steps get a blue icon
// tile + a small check and a muted delay; the current step is emphasised
// (accent ring + accent label); todo steps stay quiet/grey. The connector
// trail is blue up to the current step, grey after — a tasteful progress
// trail. We never claim a hard "Step N of M".
function FlowSection({
  flow,
  currentKind,
}: {
  flow: FlowStep[];
  currentKind: FlowStep['kind'] | null;
}) {
  const statuses = flowStatuses(flow, currentKind);
  return (
    <div data-testid="lead-flow-section">
      <SectionLabel>Flow</SectionLabel>
      <div className="lg-card rounded-[16px] px-3.5 py-2.5">
        <div className="flex flex-col">
          {flow.map((step, i) => {
            const meta = FLOW_STEP_META[step.kind];
            const Icon = FLOW_ICONS[step.kind];
            const status = statuses[i];
            const last = i === flow.length - 1;
            const isDone = status === 'done';
            const isCurrent = status === 'current';
            const trailBlue = isDone;
            return (
              <div
                key={`${step.kind}-${i}`}
                data-testid={`flow-step-${step.kind}-${i}`}
                className="flex items-start gap-3 py-2"
              >
                {/* Icon rail + connector line. */}
                <div className="relative flex flex-col items-center shrink-0">
                  <div
                    className="relative h-8 w-8 rounded-xl flex items-center justify-center transition-colors"
                    style={
                      isDone
                        ? { background: `${ACCENT}1A`, boxShadow: `inset 0 0 0 1px ${ACCENT}33` }
                        : isCurrent
                          ? { background: `${ACCENT}14`, boxShadow: `inset 0 0 0 1.5px ${ACCENT}` }
                          : {
                              background: 'hsl(var(--foreground) / 0.06)',
                              boxShadow: 'inset 0 0 0 1px hsl(var(--foreground) / 0.06)',
                            }
                    }
                  >
                    <Icon
                      size={15}
                      strokeWidth={1.9}
                      style={isDone || isCurrent ? { color: ACCENT } : undefined}
                      className={isDone || isCurrent ? '' : 'text-foreground/55'}
                    />
                    {isDone && (
                      <span
                        aria-hidden
                        className="absolute -right-1 -bottom-1 h-3.5 w-3.5 rounded-full flex items-center justify-center"
                        style={{ background: ACCENT }}
                      >
                        <Check size={9} strokeWidth={3} className="text-white" />
                      </span>
                    )}
                  </div>
                  {!last && (
                    <span
                      aria-hidden="true"
                      className="absolute top-8 h-[calc(100%-1rem)] w-px"
                      style={{
                        background: trailBlue
                          ? `${ACCENT}59`
                          : 'hsl(var(--foreground) / 0.10)',
                      }}
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="text-[12.5px] font-semibold tracking-[-0.005em] truncate"
                      style={{
                        color: isCurrent
                          ? ACCENT
                          : isDone
                            ? 'var(--foreground)'
                            : 'hsl(var(--foreground) / 0.5)',
                      }}
                    >
                      {noDash(meta.label)}
                    </span>
                    {step.delay && (
                      <span
                        className="shrink-0 glass-pill rounded-full inline-flex items-center h-[20px] px-2 text-[10.5px] font-medium tabular-nums whitespace-nowrap"
                        style={{
                          color: isCurrent ? ACCENT : 'hsl(var(--foreground) / 0.55)',
                        }}
                      >
                        {noDash(step.delay)}
                      </span>
                    )}
                  </div>
                  <p
                    className="mt-0.5 text-[11.5px] leading-snug m-0"
                    style={{
                      color:
                        isCurrent || isDone
                          ? 'hsl(var(--foreground) / 0.5)'
                          : 'hsl(var(--foreground) / 0.38)',
                    }}
                  >
                    {noDash(meta.hint)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── A copyable dossier row · quiet, dense, with a copy affordance ───
function DossierRow({
  icon: Icon,
  label,
  value,
  href,
  copyValue,
  testId,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
  /** When set, the row is a link (LinkedIn / website) with an external glyph. */
  href?: string;
  /** When set, the row is copyable with a copy / check glyph. */
  copyValue?: string;
  testId?: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    if (copyValue == null) return;
    try {
      navigator.clipboard?.writeText(copyValue);
    } catch {
      /* clipboard not available in this context */
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  const inner = (
    <>
      <Icon size={14} strokeWidth={1.8} className="text-icon-muted shrink-0" />
      <span className="text-[11px] text-foreground/40 w-[58px] shrink-0">{label}</span>
      <span className="text-[12.5px] text-foreground/90 truncate flex-1">{value}</span>
      {href ? (
        <ArrowUpRight size={14} strokeWidth={1.9} style={{ color: ACCENT }} className="shrink-0" />
      ) : copied ? (
        <Check size={13} strokeWidth={2.2} style={{ color: ACCENT }} className="shrink-0" />
      ) : copyValue != null ? (
        <Copy size={13} strokeWidth={1.8} className="text-icon-muted shrink-0" />
      ) : null}
    </>
  );

  const cls =
    'w-full flex items-center gap-2.5 py-2 text-left rounded-lg px-1.5 -mx-1.5 hover-elevate active-elevate-2';

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        data-testid={testId}
        className={cls}
      >
        {inner}
      </a>
    );
  }
  return (
    <button type="button" onClick={copy} data-testid={testId} className={cls}>
      {inner}
    </button>
  );
}

export function LeadContextPanel({ mail }: { mail: Conversation }) {
  const [tab, setTab] = useState<Tab>('overview');
  const [revealed, setRevealed] = useState(false);

  // Live persona drives the talking mascot avatar + its fin colour, exactly
  // like the AI-draft avatar in the reply bar. Active "warm" = the blue-fin
  // mascot, so the column feels like the Persona page Simon loves.
  const { persona: livePersona } = useReplaiy();
  const persona = activePersona(livePersona);

  const lead = mail.lead;
  const title = lead?.title ?? mail.leadHeadline;
  const company = lead?.company ?? mail.leadCompany;

  // Conversation status · reuse the EXACT inbox-row treatment.
  const goalType = mail.goalType ?? 'meeting';
  const stage = mail.goalStage ?? 'no_reply';
  const stageMeta = STAGE_META[stage];

  const hasContext =
    !!lead &&
    (!!lead.location || !!lead.companySize || !!lead.industry || (lead.signals?.length ?? 0) > 0);
  const hasContact = !!lead && (!!lead.email || !!lead.phone || !!lead.linkedinUrl);
  const hasCompany =
    !!lead && (!!lead.company || !!lead.industry || !!lead.companySize || !!lead.location);

  const linkedinHref = lead?.linkedinUrl && lead.linkedinUrl !== '#' ? lead.linkedinUrl : undefined;

  // The AI read text, em-dash-free. Pure interpretation, never an action.
  const readText = mail.aiRead ? noDash(mail.aiRead) : null;

  // Campaign context · what campaign this lead lives in, its goal, and the
  // per-lead flow. The conversation carries no flow of its own, so we use the
  // campaign DEFAULT_FLOW and softly hint at stage position (never a counter).
  const campaignName = mail.campaignName;
  const flow = DEFAULT_FLOW;
  const currentStepKind = softCurrentStepKind(stage);
  // ICP fit · defined per campaign. Shown as a quiet key/value, omitted if null.
  const fitScore = lead?.fitScore ?? null;

  return (
    <div
      data-testid="lead-context-panel"
      className="h-full flex flex-col overflow-hidden"
    >
      {/* ── Tab control ─────────────────────────────────────────────── */}
      <div className="px-4 pt-4 pb-3 shrink-0">
        <div className="lg-card rounded-full p-1 flex items-center gap-1">
          {(['overview', 'contact'] as const).map((t) => {
            const active = tab === t;
            return (
              <button
                key={t}
                type="button"
                data-testid={`lead-tab-${t}`}
                onClick={() => setTab(t)}
                aria-pressed={active}
                className="relative flex-1 h-[30px] rounded-full text-[12.5px] font-semibold tracking-[-0.005em] transition-colors"
                style={{ color: active ? 'var(--foreground)' : 'hsl(var(--foreground) / 0.5)' }}
              >
                {active && (
                  <motion.span
                    layoutId="lead-tab-pill"
                    transition={APPLE_SPRING}
                    className="glass-pill absolute inset-0 rounded-full"
                    aria-hidden
                  />
                )}
                <span className="relative z-[1]">{t === 'overview' ? 'Overview' : 'Contact'}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-6">
        <AnimatePresence mode="wait">
          {tab === 'overview' ? (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
              className="flex flex-col gap-5"
            >
              {/* 1 · THE AI, TALKING. The hero. Mascot as a living sender,
                     a first-person read of how the conversation is going. */}
              <div
                className="rp-card rounded-[20px] px-4 pt-3.5 pb-3.5"
                style={{ ['--ai-accent' as never]: persona.color }}
              >
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="relative w-[36px] h-[36px] shrink-0 flex items-center justify-center">
                    {/* Soft persona-colour podium behind the mascot, so it
                        reads as a character (Persona-page treatment). */}
                    <motion.span
                      aria-hidden
                      className="absolute inset-[-2px] rounded-full"
                      style={{
                        background: `radial-gradient(circle at 50% 50%, ${persona.color}, transparent 68%)`,
                        filter: 'blur(7px)',
                        opacity: 0.5,
                      }}
                      animate={{ opacity: [0.42, 0.58, 0.42] }}
                      transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
                    />
                    <motion.img
                      src={persona.mascot}
                      alt=""
                      aria-hidden
                      draggable={false}
                      className="relative w-[36px] h-[36px] object-contain select-none pointer-events-none"
                      animate={{ y: [0, -2.5, 0] }}
                      transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  </div>
                  <div className="min-w-0 leading-tight">
                    <div className="text-[13px] font-semibold tracking-[-0.01em] text-foreground">
                      Your AI
                    </div>
                    {/* The conversation phase · the exact same stage label the
                        inbox row uses, for platform consistency. No dot. */}
                    <div className="text-[11.5px] text-foreground/45 mt-0.5">
                      {stageMeta.label}
                    </div>
                  </div>
                </div>

                {readText && (
                  <p className="text-[13.5px] leading-[1.55] text-foreground/80 m-0">{readText}</p>
                )}

                {/* Status bar · goal pill + gradient ConversionBar + stage
                    label, reused 1:1 from the inbox row, folded INTO the AI
                    card under the summary. The AI tells the story and shows
                    where the conversation stands in one place. */}
                <div className="mt-3.5 pt-3.5 border-t border-foreground/[0.07] flex items-center gap-2.5 min-w-0">
                  <span className="shrink-0">
                    <GoalPill goalType={goalType} />
                  </span>
                  <span className="flex-1 min-w-0 flex items-center">
                    <ConversionBar pct={stageMeta.progress} />
                  </span>
                  <span className="shrink-0 text-[12px] font-medium text-foreground/65 whitespace-nowrap">
                    {stageMeta.label}
                  </span>
                </div>

                {/* Campaign + ICP fit · folded into the AI card as quiet
                    key/value lines. The goal is already shown by the GoalPill
                    above, so we don't restate it. Separation is purely spatial
                    — never a "·" between label and value. */}
                {(campaignName || fitScore != null) && (
                  <div className="mt-3 pt-3 border-t border-foreground/[0.07] flex flex-col gap-1.5">
                    {campaignName && (
                      <MetaLine label="Campaign" value={noDash(campaignName)} />
                    )}
                    {fitScore != null && (
                      <MetaLine label="ICP fit" value={`${fitScore}%`} />
                    )}
                  </div>
                )}
              </div>

              {/* 2 · Context. Quiet, secondary. What the AI knows. */}
              {hasContext && (
                <div>
                  <SectionLabel>Context</SectionLabel>
                  <div className="lg-card rounded-[16px] px-3.5 py-1.5">
                    {lead?.location && (
                      <ContextRow icon={MapPin} label="Location" value={lead.location} />
                    )}
                    {lead?.companySize && (
                      <ContextRow icon={Users} label="Size" value={lead.companySize} />
                    )}
                    {lead?.industry && (
                      <ContextRow icon={Building2} label="Industry" value={lead.industry} />
                    )}
                  </div>
                </div>
              )}

              {/* 3 · Signals. A proper section that mirrors Context exactly,
                     same header + glass card + row rhythm, so the two read as
                     a consistent pair (no floating bullets). */}
              {(lead?.signals?.length ?? 0) > 0 && (
                <div>
                  <SectionLabel>Signals</SectionLabel>
                  {/* Signals rows mirror the Context rows' rhythm: same card
                      padding, same gap, same even vertical spacing. There is no
                      label/value pair (each is a sentence), so a small accent
                      marker stands in for the Context icon — nudged down to sit
                      on the first line — and the text gets a comfortable
                      line-height so rows breathe instead of cramping. */}
                  <div className="lg-card rounded-[16px] px-3.5 py-1.5">
                    {lead!.signals!.map((s, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2.5 py-[7px] text-[12.5px] text-foreground/85 leading-[1.5]"
                      >
                        <span
                          aria-hidden
                          className="mt-[7px] h-[5px] w-[5px] rounded-full shrink-0"
                          style={{ background: ACCENT, opacity: 0.85 }}
                        />
                        <span className="flex-1 min-w-0">{noDash(s)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 4 · Flow. The campaign's per-lead action sequence as a
                     vertical timeline, with per-step status. Sits last,
                     under Signals, mirroring the CampaignDetail Flow card. */}
              <FlowSection flow={flow} currentKind={currentStepKind} />
            </motion.div>
          ) : (
            <motion.div
              key="contact"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
              className="flex flex-col gap-5"
            >
              {/* Lead identity header */}
              <div className="flex items-center gap-3">
                <ReplaiyAvatar name={mail.from.name} src={mail.from.avatar} size={42} className="shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[14.5px] font-semibold tracking-[-0.01em] text-foreground truncate">
                    {mail.from.name}
                  </div>
                  <div className="text-[12px] text-foreground/50 truncate leading-snug">
                    {[title, company].filter(Boolean).join(' · ') || 'Lead'}
                  </div>
                </div>
              </div>

              {!hasContact && !hasCompany ? (
                <div className="text-[12.5px] text-foreground/45 leading-relaxed">
                  No contact details on file yet.
                </div>
              ) : !revealed ? (
                /* Locked state · tasteful reveal affordance. */
                <div className="lg-card rounded-[20px] px-5 py-7 flex flex-col items-center text-center gap-3.5">
                  <div
                    className="h-[46px] w-[46px] rounded-[14px] flex items-center justify-center"
                    style={{
                      background: 'hsl(var(--foreground) / 0.04)',
                      boxShadow: 'inset 0 0 0 1px hsl(var(--foreground) / 0.06)',
                    }}
                  >
                    <Lock size={19} strokeWidth={1.8} className="text-icon-muted" />
                  </div>
                  <div>
                    <div className="text-[13.5px] font-semibold text-foreground">
                      Contact details hidden
                    </div>
                    <div className="text-[12px] text-foreground/45 leading-[1.45] mt-1 max-w-[210px]">
                      Email, phone, LinkedIn and the full company profile. Fetched on demand when
                      you need them.
                    </div>
                  </div>
                  <button
                    type="button"
                    data-testid="reveal-contact"
                    onClick={() => setRevealed(true)}
                    className="mt-1 inline-flex items-center justify-center gap-2 h-[38px] px-4 rounded-[12px] text-[12.5px] font-semibold text-white whitespace-nowrap transition-transform hover:scale-[1.02] active:scale-[0.98]"
                    style={{
                      background: `linear-gradient(180deg, ${ACCENT}, #2A60E6)`,
                      boxShadow: `0 8px 18px -8px ${ACCENT}99, inset 0 1px 0 rgba(255,255,255,0.25)`,
                    }}
                  >
                    <Lock size={14} strokeWidth={2} />
                    Reveal contact info
                  </button>
                </div>
              ) : (
                /* Revealed dossier · grouped, dense, copyable. */
                <>
                  {hasContact && (
                    <div>
                      <SectionLabel>Contact</SectionLabel>
                      <div className="lg-card rounded-[16px] px-3.5 py-1">
                        {lead?.email && (
                          <DossierRow
                            icon={Mail}
                            label="Email"
                            value={lead.email}
                            copyValue={lead.email}
                            testId="copy-email"
                          />
                        )}
                        {lead?.phone && (
                          <DossierRow
                            icon={Phone}
                            label="Phone"
                            value={lead.phone}
                            copyValue={lead.phone}
                            testId="copy-phone"
                          />
                        )}
                        {lead?.linkedinUrl && (
                          <DossierRow
                            icon={Linkedin}
                            label="LinkedIn"
                            value={
                              linkedinHref
                                ? linkedinHref.replace(/^https?:\/\/(www\.)?/, '')
                                : 'View profile'
                            }
                            href={linkedinHref ?? '#'}
                            testId="open-linkedin"
                          />
                        )}
                      </div>
                    </div>
                  )}

                  {hasCompany && (
                    <div>
                      <SectionLabel>Company</SectionLabel>
                      <div className="lg-card rounded-[16px] px-3.5 py-1">
                        {lead?.company && (
                          <DossierRow
                            icon={Building2}
                            label="Company"
                            value={lead.company}
                            copyValue={lead.company}
                          />
                        )}
                        {lead?.industry && (
                          <DossierRow icon={Globe} label="Industry" value={lead.industry} />
                        )}
                        {lead?.companySize && (
                          <DossierRow icon={Users} label="Size" value={lead.companySize} />
                        )}
                        {lead?.location && (
                          <DossierRow icon={MapPin} label="Location" value={lead.location} />
                        )}
                      </div>
                    </div>
                  )}

                  {title && (
                    <div>
                      <SectionLabel>Role</SectionLabel>
                      <div className="lg-card rounded-[16px] px-3.5 py-1">
                        <DossierRow icon={Briefcase} label="Title" value={title} />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 text-[11px] text-foreground/40">
                    <Sparkles size={12} strokeWidth={2} style={{ color: ACCENT }} className="shrink-0" />
                    Enriched on demand
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
