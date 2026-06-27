# Replaiy adaptation — CONTENT ONLY on top of the real Stilt codebase

## Context — read carefully
`/home/user/workspace/replaiy-frontend` is now a DIRECT COPY of the Stilt app (a working mail+calendar+docs client). It already runs (dev server on port 5000, started via start_server). The baseline looks EXACTLY like Stilt — that is intentional and correct.

Your job is to adapt ONLY THE CONTENT so it becomes Replaiy (an AI draft-review tool for sales outbound), while keeping Stilt's design, layout, components, glass, typography, spacing, motion, and neutral color system 100% UNCHANGED.

The user demanded "Stilt vrijwel 1-op-1 overnemen." Previous attempts FAILED because they REINTERPRETED the design (added blue nav highlights, a back button, a dark/light toggle, colored labels). DO NOT reinterpret. DO NOT redesign. DO NOT add UI elements that Stilt doesn't have. You are doing a find-and-replace of CONTENT, not a redesign.

## The ONLY changes you may make

### 1. Brand: Stilt → Replaiy
- `client/src/components/Logo.tsx`: the StiltLogo. Replace ONLY the wordmark text/aria from "Stilt" to "Replaiy". Keep the logo mark style as-is (or swap the mark for the Replaiy reply-glyph in `_stilt_ref/`-style if trivial), but do NOT change its size/placement. Keep it neutral (currentColor), no new gradients.
- Any visible "Stilt" string in UI → "Replaiy". Leave code comments alone.

### 2. Navigation tabs: Mail / Calendar / Docs → Inbox / Campaigns / Calendar
In `client/src/components/VerticalRail.tsx` (and `lib/nav.ts` if used, and `Chrome.tsx` mobile nav):
- Tab 1: keep Inbox icon, label "Inbox", route `/`.
- Tab 2: change to "Campaigns" — icon `Target` (lucide), route `/campaigns`.
- Tab 3: change to "Calendar" — icon Calendar, route `/calendar`.
- REMOVE the Docs tab entirely.
- Do NOT add a back button or theme toggle to the rail. The rail has exactly: nav pill (3 tabs), Search circle, Compose circle, spacer, avatar circle at bottom. Exactly like Stilt.

### 3. Mock data: emails → Replaiy drafts
The real Replaiy draft data lives in `_stilt_ref/` is NOT it — use the 8 drafts in the OLD project at `/home/user/workspace/replaiy-frontend-OLD-attempt/client/src/lib/mock-data.ts` (leads: Jan de Vries, Emma Chen, Lars Bakker, Priya Nair, Marco Rossi, Sara Janssen, David Okafor, Hannah Müller — with avatars, confidence, rationale, incoming message, persona, NL+EN sales copy, and a short `reason` line).

Adapt `client/src/data/mockEmails.ts` so each "mail" represents an incoming lead conversation with an AI-generated DRAFT awaiting approval. Map fields:
- from.name = lead name; from avatar = the pravatar URL; subject = a short conversation subject derived from the draft context; preview = the draft preview or incoming snippet; ts = relative time; the AI reasoning line (Stilt shows italic `aiReasoning` under "Today for you" rows) = the draft's `reason` (e.g. "Pushing back on price — needs ROI reframe", "Strong buying signal, ready for the meeting ask").
- Keep Stilt's Mail type shape; just fill it with Replaiy content. Keep the StiltContext logic working.

### 4. List sections → Replaiy draft sections (rename the section logic, keep the exact visual pattern)
Stilt's InboxList groups into "Today for you" / "Quick to clear" / "Waiting on others" / "Auto-quieted". Re-label/re-bucket to Replaiy (KEEP the identical stilt-card + hairline-row + section-header + italic reasoning visual — only change labels and which items fall in each):
- "Needs your approval" (the drafts awaiting the user, sorted by confidence, with the italic AI-reason line — like "Today for you"). For high-confidence (≥90%) drafts, the italic line states why it wasn't auto-sent ("Autopilot off for replies", "Still learning — 18/25 reviewed", "Member score 84% — below 90%").
- "Waiting on reply" (drafts already sent, awaiting the lead — like "Waiting on others"). Compact rows.
- "Auto-sent today" (collapsed toggle section exactly like Stilt's "Auto-quieted" — same VolumeX-style collapsed glass bar, but icon Send/Zap and text "· N auto-sent today"). 2-3 items.
- Do NOT add filter tabs. Stilt has none. Sections only.

### 5. Briefing header
Stilt's InboxList top greeting "Good morning, Simon. 3 mails need your attention today. 4 were auto-quieted…". Re-word to Replaiy drafts: "Good morning, Simon. {N} drafts need your approval. {M} were auto-sent overnight. Avg confidence {X}%." Keep the EXACT same typography/size/placement.

### 6. Right detail pane: mail thread → draft review
`client/src/pages/MailDetail.tsx` / `ConversationTimeline.tsx`: when a draft is open, show the incoming lead message as the conversation bubble (Stilt's existing bubble), and the AI draft in Stilt's existing FLOATING "Draft generated" bar at the bottom — relabel it "Replaiy draft" with the sparkle (now blue via --ai-accent). Add Approve / Edit / Dismiss affordances using Stilt's existing button/pill styles (do NOT invent new button styles). Keep the "Select a draft" empty state (Stilt's "Select a mail" → "Select a draft").

### 7. Campaigns + Calendar pages = clean placeholders
- `/campaigns` and `/calendar` routes: simple placeholder pages in Stilt's style (centered icon in a glass circle + title + one muted line "Coming soon"). Reuse Stilt's EmptyDetail/empty-state styling. Calendar may keep Stilt's calendar page if it renders cleanly, otherwise placeholder. Campaigns = placeholder ("Set up who you target and how your outreach flows. Coming soon.").
- Remove/neutralize Docs routes (or leave them unreachable since the tab is gone).

## The single design change already made
`--ai-accent` in index.css is already changed from turquoise to Replaiy blue `#2F6BFF`. Do NOT change any other color. Do NOT add blue anywhere else — the nav active state stays Stilt's NEUTRAL glass (no blue), labels stay neutral. Blue appears ONLY where Stilt used the turquoise AI accent (the sparkle + draft label), nothing more.

## Hard rules
- Settings centraal — no hardcoded colors in components; use existing tokens.
- Do NOT add: back button, theme toggle button, filter tabs, colored nav highlight, second accent. None of these are in Stilt.
- Keep hash routing (the project already uses wouter; check App.tsx — Stilt uses useHashLocation). Keep data-testid where Stilt has them; add for new interactive bits.
- Keep dark + light working exactly as Stilt does it (Stilt toggles via .dark class; do NOT add a visible toggle — Stilt sets it elsewhere/system).

## QA
Run the dev server (start_server on port 5000). Playwright screenshot at 1440px in light AND dark. Place next to `_stilt_ref/STILT_TARGET_SCREENSHOT.jpg` — it must be visually identical EXCEPT content is Replaiy drafts, brand is Replaiy, tabs are Inbox/Campaigns/Calendar, and the AI sparkle is blue. If anything else differs from Stilt, you reinterpreted — fix it. Zero console errors, tsc clean.

Commit with git (init the repo: `git init`, add .gitignore for node_modules/dist, configure user.email/name). Do NOT deploy. Report files changed + screenshot paths + any open issues.
