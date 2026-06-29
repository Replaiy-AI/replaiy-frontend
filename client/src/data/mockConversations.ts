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
  website?: string; // 'northwavelabs.com' — company domain, shown in Contact
  country?: string; // 'Netherlands' — person's country, derived from LinkedIn location
  languages?: string[]; // ['Dutch', 'English'] — from LinkedIn profile; omitted when unknown
  fitScore?: number; // 0-100 ICP match
  signals?: string[]; // why the AI personalizes this thread
  linkedinUrl?: string;
  // contact-enrichment (PII) — hidden in the UI until revealed on demand.
  email?: string;
  phone?: string;
  // The full embedded LinkedIn profile shown in the push-in view. Optional:
  // only leads we have enriched carry it. Step 1 renders Hero + About +
  // Experience; Education / Skills / Posts are designed in here now so later
  // steps can render them without a data migration.
  linkedinProfile?: LinkedInProfile;
}

// ─── Full embedded LinkedIn profile ────────────────────────────────
// Holds the WHOLE profile feature (Hero, About, Experience, Education,
// Skills, Recent Posts) even though step 1 only renders Hero + About +
// Experience. Designed up front so later steps add UI, not data.
export interface LinkedInExperience {
  company: string;
  role: string;
  logoUrl?: string;
  start: string;
  end?: string;
  location?: string;
  description?: string;
}

export interface LinkedInEducation {
  school: string;
  degree?: string;
  logoUrl?: string;
  start?: string;
  end?: string;
  description?: string;
}

/** LinkedIn reaction types, exactly as LinkedIn labels them. */
export type LinkedInReactionKind =
  | 'like'
  | 'celebrate'
  | 'support'
  | 'love'
  | 'insightful'
  | 'funny';

/** A person who engaged with a post (reacted / commented / reposted). These are
 *  surfaced when the user taps a post's likes / comments / reposts count, and
 *  are the people who get collected as leads in the background. */
export interface LinkedInEngager {
  id: string;
  name: string;
  headline?: string;
  avatarUrl?: string;
  /** For reaction engagers: which reaction they gave (drives the per-type filter). */
  reaction?: LinkedInReactionKind;
  /** For comment engagers: the comment text they wrote. */
  comment?: string;
}

export interface LinkedInPost {
  id: string;
  /** Activity type, mirroring LinkedIn's Activity tabs:
   *  'post'     = the person published this post,
   *  'repost'   = the person reposted someone else's post (with or without an
   *               added comment of their own, see activityComment),
   *  'comment'  = the person commented on someone else's post,
   *  'reaction' = the person reacted (like/insightful/...) to someone else's post.
   *  Defaults to 'post' when unset. For repost/comment/reaction the author* +
   *  text/image fields describe the ORIGINAL post (by someone else). */
  kind?: 'post' | 'repost' | 'comment' | 'reaction';
  authorName: string;
  authorHeadline?: string;
  authorAvatarUrl?: string;
  timeAgo: string;
  text: string;
  imageUrl?: string;
  likes?: number;
  comments?: number;
  reposts?: number;
  /** For 'comment' items: the text the person wrote on the original post.
   *  For 'repost' items: when set, this is a quote-repost (the person added
   *  their own text above the reshared post); when absent, a plain reshare. */
  activityComment?: string;
  /** For 'reaction' items: which reaction the person gave to the original post. */
  activityReaction?: LinkedInReactionKind;
  /** Replaiy used this post to personalize outreach (shown as a quiet tag). */
  usedByAI?: boolean;
}

