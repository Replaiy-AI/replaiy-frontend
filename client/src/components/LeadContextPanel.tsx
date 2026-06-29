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
  Megaphone,
  Target,
  ChevronRight,
} from 'lucide-react';
import type { Conversation } from '@/data/mockConversations';
import { STAGE_META } from '@/data/mockConversations';
import {
  GOAL_META,
  DEFAULT_FLOW,
  FLOW_STEP_META,
  type FlowStep,
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

// ── Compact, single-word chip labels for the flow mini-sequence ────────
// FLOW_STEP_META labels ("Connection request", "Like a recent post") are too
// long for a chip row in a ~340px column, so the chips use a short word and
// the full FLOW_STEP_META label rides along as the title tooltip.
const FLOW_CHIP_LABEL: Record<FlowStep['kind'], string> = {
  connect: 'Connect',
  like: 'Like',
  comment: 'Comment',
  message: 'Message',
  follow_up: 'Follow-up',
};

// ── CAMPAIGN section · a quiet peer of Context / Signals ──────────────
// Mirrors the Context / Signals section shape exactly (uppercase label + an
// lg-card). Shows the campaign name + goal, then the campaign's per-lead flow
// as a READ-ONLY mini-sequence of small chips. We softly emphasise the chip
// that roughly matches the lead's stage — never a hard "Step N of M", since
// no step index exists in the data. Chips wrap gracefully within the column.
function CampaignSection({
  campaignName,
  goalLabel,
  flow,
  currentKind,
}: {
  campaignName: string;
  goalLabel: string;
  flow: FlowStep[];
  currentKind: FlowStep['kind'] | null;
}) {
  return (
    <div data-testid="lead-campaign-section">
      <SectionLabel>Campaign</SectionLabel>
      <div className="lg-card rounded-[16px] px-3.5 py-3">
        {/* Name + goal · the primary line. Quiet, not louder than the AI card. */}
        <div className="flex items-center gap-2.5">
          <Megaphone size={14} strokeWidth={1.8} className="text-icon-muted shrink-0" />
          <span className="text-[12.5px] font-semibold text-foreground/90 truncate flex-1 min-w-0">
            {noDash(campaignName)}
          </span>
          <span className="inline-flex items-center gap-1 glass-pill rounded-full px-2 h-[20px] shrink-0">
            <Target size={11} strokeWidth={2} style={{ color: ACCENT }} className="shrink-0" />
            <span className="text-[10.5px] font-medium text-foreground/70 whitespace-nowrap">
              {noDash(goalLabel)}
            </span>
          </span>
        </div>

        {/* Flow mini-sequence · read-only chips, wrap within the column. The
            soft-current chip gets a quiet blue emphasis; everything else stays
            neutral. The arrows between chips imply order without a counter. */}
        <div className="mt-3 pt-3 border-t border-foreground/[0.07] flex flex-wrap items-center gap-x-1 gap-y-1.5">
          {flow.map((step, i) => {
            const isCurrent = currentKind != null && step.kind === currentKind;
            return (
              <span key={i} className="inline-flex items-center gap-1">
                <span
                  title={FLOW_STEP_META[step.kind].label}
                  className="inline-flex items-center h-[22px] rounded-full px-2 text-[10.5px] font-medium whitespace-nowrap transition-colors"
                  style={
                    isCurrent
                      ? {
                          color: ACCENT,
                          background: `${ACCENT}14`,
                          boxShadow: `inset 0 0 0 1px ${ACCENT}33`,
                        }
                      : {
                          color: 'hsl(var(--foreground) / 0.6)',
                          background: 'hsl(var(--foreground) / 0.04)',
                          boxShadow: 'inset 0 0 0 1px hsl(var(--foreground) / 0.06)',
                        }
                  }
                >
                  {FLOW_CHIP_LABEL[step.kind]}
                </span>
                {i < flow.length - 1 && (
                  <ChevronRight
                    size={12}
                    strokeWidth={2}
                    aria-hidden
                    className="text-foreground/25 shrink-0"
                  />
                )}
              </span>
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
  const goalLabel = GOAL_META[goalType].label;
  const flow = DEFAULT_FLOW;
  const currentStepKind = softCurrentStepKind(stage);

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
              </div>

              {/* 2 · Campaign. The campaign this lead belongs to, its goal,
                     and the per-lead flow as a read-only mini-sequence. A
                     quiet peer of Context / Signals, sits under the AI card. */}
              {campaignName && (
                <CampaignSection
                  campaignName={campaignName}
                  goalLabel={goalLabel}
                  flow={flow}
                  currentKind={currentStepKind}
                />
              )}

              {/* 3 · Context. Quiet, secondary. What the AI knows. */}
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

              {/* 3 · Signals. A proper section that mirrors Context exactly ·
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
