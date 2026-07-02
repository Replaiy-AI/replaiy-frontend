// Replaiy - Campaigns mock data.
//
// Mirrors the backend campaign model (migratie 0032): each campaign carries a
// conversion goal (goal_type + optional goal_label) that drives persona tone,
// the funnel endpoint, and the RL learning signal. The UI adds lightweight
// stats (leads / in conversation / goal achieved) so the screen feels real;
// those come from the funnel in production.

import type { LanguageCode } from './mockPersona';

export type CampaignGoalType =
  | 'meeting'
  | 'qualified'
  | 'reply'
  | 'demo'
  | 'custom';

export type CampaignStatus = 'draft' | 'active' | 'paused' | 'archived';

// ── Audience model ───────────────────────────────────────────────────
// An ICP definition + lead discovery scoped to THIS campaign. Each campaign
// can target a different audience. Leads come from five discovery sources,
// ordered cold -> warmest, plus a per-campaign match threshold and
// auto-suppress (exclusion) intelligence. The pool breakdown and score
// buckets make audience QUALITY visible, not just quantity.
export type LeadSourceKind = 'connection' | 'engagement' | 'signal' | 'network' | 'salesnav' | 'import';
export type LeadWarmth = 'cold' | 'warm' | 'warmest';

// The profile we match leads against. This IS the free-form `criteria` jsonb
// payload the backend persists on `icp_profiles` — there is no rigid backend
// schema, so this shape defines it. Every field maps 1:1 to a single Unipile
// `api=sales_navigator, category=people` search parameter, so the later API
// layer serializes it directly (see icp_filter_research.md):
//   titles         -> role.include
//   excludedTitles -> role.exclude
//   seniority      -> seniority.include (SENIORITY_OPTIONS)
//   functions      -> function.include (FUNCTION_OPTIONS)
//   companySize    -> company_headcount (COMPANY_SIZE_OPTIONS)
//   industries     -> industry.include
//   locations      -> location.include (person geography)
//   hqLocations    -> company_location.include (company HQ)
//   companyType    -> company_type (COMPANY_TYPE_OPTIONS)
//   yearsInRole    -> tenure_at_role (YEARS_OPTIONS)
//   keywords       -> keywords
//   exclusions     -> generic suppression (Replaiy-side)
//   signals        -> changed_jobs / posted_on_linkedin / mentionned_in_news
export interface IcpCriteria {
  titles: string[]; // free chips, fuzzy (role.include)
  excludedTitles: string[]; // free chips (role.exclude)
  seniority: string[]; // fixed enum (SENIORITY_OPTIONS)
  functions: string[]; // fixed enum (FUNCTION_OPTIONS)
  companySize: string[]; // fixed ranges (COMPANY_SIZE_OPTIONS)
  industries: string[]; // searchable chips
  locations: string[]; // person geography chips
  hqLocations: string[]; // company HQ chips
  companyType: string[]; // fixed enum (COMPANY_TYPE_OPTIONS)
  yearsInRole: string; // single bucket (YEARS_OPTIONS) or ''
  keywords: string[]; // free chips
  exclusions: string[]; // generic exclusions
  signals: {
    changedJobs: boolean; // changed_jobs (last 90 days)
    activeOnLinkedin: boolean; // posted_on_linkedin (recently)
    mentionedInNews: boolean; // mentionned_in_news (recently)
  };
}

// Fixed option sets for the ICP editor. Values are the exact UI labels; the
// API layer maps each to its Unipile enum. Keep these stable — they define the
// multi-select chip groups (and the single-select years bucket).
export const SENIORITY_OPTIONS = [
  'Owner / Partner',
  'C-Suite',
  'Vice President',
  'Director',
  'Experienced Manager',
  'Entry Manager',
  'Senior',
  'Strategic',
  'Entry',
  'In Training',
];

export const FUNCTION_OPTIONS = [
  'Accounting',
  'Administrative',
  'Arts and Design',
  'Business Development',
  'Community and Social Services',
  'Consulting',
  'Customer Success and Support',
  'Education',
  'Engineering',
  'Entrepreneurship',
  'Finance',
  'Healthcare Services',
  'Human Resources',
  'Information Technology',
  'Legal',
  'Marketing',
  'Media and Communication',
  'Military and Protective Services',
  'Operations',
  'Product Management',
  'Program and Project Management',
  'Purchasing',
  'Quality Assurance',
  'Real Estate',
  'Research',
  'Sales',
];

