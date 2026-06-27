// Replaiy — Campaign on/off switch (glass, NOT coloured).
//
// The user was explicit: "niet een aanwezige kleur... juist clean houden,
// glass erin." So the track is the app's own glass material (.glass-pill) —
// never a blue fill and never a flat grey block. On/off is communicated by:
//   • thumb POSITION (right = on, left = off), with the spring-knob motion, and
//   • a subtle state difference — the track reads as a brighter / filled glass
//     when on (data-active, the same recipe the rail pills use) and dims
//     slightly when off.
// No loud colour. Calm and premium, consistent with the rail buttons / pills.

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
      role="switch"
      aria-checked={on}
      // glass-pill = the app's glass material; data-active gives it the
      // brighter "filled glass" the rail uses. Off → slightly dimmed.
      data-active={on ? 'true' : undefined}
      className={`glass-pill relative inline-flex h-[28px] w-[46px] items-center rounded-full transition-opacity ${
        on ? '' : 'opacity-[0.78]'
      }`}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className={`inline-block h-[20px] w-[20px] rounded-full transition-colors ${
          on
            ? 'bg-foreground/90 dark:bg-white/90'
            : 'bg-foreground/45 dark:bg-white/55'
        } ${on ? 'ml-[23px]' : 'ml-[4px]'}`}
        style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.10), 0 1px 3px rgba(0,0,0,0.10)' }}
      />
    </button>
  );
}
