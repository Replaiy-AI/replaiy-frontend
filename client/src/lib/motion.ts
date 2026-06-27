// Apple's signature spring + ease curves — used across all v6 physics interactions.
import type { Transition } from 'framer-motion';

export const APPLE_SPRING: Transition = {
  type: 'spring',
  stiffness: 400,
  damping: 32,
  mass: 0.9,
};

// Tighter spring for snap-back / commit moments.
export const APPLE_SPRING_TIGHT: Transition = {
  type: 'spring',
  stiffness: 500,
  damping: 40,
};

// Indicator / layout transitions
export const APPLE_SPRING_LAYOUT: Transition = {
  type: 'spring',
  stiffness: 500,
  damping: 38,
};

// Cubic-bezier easing — Apple's signature curve.
export const APPLE_EASE: [number, number, number, number] = [0.32, 0.72, 0, 1];

export const APPLE_EASE_DURATION = 0.32;

// ─── Glass icon-button standardization (v30.36) ───────────────────
// One source of truth for the hover-scale animation on every glass
// icon button (VadikGlass, GlassCircleButton, VerticalRail pills,
// MailActionCluster, etc.). Previously each component had its own
// scale value (1.05, 1.1, 1.2) — too aggressive, especially on the
// VadikLiquidSwitcher icons which jumped to 1.2 on hover. This soft
// 1.03 is the universal target.
export const HOVER_SCALE_SOFT = 1.05;

// Slightly stiffer / faster-settling spring for the icon-button
// hover. Pairs with HOVER_SCALE_SOFT — short, snappy, no wobble.
export const HOVER_SPRING: Transition = {
  type: 'spring',
  stiffness: 500,
  damping: 35,
};

// CSS transition string equivalent of HOVER_SPRING for components
// that mutate transform via direct style assignment (VadikGlass /
// VadikLiquidSwitcher avoid React re-renders on hover).
export const HOVER_TRANSITION_CSS =
  'transform 180ms cubic-bezier(0.32, 0.72, 0, 1)';

// Universal icon size for ALL glass icon buttons (round/pill, icon
// only, no label). Done/Snooze/Forward/Search/+/Back/X/Edit/Save/
// tab-pill icons all use this.
export const GLASS_ICON_SIZE = 19;
export const GLASS_ICON_STROKE = 1.75;