export const COMPANY_SIZE_OPTIONS = [
  '1-10',
  '11-50',
  '51-200',
  '201-500',
  '501-1000',
  '1001-5000',
  '5001-10000',
  '10000+',
];

export const COMPANY_TYPE_OPTIONS = [
  'Public',
  'Privately held',
  'Non-profit',
  'Educational',
  'Partnership',
  'Self-employed',
  'Government',
];

export const YEARS_OPTIONS = [
  'Under 1 year',
  '1 to 2 years',
  '3 to 5 years',
  '6 to 10 years',
  'Over 10 years',
];

// One discovery source. `found` is the live count it currently contributes
// to the pool; `enabled` is whether the campaign uses it.
export interface LeadSource {
  kind: LeadSourceKind;
  enabled: boolean;
  found: number;
}

export interface CampaignAudience {
  icp: IcpCriteria;
  // The 4 sources (salesnav / signal / engagement / import).
  sources: LeadSource[];
  // 0-100: only contact leads at or above this match score. Source broad,
  // contact the best.
  matchThreshold: number;
  // Auto-suppress toggles (exclusion intelligence) - avoid double or awkward
  // outreach across the team.
  suppress: {
    inOtherCampaigns: boolean;
    alreadyContacted: boolean;
    existingConnections: boolean;
    // Softer than "in another campaign": if a teammate is in an ACTIVE
    // conversation with a lead, others may still connect / like / view, but
    // will not start a competing conversation.
    inActiveConversation: boolean;
  };
  // Live audience pool, split by warmth (warmest first in the UI).
  pool: { cold: number; warm: number; warmest: number };
  // Simple match-score distribution for a tiny histogram.
  scoreBuckets: { range: string; count: number }[];
  // A few representative enriched leads, shown in the "View leads" preview.
  // Real leads come from the backend later; this makes the preview feel real.
  sampleLeads?: SampleLead[];
}

// One representative enriched lead for the "View leads" preview. The insight is
// the kind of thing enrichment surfaces (recent activity, a buying signal),
// never a provider name.
export interface SampleLead {
  name: string;
  title: string;
  company: string;
  warmth: LeadWarmth;
  matchScore: number;
  insight: string;
  avatar: string;
  // true while background enrichment is still running for this lead; undefined/false = fully enriched
  enriching?: boolean;
  // set on leads that came from a specific import batch, so undo can remove exactly that batch's leads
  batchId?: string;
}

// Label + hint + warmth per discovery source. Warmth drives the UI order
// (warmest first) and the source priority story (contact warmest first).
export const LEAD_SOURCE_META: Record<
  LeadSourceKind,
  { label: string; hint: string; warmth: LeadWarmth }
> = {
  connection: {
    label: 'Warm through your team',
    hint: 'The warmest way in: someone on your team already knows them.',
    warmth: 'warmest',
  },
  engagement: {
    label: 'Active around your topics',
    hint: 'Reaches the people already talking about what you sell.',
    warmth: 'warmest',
  },
  signal: {
    label: 'Showing buying signals',
    hint: "Catches prospects right when they're ready to move.",
    warmth: 'warm',
  },
  network: {
    label: 'In your network',
    hint: 'Warm leads hiding in the connections you already have.',
    warmth: 'warm',
  },
  salesnav: {
    label: 'Matched to your ICP',
    hint: 'A steady stream of fresh prospects that fit.',
    warmth: 'cold',
  },
  import: {
    label: 'Manual import',
    hint: 'Upload a CSV of leads',
    warmth: 'cold',
  },
};

// Warmth label + a subtle tint. Blue stays the only strong accent; warmth is
// carried by label + opacity rather than a rainbow of colours. `tint` is an
// opacity applied to the single accent for the pool dots.
export const WARMTH_META: Record<LeadWarmth, { label: string; tint: number }> = {
  warmest: { label: 'warmest', tint: 1 },
  warm: { label: 'warm', tint: 0.55 },
  cold: { label: 'cold', tint: 0.24 },
};

// Workspace members (seats). A campaign runs from one or more seats - each
// seat = a teammate with their own LinkedIn account (backend: members +
// linked_accounts). You assign which seats run a campaign.
export interface WorkspaceMember {
  id: string;
  name: string;
  role: string;
  avatar: string;
  // The persona this teammate runs their outreach with. This is the visible
  // user -> persona link: each seat brings their own tone, the campaign does
  // not pick one. Maps to a PersonaPreset name (see mockPersona).
  personaName?: string;
}

