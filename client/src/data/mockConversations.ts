import type { CampaignGoalType } from './mockCampaigns';

export type ConversationStatus = 'open' | 'waiting' | 'snoozed' | 'done';
export type ConversationCategory = 'primary' | 'newsletter' | 'fyi' | 'promo';
export type ConversationPriority = 'high' | 'normal' | 'low';

// ─── Phase 3 — campaign-style conversation rows ────────────────────
// Each conversation carries the SAME goal type the campaign uses (so the
// inbox row shows an identical "Meeting" / "Demo" / "Reply" goal pill) plus
// a discrete AI stage describing how far this thread has progressed toward
// that goal. The stage drives the neutral progress bar fill — exactly the
// campaign-row treatment (neutral glass, plain-text label, no sentiment
// colour).
export type ConversationGoalStage =
  | 'no_reply'
  | 'replied'
  | 'in_conversation'
  | 'interested'
  | 'ready';

// Plain-text label + progress% per AI stage. Labels are EXACT and ordered:
// No reply → Replied → In conversation → Interested → Ready.
export const STAGE_META: Record<
  ConversationGoalStage,
  { label: string; progress: number }
> = {
  no_reply: { label: 'No reply', progress: 8 },
  replied: { label: 'Replied', progress: 30 },
  in_conversation: { label: 'In conversation', progress: 55 },
  interested: { label: 'Interested', progress: 80 },
  ready: { label: 'Ready', progress: 100 },
};

// Replaiy — LinkedIn outbound draft types. These are the kinds of
// LinkedIn messages Replaiy drafts on the user's behalf.
export type DraftType = 'opener' | 'reply' | 'objection' | 'follow_up' | 'meeting_ask';

export interface Attachment {
  name: string;
  size: string;
  kind: 'pdf' | 'image' | 'doc' | 'sheet' | 'zip';
}

// ─── Lead context — the right-hand enrichment panel ────────────────
// Everything the AI knows about the person behind the thread. The contact
// PII (email + phone) is present in the mock but the UI keeps it hidden
// until the user opts in via "Reveal contact info" (on-demand enrichment).
export interface LeadContext {
  title: string; // 'Head of Growth'
  company: string; // 'Northwave Labs'
  location?: string; // 'Amsterdam, NL'
  companySize?: string; // '50-200'
  industry?: string; // 'B2B SaaS'
  fitScore?: number; // 0-100 ICP match
  signals?: string[]; // why the AI personalizes this thread
  linkedinUrl?: string;
  // contact-enrichment (PII) — hidden in the UI until revealed on demand.
  email?: string;
  phone?: string;
}

export interface ThreadMessage {
  id: string;
  from: 'me' | 'other';
  authorName: string; // resolved display name
  authorEmail?: string;
  ts: string; // ISO
  body: string;
  attachments?: Attachment[];
}

export interface Conversation {
  id: string;
  // NOTE: inner field names (from.email, subject, preview, authorEmail) are
  // intentionally kept as legacy email-style names to minimise churn.
  from: { name: string; email: string; avatar?: string };
  to: string;
  subject: string;
  preview: string;
  body: string;
  ts: string; // ISO date
  status: ConversationStatus;
  category: ConversationCategory;
  priority: ConversationPriority;
  needsReply: boolean;
  summary: string;
  smartReplies: [string, string, string];
  actionItems?: string[];
  attachments?: Attachment[];
  hasThread?: number; // count
  snoozeUntil?: string;
  aiReasoning?: string; // shown in Smart Inbox "Today for you"

  // ─── Phase 3 — campaign-style row fields ─────────────────────────
  /** The conversion goal this thread is being steered toward — reuses the
   *  campaign goal type so the inbox goal pill matches campaigns 1:1.
   *  Falls back to 'meeting' when absent. */
  goalType?: CampaignGoalType;
  /** How far the AI judges this thread has progressed toward the goal.
   *  Drives the neutral progress bar fill + the plain-text stage label. */
  goalStage?: ConversationGoalStage;
  /** Which campaign this conversation belongs to. Shown as the row subtitle
   *  (more useful at-a-glance than role/company, which lives in the detail). */
  campaignName?: string;

