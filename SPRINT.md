# Stilt Sprint Doc

Levend document. Per fix vinkt agent af zodra het geverifieerd in
preview staat. Per sprint wordt er één keer gedeployed wanneer alles
gedaan is, tenzij we expliciet besluiten tussentijds te shippen.

Status legenda:
- `[ ]` = nog te doen
- `[~]` = code gedaan, nog niet gedeployed/geverifieerd
- `[x]` = gedeployed en geverifieerd in preview

---

## v30.30 — Big consistency pass

Doel: alles op desktop én mobile visueel en gedrag-technisch consistent.
Geen grote architectuur-changes, wel een hoop polish + dead code weg.

### Tab-pill & navigatie (desktop rail)
- [ ] Tab-pill indicator vierkant/rond (60×60 i.p.v. capsule 84×60)
      — GEPARKEERD: 3 rondes geprobeerd, indicator past niet schoon binnen
      pill cross-axis. Vraagt rustige DevTools-debug-sessie. Origineel
      teruggezet.
- [ ] Tab-pill icons groter — GEPARKEERD samen met indicator-fix.
- [ ] Search/+ icons matchen tab-pill — GEPARKEERD.

### Layout
- [x] Mail column breder op desktop (380 → 520 lg / 560 xl)
- [x] "Good morning" tekst omhoog (pt-[86px] → lg:pt-5)

### Dropdowns weg
- [x] Calendar view-dropdown weg (desktop)
- [x] Calendar view-dropdown weg (mobile togglePill = null)
- [x] Docs view-dropdown weg (desktop)
- [x] Docs view-dropdown weg (mobile togglePill = null)

### Universal Search modal
- [x] Context-aware chips: Mail-route = Inbox/Snoozed/Sent/Done/Drafts/Spam
- [x] Context-aware chips: Calendar-route = Today/Week/Month/Upcoming
- [x] Context-aware chips: Docs-route = Recent/Pinned/Shared/Templates/Trash
- [x] Lichter glass-styling (was te donker/grijs)
- [x] Positie: gecentreerd in viewport (md:inset-x-0 + mx-auto)
- [x] Modal vaste hoogte (76vh) — verspringt niet meer per chip
- [x] Chip click → filtert binnen modal, sluit niet (toggle on/off)
- [x] Default state = geen chip actief (= alles zoeken)
- [x] Mail-chips filter matched echte data shapes (isSent/isDraft/etc.)
- [ ] Calendar/Docs chips filteren in modal — nog niet (parkeren v30.31)

### Dead code opruimen
- [~] `VadikPill.tsx` verwijderd
- [~] `VadikButton.tsx` verwijderd
- [~] `TopChrome` + `MailViewSelectorWrap` in `InboxList.tsx` verwijderd
- [~] `ColumnTopChrome` in `ViewChrome.tsx` verwijderd
- [~] `FilterChip` helper onderaan `UniversalSearch.tsx` verwijderd
- [~] `MAIL_VIEW_OPTIONS` + `ViewSelectorPill` imports opgeruimd (Inbox/Cal/Docs)
- [~] `/dist/public/mockups/` folder verwijderd
- [ ] `searchOpen` state in `MobileTopChrome.tsx` — nog in gebruik, blijft

### Mail detail polish (v30.30 toegevoegd)
- [~] Forward verplaatst naar top-right action row (naast Done/Snooze)
- [~] Inline reply bar onderin (vervangt Reply pill + Compose-route)
- [~] AI-draft pre-filled in inline reply (Today-for-you mails only)
- [~] Smart-replies chips overlay verwijderd (vervangen door inline draft)
- [ ] **Bug: thread mails (Nora Chen 5 msgs) crashen** — fixen
- [ ] AI-draft alleen op Today-for-you mails (priority=high + needsReply + status=open)
- [ ] Editor stijl: klein veld dat groeit bij focus/click (geen expand-knop)
- [ ] Glass styling check op alle nieuwe elementen

### Calendar avatar
- [ ] Calendar avatar gelijk getrokken met Mail/Docs — NOG OPEN, wachten op
      Mail/Docs vergelijking-screenshot van Simon

### Deploy
- [~] Build clean (geen TS errors)
- [~] `deploy_website` → preview URL
- [ ] `publish_website` → pplx.app
- [ ] User-verificatie in browser (desktop + mobile)

---

## v30.31 — Calendar 2-column refactor

Doel: Calendar krijgt zelfde 2-column patroon als Mail. Smart agenda
feed links, échte agenda-grid rechts. Consistent met Mail pattern.

### Links column (Smart Calendar feed)
- [ ] Verhuis huidige centered feed (Needs response / Today's focus /
      Reschedule suggestions / Hidden time) naar links
- [ ] Zelfde width als InboxList (520/560px lg/xl)
- [ ] "Good morning, Simon" hero + agenda samenvatting bovenaan
- [ ] Smart sectie-headers met Sparkles icon

### Rechts column (Real Agenda Grid)
- [ ] Day view component (uur-grid 00:00 → 24:00 met events)
- [ ] Week view component (7 kolommen × 24 uur)
- [ ] Month view component (kalender grid)
- [ ] Year view component (12 mini-months)
- [ ] Segmented toggle bovenaan: Day / Week / Month / Year
- [ ] Events met juiste tijd-positionering en overlap-handling
- [ ] Drag-to-create event (drag op leeg slot)
- [ ] Klik event in grid → opent detail (rechter panel of modal)

### Cross-linking
- [ ] Klik event in smart-feed links → highlight + scroll-into-view in grid
- [ ] Klik leeg slot in grid → "Block this time" suggestion verschijnt in feed
- [ ] Selected state synchroniseert tussen links/rechts

### Mobile gedrag
- [ ] **Te bespreken met Simon vóór implementatie**
- [ ] Mogelijke opties: swipe tussen smart/grid, of grid-only met
      hamburger naar smart-feed, of stacked scroll

### Universal Search context
- [ ] Calendar-chips switchen rechter-grid view-mode
  (Today → day view + scroll naar nu, Week → week view, etc.)

### Deploy
- [ ] Build clean
- [ ] `deploy_website` → preview URL
- [ ] `publish_website` → pplx.app
- [ ] User-verificatie in browser (desktop + mobile)

---

## v30.30 — Inline reply: WhatsApp layout + file upload (DONE)

- [x] File upload: paperclip in toolbar, hidden file input, multi-select,
      attachment chips boven editor met filename + size + remove
- [x] AttachmentChip helper component (Image/File icon, KB/MB label)
- [x] `onSend` payload uitgebreid met `attachments: File[]` (parents geupdated)
- [x] Scrubber dots verwijderd uit ConversationTimeline
- [x] WhatsApp-style thread: paddingBottom = werkelijke reply-bar hoogte
      (ResizeObserver) → messages staan altijd direct boven editor
- [x] Editor groeit omhoog bij expand, laatste message scrollt netjes mee
- [x] Auto scroll-to-bottom als user al onderaan was (anders niet storen)

## Backlog / nog te bespreken

- Docs ook 2-column refactor? (smart docs-feed links + grid rechts)
- Briefing surface inrichten als landing met cross-surface AI
- Onboarding flow
- Search modal polish: chips als VadikLiquidSwitcher tab-pill stijl,
  Vadik glass surface, result-rows met glass-on-hover (mijn eigen review
  van de huidige modal — voelt nog te "iOS Spotlight" en niet Stilt-native)
- Tab-pill ronde indicator + grotere icons — geparkeerd, rustige
  DevTools-debug-sessie nodig om correct te krijgen

