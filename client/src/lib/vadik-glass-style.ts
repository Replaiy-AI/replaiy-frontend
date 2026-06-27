// ─────────────────────────────────────────────────────────────────
// Vadik glass style helpers
//
// Centralizes the box-shadow stack, backdrop-filter recipe, and
// fallback styling so VadikLiquidSwitcher and VadikGlass share one
// source of truth. Based on Vadik's CodePen
//   https://codepen.io/fooontic/pen/KwpRaGr
// plus Mikhail Bespalov's hover-scale animation
//   https://codepen.io/Mikhail-Bespalov/pen/MYwrMNy
// and our iOS fallback (see lib/ios-detect).
// ─────────────────────────────────────────────────────────────────
import type { CSSProperties } from 'react';

// Vadik's exact 16288-char displacement WebP (verbatim from CodePen
// HTML panel). DO NOT shorten — the base64 IS the displacement map.
// Importing as a module-level const so multiple glass elements share
// one in-memory string and the bundler dedupes it.
import { VADIK_DISPLACEMENT_WEBP } from './vadik-displacement-map';

export { VADIK_DISPLACEMENT_WEBP };

// Vadik's 10-layer track box-shadow stack, scale-aware via `s` helper.
// All shadows in one stack — use deze als je 1 element hebt dat zowel
// glass-surface als rim-shadow draagt (zoals VadikLiquidSwitcher’s
// fieldset).
export function vadikTrackBoxShadow(s: (v: number) => number): string {
  return [
    ...vadikInsetRimShadows(s),
    ...vadikOuterDropShadows(s),
  ].join(', ');
}

// v29.2 — Inset shadows ALLEEN (de 8 "rim/highlight" lagen). Plaats
// deze op de INNER glass-surface, niet op een buiten-wrapper. Reden:
// als je inset-shadows op een buiten-wrapper zet maar de glass-surface
// is een transparante INNER laag, dan schijnen de inset-shadows door
// het glas heen → "pill-in-pill" + "balkje onder" effect.
export function vadikInsetRimShadows(s: (v: number) => number): string[] {
  return [
    `inset 0 0 0 ${s(1)}px color-mix(in srgb, var(--vadik-light, #fff) calc(var(--vadik-reflex-light, 1) * 10%), transparent)`,
    `inset ${s(1.8)}px ${s(3)}px 0px ${s(-2)}px color-mix(in srgb, var(--vadik-light, #fff) calc(var(--vadik-reflex-light, 1) * 90%), transparent)`,
    `inset ${s(-2)}px ${s(-2)}px 0px ${s(-2)}px color-mix(in srgb, var(--vadik-light, #fff) calc(var(--vadik-reflex-light, 1) * 80%), transparent)`,
    `inset ${s(-3)}px ${s(-8)}px ${s(1)}px ${s(-6)}px color-mix(in srgb, var(--vadik-light, #fff) calc(var(--vadik-reflex-light, 1) * 60%), transparent)`,
    `inset ${s(-0.3)}px ${s(-1)}px ${s(4)}px 0px color-mix(in srgb, var(--vadik-dark, #000) calc(var(--vadik-reflex-dark, 1) * 12%), transparent)`,
    `inset ${s(-1.5)}px ${s(2.5)}px 0px ${s(-2)}px color-mix(in srgb, var(--vadik-dark, #000) calc(var(--vadik-reflex-dark, 1) * 20%), transparent)`,
    `inset 0px ${s(3)}px ${s(4)}px ${s(-2)}px color-mix(in srgb, var(--vadik-dark, #000) calc(var(--vadik-reflex-dark, 1) * 20%), transparent)`,
    `inset ${s(2)}px ${s(-6.5)}px ${s(1)}px ${s(-4)}px color-mix(in srgb, var(--vadik-dark, #000) calc(var(--vadik-reflex-dark, 1) * 10%), transparent)`,
  ];
}

// v29.2 — Outer drop-shadows (de 2 "lift" lagen). Plaats deze op de
// OUTER wrapper voor de zwevende look. Deze lagen zijn niet inset dus
// ze kunnen GEEN pill-in-pill geven — ze projecteren alleen naar buiten.
export function vadikOuterDropShadows(s: (v: number) => number): string[] {
  return [
    `0px ${s(1)}px ${s(5)}px 0px color-mix(in srgb, var(--vadik-dark, #000) calc(var(--vadik-reflex-dark, 1) * 10%), transparent)`,
    `0px ${s(6)}px ${s(16)}px 0px color-mix(in srgb, var(--vadik-dark, #000) calc(var(--vadik-reflex-dark, 1) * 8%), transparent)`,
  ];
}

// Returns inline styles for the glass surface (background + backdrop-filter)
// Branches between Chromium (full Vadik with SVG displacement) and iOS
// WebKit / Safari / Firefox (premium CSS-only fallback).
export function vadikGlassSurfaceStyle(
  filterId: string,
  useFallback: boolean,
  blurPx: number,
): CSSProperties {
  if (useFallback) {
    return {
      // Vertical sheen-gradient suggests convex glass curvature: lighter
      // top (light from above), subtle middle, soft dark bottom.
      background: `linear-gradient(180deg,
        rgba(255, 255, 255, 0.22) 0%,
        rgba(255, 255, 255, 0.12) 45%,
        rgba(255, 255, 255, 0.06) 78%,
        rgba(0, 0, 0, 0.04) 100%
      )`,
      backdropFilter: `blur(10px) saturate(140%)`,
      WebkitBackdropFilter: `blur(10px) saturate(140%)`,
    };
  }
  return {
    background:
      'color-mix(in srgb, #ffffff 8%, color-mix(in srgb, var(--vadik-glass, #bbbbbc) 10%, transparent))',
    backdropFilter: `blur(${blurPx}px) url(#${filterId}) saturate(120%)`,
    WebkitBackdropFilter: `blur(${blurPx}px) saturate(120%)`,
  };
}
