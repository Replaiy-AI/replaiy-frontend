// ─────────────────────────────────────────────────────────────────
// LeadContextPanel — the right-hand context column of a conversation.
//
// Home for the AI read, the enriched lead context, and on-demand
// contact enrichment (reveal email / phone). Matches the
// Persona / Knowledge / Campaign gold standard: single blue accent
// (#2F6BFF), real glass primitives (rp-card / lg-card / glass-pill),
// the Persona-style label pattern, and no block-in-block nesting.
//
// IMPORTANT: there is NO sentiment / temperature indicator anywhere.
// The conversation goalStage (No reply -> Replied -> In conversation ->
// Interested -> Ready) is the single source of truth for how warm / far
// the thread is, reused 1:1 from the inbox row (STAGE_META + ConversionBar).
// The AI read only ADDS interpretation + the next best action.
// ─────────────────────────────────────────────────────────────────
import { useState } from 'react';
import {
  Sparkles,
  MapPin,
  Building2,
  Users,
  Lock,
  Copy,
  Check,
  Linkedin,
} from 'lucide-react';
import type { Conversation } from '@/data/mockConversations';
import { STAGE_META } from '@/data/mockConversations';
import { GOAL_META } from '@/data/mockCampaigns';
import { GoalPill, ConversionBar } from '@/components/CampaignsList';
import { ReplaiyAvatar } from '@/components/Avatar';

const ACCENT = '#2F6BFF';

// Persona-style section header: title + quiet one-line sub.
function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-2">
      <div className="text-[12.5px] font-semibold text-foreground">{title}</div>
      {sub && <div className="text-[11.5px] text-foreground/45 leading-snug">{sub}</div>}
    </div>
  );
}

// A small blue accent dot used by the fit pill + the AI read sparkle row.
function AccentDot() {
  return (
    <span
      aria-hidden
      className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
      style={{ background: ACCENT }}
    />
  );
}

// Quiet labelled row for the Context section (icon + label + value).
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
    <div className="flex items-center gap-2.5 py-1">
      <Icon size={14} strokeWidth={1.8} className="text-icon-muted shrink-0" />
      <span className="text-[12.5px] text-foreground/50 w-[64px] shrink-0">{label}</span>
      <span className="text-[12.5px] text-foreground/85 truncate">{value}</span>
    </div>
  );
}

// A copyable contact row — quiet, with a small copy affordance.
function CopyableRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    try {
      navigator.clipboard?.writeText(value);
    } catch {
      /* clipboard not available in this context */
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };
  return (
    <button
      type="button"
      onClick={copy}
      data-testid={`copy-${label.toLowerCase()}`}
      className="w-full flex items-center gap-2.5 py-1.5 text-left rounded-lg px-1 -mx-1 hover-elevate active-elevate-2"
    >
      <span className="text-[12.5px] text-foreground/50 w-[48px] shrink-0">{label}</span>
      <span className="text-[12.5px] text-foreground/90 truncate flex-1">{value}</span>
      {copied ? (
        <Check size={13} strokeWidth={2} style={{ color: ACCENT }} className="shrink-0" />
      ) : (
        <Copy size={13} strokeWidth={1.8} className="text-icon-muted shrink-0" />
      )}
    </button>
  );
}

