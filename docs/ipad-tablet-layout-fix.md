# iPad / tablet layout fix — spec

## Problem (confirmed by Simon's screenshots + Playwright probe)
The conversation surface has THREE viewport tiers but the breakpoints are mismatched, creating an ugly "dead zone" at **768–1023px (iPad portrait)**:

- Rail (`DesktopRail` = `VerticalRail`): `hidden lg:flex` → only ≥1024
- `MobileTopChrome` (back-arrow on the mascot, search pill): `lg:hidden` → <1024
- `MobileBottomNav`: shows <1024 (tablet)
- List column + detail pane: split at **md (768)** → both show as columns from 768+
- Lead panel: desktop `hidden lg:block` (≥1024); mobile slide-over **overlay with scrim** `lg:hidden` (<1024)

Result at 768–1023 (iPad portrait): desktop-style TWO columns (inbox + conversation side by side) BUT with mobile chrome — back-arrow on the mascot, bottom tab-bar, and the lead panel appears as an ugly **overlay with scrim**. Simon hates the overlay.

At ≥1024 (iPad landscape / desktop) everything is already correct (rail + up to 3 real columns). DO NOT change that — verified good.
At <768 (phone) the mobile pattern (full-screen single column, bottom nav, back-arrow, lead slide-over) is correct. DO NOT change that.

## Goal — Simon's approved direction
1. **iPad = desktop behaviour.** Move the "desktop layout" tier from `lg` (1024) DOWN to `md` (768). So from 768px up: show the rail, NO back-arrow on the mascot, NO bottom tab-bar, NO mobile top-chrome. Phone (<768) keeps the mobile pattern exactly as today.
2. **Lead panel: NEVER an overlay (no scrim) on tablet.** Instead:
   - **≥1280px (lg/xl):** lead panel = real 3rd column (UNCHANGED, already works).
   - **768–1279px (tablet → narrow desktop):** too narrow for 3 comfortable columns, so when the lead panel opens it **REPLACES the inbox column** — inbox animates out, conversation + lead panel show as two real columns. The toolbar toggle swaps back to the inbox. No scrim, no overlay, no stacking.
   - **<768px (phone):** keep the existing mobile slide-over (it's fine on a phone). UNCHANGED.

## Exact files & current breakpoints to change
- `client/src/components/VerticalRail.tsx` line ~94: `hidden lg:flex` → `hidden md:flex`. Rail must show from 768.
  - Also check its fixed width (64) + the `lg:pl-[88px]` padding on `<main>` in App.tsx — that left padding must also move to `md:pl-[88px]` so columns don't sit under the rail at tablet.
- `client/src/components/MobileTopChrome.tsx` line ~152: `lg:hidden` → `md:hidden`. Back-arrow/search chrome only on phone.
- `client/src/components/Chrome.tsx` `MobileBottomNav`: find its visibility class and change `lg`→`md` so the bottom nav only shows <768.
- `client/src/App.tsx`:
  - `<main className="... lg:pl-[88px]">` → `md:pl-[88px]`.
  - The list column + detail pane currently split at `md`. Keep that — it's correct.
  - `useListColumnWidth`: currently returns `isDesktop` true at ≥768 already (good). The shrink logic (CONV_FLOOR 560, INBOX_FLOOR 360, LEAD 340) is for the 3-column case. For the NEW tablet "replace inbox" behaviour, see below.
- `client/src/components/ConversationTimeline.tsx`:
  - Desktop lead panel `motion.aside` is `hidden lg:block` (≥1024). Change so it shows from `md` (768) as a real column: `hidden md:block`.
  - Mobile slide-over (`lead-panel-mobile`, the one with the scrim `bg-black/30`) is `lg:hidden`. Change to `md:hidden` so the overlay only ever appears on phone (<768).

## The tablet "replace inbox" mechanism (768–1279)
When `leadPanelOpen && showingConversation` AND viewport is 768–1279:
- The INBOX list column should collapse to width 0 (animate out) so only conversation + lead panel (340) show.
- At ≥1280 keep the existing 3-column shrink behaviour (inbox shrinks to a floor, all three visible).
- Implement by extending `useListColumnWidth` in App.tsx: add a tier flag. When `shrink` (lead open on a conversation) AND winW < 1280 → list width = 0. When `shrink` AND winW ≥ 1280 → existing leftover formula. When not shrink → base.
- The list column is already a `motion.div` with `animate={{width: listWidth}}` + `APPLE_SPRING`, and `overflow-hidden`, so width:0 will animate cleanly. Verify it doesn't leave a sliver or break flex.

## Toggle button must always be reachable
The lead-panel toggle (`data-testid="lead-panel-toggle"`, the animated PanelToggleIcon) lives in the conversation toolbar top-right. It is currently gated by `hasLeadContext` only (no breakpoint) — good, it shows on tablet too. Confirm it stays visible and toggles correctly in the tablet "replace inbox" mode. When inbox is replaced by the lead panel, the toggle closes the lead panel and brings the inbox back.

## Identity pill inconsistency (Simon's image 5)
On some widths an identity pill ("Emma Chen · Head of Growth …") appears at the top-center of the conversation; on others it doesn't. Investigate `SubjectIdentityPill` / `IdentityPill` usage in ConversationTimeline and its breakpoint gating. Make it consistent: it should appear on the SAME rule across tablet+desktop (likely it's meant for the compact/mobile header only). Align it so desktop (image 1, no pill) and tablet behave the same. If unsure, match the ≥1280 desktop behaviour (image 1 = NO center identity pill on wide desktop) across all ≥768 widths, since the lead panel already shows the identity.

