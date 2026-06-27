// ─────────────────────────────────────────────────────────────────
// v15: single source of truth for nav items, now organised by
// CONTEXT (Mail / Calendar / Docs) so the new glass sidebar can swap
// the entire context-specific list when the user taps a tab segment.
//
// "Archive" is renamed "Done" universally. Internal route stays
// /archive (no need to break links); the label/icon are the bits
// that users see.
// ─────────────────────────────────────────────────────────────────
import {
  Inbox,
  Calendar as CalendarIcon,
  Target,
  FileText,
  CircleCheck,
  Ban,
  Clock,
  Send,
  FileEdit,
  Settings as SettingsIcon,
  CalendarDays,
  CalendarRange,
  Users as UsersIcon,
  Globe,
  FileClock,
  Pin,
  Share2,
  LayoutTemplate,
  Trash2,
  type LucideIcon,
} from 'lucide-react';

export type NavItem = {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  testId: string;
};

// Primary destinations — these appear in the mobile bottom nav AND
// the desktop sidebar TOP PILL (v15).
export const PRIMARY_NAV: NavItem[] = [
  { key: 'inbox',     label: 'Inbox',     href: '/',          icon: Inbox,        testId: 'nav-inbox' },
  { key: 'campaigns', label: 'Campaigns', href: '/campaigns', icon: Target,       testId: 'nav-campaigns' },
  { key: 'calendar',  label: 'Calendar',  href: '/calendar',  icon: CalendarIcon, testId: 'nav-calendar' },
];

// Mail-context nav list (sidebar when Mail tab active).
// Renamed Archive → Done. Trash removed (Done is the universal exit).
export const MAIL_NAV: NavItem[] = [
  { key: 'inbox',   label: 'Inbox',   href: '/',         icon: Inbox,       testId: 'nav-inbox' },
  { key: 'snoozed', label: 'Snoozed', href: '/snoozed',  icon: Clock,       testId: 'nav-snoozed' },
  { key: 'sent',    label: 'Sent',    href: '/sent',     icon: Send,        testId: 'nav-sent' },
  { key: 'done',    label: 'Done',    href: '/archive',  icon: CircleCheck, testId: 'nav-done' },
  { key: 'drafts',  label: 'Drafts',  href: '/drafts',   icon: FileEdit,    testId: 'nav-drafts' },
  { key: 'spam',    label: 'Spam',    href: '/spam',     icon: Ban,         testId: 'nav-spam' },
];

// Calendar-context nav list.
export const CAL_NAV: NavItem[] = [
  { key: 'today',     label: 'Today',        href: '/calendar',           icon: CalendarIcon,  testId: 'nav-cal-today' },
  { key: 'thisweek',  label: 'This week',    href: '/calendar?range=week',icon: CalendarRange, testId: 'nav-cal-week' },
  { key: 'mycals',    label: 'My calendars', href: '/calendar?mine=1',    icon: CalendarDays,  testId: 'nav-cal-mine' },
  { key: 'tz',        label: 'Time zones',   href: '/calendar?tz=1',      icon: Globe,         testId: 'nav-cal-tz' },
];

// Docs-context nav list.
export const DOCS_NAV: NavItem[] = [
  { key: 'recent',   label: 'Recent',         href: '/docs',          icon: FileClock,      testId: 'nav-docs-recent' },
  { key: 'pinned',   label: 'Pinned',         href: '/docs?pinned=1', icon: Pin,            testId: 'nav-docs-pinned' },
  { key: 'shared',   label: 'Shared with me', href: '/docs?shared=1', icon: Share2,         testId: 'nav-docs-shared' },
  { key: 'templates',label: 'Templates',      href: '/docs?templates=1', icon: LayoutTemplate, testId: 'nav-docs-templates' },
  { key: 'trash',    label: 'Trash',          href: '/docs?trash=1',  icon: Trash2,         testId: 'nav-docs-trash' },
];

// Legacy SECONDARY_NAV — kept for back-compat with anywhere that still
// imports it (mobile ••• menu, etc.). Maps to the new Mail-context list
// minus Inbox.
export const SECONDARY_NAV: NavItem[] = MAIL_NAV.slice(1);

// Settings is its own thing — always pinned at the top of the sidebar
// (v15: a small cog icon next to the Stilt brand) and the bottom of
// the ••• sheet (mobile).
export const SETTINGS_NAV: NavItem = {
  key: 'settings',
  label: 'Settings',
  href: '/settings',
  icon: SettingsIcon,
  testId: 'nav-settings',
};
