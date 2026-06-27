// ─────────────────────────────────────────────────────────────────
// Route-aware ••• menu sheet.
//
// The ••• button in the persistent mobile top-chrome toggles a
// global `dotsMenuOpen` flag. THIS sheet renders the appropriate
// menu content based on the current route:
//
//   • Inbox (/, /briefing, /archive) → Mail menu
//       Archive · Spam · Trash · Drafts · Settings
//
//   • Calendar (/calendar*)          → Calendar menu
//       My Calendars (toggle Google / Microsoft / Apple / Personal)
//       Time zones · Default reminder · Settings
//
//   • Mail detail / Compose          → no menu (those routes register
//                                      their own leftSlot = back arrow,
//                                      so the ••• button is hidden).
//
// One global sheet, route-aware contents. Same `setSheetOpen` linkage
// as before so the bottom nav + FAB hide while the menu is up.
// ─────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation } from 'wouter';
import {
  X,
  Calendar as CalendarIcon,
  Globe,
  Bell,
  Settings as SettingsIcon,
  Check,
  ChevronLeft,
  FileText,
  Trash2,
  LayoutTemplate,
} from 'lucide-react';
import { useStilt } from '@/state/StiltContext';
import { APPLE_SPRING } from '@/lib/motion';
import { SECONDARY_NAV, SETTINGS_NAV } from '@/lib/nav';
import { accounts, type AccountId } from '@/data/mockEvents';

