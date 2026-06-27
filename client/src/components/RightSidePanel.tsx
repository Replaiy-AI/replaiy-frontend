// ─────────────────────────────────────────────────────────────────
// v18 — RightSidePanel (Contact + Linked only)
//
// The Summary tab has moved to the inline MailSummaryPanel (rendered
// directly inside the mail-detail column on desktop, and inside a
// mobile bottom-sheet on small screens). This panel now hosts only:
//   • Contact — sender dossier
//   • Linked  — related events / docs
//
// Open state lives in StiltContext as `contactPanelOpen` (persists
// across mail navigation). Triggers:
//   - Clicking the toolbar identity (desktop) / contact-pill (mobile)
//   - window CustomEvent('stilt:open-contact-panel')
//   - window CustomEvent('stilt:open-panel') with detail.view
//
// Renders as:
//   • Desktop ≥1024  — overlay right-side glass card (370px)
//   • Mobile  <1024  — bottom sheet with the same tabbed content
//
// Dismiss: X button, click backdrop, Escape key.
// ─────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { AnimatePresence, motion } from 'framer-motion';
import {
  X,
  Sparkles,
  Mail as MailIcon,
  Phone,
  Linkedin,
  Globe,
  Clock,
  TrendingUp,
  CalendarDays,
  FileText,
  User as UserIcon,
  Link2,
} from 'lucide-react';
import { useStilt } from '@/state/StiltContext';
import { StiltAvatar } from './Avatar';
import { APPLE_SPRING } from '@/lib/motion';
import { GlassSegmentedToggle } from './GlassSegmentedToggle';
import { timeAgo } from '@/lib/avatar';
import { mockEvents } from '@/data/mockEvents';
import type { Mail } from '@/data/mockEmails';

export type PanelView = 'contact' | 'linked';

// ── Public event API ──────────────────────────────────────────────
export function openRightPanel(view: PanelView = 'contact') {
  window.dispatchEvent(new CustomEvent('stilt:open-panel', { detail: { view } }));
}

// Legacy alias retained for older callers that still emit
//   stilt:open-contact-panel
// They get routed straight to the Contact view here.

// ── Width / viewport hooks ────────────────────────────────────────
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia('(min-width: 1024px)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const h = () => setIsDesktop(mq.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);
  return isDesktop;
}

// ── Sub-views ─────────────────────────────────────────────────────
// Profile header card — large 96px avatar centered, name h2, email muted.
// Rendered BELOW the tab row, inside the scroll body. Followed by an
// "Email <FirstName>" CTA button (lg-pill recipe).
function ProfileHeaderCard({ mail, onEmail }: { mail: Mail; onEmail: () => void }) {
  const { from } = mail;
  const firstName = from.name.split(' ')[0];
  return (
    <div className="flex flex-col items-center text-center pt-2 pb-1" data-testid="profile-header-card">
      <StiltAvatar name={from.name} size={96} />
      <h2
        className="mt-4 text-[20px] font-semibold tracking-[-0.02em] text-foreground"
        data-testid="text-profile-name"
      >
        {from.name}
      </h2>
      <p
        className="text-[13px] text-muted-foreground mt-1 break-all"
        data-testid="text-profile-email"
      >
        {from.email}
      </p>
      <button
        type="button"
        onClick={onEmail}
        data-testid="button-email-contact"
        className="lg-pill h-11 mt-5 px-5 inline-flex items-center justify-center gap-2 text-[13.5px] font-semibold text-foreground hover-elevate active-elevate-2"
      >
        <MailIcon size={15} strokeWidth={1.8} />
        Email {firstName}
      </button>
    </div>
  );
}

function ContactDetailRow({
  icon: Icon,
  label,
  value,
  href,
  testId,
}: {
  icon: typeof MailIcon;
  label: string;
  value: string;
  href?: string;
  testId?: string;
}) {
  const body = (
    <>
      <div className="h-8 w-8 rounded-xl bg-foreground/[0.05] dark:bg-white/[0.05] flex items-center justify-center shrink-0">
        <Icon size={14} strokeWidth={1.7} className="text-icon-muted" />
      </div>
      <div className="flex-1 min-w-0 text-left">
        <p className="text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground font-semibold">
          {label}
        </p>
        <p className="text-[13px] font-medium text-foreground mt-0.5 truncate">{value}</p>
      </div>
    </>
  );
  const cls =
    'glass rounded-2xl px-3.5 py-3 flex items-center gap-3 hover-elevate active-elevate-2 w-full';
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cls}
        data-testid={testId}
      >
        {body}
      </a>
    );
  }
  return (
    <div className={cls} data-testid={testId}>
      {body}
    </div>
  );
}

