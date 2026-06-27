// Replaiy — GlassToggle: a reusable glass on/off switch.
//
// Generic, reusable across the app (campaigns, settings, autopilot, any
// on/off). Props: { on, onChange, testId?, ariaLabel? }. The selected glass +
// liquid droplet thumb animation match the nav-pill indicator 1:1.
//
// This is, quite literally, the nav-pill (VadikLiquidSwitcher) with 2 positions
// instead of 3. The mechanism is copied from VadikLiquidSwitcher's sliding
// indicator (VadikLiquidSwitcher.tsx ~L194-213):
//
//   • TRACK (the 46×28 pill): STATIC. It never scales/wobbles — it only
//     crossfades its colour. OFF = the approved light-grey hollow glass
//     (hsl(var(--foreground)/0.18) + a faint inner rim). ON = the EXACT
//     nav-pill selected-indicator glass, accent-tinted: the 7-layer --vadik-*
//     rim/sheen box-shadow (INDICATOR_BOX_SHADOW, scaled to the switch size)
//     over an accent glass fill (ACCENT_GLASS_FILL, full Replaiy blue #2F6BFF).
//     The ON↔OFF colour crossfade settles on the indicator's own
//     ~400ms cubic-bezier(1,0,0.4,1) timing.
//
//   • THUMB (the round 24px white knob): IS the moving liquid indicator. Exactly
//     like the nav pill it separates the two motion channels so they don't fight:
//       – POSITION via `left` (off ≈ 2, on ≈ 20) with
//         `transition: left 440ms cubic-bezier(1,0,0.4,1)` — the glide.
//       – WOBBLE via the `transform`/scale channel ONLY: on each toggle it
//         replays the nav-pill droplet keyframe (adapted vadikScaleToggle), so
//         the round thumb stretches slightly outside itself as it travels, then
//         settles — the water-droplet feel, on the THUMB, not the track.
//     The wobble keyframe is defined ONCE as a stable, module-level global style
//     (NOT re-mounted per toggle — that was why prior attempts silently did
//     nothing). The thumb is re-keyed by a `wobble` counter so the same keyframe
//     restarts on every toggle (the pill's exact key={wobble} trick).
//
// Optimistic flip lives in CampaignsList / CampaignDetail (local isOn flips
// instantly, status write delayed ~520ms) so the wobble plays immediately on
// tap, before the row re-sorts. Works in list rows + detail header, light+dark.

import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { APPLE_SPRING } from '@/lib/motion';

// ── Nav-pill selected-indicator glass, adapted to the switch size ──────────
// s() scales the pen's indicator box-shadow offsets down to the small switch.
// The pen's active indicator is 84px wide; our ON track is 46px → ~0.45.
const SW_SCALE = 0.45;
const s = (v: number) => v * SW_SCALE;

// The EXACT 7-layer indicator box-shadow from VadikLiquidSwitcher (its
// `indicatorBoxShadow`, ~L112-120), reusing the same --vadik-light /
// --vadik-dark / --vadik-reflex-* tokens so the rim-of-light + convex depth
// match the nav-pill selected indicator 1:1, just rendered at switch scale.
const INDICATOR_BOX_SHADOW = [
  `inset 0 0 0 ${s(1)}px color-mix(in srgb, var(--vadik-light, #fff) calc(var(--vadik-reflex-light, 1) * 10%), transparent)`,
  `inset ${s(2)}px ${s(1)}px 0px ${s(-1)}px color-mix(in srgb, var(--vadik-light, #fff) calc(var(--vadik-reflex-light, 1) * 90%), transparent)`,
  `inset ${s(-1.5)}px ${s(-1)}px 0px ${s(-1)}px color-mix(in srgb, var(--vadik-light, #fff) calc(var(--vadik-reflex-light, 1) * 80%), transparent)`,
  `inset ${s(-2)}px ${s(-6)}px ${s(1)}px ${s(-5)}px color-mix(in srgb, var(--vadik-light, #fff) calc(var(--vadik-reflex-light, 1) * 60%), transparent)`,
  `inset ${s(-1)}px ${s(2)}px ${s(3)}px ${s(-1)}px color-mix(in srgb, var(--vadik-dark, #000) calc(var(--vadik-reflex-dark, 1) * 20%), transparent)`,
  `inset 0px ${s(-4)}px ${s(1)}px ${s(-2)}px color-mix(in srgb, var(--vadik-dark, #000) calc(var(--vadik-reflex-dark, 1) * 10%), transparent)`,
  `0px ${s(3)}px ${s(6)}px 0px color-mix(in srgb, var(--vadik-dark, #000) calc(var(--vadik-reflex-dark, 1) * 8%), transparent)`,
].join(', ');

