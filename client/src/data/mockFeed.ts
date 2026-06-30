// ─────────────────────────────────────────────────────────────────
// Deterministic LinkedIn FEED dataset.
//
// A believable single vertical stream that mirrors a REAL LinkedIn feed: not
// just plain posts, but the full mix of activity types that surface when people
// in your network engage —
//   • plain posts          (kind 'post')
//   • quote reposts         (kind 'repost' WITH activityComment)
//   • plain reshares        (kind 'repost' WITHOUT activityComment)
//   • comments              (kind 'comment', activityComment = the actor's reply)
//   • reactions             (kind 'reaction', activityReaction = the actor's reaction)
//
// For every NON-plain item the author* fields describe the ORIGINAL post (by
// someone else) and the actor* fields describe the PERSON who engaged (reposted
// / commented / reacted). The feed passes the actor* fields to the shared
// ActivityItem as the per-item actor, so the attribution reads "[Actor] reposted
// [Author]'s post", "[Actor] commented on [Author]'s post", etc.
//
// People are drawn from the same ENGAGER_POOL names/headlines used elsewhere
// (so the world stays consistent) plus the three pipeline leads
// (Emma Chen / Jan de Vries / Hannah Müller). Engagement BY a lead or an
// ICP-relevant person is the strongest intent signal, so those carry a
// relevanceReason that drives the Replaiy-mode intent chip.
//
// Two feed modes consume this (see Feed.tsx):
//   • "LinkedIn" mode  — the FULL unfiltered stream in natural order (with noise).
//   • "Replaiy" mode    — engagement-by-pipeline/ICP prioritized to the top,
//     then ICP posts, with non-relevant noise dropped; each shown item carries
//     a quiet intent chip (relevanceReason).
// ─────────────────────────────────────────────────────────────────
import type { LinkedInPost } from './mockConversations';

// Reused image URLs (already used elsewhere in the mock posts).
const IMG_A = 'https://i.pravatar.cc/600?img=20';
const IMG_B = 'https://i.pravatar.cc/600?img=33';
const IMG_C = 'https://i.pravatar.cc/600?img=47';

// Reliable public sample mp4 + a poster thumbnail (reusing a pravatar-style
// URL already used across the mock posts) for the inline-video post type.
const SAMPLE_VIDEO =
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
const VIDEO_POSTER = 'https://picsum.photos/seed/replaiyvideo/800/450';

// The three pipeline leads (kept consistent with their inbox profiles).
const EMMA = {
  name: 'Emma Chen',
  headline: 'Head of Growth at Loopline',
  avatar: 'https://i.pravatar.cc/120?img=47',
};
const JAN = {
  name: 'Jan de Vries',
  headline: 'Founder at Cadence',
  avatar: 'https://i.pravatar.cc/120?img=12',
};
const HANNAH = {
  name: 'Hannah Müller',
  headline: 'Sales Lead at Brightloop',
  avatar: 'https://i.pravatar.cc/120?img=49',
};

