# Campaign model (blueprint)

A campaign defines WHAT the AI does for a specific outreach effort. It pairs with
Persona (who the AI is, per user) and Knowledge (RAG). In the 6-layer AI
architecture, the campaign supplies the "live context" layer (goal, language,
timing) plus the Flow (the outbound sequence) and the Audience (who to reach).

Key principle: a campaign runs on SEATS (users). Each user brings their OWN
persona. The campaign does not pick a persona; it picks people, and each
person's agent runs their part. Two seats in one campaign can use different
personas.

## Sections of the campaign detail

### 1. Audience (per campaign) - the big one
An ICP definition + lead discovery, scoped to THIS campaign (each campaign can
target a different audience).

ICP criteria:
- Job titles, industries, company size, geo/location, seniority.
- Exclusions (competitors, existing customers).

Discovery sources (cold -> warmest; campaign picks any combination):
1. Sales Navigator search via Unipile (cold) - ICP becomes SalesNav filters.
2. Signal-based (warm) - triggers: job change, company growth/event, posted
   about a relevant topic. Find leads when they are warm.
3. Engagement-based (warmest) - people who like/comment on team members' posts,
   checked against ICP.
Plus: manual import (CSV / paste LinkedIn URLs).

Enrichment: per lead via Perplexity Sonar (recent posts, company info,
triggers). One leads table with `source`, `icp_match_score`, enriched data,
dedup on LinkedIn URL.

The 6 agreed enhancements (ALL in scope):
1. ICP match score + threshold - show the score per lead; per-campaign quality
   threshold ("only contact leads with match >= 80%"). Source broad, contact
   the best.
2. Exclusion intelligence (auto-suppress) - automatically exclude anyone already
   in another campaign, already contacted, or already a connection. Prevents
   double/awkward outreach across the team.
3. Source priority = warmth order - contact warmest first (engagement > signal >
   SalesNav). Lifts reply rates.
4. Live audience pool with breakdown - not just "FOUND 680" but a live pool split
   by source/warmth ("420 cold · 180 warm · 80 warmest") + match-score
   distribution. Shows audience QUALITY, not just quantity.
5. ICP templates / clone - start a new campaign's audience from a template or by
   cloning another campaign's ICP. Faster setup, unburdens the user.
