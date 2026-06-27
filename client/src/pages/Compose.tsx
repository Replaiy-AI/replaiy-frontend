// ─────────────────────────────────────────────────────────────────
// Compose page — v35 (Replaiy LinkedIn chat flow)
//
// De compose-knop (✏️ "New message") opent geen mail-compose meer, maar
// een lichte LEAD-KIEZER: een zoekveld + lijst van leads/connecties
// (afgeleid van de bestaande mock-leads). Net als zoeken met "dat
// plusje". Geen To/Cc/Bcc/Subject, geen mail-chrome.
//
// Zodra je een lead kiest start je een nieuwe (lege) conversatie en
// land je in de NORMALE conversatie-view (ConversationTimeline via
// MailDetail) — met het bestaande bericht-/draft-veld onderaan. Voelt
// als een chat, identiek aan de rest van de app.
//
// Hergebruikt Stilt's glass/list-stijl (zelfde rij-pattern als de
// UniversalSearch lead-resultaten). Geen nieuwe styling.
// ─────────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { Search, X, PenSquare } from 'lucide-react';
import { useStilt } from '@/state/StiltContext';
import { StiltAvatar } from '@/components/Avatar';
import type { Mail } from '@/data/mockEmails';

interface LeadOption {
  name: string;
  email: string;
  avatar?: string;
  headline?: string;
  company?: string;
  location?: string;
}

export function Compose() {
  const [, navigate] = useLocation();
  const { mails, startConversationWith } = useStilt();
  const [term, setTerm] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);

  // Unieke leads afgeleid uit de mock-mails (één entry per lead-naam).
  const leads = useMemo<LeadOption[]>(() => {
    const map = new Map<string, LeadOption>();
    for (const m of mails as Mail[]) {
      const name = m.from.name;
      if (!name || map.has(name)) continue;
      const headline =
        (m as any).leadHeadline ?? (m as any).contact?.title ?? '';
      const company =
        (m as any).leadCompany ?? (m as any).contact?.company ?? '';
      map.set(name, {
        name,
        email: m.from.email,
        avatar: m.from.avatar,
        headline,
        company,
        location: (m as any).leadLocation ?? (m as any).contact?.location,
      });
    }
    return Array.from(map.values());
  }, [mails]);

  const filtered = useMemo(() => {
    const q = term.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        (l.headline ?? '').toLowerCase().includes(q) ||
        (l.company ?? '').toLowerCase().includes(q),
    );
  }, [leads, term]);

  const pickLead = (lead: LeadOption) => {
    const id = startConversationWith({
      name: lead.name,
      email: lead.email,
      avatar: lead.avatar,
      leadHeadline: lead.headline || undefined,
      leadCompany: lead.company || undefined,
      leadLocation: lead.location,
    });
    navigate(`/mail/${id}`);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const lead = filtered[selectedIdx];
      if (lead) pickLead(lead);
    } else if (e.key === 'Escape') {
      navigate('/');
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 relative" data-testid="compose-lead-picker">
      {/* Header — titel + sluiten. Zelfde glass/list-taal als de rest. */}
      <div className="flex items-center justify-between px-4 lg:px-6 pt-4 lg:pt-5 pb-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="h-9 w-9 rounded-full bg-foreground/[0.06] dark:bg-white/[0.08] flex items-center justify-center shrink-0">
            <PenSquare size={17} strokeWidth={1.8} className="text-icon" />
          </span>
          <div className="min-w-0">
            <h1 className="text-[17px] font-semibold tracking-[-0.01em] text-foreground leading-tight">
              New message
            </h1>
            <p className="text-[12.5px] text-foreground/55 leading-tight">
              Choose a lead to start a conversation
            </p>
          </div>
        </div>
        <button
          type="button"
          data-testid="button-compose-close"
          onClick={() => navigate('/')}
          aria-label="Close"
          className="h-9 w-9 rounded-full flex items-center justify-center text-icon hover-elevate active-elevate-2 shrink-0"
        >
          <X size={18} strokeWidth={1.9} />
        </button>
      </div>

      {/* Zoekveld — glass-pill, zelfde recipe als de UniversalSearch input. */}
      <div className="px-4 lg:px-6 pt-1 pb-3">
        <div className="flex items-center gap-2.5 glass-pill rounded-full h-12 px-4">
          <Search size={17} strokeWidth={1.9} className="text-icon-muted shrink-0" />
          <input
            data-testid="input-lead-search"
            autoFocus
            value={term}
            onChange={(e) => {
              setTerm(e.target.value);
              setSelectedIdx(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Search leads by name, role, or company…"
            className="flex-1 bg-transparent outline-none text-[15px] text-foreground placeholder:text-foreground/40"
          />
          {term && (
            <button
              type="button"
              onClick={() => setTerm('')}
              aria-label="Clear search"
              className="h-6 w-6 rounded-full flex items-center justify-center text-foreground/45 hover:text-foreground hover:bg-foreground/10 shrink-0"
            >
              <X size={14} strokeWidth={2.2} />
            </button>
          )}
        </div>
      </div>

      {/* Lead-lijst — zelfde rij-stijl als de search lead-resultaten. */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-3 lg:px-5 pb-44 lg:pb-6">
        <div className="px-3 pt-1 pb-1.5 text-[10.5px] uppercase tracking-[0.08em] font-semibold text-foreground/45">
          Leads
        </div>
        {filtered.length === 0 ? (
          <div className="px-4 py-12 text-center text-foreground/55">
            <p className="text-[14px] font-medium">No leads found</p>
            <p className="text-[12.5px] mt-1 text-foreground/45">
              Try a different name, role, or company.
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            {filtered.map((lead, i) => {
              const sub = [lead.headline, lead.company].filter(Boolean).join(' · ');
              return (
                <motion.button
                  key={`${lead.name}-${i}`}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: Math.min(i * 0.015, 0.2) }}
                  data-testid={`lead-option-${i}`}
                  onMouseEnter={() => setSelectedIdx(i)}
                  onClick={() => pickLead(lead)}
                  className={`text-left flex items-center gap-3 px-3 py-2.5 rounded-2xl ${
                    selectedIdx === i
                      ? 'bg-foreground/[0.06] dark:bg-white/[0.08]'
                      : 'hover:bg-foreground/[0.03] dark:hover:bg-white/[0.04]'
                  } transition-colors`}
                >
                  <StiltAvatar name={lead.name} src={lead.avatar} size={36} className="shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[14.5px] font-semibold tracking-[-0.005em] text-foreground truncate">
                      {lead.name}
                    </div>
                    {sub && (
                      <div className="text-[12.5px] text-foreground/55 truncate">{sub}</div>
                    )}
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default Compose;
