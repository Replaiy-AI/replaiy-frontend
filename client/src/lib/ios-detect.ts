// ─────────────────────────────────────────────────────────────────
// iOS WebKit detection
//
// On iOS (iPhone/iPad), Apple's App Store rules force EVERY browser
// (Safari, Chrome, Firefox, Brave, Comet, …) to use WebKit as the
// rendering engine. WebKit does not support SVG filters inside
// `backdrop-filter` — a known limitation since ~2014:
//   https://github.com/mdn/browser-compat-data/issues/24110
//
// We therefore branch the liquid-glass implementation: real refraction
// on Chromium, a polished CSS-only fallback on iOS WebKit.
//
// Detection notes:
//  • iPadOS ≥13 reports as "MacIntel" in navigator.platform, so we
//    additionally check for touch + maxTouchPoints.
//  • We also detect non-iOS Safari (desktop Safari) for cases where
//    the same fallback is preferable.
// ─────────────────────────────────────────────────────────────────

export function isIOSWebKit(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const platform = navigator.platform || '';

  // Classic iPhone / iPad / iPod
  const isClassicIOS = /iPad|iPhone|iPod/.test(platform) || /iPad|iPhone|iPod/.test(ua);

  // iPadOS 13+ masquerades as macOS — detect touch-capable Mac as iPad.
  const isIPadOS =
    platform === 'MacIntel' &&
    typeof navigator.maxTouchPoints === 'number' &&
    navigator.maxTouchPoints > 1;

  return isClassicIOS || isIPadOS;
}

// True when SVG filters inside `backdrop-filter` won't render. Right
// now this matches exactly iOS WebKit (all iOS browsers) plus desktop
// Safari / Firefox. We deliberately do *not* try to feature-detect via
// CSS.supports() because Safari's parser returns `true` for the syntax
// but silently drops the SVG filter at render time — a parser-vs-engine
// mismatch that has bitten many libraries.
export function lacksBackdropSVGFilter(): boolean {
  if (typeof navigator === 'undefined') return false;
  if (isIOSWebKit()) return true;

  const ua = navigator.userAgent || '';
  const isDesktopSafari =
    /Safari/.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|EdgiOS/.test(ua);
  const isFirefox = /Firefox/.test(ua);
  return isDesktopSafari || isFirefox;
}
