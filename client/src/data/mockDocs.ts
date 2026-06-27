// ─────────────────────────────────────────────────────────────────
// Mock docs for Stilt v14 — Docs feature
//
// Each doc has Tiptap JSON content + metadata for the right rail.
// ─────────────────────────────────────────────────────────────────
import type { JSONContent } from '@tiptap/react';

export interface MockDoc {
  id: string;
  title: string;
  preview: string;
  content: JSONContent;
  lastEdited: string; // ISO date string
  pinned: boolean;
  tags: string[];
  linkedTo: { type: 'thread' | 'event'; id: string; label: string }[];
  aiSummary: string;
}

// Helpers to build Tiptap JSON quickly
const p = (text: string): JSONContent => ({
  type: 'paragraph',
  content: text ? [{ type: 'text', text }] : undefined,
});
const h = (level: 1 | 2 | 3, text: string): JSONContent => ({
  type: 'heading',
  attrs: { level },
  content: [{ type: 'text', text }],
});
const bullet = (items: string[]): JSONContent => ({
  type: 'bulletList',
  content: items.map((t) => ({
    type: 'listItem',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: t }] }],
  })),
});
const ordered = (items: string[]): JSONContent => ({
  type: 'orderedList',
  content: items.map((t) => ({
    type: 'listItem',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: t }] }],
  })),
});
const todo = (items: { text: string; checked?: boolean }[]): JSONContent => ({
  type: 'taskList',
  content: items.map((it) => ({
    type: 'taskItem',
    attrs: { checked: !!it.checked },
    content: [{ type: 'paragraph', content: [{ type: 'text', text: it.text }] }],
  })),
});
const quote = (text: string): JSONContent => ({
  type: 'blockquote',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});
const code = (text: string): JSONContent => ({
  type: 'codeBlock',
  content: [{ type: 'text', text }],
});
const divider: JSONContent = { type: 'horizontalRule' };

const now = new Date();
const minutesAgo = (n: number) => new Date(now.getTime() - n * 60_000).toISOString();
const hoursAgo = (n: number) => new Date(now.getTime() - n * 3_600_000).toISOString();
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();

