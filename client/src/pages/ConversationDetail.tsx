import { ArrowLeft, CornerDownLeft, CornerUpRight, FileText, Image as ImageIcon, Sparkles } from 'lucide-react';
import { useLocation, useParams } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { useReplaiy } from '@/state/ReplaiyContext';
import { ReplaiyAvatar } from '@/components/Avatar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { APPLE_SPRING } from '@/lib/motion';
import { ConversationTimeline } from '@/components/ConversationTimeline';
import { useMobileTopChromeSlot } from '@/components/MobileTopChrome';
import { IdentityPill, ConversationActionPills, ConversationActionPillsCompact, SubjectPill, SubjectIdentityPill, ActionPill } from '@/components/ConversationDetailToolbar';
import { ConversationSummaryPanel, hasSummaryPanelValue } from '@/components/ConversationSummaryPanel';
import { InlineReplyBar, type ForwardContext } from '@/components/InlineReplyBar';
import type { SnoozeKey } from '@/components/ConversationActionCluster';

// Lightweight "how old" label for the single-mail meta-badge.
// Returns e.g. "just now", "2h ago", "yesterday", "3 days".
function relativeMailAge(iso?: string): string {
  if (!iso) return 'just now';
  const d = new Date(iso);
  if (Number.isNaN(+d)) return 'just now';
  const ms = Date.now() - +d;
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function AttachmentChip({ name, size, kind }: { name: string; size: string; kind: string }) {
  const Icon = kind === 'image' ? ImageIcon : FileText;
  return (
    <div className="lg-card p-2.5 flex items-center gap-2.5 min-w-[200px] hover-elevate active-elevate-2">
      <div className="h-10 w-10 rounded-xl bg-foreground/[0.06] dark:bg-white/[0.06] flex items-center justify-center shrink-0">
        <Icon size={16} strokeWidth={1.7} className="text-icon-muted" />
      </div>
      <div className="min-w-0">
        <div className="text-[13px] font-medium truncate">{name}</div>
        <div className="text-[11.5px] text-muted-foreground">{size}</div>
      </div>
    </div>
  );
}

// v30.30 — ConversationDetail outer dispatcher: ALLEEN universal hooks hier
// (useParams + useReplaiy + useMemo). Daarna delegeert naar SingleConversationDetail
// of ConversationTimeline. Voorkomt rules-of-hooks crash bij switchen
// tussen single → thread (verschillende hook counts).
export function ConversationDetail() {
  const params = useParams<{ id: string }>();
  const { conversations } = useReplaiy();
  const mail = useMemo(
    () => conversations.find((m) => m.id === params.id),
    [conversations, params.id],
  );
  if (!mail) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground p-8">
        <p className="text-[14px]">Select a draft to review</p>
      </div>
    );
  }
  // v30.32 — ALLE conversations (single + thread) renderen via ConversationTimeline.
  // Voorheen had single-mail een eigen SingleConversationDetail render-tree, wat
  // visueel inconsistent was (andere bubble, andere chrome, andere
  // spacing). ConversationTimeline maakt nu automatisch één synthetic
  // message als mail.messages leeg is — zelfde render-pad voor beide.
  // Key by id zodat React remountet bij mail-switch.
  return <ConversationTimeline mail={mail} key={mail.id} />;
}