// Accent-tinted glass FILL — mirrors the indicator's
//   color-mix(in srgb, var(--vadik-glass) 36%, transparent)
// but tints with the single app accent #2F6BFF instead of the neutral
// --vadik-glass, so the ON track is the same translucent glass material,
// accent-coloured. The rim/sheen box-shadow above supplies the convex depth.
// Full Replaiy blue — a hair of translucency keeps it a glass surface rather
// than flat paint; a subtle vertical sheen adds the convex highlight.
const ACCENT_GLASS_FILL =
  'linear-gradient(180deg,' +
  ' color-mix(in srgb, #2F6BFF 92%, #ffffff) 0%,' +
  ' #2F6BFF 55%,' +
  ' color-mix(in srgb, #2F6BFF 88%, #000000) 100%)';

// The indicator's own settling-in background timing.
const INDICATOR_BG_TRANSITION =
  'background 400ms cubic-bezier(1, 0, 0.4, 1), box-shadow 400ms cubic-bezier(1, 0, 0.4, 1)';

// ── The droplet wobble keyframe — defined ONCE, globally, at module level ──
// This is the crux of the fix: previous attempts re-mounted the <style> inside
// the component on every toggle, so the browser never saw a stable @keyframes
// rule to replay and the animation silently did nothing. We inject it exactly
// once into <head> the first time any toggle mounts, and never touch it again.
// Adapted from VadikLiquidSwitcher's vadikScaleToggle (scale 1 → 1.1 → 1): on a
// small round thumb a gentle squash-stretch (scale up wide, settle) reads as a
// water droplet stretching as it travels, then landing.
const WOBBLE_KEYFRAME_ID = 'campaign-toggle-wobble-keyframes';
const WOBBLE_KEYFRAMES = `
@keyframes campaignThumbWobble {
  0%   { transform: scale(1, 1); }
  35%  { transform: scale(1.12, 0.94); }
  70%  { transform: scale(0.98, 1.03); }
  100% { transform: scale(1, 1); }
}`;

function ensureWobbleKeyframes() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(WOBBLE_KEYFRAME_ID)) return;
  const styleEl = document.createElement('style');
  styleEl.id = WOBBLE_KEYFRAME_ID;
  styleEl.textContent = WOBBLE_KEYFRAMES;
  document.head.appendChild(styleEl);
}