function ContactView({ mail }: { mail: Mail }) {
  const { contact } = mail;
  return (
    <div className="flex flex-col gap-4">
      {/* Contact details */}
      <section>
        <p className="text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground font-semibold mb-2 px-1">
          Details
        </p>
        <div className="flex flex-col gap-1.5">
          {contact?.title && (
            <ContactDetailRow
              icon={UserIcon}
              label="Title"
              value={contact.title}
              testId="contact-detail-title"
            />
          )}
          {contact?.company && (
            <ContactDetailRow
              icon={Globe}
              label="Company"
              value={contact.company}
              testId="contact-detail-company"
            />
          )}
          {contact?.timezone && (
            <ContactDetailRow
              icon={Clock}
              label="Timezone"
              value={contact.timezone}
              testId="contact-detail-timezone"
            />
          )}
          {contact?.lastContacted && (
            <ContactDetailRow
              icon={Clock}
              label="Last contacted"
              value={contact.lastContacted}
              testId="contact-detail-last-contacted"
            />
          )}
          {contact?.phone && (
            <ContactDetailRow
              icon={Phone}
              label="Phone"
              value={contact.phone}
              testId="contact-detail-phone"
            />
          )}
          {contact?.linkedinUrl && (
            <ContactDetailRow
              icon={Linkedin}
              label="LinkedIn"
              value={contact.linkedinUrl.replace(/^https?:\/\//, '')}
              href={contact.linkedinUrl}
              testId="contact-detail-linkedin"
            />
          )}
          {!contact && (
            <div className="glass rounded-2xl px-4 py-3 text-[12.5px] text-muted-foreground">
              No additional contact details on file.
            </div>
          )}
        </div>
      </section>

      {/* AI insights */}
      {contact?.aiInsights && (
        <section>
          <p className="text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground font-semibold mb-2 px-1 flex items-center gap-1.5">
            <Sparkles size={11} strokeWidth={1.8} className="text-icon-muted" />
            AI insights
          </p>
          <div className="glass-ai rounded-2xl px-4 py-3 space-y-2">
            {contact.aiInsights.avgResponseTime && (
              <div className="flex items-center gap-2 text-[12px]">
                <TrendingUp size={12} className="text-muted-foreground" strokeWidth={1.6} />
                <span className="text-muted-foreground">Avg response</span>
                <span className="ml-auto font-medium">{contact.aiInsights.avgResponseTime}</span>
              </div>
            )}
            {contact.aiInsights.mostActive && (
              <div className="flex items-center gap-2 text-[12px]">
                <Clock size={12} className="text-muted-foreground" strokeWidth={1.6} />
                <span className="text-muted-foreground">Most active</span>
                <span className="ml-auto font-medium">{contact.aiInsights.mostActive}</span>
              </div>
            )}
            {contact.aiInsights.sentiment && (
              <div className="flex items-center gap-2 text-[12px]">
                <Sparkles size={12} className="text-muted-foreground" strokeWidth={1.6} />
                <span className="text-muted-foreground">Tone</span>
                <span className="ml-auto font-medium">{contact.aiInsights.sentiment}</span>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function LinkedView({ mail }: { mail: Mail }) {
  // Synthesize linked items from the mock data set so the view never
  // feels empty for the demo. We match calendar events to this mail by
  // participant email; we also include the current thread itself as a
  // "Recent" item plus a placeholder "shared doc" if the subject hints
  // at one.
  const linkedEvents = useMemo(() => {
    return mockEvents
      .filter((e) => e.participants?.some((p) => p.email === mail.from.email))
      .slice(0, 3);
  }, [mail.from.email]);

  const hasLinkedDoc = /roadmap|contract|brief|spec|deck|doc/i.test(mail.subject);

  return (
    <div className="flex flex-col gap-4">
      {/* Recent thread */}
      <section>
        <p className="text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground font-semibold mb-2 px-1">
          This thread
        </p>
        <div className="glass rounded-2xl px-4 py-3">
          <p className="text-[13px] font-medium truncate">{mail.subject}</p>
          <p className="text-[11.5px] text-muted-foreground mt-0.5">{timeAgo(mail.ts)}</p>
        </div>
      </section>

      {/* Linked events */}
      <section>
        <p className="text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground font-semibold mb-2 px-1 flex items-center gap-1.5">
          <CalendarDays size={11} strokeWidth={1.8} />
          Linked events
        </p>
        {linkedEvents.length === 0 ? (
          <div className="glass rounded-2xl px-4 py-3 text-[12.5px] text-muted-foreground">
            No events on the calendar with {mail.from.name.split(' ')[0]}.
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {linkedEvents.map((e) => {
              const d = new Date(e.start);
              const dateLabel = d.toLocaleDateString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              });
              const timeLabel = d.toLocaleTimeString(undefined, {
                hour: 'numeric',
                minute: '2-digit',
              });
              return (
                <div
                  key={e.id}
                  data-testid={`linked-event-${e.id}`}
                  className="glass rounded-2xl px-4 py-3 flex items-start gap-3 hover-elevate active-elevate-2"
                >
                  <div className="h-8 w-8 rounded-xl bg-foreground/[0.05] dark:bg-white/[0.05] flex items-center justify-center shrink-0">
                    <CalendarDays size={14} strokeWidth={1.6} className="text-icon-muted" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium truncate">{e.title}</p>
                    <p className="text-[11.5px] text-muted-foreground mt-0.5">
                      {dateLabel} · {timeLabel}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Linked docs / attachments */}
      <section>
        <p className="text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground font-semibold mb-2 px-1 flex items-center gap-1.5">
          <FileText size={11} strokeWidth={1.8} />
          Linked docs
        </p>
        {!hasLinkedDoc && (!mail.attachments || mail.attachments.length === 0) ? (
          <div className="glass rounded-2xl px-4 py-3 text-[12.5px] text-muted-foreground">
            No documents linked to this thread.
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {hasLinkedDoc && (
              <div
                data-testid="linked-doc-shared"
                className="glass rounded-2xl px-4 py-3 flex items-start gap-3 hover-elevate active-elevate-2"
              >
                <div className="h-8 w-8 rounded-xl bg-foreground/[0.05] dark:bg-white/[0.05] flex items-center justify-center shrink-0">
                  <FileText size={14} strokeWidth={1.6} className="text-icon-muted" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium truncate">
                    {mail.subject.replace(/^Re:\s*/i, '')}
                  </p>
                  <p className="text-[11.5px] text-muted-foreground mt-0.5">
                    Shared in this thread
                  </p>
                </div>
              </div>
            )}
            {mail.attachments?.map((a, i) => (
              <div
                key={i}
                data-testid={`linked-attachment-${i}`}
                className="glass rounded-2xl px-4 py-3 flex items-start gap-3 hover-elevate active-elevate-2"
              >
                <div className="h-8 w-8 rounded-xl bg-foreground/[0.05] dark:bg-white/[0.05] flex items-center justify-center shrink-0">
                  <FileText size={14} strokeWidth={1.6} className="text-icon-muted" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium truncate">{a.name}</p>
                  <p className="text-[11.5px] text-muted-foreground mt-0.5">{a.size}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ── Panel body ────────────────────────────────────────────────────
// v18.1 — Header is a clean row: segmented toggle (left, with Contact &
// Linked text+icon segments) and close button (right). The profile
// header card (avatar+name+email + Email CTA) sits BELOW the tab row,
// inside the scrollable body, but only for the Contact view. Linked
// view scrolls without a profile header.
function PanelBody({
  mail,
  view,
  setView,
  onClose,
}: {
  mail: Mail;
  view: PanelView;
  setView: (v: PanelView) => void;
  onClose: () => void;
}) {
  const handleEmail = () => {
    // Dispatch an event the compose flow can subscribe to. For now we
    // also navigate via window.location.hash so the existing route
    // handler (#/compose) is consistent with the rest of the app.
    window.dispatchEvent(
      new CustomEvent('stilt:compose', {
        detail: { to: `${mail.from.name} <${mail.from.email}>` },
      }),
    );
    window.location.hash = '/compose';
    onClose();
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* v18.2 — Header row: segmented toggle left-aligned, close button
         right-aligned. Both share px-6 py-4 padding for a clean header. */}
      <div className="px-6 py-4 flex items-center gap-3 shrink-0">
        <div className="glass-pill pill flex items-center h-11 shrink-0" data-testid="panel-tabs-wrap">
          <GlassSegmentedToggle
            testId="panel-tabs"
            pad={4}
            indicatorStyle="glass-rich"
            value={view}
            onChange={(k) => setView(k as PanelView)}
            segments={[
              { key: 'contact', icon: UserIcon, label: 'Contact', activeWidth: 108, inactiveWidth: 44 },
              { key: 'linked',  icon: Link2,    label: 'Linked',  activeWidth: 100, inactiveWidth: 44 },
            ]}
          />
        </div>
        <button
          onClick={onClose}
          data-testid="button-close-panel"
          className="ml-auto h-11 w-11 rounded-full glass-pill flex items-center justify-center text-icon hover-elevate active-elevate-2 shrink-0"
          aria-label="Close panel"
        >
          <X size={19} strokeWidth={1.75} />
        </button>
      </div>

      {/* Scrollable body — lg-sheet-scroll for fade masks at top/bottom edges. */}
      <div className="flex-1 overflow-y-auto no-scrollbar lg-sheet-scroll px-6 pb-6">
        {view === 'contact' && (
          <ProfileHeaderCard mail={mail} onEmail={handleEmail} />
        )}
        <div className={view === 'contact' ? 'mt-5' : ''}>
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
            >
              {view === 'contact' && <ContactView mail={mail} />}
              {view === 'linked' && <LinkedView mail={mail} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ── Public root component ─────────────────────────────────────────
export function RightSidePanel() {
  const { mails, setSheetOpen, contactPanelOpen, setContactPanelOpen } = useStilt();
  const [loc] = useLocation();
  const isDesktop = useIsDesktop();
  // v18 — open state lives in the global StiltContext (contactPanelOpen).
  // Tabs: Contact (default) + Linked. Summary moved out (inline).
  const open = contactPanelOpen;
  const setOpen = setContactPanelOpen;
  const [view, setView] = useState<PanelView>('contact');

  // Listen for open events.
  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent).detail as { view?: PanelView | 'summary' } | undefined;
      const v = detail?.view;
      if (v === 'linked') setView('linked');
      else setView('contact');
      setOpen(true);
    };
    const onContactOpen = () => {
      setView('contact');
      setOpen(true);
    };
    window.addEventListener('stilt:open-panel', onOpen);
    window.addEventListener('stilt:open-contact-panel', onContactOpen);
    return () => {
      window.removeEventListener('stilt:open-panel', onOpen);
      window.removeEventListener('stilt:open-contact-panel', onContactOpen);
    };
  }, [setOpen]);

  // v17 — do NOT auto-close on mail navigation. The panel persists across
  // mails until the user closes it explicitly. Only close when leaving
  // mail routes entirely (e.g. navigating to /calendar or /docs).
  useEffect(() => {
    const onMailRoute = loc.startsWith('/mail/') || loc === '/';
    if (!onMailRoute) setOpen(false);
  }, [loc, setOpen]);

  // Escape dismisses.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // Drive global sheetOpen on mobile so the bottom nav/FAB fade.
  useEffect(() => {
    if (isDesktop) return; // desktop overlay doesn't need to hide bottom nav
    setSheetOpen(open);
    return () => setSheetOpen(false);
  }, [open, isDesktop, setSheetOpen]);

  const mailId = loc.startsWith('/mail/') ? loc.replace('/mail/', '') : '';
  const mail = mails.find((m) => m.id === mailId);
  if (!mail) return null;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setOpen(false)}
            data-testid="right-panel-backdrop"
            className="fixed inset-0 backdrop-blur-[2px]"
            style={{
              zIndex: 49,
              background: isDesktop ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.4)',
            }}
          />

          {isDesktop ? (
            // ── DESKTOP overlay panel ──
            <motion.aside
              data-testid="right-panel"
              initial={{ x: '105%' }}
              animate={{ x: 0 }}
              exit={{ x: '105%' }}
              transition={APPLE_SPRING}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={{ left: 0, right: 0.3 }}
              onDragEnd={(_, info) => {
                if (info.offset.x > 140 || info.velocity.x > 500) setOpen(false);
              }}
              className="fixed top-3 bottom-3 right-3 z-50 glass-strong flex flex-col"
              style={{
                width: 370,
                maxWidth: '90vw',
                borderRadius: 24,
                boxShadow: '-12px 0 40px rgba(0,0,0,0.18)',
              }}
            >
              <PanelBody mail={mail} view={view} setView={setView} onClose={() => setOpen(false)} />
            </motion.aside>
          ) : (
            // ── MOBILE / TABLET bottom sheet ──
            <motion.div
              data-testid="right-panel"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={APPLE_SPRING}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.3 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 140 || info.velocity.y > 500) setOpen(false);
              }}
              className="fixed inset-x-0 bottom-0 z-50 glass-strong rounded-t-[28px] pt-3 flex flex-col"
              style={{ maxHeight: '85vh' }}
            >
              <div className="mx-auto h-1 w-10 rounded-full bg-foreground/15 mb-1 shrink-0" />
              <PanelBody mail={mail} view={view} setView={setView} onClose={() => setOpen(false)} />
            </motion.div>
          )}
        </>
      )}
    </AnimatePresence>
  );
}
