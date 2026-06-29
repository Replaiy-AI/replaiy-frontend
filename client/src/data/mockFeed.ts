// ─────────────────────────────────────────────────────────────────
// Deterministic LinkedIn FEED dataset.
//
// A believable single vertical stream of posts from a MIX of people: the same
// ENGAGER_POOL names/headlines used for the engagers list (so the world stays
// consistent) plus the three leads (Emma Chen / Jan de Vries / Hannah Müller).
// Reuses the existing LinkedInPost interface so every post renders with the
// SAME shared PostCard + clickable-engagement machinery as the profile view;
// the clickable counts work automatically via engagersFor(post, kind).
//
// Two feed modes consume this:
//   • "LinkedIn" mode  — the FULL unfiltered stream (familiar, with noise).
//   • "Replaiy" mode    — ONLY the ICP-relevant posts (those with
//     relevanceReason), each showing a quiet relevance chip.
//
// Variety: plain posts, a quote repost, a couple with images (reusing image
// URLs already present in the mock posts), realistic engagement counts.
// ─────────────────────────────────────────────────────────────────
import type { LinkedInPost } from './mockConversations';

// Reused image URLs (already used elsewhere in the mock posts).
const IMG_A = 'https://i.pravatar.cc/600?img=20';
const IMG_B = 'https://i.pravatar.cc/600?img=33';
const IMG_C = 'https://i.pravatar.cc/600?img=47';

