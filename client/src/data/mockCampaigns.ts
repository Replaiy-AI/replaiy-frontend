// Replaiy — Campaigns mock data.
//
// Mirrors the backend campaign model (migratie 0032): each campaign carries a
// conversion goal (goal_type + optional goal_label) that drives persona tone,
// the funnel endpoint, and the RL learning signal. The UI adds lightweight
// stats (leads / in conversation / goal achieved) so the screen feels real;
// those come from the funnel in production.

export type CampaignGoalType =
  | 'meeting'
  | 'qualified'
  | 'reply'
  | 'demo'
  | 'custom';

export type CampaignStatus = 'draft' | 'active' | 'paused' | 'archived';

export interface Campaign {
  id: string;
  name: string;
  goalType: CampaignGoalType;
  goalLabel?: string; // required when goalType === 'custom'
  status: CampaignStatus;
  // Lightweight funnel stats for the list view.
  stats: {
    leads: number; // total leads in this campaign
    inConversation: number; // active threads
    goalAchieved: number; // conversions (the configurable goal)
  };
  createdAt: string; // ISO
}

// Human-readable labels for each goal type (UI). The "achieved" phrasing is
// what "goal_achieved" means for that goal.
export const GOAL_META: Record<
  CampaignGoalType,
  { label: string; achieved: string; achievedShort: string; hint: string }
> = {
  meeting: {
    label: 'Meeting',
    achieved: 'Meetings booked',
    achievedShort: 'Booked',
    hint: 'Steer subtly toward a short call.',
  },
  qualified: {
    label: 'Qualified lead',
    achieved: 'Leads qualified',
    achievedShort: 'Qualified',
    hint: 'Qualify the lead — surface fit and intent.',
  },
  reply: {
    label: 'Reply',
    achieved: 'Replies',
    achievedShort: 'Replies',
    hint: 'Earn a genuine reply; keep the bar low.',
  },
  demo: {
    label: 'Demo',
    achieved: 'Demos requested',
    achievedShort: 'Demos',
    hint: 'Steer toward a demo or trial.',
  },
  custom: {
    label: 'Custom',
    achieved: 'Goal achieved',
    achievedShort: 'Achieved',
    hint: 'Your own defined outcome.',
  },
};

export const STATUS_META: Record<CampaignStatus, { label: string }> = {
  draft: { label: 'Draft' },
  active: { label: 'Active' },
  paused: { label: 'Paused' },
  archived: { label: 'Archived' },
};

export const MOCK_CAMPAIGNS: Campaign[] = [
  {
    id: 'c1',
    name: 'Q3 — Series-B founders',
    goalType: 'meeting',
    status: 'active',
    stats: { leads: 142, inConversation: 23, goalAchieved: 11 },
    createdAt: '2026-06-02T09:00:00Z',
  },
  {
    id: 'c2',
    name: 'RevOps leaders — NL/BE',
    goalType: 'demo',
    status: 'active',
    stats: { leads: 88, inConversation: 17, goalAchieved: 6 },
    createdAt: '2026-06-10T09:00:00Z',
  },
  {
    id: 'c3',
    name: 'Newsletter signups — warm',
    goalType: 'reply',
    status: 'active',
    stats: { leads: 210, inConversation: 41, goalAchieved: 58 },
    createdAt: '2026-05-21T09:00:00Z',
  },
  {
    id: 'c4',
    name: 'Agency partnerships',
    goalType: 'custom',
    goalLabel: 'Intro call with their head of partnerships',
    status: 'paused',
    stats: { leads: 34, inConversation: 5, goalAchieved: 2 },
    createdAt: '2026-06-15T09:00:00Z',
  },
  {
    id: 'c5',
    name: 'Inbound waitlist — qualify',
    goalType: 'qualified',
    status: 'draft',
    stats: { leads: 0, inConversation: 0, goalAchieved: 0 },
    createdAt: '2026-06-25T09:00:00Z',
  },
];
