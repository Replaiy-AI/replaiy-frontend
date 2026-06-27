// v-replaiy — Brand mark. Replaces Stilt's gradient SVG triangle with the
// official Replaiy "Re:" speech-bubble logo. Theme-aware: the black bubble
// shows in light mode, the white bubble shows in dark mode. Backgrounds are
// keyed-out PNGs so the mark sits cleanly on any surface (no white box).
import logoLight from '@/assets/replaiy-logo-light.png'; // white bubble — DARK mode
import logoDark from '@/assets/replaiy-logo-dark.png'; // black bubble — LIGHT mode

export function StiltLogo({ size = 22, className = '' }: { size?: number; className?: string }) {
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
      />
      {/* Dark mode: white bubble */}
      <img
        src={logoLight}
        alt=""
        aria-hidden="true"
        className="hidden dark:block w-full h-full object-contain select-none"
        draggable={false}
      />
    </span>
  );
}
