import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation } from 'wouter';
import {
  Search as SearchIcon,
  X,
  Calendar as CalendarIcon,
  Clock,
  Zap,
  CircleCheck,
  CheckCircle2,
  FileEdit,
  Paperclip,
  CalendarRange,
  CalendarDays,
  CalendarClock,
} from 'lucide-react';
import { useStilt, type CalView } from '@/state/StiltContext';
import { mockEvents, accountColor } from '@/data/mockEvents';
import { StiltAvatar } from './Avatar';
import { timeAgo } from '@/lib/avatar';
import { APPLE_SPRING } from '@/lib/motion';
import { VadikGlassSurface } from './VadikGlassSurface';
import VadikGlass from './VadikGlass';

// ─────────────────────────────────────────────────────────────────
// v15.3 — Universal Search (⌘K)
//
// One search across the whole app, replacing the three per-surface
// search circles in Inbox / Calendar / Docs top chrome.
//
// Trigger:  52×52 glass circle in the desktop sidebar header between
//           the tab pill and the + circle, OR keyboard shortcut ⌘K
//           anywhere. Listens to a global CustomEvent('stilt:open-search')
//           so any code path can pop it open.
//
// Modal:    Centered glass card ~640px wide. Spring entrance (scale 0.96
//           → 1, opacity 0 → 1). Grouped results:
//             • Mails (up to 5)
//             • Events (up to 3)
//             • Docs (up to 5)
//             • Contacts (up to 3)
//           Filter chips: Done only / Has attachment / From: / Last 30 days
//           Keyboard: ↑↓ to navigate, ↵ to open, ⎋ to close.
//
// Mock data is real enough to feel useful — typing "Nora" or "Q4"
// returns matching mails/events/docs from the project's own fixtures.
// ─────────────────────────────────────────────────────────────────

// v30.30 — Context-aware chips. Welke chips er getoond worden hangt af van
// de huidige route: Mail-route toont mail-categorieën, Calendar-route
// toont cal-views (Today/Week/Month/Upcoming), Docs-route toont
// docs-views (Recent/Pinned/etc.). De chip-keys zijn typed per surface.
// v30.31 — Perplexity stijl: monochrome chips, geen iOS systeem-tints.
// v-replaiy — Draft-filters aligned with the Replaiy inbox sections
// (zelfde status-velden als InboxList.tsx). Geen mail-views (inbox/sent/
// spam/etc.) meer; dit zijn LinkedIn-draft statussen.
const MAIL_CHIPS: { key: string; label: string; icon: any; tint?: string }[] = [
  { key: 'needsApproval', label: 'Needs approval', icon: FileEdit },
  { key: 'waiting', label: 'Waiting on reply', icon: Clock },
  { key: 'autoSent', label: 'Auto-sent', icon: Zap },
  { key: 'dismissed', label: 'Dismissed', icon: CircleCheck },
];

const CAL_CHIPS: { key: CalView; label: string; icon: any; tint?: string }[] = [
  { key: 'today', label: 'Today', icon: CalendarIcon },
  { key: 'week', label: 'This week', icon: CalendarRange },
  { key: 'month', label: 'Month', icon: CalendarDays },
  { key: 'upcoming', label: 'Upcoming', icon: CalendarClock },
];

interface ResultMail {
  kind: 'mail';
  id: string;
  title: string;
  subtitle: string;
  meta: string;
  fromName: string;
  avatar?: string;
  hasAttachment: boolean;
  done: boolean;
  ts: string;
}
interface ResultEvent {
  kind: 'event';
  id: string;
  title: string;
  subtitle: string;
  meta: string;
  account?: string;
}
interface ResultContact {
  kind: 'contact';
  id: string; // mail id to open as proxy
  title: string; // name
  subtitle: string; // email
  meta: string; // role/last contact
  avatar?: string;
}
type Result = ResultMail | ResultEvent | ResultContact;

