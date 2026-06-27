import { avatarFor } from '@/lib/avatar';

interface AvatarProps {
  name: string;
  size?: number;
  className?: string;
}

// Deterministic photo avatars for a curated set of human senders.
// We mix real-looking portraits (pravatar) with initial-circles for company senders.
const PHOTO_SENDERS: Record<string, string> = {
  'Nora Chen':         'https://i.pravatar.cc/120?img=47',
  'Marcus Webb':       'https://i.pravatar.cc/120?img=12',
  'Elena Park':        'https://i.pravatar.cc/120?img=49',
  'Jordan Reilly':     'https://i.pravatar.cc/120?img=15',
  'Devon Mathers':     'https://i.pravatar.cc/120?img=33',
  'Maya Iyer':         'https://i.pravatar.cc/120?img=44',
  'Sam Okafor':        'https://i.pravatar.cc/120?img=68',
  'Avery Tan':         'https://i.pravatar.cc/120?img=20',
  'Emma Larsen':       'https://i.pravatar.cc/120?img=5',
  'Tomás Reyes':       'https://i.pravatar.cc/120?img=60',
};

export function StiltAvatar({ name, size = 40, className = '' }: AvatarProps) {
  const photo = PHOTO_SENDERS[name];

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