function SingleConversationDetail({ mailId }: { mailId: string }) {
  const [, navigate] = useLocation();
  const {
    conversations,
    setConversationStatus,
    setComposePrefill,
    ai,
    summaryPanelOpen,
    toggleSummaryPanel,
    setSummaryPanelOpen,
  } = useReplaiy();
  const mail = conversations.find((m) => m.id === mailId)!;

  // v30.30 — Forward state. Wanneer gezet opent InlineReplyBar in
  // forward-mode — geen route-switch naar oud compose scherm.
  const [forwardContext, setForwardContext] = useState<ForwardContext | null>(null);
  // Mobile: hide Forward-pill naast bar wanneer editor expanded.
  const [replyBarExpanded, setReplyBarExpanded] = useState(false);

  // v30.30 — onSendInline: stuur reply OF forward inline zonder route-change.
  // Payload bevat HTML + recipients + attachments + kind.
  const onSendInline = (payload: {
    kind: 'reply' | 'forward' | 'compose';
    html: string;
    subject?: string;
    to: string[];
    cc: string[];
    bcc: string[];
    attachments: File[];
  }) => {
    // eslint-disable-next-line no-console
    console.log('[Replaiy] inline send', { mailId: mail.id, ...payload });
    if (payload.kind === 'forward') {
      // Forward voltooid: forward-state resetten, mail blijft 'open'.
      setForwardContext(null);
      navigate('/');
      return;
    }
    setConversationStatus(mail.id, 'waiting');
    navigate('/');
  };

  // v30.30 — Expand: opent full Compose voor lange/complexe replies.
  // Pre-fill met de huidige inline tekst zou ideaal zijn, maar dat
  // vereist state-lift uit InlineReplyBar. Voor nu: open Compose leeg
  // (of met smart reply prefill) en laat user opnieuw beginnen.
  // v-replaiy — The standalone /compose route was removed in the Stilt
  // cleanup (this SingleConversationDetail path is itself legacy/unused — the
  // exported ConversationDetail renders ConversationTimeline). Staging prefill
  // only; no route switch.
  const onExpandCompose = () => {
    setComposePrefill({
      to: `${mail.from.name} <${mail.from.email}>`,
      subject: mail.subject.startsWith('Re:') ? mail.subject : `Re: ${mail.subject}`,
      body: '',
      replyToId: mail.id,
    });
  };

  // v30.30 — Forward: opent InlineReplyBar in forward-mode (geen
  // route-switch). Editor wordt pre-filled met forward-block.
  const onForward = () => {
    const fwdSubject = mail.subject.startsWith('Fwd:')
      ? mail.subject
      : `Fwd: ${mail.subject}`;
    const fmtDate = (iso: string) => {
      try {
        return new Date(iso).toLocaleString();
      } catch {
        return iso;
      }
    };
    const escape = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const attachments = mail.attachments ?? [];
    // v30.30 — File-stubs i.p.v. platte <ul> in de body. Worden chips boven
    // de editor (zelfde UX als zelf-upload).
    const parseSize = (s: string) => {
      const m = String(s || '').match(/([\d.]+)\s*(KB|MB|B)/i);
      if (!m) return 0;
      const n = parseFloat(m[1]);
      const unit = m[2].toUpperCase();
      return Math.round(n * (unit === 'MB' ? 1024 * 1024 : unit === 'KB' ? 1024 : 1));
    };
    const mimeFor = (kind: string) => {
      switch (kind) {
        case 'pdf': return 'application/pdf';
        case 'image': return 'image/png';
        case 'doc': return 'application/msword';
        case 'sheet': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        case 'zip': return 'application/zip';
        default: return 'application/octet-stream';
      }
    };
    const fileStubs: File[] = attachments.map((a) => {
      const size = parseSize(a.size);
      const blob = new Blob([new Uint8Array(size > 0 ? Math.min(size, 64 * 1024) : 1)], {
        type: mimeFor(a.kind),
      });
      try {
        return new File([blob], a.name, { type: mimeFor(a.kind) });
      } catch {
        return blob as unknown as File;
      }
    });
    const body = `
      <p><br/></p>
      <p style="color:#86868b">—————————— Forwarded message ——————————</p>
      <p><strong>From:</strong> ${escape(mail.from.name)} &lt;${escape(mail.from.email)}&gt;<br/>
      <strong>Subject:</strong> ${escape(mail.subject)}<br/>
      <strong>Date:</strong> ${fmtDate(mail.ts)}</p>
      <p><br/></p>
      <p>${escape(mail.body || mail.preview || '').replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br/>')}</p>
    `;
    setForwardContext({
      subject: fwdSubject,
      body,
      attachments: fileStubs,
      attachmentLabels: attachments.map((a) => a.name),
    });
  };

  // v30.30 — AI-draft pre-fill alleen voor Today-for-you conversations (high prio
  // + needsReply + status open). Zelfde logic als InboxList's Today-for-you
  // sectie. Voorkomt AI-drafts bij newsletters/bots waar ze niet zinvol zijn.
  const isTodayForYou =
    mail.priority === 'high' && mail.status === 'open' && mail.needsReply;
  const aiDraft =
    ai.smartReply && isTodayForYou
      ? (mail as any).smartReplies?.[0] ?? null
      : null;

  const handleDone = () => {
    setConversationStatus(mail.id, 'done');
    navigate('/');
  };

  const handleSnooze = (_key: SnoozeKey) => {
    setConversationStatus(mail.id, 'snoozed');
    navigate('/');
  };

  // v19.3 — auto-collapse the inline summary panel when the user starts
  // scrolling the thread. Deadzone of 8px so micro-jitter doesn't fire.
  const desktopScrollRef = useRef<HTMLDivElement>(null);
  const lastScrollYRef = useRef(0);
  useEffect(() => {
    const el = desktopScrollRef.current;
    if (!el || !summaryPanelOpen) return;
    lastScrollYRef.current = el.scrollTop;
    const handleScroll = () => {
      const currentY = el.scrollTop;
      const delta = currentY - lastScrollYRef.current;
      if (Math.abs(delta) > 8 && currentY > 0) {
        setSummaryPanelOpen(false);
      }
      lastScrollYRef.current = currentY;
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [summaryPanelOpen, setSummaryPanelOpen]);

  return (
    <div className="flex flex-col h-full min-h-0 relative">
      {/* Mobile top-chrome slot — back + identity + Done/Snooze acties. */}
      <ConversationDetailChromeSlot
        name={mail.from.name}
        avatar={mail.from.avatar}
        onBack={() => navigate('/')}
        onDone={() => { setConversationStatus(mail.id, 'done'); navigate('/'); }}
        onSnooze={() => { setConversationStatus(mail.id, 'snoozed'); navigate('/'); }}
        onForward={onForward}
      />

      {/* ── DESKTOP top row (v19.3) ──────────────────────────────
         Five pills on the same horizontal baseline (top=12px, h=52px):
           [Inbox ▾]      [Avatar][Subject + meta-badge]      [Done] [Snooze]
         v19.3 — Avatar+Subject group is CENTERED via `justify-center`
         on the pill row, and the Done/Snooze pills are ABSOLUTELY
         anchored to the top-right (so they don't affect the centered
         group's position). The center group caps at max-w so a very
         long subject doesn't crowd the right-side action pills. */}
      <div
        data-testid="desktop-pill-row"
        className="hidden lg:block absolute top-3 inset-x-0 z-30 pointer-events-none"
      >
        {/* Inner band reserves space for the action pills on the RIGHT
           (`pr-[136px]` = 24px right edge + ~112px action pill cluster +
           gap), then centers the Avatar+Subject group inside the
           remaining space using `justify-center`. The action pills are
           absolutely anchored to the right and DO NOT participate in
           the center calculation. */}
        <div className="flex justify-center items-center pl-4 lg:pl-6 pr-[136px]">
          <div className="pointer-events-auto flex items-center gap-3 min-w-0 max-w-[640px]">
            {/* v30.32 — Combined identity + subject pill (zie
               ConversationDetailToolbar.tsx). Vervangt IdentityPill + SubjectPill
               losse pillen — één pill met avatar + naam | subject + meta. */}
            {/* v30.32 — meta-badge alleen tonen als panel waarde heeft
               (lange thread). Voor single conversations: geen badge, geen klik. */}
            <SubjectIdentityPill
              name={mail.from.name}
              avatar={mail.from.avatar}
              subject={mail.subject}
              metaLabel={hasSummaryPanelValue(mail) ? `${mail.messages?.length ?? 1} messages` : null}
              onMetaClick={hasSummaryPanelValue(mail) ? toggleSummaryPanel : undefined}
              metaActive={summaryPanelOpen}
            />
          </div>
        </div>
        <div className="absolute top-0 right-4 lg:right-6 pointer-events-auto">
          {/* v30.30 — Desktop = mobile compact pattern */}
          <ConversationActionPillsCompact
            onDone={handleDone}
            onSnooze={handleSnooze}
            onForward={onForward}
          />
        </div>
      </div>

      {/* DESKTOP scrollable container — pt makes room (76px = top:12 + 52 pill + 12 gap) for the floating top pill row. pb-24 clears the floating Reply circle.
          v19.3 — bound a ref so the summary panel can auto-collapse on scroll. */}
      <div
        ref={desktopScrollRef}
        data-testid="mail-detail-scroll"
        className="hidden lg:flex flex-col flex-1 min-h-0 overflow-y-auto no-scrollbar pb-24"
        style={{ paddingTop: 76 }}
      >
        <div className="flex-1 px-4 lg:px-6">
          <div className="max-w-2xl mx-auto">
            {/* Inline summary panel — animates opacity + y AND height so
                that the subject card below visibly pushes down. Lives
                in normal flow between the pill row and the Subject card. */}
            <AnimatePresence initial={false}>
              {summaryPanelOpen && (
                <motion.div
                  key="inline-summary"
                  initial={{ opacity: 0, y: -8, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, y: -8, height: 0 }}
                  transition={APPLE_SPRING}
                  className="overflow-hidden"
                  data-testid="inline-summary-wrapper"
                >
                  <div className="pb-3">
                    <ConversationSummaryPanel
                      mail={mail}
                      onClose={() => setSummaryPanelOpen(false)}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="max-w-2xl mx-auto"
          >
            {/* v19.2 — Subject + To cards REMOVED from the thread top. The
               sticky SubjectPill + IdentityPill in the column-2 chrome are
               now the single source. Body starts immediately. */}

            {/* Body card */}
            <div className="lg-card mb-3 px-4 lg:px-5 py-4">
              {ai.summary && mail.summary && (
                <p className="text-[13px] italic text-muted-foreground mb-3 flex items-start gap-1.5">
                  <Sparkles size={12} className="text-icon-muted shrink-0 mt-1" strokeWidth={1.7} />
                  <span>{mail.summary}</span>
                </p>
              )}
              <pre className="text-[15px] leading-[1.5] text-foreground/90 whitespace-pre-wrap font-sans">
                {mail.body}
              </pre>
            </div>

            {/* Attachments */}
            {mail.attachments && mail.attachments.length > 0 && (
              <div className="mb-3">
                <div className="px-2 pb-1.5 section-header">Attachments</div>
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                  {mail.attachments.map((a, i) => (
                    <AttachmentChip key={i} {...a} />
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </div>

      {/* MOBILE scrollable container — no sticky toolbar, thread scrolls under
          floating top chrome + above bottom action bar.
          v18.2 — pb-32 (128px) clears 56px circles + safe-area + 24px gap so
          the last line of email body sits clearly above the bottom bar. */}
      <div
        className="flex lg:hidden flex-col flex-1 min-h-0 overflow-y-auto no-scrollbar px-4 pb-32"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 80px)' }}
      >
        {/* Mobile inline summary — opacity + y + height (push content down). */}
        <AnimatePresence initial={false}>
          {summaryPanelOpen && (
            <motion.div
              key="mobile-inline-summary"
              initial={{ opacity: 0, y: -8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -8, height: 0 }}
              transition={APPLE_SPRING}
              className="overflow-hidden"
            >
              <div className="pb-3">
                <ConversationSummaryPanel mail={mail} onClose={() => setSummaryPanelOpen(false)} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="max-w-2xl mx-auto w-full"
        >
          <div className="lg-card mb-3 overflow-hidden">
            <div className="px-4 py-3.5 flex items-baseline gap-2.5">
              <span className="text-[14.5px] font-semibold text-foreground shrink-0">Subject:</span>
              <span className="text-[14.5px] text-foreground/90 truncate flex-1">{mail.subject}</span>
            </div>
            <div className="h-px bg-foreground/[0.06] dark:bg-white/[0.06] mx-4" />
            <div className="px-4 py-3.5 flex items-baseline gap-2.5">
              <span className="text-[14.5px] font-semibold text-foreground shrink-0">To:</span>
              <span className="text-[14.5px] text-foreground/85 truncate flex-1">{mail.from.email}</span>
            </div>
          </div>

          {/* v30.31 — single-message body gebruikt rp-bubble (zelfde
             surface-token als chat-bubbles in ConversationTimeline).
             Was eerder lg-card — dat is een complexere liquid-glass
             recipe die visueel donkerder/lichter rendert dan een
             chat-bubble in dezelfde mode, waardoor Nora's thread en
             Elena's single message verschillende tints kregen. */}
          <div className="rp-bubble rounded-[20px] mb-3 px-4 py-4">
            {ai.summary && mail.summary && (
              <p className="text-[13px] italic text-muted-foreground mb-3 flex items-start gap-1.5">
                <Sparkles size={12} className="text-icon-muted shrink-0 mt-1" strokeWidth={1.7} />
                <span>{mail.summary}</span>
              </p>
            )}
            <pre className="text-[15px] leading-[1.5] text-foreground/90 whitespace-pre-wrap font-sans">
              {mail.body}
            </pre>
          </div>

          {mail.attachments && mail.attachments.length > 0 && (
            <div className="mb-3">
              <div className="px-2 pb-1.5 section-header">Attachments</div>
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {mail.attachments.map((a, i) => (
                  <AttachmentChip key={i} {...a} />
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* v30.30 — Smart-replies chips overlay verwijderd: AI-draft staat
         nu pre-filled in de inline reply bar zelf (zie InlineReplyBar).
         Geen aparte chips meer nodig. */}

      {/* v30.30 — Inline reply bar onderaan, vervangt de oude floating
         Reply pill + Compose-pagina flow. AI-draft staat pre-filled als
         smart-reply aanstaat. Forward zit nu in de top-right action row
         (zie ConversationActionPills hierboven). Desktop only — mobile heeft
         z'n eigen ConversationDetailBottomBar met inline reply. */}
      <div
        className="hidden lg:block"
        style={{
          position: 'absolute',
          bottom: 16,
          left: 16,
          right: 16,
          zIndex: 30,
        }}
      >
        <InlineReplyBar
          aiDraft={aiDraft}
          recipientName={mail.from.name}
          recipientEmail={mail.from.email}
          mailId={mail.id}
          forwardContext={forwardContext}
          onForwardCancel={() => setForwardContext(null)}
          onDismiss={() => { setConversationStatus(mail.id, 'done'); navigate('/'); }}
          onSend={onSendInline}
          onExpand={onExpandCompose}
        />
      </div>

      {/* v30.30 — Mobile inline reply bar (Forward zit nu in top-rechts). */}
      <div
        className="lg:hidden absolute left-3 right-3 bottom-3 z-30"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <InlineReplyBar
          aiDraft={aiDraft}
          recipientName={mail.from.name}
          recipientEmail={mail.from.email}
          mailId={mail.id}
          forwardContext={forwardContext}
          onForwardCancel={() => setForwardContext(null)}
          onDismiss={() => { setConversationStatus(mail.id, 'done'); navigate('/'); }}
          onSend={onSendInline}
          onExpand={onExpandCompose}
          onExpandedChange={setReplyBarExpanded}
        />
      </div>
    </div>
  );
}

function ConversationDetailChromeSlot({
  name,
  avatar,
  onBack,
  onDone,
  onSnooze,
  onForward,
}: {
  name: string;
  avatar?: string;
  onBack: () => void;
  onDone?: () => void;
  onSnooze?: () => void;
  onForward?: () => void;
}) {
  const slot = useMemo(
    () => ({
      priority: 100,
      leftSlot: (
        <ActionPill testId="button-back" label="Back" onClick={onBack}>
          <ArrowLeft size={20} strokeWidth={1.7} className="text-icon" />
        </ActionPill>
      ),
      togglePill: (
        // v-replaiy — iMessage style: avatar + naam plain (geen capsule).
        // The legacy contact info panel was removed, so this is now a plain
        // non-interactive identity.
        <div
          data-testid="contact-pill"
          className="inline-flex items-center gap-2 px-1 h-[52px]"
        >
          <ReplaiyAvatar name={name} src={avatar} size={32} />
          <span className="text-[14px] font-semibold tracking-[-0.005em] truncate max-w-[160px] text-foreground">
            {name}
          </span>
        </div>
      ),
      // v30.30 — Mobile: Done + ••• overflow (compact).
      rightSlot:
        onDone && onSnooze ? (
          <ConversationActionPillsCompact
            onDone={onDone}
            onSnooze={onSnooze}
            onForward={onForward}
          />
        ) : (
          <div style={{ width: 52, height: 52 }} aria-hidden="true" />
        ),
    }),
    [name, avatar, onBack, onDone, onSnooze, onForward],
  );
  useMobileTopChromeSlot(slot);
  return null;
}
