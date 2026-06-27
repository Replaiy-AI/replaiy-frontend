// ─────────────────────────────────────────────────────────────────
// ContactInfoPanel — full rewrite (v31)
//
// Goal: kill the long-standing layout jump on mobile where the avatar /
// name / email / status pill would shift vertically when switching between
// the Overview ↔ Contact tabs (and when toggling edit mode on the Contact
// tab). The root cause was a header whose intrinsic height changed because
// (a) the top action row had conditionals that could collapse to a zero-
// height span, and (b) the identity column had no fixed height so its
// natural height shifted slightly with content underneath.
//
// New architecture (single PanelBody used by both mobile sheet and desktop
// slide panel):
//
//   ┌───────────────────────────────────┐
//   │  StickyHeader   (height: 280px)   │  ← shrink-0, NEVER scrolls
//   │  ├─ Top action row   (h: 56px)    │     fixed slots both sides
//   │  ├─ Identity block   (h: 168px)   │     avatar + name + email + pill
//   │  └─ Segmented control (h: 40px)   │     Overview / Contact
//   ├───────────────────────────────────┤
//   │  ScrollableContent  (flex-1)      │  ← only scroll area
//   └───────────────────────────────────┘
//
// Mobile sheet: 92vh, flat bottom, rounded top, no drag. Animates only
// via opacity + translateY through framer-motion initial/animate/exit.
// Desktop slide panel: 380px wide right-anchored glass pill that slides
// in from the right.
// ─────────────────────────────────────────────────────────────────
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Check,
  Calendar as CalendarIcon,
  Search,
  BellOff,
  CalendarDays,
  FileText,
  Pencil,
  Phone,
  Briefcase,
  Linkedin,
  Globe,
  MapPin,
  StickyNote,
} from 'lucide-react';
import { useStilt } from '@/state/StiltContext';
import { StiltAvatar } from '@/components/Avatar';
import { APPLE_SPRING } from '@/lib/motion';
import { mockEvents } from '@/data/mockEvents';
import type { Mail } from '@/data/mockEmails';
import { lacksBackdropSVGFilter } from '@/lib/ios-detect';
import {
  VADIK_DISPLACEMENT_WEBP,
  vadikInsetRimShadows,
  vadikGlassSurfaceStyle,
} from '@/lib/vadik-glass-style';

// ─── Viewport mode ───────────────────────────────────────────────────────
type Mode = 'sheet' | 'slide';

function useViewportMode(): Mode {
  const [mode, setMode] = useState<Mode>(() => {
    if (typeof window === 'undefined') return 'sheet';
    return window.matchMedia('(min-width: 1024px)').matches ? 'slide' : 'sheet';
  });
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setMode(mq.matches ? 'slide' : 'sheet');
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return mode;
}

// ─── Tiny helpers ────────────────────────────────────────────────────────
function Sparkle({ size = 12 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden
      style={{ color: 'var(--ai-accent, #13A89E)' }}
    >
      <path d="M8 0L9.5 5.5L15 7L9.5 8.5L8 14L6.5 8.5L1 7L6.5 5.5L8 0Z" />
    </svg>
  );
}