  // ─── Replaiy LinkedIn-draft fields ───────────────────────────────
  /** Draft kind (opener / reply / objection / follow-up / meeting-ask). */
  draftType?: DraftType;
  /** 0-100 confidence of the proposed reply. */
  confidence?: number;
  /** For ≥90% confidence drafts held for review: WHY it wasn't auto-sent. */
  holdReason?: string | null;
  /** Draft was sent automatically overnight by autopilot. */
  isAutoSent?: boolean;
  /** Relative "Sent 02:14" label for auto-sent drafts. */
  autoSentAt?: string;
  /** Lead headline + company, shown LinkedIn-style on the row/detail. */
  leadHeadline?: string;
  leadCompany?: string;
  leadLocation?: string;

  // ─── Lead context panel — enrichment + AI read of the thread ──────
  /** Enriched lead profile shown in the right-hand Lead context panel. */
  lead?: LeadContext;
  /** AI read: one-line interpretation of WHY / what the thread means.
   *  e.g. 'Interested, but will want proof the AI sounds human.' This is
   *  NOT a stage — goalStage stays the single source of truth for warmth. */
  aiRead?: string;
  /** The most valuable line: the next best action to move the thread on.
   *  e.g. 'Propose Tue or Wed afternoon for a 20-min call'. */
  nextAction?: string;

  // Threading
  isThread?: boolean;
  threadCount?: number;
  threadParticipants?: { name: string; email: string; avatar?: string }[];
  threadAiSummary?: string; // sentence-form
  newSinceContext?: string; // AI mini-context shown below the "New since" divider
  pendingActions?: string[]; // v14.6 — surfaced inside the AI Summary bottom sheet

  // v30.32 — Delta-briefing fields for long-thread summary panel.
  threadDelta?: string;
  threadOpenItems?: Array<{ who: string; what: string }>;
  threadKeyFacts?: string[];

  messages?: ThreadMessage[];
  lastSeenMessageId?: string; // user has read up to here — next msg is "new since"
  isSent?: boolean; // v17 — user-authored, lives in Sent view
  isDraft?: boolean;
}

// Build dates relative to "now"
const now = new Date();
const iso = (d: Date) => d.toISOString();
const minsAgo = (m: number) => {
  const d = new Date(now);
  d.setMinutes(d.getMinutes() - m, 0, 0);
  return iso(d);
};
const hoursAgo = (h: number) => {
  const d = new Date(now);
  d.setHours(d.getHours() - h, 0, 0, 0);
  return iso(d);
};
const daysAgo = (days: number, h = 10, m = 0) => {
  const d = new Date(now);
  d.setDate(d.getDate() - days);
  d.setHours(h, m, 0, 0);
  return iso(d);
};

