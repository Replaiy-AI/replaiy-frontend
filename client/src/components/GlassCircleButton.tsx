// v30.32 — Centrale ronde glass button component.
// Vervangt drie duplicated implementaties (VerticalRail, InboxList
// mobile chrome, ChromeButton in Chrome.tsx). Gebruikt overal exact
// dezelfde VadikGlass recipe — geen pill-in-pill, geen inconsistente
// kleuren, geen verschillende afmetingen tussen mobile en desktop.
//
// Variants:
//   • "icon" (default) — voor +/Search/Done/Snooze/Forward etc.
//   • "profile"        — toont initials letters direct in de pill,
//                        geen StiltAvatar-inner-circle.
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import VadikGlass from './VadikGlass';

interface Props {
  label: string;
  testId?: string;
  onClick?: () => void;
  children?: React.ReactNode;
  /** Optional box-shadow appended after the glass recipe (bv. AI glow). */
  glow?: string;
  /** Infinite subtle pulse (bv. voor active toggles). */
  pulse?: boolean;
  ariaPressed?: boolean;
  /** v30.34 — default false. Tooltip-popups bij hover voelen aan als
     desktop chrome dat we juist willen vermijden — elke icon-button
     spreekt voor zichzelf via z'n icoon. Aria-label blijft gezet voor
     accessibility (screenreaders). Zet showTooltip={true} alleen waar
     het label echt nodig is. */
  showTooltip?: boolean;
  /** Tooltip position relative to button (default 'right'). */
  tooltipSide?: 'right' | 'top' | 'bottom';
  /** Size in pixels (default 52). */
  size?: number;
}

export function GlassCircleButton({
  label,
  testId,
  onClick,
  children,
  glow,
  pulse,
  ariaPressed,
  showTooltip = false,
  tooltipSide = 'right',
  size = 52,
}: Props) {
  const [hover, setHover] = useState(false);

  const wrapperGlowStyle = glow ? { boxShadow: glow as string } : undefined;

  return (
    <motion.div
      className="relative flex items-center justify-center"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      animate={pulse ? { scale: [1, 1.02, 1] } : { scale: 1 }}
      transition={
        pulse
          ? { duration: 2, repeat: Infinity, ease: 'easeInOut' }
          : { type: 'spring', stiffness: 400, damping: 32 }
      }
    >
      <VadikGlass
        width={size}
        height={size}
        shape="circle"
        data-testid={testId}
        aria-label={label}
        aria-pressed={ariaPressed}
        onClick={onClick}
        wrapperStyle={wrapperGlowStyle}
      >
        {/* v30.35 — Default icon color = --icon-primary (icon color
           system, zie index.css). Eén token voor alle glass icon buttons.
           Children kunnen dit overschrijven via een eigen text-* class
           als ze een afwijkende state willen (bv. text-icon-accent voor
           sparkle/AI). */}
        <span
          className="flex items-center justify-center"
          style={{ color: 'var(--icon-primary)' }}
        >
          {children}
        </span>
      </VadikGlass>
      <AnimatePresence>
        {showTooltip && hover && (
          <motion.div
            key="tip"
            initial={{ opacity: 0, x: -4, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -4, scale: 0.95 }}
            transition={{ duration: 0.14, ease: [0.32, 0.72, 0, 1] }}
            className={
              tooltipSide === 'right'
                ? 'absolute left-full ml-2 z-50 pointer-events-none glass-pill pill px-3 py-1.5 text-[12.5px] font-medium whitespace-nowrap'
                : tooltipSide === 'top'
                  ? 'absolute bottom-full mb-2 z-50 pointer-events-none glass-pill pill px-3 py-1.5 text-[12.5px] font-medium whitespace-nowrap'
                  : 'absolute top-full mt-2 z-50 pointer-events-none glass-pill pill px-3 py-1.5 text-[12.5px] font-medium whitespace-nowrap'
            }
          >
            {label}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// v30.32 — Profile-pill content: initials letters direct in de glass.
// Was eerder een StiltAvatar fallback (eigen background + inset-shadow)
// die binnen GlassCircleButton een pill-in-pill effect gaf. Gebruik dit
// als child van GlassCircleButton voor de profile knop.
export function ProfileInitials({ initials }: { initials: string }) {
  // v30.34.1 — initials gebruiken nu het centrale icon-color token zodat
  // de profile button visueel matched aan Search/+ en alle andere glass
  // icon buttons. Was eerder text-foreground/80 (zwarter dan rest).
  return (
    <span
      data-glass-content
      className="text-[13px] font-semibold select-none"
      style={{ letterSpacing: '-0.01em', color: 'var(--icon-primary)' }}
    >
      {initials}
    </span>
  );
}

export default GlassCircleButton;