export function DotsMenuSheet() {
  const { dotsMenuOpen, setDotsMenuOpen, setSheetOpen, accountVisible, setAccountVisible } =
    useStilt();
  const [loc, navigate] = useLocation();
  const [sub, setSub] = useState<'root' | 'calendars'>('root');

  // Drive global sheetOpen so the bottom nav + FAB hide.
  useEffect(() => {
    setSheetOpen(dotsMenuOpen);
    if (!dotsMenuOpen) setSub('root');
    return () => setSheetOpen(false);
  }, [dotsMenuOpen, setSheetOpen]);

  // Route → menu kind. Mail-detail / compose / doc-detail register their
  // own leftSlot (back arrow), so the ••• button isn't rendered there
  // at all; we don't open a menu for those routes either as a safety net.
  const isCalendar = loc.startsWith('/calendar');
  const isDocsList = loc === '/docs';
  const isDocsDetail = /^\/docs\/(?!$)/.test(loc); // /docs/:id or /docs/new
  const isMailDetail = loc.startsWith('/mail/');
  const isCompose = loc.startsWith('/compose');
  if (isMailDetail || isCompose || isDocsDetail) {
    return null;
  }

  // ── INBOX menu items (preserved from v11) ────────────────────────
  const mailItems = [...SECONDARY_NAV, SETTINGS_NAV].map((n) => ({
    label: n.label,
    icon: n.icon,
    href: n.href,
    testId: `menu-item-${n.key}`,
  }));

  // ── CALENDAR menu actions ────────────────────────────────────────
  type CalendarAction =
    | { kind: 'sub'; label: string; icon: typeof CalendarIcon; sub: 'calendars'; testId: string }
    | { kind: 'nav'; label: string; icon: typeof CalendarIcon; href: string; testId: string }
    | { kind: 'noop'; label: string; icon: typeof CalendarIcon; testId: string };

  const calendarItems: CalendarAction[] = [
    { kind: 'sub', label: 'My Calendars', icon: CalendarIcon, sub: 'calendars', testId: 'menu-item-mycalendars' },
    { kind: 'noop', label: 'Time zones', icon: Globe, testId: 'menu-item-timezones' },
    { kind: 'noop', label: 'Default reminder', icon: Bell, testId: 'menu-item-default-reminder' },
    { kind: 'nav', label: 'Settings', icon: SettingsIcon, href: '/settings', testId: 'menu-item-settings' },
  ];

  // ── DOCS menu actions (v14) ────────────────────────────────
  type DocsAction =
    | { kind: 'nav'; label: string; icon: typeof FileText; href: string; testId: string }
    | { kind: 'noop'; label: string; icon: typeof FileText; testId: string };
  const docsItems: DocsAction[] = [
    { kind: 'nav', label: 'All docs', icon: FileText, href: '/docs', testId: 'menu-item-alldocs' },
    { kind: 'noop', label: 'Trash', icon: Trash2, testId: 'menu-item-docs-trash' },
    { kind: 'noop', label: 'Templates', icon: LayoutTemplate, testId: 'menu-item-docs-templates' },
    { kind: 'nav', label: 'Settings', icon: SettingsIcon, href: '/settings', testId: 'menu-item-docs-settings' },
  ];

  const close = () => setDotsMenuOpen(false);
  const goNav = (href: string) => {
    close();
    navigate(href);
  };

  return (
    <AnimatePresence>
      {dotsMenuOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
            className="fixed inset-0 z-40 bg-black/35 backdrop-blur-[2px]"
            data-testid="dots-menu-overlay"
          />
          <motion.div
            data-testid="dots-menu-sheet"
            initial={{ y: -10, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -10, opacity: 0, scale: 0.96 }}
            transition={APPLE_SPRING}
            style={{ transformOrigin: 'top left' }}
            className="fixed left-3 top-16 z-50 w-[260px] glass-strong rounded-3xl p-2 shadow-2xl"
          >
            {isDocsList ? (
              <>
                <SheetHeader label="Docs" onClose={close} />
                <div className="flex flex-col gap-0.5" data-testid="dots-menu-docs">
                  {docsItems.map((it) => {
                    const I = it.icon;
                    const onClick = () => {
                      if (it.kind === 'nav') goNav(it.href);
                      else close();
                    };
                    return (
                      <button
                        key={it.label}
                        data-testid={it.testId}
                        onClick={onClick}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-2xl text-[14px] font-medium text-foreground hover-elevate active-elevate-2 text-left"
                      >
                        <I size={17} strokeWidth={1.6} className="text-foreground/75 shrink-0" />
                        <span>{it.label}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : isCalendar ? (
              sub === 'calendars' ? (
                <CalendarsSubmenu
                  back={() => setSub('root')}
                  close={close}
                  accountVisible={accountVisible}
                  setAccountVisible={setAccountVisible}
                />
              ) : (
                <>
                  <SheetHeader label="Calendar" onClose={close} />
                  <div className="flex flex-col gap-0.5" data-testid="dots-menu-calendar">
                    {calendarItems.map((it) => {
                      const I = it.icon;
                      const onClick = () => {
                        if (it.kind === 'sub') setSub(it.sub);
                        else if (it.kind === 'nav') goNav(it.href);
                        else close();
                      };
                      return (
                        <button
                          key={it.label}
                          data-testid={it.testId}
                          onClick={onClick}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-2xl text-[14px] font-medium text-foreground hover-elevate active-elevate-2 text-left"
                        >
                          <I size={17} strokeWidth={1.6} className="text-foreground/75 shrink-0" />
                          <span className="flex-1">{it.label}</span>
                          {it.kind === 'sub' && (
                            <span className="text-foreground/35 text-[13px]">›</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </>
              )
            ) : (
              <>
                <SheetHeader label="Mail" onClose={close} />
                <div className="flex flex-col gap-0.5" data-testid="dots-menu-mail">
                  {mailItems.map((it) => {
                    const I = it.icon;
                    return (
                      <button
                        key={it.label}
                        data-testid={it.testId}
                        onClick={() => goNav(it.href)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-2xl text-[14px] font-medium text-foreground hover-elevate active-elevate-2 text-left"
                      >
                        <I size={17} strokeWidth={1.6} className="text-foreground/75 shrink-0" />
                        <span>{it.label}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function SheetHeader({ label, onClose }: { label: string; onClose: () => void }) {
  return (
    <div className="px-3 pt-1.5 pb-2 flex items-center justify-between">
      <span className="text-[11.5px] uppercase tracking-wider font-semibold text-foreground/55">
        {label}
      </span>
      <button
        onClick={onClose}
        aria-label="Close menu"
        className="h-6 w-6 rounded-full flex items-center justify-center text-icon hover-elevate active-elevate-2"
      >
        <X size={14} strokeWidth={1.8} />
      </button>
    </div>
  );
}

function CalendarsSubmenu({
  back,
  close,
  accountVisible,
  setAccountVisible,
}: {
  back: () => void;
  close: () => void;
  accountVisible: Record<AccountId, boolean>;
  setAccountVisible: (id: AccountId, visible: boolean) => void;
}) {
  return (
    <>
      <div className="px-2 pt-1.5 pb-2 flex items-center justify-between">
        <button
          onClick={back}
          aria-label="Back"
          className="h-7 px-2 rounded-full flex items-center gap-1 text-[12px] font-medium text-foreground/65 hover-elevate active-elevate-2"
          data-testid="menu-back"
        >
          <ChevronLeft size={14} strokeWidth={1.8} />
          Back
        </button>
        <span className="text-[11.5px] uppercase tracking-wider font-semibold text-foreground/55">
          My Calendars
        </span>
        <button
          onClick={close}
          aria-label="Close menu"
          className="h-6 w-6 rounded-full flex items-center justify-center text-icon hover-elevate active-elevate-2"
        >
          <X size={14} strokeWidth={1.8} />
        </button>
      </div>
      <div className="flex flex-col gap-0.5" data-testid="dots-menu-calendars-sub">
        {accounts.map((a) => {
          const visible = accountVisible[a.id];
          return (
            <button
              key={a.id}
              data-testid={`toggle-cal-${a.id}`}
              onClick={() => setAccountVisible(a.id, !visible)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-2xl text-[14px] font-medium text-foreground hover-elevate active-elevate-2 text-left"
            >
              <span
                className="h-3 w-3 rounded-full shrink-0"
                style={{ background: a.color }}
              />
              <span className="flex-1">
                <span className="block">{a.provider}</span>
                <span className="block text-[11.5px] text-foreground/55 truncate">
                  {a.email}
                </span>
              </span>
              <span
                className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 ${
                  visible
                    ? 'bg-foreground text-background'
                    : 'bg-foreground/[0.08] text-transparent'
                }`}
              >
                <Check size={12} strokeWidth={2.4} />
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}
