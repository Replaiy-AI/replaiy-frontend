import { avatarFor } from '@/lib/avatar';

interface AvatarProps {
  name: string;
  /** Portrait URL from the lead data. When provided it always wins
     (Replaiy rule: no hardcoded sender lists — the data drives the photo). */
  src?: string;
  size?: number;
  className?: string;
}

export function ReplaiyAvatar({ name, src, size = 40, className = '' }: AvatarProps) {
  const photo = src;

  if (photo) {
    return (
      <span
        data-testid={`avatar-${name.replace(/\s+/g, '-').toLowerCase()}`}
        className={`inline-flex items-center justify-center rounded-full overflow-hidden shrink-0 select-none ${className}`}
        style={{
          width: size,
          height: size,
          boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.05)',
        }}
      >
        <img
          src={photo}
          alt={name}
          width={size}
          height={size}
          loading="lazy"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </span>
    );
  }

  const a = avatarFor(name);
  // v19 — neutral avatar fallback. No per-sender hue, no gradient.
  // Soft glass circle with 2 initials in dark gray. Matches .lg-pill vibe.
  return (
    <span
      data-testid={`avatar-${name.replace(/\s+/g, '-').toLowerCase()}`}
      className={`inline-flex items-center justify-center rounded-full font-semibold select-none bg-foreground/[0.07] dark:bg-white/[0.10] text-foreground/75 ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(11, Math.round(size * 0.36)),
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6), inset 0 0 0 1px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.04)',
        letterSpacing: '-0.02em',
      }}
    >
      {a.initials}
    </span>
  );
}
