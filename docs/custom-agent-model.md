# Custom agent model — the conversation-quality layer

This is the most important layer in Replaiy: it defines how the AI conducts
conversations (tone, voice, behavior, strategy). It must be DEEP under the hood
(our quality responsibility) but SIMPLE for the paying custom-agent user.

## Two layers, four groups

Every avatar (preset) sets these dimensions under the hood. The Custom agent
exposes them for editing. It starts CLONED from the avatar the user had selected
(never blank), so they tune from a good base.

### A. Identity — who the agent is
1. Voice (free text) — "how I sound". The human core.
2. Formality — informal / neutral / formal.
3. Message length — short / medium. (No "long": long outreach does not convert.)

### B. Strategy — how the agent works toward the goal
4. Drive — one axis: Patient -> Balanced -> Assertive. Replaces the old
   overlapping stance + closingStyle + pushVsWait. How hard the agent pushes
   toward the campaign goal / next step.
5. Qualifying depth — light / thorough. How deep it digs before moving to the goal.

### C. Guardrails — the quality base (our responsibility)
6. Always do — 2-4 short rules.
7. Never do — 2-4 short rules.

### D. Advanced — for the power user (collapsed by default)
8. Custom instructions (free text) — an optional system-prompt-style override
   that LAYERS ON TOP of A+B+C. It does not duplicate them. Hidden unless opened.

## Why this resolves the earlier problems
- Behavior-vs-toggles duplication: the toggles (A+B+C) are the main layer; the
  free system prompt becomes optional "Advanced custom instructions", not a
  parallel duplicate.
- Approach/Closing/Push overlap: collapsed into one "Drive" axis.
- Field sprawl: 8 dimensions in 4 clear groups instead of a flat list.
- Blank vs cloned: Custom = cloned from the selected avatar, then edited.

## Quality base
Under the hood we keep a rich per-avatar system prompt (our quality guarantee).
The user-facing toggles FEED that prompt; they do not replace it. Deep base,
simple UI.

## Drive axis mapping (from old fields)
- Patient   = old stance 'patient'  + soft closing + favour waiting
- Balanced  = old stance 'balanced' + soft/measured closing + one follow-up then wait
- Assertive = old stance 'push'/'balanced'+direct + direct closing + persistent follow-up

Preset -> Drive:
- Patient Nurturer  -> Patient
- Warm & Personal   -> Balanced
- Consultative      -> Balanced (earn it, insight-led)
- Sharp Closer      -> Assertive (leaning)
- Direct Closer     -> Assertive
