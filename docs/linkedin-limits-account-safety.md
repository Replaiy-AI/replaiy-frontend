# LinkedIn limits & account safety (blueprint)

Critical safety foundation. LinkedIn restricts/blocks accounts that exceed
action limits. Limits are PER LINKEDIN ACCOUNT (per user), not per campaign. A
user can run multiple campaigns; all of them draw from that one account's
budget. So the limit lives at the ACCOUNT level; campaigns respect/draw from it.

## Source of truth = Unipile (our action provider)
We do NOT use automation-blog numbers (commercial, contradictory, guesswork).
LinkedIn does not publish exact limits; they are reputation-based and change. The
only relevant source is Unipile, since that is the API our actions flow through
and the party that sees the real rejections.

### Unipile documented limits (per account per day unless noted)
Source: https://developer.unipile.com/v2.0/docs/provider-limits-and-restrictions (2026-06)

| Action | Free | Premium | Sales Navigator |
|---|---|---|---|
| Connection requests | ~15/week with note, or ~150/week without note | 80-100/day, ~200/week (with note, 300 chars) | same as Premium |
| Profile visits | 80-100/day | 80-100/day | 80 (classic API) / 150 (SalesNav API) /day |
| Company profile fetch | 80/day | 150/day | 150/day |
| Posts fetch | 80-100/day | 80-100/day | - |
| Messages | 100-150/day | 100-150/day | - |
| Comment / reaction (like) | 80-100/day | 80-100/day | - |
| Search results | - | - | 1000/day (2500/day Sales Navigator) |
| Contacts list | batches of 500, ~4 calls/hour | same | same |

Unipile rules:
- Limits are INDEPENDENT and do NOT accumulate (contradicts the blog "shared
  150-action/day budget" claim; trust Unipile here).
- Exceeding -> API error or account disconnect.
- New/inactive accounts: start low, ramp gradually (no exact curve given).
- Accounts with < ~150 connections can send few invitations.
- Space actions ~1 min apart, randomized, across working hours (human emulation).
- Some invitations may not be delivered.

## Account tiers
Free / Premium / Sales Navigator. The biggest practical differences: free is far
more limited on connection requests WITH a note (~15/week), and Sales Navigator
gets higher profile-visit + search ceilings. Premium alone mostly raises trust,
not raw caps. Detect the connected account's tier (via Unipile) to pick the right
ceiling.

## Our recommended DEFAULTS (conservative, well under Unipile max)
Principle: never max the ceiling ("if the cap is 100, send ~70"). Defaults are
deliberately conservative; the user can change them.

Per account per day (fully warmed up):
- Connection requests: Free ~15/week (no-note path) ; Premium/SalesNav ~25/day
- Messages: ~50/day
- Profile visits: ~50/day
- Likes/reactions: ~40/day
(All comfortably below the Unipile ceilings above, leaving a safety buffer.)

## Warm-up curve (new / newly-automated account)
Start at ~30% of the recommended default and ramp to 100% over ~3-4 weeks
(roughly: week1 ~30%, week2 ~55%, week3 ~80%, week4+ 100%). New accounts need a
ramp before automation. Accounts with < ~150 connections start even lower on
invites.

## Configurability (decided 28 Jun)
- Everything is CONFIGURABLE per account, but ships set to OUR conservative
  recommendation by default (advice-as-default).
- The user may raise values FREELY, including toward/over the Unipile max, but a
  clear risk WARNING is shown for values near/above the documented ceiling
  ("Above this, LinkedIn may restrict or disconnect your account.").
- Exact enforcement numbers are dev-tunable (like the credit system), since the
  real limits drift.

## Where it lives (UI)
An "Account safety / Sending limits" surface at the connected LinkedIn ACCOUNT
settings (per user), NOT in the campaign. Shows: tier, where the account is in
its warm-up, today/this-week usage vs the safe cap, acceptance-rate health, and
the editable limits with our defaults + warnings. Campaigns RESPECT this and draw
from the account pool; they do not set it. In the campaign we may show only a
subtle "runs on X account(s)" context.

## How campaigns draw from one account
When multiple campaigns run from one seat/account, they share that account's
daily budget. Prioritize the scarce actions by warmth (warmest leads first, ties
to the audience source-priority). Auto-throttle: if the weekly cap is being
approached, reduce later-day volume (weekly smoothing). Auto-withdraw pending
invites older than ~3 weeks and keep total pending under ~500-700 (a major spam
signal). Track acceptance rate; if it drops, lower volume automatically.

## Build order
This is mostly BACKEND (the real protection = holding actions before the cap,
computing warm-up, counting usage). Blueprint now; the status UI + enforcement
land in/around the backend block. Frontend before backend: contact-enrichment
next, then this account-safety surface with the backend.