function formatEventWhen(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (sameDay) return `Today · ${time}`;
  const dayLabel = d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  return `${dayLabel} · ${time}`;
}

export function UniversalSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  // v30.30 — Default state = geen chip actief. activeChip is null totdat
  // user expliciet op een chip klikt. Bij open van modal reset altijd
  // naar null (= alles zoeken across all sources).
  const [activeChip, setActiveChip] = useState<string | null>(null);
  const { mails, calView, setCalView } = useStilt();
  const [location, navigate] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);

  // v-replaiy — Surface detectie. Docs bestaat niet meer in Replaiy; alleen
  // de Calendar-surface houdt z'n eigen cal-chips. Alles anders (inbox /
  // mail-detail) gebruikt de Replaiy draft-filters (MAIL_CHIPS).
  const surface: 'mail' | 'calendar' =
    location.startsWith('/calendar') ? 'calendar' : 'mail';
  const chips = surface === 'calendar' ? CAL_CHIPS : MAIL_CHIPS;

  // Global open/close — keyboard ⌘K + custom event from sidebar trigger.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inField =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      if (e.key === 'Escape' && open) {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (inField) return;
    };
    // v30.32 — accept optional `detail.query` to pre-fill search input.
    // Used by contact panel "View N mails" to open search filtered op persoon.
    const openEv = (e: Event) => {
      const ce = e as CustomEvent<{ query?: string } | undefined>;
      const pre = ce.detail?.query;
      setOpen(true);
      if (typeof pre === 'string') setQ(pre);
    };
    document.addEventListener('keydown', handler);
    window.addEventListener('stilt:open-search', openEv as EventListener);
    return () => {
      document.removeEventListener('keydown', handler);
      window.removeEventListener('stilt:open-search', openEv as EventListener);
    };
  }, [open]);

  // Focus input + reset state when opened.
  useEffect(() => {
    if (open) {
      setSelectedIdx(0);
      // v30.30 — Default = geen chip actief bij open. User klikt expliciet
      // op een chip om te filteren.
      setActiveChip(null);
      setTimeout(() => inputRef.current?.focus(), 30);
    } else {
      // soft-reset on close
      setQ('');
      setActiveChip(null);
    }
  }, [open]);

  const term = q.trim().toLowerCase();

  // Compute grouped results.
  const { mailResults, eventResults, contactResults, flat } = useMemo(() => {
    // v-replaiy — Draft-filter logic. activeChip is alleen actief als de
    // gebruiker expliciet een chip heeft aangeklikt. Default (null) = geen
    // filter, alle bronnen tonen. Bij actieve draft-chip filteren we de
    // drafts op de juiste Replaiy-status (zelfde velden als InboxList.tsx)
    // én verbergen we andere groepen (events/leads).
    let mailsFiltered = mails;
    const hasChipFilter = surface === 'mail' && !!activeChip;
    if (hasChipFilter) {
      if (activeChip === 'needsApproval') {
        // Pending drafts die op review wachten (zelfde als InboxList).
        mailsFiltered = mailsFiltered.filter(
          (m) => m.priority === 'high' && m.status === 'open' && m.needsReply,
        );
      } else if (activeChip === 'waiting') {
        // Verstuurd, wacht op reactie van de lead.
        mailsFiltered = mailsFiltered.filter((m) => m.status === 'waiting');
      } else if (activeChip === 'autoSent') {
        // Automatisch verstuurd door autopilot.
        mailsFiltered = mailsFiltered.filter((m) => (m as any).isAutoSent === true);
      } else if (activeChip === 'dismissed') {
        // Afgewezen drafts (status done/dismissed).
        mailsFiltered = mailsFiltered.filter((m) => m.status === 'done');
      }
    }
    if (term) {
      // v-replaiy — Zoek op lead-naam, functie/headline, bedrijf en de
      // draft/incoming tekst. Geen e-mail "subject" meer (bestaat niet op
      // LinkedIn).
      mailsFiltered = mailsFiltered.filter((m) => {
        const headline = (m as any).leadHeadline ?? (m as any).contact?.title ?? '';
        const company = (m as any).leadCompany ?? (m as any).contact?.company ?? '';
        return (
          m.from.name.toLowerCase().includes(term) ||
          headline.toLowerCase().includes(term) ||
          company.toLowerCase().includes(term) ||
          m.preview.toLowerCase().includes(term) ||
          (m.body || '').toLowerCase().includes(term)
        );
      });
    }
    // Bij actieve chip: toon meer drafts (max 30) en verberg andere groepen.
    const mailLimit = hasChipFilter ? 30 : 5;
    const mailItems: ResultMail[] = mailsFiltered.slice(0, mailLimit).map((m) => {
      const headline = (m as any).leadHeadline ?? (m as any).contact?.title ?? '';
      const company = (m as any).leadCompany ?? (m as any).contact?.company ?? '';
      const sub = [headline, company].filter(Boolean).join(' · ');
      return {
        kind: 'mail',
        id: m.id,
        // Title = lead-naam; subtitle = headline · company (LinkedIn-stijl).
        title: m.from.name,
        subtitle: sub || m.preview,
        meta: timeAgo(m.ts),
        fromName: m.from.name,
        avatar: m.from.avatar,
        hasAttachment: !!((m as any).attachments && (m as any).attachments.length > 0),
        done: m.status === 'done',
        ts: m.ts,
      };
    });

    // Events — bij actieve mail-chip verbergen.
    const evFiltered = hasChipFilter
      ? []
      : mockEvents
          .filter((e) =>
            term
              ? e.title.toLowerCase().includes(term) ||
                (e.description || '').toLowerCase().includes(term) ||
                (e.location || '').toLowerCase().includes(term)
              : true,
          )
          .slice(0, 3);
    const eventItems: ResultEvent[] = evFiltered.map((e) => ({
      kind: 'event',
      id: e.id,
      title: e.title,
      subtitle: e.location || (e.videoLink ? 'Video call' : ''),
      meta: formatEventWhen(e.start),
      account: e.account,
    }));

    // v-replaiy — Docs-resultaten verwijderd: Docs bestaat niet in Replaiy.

    // Leads (afgeleid van unieke leads die op de term matchen) — bij
    // actieve draft-chip verbergen. Zoek op naam, headline/functie en
    // bedrijf (geen e-mail).
    const contactMap = new Map<string, ResultContact>();
    if (!hasChipFilter) {
      for (const m of mails) {
        const name = m.from.name;
        const headline = (m as any).leadHeadline ?? (m as any).contact?.title ?? '';
        const company = (m as any).leadCompany ?? (m as any).contact?.company ?? '';
        if (
          term &&
          !name.toLowerCase().includes(term) &&
          !headline.toLowerCase().includes(term) &&
          !company.toLowerCase().includes(term)
        )
          continue;
        if (contactMap.has(name)) continue;
        const sub = [headline, company].filter(Boolean).join(' · ');
        contactMap.set(name, {
          kind: 'contact',
          id: m.id,
          title: name,
          subtitle: sub || `Last seen ${timeAgo(m.ts)}`,
          meta: company || `Last seen ${timeAgo(m.ts)}`,
          avatar: m.from.avatar,
        });
        if (contactMap.size >= 3) break;
      }
    }
    const contactItems = Array.from(contactMap.values());

    const flat: Result[] = [
      ...mailItems,
      ...eventItems,
      ...contactItems,
    ];

    return {
      mailResults: mailItems,
      eventResults: eventItems,
      contactResults: contactItems,
      flat,
    };
  }, [mails, term, activeChip, surface]);

  // Keep selectedIdx in range.
  useEffect(() => {
    if (selectedIdx >= flat.length) setSelectedIdx(Math.max(0, flat.length - 1));
  }, [flat.length, selectedIdx]);

  const openResult = (r: Result) => {
    setOpen(false);
    if (r.kind === 'mail') navigate(`/mail/${r.id}`);
    else if (r.kind === 'event') navigate('/calendar');
    else if (r.kind === 'contact') navigate(`/mail/${r.id}`);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(flat.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const r = flat[selectedIdx];
      if (r) openResult(r);
    }
  };

  // v30.30 — Klik op chip = filter binnen de modal, modal blijft open.
  // Toggle: tweede klik op zelfde chip = filter weer uit.
  // v-replaiy — De draft-chips (needsApproval/waiting/autoSent/dismissed)
  // zijn lokale filters, geen mail-views meer, dus we setten geen MailView
  // op de context. Alleen de Calendar-surface zet z'n cal-view persistent.
  const pickChip = (key: string) => {
    const next = activeChip === key ? null : key;
    setActiveChip(next);
    if (next === null) return;
    if (surface === 'calendar') setCalView(next as CalView);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            data-testid="universal-search-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[80] bg-black/30 backdrop-blur-[6px]"
          />
          {/* v30.29 — Modal container in de matte glass-stijl, identiek
              aan onze andere glass elementen (tab-pill, Reply, etc.).
              Op mobile (<768px) is hij fullscreen-sheet, op desktop een
              gecentreerde card 640px breed. */}
          <motion.div
            data-testid="universal-search-modal"
            initial={{ opacity: 0, scale: 0.98, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -6 }}
            transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
            // v30.30.1 — Positie: mobile = full-screen sheet, desktop =
            // gecentreerd in viewport. VASTE height (76vh) zodat de modal
            // altijd identiek staat ongeacht resultaten-count. Resultaten
            // scrollen intern.
            className="fixed z-[81] flex flex-col overflow-hidden inset-x-3 top-[10px] bottom-[10px] md:inset-x-0 md:bottom-auto md:top-[12vh] md:mx-auto md:w-[min(640px,90vw)] md:h-[76vh]"
            style={{
              borderRadius: 24,
              // v30.30 — Lichter glass. Was te donker/grijs. Nu zelfde recept
              // als VadikGlassSurface (sheen + lichte blur) zodat het past
              // bij de rest van de glass elementen op het platform.
              background:
                'linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.40) 45%, rgba(255,255,255,0.30) 78%, rgba(255,255,255,0.22) 100%)',
              backdropFilter: 'blur(20px) saturate(150%)',
              WebkitBackdropFilter: 'blur(20px) saturate(150%)',
              boxShadow:
                'inset 0 0 0 1px color-mix(in srgb, #fff 50%, transparent), inset 1.8px 3px 0 -2px color-mix(in srgb, #fff 80%, transparent), inset -2px -2px 0 -2px color-mix(in srgb, #fff 60%, transparent), 0 1px 5px 0 color-mix(in srgb, #000 6%, transparent), 0 24px 64px 0 color-mix(in srgb, #000 18%, transparent)',
            }}
          >
            {/* Search input row */}
            <div className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-foreground/[0.06] dark:border-white/[0.06]">
              <SearchIcon size={18} strokeWidth={1.7} className="text-icon shrink-0" />
              <input
                ref={inputRef}
                data-testid="input-universal-search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search drafts, leads, conversations…"
                className="flex-1 min-w-0 bg-transparent text-[15.5px] outline-none placeholder:text-foreground/40 tracking-[-0.005em]"
              />
              <kbd className="hidden md:inline-flex items-center gap-0.5 glass-pill pill px-2 py-0.5 text-[11px] font-semibold text-foreground/70 select-none">
                ⌘K
              </kbd>
              <button
                data-testid="button-universal-search-close"
                onClick={() => setOpen(false)}
                aria-label="Close search"
                className="h-7 w-7 rounded-full flex items-center justify-center text-icon hover-elevate active-elevate-2 shrink-0"
              >
                <X size={15} strokeWidth={1.8} />
              </button>
            </div>

            {/* v30.30 — Context-aware chips: mail/cal/docs afhankelijk van
                route. Klik op een chip = filter binnen modal, modal blijft
                open. Tweede klik op zelfde chip = filter uit. Default state
                = geen chip actief = search across all sources. */}
            <div className="flex items-center gap-2 px-5 py-3 overflow-x-auto no-scrollbar">
              {chips.map((c) => {
                const Icon = c.icon;
                const isActive = c.key === activeChip;
                return (
                  <button
                    key={c.key}
                    data-testid={`view-chip-${c.key}`}
                    onClick={() => pickChip(c.key)}
                    className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12.5px] font-medium tracking-[-0.005em] transition-colors ${
                      isActive
                        ? 'text-foreground'
                        : 'text-icon hover:text-foreground'
                    }`}
                    style={
                      isActive
                        ? {
                            background:
                              'color-mix(in srgb, #bbbbbc 36%, transparent)',
                            boxShadow:
                              'inset 0 0 0 1px color-mix(in srgb, #fff 10%, transparent), inset 2px 1px 0 -1px color-mix(in srgb, #fff 90%, transparent), inset -1.5px -1px 0 -1px color-mix(in srgb, #fff 80%, transparent), inset -2px -6px 1px -5px color-mix(in srgb, #fff 60%, transparent), inset -1px 2px 3px -1px color-mix(in srgb, #000 20%, transparent), inset 0 -4px 1px -2px color-mix(in srgb, #000 10%, transparent), 0 3px 6px 0 color-mix(in srgb, #000 8%, transparent)',
                          }
                        : {
                            background: 'rgba(255,255,255,0.04)',
                            boxShadow:
                              'inset 0 0 0 1px rgba(255,255,255,0.06)',
                          }
                    }
                  >
                    <Icon
                      size={13}
                      strokeWidth={1.9}
                      style={c.tint ? { color: c.tint } : undefined}
                    />
                    <span>{c.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto no-scrollbar px-2 py-2">
              {flat.length === 0 ? (
                <div className="px-4 py-12 text-center text-foreground/55">
                  <p className="text-[14px] font-medium">No matches</p>
                  <p className="text-[12.5px] mt-1 text-foreground/45">
                    Try a different lead, company, or draft phrase.
                  </p>
                </div>
              ) : (
                <>
                  {mailResults.length > 0 && (
                    <ResultGroup label="Drafts">
                      {mailResults.map((r, i) => {
                        const idx = i;
                        return (
                          <ResultRow
                            key={`m-${r.id}`}
                            active={selectedIdx === idx}
                            onMouseEnter={() => setSelectedIdx(idx)}
                            onClick={() => openResult(r)}
                            testId={`search-result-mail-${r.id}`}
                            leading={<StiltAvatar name={r.fromName} src={r.avatar} size={28} />}
                            title={r.title}
                            subtitle={r.subtitle}
                            meta={r.meta}
                            badges={
                              <>
                                {r.hasAttachment && (
                                  <Paperclip size={11} strokeWidth={2} className="text-foreground/45" />
                                )}
                                {r.done && (
                                  <CheckCircle2 size={11} strokeWidth={2} className="text-icon-muted" />
                                )}
                              </>
                            }
                          />
                        );
                      })}
                    </ResultGroup>
                  )}
                  {eventResults.length > 0 && (
                    <ResultGroup label="Events">
                      {eventResults.map((r, i) => {
                        const idx = mailResults.length + i;
                        return (
                          <ResultRow
                            key={`e-${r.id}`}
                            active={selectedIdx === idx}
                            onMouseEnter={() => setSelectedIdx(idx)}
                            onClick={() => openResult(r)}
                            testId={`search-result-event-${r.id}`}
                            leading={
                              <div className="h-7 w-7 rounded-lg flex items-center justify-center bg-foreground/[0.05] dark:bg-white/[0.06]">
                                <CalendarIcon
                                  size={13}
                                  strokeWidth={1.8}
                                  style={{ color: accountColor(r.account as any) }}
                                />
                              </div>
                            }
                            title={r.title}
                            subtitle={r.subtitle || '—'}
                            meta={r.meta}
                          />
                        );
                      })}
                    </ResultGroup>
                  )}
                  {contactResults.length > 0 && (
                    <ResultGroup label="Leads">
                      {contactResults.map((r, i) => {
                        const idx =
                          mailResults.length + eventResults.length + i;
                        return (
                          <ResultRow
                            key={`c-${r.id}-${r.title}`}
                            active={selectedIdx === idx}
                            onMouseEnter={() => setSelectedIdx(idx)}
                            onClick={() => openResult(r)}
                            testId={`search-result-contact-${i}`}
                            leading={<StiltAvatar name={r.title} src={r.avatar} size={28} />}
                            title={r.title}
                            subtitle={r.subtitle}
                            meta={r.meta}
                          />
                        );
                      })}
                    </ResultGroup>
                  )}
                </>
              )}
            </div>

            {/* Footer hint */}
            <div className="px-5 py-2.5 border-t border-foreground/[0.05] dark:border-white/[0.05] flex items-center justify-between text-[11px] text-foreground/45">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1">
                  <kbd className="glass-pill pill px-1.5 py-px text-[10px] font-semibold">↑↓</kbd>
                  navigate
                </span>
                <span className="inline-flex items-center gap-1">
                  <kbd className="glass-pill pill px-1.5 py-px text-[10px] font-semibold">↵</kbd>
                  open
                </span>
                <span className="inline-flex items-center gap-1">
                  <kbd className="glass-pill pill px-1.5 py-px text-[10px] font-semibold">esc</kbd>
                  close
                </span>
              </div>
              <span>{flat.length} result{flat.length === 1 ? '' : 's'}</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// v30.30 — FilterChip helper verwijderd. Vervangen door de inline
// chips-loop in UniversalSearch met de glass-indicator styling.

function ResultGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-1.5 last:mb-0">
      <div className="px-3 pt-2 pb-1 text-[10.5px] uppercase tracking-[0.08em] font-semibold text-foreground/45">
        {label}
      </div>
      <div className="flex flex-col">{children}</div>
    </div>
  );
}

function ResultRow({
  active,
  onMouseEnter,
  onClick,
  leading,
  title,
  subtitle,
  meta,
  badges,
  testId,
}: {
  active: boolean;
  onMouseEnter: () => void;
  onClick: () => void;
  leading: React.ReactNode;
  title: string;
  subtitle: string;
  meta: string;
  badges?: React.ReactNode;
  testId?: string;
}) {
  return (
    <button
      data-testid={testId}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
      className={`text-left flex items-center gap-3 px-3 py-2 rounded-xl mx-1 ${
        active
          ? 'bg-foreground/[0.06] dark:bg-white/[0.08]'
          : 'hover:bg-foreground/[0.03] dark:hover:bg-white/[0.04]'
      } transition-colors`}
    >
      <div className="shrink-0">{leading}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[13.5px] font-semibold tracking-[-0.005em] text-foreground truncate">
            {title}
          </span>
          {badges}
        </div>
        <div className="text-[12.5px] text-foreground/55 truncate">{subtitle}</div>
      </div>
      <div className="text-[11.5px] text-foreground/45 tabular-nums shrink-0">{meta}</div>
    </button>
  );
}

// Small trigger button — used inside the desktop sidebar header. Fires
// the global open event so the modal owner stays in one place.
export function UniversalSearchTrigger({ size = 52 }: { size?: number }) {
  return (
    <button
      data-testid="button-universal-search"
      aria-label="Search everything (⌘K)"
      title="Search everything · ⌘K"
      onClick={() => window.dispatchEvent(new CustomEvent('stilt:open-search'))}
      className="rounded-full glass-pill flex items-center justify-center shrink-0 hover-elevate active-elevate-2"
      style={{ height: size, width: size }}
    >
      <SearchIcon size={18} strokeWidth={1.7} className="text-icon" />
    </button>
  );
}