export const FEED_POSTS: LinkedInPost[] = [
  // 1 — ICP-relevant lead post (Emma Chen, an actual lead).
  {
    id: 'feed-1',
    kind: 'post',
    authorName: 'Emma Chen',
    authorHeadline: 'Head of Growth at Loopline',
    authorAvatarUrl: 'https://i.pravatar.cc/120?img=47',
    timeAgo: '2h',
    text: 'We stopped measuring outbound by volume this quarter and started measuring it by replies that turn into real conversations. The team hated it for two weeks. Then the pipeline got healthier than it has been all year.',
    likes: 218,
    comments: 34,
    reposts: 12,
    relevanceReason: 'Posted by a lead in your pipeline',
  },
  // 2 — plain noise post (not ICP relevant).
  {
    id: 'feed-2',
    kind: 'post',
    authorName: 'Hugo Lambert',
    authorHeadline: 'CEO at Northbeam',
    authorAvatarUrl: 'https://i.pravatar.cc/120?img=3',
    timeAgo: '3h',
    text: 'Grateful to the whole team for an incredible offsite this week. Five years in and the energy is better than day one.',
    imageUrl: IMG_A,
    likes: 642,
    comments: 51,
    reposts: 7,
  },
  // 3 — ICP-relevant (matches ICP, has an image).
  {
    id: 'feed-3',
    kind: 'post',
    authorName: 'Sophie Bakker',
    authorHeadline: 'Head of Demand Gen at Loopline',
    authorAvatarUrl: 'https://i.pravatar.cc/120?img=5',
    timeAgo: '5h',
    text: 'Three things that quietly killed our reply rates last year, and what we changed:\n\n1. Too many accounts, too little context.\n2. Sequences that read like sequences.\n3. No clear next step in the first message.\n\nFixing the third one alone moved our reply rate more than any subject-line test ever did.',
    imageUrl: IMG_B,
    likes: 487,
    comments: 63,
    reposts: 28,
    relevanceReason: 'Matches your ICP',
  },
  // 4 — quote repost (Jan de Vries reshares with his own commentary).
  {
    id: 'feed-4',
    kind: 'repost',
    authorName: 'Daniel Okafor',
    authorHeadline: 'VP Sales at Brightloop',
    authorAvatarUrl: 'https://i.pravatar.cc/120?img=13',
    timeAgo: '7h',
    text: 'The best sales teams I know spend more time picking who to talk to than what to say. Targeting is the message.',
    activityComment: 'This is the whole game. We rebuilt our entire motion around it this year and never looked back.',
    likes: 156,
    comments: 19,
    reposts: 9,
    relevanceReason: 'Posted by a 2nd-degree lead',
  },
  // 5 — noise post.
  {
    id: 'feed-5',
    kind: 'post',
    authorName: 'Nadia Haddad',
    authorHeadline: 'Marketing Director at Kettle and Co',
    authorAvatarUrl: 'https://i.pravatar.cc/120?img=25',
    timeAgo: '9h',
    text: 'Reminder that your brand is what people say about you when you are not in the room. Spend accordingly.',
    likes: 203,
    comments: 14,
    reposts: 5,
  },
  // 6 — ICP-relevant (lead, Jan de Vries).
  {
    id: 'feed-6',
    kind: 'post',
    authorName: 'Jan de Vries',
    authorHeadline: 'Founder at Cadence',
    authorAvatarUrl: 'https://i.pravatar.cc/120?img=12',
    timeAgo: '11h',
    text: 'We just hired our third SDR and the first thing we changed was the definition of a good day. It is no longer 80 touches. It is 5 conversations that should not have been so easy to start.',
    likes: 341,
    comments: 47,
    reposts: 16,
    relevanceReason: 'Posted by a lead in your pipeline',
  },
  // 7 — noise post with image.
  {
    id: 'feed-7',
    kind: 'post',
    authorName: 'Karl Jensen',
    authorHeadline: 'CRO at Brightpath',
    authorAvatarUrl: 'https://i.pravatar.cc/120?img=52',
    timeAgo: '13h',
    text: 'Closed out the quarter at 112 percent of plan. Proud of this team and the way they show up for each other.',
    imageUrl: IMG_C,
    likes: 894,
    comments: 72,
    reposts: 11,
  },
  // 8 — ICP-relevant (matches ICP).
  {
    id: 'feed-8',
    kind: 'post',
    authorName: 'Aisha Rahman',
    authorHeadline: 'RevOps Manager at Flowstate',
    authorAvatarUrl: 'https://i.pravatar.cc/120?img=16',
    timeAgo: '15h',
    text: 'Engagement is intent. If someone reacts to a post about your exact problem, that is a warmer signal than any cold list you bought. We started routing those people to sales the same day.',
    likes: 372,
    comments: 41,
    reposts: 22,
    relevanceReason: 'Matches your ICP',
  },
  // 9 — noise post.
  {
    id: 'feed-9',
    kind: 'post',
    authorName: 'Olivia Chen',
    authorHeadline: 'Head of Outbound at Loopline',
    authorAvatarUrl: 'https://i.pravatar.cc/120?img=47',
    timeAgo: '17h',
    text: 'Hot take: most "personalization" is just a mail merge with extra steps. Real personalization means you actually read the thing before you reached out.',
    likes: 528,
    comments: 88,
    reposts: 34,
    relevanceReason: 'Matches your ICP',
  },
  // 10 — noise post (celebration).
  {
    id: 'feed-10',
    kind: 'post',
    authorName: 'Fatima Said',
    authorHeadline: 'VP Marketing at Mavenly',
    authorAvatarUrl: 'https://i.pravatar.cc/120?img=31',
    timeAgo: '19h',
    text: 'So happy to share that I am starting a new role next month. Grateful for everyone who made the last chapter unforgettable.',
    likes: 1203,
    comments: 156,
    reposts: 4,
  },
  // 11 — ICP-relevant (2nd-degree lead).
  {
    id: 'feed-11',
    kind: 'post',
    authorName: 'Lucas Meijer',
    authorHeadline: 'VP Sales at Northbeam',
    authorAvatarUrl: 'https://i.pravatar.cc/120?img=12',
    timeAgo: '21h',
    text: 'We cut our target account list from 600 to 90 and our win rate went up. Fewer, better conversations beats more, worse ones every single time.',
    likes: 415,
    comments: 52,
    reposts: 19,
    relevanceReason: 'Posted by a 2nd-degree lead',
  },
  // 12 — plain reshare (no added comment).
  {
    id: 'feed-12',
    kind: 'repost',
    authorName: 'Hannah Müller',
    authorHeadline: 'Sales Lead at Brightloop',
    authorAvatarUrl: 'https://i.pravatar.cc/120?img=44',
    timeAgo: '22h',
    text: 'Your follow-up is not annoying if it is useful. Send the thing they actually needed, not another "just checking in".',
    likes: 267,
    comments: 23,
    reposts: 14,
    relevanceReason: 'Posted by a lead in your pipeline',
  },
  // 13 — noise post.
  {
    id: 'feed-13',
    kind: 'post',
    authorName: 'James Park',
    authorHeadline: 'Account Executive at Northwave Labs',
    authorAvatarUrl: 'https://i.pravatar.cc/120?img=8',
    timeAgo: '1d',
    text: 'Friendly reminder that a discovery call is not an interrogation. Ask fewer questions and listen to the answers.',
    likes: 184,
    comments: 17,
    reposts: 3,
  },
  // 14 — ICP-relevant (matches ICP).
  {
    id: 'feed-14',
    kind: 'post',
    authorName: 'Elena Rossi',
    authorHeadline: 'Growth Lead at Mavenly',
    authorAvatarUrl: 'https://i.pravatar.cc/120?img=20',
    timeAgo: '1d',
    text: 'The fastest path to more pipeline is usually not more leads. It is replying faster to the ones already raising their hand. Speed is a strategy.',
    likes: 309,
    comments: 38,
    reposts: 17,
    relevanceReason: 'Matches your ICP',
  },
  // 15 — noise post.
  {
    id: 'feed-15',
    kind: 'post',
    authorName: 'Tom Visser',
    authorHeadline: 'Founder at Replyloop',
    authorAvatarUrl: 'https://i.pravatar.cc/120?img=33',
    timeAgo: '1d',
    text: 'Building in public update: shipped four things this week, broke two of them, fixed both before lunch. Onward.',
    likes: 142,
    comments: 11,
    reposts: 2,
  },
  // 16 — ICP-relevant (2nd-degree lead, with image).
  {
    id: 'feed-16',
    kind: 'post',
    authorName: 'Marta Kowalski',
    authorHeadline: 'SDR Lead at Cadence',
    authorAvatarUrl: 'https://i.pravatar.cc/120?img=9',
    timeAgo: '2d',
    text: 'Our best month ever did not come from a new tool. It came from one rule: every rep reads the prospect\u2019s last three posts before reaching out. That is it.',
    imageUrl: IMG_A,
    likes: 521,
    comments: 67,
    reposts: 31,
    relevanceReason: 'Posted by a 2nd-degree lead',
  },
];

/** Posts shown in the Feed's "Replaiy" mode: only the ICP-relevant subset (the
 *  posts that carry a relevanceReason), so the user sees signal without noise.
 *  The "LinkedIn" mode shows FEED_POSTS unfiltered. */
export const REPLAIY_FEED_POSTS: LinkedInPost[] = FEED_POSTS.filter(
  (p) => !!p.relevanceReason,
);