// ─────────────────────────────────────────────────────────────────
// Replaiy LinkedIn-outbound drafts.
//
// Each Conversation represents a LinkedIn conversation: the lead's last inbound
// message (body / first thread message) plus the Replaiy-proposed reply
// (smartReplies[0]) shown in the floating draft bar.
//
//   • subject = LinkedIn context (role · company, or conversation type) —
//     NOT an e-mail subject line.
//   • body / messages = the lead's inbound LinkedIn message.
//   • smartReplies[0] = the Replaiy draft reply.
//   • aiReasoning = short italic strategy line for the list row.
//
// pending drafts → priority:'high', status:'open', needsReply:true
//   (lands in "Needs your approval" + shows the floating Replaiy draft).
// approved drafts → status:'waiting' ("Waiting on reply").
// auto-sent drafts → isAutoSent:true ("Auto-sent today" collapsed).
// ─────────────────────────────────────────────────────────────────
export const mockConversations: Conversation[] = [
  // ── Needs your approval (pending) ───────────────────────────────
  {
    id: 'd2',
    from: { name: 'Emma Chen', email: '', avatar: 'https://i.pravatar.cc/120?img=47' },
    to: 'replaiy',
    subject: 'Head of Growth · Northwave Labs',
    preview: "Ok this actually sounds useful. We're scaling SDR outbound right now and reply quality is a mess.",
    body: "Ok this actually sounds useful. We're scaling SDR outbound right now and reply quality is a mess.",
    ts: minsAgo(34),
    status: 'open',
    category: 'primary',
    priority: 'high',
    needsReply: true,
    draftType: 'meeting_ask',
    confidence: 97,
    holdReason: 'Meeting asks set to manual review',
    leadHeadline: 'Head of Growth',
    leadCompany: 'Northwave Labs',
    leadLocation: 'Berlin',
    summary: "Strong buying signal — Replaiy proposes a 20-min meeting ask anchored to her reply-quality pain.",
    aiReasoning: 'Strong buying signal — ready for the meeting ask',
    goalType: 'meeting',
    goalStage: 'interested',
    campaignName: 'Q3 — Series-B founders',
    aiRead: 'Interested, but will want proof the AI sounds human before committing.',
    nextAction: 'Propose Tue or Wed afternoon for a 20-min call',
    lead: {
      title: 'Head of Growth',
      company: 'Northwave Labs',
      location: 'Amsterdam, NL',
      companySize: '50-200',
      industry: 'B2B SaaS',
      fitScore: 91,
      signals: [
        'Replied positively today',
        'Scaling SDR outbound right now',
        'Reply quality is her stated pain',
      ],
      linkedinUrl: '#',
      email: 'emma.chen@northwavelabs.com',
      phone: '+31 6 12 34 56 78',
    },
    smartReplies: [
      "Love that — reply quality is exactly where we move the needle. Worth a 20-min look at how it'd fit your current SDR motion? I can walk you through a live thread from a team your size. Tue or Wed afternoon work on your end?",
      "Happy to share a couple of live examples from a similar SDR team first if that's easier?",
      "When would be a good time this week for a quick look?",
    ],
  },
  {
    id: 'd1',
    from: { name: 'Jan de Vries', email: '', avatar: 'https://i.pravatar.cc/120?img=12' },
    to: 'replaiy',
    subject: 'CTO · Acme Software',
    preview: 'Interessant, maar we hebben vorig jaar al een outbound-tool geprobeerd en die voelde echt als spam. Hoe is dit anders?',
    body: 'Interessant, maar we hebben vorig jaar al een outbound-tool geprobeerd en die voelde echt als spam. Hoe is dit anders?',
    ts: minsAgo(12),
    status: 'open',
    category: 'primary',
    priority: 'high',
    needsReply: true,
    draftType: 'reply',
    confidence: 94,
    holdReason: 'Autopilot off for replies',
    leadHeadline: 'CTO',
    leadCompany: 'Acme Software',
    leadLocation: 'Amsterdam',
    summary: 'Eerdere spam-ervaring; Replaiy reframet naar human-in-the-loop en biedt social proof aan.',
    aiReasoning: 'Eerdere spam-zorg — ik reframe naar human-in-the-loop',
    goalType: 'meeting',
    goalStage: 'in_conversation',
    campaignName: 'Q3 — Series-B founders',
    aiRead: 'Skeptical after a past bad experience, not closed off. Wants reassurance this is human-led.',
    nextAction: 'Offer two live examples from a comparable dev team',
    lead: {
      title: 'CTO',
      company: 'Acme Software',
      location: 'Amsterdam, NL',
      companySize: '200-500',
      industry: 'Dev tooling',
      fitScore: 78,
      signals: [
        'Tried an outbound tool last year',
        'Cares about reply quality, not volume',
        'Technical buyer, wants the how',
      ],
      linkedinUrl: '#',
      email: 'jan.devries@acmesoftware.io',
      phone: '+31 6 98 76 54 32',
    },
    smartReplies: [
      'Snap ik helemaal, Jan — de meeste tools blazen hetzelfde sjabloon naar 500 mensen. Wij draaien het om: elke reply wordt geschreven op basis van de context van dít gesprek, en jouw team keurt alles goed vóór het de deur uitgaat. Niks gaat automatisch tenzij je dat zelf aanzet. Zal ik je een paar échte voorbeelden uit een vergelijkbaar dev-team sturen?',
      'Eerlijk: de eerste lichting outbound-tools wás spam. Wij zijn human-in-the-loop — jij keurt elke reply goed. Zal ik laten zien hoe dat eruitziet?',
      'Wil je een korte demo waarin je precies ziet wat er wel en niet automatisch gaat?',
    ],
  },
  {
    id: 'd8',
    from: { name: 'Hannah Müller', email: '', avatar: 'https://i.pravatar.cc/120?img=49' },
    to: 'replaiy',
    subject: 'Marketing Lead · Kettle & Co',
    preview: 'Looks promising. How do we get started?',
    body: 'Looks promising. How do we get started?',
    ts: minsAgo(8),
    status: 'open',
    category: 'primary',
    priority: 'high',
    needsReply: true,
    draftType: 'meeting_ask',
    confidence: 96,
    holdReason: 'Meeting asks set to manual review',
    leadHeadline: 'Marketing Lead',
    leadCompany: 'Kettle & Co',
    leadLocation: 'Vienna',
    summary: 'Explicit intent to start — Replaiy goes straight to onboarding with two concrete slots.',
    aiReasoning: 'Asked how to start — going straight to onboarding',
    goalType: 'meeting',
    goalStage: 'ready',
    campaignName: 'Q3 — Series-B founders',
    aiRead: 'Ready to move. Asked outright how to start, so the only job left is to book the time.',
    nextAction: 'Offer two onboarding slots and confirm one',
    lead: {
      title: 'Marketing Lead',
      company: 'Kettle & Co',
      location: 'Vienna, AT',
      companySize: '10-50',
      industry: 'D2C commerce',
      fitScore: 84,
      signals: [
        'Asked how to get started',
        'No objections raised',
        'Small team, fast to adopt',
      ],
      linkedinUrl: '#',
      email: 'hannah.mueller@kettleandco.com',
      phone: '+43 660 123 45 67',
    },
    smartReplies: [
      "Great to hear, Hannah! Easiest first step is a quick 25-min onboarding call — we connect your inbox, set your tone, and you'll have your first reviewed drafts the same day. Does Thursday morning or Friday around lunch suit you better?",
      "Awesome — want me to send over a short getting-started guide first, or jump straight to a call?",
      "I can set you up today if you're keen — what's your availability this week?",
    ],
  },
  {
    id: 'd6',
    from: { name: 'Sara Janssen', email: '', avatar: 'https://i.pravatar.cc/120?img=5' },
    to: 'replaiy',
    subject: 'RevOps Manager · Hexpond',
    preview: 'Doen jullie ook integratie met HubSpot? Anders is het voor ons een no-go.',
    body: 'Doen jullie ook integratie met HubSpot? Anders is het voor ons een no-go.',
    ts: minsAgo(22),
    status: 'open',
    category: 'primary',
    priority: 'high',
    needsReply: true,
    draftType: 'reply',
    confidence: 91,
    holdReason: 'Still learning — 18/25 reviewed',
    leadHeadline: 'RevOps Manager',
    leadCompany: 'Hexpond',
    leadLocation: 'Rotterdam',
    summary: 'HubSpot is een deal-breaker — Replaiy bevestigt native sync en biedt gerichte demo aan.',
    aiReasoning: 'HubSpot is een deal-breaker — ik bevestig native sync',
    goalType: 'demo',
    goalStage: 'in_conversation',
    campaignName: 'RevOps leaders — NL/BE',
    smartReplies: [
      'Ja, native HubSpot-sync zit erin — contacten, threads en replies loggen automatisch terug, dus je RevOps-rapportage blijft kloppen. Geen losse export-rompslomp. Wil je dat ik je laat zien hoe een reply binnen één thread in HubSpot landt? Dan zie je meteen of het in jullie setup past.',
      'Zeker — HubSpot is een van onze native integraties. Zal ik je de docs sturen of liever even live laten zien?',
      'Wil je dat ik je connect met een RevOps-klant die ook op HubSpot zit?',
    ],
  },
  {
    id: 'd3',
    from: { name: 'Lars Bakker', email: '', avatar: 'https://i.pravatar.cc/120?img=33' },
    to: 'replaiy',
    subject: 'VP Sales · Tendr B.V.',
    preview: 'Prijs is wel een dingetje. €600/maand is fors voor een team van vier. Wat krijgen we daar concreet voor terug?',
    body: 'Prijs is wel een dingetje. €600/maand is fors voor een team van vier. Wat krijgen we daar concreet voor terug?',
    ts: hoursAgo(1),
    status: 'open',
    category: 'primary',
    priority: 'high',
    needsReply: true,
    draftType: 'objection',
    confidence: 88,
    holdReason: null,
    leadHeadline: 'VP Sales',
    leadCompany: 'Tendr B.V.',
    leadLocation: 'Utrecht',
    summary: 'Prijsbezwaar bij klein team — Replaiy reframet naar ROI en kwalificeert met een vraag.',
    aiReasoning: 'Pushback op prijs — ROI-reframe nodig',
    goalType: 'meeting',
    goalStage: 'in_conversation',
    campaignName: 'Q3 — Series-B founders',
    smartReplies: [
      'Eerlijk antwoord, Lars: als het je geen extra meetings oplevert, is het te duur — punt. De meeste teams van jouw grootte halen er 6-10 gekwalificeerde gesprekken per maand uit die ze anders waren misgelopen. Eén gesloten deal verdient het ruim terug. Zullen we het even tegen jullie gemiddelde dealwaarde aanleggen, dan zie je het meteen?',
      'Snap de zorg. Zal ik een korte ROI-rekensom maken op basis van jullie gemiddelde dealwaarde?',
      'We hebben ook een instapoptie voor kleinere teams — wil je die opties even naast elkaar zien?',
    ],
  },
  {
    id: 'd4',
    from: { name: 'Priya Nair', email: '', avatar: 'https://i.pravatar.cc/120?img=44' },
    to: 'replaiy',
    subject: 'Cold opener · hiring-signaal',
    preview: 'Loopfield opende net een paar SDR-rollen — Replaiy stelt een lage-druk opener voor.',
    body: '[Cold opener] Loopfield heeft net een paar SDR-rollen geopend — outbound is duidelijk aan het opschalen. Geen inbound bericht; Replaiy stelt een eerste connectie/bericht voor op basis van dit hiring-signaal.',
    ts: hoursAgo(2),
    status: 'open',
    category: 'primary',
    priority: 'high',
    needsReply: true,
    draftType: 'opener',
    confidence: 82,
    holdReason: null,
    leadHeadline: 'Founder & CEO',
    leadCompany: 'Loopfield',
    leadLocation: 'London',
    summary: 'Cold opener getriggerd door hiring-signaal (SDR-rollen). Lage-druk introductie.',
    aiReasoning: 'Cold opener on a hiring signal — low-pressure intro',
    goalType: 'reply',
    goalStage: 'no_reply',
    campaignName: 'Newsletter signups — warm',
    smartReplies: [
      "Hi Priya — saw Loopfield just opened a couple of SDR roles, so outbound is clearly heating up for you. Most founders I talk to at that stage are drowning in follow-ups that sound robotic. We help teams keep replies personal at volume without the copy-paste feel. Open to a quick idea or two, even if you don't end up needing us?",
      "Hi Priya — noticed Loopfield is hiring SDRs. Happy to share what's working for teams at your stage, no pitch. Worth a quick exchange?",
      "Hi Priya — congrats on the SDR hires. Mind if I send one idea that might save your new team a lot of copy-paste?",
    ],
  },
  {
    id: 'd5',
    from: { name: 'Marco Rossi', email: '', avatar: 'https://i.pravatar.cc/120?img=60' },
    to: 'replaiy',
    subject: 'Sales Director · Velco Group',
    preview: 'Thanks, will discuss internally and get back to you.',
    body: 'Thanks, will discuss internally and get back to you.',
    ts: daysAgo(4, 11, 0),
    status: 'open',
    category: 'primary',
    priority: 'high',
    needsReply: true,
    draftType: 'follow_up',
    confidence: 79,
    holdReason: null,
    leadHeadline: 'Sales Director',
    leadCompany: 'Velco Group',
    leadLocation: 'Milan',
    summary: "4-day stall after 'will discuss internally' — Replaiy re-engages with value and an easy-out.",
    aiReasoning: '4-day stall — re-engaging with an easy-out',
    goalType: 'meeting',
    goalStage: 'replied',
    campaignName: 'Q3 — Series-B founders',
    smartReplies: [
      "Hey Marco — no rush at all, just keeping this on your radar. If it helps the internal chat, I put together a one-pager on how a team like Velco's would roll this out in week one. Want me to send it over? Happy to also just close the loop if the timing's off for now.",
      "Hi Marco — checking in gently. Want me to send a short rollout one-pager for the internal discussion?",
      "Totally fine if now's not the moment — just let me know either way and I'll stop nudging.",
    ],
  },
  {
    id: 'd7',
    from: { name: 'David Okafor', email: '', avatar: 'https://i.pravatar.cc/120?img=68' },
    to: 'replaiy',
    subject: 'Co-founder · Brightmile',
    preview: 'Honestly not sure AI-written messages are the move for us — feels like it could damage the brand if it sounds off.',
    body: 'Honestly not sure AI-written messages are the move for us — feels like it could damage the brand if it sounds off.',
    ts: minsAgo(47),
    status: 'open',
    category: 'primary',
    priority: 'high',
    needsReply: true,
    draftType: 'objection',
    confidence: 68,
    holdReason: null,
    leadHeadline: 'Co-founder',
    leadCompany: 'Brightmile',
    leadLocation: 'Dublin',
    summary: 'Brand-risk objection rooted in distrust of AI tone — skeptical, worth a human eye.',
    aiReasoning: 'Brand-risk objection — skeptical, worth a human eye',
    goalType: 'demo',
    goalStage: 'replied',
    campaignName: 'RevOps leaders — NL/BE',
    smartReplies: [
      "That instinct is right, David — a tool that sounds 'off' is worse than no tool. That's the whole reason approval is on by default: nothing sends until a human signs off, and the AI matches your tone, not a generic template. Plenty of our customers actually use it to enforce brand voice, not dilute it. Want to see a side-by-side of raw vs. on-brand output?",
      "Fair concern. Approval-by-default means nothing goes out without you. Want a side-by-side so you can judge the tone yourself?",
      "Happy to share how other founders use it to protect brand voice rather than risk it — worth a quick look?",
    ],
  },

  // ── Waiting on reply (approved & sent) ──────────────────────────
  {
    id: 'd9',
    from: { name: 'Femke de Boer', email: '', avatar: 'https://i.pravatar.cc/120?img=32' },
    to: 'replaiy',
    subject: 'Head of Talent · Norvell',
    preview: 'Verstuurd — wacht op interne terugkoppeling.',
    body: 'Bedankt voor de demo gisteren, ik neem het mee intern.',
    ts: hoursAgo(3),
    status: 'waiting',
    category: 'primary',
    priority: 'normal',
    needsReply: false,
    draftType: 'follow_up',
    confidence: 90,
    holdReason: null,
    leadHeadline: 'Head of Talent',
    leadCompany: 'Norvell',
    leadLocation: 'The Hague',
    summary: 'Reeds goedgekeurd en verstuurd; wacht nu op interne terugkoppeling van de lead.',
    aiReasoning: 'Verstuurd — wacht op interne terugkoppeling',
    goalType: 'meeting',
    goalStage: 'interested',
    campaignName: 'Q3 — Series-B founders',
    smartReplies: [
      'Top, Femke! Ik stuur je zo de samenvatting + een rollout-schets voor jullie talent-team. Laat maar weten als er vanuit het team vragen komen — ik haak graag even aan.',
      'Geen haast — ik hoor het graag zodra jullie intern hebben afgestemd.',
      'Zal ik vast een voorstel klaarzetten zodat het sneller kan als jullie groen licht geven?',
    ],
  },
  {
    id: 'd10',
    from: { name: 'Tomás Reyes', email: '', avatar: 'https://i.pravatar.cc/120?img=15' },
    to: 'replaiy',
    subject: 'Growth Lead · Caldera',
    preview: 'Sent — awaiting their slot pick.',
    body: 'Sounds good, let me check my calendar.',
    ts: daysAgo(1, 15, 0),
    status: 'waiting',
    category: 'primary',
    priority: 'normal',
    needsReply: false,
    draftType: 'meeting_ask',
    confidence: 93,
    holdReason: null,
    leadHeadline: 'Growth Lead',
    leadCompany: 'Caldera',
    leadLocation: 'Madrid',
    summary: 'Approved meeting-ask; lead is checking availability, awaiting their slot pick.',
    aiReasoning: 'Sent — awaiting their slot pick',
    goalType: 'meeting',
    goalStage: 'ready',
    campaignName: 'Q3 — Series-B founders',
    smartReplies: [
      "Perfect — I'll hold Thursday 3pm and Friday 11am loosely on my side. Just reply with whichever lands and I'll send the invite over.",
      'No rush — whenever your calendar is clear, just ping me a slot.',
      'Want me to send a couple of fixed options instead so it’s one tap?',
    ],
  },

  // ── Auto-sent today (autopilot, collapsed section) ──────────────
  {
    id: 'd11',
    from: { name: 'Nora Lindqvist', email: '', avatar: 'https://i.pravatar.cc/120?img=20' },
    to: 'replaiy',
    subject: 'SDR Manager · Frost & Park',
    preview: 'Auto-sent overnight · opener on a hiring signal.',
    body: '[Cold opener] Frost & Park is ramping SDR hiring — Replaiy auto-sent a high-confidence opener overnight.',
    ts: daysAgo(0, 2, 14),
    status: 'open',
    category: 'primary',
    priority: 'low',
    needsReply: false,
    draftType: 'opener',
    confidence: 95,
    holdReason: null,
    isAutoSent: true,
    autoSentAt: 'Sent 02:14',
    leadHeadline: 'SDR Manager',
    leadCompany: 'Frost & Park',
    leadLocation: 'Stockholm',
    summary: 'High-confidence opener on an enabled autopilot type — sent automatically overnight.',
    aiReasoning: 'Auto-sent overnight',
    goalType: 'reply',
    goalStage: 'no_reply',
    campaignName: 'Newsletter signups — warm',
    smartReplies: [
      "Hi Nora — saw Frost & Park is ramping SDR hiring. We help teams keep outbound replies personal at volume. Open to a quick idea or two?",
      'Hi Nora — congrats on the SDR ramp. One idea that might help your new hires?',
      'Hi Nora — happy to share what works for fast-scaling SDR teams.',
    ],
  },
  {
    id: 'd12',
    from: { name: 'Ben Carter', email: '', avatar: 'https://i.pravatar.cc/120?img=51' },
    to: 'replaiy',
    subject: 'VP Revenue · Hollowpoint',
    preview: 'Auto-sent overnight · pricing reply.',
    body: 'Can you send pricing?',
    ts: daysAgo(0, 3, 2),
    status: 'open',
    category: 'primary',
    priority: 'low',
    needsReply: false,
    draftType: 'reply',
    confidence: 94,
    holdReason: null,
    isAutoSent: true,
    autoSentAt: 'Sent 03:02',
    leadHeadline: 'VP Revenue',
    leadCompany: 'Hollowpoint',
    leadLocation: 'Austin',
    summary: 'Straightforward pricing reply, high confidence, autopilot enabled for replies.',
    aiReasoning: 'Auto-sent overnight',
    goalType: 'demo',
    goalStage: 'replied',
    campaignName: 'RevOps leaders — NL/BE',
    smartReplies: [
      "Sure thing, Ben — plans start at €600/mo for up to 5 seats with native CRM sync. Sending the full breakdown your way now.",
      "Happy to — sending pricing now. Want a quick walkthrough too?",
      "On its way. Let me know if you'd like a tailored quote for your team size.",
    ],
  },
  {
    id: 'd13',
    from: { name: 'Aisha Rahman', email: '', avatar: 'https://i.pravatar.cc/120?img=45' },
    to: 'replaiy',
    subject: 'Founder · Tideglass',
    preview: 'Auto-sent overnight · nurture follow-up.',
    body: 'Not right now, maybe next quarter.',
    ts: daysAgo(0, 5, 40),
    status: 'open',
    category: 'primary',
    priority: 'low',
    needsReply: false,
    draftType: 'follow_up',
    confidence: 92,
    holdReason: null,
    isAutoSent: true,
    autoSentAt: 'Sent 05:40',
    leadHeadline: 'Founder',
    leadCompany: 'Tideglass',
    leadLocation: 'Singapore',
    summary: 'Polite defer; low-pressure nurture follow-up auto-sent on schedule.',
    aiReasoning: 'Auto-sent overnight',
    goalType: 'reply',
    goalStage: 'replied',
    campaignName: 'Newsletter signups — warm',
    smartReplies: [
      "Totally fair, Aisha — I'll check back early next quarter. In the meantime I'll keep an eye out and send anything genuinely useful, nothing salesy.",
      'No problem — I’ll circle back next quarter. Anything specific you’d want me to prep?',
      'Understood. I’ll stay out of your inbox until the timing’s right.',
    ],
  },
];

