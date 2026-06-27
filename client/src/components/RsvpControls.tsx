import { motion } from 'framer-motion';
import { Check, HelpCircle, X } from 'lucide-react';
import { StiltAvatar } from '@/components/Avatar';
import { useStilt } from '@/state/StiltContext';
import type { CalEvent, RsvpStatus } from '@/data/mockEvents';

export function useEffectiveRsvp(evt: CalEvent): RsvpStatus | undefined {
  const { rsvpOverrides } = useStilt();
  return rsvpOverrides[evt.id] ?? evt.rsvpStatus;
}

export function RsvpStatusIcon({ status }: { status?: RsvpStatus }) {
  if (status === 'going') return <Check size={12} strokeWidth={2.4} className="text-[#34C759]" />;
  if (status === 'maybe') return <HelpCircle size={12} strokeWidth={2.2} className="text-icon-muted" />;
  if (status === 'declined') return <X size={12} strokeWidth={2.4} className="text-[#FF453A]" />;
  return null;
}

export function rsvpLabel(s?: RsvpStatus): string {
  if (s === 'going') return 'Going';
  if (s === 'maybe') return 'Maybe';
  if (s === 'declined') return 'Not going';
  return 'Pending';
}

/** Compact inline RSVP toggle. Used in the detail sheet AND inside "Needs your response" cards. */
export function InlineRsvpToggle({
  evt,
  size = 'md',
}: {
  evt: CalEvent;
  size?: 'md' | 'sm';
}) {
  const { setRsvp } = useStilt();
  const current = useEffectiveRsvp(evt);
  const opts: { key: RsvpStatus; label: string; icon: React.ReactNode; tone: string }[] = [
    { key: 'going', label: 'Going', icon: <Check size={size === 'sm' ? 12 : 13} strokeWidth={2.3} />, tone: 'text-[#34C759]' },
    { key: 'maybe', label: 'Maybe', icon: <HelpCircle size={size === 'sm' ? 12 : 13} strokeWidth={2.1} />, tone: 'text-foreground/65' },
    { key: 'declined', label: 'Not going', icon: <X size={size === 'sm' ? 12 : 13} strokeWidth={2.3} />, tone: 'text-[#FF453A]' },
  ];
  const h = size === 'sm' ? 32 : 38;
  const padX = size === 'sm' ? 8 : 10;
  const fs = size === 'sm' ? 12 : 13;
  return (
    <div
      role="radiogroup"
      aria-label="Your RSVP"
      className="glass-pill rounded-full flex items-center gap-0.5 p-1 w-full justify-between"
      style={{ height: h }}
    >
      {opts.map((o) => {
        const active = current === o.key;
        return (
          <button
            key={o.key}
            role="radio"
            aria-checked={active}
            data-testid={`rsvp-${o.key}-${evt.id}`}
            onClick={(e) => {
              e.stopPropagation();
              setRsvp(evt.id, o.key);
              if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(10);
            }}
            className={[
              'relative flex-1 h-full rounded-full inline-flex items-center justify-center gap-1.5 transition-colors',
              active ? 'text-foreground' : 'text-foreground/55 hover:text-foreground/80',
            ].join(' ')}
            style={{ paddingLeft: padX, paddingRight: padX, fontSize: fs }}
          >
            {active && (
              <motion.span
                layoutId={`rsvp-indicator-${evt.id}`}
                transition={{ type: 'spring', stiffness: 520, damping: 38 }}
                className="absolute inset-0 rounded-full bg-foreground/[0.08] dark:bg-white/[0.10] ring-1 ring-foreground/[0.10] dark:ring-white/[0.14]"
              />
            )}
            <span className={`relative inline-flex items-center gap-1.5 ${active ? o.tone : ''}`}>
              {o.icon}
              <span className="font-medium tracking-[-0.005em] whitespace-nowrap">{o.label}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Detail-sheet RSVP block with section header */
export function RsvpSection({ evt }: { evt: CalEvent }) {
  const current = useEffectiveRsvp(evt);
  const hasInviteSemantics = (evt.participants && evt.participants.length > 0) || !!evt.rsvpStatus;
  if (!hasInviteSemantics) return null;
  return (
    <div className="mt-5">
      <div className="text-[11px] uppercase tracking-wider font-semibold text-foreground/55 mb-2">
        Your response
      </div>
      <InlineRsvpToggle evt={evt} />
      {(!current || current === 'pending') && (
        <div className="text-[11.5px] text-muted-foreground mt-1.5 text-center">Tap to respond</div>
      )}
    </div>
  );
}

/** Participants section with summary counts + RSVP icon per person */
export function ParticipantsSection({ participants }: { participants: NonNullable<CalEvent['participants']> }) {
  const going = participants.filter((p) => p.rsvp === 'going').length;
  const maybe = participants.filter((p) => p.rsvp === 'maybe').length;
  const pending = participants.filter((p) => !p.rsvp || p.rsvp === 'pending').length;
  const declined = participants.filter((p) => p.rsvp === 'declined').length;
  const summary: string[] = [];
  if (going) summary.push(`${going} going`);
  if (maybe) summary.push(`${maybe} maybe`);
  if (declined) summary.push(`${declined} declined`);
  if (pending) summary.push(`${pending} pending`);
  return (
    <div className="mt-5">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] uppercase tracking-wider font-semibold text-foreground/55">
          Participants
        </div>
        <div className="text-[11px] text-muted-foreground">{summary.join(' · ')}</div>
      </div>
      <div className="flex flex-col gap-2">
        {participants.map((p) => (
          <div key={p.email} className="flex items-center gap-2.5">
            <StiltAvatar name={p.name} size={32} />
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-medium truncate">{p.name}</div>
              <div className="text-[11.5px] text-muted-foreground truncate">{p.email}</div>
            </div>
            <div
              aria-label={`RSVP ${rsvpLabel(p.rsvp)}`}
              className="shrink-0 h-6 px-2 rounded-full inline-flex items-center justify-center gap-1 text-[10.5px] font-medium glass-pill"
            >
              {p.rsvp && p.rsvp !== 'pending' ? (
                <RsvpStatusIcon status={p.rsvp} />
              ) : (
                <span className="text-foreground/45">—</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