export const FEED_POSTS: LinkedInPost[] = [
  // 1 — REACTION by a pipeline lead (Emma) on an ICP-topic post. Strongest
  // intent signal: a lead reacted to a post about exactly our problem.
  {
    id: 'feed-1',
    kind: 'reaction',
    actorName: EMMA.name,
    actorHeadline: EMMA.headline,
    actorAvatarUrl: EMMA.avatar,
    activityReaction: 'insightful',
    authorName: 'Aisha Rahman',
    authorHeadline: 'RevOps Manager at Flowstate',
    authorAvatarUrl: 'https://i.pravatar.cc/120?img=16',
    timeAgo: '2h',
    text: 'Engagement is intent. If someone reacts to a post about your exact problem, that is a warmer signal than any cold list you bought. We started routing those people to sales the same day.',
    likes: 372,
    comments: 41,
    reposts: 22,
    relevanceReason: 'Reacted to a post about outbound',
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
  // 3 — COMMENT by a pipeline lead (Jan) on someone's post. The lead is in our
  // pipeline and actively engaging.
  {
    id: 'feed-3',
    kind: 'comment',
    actorName: JAN.name,
    actorHeadline: JAN.headline,
    actorAvatarUrl: JAN.avatar,
    activityComment: 'This is exactly the shift we made last quarter. Counting conversations instead of touches changed how the whole team thinks about a good day.',
    authorName: 'Sophie Bakker',
    authorHeadline: 'Head of Demand Gen at Loopline',
    authorAvatarUrl: 'https://i.pravatar.cc/120?img=5',
    timeAgo: '4h',
    text: 'Three things that quietly killed our reply rates last year, and what we changed:\n\n1. Too many accounts, too little context.\n2. Sequences that read like sequences.\n3. No clear next step in the first message.\n\nFixing the third one alone moved our reply rate more than any subject-line test ever did.',
    imageUrl: IMG_B,
    likes: 487,
    comments: 63,
    reposts: 28,
    relevanceReason: 'Commented, and in your pipeline',
  },
  // 4 — plain ICP post (matches our ideal customer profile).
  {
    id: 'feed-4',
    kind: 'post',
    authorName: 'Aisha Rahman',
    authorHeadline: 'RevOps Manager at Flowstate',
    authorAvatarUrl: 'https://i.pravatar.cc/120?img=16',
    timeAgo: '5h',
    text: 'The fastest path to more pipeline is usually not more leads. It is replying faster to the ones already raising their hand. Speed is a strategy.',
    linkPreview: {
      url: 'https://blog.replaiy.com/speed-to-lead',
      title: 'Speed to lead: why replying first wins more deals than any cold list',
      domain: 'blog.replaiy.com',
      imageUrl: IMG_C,
    },
    likes: 309,
    comments: 38,
    reposts: 17,
    relevanceReason: 'Matches your ideal customer profile',
  },
  // 5 — QUOTE repost by a pipeline lead (Hannah): she reshared with her own
  // commentary. Engagement by a lead = intent.
  {
    id: 'feed-5',
    kind: 'repost',
    actorName: HANNAH.name,
    actorHeadline: HANNAH.headline,
    actorAvatarUrl: HANNAH.avatar,
    activityComment: 'This is the whole game. We rebuilt our entire motion around it this year and never looked back.',
    authorName: 'Daniel Okafor',
    authorHeadline: 'VP Sales at Brightloop',
    authorAvatarUrl: 'https://i.pravatar.cc/120?img=13',
    timeAgo: '6h',
    text: 'The best sales teams I know spend more time picking who to talk to than what to say. Targeting is the message.',
    likes: 156,
    comments: 19,
    reposts: 9,
    relevanceReason: 'Reposted by a lead in your pipeline',
  },
  // 6 — noise post.
  {
    id: 'feed-6',
    kind: 'post',
    authorName: 'Nadia Haddad',
    authorHeadline: 'Marketing Director at Kettle and Co',
    authorAvatarUrl: 'https://i.pravatar.cc/120?img=25',
    timeAgo: '7h',
    text: 'Reminder that your brand is what people say about you when you are not in the room. Spend accordingly.',
    likes: 203,
    comments: 14,
    reposts: 5,
  },
  // 7 — plain ICP post (lead, Emma Chen, with an image).
  {
    id: 'feed-7',
    kind: 'post',
    authorName: EMMA.name,
    authorHeadline: EMMA.headline,
    authorAvatarUrl: EMMA.avatar,
    timeAgo: '8h',
    text: 'We stopped measuring outbound by volume this quarter and started measuring it by replies that turn into real conversations. The team hated it for two weeks. Then the pipeline got healthier than it has been all year.',
    videoUrl: SAMPLE_VIDEO,
    videoPosterUrl: VIDEO_POSTER,
    likes: 218,
    comments: 34,
    reposts: 12,
    relevanceReason: 'Posted by a lead in your pipeline',
  },
  // 8 — REACTION by an ICP-relevant person (Sophie, demand gen at a target
  // account) on a relevant post.
  {
    id: 'feed-8',
    kind: 'reaction',
    actorName: 'Sophie Bakker',
    actorHeadline: 'Head of Demand Gen at Loopline',
    actorAvatarUrl: 'https://i.pravatar.cc/120?img=5',
    activityReaction: 'celebrate',
    authorName: 'Elena Rossi',
    authorHeadline: 'Growth Lead at Mavenly',
    authorAvatarUrl: 'https://i.pravatar.cc/120?img=20',
    timeAgo: '9h',
    text: 'We cut our target account list from 600 to 90 and our win rate went up. Fewer, better conversations beats more, worse ones every single time.',
    likes: 415,
    comments: 52,
    reposts: 19,
    relevanceReason: 'Reacted, and matches your ICP',
  },
  // 9 — noise post with image.
  {
    id: 'feed-9',
    kind: 'post',
    authorName: 'Karl Jensen',
    authorHeadline: 'CRO at Brightpath',
    authorAvatarUrl: 'https://i.pravatar.cc/120?img=52',
    timeAgo: '11h',
    text: 'Closed out the quarter at 112 percent of plan. Proud of this team and the way they show up for each other.',
    imageUrl: IMG_C,
    likes: 894,
    comments: 72,
    reposts: 11,
  },
  // 10 — plain ICP post (lead, Jan de Vries).
  {
    id: 'feed-10',
    kind: 'post',
    authorName: JAN.name,
    authorHeadline: JAN.headline,
    authorAvatarUrl: JAN.avatar,
    timeAgo: '13h',
    text: 'We just hired our third SDR and the first thing we changed was the definition of a good day. It is no longer 80 touches. It is 5 conversations that should not have been so easy to start.',
    likes: 341,
    comments: 47,
    reposts: 16,
    relevanceReason: 'Posted by a lead in your pipeline',
  },
  // 11 — PLAIN reshare (no added comment) by an ICP-relevant person.
  {
    id: 'feed-11',
    kind: 'repost',
    actorName: 'Marta Kowalski',
    actorHeadline: 'SDR Lead at Cadence',
    actorAvatarUrl: 'https://i.pravatar.cc/120?img=9',
    authorName: 'Lucas Meijer',
    authorHeadline: 'VP Sales at Northbeam',
    authorAvatarUrl: 'https://i.pravatar.cc/120?img=12',
    timeAgo: '15h',
    text: 'Your follow-up is not annoying if it is useful. Send the thing they actually needed, not another "just checking in".',
    likes: 267,
    comments: 23,
    reposts: 14,
    relevanceReason: 'Reposted by someone who matches your ICP',
  },
  // 12 — noise post (celebration).
  {
    id: 'feed-12',
    kind: 'post',
    authorName: 'Fatima Said',
    authorHeadline: 'VP Marketing at Mavenly',
    authorAvatarUrl: 'https://i.pravatar.cc/120?img=31',
    timeAgo: '17h',
    text: 'So happy to share that I am starting a new role next month. Grateful for everyone who made the last chapter unforgettable.',
    likes: 1203,
    comments: 156,
    reposts: 4,
  },
  // 13 — COMMENT by an ICP-relevant person (Olivia, head of outbound) on a post.
  {
    id: 'feed-13',
    kind: 'comment',
    actorName: 'Olivia Chen',
    actorHeadline: 'Head of Outbound at Loopline',
    actorAvatarUrl: 'https://i.pravatar.cc/120?img=47',
    activityComment: 'Fewer accounts, deeper research, every time. We saw the same lift when we made the territory smaller.',
    authorName: 'Marta Kowalski',
    authorHeadline: 'SDR Lead at Cadence',
    authorAvatarUrl: 'https://i.pravatar.cc/120?img=9',
    timeAgo: '19h',
    text: 'Our best month ever did not come from a new tool. It came from one rule: every rep reads the prospect\u2019s last three posts before reaching out. That is it.',
    imageUrl: IMG_A,
    likes: 521,
    comments: 67,
    reposts: 31,
    relevanceReason: 'Commented, and matches your ICP',
  },
  // 14 — noise post.
  {
    id: 'feed-14',
    kind: 'post',
    authorName: 'James Park',
    authorHeadline: 'Account Executive at Northwave Labs',
    authorAvatarUrl: 'https://i.pravatar.cc/120?img=8',
    timeAgo: '21h',
    text: 'Friendly reminder that a discovery call is not an interrogation. Ask fewer questions and listen to the answers.',
    likes: 184,
    comments: 17,
    reposts: 3,
  },
  // 15 — plain ICP post (matches ICP).
  {
    id: 'feed-15',
    kind: 'post',
    authorName: 'Olivia Chen',
    authorHeadline: 'Head of Outbound at Loopline',
    authorAvatarUrl: 'https://i.pravatar.cc/120?img=47',
    timeAgo: '1d',
    text: 'Hot take: most "personalization" is just a mail merge with extra steps. Real personalization means you actually read the thing before you reached out.',
    likes: 528,
    comments: 88,
    reposts: 34,
    relevanceReason: 'Matches your ideal customer profile',
  },
  // 16 — noise post.
  {
    id: 'feed-16',
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
];

// ─── Replaiy-mode prioritization (frontend mock) ──────────────────
// Real ranking is a backend concern later; here we mock the differentiator:
// engagement-activity by people in the user's pipeline/ICP comes FIRST, then
// ICP posts, and non-relevant noise (no relevanceReason) is DROPPED entirely.
//
// Tiering:
//   tier 0 — engagement items (repost/comment/reaction) that are relevant
//            (carry a relevanceReason): the strongest intent signal, top.
//   tier 1 — relevant plain posts (kind 'post' with a relevanceReason): ICP
//            posts, below the engagement signals.
//   (no tier) — anything without a relevanceReason is noise and is dropped.
// Within a tier the natural feed order is preserved (a stable sort), so it
// still reads as a coherent stream, just reprioritized.
function isEngagement(p: LinkedInPost): boolean {
  const k = p.kind ?? 'post';
  return k === 'repost' || k === 'comment' || k === 'reaction';
}

function replaiyTier(p: LinkedInPost): number {
  if (!p.relevanceReason) return -1; // noise → dropped
  return isEngagement(p) ? 0 : 1;
}

/** Posts shown in the Feed's "Replaiy" mode: relevant items only, with
 *  engagement-by-pipeline/ICP prioritized above ICP posts, noise dropped. The
 *  "LinkedIn" mode shows FEED_POSTS unfiltered in natural order. */
export const REPLAIY_FEED_POSTS: LinkedInPost[] = FEED_POSTS.map((p, i) => ({
  p,
  i,
  tier: replaiyTier(p),
}))
  .filter((x) => x.tier >= 0)
  // Stable sort: by tier first, then original index (preserve natural order).
  .sort((a, b) => a.tier - b.tier || a.i - b.i)
  .map((x) => x.p);