export const WORKSPACE_MEMBERS: WorkspaceMember[] = [
  { id: 'm1', name: 'Simon van Basten', role: 'Founder', avatar: 'https://i.pravatar.cc/120?img=68', personaName: 'Warm & Personal' },
  { id: 'm2', name: 'Lotte Visser', role: 'SDR', avatar: 'https://i.pravatar.cc/120?img=5', personaName: 'Consultative' },
  { id: 'm3', name: 'Daan Bakker', role: 'SDR', avatar: 'https://i.pravatar.cc/120?img=13', personaName: 'Sharp Closer' },
  { id: 'm4', name: 'Nora Lindqvist', role: 'Account Exec', avatar: 'https://i.pravatar.cc/120?img=20', personaName: 'Patient Nurturer' },
];

// Flow = the sequence of actions Replaiy runs per lead in a campaign. Read-only
// for now (the drag-and-drop builder is a later round). Backend: campaigns.flow
// jsonb. Step kinds map to LinkedIn actions.
// Full Unipile v2 action set Replaiy models. The seeded DEFAULT_FLOW uses a
// safe subset; the rest stay in the type + meta so they can be referenced
// (e.g. `comment` is still used by LeadContextPanel, `follow` is a selectable
// but not-seeded step with a before-invite-only rule noted in FlowCard).
export type FlowStepKind =
  | 'visit'
  | 'follow'
  | 'like'
  | 'connect'
  | 'message'
  | 'follow_up'
  | 'breakup'
  | 'withdraw'
  | 'inmail'
  | 'comment';

// Structured, backend-schedulable delay. Replaces the old free-text timing.
export type FlowDelayUnit = 'minute' | 'hour' | 'day' | 'week';
export interface FlowDelay {
  value: number;
  unit: FlowDelayUnit;
}

// Render a structured delay as human text for display. `{value:0}` shows
// "Right away"; otherwise "{value} {unit(+s)}" (e.g. "5 minutes", "1 day").
export function formatDelay(d: FlowDelay): string {
  if (d.value === 0) return 'Right away';
  const unit =
    d.value === 1
      ? { minute: 'minute', hour: 'hour', day: 'day', week: 'week' }[d.unit]
      : { minute: 'minutes', hour: 'hours', day: 'days', week: 'weeks' }[d.unit];
  return `${d.value} ${unit}`;
}

export interface FlowStep {
  kind: FlowStepKind;
  // Delay to wait BEFORE running this step, measured from the previous step
  // completing (or, for gated steps, from the gate condition being met - e.g.
  // message runs `delay` after the invite is accepted). This is a real
  // value+unit so the backend can schedule it; it is NOT the condition itself
  // (the condition is FLOW_STEP_META[kind].gate).
  delay: FlowDelay;
  // Editable message copy for steps that SEND text (connect opener, message,
  // follow_up, breakup, inmail). The opener (connect) only uses this when
  // Sending -> Opening message is "fixed"; in "ai" mode Replaiy personalizes it
  // per lead. Steps that do not send text (visit / follow / like / withdraw)
  // ignore this. Optional so the data extends cleanly when full
  // add/remove/reorder lands later.
  text?: string;
  // NEW: whether this step can be toggled off by the user (warmup + fallback
  // steps). Core steps (connect, message) are NOT optional.
  optional?: boolean;
  // NEW: for optional steps, whether it is currently on. Defaults to true when
  // present. Core steps ignore this (they are always on).
  enabled?: boolean;
  // NEW: step requires a Premium / Sales Navigator account (inmail). The UI
  // marks it with a muted "Premium" chip and it ships off by default.
  premium?: boolean;
}

// Which flow-step kinds actually SEND text the user can edit. `visit`,
// `follow`, `like` and `withdraw` do not. `connect` carries the opener (its
// editability is governed by the Sending -> Opening message choice).
// `message` / `follow_up` / `breakup` / `inmail` are always editable.
export const FLOW_KINDS_WITH_TEXT: FlowStepKind[] = [
  'connect',
  'message',
  'follow_up',
  'breakup',
  'inmail',
];

