// ─────────────────────────────────────────────────────────────────
// Single source of truth for nav items.
//
// Replaiy has three primary surfaces in the chrome switcher — Inbox
// (conversations), Campaigns, and Calendar. The old Replaiy Docs context
// and the working Calendar implementation have been removed; the Calendar
// tab now points to a "Coming soon" placeholder.
//
// "Archive" is surfaced as "Done" universally. Internal route stays
// /archive (no need to break links); the label/icon are the bits
// that users see.
// ─────────────────────────────────────────────────────────────────
import {
  Inbox,
  Target,
  Calendar as CalendarIcon,
  Brain,
  CircleCheck,
  Settings as SettingsIcon,
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
// the desktop sidebar TOP PILL.
// v-replaiy — 'Mijn AI' (4e tab): persona + knowledge (persoonlijk +
// workspace, rol-gated). De avatar blijft vrij voor later account-gebruik.
export const PRIMARY_NAV: NavItem[] = [
  { key: 'inbox',     label: 'Inbox',     href: '/',          icon: Inbox,        testId: 'nav-inbox' },
  { key: 'campaigns', label: 'Campaigns', href: '/campaigns', icon: Target,       testId: 'nav-campaigns' },
  { key: 'ai',        label: 'My AI',   href: '/ai',        icon: Brain,        testId: 'nav-ai' },
  { key: 'calendar',  label: 'Calendar',  href: '/calendar',  icon: CalendarIcon, testId: 'nav-calendar' },
];

// Conversation-context nav list (sidebar / ••• sheet when Inbox active).
// Replaiy keeps only Inbox + Done — the old email mailbox concepts
// (Snoozed / Sent / Drafts / Spam) are not LinkedIn-conversation states.
// Renamed in Phase 2: MAIL_NAV → CONVERSATION_NAV.
export const CONVERSATION_NAV: NavItem[] = [
  { key: 'inbox', label: 'Inbox', href: '/',        icon: Inbox,       testId: 'nav-inbox' },
  { key: 'done',  label: 'Done',  href: '/archive', icon: CircleCheck, testId: 'nav-done' },
];

// Legacy SECONDARY_NAV — kept for back-compat with anywhere that still
// imports it (mobile ••• menu, etc.). Maps to the conversation-context
// list minus Inbox (i.e. just Done).
export const SECONDARY_NAV: NavItem[] = CONVERSATION_NAV.slice(1);

// Settings is its own thing — pinned at the bottom of the ••• sheet
// (mobile) and opens the profile menu.
export const SETTINGS_NAV: NavItem = {
  key: 'settings',
  label: 'Settings',
  href: '/settings',
  icon: SettingsIcon,
  testId: 'nav-settings',
};