export const senderAvatarHue = (name: string): number => {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = name.charCodeAt(i) + ((h << 5) - h);
  }
  return Math.abs(h) % 360;
};

export const initials = (name: string): string => {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

// Pre-baked AI copilot responses for compose
export const aiPrebakedPrompts: Record<string, string> = {
  'reply yes to lunch':
    "Yes — Tuesday works great. 12:30 at the usual spot?\n\nSimon",
  'decline politely':
    "Thanks so much for the invite — unfortunately I have a conflict that morning and won't be able to make it. Would love to catch up another time soon though.\n\nBest,\nSimon",
  'ask for a follow-up next week':
    "Thanks for the note. Could we pick this back up next week? Tuesday or Wednesday afternoon both work on my end — happy to grab 30 minutes whenever's easiest.\n\nSimon",
  'thank for the intro':
    "Thanks so much for making the intro — really appreciate it. I'll take it from here and circle back to let you know how it goes.\n\nSimon",
};

export const aiTransforms = {
  shorter: (text: string) =>
    text
      .split('\n')
      .filter(Boolean)
      .slice(0, 2)
      .map((l) => l.replace(/^(I think|I just want to say that|Just wanted to|I was hoping|I wanted to)\s+/i, ''))
      .join('\n') ||
    text.slice(0, 200),
  moreFormal: (text: string) =>
    text
      .replace(/\b(hey|hi)\b/gi, 'Dear team')
      .replace(/\b(thanks|thx)\b/gi, 'Thank you')
      .replace(/\b(let me know)\b/gi, 'please let me know')
      .replace(/\b(asap)\b/gi, 'at your earliest convenience'),
  moreFriendly: (text: string) => {
    const base = text.replace(/\bDear team\b/g, 'Hey').replace(/\bSincerely\b/g, 'Cheers');
    return base.endsWith('!') || base.endsWith('.') ? base : base + ' 🙌';
  },
  fixTone: (text: string) =>
    text
      .replace(/\bI need\b/g, "Could you")
      .replace(/\b(you must|you have to)\b/g, "it would be great if you could")
      .replace(/\bASAP\b/g, "when you have a moment"),
};

export const detectTone = (text: string): { label: string; ok: boolean; hint?: string } => {
  if (text.trim().length < 6) return { label: 'Start typing...', ok: true };
  const lower = text.toLowerCase();
  const curtSignals = ['asap', 'just do', 'fyi.', 'no.', 'i need this', 'must', 'now.'];
  if (curtSignals.some((s) => lower.includes(s))) {
    return { label: 'Sounds curt', ok: false, hint: 'Soften with "could you" or "when you have a moment"' };
  }
  if (/!{2,}/.test(text)) {
    return { label: 'Reads intense', ok: false, hint: 'Trim the exclamation marks?' };
  }
  if (lower.includes('thanks') || lower.includes('appreciate') || lower.includes('please')) {
    return { label: 'Friendly', ok: true };
  }
  return { label: 'Neutral', ok: true };
};