// Per-kind label + hint (each ends with a period) + `gate` condition string
// shown as a quiet chip on the step so it's clear WHEN it runs. Gate "Always"
// means the step is unconditional; the UI renders no chip for those.
export const FLOW_STEP_META: Record<
  FlowStepKind,
  { label: string; hint: string; gate: string }
> = {
  visit: {
    label: 'Visit profile',
    hint: 'Warms up the lead before you reach out.',
    gate: 'Always',
  },
  follow: {
    label: 'Follow',
    hint: 'Follow before connecting, never after.',
    gate: 'Always',
  },
  like: {
    label: 'Like a recent post',
    hint: 'Reacts to a recent post, skipped if there is none.',
    gate: 'If they posted recently',
  },
  connect: {
    label: 'Connection request',
    hint: 'Send the invite that starts the relationship.',
    gate: 'If not connected yet',
  },
  message: {
    label: 'First message',
    hint: 'Open the conversation once they accept.',
    gate: 'After invite accepted',
  },
  follow_up: {
    label: 'Follow-up',
    hint: 'A new angle, not just a reminder.',
    gate: 'If no reply after the delay',
  },
  breakup: {
    label: 'Last message',
    hint: 'A final, low-pressure note that leaves the door open.',
    gate: 'If still no reply',
  },
  withdraw: {
    label: 'Withdraw invite',
    hint: 'Cleans up invites that were never accepted.',
    gate: 'If invite still pending',
  },
  inmail: {
    label: 'InMail',
    hint: 'Reach non-connections directly. Requires a premium account.',
    gate: 'If invite not accepted',
  },
  comment: {
    label: 'Comment',
    hint: 'Leaves a relevant comment on a recent post.',
    gate: 'If they posted recently',
  },
};

// A sensible default flow used by campaigns that don't define their own.
// Seeds a structured `delay` (value + unit) + `text` so the Flow editor has a
// place to live. The connect opener text is only used when Sending opener mode
// is "fixed"; otherwise Replaiy personalizes it per lead.
//
// The default sequence, matching what Unipile v2 can actually do: like and
// visit warm up the lead within minutes on day one, connect follows shortly
// after, the first message lands a day after the invite is accepted, then two
// fallbacks (follow_up, breakup) space out over days, and withdraw cleans up
// stale invites two weeks later. Optional steps carry `enabled`; warmup + the
// two fallbacks ship on, withdraw ships off. Core steps (connect, message) are
// not optional. `follow` and `inmail` are intentionally NOT seeded (follow has
// a before-invite-only rule; inmail needs a premium account), but both stay in
// the type + meta so they can be referenced later. InMail was removed from the
// default flow this round.
export const DEFAULT_FLOW: FlowStep[] = [
  { kind: 'like', delay: { value: 0, unit: 'minute' }, optional: true, enabled: true },
  { kind: 'visit', delay: { value: 2, unit: 'minute' }, optional: true, enabled: true },
  {
    kind: 'connect',
    delay: { value: 5, unit: 'minute' },
    text: 'Hi {{firstName}}, really enjoyed your recent post on {{topic}}. Would love to connect.',
  },
  {
    kind: 'message',
    delay: { value: 1, unit: 'day' },
    text: "Thanks for connecting, {{firstName}}. I help teams at companies like {{company}} reply faster on LinkedIn without losing the personal touch. Open to a quick look?",
  },
  {
    kind: 'follow_up',
    delay: { value: 3, unit: 'day' },
    text: 'Just floating this back up, {{firstName}}. Happy to share a short example tailored to {{company}} whenever the timing works.',
    optional: true,
    enabled: true,
  },
  {
    kind: 'breakup',
    delay: { value: 5, unit: 'day' },
    text: "I'll leave it here for now, {{firstName}}. If reaching more people faster ever moves up your list, the door stays open.",
    optional: true,
    enabled: true,
  },
  {
    kind: 'withdraw',
    delay: { value: 2, unit: 'week' },
    optional: true,
    enabled: false,
  },
];