function sinceFirstLabel(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffDays = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays < 1) return 'today';
    if (diffDays < 7) return `${Math.floor(diffDays)}d`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo`;
    return `${Math.floor(diffDays / 365)}y`;
  } catch {
    return '—';
  }
}

// ─── Row ────────────────────────────────────────────────────────────────
function Row({
  icon: Icon,
  title,
  subtitle,
  onClick,
  testId,
  iconColor,
  titleItalic,
}: {
  icon: React.ComponentType<any>;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  onClick?: () => void;
  testId?: string;
  iconColor?: string;
  titleItalic?: boolean;
}) {
  const Wrapper: any = onClick ? 'button' : 'div';
  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      data-testid={testId}
      className={`text-left w-full rounded-2xl px-2 py-2 flex items-start gap-3 ${onClick ? 'hover-elevate active-elevate-2' : ''}`}
    >
      <div className="h-9 w-9 rounded-full bg-foreground/[0.05] dark:bg-white/[0.07] flex items-center justify-center shrink-0">
        <Icon size={14} strokeWidth={1.8} className={iconColor || 'text-icon-muted'} />
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className={`text-[13.5px] truncate text-foreground ${titleItalic ? 'italic font-normal' : 'font-medium'}`}>
          {title}
        </p>
        {subtitle && (
          <p className="text-[12px] text-foreground/55 mt-0.5 truncate">{subtitle}</p>
        )}
      </div>
    </Wrapper>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[12px] text-foreground/45 font-medium mb-1.5 px-2">
      {children}
    </div>
  );
}

// ─── Overview sections ──────────────────────────────────────────────────
function BetweenYouSection({
  mail,
  navigate,
  onClose,
}: {
  mail: Mail;
  navigate: (to: string) => void;
  onClose: () => void;
}) {
  const { mails } = useStilt();
  const items = useMemo(
    () =>
      mails
        .filter(
          (m) =>
            m.from.email === mail.from.email &&
            m.status === 'open' &&
            m.id !== mail.id,
        )
        .slice(0, 3),
    [mails, mail.from.email, mail.id],
  );
  if (items.length === 0) return null;
  return (
    <section className="px-4">
      <SectionTitle>Between you</SectionTitle>
      <div className="flex flex-col gap-0.5">
        {items.map((m) => (
          <Row
            key={m.id}
            icon={Sparkle as any}
            iconColor=""
            title={m.aiReasoning || m.summary || m.preview}
            subtitle={[m.leadHeadline, m.leadCompany].filter(Boolean).join(' · ')}
            onClick={() => {
              navigate(`/mail/${m.id}`);
              onClose();
            }}
            testId={`between-you-${m.id}`}
          />
        ))}
      </div>
    </section>
  );
}

function ThisWeekSection({
  mail,
  navigate,
  onClose,
}: {
  mail: Mail;
  navigate: (to: string) => void;
  onClose: () => void;
}) {
  const events = useMemo(() => {
    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    return mockEvents
      .filter((e) => {
        if (!e.participants?.some((p) => p.email === mail.from.email)) return false;
        const t = new Date(e.start).getTime();
        return t >= now && t <= now + sevenDays;
      })
      .slice(0, 3);
  }, [mail.from.email]);
  if (events.length === 0) return null;
  return (
    <section className="px-4">
      <SectionTitle>This week</SectionTitle>
      <div className="flex flex-col gap-0.5">
        {events.map((e) => {
          const d = new Date(e.start);
          const dateLabel = d.toLocaleDateString(undefined, {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
          });
          const timeLabel = d.toLocaleTimeString(undefined, {
            hour: 'numeric',
            minute: '2-digit',
          });
          return (
            <Row
              key={e.id}
              icon={CalendarDays}
              title={e.title}
              subtitle={`${dateLabel} · ${timeLabel}`}
              onClick={() => {
                navigate('/calendar');
                onClose();
              }}
              testId={`this-week-${e.id}`}
            />
          );
        })}
      </div>
    </section>
  );
}

function SharedLatelySection({ mail }: { mail: Mail }) {
  // LinkedIn conversations have no email subjects, but attachments are
  // supported — show any files shared in this conversation.
  const attachments = mail.attachments || [];
  if (attachments.length === 0) return null;
  return (
    <section className="px-4">
      <SectionTitle>Shared lately</SectionTitle>
      <div className="flex flex-col gap-0.5">
        {attachments.map((a, i) => (
          <Row
            key={i}
            icon={FileText}
            title={a.name}
            subtitle={a.size}
            testId={`shared-attachment-${i}`}
          />
        ))}
      </div>
    </section>
  );
}

// ─── Contact tab (editable rows) ────────────────────────────────────────
interface ContactDraft {
  phone: string;
  role: string;
  linkedin: string;
  website: string;
  location: string;
  notes: string;
}

function ContactEditableRow({
  icon: Icon,
  label,
  value,
  placeholder,
  editing,
  onChange,
  onStartEdit,
  italic,
  type = 'text',
  testId,
}: {
  icon: any;
  label: string;
  value: string;
  placeholder: string;
  editing: boolean;
  onChange: (v: string) => void;
  onStartEdit: () => void;
  italic?: boolean;
  type?: 'text' | 'tel' | 'url';
  testId: string;
}) {
  if (editing) {
    return (
      <div className="flex items-start gap-3 px-2 py-2 rounded-2xl">
        <div className="h-9 w-9 rounded-full bg-foreground/[0.05] dark:bg-white/[0.07] flex items-center justify-center shrink-0">
          <Icon size={14} strokeWidth={1.8} className="text-icon-muted" />
        </div>
        <div className="min-w-0 flex-1">
          <label className="block text-[11px] text-foreground/45 font-medium mb-0.5">{label}</label>
          <input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            data-testid={`${testId}-input`}
            className={`w-full bg-transparent text-[13.5px] text-foreground placeholder:text-foreground/30 outline-none focus:outline-none border-b border-foreground/[0.08] dark:border-white/[0.08] focus:border-foreground/30 py-1 ${italic ? 'italic font-normal' : 'font-medium'}`}
          />
        </div>
      </div>
    );
  }
  if (value) {
    return <Row icon={Icon} title={value} titleItalic={italic} testId={testId} />;
  }
  return (
    <button
      type="button"
      onClick={onStartEdit}
      data-testid={`${testId}-placeholder`}
      className="text-left w-full rounded-2xl px-2 py-2 flex items-start gap-3 hover-elevate active-elevate-2"
    >
      <div className="h-9 w-9 rounded-full bg-foreground/[0.05] dark:bg-white/[0.07] flex items-center justify-center shrink-0">
        <Icon size={14} strokeWidth={1.8} className="text-foreground/35" />
      </div>
      <div className="min-w-0 flex-1 pt-1">
        <p className="text-[13.5px] text-foreground/40 font-normal">{placeholder}</p>
      </div>
    </button>
  );
}

function ContactTab({
  editing,
  onStartEdit,
  draft,
  setDraft,
}: {
  editing: boolean;
  onStartEdit: () => void;
  draft: ContactDraft;
  setDraft: (patch: Partial<ContactDraft>) => void;
}) {
  return (
    <div className="flex flex-col gap-0.5 px-4 py-2">
      <ContactEditableRow
        icon={Phone}
        label="Phone"
        value={draft.phone}
        placeholder="Add phone"
        type="tel"
        editing={editing}
        onChange={(v) => setDraft({ phone: v })}
        onStartEdit={onStartEdit}
        testId="contact-phone"
      />
      <ContactEditableRow
        icon={Briefcase}
        label="Role"
        value={draft.role}
        placeholder="Add role"
        editing={editing}
        onChange={(v) => setDraft({ role: v })}
        onStartEdit={onStartEdit}
        testId="contact-role"
      />
      <ContactEditableRow
        icon={Linkedin}
        label="LinkedIn"
        value={draft.linkedin}
        placeholder="Add LinkedIn"
        type="url"
        editing={editing}
        onChange={(v) => setDraft({ linkedin: v })}
        onStartEdit={onStartEdit}
        testId="contact-linkedin"
      />
      <ContactEditableRow
        icon={Globe}
        label="Website"
        value={draft.website}
        placeholder="Add website"
        type="url"
        editing={editing}
        onChange={(v) => setDraft({ website: v })}
        onStartEdit={onStartEdit}
        testId="contact-website"
      />
      <ContactEditableRow
        icon={MapPin}
        label="Location"
        value={draft.location}
        placeholder="Add location"
        editing={editing}
        onChange={(v) => setDraft({ location: v })}
        onStartEdit={onStartEdit}
        testId="contact-location"
      />
      <ContactEditableRow
        icon={StickyNote}
        label="Notes"
        value={draft.notes}
        placeholder="Add a note"
        italic
        editing={editing}
        onChange={(v) => setDraft({ notes: v })}
        onStartEdit={onStartEdit}
        testId="contact-notes"
      />
    </div>
  );
}

// ─── Header (FIXED 264px) ───────────────────────────────────────────────
// Locked layout. The three rows have hard-coded heights and the entire
// header is shrink-0 with `style={{ height: 264 }}`. NO conditional
// rendering may change the header height — both action slots reserve
// 40×40 box even when empty.
// v30.34 — Glass-pill segmented control voor Overview/Contact tabs.
// Echte Vadik liquid-glass recipe: track met inset rim shadows + indicator
// met dezelfde glass-surface (background + backdrop-filter blur) als de
// VadikLiquidSwitcher die in de left-rail staat. Indicator schuift
// vloeiend met Apple-spring tussen de twee posities.
function SegmentedGlassPill({
  tab,
  onChange,
}: {
  tab: 'overview' | 'contact';
  onChange: (t: 'overview' | 'contact') => void;
}) {
  const filterId = useId();
  const useFallback = lacksBackdropSVGFilter();
  const PAD = 4;
  const TRACK_H = 40;
  // s helper voor Vadik shadow stack — hier op schaal 0.55 zodat de
  // shadows passen bij een compactere 40px hoogte (origineel is 70px).
  const s = (v: number) => v * 0.55;

  return (
    <div className="px-6 flex items-end pb-0" style={{ height: 56 }}>
      {/* SVG displacement filter — same node Vadik gebruikt voor refractie. */}
      {!useFallback && (
        <svg width="0" height="0" style={{ position: 'absolute' }}>
          <defs>
            <filter id={filterId} colorInterpolationFilters="sRGB">
              <feImage
                href={VADIK_DISPLACEMENT_WEBP}
                result="map"
                preserveAspectRatio="none"
              />
              <feDisplacementMap
                in="SourceGraphic"
                in2="map"
                scale="50"
                xChannelSelector="R"
                yChannelSelector="G"
              />
            </filter>
          </defs>
        </svg>
      )}

      <div
        className="relative flex rounded-full w-full"
        role="tablist"
        style={{
          padding: PAD,
          height: TRACK_H,
          background: 'rgba(0, 0, 0, 0.03)',
          boxShadow: vadikInsetRimShadows(s).join(', '),
        }}
      >
        {/* Vadik glass indicator — motion-driven x position. */}
        <motion.div
          aria-hidden
          initial={false}
          animate={{ x: tab === 'overview' ? '0%' : '100%' }}
          transition={APPLE_SPRING}
          className="absolute rounded-full pointer-events-none"
          style={{
            top: PAD,
            bottom: PAD,
            left: PAD,
            width: `calc(50% - ${PAD}px)`,
            // Vadik liquid-glass surface (with SVG displacement on supported
            // browsers, premium CSS fallback on iOS/Safari/Firefox).
            ...vadikGlassSurfaceStyle(filterId, useFallback, 4),
            // Inset rim shadows op de indicator zelf zodat hij "lift".
            boxShadow: vadikInsetRimShadows(s).join(', '),
          }}
        />
        {(['overview', 'contact'] as const).map((id) => {
          const active = tab === id;
          return (
            <button
              key={id}
              role="tab"
              aria-selected={active}
              onClick={() => onChange(id)}
              data-testid={`tab-${id}`}
              className={`relative z-10 flex-1 rounded-full text-[13px] font-medium transition-colors ${
                active ? 'text-foreground' : 'text-foreground/55'
              }`}
            >
              {id === 'overview' ? 'Overview' : 'Contact'}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StickyHeader({
  from,
  relationshipLabel,
  showRelationshipSparkle,
  tab,
  setTab,
  editing,
  setEditing,
  showClose,
  onClose,
  onSave,
  subtitle,
}: {
  from: { name: string; email: string; avatar?: string };
  subtitle?: string;
  relationshipLabel: string;
  showRelationshipSparkle: boolean;
  tab: 'overview' | 'contact';
  setTab: (t: 'overview' | 'contact') => void;
  editing: boolean;
  setEditing: (v: boolean) => void;
  showClose: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <div className="shrink-0" style={{ height: 280 }}>
      {/* Top action row — fixed 56px. Both slots always rendered. */}
      <div
        className="px-4 flex items-center justify-between gap-2"
        style={{ height: 56 }}
      >
        {/* Left slot */}
        {editing ? (
          <button
            onClick={() => setEditing(false)}
            data-testid="button-edit-cancel"
            className="lg-pill h-10 w-10 rounded-full flex items-center justify-center text-icon hover-elevate active-elevate-2"
            aria-label="Cancel edit"
          >
            <X size={19} strokeWidth={1.75} />
          </button>
        ) : showClose ? (
          <button
            onClick={onClose}
            data-testid="button-close-contact-panel"
            className="lg-pill h-10 w-10 rounded-full flex items-center justify-center text-icon hover-elevate active-elevate-2"
            aria-label="Close contact panel"
          >
            <X size={19} strokeWidth={1.75} />
          </button>
        ) : (
          <span aria-hidden className="block h-10 w-10 shrink-0" />
        )}

        {/* Right slot */}
        {editing ? (
          <button
            onClick={onSave}
            data-testid="button-edit-save"
            className="lg-pill h-10 w-10 rounded-full flex items-center justify-center text-icon hover-elevate active-elevate-2"
            aria-label="Save contact"
          >
            <Check size={19} strokeWidth={1.75} />
          </button>
        ) : tab === 'contact' ? (
          <button
            onClick={() => setEditing(true)}
            data-testid="button-edit-contact"
            className="lg-pill h-10 w-10 rounded-full flex items-center justify-center text-icon hover-elevate active-elevate-2"
            aria-label="Edit contact"
          >
            <Pencil size={19} strokeWidth={1.75} />
          </button>
        ) : (
          <span aria-hidden className="block h-10 w-10 shrink-0" />
        )}
      </div>

      {/* Identity block — fixed 168px. Avatar + name + email + pill,
          all centered vertically within the box so toggling content
          underneath does not move them by a single pixel. */}
      <div
        className="px-6 flex flex-col items-center justify-center text-center"
        style={{ height: 168 }}
      >
        <StiltAvatar name={from.name} size={80} />
        <h3
          className="mt-2 text-[22px] font-semibold tracking-[-0.015em] leading-tight"
          data-testid="contact-name"
        >
          {from.name}
        </h3>
        <p className="text-[13.5px] text-foreground/55 mt-0.5 leading-tight">
          {subtitle}
        </p>
        <span
          className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1 rounded-full bg-foreground/[0.04] dark:bg-white/[0.05] border border-foreground/[0.06] dark:border-white/[0.06] text-foreground/75"
          data-testid="contact-relationship-pill"
        >
          {showRelationshipSparkle && <Sparkle size={10} />}
          {relationshipLabel}
        </span>
      </div>

      {/* Segmented control — fixed 56px (40px control + 16px top padding).
         v30.34 — Echte Vadik liquid-glass indicator (zelfde recipe als de
         left-rail / inbox / calendar pill). Indicator gebruikt de
         vadikInsetRimShadows (8-laag inset stack) + Vadik glass surface
         met SVG displacement filter zodat hij echt refractie heeft. Skipt
         de Vadik switcher component zelf omdat die icons vereist; we doen
         het inline voor onze 2-tab label-only layout. */}
      <SegmentedGlassPill tab={tab} onChange={setTab} />
    </div>
  );
}

// ─── Panel body — header + scroll area ──────────────────────────────────
function PanelBody({
  mail,
  onClose,
  showClose,
}: {
  mail: Mail;
  onClose: () => void;
  showClose: boolean;
}) {
  const { from, contact } = mail;
  const { mails } = useStilt();
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<'overview' | 'contact'>('overview');
  const [editing, setEditing] = useState(false);
  const [draft, setDraftState] = useState<ContactDraft>(() => ({
    phone: contact?.phone || '',
    role: [contact?.title, contact?.company].filter(Boolean).join(' · '),
    linkedin: (contact?.linkedinUrl || '').replace(/^https?:\/\//, ''),
    website: (contact?.websiteUrl || '').replace(/^https?:\/\//, ''),
    location: contact?.location || '',
    notes: contact?.notes || '',
  }));
  const setDraft = (patch: Partial<ContactDraft>) =>
    setDraftState((d) => ({ ...d, ...patch }));

  const stats = useMemo(() => {
    const personMails = mails.filter((m) => m.from.email === from.email);
    const sortedByDate = [...personMails].sort(
      (a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime(),
    );
    const firstTs = sortedByDate[0]?.ts;
    const sinceLabel = firstTs ? sinceFirstLabel(firstTs) : '—';
    return {
      mailCount: personMails.length,
      since: sinceLabel,
      isFrequent: personMails.length >= 3,
      isFirst: personMails.length <= 1,
    };
  }, [mails, from.email]);

  const relationshipLabel = stats.isFirst
    ? 'New connection'
    : stats.isFrequent
      ? `Frequent · since ${stats.since}`
      : `Active · ${stats.mailCount} conversations`;
  const leadSubtitle = [mail.leadHeadline, mail.leadCompany]
    .filter(Boolean)
    .join(' · ');

  const handleSearchPerson = () => {
    window.dispatchEvent(
      new CustomEvent('stilt:open-search', { detail: { query: from.name } }),
    );
    onClose();
  };

  const handleSchedule = () => {
    navigate('/calendar');
    onClose();
  };

  const onSave = () => {
    console.log('save-contact', from.email, draft);
    setEditing(false);
  };

  // While editing we force the Contact tab to be visible so the user sees
  // the inputs they're editing. The tab toggle is still active in
  // non-editing state.
  const visibleTab: 'overview' | 'contact' = editing ? 'contact' : tab;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <StickyHeader
        from={from}
        subtitle={leadSubtitle}
        relationshipLabel={relationshipLabel}
        showRelationshipSparkle={!stats.isFirst}
        tab={visibleTab}
        setTab={(t) => {
          // Switching tabs cancels editing — preserves the locked layout.
          if (editing) setEditing(false);
          setTab(t);
        }}
        editing={editing}
        setEditing={setEditing}
        showClose={showClose}
        onClose={onClose}
        onSave={onSave}
      />

      {/* Scroll area — ONLY thing that scrolls. */}
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar pt-3">
        {visibleTab === 'overview' ? (
          <>
            <div className="px-6 pb-4">
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={handleSchedule}
                  data-testid="button-contact-schedule"
                  className="flex flex-col items-center gap-1 px-2 py-3 rounded-2xl bg-foreground/[0.04] dark:bg-white/[0.05] hover-elevate active-elevate-2"
                >
                  <CalendarIcon
                    size={16}
                    strokeWidth={1.8}
                    className="text-foreground/75"
                  />
                  <span className="text-[12px] font-medium text-foreground/85">Schedule</span>
                </button>
                <button
                  onClick={handleSearchPerson}
                  data-testid="button-contact-view-all"
                  className="flex flex-col items-center gap-1 px-2 py-3 rounded-2xl bg-foreground/[0.04] dark:bg-white/[0.05] hover-elevate active-elevate-2"
                >
                  <Search size={16} strokeWidth={1.8} className="text-foreground/75" />
                  <span className="text-[12px] font-medium text-foreground/85">
                    {stats.mailCount > 1 ? `View ${stats.mailCount} mails` : 'View mails'}
                  </span>
                </button>
                <button
                  onClick={() => console.log('quiet-contact', from.email)}
                  data-testid="button-contact-quiet"
                  className="flex flex-col items-center gap-1 px-2 py-3 rounded-2xl bg-foreground/[0.04] dark:bg-white/[0.05] hover-elevate active-elevate-2"
                >
                  <BellOff size={16} strokeWidth={1.8} className="text-foreground/75" />
                  <span className="text-[12px] font-medium text-foreground/85">Quiet</span>
                </button>
              </div>
            </div>

            <div className="px-2 pb-2 flex flex-col gap-4">
              <BetweenYouSection mail={mail} navigate={navigate} onClose={onClose} />
              <ThisWeekSection mail={mail} navigate={navigate} onClose={onClose} />
              <SharedLatelySection mail={mail} />
            </div>
          </>
        ) : (
          <ContactTab
            editing={editing}
            onStartEdit={() => setEditing(true)}
            draft={draft}
            setDraft={setDraft}
          />
        )}
        <div className="h-6 shrink-0" />
      </div>
    </div>
  );
}

// ─── Mobile bottom sheet ────────────────────────────────────────────────
// 92vh, flat bottom, rounded top, glass-strong. No drag — only slide-up
// via translateY in framer-motion variants. `overflow: hidden` lives on
// the sheet itself so children with overflow-y-auto can scroll.
function ContactSheetMobile({
  open,
  onClose,
  mail,
}: {
  open: boolean;
  onClose: () => void;
  mail: Mail;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(0,0,0,0.15)' }}
          />
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={APPLE_SPRING}
            data-testid="contact-info-sheet"
            className="fixed inset-x-0 bottom-0 z-50 glass-strong flex flex-col"
            style={{
              height: '92vh',
              borderRadius: '28px 28px 0 0',
              overflow: 'hidden',
            }}
          >
            {/* Decorative drag handle (non-interactive) */}
            <div className="mx-auto h-1 w-10 rounded-full bg-foreground/15 mt-2 mb-1 shrink-0" />
            <PanelBody mail={mail} onClose={onClose} showClose={true} />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Desktop slide panel ────────────────────────────────────────────────
function ContactSlidePanel({
  open,
  onClose,
  mail,
  withBackdrop = true,
}: {
  open: boolean;
  onClose: () => void;
  mail: Mail;
  withBackdrop?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  // v30.34 — Click-outside via document mousedown listener (alternatief
  // voor backdrop). Behoudt scrollability van de mail content erachter.
  // Negeert klikken op de subject-pill identity-button (anders sluit het
  // panel meteen weer als je 'm probeert te openen).
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (panelRef.current?.contains(target)) return;
      if (target.closest('[data-testid="toolbar-identity"]')) return;
      onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {withBackdrop && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={onClose}
              data-testid="contact-info-panel-backdrop"
              className="fixed inset-0 z-40"
              style={{ background: 'rgba(0,0,0,0.08)' }}
            />
          )}
          <motion.div
            ref={panelRef}
            data-testid="contact-info-panel-slide"
            initial={{ x: '110%' }}
            animate={{ x: 0 }}
            exit={{ x: '110%' }}
            transition={APPLE_SPRING}
            className="fixed z-50 flex flex-col"
            style={{
              top: 16,
              bottom: 16,
              right: 16,
              width: 380,
              maxWidth: 'calc(100vw - 32px)',
              borderRadius: 28,
              overflow: 'hidden',
              background:
                'linear-gradient(180deg, color-mix(in srgb, var(--vadik-light, #fff) calc(var(--vadik-reflex-light, 1) * 55%), transparent) 0%, color-mix(in srgb, var(--vadik-light, #fff) calc(var(--vadik-reflex-light, 1) * 40%), transparent) 45%, color-mix(in srgb, var(--vadik-light, #fff) calc(var(--vadik-reflex-light, 1) * 30%), transparent) 78%, color-mix(in srgb, var(--vadik-light, #fff) calc(var(--vadik-reflex-light, 1) * 22%), transparent) 100%)',
              backdropFilter: 'blur(24px) saturate(150%)',
              WebkitBackdropFilter: 'blur(24px) saturate(150%)',
              boxShadow:
                'inset 0 0 0 1px color-mix(in srgb, var(--vadik-light, #fff) calc(var(--vadik-reflex-light, 1) * 50%), transparent), inset 1.8px 3px 0 -2px color-mix(in srgb, var(--vadik-light, #fff) calc(var(--vadik-reflex-light, 1) * 80%), transparent), inset -2px -2px 0 -2px color-mix(in srgb, var(--vadik-light, #fff) calc(var(--vadik-reflex-light, 1) * 60%), transparent), 0 1px 5px 0 color-mix(in srgb, var(--vadik-dark, #000) calc(var(--vadik-reflex-dark, 1) * 6%), transparent), 0 16px 40px 0 color-mix(in srgb, var(--vadik-dark, #000) calc(var(--vadik-reflex-dark, 1) * 14%), transparent)',
            }}
          >
            <PanelBody mail={mail} onClose={onClose} showClose={true} />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Public component ───────────────────────────────────────────────────
export function ContactInfoPanel() {
  const { mails, contactPanelOpen, setContactPanelOpen } = useStilt();
  const [loc] = useLocation();
  const mode = useViewportMode();

  // Legacy event listener — keep for back-compat with external dispatchers.
  useEffect(() => {
    const onOpen = () => setContactPanelOpen(true);
    window.addEventListener('stilt:open-contact-panel', onOpen);
    return () => window.removeEventListener('stilt:open-contact-panel', onOpen);
  }, [setContactPanelOpen]);

  const close = () => setContactPanelOpen(false);
  const mailId = loc.startsWith('/mail/') ? loc.replace('/mail/', '') : '';
  const mail = mails.find((m) => m.id === mailId);
  if (!mail) return null;

  if (mode === 'slide') {
    return (
      <ContactSlidePanel
        mail={mail}
        open={contactPanelOpen}
        onClose={close}
        withBackdrop={false}
      />
    );
  }

  return (
    <ContactSheetMobile
      open={contactPanelOpen}
      onClose={close}
      mail={mail}
    />
  );
}
