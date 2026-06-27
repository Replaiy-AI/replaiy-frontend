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

// Workspace members (seats). A campaign runs from one or more seats — each
// seat = a teammate with their own LinkedIn account (backend: members +
// linked_accounts). You assign which seats run a campaign.
export interface WorkspaceMember {
  id: string;
  name: string;
  role: string;
  avatar: string;
}

export const WORKSPACE_MEMBERS: WorkspaceMember[] = [
  { id: 'm1', name: 'Simon van Basten', role: 'Founder', avatar: 'https://i.pravatar.cc/120?img=68' },
  { id: 'm2', name: 'Lotte Visser', role: 'SDR', avatar: 'https://i.pravatar.cc/120?img=5' },
  { id: 'm3', name: 'Daan Bakker', role: 'SDR', avatar: 'https://i.pravatar.cc/120?img=13' },
  { id: 'm4', name: 'Nora Lindqvist', role: 'Account Exec', avatar: 'https://i.pravatar.cc/120?img=20' },
];

// Flow = the sequence of actions Replaiy runs per lead in a campaign. Read-only
// for now (the drag-and-drop builder is a later round). Backend: campaigns.flow
// jsonb. Step kinds map to LinkedIn actions.
export type FlowStepKind =
  | 'connect'
  | 'like'
  | 'comment'
  | 'message'
  | 'follow_up';

export interface FlowStep {
  kind: FlowStepKind;
  // Human delay before this step, e.g. "1d", "2d", "same day".
  delay?: string;
}

export const FLOW_STEP_META: Record<
  FlowStepKind,
  { label: string; hint: string }
> = {
  connect: { label: 'Connection request', hint: 'Send a personalized invite' },
  like: { label: 'Like a recent post', hint: 'Warm up before connecting' },
  comment: { label: 'Comment', hint: 'Leave a relevant comment' },
  message: { label: 'Message', hint: 'Open the conversation' },
  follow_up: { label: 'Follow-up', hint: 'Nudge if no reply' },
};

// A sensible default flow used by campaigns that don't define their own.
export const DEFAULT_FLOW: FlowStep[] = [
  { kind: 'like', delay: 'Day 1' },
  { kind: 'connect', delay: 'Day 2' },
  { kind: 'message', delay: 'On accept' },
  { kind: 'follow_up', delay: '+3 days' },
];

export interface Campaign {
  id: string;
  name: string;
  goalType: CampaignGoalType;
  goalLabel?: string; // required when goalType === 'custom'
  status: CampaignStatus;
  // Seats running this campaign (WorkspaceMember ids). At least one when live.
  memberIds: string[];
  // Action sequence per lead. Falls back to DEFAULT_FLOW if omitted.
  flow?: FlowStep[];
  // Full outbound funnel, aligned with the backend lead_state machine
  // (sourced -> connect_requested -> connected -> in_conversation -> replied
  // -> goal_achieved). The list shows only conversion% (derived); the detail
  // shows the whole trechter (Found -> Sent -> Accepted -> Messaged -> Replied
  // -> Goal) so you can see where it leaks.
  stats: {
    found: number; // leads sourced by the AI from your ICP (top of funnel)
    sent: number; // connection requests sent
    accepted: number; // requests accepted = leads
    messaged: number; // first DM sent after acceptance
    replied: number; // leads who replied at least once (reply rate)
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
    memberIds: ['m1', 'm2'],
    stats: {
      found: 680,
      sent: 420,
      accepted: 142,
      messaged: 138,
      replied: 61,
      goalAchieved: 11,
    },
    createdAt: '2026-06-02T09:00:00Z',
  },
  {
    id: 'c2',
    name: 'RevOps leaders — NL/BE',
    goalType: 'demo',
    status: 'active',
    memberIds: ['m3'],
    stats: {
      found: 410,
      sent: 260,
      accepted: 88,
      messaged: 84,
      replied: 34,
      goalAchieved: 6,
    },
    createdAt: '2026-06-10T09:00:00Z',
  },
  {
    id: 'c3',
    name: 'Newsletter signups — warm',
    goalType: 'reply',
    status: 'active',
    memberIds: ['m2', 'm4'],
    stats: {
      found: 820,
      sent: 540,
      accepted: 210,
      messaged: 205,
      replied: 132,
      goalAchieved: 58,
    },
    createdAt: '2026-05-21T09:00:00Z',
  },
  {
    id: 'c4',
    name: 'Agency partnerships',
    goalType: 'custom',
    goalLabel: 'Intro call with their head of partnerships',
    status: 'paused',
    memberIds: ['m1'],
    stats: {
      found: 180,
      sent: 110,
      accepted: 34,
      messaged: 31,
      replied: 12,
      goalAchieved: 2,
    },
    createdAt: '2026-06-15T09:00:00Z',
  },
  {
    id: 'c5',
    name: 'Inbound waitlist — qualify',
    goalType: 'qualified',
    status: 'draft',
    memberIds: [],
    stats: {
      found: 0,
      sent: 0,
      accepted: 0,
      messaged: 0,
      replied: 0,
      goalAchieved: 0,
    },
    createdAt: '2026-06-25T09:00:00Z',
  },
];