export interface Campaign {
  id: string;
  name: string;
  goalType: CampaignGoalType;
  goalLabel?: string; // required when goalType === 'custom'
  // Short, human goal description shown as the row subtitle (one line, under
  // the campaign name). In production this is AI/user-authored per campaign.
  goalDescription?: string;
  status: CampaignStatus;
  // Seats running this campaign (WorkspaceMember ids). At least one when live.
  memberIds: string[];
  // Action sequence per lead. Falls back to DEFAULT_FLOW if omitted.
  flow?: FlowStep[];
  // Who this campaign reaches: ICP + lead discovery + match quality.
  audience?: CampaignAudience;
  // Outreach language. Default: match each lead's language automatically. When
  // fixed, it runs only on seats who speak that language (ties to Persona
  // "Languages you speak"). Defaults to auto when omitted.
  language?: { mode: 'auto' | 'fixed'; fixed?: LanguageCode };
  // Send timing for AUTOMATED actions only. Manual approvals always send when
  // the user approves. Representational this round (no real scheduling).
  timing?: { enabled: boolean; window: string };
  // How the FIRST message is written. 'ai' (default) = Replaiy personalizes
  // each opener per lead; 'fixed' = one opener used for everyone (fixedText),
  // which may carry simple {{firstName}} / {{company}} placeholders. Visual
  // this round; no real templating engine.
  opener?: { mode: 'ai' | 'fixed'; fixedText?: string };
  // How AI conversation replies are handled. 'review' (default) = every reply
  // waits for approval in the inbox; 'autopilot' = Replaiy sends replies
  // automatically and automatically holds back low-confidence ones for inbox
  // approval (the hold-back is built in, not a separate toggle).
  replyMode?: 'review' | 'autopilot';
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
  // Mock only: replies currently waiting for the user's approval in the inbox.
  // The real model has no campaign-scoped inbox count; this lets the Overview
  // AI read fold in a natural action clause ("6 replies are waiting for your
  // approval in the inbox."). Omitted -> the clause is skipped gracefully.
  repliesWaiting?: number;
  // Optional ~8-week weekly history per KPI, for the Overview sparklines +
  // trend badges. Each array is oldest -> newest; the LAST value matches the
  // current derived KPI value so the sparkline ends where the big number is.
  // Mock only; the real model has no time-series. KPI cards must render
  // gracefully (no sparkline / no badge) when this is absent.
  history?: {
    connectionRequests: number[]; // cumulative sent count per week
    acceptRate: number[]; // % per week
    replyRate: number[]; // % per week
    goalAchieved: number[]; // % per week
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
    hint: 'Qualify the lead, surface fit and intent.',
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
    name: 'Q3, Series-B founders',
    goalType: 'meeting',
    goalDescription: 'Book a 20-min intro call about reply quality',
    status: 'active',
    memberIds: ['m1', 'm2'],
    audience: {
      icp: {
        titles: ['Founder', 'CEO', 'VP Sales'],
        excludedTitles: ['Interim', 'Advisor'],
        seniority: ['Owner / Partner', 'C-Suite', 'Vice President'],
        functions: ['Entrepreneurship', 'Sales'],
        companySize: ['11-50', '51-200'],
        industries: ['Software Development', 'Financial Services'],
        locations: ['Netherlands', 'Germany'],
        hqLocations: [],
        companyType: ['Privately held'],
        yearsInRole: '1 to 2 years',
        keywords: ['Series B', 'outbound'],
        exclusions: ['Current customers', 'Competitors'],
        signals: { changedJobs: true, activeOnLinkedin: true, mentionedInNews: false },
      },
      sources: [
        { kind: 'engagement', enabled: true, found: 80 },
        { kind: 'signal', enabled: true, found: 180 },
        { kind: 'salesnav', enabled: true, found: 420 },
        { kind: 'import', enabled: false, found: 0 },
      ],
      matchThreshold: 80,
      suppress: {
        inOtherCampaigns: true,
        alreadyContacted: true,
        existingConnections: false,
        inActiveConversation: true,
      },
      pool: { cold: 420, warm: 180, warmest: 80 },
      scoreBuckets: [
        { range: '90-100', count: 120 },
        { range: '80-89', count: 240 },
        { range: '70-79', count: 180 },
        { range: '60-69', count: 90 },
        { range: '0-59', count: 50 },
      ],
      sampleLeads: [
        {
          name: 'Emma Chen',
          title: 'VP Sales',
          company: 'Northwind SaaS',
          warmth: 'warmest',
          matchScore: 94,
          insight: 'Posted about reply quality on outbound last week',
          avatar: 'https://i.pravatar.cc/120?img=47',
        },
        {
          name: 'Tomas Vega',
          title: 'Founder & CEO',
          company: 'Loopr',
          warmth: 'warm',
          matchScore: 91,
          insight: 'Company just closed a Series B round',
          avatar: 'https://i.pravatar.cc/120?img=12',
        },
        {
          name: 'Hannah Weber',
          title: 'Co-founder',
          company: 'Klar Fintech',
          warmth: 'warm',
          matchScore: 88,
          insight: 'Hiring two SDRs, scaling the outbound team',
          avatar: 'https://i.pravatar.cc/120?img=32',
        },
        {
          name: 'Marco Rossi',
          title: 'VP Sales',
          company: 'Cadence',
          warmth: 'warmest',
          matchScore: 86,
          insight: 'Engaged with your team post on follow-ups',
          avatar: 'https://i.pravatar.cc/120?img=15',
        },
        {
          name: 'Sara Lindholm',
          title: 'CEO',
          company: 'Tend',
          warmth: 'cold',
          matchScore: 83,
          insight: 'Recently moved into a new leadership role',
          avatar: 'https://i.pravatar.cc/120?img=23',
        },
      ],
    },
    language: { mode: 'auto' },
    timing: { enabled: true, window: 'Weekdays, 8:00 to 18:00' },
    opener: { mode: 'ai' },
    replyMode: 'autopilot',
    stats: {
      found: 680,
      sent: 420,
      accepted: 142,
      messaged: 138,
      replied: 61,
      goalAchieved: 11,
    },
    repliesWaiting: 6,
    history: {
      connectionRequests: [40, 95, 150, 215, 270, 330, 380, 420],
      acceptRate: [28, 30, 29, 31, 33, 32, 33, 34],
      replyRate: [35, 37, 38, 40, 39, 41, 42, 43],
      goalAchieved: [0, 1, 1, 1, 2, 2, 1, 2],
    },
    createdAt: '2026-06-02T09:00:00Z',
  },
  {
    id: 'c2',
    name: 'RevOps leaders, NL/BE',
    goalType: 'demo',
    goalDescription: 'Get them into a live product demo',
    status: 'active',
    memberIds: ['m3'],
    audience: {
      icp: {
        titles: ['Head of RevOps', 'Sales Operations Manager', 'VP Revenue'],
        excludedTitles: ['Intern', 'Consultant'],
        seniority: ['Vice President', 'Director', 'Experienced Manager'],
        functions: ['Sales', 'Operations'],
        companySize: ['51-200', '201-500'],
        industries: ['Software Development', 'Business Consulting and Services'],
        locations: ['Netherlands', 'Belgium'],
        hqLocations: ['Netherlands'],
        companyType: ['Privately held', 'Public'],
        yearsInRole: '3 to 5 years',
        keywords: ['revenue operations'],
        exclusions: ['Current customers'],
        signals: { changedJobs: false, activeOnLinkedin: true, mentionedInNews: false },
      },
      sources: [
        { kind: 'engagement', enabled: true, found: 40 },
        { kind: 'signal', enabled: true, found: 90 },
        { kind: 'salesnav', enabled: true, found: 280 },
        { kind: 'import', enabled: false, found: 0 },
      ],
      matchThreshold: 75,
      suppress: {
        inOtherCampaigns: true,
        alreadyContacted: true,
        existingConnections: true,
        inActiveConversation: true,
      },
      pool: { cold: 280, warm: 90, warmest: 40 },
      scoreBuckets: [
        { range: '90-100', count: 60 },
        { range: '80-89', count: 130 },
        { range: '70-79', count: 120 },
        { range: '60-69', count: 60 },
        { range: '0-59', count: 40 },
      ],
      sampleLeads: [
        {
          name: 'Lieke Janssen',
          title: 'Head of RevOps',
          company: 'Mollie',
          warmth: 'warmest',
          matchScore: 95,
          insight: 'Posted about scaling outbound without more headcount',
          avatar: 'https://i.pravatar.cc/120?img=45',
        },
        {
          name: 'Daan Vermeer',
          title: 'VP Revenue',
          company: 'Recharge',
          warmth: 'warmest',
          matchScore: 92,
          insight: 'Hiring an RevOps lead, scaling the GTM motion',
          avatar: 'https://i.pravatar.cc/120?img=13',
        },
        {
          name: 'Sofie Maes',
          title: 'Sales Operations Manager',
          company: 'Teamleader',
          warmth: 'warm',
          matchScore: 89,
          insight: 'Engaged with your team post on reply quality',
          avatar: 'https://i.pravatar.cc/120?img=31',
        },
        {
          name: 'Ruben De Smet',
          title: 'Head of RevOps',
          company: 'Showpad',
          warmth: 'warm',
          matchScore: 86,
          insight: 'Company just expanded into the DACH region',
          avatar: 'https://i.pravatar.cc/120?img=52',
        },
        {
          name: 'Anouk Bakker',
          title: 'VP Revenue',
          company: 'Bird',
          warmth: 'cold',
          matchScore: 81,
          insight: 'Recently moved into a new revenue leadership role',
          avatar: 'https://i.pravatar.cc/120?img=24',
        },
        {
          name: 'Pieter Hendriks',
          title: 'Sales Operations Manager',
          company: 'Channable',
          warmth: 'cold',
          matchScore: 78,
          insight: 'Following competitors in the outbound automation space',
          avatar: 'https://i.pravatar.cc/120?img=8',
        },
      ],
    },
    stats: {
      found: 410,
      sent: 260,
      accepted: 88,
      messaged: 84,
      replied: 34,
      goalAchieved: 6,
    },
    repliesWaiting: 4,
    history: {
      connectionRequests: [30, 65, 100, 140, 175, 205, 235, 260],
      acceptRate: [30, 31, 30, 32, 33, 33, 33, 34],
      replyRate: [33, 34, 36, 35, 37, 38, 38, 39],
      goalAchieved: [0, 0, 0, 0, 1, 1, 1, 1],
    },
    createdAt: '2026-06-10T09:00:00Z',
  },
  {
    id: 'c3',
    name: 'Newsletter signups, warm',
    goalType: 'reply',
    goalDescription: 'Earn a genuine reply from warm signups',
    status: 'active',
    memberIds: ['m2', 'm4'],
    audience: {
      icp: {
        titles: ['Marketing Manager', 'Growth Lead', 'Founder'],
        excludedTitles: ['Student'],
        seniority: ['Experienced Manager', 'Entry Manager', 'Owner / Partner'],
        functions: ['Marketing', 'Business Development'],
        companySize: ['1-10', '11-50'],
        industries: ['Software Development', 'Retail'],
        locations: ['Netherlands', 'France'],
        hqLocations: [],
        companyType: ['Privately held'],
        yearsInRole: 'Under 1 year',
        keywords: ['growth', 'newsletter'],
        exclusions: ['Current customers', 'Unsubscribed'],
        signals: { changedJobs: false, activeOnLinkedin: false, mentionedInNews: false },
      },
      sources: [
        { kind: 'engagement', enabled: true, found: 260 },
        { kind: 'signal', enabled: true, found: 140 },
        { kind: 'salesnav', enabled: false, found: 0 },
        { kind: 'import', enabled: true, found: 420 },
      ],
      matchThreshold: 65,
      suppress: {
        inOtherCampaigns: true,
        alreadyContacted: true,
        existingConnections: false,
        inActiveConversation: true,
      },
      pool: { cold: 420, warm: 140, warmest: 260 },
      scoreBuckets: [
        { range: '90-100', count: 200 },
        { range: '80-89', count: 280 },
        { range: '70-79', count: 200 },
        { range: '60-69', count: 90 },
        { range: '0-59', count: 50 },
      ],
    },
    stats: {
      found: 820,
      sent: 540,
      accepted: 210,
      messaged: 205,
      replied: 132,
      goalAchieved: 58,
    },
    repliesWaiting: 11,
    history: {
      connectionRequests: [70, 150, 230, 300, 370, 440, 490, 540],
      acceptRate: [33, 34, 35, 36, 37, 38, 38, 39],
      replyRate: [55, 57, 58, 59, 60, 61, 62, 63],
      goalAchieved: [3, 4, 5, 5, 6, 6, 6, 7],
    },
    createdAt: '2026-05-21T09:00:00Z',
  },
  {
    id: 'c4',
    name: 'Agency partnerships',
    goalType: 'custom',
    goalLabel: 'Intro call with their head of partnerships',
    goalDescription: 'Intro call with their head of partnerships',
    status: 'paused',
    memberIds: ['m1'],
    audience: {
      icp: {
        titles: ['Head of Partnerships', 'Agency Owner'],
        excludedTitles: ['Freelancer'],
        seniority: ['Owner / Partner', 'Director'],
        functions: ['Business Development', 'Marketing'],
        companySize: ['11-50', '51-200'],
        industries: ['Advertising Services', 'Marketing Services'],
        locations: ['Netherlands'],
        hqLocations: ['Netherlands'],
        companyType: ['Privately held', 'Partnership'],
        yearsInRole: '6 to 10 years',
        keywords: ['partner program'],
        exclusions: ['Current partners'],
        signals: { changedJobs: false, activeOnLinkedin: true, mentionedInNews: true },
      },
      sources: [
        { kind: 'engagement', enabled: false, found: 0 },
        { kind: 'signal', enabled: true, found: 40 },
        { kind: 'salesnav', enabled: true, found: 140 },
        { kind: 'import', enabled: false, found: 0 },
      ],
      matchThreshold: 70,
      suppress: {
        inOtherCampaigns: true,
        alreadyContacted: false,
        existingConnections: false,
        inActiveConversation: false,
      },
      pool: { cold: 140, warm: 40, warmest: 0 },
      scoreBuckets: [
        { range: '90-100', count: 20 },
        { range: '80-89', count: 50 },
        { range: '70-79', count: 60 },
        { range: '60-69', count: 30 },
        { range: '0-59', count: 20 },
      ],
      sampleLeads: [
        {
          name: 'Ruben de Vries',
          title: 'Head of Partnerships',
          company: 'Studio Noord',
          warmth: 'warm',
          matchScore: 89,
          insight: 'Announced a new partner programme this month',
          avatar: 'https://i.pravatar.cc/120?img=51',
        },
        {
          name: 'Ines Bakker',
          title: 'Agency Owner',
          company: 'Bright Collective',
          warmth: 'cold',
          matchScore: 81,
          insight: 'Recently expanded into outbound services',
          avatar: 'https://i.pravatar.cc/120?img=44',
        },
        {
          name: 'Pieter Smit',
          title: 'Head of Partnerships',
          company: 'Kanttekening',
          warmth: 'cold',
          matchScore: 76,
          insight: 'Looking for tooling partners on LinkedIn',
          avatar: 'https://i.pravatar.cc/120?img=60',
        },
      ],
    },
    language: { mode: 'fixed', fixed: 'nl' },
    timing: { enabled: false, window: 'Weekdays, 9:00 to 17:00' },
    opener: {
      mode: 'fixed',
      fixedText:
        'Hi {{firstName}}, saw {{company}} is leaning into partnerships. Would love to compare notes, open to connecting?',
    },
    replyMode: 'review',
    stats: {
      found: 180,
      sent: 110,
      accepted: 34,
      messaged: 31,
      replied: 12,
      goalAchieved: 2,
    },
    history: {
      connectionRequests: [15, 35, 55, 70, 85, 95, 105, 110],
      acceptRate: [28, 29, 30, 30, 31, 30, 30, 31],
      replyRate: [30, 32, 33, 34, 33, 34, 34, 35],
      goalAchieved: [0, 0, 1, 1, 1, 1, 0, 1],
    },
    createdAt: '2026-06-15T09:00:00Z',
  },
  {
    id: 'c5',
    name: 'Inbound waitlist, qualify',
    goalType: 'qualified',
    goalDescription: 'Qualify fit and intent before sales',
    status: 'draft',
    memberIds: [],
    audience: {
      icp: {
        titles: [],
        excludedTitles: [],
        seniority: [],
        functions: [],
        companySize: [],
        industries: [],
        locations: [],
        hqLocations: [],
        companyType: [],
        yearsInRole: '',
        keywords: [],
        exclusions: [],
        signals: { changedJobs: false, activeOnLinkedin: false, mentionedInNews: false },
      },
      sources: [
        { kind: 'engagement', enabled: false, found: 0 },
        { kind: 'signal', enabled: false, found: 0 },
        { kind: 'salesnav', enabled: false, found: 0 },
        { kind: 'import', enabled: false, found: 0 },
      ],
      matchThreshold: 70,
      suppress: {
        inOtherCampaigns: true,
        alreadyContacted: true,
        existingConnections: false,
        inActiveConversation: true,
      },
      pool: { cold: 0, warm: 0, warmest: 0 },
      scoreBuckets: [
        { range: '90-100', count: 0 },
        { range: '80-89', count: 0 },
        { range: '70-79', count: 0 },
        { range: '60-69', count: 0 },
        { range: '0-59', count: 0 },
      ],
    },
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
