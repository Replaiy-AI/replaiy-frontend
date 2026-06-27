// Replaiy — Campaign on/off switch.
//
// Identical in shape and motion to the Settings.tsx Toggle (h-[28px] w-[46px]
// rounded-full track, h-[22px] w-[22px] spring knob), with one deliberate
// difference: the "on" track uses var(--ai-accent) (Replaiy blue) instead of
// the neutral foreground, so an active campaign reads as "live" without
// introducing a second accent or status color anywhere else.

import { motion } from 'framer-motion';

export function CampaignToggle({
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
  return (
    <button
      type="button"
      data-testid={testId}
      aria-label={ariaLabel}
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-[28px] w-[46px] items-center rounded-full transition-colors ${
        on ? '' : 'bg-foreground/15'
      }`}
      style={on ? { background: 'var(--ai-accent)' } : undefined}
      role="switch"
      aria-checked={on}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className={`inline-block h-[22px] w-[22px] rounded-full bg-white ${
          on ? 'ml-[21px]' : 'ml-[3px]'
        }`}
        style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.1), 0 2px 6px rgba(0,0,0,0.15)' }}
      />
    </button>
  );
}