export interface LinkedInProfile {
  headline?: string;
  about?: string;
  bannerUrl?: string;
  followers?: number;
  connections?: number;
  /** Connection degree badge, e.g. '1st' / '2nd' / '3rd'. */
  degree?: string;
  premium?: boolean;
  /** LinkedIn account tier, drives the real LinkedIn brand badge shown next to
   *  the name: 'free' = blue in, 'premium' = orange in, 'salesnav' = orange in
   *  + Sales Navigator compass. Defaults to 'free' when unset. */
  linkedinTier?: 'free' | 'premium' | 'salesnav';
  experience?: LinkedInExperience[];
  education?: LinkedInEducation[];
  skills?: string[];
  posts?: LinkedInPost[];
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
      website: 'northwavelabs.com',
      country: 'Netherlands',
      languages: ['Dutch', 'English'],
      fitScore: 91,
      signals: [
        'Replied positively today',
        'Scaling SDR outbound right now',
        'Reply quality is her stated pain',
      ],
      linkedinUrl: '#',
      email: 'emma.chen@northwavelabs.com',
      phone: '+31 6 12 34 56 78',
      linkedinProfile: {
        headline: 'Head of Growth at Northwave Labs | Scaling B2B SaaS pipelines that actually convert',
        about:
          'I lead growth at Northwave Labs, where we help product teams turn raw signups into revenue. My focus is building outbound and lifecycle motions that feel human at scale, not spray and pray. Before Northwave I ran demand generation at two early stage SaaS companies and learned the hard way that reply quality beats reply volume every time. Outside of work I mentor first time founders on go to market and I am a sucker for a clean attribution dashboard.',
        followers: 5278,
        connections: 201,
        degree: '2nd',
        premium: true,
        linkedinTier: 'salesnav',
        experience: [
          {
            company: 'Northwave Labs',
            role: 'Head of Growth',
            start: '2022',
            end: 'Present',
            location: 'Berlin, Germany',
            description:
              'Own the full growth function across outbound, lifecycle and partnerships. Grew qualified pipeline 3x in 18 months by rebuilding the SDR motion around personalized, reply first outreach.',
          },
          {
            company: 'Brightloop',
            role: 'Demand Generation Lead',
            start: '2019',
            end: '2022',
            location: 'Amsterdam, Netherlands',
            description:
              'Built the demand gen engine from scratch, taking the company from founder led sales to a repeatable inbound and outbound mix.',
          },
          {
            company: 'Mavenly',
            role: 'Growth Marketing Manager',
            start: '2017',
            end: '2019',
            location: 'Amsterdam, Netherlands',
          },
        ],
        education: [
          {
            school: 'University of Amsterdam',
            degree: 'MSc, Business Administration',
            start: '2013',
            end: '2015',
          },
          {
            school: 'Erasmus University Rotterdam',
            degree: 'BSc, Marketing',
            start: '2010',
            end: '2013',
            description: 'Graduated cum laude with a focus on consumer behavior.',
          },
        ],
        skills: [
          'Demand Generation',
          'Outbound Strategy',
          'Lifecycle Marketing',
          'B2B SaaS',
          'Marketing Operations',
          'Team Leadership',
          'Attribution',
          'Go to Market',
        ],
        posts: [
          {
            id: 'p-emma-c1',
            kind: 'comment',
            authorName: 'Marcus Lindqvist',
            authorHeadline: 'Founder at Replyloop',
            authorAvatarUrl: 'https://i.pravatar.cc/120?img=68',
            timeAgo: '2d',
            text: 'Most sales teams measure activity because activity is easy to count. Replies are hard to count and harder to fake. If your dashboard only shows dials and emails sent, you are optimizing for the wrong thing. Measure conversations started.',
            likes: 264,
            comments: 38,
            reposts: 21,
            activityComment: 'This is exactly the shift we made last quarter. Counting conversations instead of touches changed how the whole team thinks about a good day.',
          },
          {
            id: 'p-emma-c2',
            kind: 'comment',
            authorName: 'Sofia Reyes',
            authorHeadline: 'RevOps Lead at Cadence',
            authorAvatarUrl: 'https://i.pravatar.cc/120?img=24',
            timeAgo: '4d',
            text: 'Unpopular opinion: your SDRs do not need more tools, they need fewer accounts and more time to research them. We cut every rep down to 25 named accounts and pipeline went up.',
            likes: 187,
            comments: 29,
            reposts: 9,
            activityComment: 'Fewer accounts, deeper research, every time. We saw the same lift when we made the territory smaller.',
          },
          {
            id: 'p-emma-r1',
            kind: 'reaction',
            activityReaction: 'insightful',
            authorName: 'Daniel Okafor',
            authorHeadline: 'VP Sales at Brightloop',
            authorAvatarUrl: 'https://i.pravatar.cc/120?img=33',
            timeAgo: '3d',
            text: 'The fastest way to kill a good outbound program is to judge it on week one. Pipeline from relevance compounds. Give it a full quarter before you decide it does not work.',
            likes: 142,
            comments: 11,
            reposts: 7,
          },
          {
            id: 'p-emma-r2',
            kind: 'reaction',
            activityReaction: 'celebrate',
            authorName: 'Northwave Labs',
            authorHeadline: 'B2B SaaS for product led growth teams',
            timeAgo: '5d',
            text: 'Thrilled to share that our team just won Outbound Team of the Year at the RevGrowth Awards. Proud of every rep who chose relevance over volume.',
            imageUrl: 'https://i.pravatar.cc/600?img=58',
            likes: 318,
            comments: 44,
            reposts: 19,
          },
          {
            id: 'p-emma-rp1',
            kind: 'repost',
            authorName: 'Priya Sharma',
            authorHeadline: 'Director of Demand Gen at Loomwork',
            authorAvatarUrl: 'https://i.pravatar.cc/120?img=16',
            timeAgo: '2d',
            text: 'Your pipeline is not a volume problem, it is a relevance problem. We deleted half our sequences last quarter and replaced the rest with messages that reference one specific thing about the account. Reply rate tripled. The lesson is not send less, it is mean more.',
            likes: 421,
            comments: 58,
            reposts: 34,
          },
          {
            id: 'p-emma-rp2',
            kind: 'repost',
            authorName: 'Karl Jensen',
            authorHeadline: 'CRO at Brightpath',
            authorAvatarUrl: 'https://i.pravatar.cc/120?img=53',
            timeAgo: '6d',
            text: 'The teams hitting number this year share one habit: they read before they reach out. Every winning rep on my team can name the trigger that made them message an account. The losing motion is a spreadsheet of names and a template. Relevance is a discipline, not a tactic.',
            imageUrl: 'https://i.pravatar.cc/600?img=12',
            likes: 287,
            comments: 33,
            reposts: 26,
            activityComment: 'Saving this for every new SDR I onboard. If you cannot name the trigger, you are not ready to send. We made this the first rule of our playbook and it changed everything.',
          },
          {
            id: 'p-emma-1',
            authorName: 'Emma Chen',
            authorHeadline: 'Head of Growth at Northwave Labs',
            authorAvatarUrl: 'https://i.pravatar.cc/120?img=47',
            timeAgo: '3d',
            text: 'Hot take after a year of scaling SDR outbound: reply quality is the only metric that matters. We cut sequence volume by 40 percent, spent the saved time on research, and booked more meetings than ever. Volume feels productive. Relevance is productive. If your reps are sending the same three lines to 500 people, you do not have an outbound problem, you have a positioning problem. Here is exactly how we restructured the motion and what we measured along the way.',
            likes: 312,
            comments: 47,
            reposts: 18,
            usedByAI: true,
          },
          {
            id: 'p-emma-2',
            authorName: 'Emma Chen',
            authorHeadline: 'Head of Growth at Northwave Labs',
            authorAvatarUrl: 'https://i.pravatar.cc/120?img=47',
            timeAgo: '1w',
            text: 'We just crossed 3x qualified pipeline year over year. Proud of this team.',
            imageUrl: 'https://i.pravatar.cc/600?img=47',
            likes: 198,
            comments: 22,
            reposts: 5,
          },
          {
            id: 'p-emma-3',
            authorName: 'Northwave Labs',
            authorHeadline: 'B2B SaaS for product led growth teams',
            timeAgo: '2w',
            text: 'We are hiring two SDRs in Berlin. If you care more about writing a great first message than hitting a dial quota, come talk to us.',
            likes: 74,
            comments: 9,
            reposts: 12,
          },
          {
            id: 'p-emma-4',
            authorName: 'Emma Chen',
            authorHeadline: 'Head of Growth at Northwave Labs',
            authorAvatarUrl: 'https://i.pravatar.cc/120?img=47',
            timeAgo: '3w',
            text: 'The best outbound reads like it was written by a human who actually read your profile, because it was. Tools should make that easier, not replace it. The teams winning right now use AI to draft and a human to approve. Nothing goes out on autopilot unless you choose it. That is the whole game.',
            likes: 256,
            comments: 31,
            reposts: 21,
            usedByAI: true,
          },
          {
            id: 'p-emma-5',
            authorName: 'Daniel Okafor',
            authorHeadline: 'VP Sales at Brightloop',
            authorAvatarUrl: 'https://i.pravatar.cc/120?img=33',
            timeAgo: '1mo',
            text: 'Emma was the reason our outbound finally worked. Reposting her playbook because every growth lead should read it.',
            likes: 88,
            comments: 6,
            reposts: 14,
          },
          {
            id: 'p-emma-6',
            authorName: 'Emma Chen',
            authorHeadline: 'Head of Growth at Northwave Labs',
            authorAvatarUrl: 'https://i.pravatar.cc/120?img=47',
            timeAgo: '1mo',
            text: 'Spent the weekend rebuilding our attribution model. Multi touch is messy but pretending last click is the truth is worse.',
            likes: 141,
            comments: 19,
            reposts: 7,
          },
          {
            id: 'p-emma-7',
            authorName: 'Emma Chen',
            authorHeadline: 'Head of Growth at Northwave Labs',
            authorAvatarUrl: 'https://i.pravatar.cc/120?img=47',
            timeAgo: '2mo',
            text: 'Mentoring three first time founders this quarter on go to market. The most common mistake is hiring SDRs before you have a message that converts. Fix the message first.',
            imageUrl: 'https://i.pravatar.cc/600?img=20',
            likes: 203,
            comments: 28,
            reposts: 16,
          },
          {
            id: 'p-emma-8',
            authorName: 'Emma Chen',
            authorHeadline: 'Head of Growth at Northwave Labs',
            authorAvatarUrl: 'https://i.pravatar.cc/120?img=47',
            timeAgo: '3mo',
            text: 'Quietly testing a new way to personalize outbound at scale. Early numbers are promising. More soon.',
            likes: 97,
            comments: 11,
            reposts: 3,
          },
        ],
      },
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
      website: 'acmesoftware.com',
      country: 'Netherlands',
      fitScore: 78,
      signals: [
        'Tried an outbound tool last year',
        'Cares about reply quality, not volume',
        'Technical buyer, wants the how',
      ],
      linkedinUrl: '#',
      email: 'jan.devries@acmesoftware.io',
      phone: '+31 6 98 76 54 32',
      linkedinProfile: {
        headline: 'CTO at Acme Software | Building developer tooling that engineers actually want to use',
        about:
          'I am the CTO at Acme Software, where we build dev tooling for teams who ship fast without breaking trust. I care about clean APIs, fast feedback loops and engineering cultures where people feel safe to disagree. I have been writing code for two decades and leading teams for the last ten years. I am skeptical of tools that promise magic, so I tend to read the docs before I read the marketing. When I am not in code reviews you will find me cycling along the Amstel or tinkering with home automation.',
        followers: 3142,
        connections: 487,
        degree: '2nd',
        premium: false,
        linkedinTier: 'premium',
        experience: [
          {
            company: 'Acme Software',
            role: 'Chief Technology Officer',
            start: '2020',
            end: 'Present',
            location: 'Amsterdam, Netherlands',
            description:
              'Lead engineering, platform and security across a team of 60. Rebuilt the core platform on a service mesh and cut deploy times from hours to minutes.',
          },
          {
            company: 'Polderworks',
            role: 'VP of Engineering',
            start: '2015',
            end: '2020',
            location: 'Utrecht, Netherlands',
            description:
              'Scaled the engineering org from 8 to 40 while keeping the on call burden sane and the architecture boring on purpose.',
          },
          {
            company: 'Kestrel Systems',
            role: 'Senior Software Engineer',
            start: '2011',
            end: '2015',
            location: 'Eindhoven, Netherlands',
          },
        ],
        education: [
          {
            school: 'Delft University of Technology',
            degree: 'MSc, Computer Science',
            start: '2007',
            end: '2009',
          },
          {
            school: 'Delft University of Technology',
            degree: 'BSc, Computer Science',
            start: '2004',
            end: '2007',
          },
        ],
        skills: [
          'Distributed Systems',
          'Engineering Leadership',
          'API Design',
          'Cloud Architecture',
          'Developer Experience',
          'Security',
          'TypeScript',
          'Go',
        ],
        posts: [
          {
            id: 'p-jan-c1',
            kind: 'comment',
            authorName: 'Sara Bakker',
            authorHeadline: 'Engineering Manager at Tilde',
            authorAvatarUrl: 'https://i.pravatar.cc/120?img=45',
            timeAgo: '3d',
            text: 'A vendor emailed our entire backend team the same pitch on the same morning. Different names, identical body. We screenshot it into a channel and laughed. That is the opposite of how you reach engineers.',
            likes: 356,
            comments: 52,
            reposts: 24,
            activityComment: 'If you cannot tell me which line of our changelog made you reach out, you did not earn the reply. Relevance is the whole job.',
          },
          {
            id: 'p-jan-c2',
            kind: 'comment',
            authorName: 'Tomás Herrera',
            authorHeadline: 'Principal Engineer at Northwind',
            authorAvatarUrl: 'https://i.pravatar.cc/120?img=59',
            timeAgo: '6d',
            text: 'The best engineering cultures treat on call as a design problem, not a rota problem. If your people dread the pager, the architecture is telling you something. Listen to it.',
            likes: 274,
            comments: 33,
            reposts: 15,
            activityComment: 'Exactly this. We treat every 3am page as a bug in the system, not a fact of life. Fix the cause, not the schedule.',
          },
          {
            id: 'p-jan-r1',
            kind: 'reaction',
            activityReaction: 'like',
            authorName: 'Priya Nair',
            authorHeadline: 'Staff Engineer at Acme Software',
            authorAvatarUrl: 'https://i.pravatar.cc/120?img=44',
            timeAgo: '4d',
            text: 'Shipped a migration that touched every service and nobody noticed. That is the highest compliment infrastructure work can get. Invisible is the goal.',
            likes: 198,
            comments: 17,
            reposts: 8,
          },
          {
            id: 'p-jan-r2',
            kind: 'reaction',
            activityReaction: 'insightful',
            authorName: 'Lena Fischer',
            authorHeadline: 'VP Engineering at Hexbyte',
            authorAvatarUrl: 'https://i.pravatar.cc/120?img=27',
            timeAgo: '1w',
            text: 'Stop rewarding heroics. The engineer who quietly prevents the outage is worth ten who heroically fix it at midnight. Build a culture that notices the prevention.',
            likes: 421,
            comments: 36,
            reposts: 27,
          },
          {
            id: 'p-jan-rp1',
            kind: 'repost',
            authorName: 'Henrik Solberg',
            authorHeadline: 'Staff Platform Engineer at Cloudreef',
            authorAvatarUrl: 'https://i.pravatar.cc/120?img=67',
            timeAgo: '4d',
            text: 'The fastest way to lose an engineering team is to ship a roadmap nobody believes in. Write down the three problems you are actually solving this quarter, delete everything else, and let your engineers tell you which order. Trust beats process every time.',
            likes: 392,
            comments: 41,
            reposts: 29,
            activityComment: 'This is the playbook. We cut our roadmap to three real problems and let the team sequence them. Velocity went up because people finally believed the plan. Sharing for every eng leader who is still managing a wish list.',
          },
          {
            id: 'p-jan-rp2',
            kind: 'repost',
            authorName: 'Dana Whitfield',
            authorHeadline: 'VP Engineering at Cobalt Systems',
            authorAvatarUrl: 'https://i.pravatar.cc/120?img=49',
            timeAgo: '1w',
            text: 'Reliability is a product feature, not a backlog item. The moment you treat uptime as something you get to after the roadmap, you have already decided your customers come second. Fund the boring work that keeps the lights on.',
            likes: 256,
            comments: 22,
            reposts: 17,
          },
          {
            id: 'p-jan-1',
            authorName: 'Jan de Vries',
            authorHeadline: 'CTO at Acme Software',
            authorAvatarUrl: 'https://i.pravatar.cc/120?img=12',
            timeAgo: '5d',
            text: 'Every outbound tool we tried in the last few years felt like spam wearing a suit. The pattern is always the same: a vendor blasts the same template to our whole engineering team and wonders why nobody replies. If you want a technical buyer to take you seriously, show that you understand what we actually build. Read the changelog. Reference the real problem. I will reply to one thoughtful message over fifty automated ones every single time.',
            likes: 421,
            comments: 63,
            reposts: 29,
            usedByAI: true,
          },
          {
            id: 'p-jan-2',
            authorName: 'Jan de Vries',
            authorHeadline: 'CTO at Acme Software',
            authorAvatarUrl: 'https://i.pravatar.cc/120?img=12',
            timeAgo: '2w',
            text: 'Shipped our new deploy pipeline today. From commit to production in under four minutes. The team earned this one.',
            imageUrl: 'https://i.pravatar.cc/600?img=12',
            likes: 287,
            comments: 34,
            reposts: 11,
          },
          {
            id: 'p-jan-3',
            authorName: 'Jan de Vries',
            authorHeadline: 'CTO at Acme Software',
            authorAvatarUrl: 'https://i.pravatar.cc/120?img=12',
            timeAgo: '3w',
            text: 'Boring architecture is a feature. The fewer surprises at 3am, the better your team sleeps.',
            likes: 512,
            comments: 41,
            reposts: 38,
          },
          {
            id: 'p-jan-4',
            authorName: 'Acme Software',
            authorHeadline: 'Developer tooling for teams that ship',
            timeAgo: '1mo',
            text: 'We are open sourcing our internal feature flag library this week. Built by the team, battle tested in production. Link in comments.',
            likes: 168,
            comments: 22,
            reposts: 44,
          },
          {
            id: 'p-jan-5',
            authorName: 'Jan de Vries',
            authorHeadline: 'CTO at Acme Software',
            authorAvatarUrl: 'https://i.pravatar.cc/120?img=12',
            timeAgo: '1mo',
            text: 'Interviewing engineers this month and the strongest signal is still curiosity. Tell me about a system you took apart just to understand how it worked. That answer tells me more than any whiteboard puzzle ever could.',
            likes: 233,
            comments: 27,
            reposts: 9,
          },
          {
            id: 'p-jan-6',
            authorName: 'Priya Nair',
            authorHeadline: 'Staff Engineer at Acme Software',
            authorAvatarUrl: 'https://i.pravatar.cc/120?img=44',
            timeAgo: '2mo',
            text: 'Grateful to work with a CTO who reads the RFC before the roadmap. Reposting Jan because more leaders should think this way.',
            likes: 119,
            comments: 8,
            reposts: 6,
          },
          {
            id: 'p-jan-7',
            authorName: 'Jan de Vries',
            authorHeadline: 'CTO at Acme Software',
            authorAvatarUrl: 'https://i.pravatar.cc/120?img=12',
            timeAgo: '2mo',
            text: 'Reminder that human in the loop is not a buzzword. It is the difference between a tool you trust and a tool you turn off after a week.',
            likes: 198,
            comments: 15,
            reposts: 13,
          },
          {
            id: 'p-jan-8',
            authorName: 'Jan de Vries',
            authorHeadline: 'CTO at Acme Software',
            authorAvatarUrl: 'https://i.pravatar.cc/120?img=12',
            timeAgo: '3mo',
            text: 'Took the whole engineering team off Slack for a focus week. Productivity went up, stress went down. We are doing it every quarter now.',
            imageUrl: 'https://i.pravatar.cc/600?img=15',
            likes: 304,
            comments: 36,
            reposts: 19,
          },
        ],
      },
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
      website: 'kettleandco.com',
      country: 'Austria',
      languages: ['German', 'English'],
      fitScore: 84,
      signals: [
        'Asked how to get started',
        'No objections raised',
        'Small team, fast to adopt',
      ],
      linkedinUrl: '#',
      email: 'hannah.mueller@kettleandco.com',
      linkedinProfile: {
        headline: 'Marketing Lead at Kettle & Co | D2C storytelling, lifecycle and a slight obsession with retention',
        about:
          'I run marketing at Kettle & Co, a small but mighty D2C brand based in Vienna. I love the unglamorous work of retention: email flows, win back campaigns and making a second purchase feel inevitable. I started in agency life, moved in house because I wanted to own outcomes instead of decks, and never looked back. Small teams move fast, and I would rather ship a scrappy campaign today than a perfect one next quarter. Always happy to trade notes on lifecycle marketing over a good coffee.',
        followers: 1893,
        connections: 312,
        degree: '3rd',
        premium: false,
        linkedinTier: 'free',
        experience: [
          {
            company: 'Kettle & Co',
            role: 'Marketing Lead',
            start: '2021',
            end: 'Present',
            location: 'Vienna, Austria',
            description:
              'Own the full marketing mix for a fast growing D2C brand. Doubled repeat purchase rate by rebuilding the lifecycle email program from the ground up.',
          },
          {
            company: 'Studio Hause',
            role: 'Senior Marketing Manager',
            start: '2018',
            end: '2021',
            location: 'Vienna, Austria',
            description:
              'Led brand and performance marketing for a portfolio of consumer clients across DACH.',
          },
          {
            company: 'Brightside Agency',
            role: 'Account Manager',
            start: '2016',
            end: '2018',
            location: 'Munich, Germany',
          },
        ],
        education: [
          {
            school: 'Vienna University of Economics and Business',
            degree: 'MSc, Marketing',
            start: '2014',
            end: '2016',
          },
          {
            school: 'University of Vienna',
            degree: 'BA, Communication Science',
            start: '2011',
            end: '2014',
          },
        ],
        skills: [
          'Lifecycle Marketing',
          'Email Marketing',
          'D2C',
          'Retention',
          'Brand Strategy',
          'Content Marketing',
          'Performance Marketing',
        ],
        posts: [
          {
            id: 'p-hannah-c1',
            kind: 'comment',
            authorName: 'Ava Thompson',
            authorHeadline: 'Head of Lifecycle at Loomly',
            authorAvatarUrl: 'https://i.pravatar.cc/120?img=20',
            timeAgo: '2d',
            text: 'Acquisition gets the budget and the applause, but retention quietly pays the bills. The brands that win in D2C this year are the ones who treat the second order like it matters more than the first.',
            likes: 203,
            comments: 27,
            reposts: 14,
            activityComment: 'The post purchase moment is the single highest leverage email we send. Nail that one flow and everything downstream gets easier.',
          },
          {
            id: 'p-hannah-c2',
            kind: 'comment',
            authorName: 'Noah Klein',
            authorHeadline: 'Creative Director at Field Studio',
            authorAvatarUrl: 'https://i.pravatar.cc/120?img=14',
            timeAgo: '5d',
            text: 'A campaign that ships today and learns something beats a flawless one that ships next quarter. Speed is a creative advantage, not a compromise. Stop polishing in private.',
            likes: 158,
            comments: 19,
            reposts: 8,
            activityComment: 'Yes. We ship a little messy and fix in public, and our best ideas all started as something we were almost embarrassed to send.',
          },
          {
            id: 'p-hannah-r1',
            kind: 'reaction',
            activityReaction: 'love',
            authorName: 'Lukas Berger',
            authorHeadline: 'Founder at Kettle & Co',
            authorAvatarUrl: 'https://i.pravatar.cc/120?img=51',
            timeAgo: '3d',
            text: 'Our subscriber community just crossed ten thousand members, and most of them came from word of mouth, not ads. Build something people want to tell their friends about and growth takes care of itself.',
            imageUrl: 'https://i.pravatar.cc/600?img=64',
            likes: 246,
            comments: 31,
            reposts: 18,
          },
          {
            id: 'p-hannah-r2',
            kind: 'reaction',
            activityReaction: 'celebrate',
            authorName: 'Mia Rossi',
            authorHeadline: 'Growth Lead at Verdant',
            authorAvatarUrl: 'https://i.pravatar.cc/120?img=32',
            timeAgo: '1w',
            text: 'After two years of building, our little brand just hit profitability without raising a cent. Slow, deliberate and ours. Grateful for every customer who came back.',
            likes: 312,
            comments: 40,
            reposts: 22,
          },
          {
            id: 'p-hannah-rp1',
            kind: 'repost',
            authorName: 'Camille Laurent',
            authorHeadline: 'Head of Brand at Maisonette',
            authorAvatarUrl: 'https://i.pravatar.cc/120?img=26',
            timeAgo: '3d',
            text: 'Stop treating your email list like a megaphone and start treating it like a relationship. The brands people actually open send fewer, better messages that sound like a person wrote them. We cut our send frequency in half and revenue per subscriber went up. Restraint is a growth strategy.',
            likes: 274,
            comments: 35,
            reposts: 21,
            activityComment: 'This is exactly how we rebuilt our lifecycle program. Fewer sends, every one earning its place in the inbox. Our unsubscribe rate dropped and revenue climbed. Reposting for every marketer still measuring success by volume.',
          },
          {
            id: 'p-hannah-rp2',
            kind: 'repost',
            authorName: 'Oscar Lindgren',
            authorHeadline: 'Founder at Northbloom',
            authorAvatarUrl: 'https://i.pravatar.cc/120?img=60',
            timeAgo: '1w',
            text: 'The unboxing moment is the most underused marketing channel in D2C. You already have their attention and their goodwill. A single thoughtful insert card outperforms most of our paid retargeting. Spend less on ads and more on the first thirty seconds after the box opens.',
            imageUrl: 'https://i.pravatar.cc/600?img=33',
            likes: 198,
            comments: 19,
            reposts: 12,
          },
          {
            id: 'p-hannah-1',
            authorName: 'Hannah Müller',
            authorHeadline: 'Marketing Lead at Kettle & Co',
            authorAvatarUrl: 'https://i.pravatar.cc/120?img=49',
            timeAgo: '4d',
            text: 'Retention is the most underrated growth lever in D2C. Everyone obsesses over the first purchase, but the second one is where the margin lives. We rebuilt our whole lifecycle program around the moment right after someone unboxes their first order, and that single flow now drives more revenue than any acquisition channel we run. Stop pouring budget into the top of the funnel and go fix the leaky bottom first.',
            likes: 176,
            comments: 24,
            reposts: 13,
            usedByAI: true,
          },
          {
            id: 'p-hannah-2',
            authorName: 'Hannah Müller',
            authorHeadline: 'Marketing Lead at Kettle & Co',
            authorAvatarUrl: 'https://i.pravatar.cc/120?img=49',
            timeAgo: '1w',
            text: 'Doubled our repeat purchase rate this year. Small team, big proud moment.',
            imageUrl: 'https://i.pravatar.cc/600?img=49',
            likes: 142,
            comments: 18,
            reposts: 4,
          },
          {
            id: 'p-hannah-3',
            authorName: 'Kettle & Co',
            authorHeadline: 'Thoughtfully made goods, shipped from Vienna',
            timeAgo: '2w',
            text: 'New seasonal collection drops Friday. Subscribers get early access, because loyalty should feel like a perk and not an afterthought.',
            likes: 89,
            comments: 7,
            reposts: 5,
          },
          {
            id: 'p-hannah-4',
            authorName: 'Hannah Müller',
            authorHeadline: 'Marketing Lead at Kettle & Co',
            authorAvatarUrl: 'https://i.pravatar.cc/120?img=49',
            timeAgo: '3w',
            text: 'A scrappy campaign that ships today beats a perfect one that ships next quarter. I have watched too many great ideas die in approval cycles. Small teams win by moving, learning and fixing in public. Give your marketers room to be a little messy and you will be amazed what they pull off.',
            likes: 211,
            comments: 29,
            reposts: 17,
          },
          {
            id: 'p-hannah-5',
            authorName: 'Lukas Berger',
            authorHeadline: 'Founder at Kettle & Co',
            authorAvatarUrl: 'https://i.pravatar.cc/120?img=51',
            timeAgo: '1mo',
            text: 'Hannah turned our marketing from a cost center into our best growth engine. Reposting because every founder deserves a marketing lead like this.',
            likes: 97,
            comments: 11,
            reposts: 8,
          },
          {
            id: 'p-hannah-6',
            authorName: 'Hannah Müller',
            authorHeadline: 'Marketing Lead at Kettle & Co',
            authorAvatarUrl: 'https://i.pravatar.cc/120?img=49',
            timeAgo: '1mo',
            text: 'Spent today writing win back emails. The trick is to sound like a person who noticed you left, not a brand running a discount script.',
            likes: 134,
            comments: 16,
            reposts: 6,
          },
          {
            id: 'p-hannah-7',
            authorName: 'Hannah Müller',
            authorHeadline: 'Marketing Lead at Kettle & Co',
            authorAvatarUrl: 'https://i.pravatar.cc/120?img=49',
            timeAgo: '2mo',
            text: 'Looking at tools to help us scale outreach without losing the personal touch that makes our brand work. The bar is high. If it sounds robotic, it is out.',
            likes: 78,
            comments: 9,
            reposts: 2,
          },
          {
            id: 'p-hannah-8',
            authorName: 'Hannah Müller',
            authorHeadline: 'Marketing Lead at Kettle & Co',
            authorAvatarUrl: 'https://i.pravatar.cc/120?img=49',
            timeAgo: '3mo',
            text: 'Coffee, a quiet office and a clean campaign calendar. Some mornings are just good.',
            imageUrl: 'https://i.pravatar.cc/600?img=30',
            likes: 121,
            comments: 13,
            reposts: 3,
          },
        ],
      },
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

// ─── Engagement → people (mock) ───────────────────────────────────
// When the user taps a post's likes / comments / reposts count, we show the
// people who engaged. In production these come from Unipile (list post
// reactions / comments / reposters) and are collected as leads in the
// background. Here we derive a deterministic, realistic set per post from a
// shared pool so the same post always shows the same people.

const ENGAGER_POOL: { name: string; headline: string; img: number }[] = [
  { name: 'Lucas Meijer', headline: 'VP Sales at Northbeam', img: 12 },
  { name: 'Sophie Bakker', headline: 'Head of Demand Gen at Loopline', img: 5 },
  { name: 'Daniel Okafor', headline: 'VP Sales at Brightloop', img: 13 },
  { name: 'Marta Kowalski', headline: 'SDR Lead at Cadence', img: 9 },
  { name: 'Tom Visser', headline: 'Founder at Replyloop', img: 33 },
  { name: 'Aisha Rahman', headline: 'RevOps Manager at Flowstate', img: 16 },
  { name: 'Karl Jensen', headline: 'CRO at Brightpath', img: 52 },
  { name: 'Elena Rossi', headline: 'Growth Lead at Mavenly', img: 20 },
  { name: 'James Park', headline: 'Account Executive at Northwave Labs', img: 8 },
  { name: 'Nadia Haddad', headline: 'Marketing Director at Kettle and Co', img: 25 },
  { name: 'Pieter de Groot', headline: 'Sales Manager at Cadence', img: 60 },
  { name: 'Yuki Tanaka', headline: 'Demand Gen at Brightloop', img: 41 },
  { name: 'Olivia Chen', headline: 'Head of Outbound at Loopline', img: 47 },
  { name: 'Ben Carter', headline: 'BDR at Flowstate', img: 11 },
  { name: 'Fatima Said', headline: 'VP Marketing at Mavenly', img: 31 },
  { name: 'Hugo Lambert', headline: 'CEO at Northbeam', img: 3 },
];

const REACTION_CYCLE: LinkedInReactionKind[] = [
  'like', 'insightful', 'like', 'celebrate', 'like', 'support', 'insightful', 'love', 'like', 'funny',
];

const SAMPLE_COMMENTS = [
  'This is exactly the shift we made last quarter. Spot on.',
  'Saving this. The point about relevance over volume is underrated.',
  'Completely agree. We saw the same lift when we cut account counts.',
  'Great breakdown. Sharing this with my team today.',
  'This matches what we are seeing in our pipeline data too.',
  'Needed to read this. Reply quality is everything right now.',
];

function hashId(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

/** Deterministic list of engagers for a given post + engagement kind. The
 *  length is capped to the post's real count (likes/comments/reposts) so the
 *  list reads consistently with the number shown on the card. */
export function engagersFor(
  post: LinkedInPost,
  kind: 'reactions' | 'comments' | 'reposts',
): LinkedInEngager[] {
  const count =
    kind === 'reactions' ? post.likes ?? 0 : kind === 'comments' ? post.comments ?? 0 : post.reposts ?? 0;
  if (count <= 0) return [];
  // Show up to a sensible page of people (the rest exist but are not all listed).
  const shown = Math.min(count, 24);
  const base = hashId(post.id + kind);
  const out: LinkedInEngager[] = [];
  for (let i = 0; i < shown; i++) {
    const p = ENGAGER_POOL[(base + i * 7) % ENGAGER_POOL.length];
    const e: LinkedInEngager = {
      id: `${post.id}-${kind}-${i}`,
      name: p.name,
      headline: p.headline,
      avatarUrl: `https://i.pravatar.cc/120?img=${p.img}`,
    };
    if (kind === 'reactions') e.reaction = REACTION_CYCLE[(base + i) % REACTION_CYCLE.length];
    if (kind === 'comments') e.comment = SAMPLE_COMMENTS[(base + i) % SAMPLE_COMMENTS.length];
    out.push(e);
  }
  return out;
}
