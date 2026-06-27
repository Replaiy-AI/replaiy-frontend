import { senderAvatarHue, initials } from '@/data/mockConversations';

export function avatarFor(name: string) {
  const hue = senderAvatarHue(name);
  return {
    hue,
    bg: `hsl(${hue} 55% 90%)`,
    bgDark: `hsl(${hue} 35% 22%)`,
    fg: `hsl(${hue} 60% 32%)`,
    fgDark: `hsl(${hue} 80% 80%)`,
    initials: initials(name),
  };
}

export function timeAgo(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const bucket = timeBucket(iso);
  // For today/yesterday, show HH:MM (24-hour)
  if (bucket === 'today' || bucket === 'yesterday') {
    const h = d.getHours().toString();
    const m = d.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  }
  if (bucket === 'thisWeek') {
    const h = d.getHours().toString();
    const m = d.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function timeBucket(iso: string): 'today' | 'yesterday' | 'thisWeek' | 'earlier' {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor(
    (new Date(now.toDateString()).getTime() - new Date(d.toDateString()).getTime()) /
      (1000 * 60 * 60 * 24)
  );
  if (diffDays <= 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return 'thisWeek';
  return 'earlier';
}

// v30.34 — simple, consistent relative timestamp for inbox rows.
// Altijd hetzelfde formaat ongeacht status/category zodat de inbox
// strak uitlijnt: 1m / 11h / 2d / May 12.
export function formatInboxTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - d.getTime());
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHr < 24) return `${diffHr}h`;
  if (diffDay < 7) return `${diffDay}d`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// v20.1 — relative "state tag" used in mail rows in place of HH:MM timestamps.
// Produces things like `New · 1h`, `Waiting · 2d`, `Snoozed · 9am`.
// Returns null for newsletters / FYI rows where the time is irrelevant.
export function stateTag(
  iso: string,
  status: 'open' | 'waiting' | 'snoozed' | 'done',
  category?: string
): string | null {
  // Newsletters & promos in "Quick to clear" don't need a state tag.
  if (category === 'newsletter' || category === 'promo') return null;

  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.max(0, Math.floor(diffMs / 60000));
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  const rel =
    diffMin < 60 ? `${diffMin || 1}m` :
    diffHr < 24 ? `${diffHr}h` :
    diffDay < 7 ? `${diffDay}d` :
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  if (status === 'waiting') return `Waiting · ${rel}`;
  if (status === 'snoozed') return `Snoozed · ${rel}`;
  if (status === 'done')    return `Done · ${rel}`;
  // status === 'open' — fresh items get a "New" tag; older ones just show relative time.
  if (diffHr < 6) return `New · ${rel}`;
  return rel;
}