6. Self-learning ICP (phase 2 / backend) - tie the reinforcement loop (drafts
   approved/edited, meetings booked) back to the ICP: the system sees which lead
   types actually convert and suggests sharpening the ICP ("leads like these
   convert 3x better, want more?"). Show a subtle "gets smarter as you use it"
   hint in the UI now; full logic later.

### 2. Goal - the "final goal" the AI drives toward
The campaign goal (meeting, demo, reply, intro, custom) chosen per campaign. This
is the destination that makes Persona copy goal-neutral. It is the single source
that tells each seat's agent where to steer. Goal type + concrete definition
(e.g. "Meeting - book a 20-min intro call about reply quality").

### 3. Flow - the outbound sequence (belongs in campaign)
Steps like: Like a recent post (Day 1) -> Connection request (Day 2) -> Message
(on accept) -> Follow-up (+3 days). Render as a vertical TIMELINE (connected
steps), not a flat list. Follow-up behavior (how many nudges, cadence) lives
here, not in Persona (agreed).

### 4. Language (per campaign) - an OPTION
- Default: match the lead's language automatically.
- Option: force a fixed campaign language (e.g. DACH campaign = German). When
  fixed, it filters/warns which seats actually speak that language (ties to the
  Persona "Languages you speak").
Note: which languages a user can speak/hold a meeting in stays in Persona. No
duplication here.

### 5. Send timing - for AUTOMATED actions only
- Optional toggle "Send at sensible local hours".
- Window (workdays, hours) + timezone source: lead's local time from LinkedIn
  location (via Unipile, layer 5 enrichment), with fallback to a fixed zone when
  unknown/unreliable.
- Applies ONLY to automated outbound actions (like, connection request, message,
  follow-up that the system executes). Manual approval = the user picks the
  moment; no guard. Timing is a courtesy/human-ness feature, not a way to hide
  the sender's own location.

### 6. Seats (Running from) - the user->persona link
The users/seats assigned to the campaign. Each seat brings their own persona;
optionally show each seat's persona (mini avatar/label) so you can see which tone
each seat runs this campaign with. This IS the persona link (not a campaign-level
persona picker).

## Design
Match the Persona/Knowledge gold standard exactly: FineTuneSection-style headers
(label + sub), rp-card rounded-3xl, no block-in-block, single blue accent
#2F6BFF, NO em-dashes, all English, APPLE_SPRING. The left campaigns list is
already good; only the right detail is rebuilt.

## Enrichment & commercial model (decided 28 Jun)
- Lead enrichment runs AUTOMATICALLY for everyone (LinkedIn + Perplexity Sonar +
  any internal sources). It is core quality, not a paid add-on. In the FRONTEND
  we show THAT we enrich and WHAT it yields (company data, recent activity,
  signals) but NEVER which providers/sources are used (keeps the sourcing stack a
  black box / moat, and unburdens the user). No "Connect Apollo" or provider
  config in the UI.
- Commercial model: do NOT sell enrichment itself. Monetize on (1) VOLUME/scale
  (how many leads you can source/enrich/contact per month, as plan limits) and
  (2) the self-learning ICP intelligence as a premium layer. Enrichment quality
  is free for all plans because "we make every conversation better" is the core
  promise. (Positioning note for when pricing/plans are built; not UI work now.)

## Audience section additions (round 2)
- Enrichment status card (no sources named) - "Leads are auto-enriched with
  company data, recent activity and signals." Optionally a small per-lead
  "enriched" indicator.
- Live "qualified" count tied to the match-threshold slider ("X of 680 qualify").
- Audience health one-liner ("Strong audience: 80 warmest, 65% above your bar.").
- Subtle compliance hint (rate-limited, respectful, no private-data scraping).
- "View leads" preview button (shows a few enriched sample leads; real logic later).
- New suppress rule "Already in conversation": if a teammate is in an ACTIVE
  conversation with a lead, others can still connect/like/view, but won't start a
  competing conversation. (Softer than "already in another campaign".)
- Make controls mock-interactive: draggable threshold slider with live qualified
  count, upload affordance shows a flow, ICP edit opens editable chips, templates
  show a picker.

## Credits (backend note, NOT in campaign UI) - decided 28 Jun
Sourcing and enrichment consume workspace credits like every other AI action
(per the Credit System: one shared workspace-wide pool, "future features are
taken from the pool", exact per-action cost set by dev based on AI cost). This is
a BACKEND/billing reality only. The campaign detail UI stays 100% clean: NO
credit mentions, NO costs, NO pool balance anywhere in the campaign flow. Credits
live on the billing/payment page and in the terms. Enrichment is ALWAYS ON (no
toggle) and shown only as a quality status card (what it yields, never the
providers, never the cost). Enrichment is a data/quality layer and has nothing to
do with Persona (Persona = voice/behavior/strategy only).

## Contact enrichment (PII: email/phone) - SEPARATE capability, parked 28 Jun
Distinct from conversation-enrichment (which is always-on, free-feeling context:
posts, company, signals). Contact enrichment reveals PII (email, phone) and is:
costly (per-contact, Apollo/waterfall-style), privacy-sensitive (GDPR: needs a
per-lead justification), and NOT needed by everyone (pure LinkedIn outreach does
not need a phone number). So it must be OPT-IN, never default.

Two trigger points (build BOTH, with clear roles):
1. PRIMARY: on-demand at the lead - a "Reveal contact info" action per lead (in
   the inbox / lead detail), Apollo-style. Reveal only what you need. Most
   privacy-safe and credit-efficient. (Lead/inbox surface to be designed.)
2. SECONDARY: opt-in at import/audience - an optional "also fetch contact details"
   checkbox when importing leads or as a campaign setting, for users running
   structured multichannel (LinkedIn + email). Not default.

Conceptually one capability ("reveal contact"), two triggers. Consumes workspace
credits (backend/billing only, never shown as cost in this UI). 

Build order: finish campaign round 2 first (conversation-enrichment status only,
NO contact enrichment). Then a dedicated "Contact enrichment" block: (a) the
audience/import opt-in (small add to the audience section), (b) the lead-level
reveal action at the inbox/lead detail. Do NOT cram into round 2.