export function LeadContextPanel({ mail }: { mail: Conversation }) {
  const [revealed, setRevealed] = useState(false);

  const lead = mail.lead;
  const title = lead?.title ?? mail.leadHeadline;
  const company = lead?.company ?? mail.leadCompany;
  const fit = lead?.fitScore;

  // Conversation status — reuse the EXACT inbox-row treatment.
  const goalType = mail.goalType ?? 'meeting';
  const stage = mail.goalStage ?? 'no_reply';
  const stageMeta = STAGE_META[stage];

  const hasContext =
    !!lead && (!!lead.location || !!lead.companySize || !!lead.industry || (lead.signals?.length ?? 0) > 0);
  const hasContact = !!lead && (!!lead.email || !!lead.phone);
  const fitLabel =
    fit == null ? null : fit >= 85 ? 'Strong fit' : fit >= 65 ? 'Good fit' : 'Possible fit';

  return (
    <div
      data-testid="lead-context-panel"
      className="h-full overflow-y-auto no-scrollbar px-4 py-5 flex flex-col gap-5"
    >
      {/* 1 — Identity + fit */}
      <div>
        <div className="flex items-start gap-3">
          <ReplaiyAvatar name={mail.from.name} src={mail.from.avatar} size={44} className="shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold tracking-[-0.01em] text-foreground truncate">
              {mail.from.name}
            </div>
            <div className="text-[12.5px] text-foreground/55 truncate leading-snug">
              {[title, company].filter(Boolean).join(' · ') || 'Lead'}
            </div>
          </div>
        </div>
        {fitLabel && (
          <span className="glass-pill pill inline-flex items-center gap-1.5 h-[24px] pl-2 pr-2.5 mt-3 text-[12px] font-medium text-foreground/80">
            <AccentDot />
            <span className="whitespace-nowrap">
              {fitLabel} · {fit}%
            </span>
          </span>
        )}
      </div>

      {/* 2 — AI read (the core). Single rp-card, no block-in-block. */}
      <div className="rp-card rounded-2xl px-3.5 py-3">
        <div className="flex items-center gap-1.5 mb-2">
          <Sparkles size={13} strokeWidth={2} style={{ color: ACCENT }} className="shrink-0" />
          <span className="text-[12.5px] font-semibold text-foreground">AI read</span>
        </div>

        {mail.aiRead && (
          <p className="text-[13px] leading-[1.5] text-foreground/75 m-0">{mail.aiRead}</p>
        )}

        {mail.nextAction && (
          <div className="mt-2.5 flex items-start gap-2">
            <span
              className="text-[11px] font-semibold uppercase tracking-wide shrink-0 mt-[2px]"
              style={{ color: ACCENT }}
            >
              Next
            </span>
            <span className="text-[13.5px] font-semibold leading-[1.45]" style={{ color: ACCENT }}>
              {mail.nextAction}
            </span>
          </div>
        )}

        {mail.summary && (
          <p className="mt-2.5 text-[12px] leading-[1.5] text-foreground/45 m-0">
            {/* Shared summary data may contain em-dashes; normalise to a colon
               so this panel stays em-dash-free per the design system. */}
            {mail.summary.replace(/\s*\u2014\s*/g, ' · ')}
          </p>
        )}

        {typeof mail.confidence === 'number' && (
          <div className="mt-2.5 flex items-center gap-1.5 text-[11.5px] text-foreground/45">
            <Sparkles size={11} strokeWidth={2} className="text-icon-muted shrink-0" />
            <span>Draft ready · {mail.confidence}%</span>
          </div>
        )}
      </div>

      {/* 3 — Conversation status. REUSE inbox-row STAGE_META + ConversionBar.
             The single warmth / progress indicator. */}
      <div>
        <SectionHeader title="Conversation status" />
        {mail.campaignName && (
          <div className="text-[12.5px] text-foreground/55 truncate mb-2">{mail.campaignName}</div>
        )}
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="shrink-0">
            <GoalPill goalType={goalType} />
          </span>
          <span className="flex-1 min-w-0 flex items-center">
            <ConversionBar pct={stageMeta.progress} />
          </span>
          <span className="shrink-0 text-[12px] text-muted-foreground whitespace-nowrap">
            {stageMeta.label}
          </span>
        </div>
        <div className="text-[11.5px] text-foreground/40 mt-1.5">
          Goal: {GOAL_META[goalType].label}
        </div>
      </div>

      {/* 4 — Context (enriched). lg-card grouping, no block-in-block. */}
      {hasContext && (
        <div>
          <SectionHeader title="Context" sub="What your AI knows about this lead." />
          <div className="lg-card rounded-2xl px-3.5 py-2.5">
            {lead?.location && <ContextRow icon={MapPin} label="Location" value={lead.location} />}
            {lead?.companySize && <ContextRow icon={Users} label="Size" value={lead.companySize} />}
            {lead?.industry && <ContextRow icon={Building2} label="Industry" value={lead.industry} />}
          </div>
          {(lead?.signals?.length ?? 0) > 0 && (
            <ul className="mt-3 flex flex-col gap-1.5">
              {lead!.signals!.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-[12.5px] text-foreground/75 leading-snug">
                  <span className="mt-[7px] shrink-0">
                    <AccentDot />
                  </span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* 5 — Contact (the reveal). Hidden until opt-in. No cost / credit copy,
             no provider names. */}
      {hasContact && (
        <div>
          <SectionHeader title="Contact" sub="Fetched on demand when you need it." />
          {!revealed ? (
            <button
              type="button"
              data-testid="reveal-contact"
              onClick={() => setRevealed(true)}
              className="glass-pill pill inline-flex items-center gap-2 h-[34px] pl-3 pr-3.5 text-[12.5px] font-medium text-foreground/85 hover-elevate active-elevate-2 transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              <Lock size={13} strokeWidth={1.9} className="text-icon-muted" />
              Reveal contact info
            </button>
          ) : (
            <>
              <div className="lg-card rounded-2xl px-3.5 py-1.5">
                {lead?.email && <CopyableRow label="Email" value={lead.email} />}
                {lead?.phone && <CopyableRow label="Phone" value={lead.phone} />}
              </div>
              <div className="text-[11px] text-foreground/40 mt-1.5">Fetched on demand.</div>
            </>
          )}
        </div>
      )}

      {/* 6 — Quick actions (minimal). */}
      {lead?.linkedinUrl && (
        <div className="mt-auto pt-1">
          <a
            href={lead.linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="open-linkedin"
            className="glass-pill pill inline-flex items-center gap-2 h-[34px] pl-3 pr-3.5 text-[12.5px] font-medium text-foreground/85 hover-elevate active-elevate-2 transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <Linkedin size={14} strokeWidth={1.9} style={{ color: ACCENT }} />
            Open LinkedIn profile
          </a>
        </div>
      )}
    </div>
  );
}