## DO NOT
- Do NOT introduce any new overlay/scrim for the lead panel at ≥768.
- Do NOT change the <768 phone experience.
- Do NOT change the ≥1280 desktop 3-column experience (already approved).
- Do NOT touch the inbox greeting header (mascot beside title, sub-text full-width) — that's final.
- Do NOT invent new visual elements. Reuse existing primitives only.

## Verification matrix (MUST screenshot all, light mode, deviceScaleFactor 2)
Use the running dev server at http://localhost:5000/#/conversation/d2 and #/ (inbox).
For each: screenshot + assert via DOM which elements are visible.
1. 390×844 (phone): bottom nav visible, back-arrow visible, single column, lead opens as slide-over overlay. UNCHANGED from today.
2. 820×1180 (iPad portrait): RAIL visible, NO back-arrow, NO bottom nav. Inbox + conversation as 2 columns. Open lead → inbox animates away, conversation + lead panel side by side, NO scrim/overlay. Toggle again → inbox returns.
3. 1180×820 (iPad landscape): rail + inbox + conversation; open lead → 3 columns OR (if <1280) inbox replaced. 1180<1280 so EXPECT inbox replaced by lead. Verify clean.
4. 1280×900: rail + 3 columns (inbox shrinks to floor 360, conversation, lead 340). UNCHANGED.
5. 1440×900: rail + 3 columns, inbox wider (~428). UNCHANGED.
Also check: clicking a conversation from the inbox on iPad portrait does NOT show a back-arrow or bottom nav; switching between conversations stays easy (inbox column present when lead closed).

## Build / commit
- `npx tsc --noEmit` — only the ~32 pre-existing framer-motion warnings in OTHER files are allowed; App.tsx / VerticalRail / MobileTopChrome / Chrome / ConversationTimeline must be clean.
- `npm run build` must succeed.
- Do NOT commit or deploy — leave that to the parent agent. Report exactly which files you changed and the verification screenshots' filenames (save to /home/user/workspace/ipadfix_*.png).

## CONFIRMED exact line targets (verified by grep)
- `VerticalRail.tsx` line ~94: `hidden lg:flex` → `hidden md:flex`.
- `Chrome.tsx` `MobileBottomNav` line ~96: `lg:hidden fixed bottom-4 ...` → `md:hidden fixed bottom-4 ...`.
- `Chrome.tsx` `TabletLeftRail` (line ~157) currently `return null;` — leave it null (rail is handled by VerticalRail/DesktopRail which now shows at md).
- `MobileTopChrome.tsx` line ~152: `lg:hidden fixed inset-x-0 ...` → `md:hidden fixed inset-x-0 ...`.
- `ConversationTimeline.tsx`:
  - line ~1025 `desktop-pill-row`: `hidden lg:block absolute top-3 ...` → `hidden md:block absolute top-3 ...` (so the toolbar with toggle+Done shows on tablet too).
  - line ~1114 second `hidden lg:block absolute top-[78px] ...` (summary panel anchor): also → `hidden md:block ...` for consistency.
  - desktop lead panel `motion.aside data-testid="lead-panel-desktop"`: `hidden lg:block` → `hidden md:block`.
  - mobile lead slide-over `data-testid="lead-panel-mobile"` wrapper `lg:hidden` → `md:hidden`.
  - Any inner `lg:px-6` paddings can stay; not critical.
- `App.tsx` `<main ... lg:pl-[88px]>` → `md:pl-[88px]`.

## Identity pill (image 5) root cause
The `desktop-pill-row` is `hidden lg:block`, so at 1024–1279 it shows the SubjectIdentityPill in the top-center band. At ≥1280 desktop (image 1) Simon shows NO center identity pill — wait, image 1 also has NO center pill but image 5 (1280-ish) DOES. Investigate: the center identity pill should NOT appear on wide desktop per image 1. Decide the rule: the SubjectIdentityPill in desktop-pill-row likely should only render when the lead panel is CLOSED (since when open, the lead panel shows identity). OR it's a leftover. Match image 1 (no center identity pill at wide desktop with lead panel OPEN). Make the center identity pill behaviour identical across all ≥768 widths. Simplest correct rule: hide the SubjectIdentityPill (center identity) — keep only SubjectPill (subject) if present — OR show it consistently regardless of width. Pick the rule that matches image 1 and apply it for all md+.