export const mockDocs: MockDoc[] = [
  // 1. Q4 Strategy (pinned, linked to Nora)
  {
    id: 'doc-q4-strategy',
    title: 'Q4 Strategy',
    preview: 'Three bets to close the year. Open todos before board prep tomorrow.',
    lastEdited: hoursAgo(2),
    pinned: true,
    tags: ['strategy', 'q4', 'board'],
    linkedTo: [{ type: 'thread', id: 'thread-nora', label: 'Nora Chen · Board prep' }],
    aiSummary:
      'Q4 plan focused on retention, pricing tiers, and one new enterprise pilot. Three open todos before the board meeting.',
    content: {
      type: 'doc',
      content: [
        p(
          'Three bets to close the year strong. Each bet has a clear owner and a measurable outcome. We will review progress weekly with the team and report up to the board at the end of October.'
        ),
        h(2, 'The bets'),
        ordered([
          'Push retention from 89% to 92% by shipping the in-app onboarding revamp.',
          'Launch the pro pricing tier with annual billing in early November.',
          'Sign one enterprise pilot with a Fortune 500 customer.',
        ]),
        h(2, 'Open todos before board prep'),
        todo([
          { text: 'Draft the retention dashboard with finance', checked: true },
          { text: 'Lock the pro tier feature list with product', checked: false },
          { text: 'Confirm pilot scope with Nora before Friday', checked: false },
        ]),
        h(2, 'Reminder from Nora'),
        quote(
          'The board cares about the path to $10M ARR more than the individual feature work. Show them the bridge.'
        ),
        p(
          'I want every section of the deck to ladder back to that bridge. If a slide does not, cut it.'
        ),
      ],
    },
  },

  // 2. Marcus onboarding feedback (linked to Marcus thread)
  {
    id: 'doc-marcus-onboarding',
    title: 'Marcus onboarding feedback',
    preview: 'Notes from the Monday call with Marcus. Filed under onboarding.',
    lastEdited: daysAgo(1),
    pinned: false,
    tags: ['onboarding', 'customer-feedback'],
    linkedTo: [{ type: 'thread', id: 'thread-marcus', label: 'Marcus Webb · Pilot feedback' }],
    aiSummary:
      'Marcus says the first-run experience is too dense; he suggests progressive disclosure and a clearer second step.',
    content: {
      type: 'doc',
      content: [
        p(
          'Marcus walked me through his first hour with Stilt. He understood the inbox immediately but bounced off the calendar onboarding step.'
        ),
        h(3, 'What worked'),
        bullet([
          'The smart inbox toggle was discovered in under 10 seconds.',
          'Swipe gestures felt natural on the mail rows.',
          'He liked the "needs your response" stack — it cleared two real items.',
        ]),
        h(3, 'What needs work'),
        bullet([
          'Calendar onboarding asks for too many permissions up front.',
          'The dots menu was not obvious until I pointed at it.',
        ]),
        quote(
          'I get what you are trying to do, but the first 30 seconds should feel like cleaning, not configuring.'
        ),
        p('We agreed to test a lighter-weight first-run flow next week.'),
      ],
    },
  },

  // 3. Weekly review template (pinned, template)
  {
    id: 'doc-weekly-review',
    title: 'Weekly review template',
    preview: 'Wins, blockers, next week. Use every Friday afternoon.',
    lastEdited: daysAgo(7),
    pinned: true,
    tags: ['template', 'weekly'],
    linkedTo: [],
    aiSummary: 'Reusable weekly review template with Wins / Blockers / Next week sections.',
    content: {
      type: 'doc',
      content: [
        p('Run this every Friday afternoon. Keep it short and honest.'),
        h(2, 'Wins'),
        bullet(['Add a win here', 'Add a win here', 'Add a win here']),
        h(2, 'Blockers'),
        bullet(['Add a blocker here', 'Add a blocker here']),
        h(2, 'Next week'),
        todo([
          { text: 'Top priority for next week', checked: false },
          { text: 'Second priority', checked: false },
          { text: 'Third priority', checked: false },
        ]),
      ],
    },
  },

  // 4. Pricing decision tree (linked to Nora, AI reasoning quotes)
  {
    id: 'doc-pricing-tree',
    title: 'Pricing decision tree',
    preview: 'Working through the pro tier price point. Stilt drafted the tradeoffs.',
    lastEdited: minutesAgo(30),
    pinned: false,
    tags: ['pricing', 'strategy'],
    linkedTo: [{ type: 'thread', id: 'thread-nora', label: 'Nora Chen · Pricing tradeoffs' }],
    aiSummary:
      'Decision tree comparing $19 vs $29 vs $39 monthly pricing with revenue and positioning tradeoffs.',
    content: {
      type: 'doc',
      content: [
        p('We have three plausible price points for the pro tier. Each has a clear tradeoff.'),
        h(2, 'Option A · $19 / month'),
        quote(
          'This is the entry-level price. We capture the largest pool of users but leave roughly 30% of revenue on the table compared to $29.'
        ),
        ordered([
          'Largest top of funnel — best for word-of-mouth growth.',
          'Hardest to expand later without grandfathering pain.',
          'Forces us to be extremely lean on margin.',
        ]),
        h(2, 'Option B · $29 / month'),
        quote(
          'The middle path. Comfortable for prosumers and small teams. This is where every comparable tool has landed.'
        ),
        ordered([
          'Best blended outcome on ARR and conversion in our model.',
          'No clear differentiation on price — competes on product, not cost.',
        ]),
        h(2, 'Option C · $39 / month'),
        quote(
          'Premium signal. Filters for users who already pay for tools and care about quality. Smaller funnel, healthier customers.'
        ),
        ordered([
          'Highest LTV per customer.',
          'Requires the product to feel premium from minute one.',
          'Hardest to A/B test against the others.',
        ]),
        h(2, 'Recommendation'),
        p('Start at $29 with an annual discount that effectively prices to $23. Revisit at 1,000 paying customers.'),
      ],
    },
  },

  // 5. Daily note for today (empty-ish)
  {
    id: 'doc-daily-today',
    title: 'Daily note · May 26',
    preview: 'Start writing…',
    lastEdited: minutesAgo(5),
    pinned: false,
    tags: ['daily'],
    linkedTo: [],
    aiSummary: 'Empty daily note. Start writing to capture today.',
    content: {
      type: 'doc',
      content: [
        h(2, 'Today'),
        bullet(['', '', '']),
      ],
    },
  },

  // 6. Stilt product brief — long, all-blocks demo
  {
    id: 'doc-stilt-brief',
    title: 'Stilt product brief',
    preview: 'The vision, the surfaces, the bet. Internal demo doc.',
    lastEdited: daysAgo(3),
    pinned: false,
    tags: ['product', 'brief'],
    linkedTo: [{ type: 'event', id: 'event-product-review', label: 'Product review · Thursday' }],
    aiSummary:
      'Stilt is an AI-augmented inbox, calendar, and notes app built around the Liquid Glass aesthetic. Three primary surfaces, one consistent language.',
    content: {
      type: 'doc',
      content: [
        p(
          'Stilt is an AI-augmented workspace for people who live in email, calendar, and notes. One app, one language, three surfaces.'
        ),
        h(2, 'The bet'),
        p(
          'Most productivity apps are either too narrow (a great email client and nothing else) or too broad (a generic everything-app that does nothing well). Stilt picks three surfaces — inbox, calendar, docs — and makes them feel like one continuous medium.'
        ),
        quote(
          'The app should feel less like switching tools and more like turning your head to look at a different part of the same desk.'
        ),
        h(2, 'Three surfaces'),
        h(3, 'Inbox'),
        bullet([
          'Smart inbox triages mail by priority and intent.',
          'Three-button reply: Reply, Reply All, Forward.',
          'Drag-to-reschedule, swipe-to-archive, conversation timeline.',
        ]),
        h(3, 'Calendar'),
        bullet([
          'Smart calendar surfaces "needs your response" invites.',
          'Inline RSVP, four view modes (Smart, Day, Week, Month).',
          'Multi-account stacking with per-account visibility.',
        ]),
        h(3, 'Docs'),
        bullet([
          'Block editor with rich text, todos, quotes, code, dividers.',
          'Slash menu, markdown shortcuts, AI assist on selection.',
          'Docs link to threads and events so context follows you.',
        ]),
        h(2, 'Design language'),
        p('One look across all three. We call it Liquid Glass.'),
        ordered([
          'Floating glass elements with their own backdrop blur.',
          'Loose composition — three independent circles per top chrome.',
          'Monochrome icons, purple only for AI-flavoured features.',
          'Generous whitespace, soft shadows, springy motion.',
        ]),
        h(3, 'Reference snippet'),
        code(`<MobileTopChromeShell>
  leftSlot: ••• menu
  togglePill: Smart / All
  rightSlot: search
</MobileTopChromeShell>`),
        divider,
        h(2, 'Open questions'),
        todo([
          { text: 'Do we add a fourth surface for tasks?', checked: false },
          { text: 'How aggressive should AI suggestions be by default?', checked: false },
          { text: 'When do we ship a desktop app?', checked: true },
        ]),
        p('Updated 3 days ago by the founding team. Comments welcome.'),
      ],
    },
  },
];

// Time-ago helper specific to docs (used in lists + right rail)
export function docTimeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.round(ms / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d === 1) return 'yesterday';
  if (d < 7) return `${d}d ago`;
  const w = Math.round(d / 7);
  if (w < 5) return `${w}w ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// AI suggestion cards for the Smart docs view
export interface DocsSuggestion {
  id: string;
  reason: string;
  cta: string;
  targetDocId?: string; // if defined, action navigates to that doc
}

export const docsSuggestions: DocsSuggestion[] = [
  {
    id: 'sug-marcus',
    reason:
      "You have notes from Monday's Marcus meeting that aren't filed — file under 'Onboarding feedback'?",
    cta: 'File',
    targetDocId: 'doc-marcus-onboarding',
  },
  {
    id: 'sug-daily',
    reason: "Daily note for today is empty — start one?",
    cta: 'Start',
    targetDocId: 'doc-daily-today',
  },
  {
    id: 'sug-q4',
    reason: 'Q4 Strategy doc has open todos — review before board prep tomorrow.',
    cta: 'Review',
    targetDocId: 'doc-q4-strategy',
  },
];
