// v-replaiy — Brand mark. Replaces Replaiy's gradient SVG triangle with the
// official Replaiy "Re:" speech-bubble logo. Theme-aware: the black bubble
// shows in light mode, the white bubble shows in dark mode. Backgrounds are
// keyed-out (alpha) marks so it sits cleanly on any surface (no white box).
//
// v-replaiy (perf) — the source PNGs were huge (187KB / 300KB at ~1000px²)
// even though the mark never renders larger than ~56px, so the logo visibly
// popped in late on the inbox / campaigns empty states. They're now optimized
// WebP marks (~9KB each, transparency preserved) and are additionally warmed
// into the browser cache at app entry (see lib/preloadAssets.ts), so the mark
// paints instantly on the very first frame. ReplaiyLogo's public API (size,
// className) is unchanged.
import logoLight from '@/assets/replaiy-logo-light.webp'; // white bubble — DARK mode
import logoDark from '@/assets/replaiy-logo-dark.webp'; // black bubble — LIGHT mode

// Exported so the app-entry preloader can warm both variants before paint.
export const LOGO_LIGHT_SRC = logoLight;
export const LOGO_DARK_SRC = logoDark;

export function ReplaiyLogo({ size = 22, className = '' }: { size?: number; className?: string }) {
  return (
    <span
      className={`relative inline-block shrink-0 ${className}`}
      style={{ width: size, height: size }}
      aria-label="Replaiy"
      role="img"
    >
      {/* Light mode: black bubble */}
      <img
        src={logoDark}
        alt=""
        aria-hidden="true"
        className="block dark:hidden w-full h-full object-contain select-none"
        draggable={false}
        decoding="async"
        fetchPriority="high"
      />
      {/* Dark mode: white bubble */}
      <img
        src={logoLight}
        alt=""
        aria-hidden="true"
        className="hidden dark:block w-full h-full object-contain select-none"
        draggable={false}
        decoding="async"
        fetchPriority="high"
      />
    </span>
  );
}