export function GlassToggle({
  on,
  onChange,
  testId,
  ariaLabel,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  testId?: string;
  ariaLabel?: string;
}) {
  // Install the stable global keyframe once.
  useEffect(() => {
    ensureWobbleKeyframes();
  }, []);

  // Liquid "wobble" — the SAME squash-stretch the nav-pill indicator does on
  // change (VadikLiquidSwitcher's vadikScaleToggle, scale 1→1.1→1). On every
  // toggle we bump a counter; the thumb is re-keyed by it so the keyframe
  // restarts each time (the pill's exact key={wobble} trick). It plays on the
  // THUMB's transform channel only — the track never scales.
  const [wobble, setWobble] = useState(0);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setWobble((w) => w + 1);
  }, [on]);

  return (
    <motion.button
      type="button"
      data-testid={testId}
      aria-label={ariaLabel}
      onClick={() => onChange(!on)}
      role="switch"
      aria-checked={on}
      // Press micro-scale = same 0.97 commit feel as .glass-pill:active.
      whileTap={{ scale: 0.97 }}
      transition={APPLE_SPRING}
      className="relative inline-flex h-[28px] w-[46px] items-center rounded-full"
      style={{
        // Soft floating glass blur on the whole track (same family as chrome).
        backdropFilter: 'blur(var(--lg-max-blur)) saturate(var(--lg-max-saturate))',
        WebkitBackdropFilter:
          'blur(var(--lg-max-blur)) saturate(var(--lg-max-saturate))',
      }}
    >
      {/* TRACK — STATIC. Holds both colour layers. It never scales or wobbles;
          it only crossfades OFF↔ON colour. */}

      {/* OFF track — calm LIGHT-GREY hollow glass. A solid foreground-tinted
          grey with only a faint inner rim for depth — unmistakably "empty/off"
          and clearly visible on white cards. Auto-dark via the foreground token. */}
      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-full"
        animate={{ opacity: on ? 0 : 1 }}
        transition={{ duration: 0.4, ease: [1, 0, 0.4, 1] }}
        style={{
          background: 'hsl(var(--foreground) / 0.18)',
          boxShadow:
            'inset 0 1px 1.5px rgba(0,0,0,0.10),' +
            ' inset 0 0 0 1px hsl(var(--foreground) / 0.06)',
        }}
      />

      {/* ON track — the EXACT nav-pill selected-indicator glass, accent-tinted.
          The 7-layer --vadik-* rim/sheen box-shadow (scaled to switch size)
          over the accent glass fill mixed from #2F6BFF. The colour crossfades
          on the indicator's own ~400ms cubic-bezier(1,0,0.4,1) timing so it
          "breathes in" like a nav pill rather than snapping. Reflex tokens
          auto-retune the rim for light AND dark. */}
      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-full"
        animate={{ opacity: on ? 1 : 0 }}
        transition={{ duration: 0.4, ease: [1, 0, 0.4, 1] }}
        style={{
          background: ACCENT_GLASS_FILL,
          boxShadow: INDICATOR_BOX_SHADOW,
          transition: INDICATOR_BG_TRANSITION,
        }}
      />

      {/* THUMB — the round white glass knob, and THE moving liquid indicator.
          Two motion channels, kept separate exactly like the nav-pill indicator,
          but split across TWO nested elements so they never fight AND the slide
          actually transitions:
            • OUTER span owns POSITION via `left` (off=2, on=20) and is STABLE
              (no key) — so its `left` transition animates 2px↔20px instead of
              the element re-mounting at its target with no transition.
            • INNER span owns the WOBBLE via the `transform`/scale channel ONLY,
              and is the one re-keyed by `wobble` so the droplet keyframe
              restarts on every toggle. The keyframe is the stable global one
              installed above. The inner element writes nothing to `left`, so
              the slide owns `left` on the parent and the wobble owns `transform`
              on the child — fully decoupled. */}
      <span
        aria-hidden="true"
        className="absolute z-10 inline-block h-[24px] w-[24px] rounded-full"
        style={{
          // Slide via `left` (like the pill positions its indicator). This
          // element is stable so the transition runs across toggles.
          left: on ? 20 : 2,
          transition: 'left 440ms cubic-bezier(1, 0, 0.4, 1)',
          willChange: 'left',
        }}
      >
        <span
          key={wobble}
          className="block h-full w-full rounded-full"
          style={{
            background: 'linear-gradient(180deg, #FFFFFF 0%, #F3F4F6 100%)',
            boxShadow:
              '0 1px 1px rgba(0,0,0,0.05),' +
              ' 0 2px 6px rgba(8,10,18,0.22),' +
              ' inset 0 1px 0.5px rgba(255,255,255,0.95),' +
              ' inset 0 -1px 1.5px rgba(0,0,0,0.06)',
            transformOrigin: 'center center',
            // Droplet wobble on the transform channel only, replayed per toggle.
            animation: wobble > 0 ? 'campaignThumbWobble 440ms ease' : undefined,
            willChange: 'transform',
          }}
        />
      </span>
    </motion.button>
  );
}
