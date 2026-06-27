// Shared interactive list-row shell — ONE source of truth for the row chrome
// used by both the Inbox (SmartConversationRow) and Campaigns (CampaignRow). It owns
// exactly the interaction surface that must stay identical across the app:
//   • padding (px-4 py-3)
//   • hover-elevate + active-elevate-2 (the full-bleed glass highlight that
//     clips to the parent .stilt-card's rounded corners via overflow-hidden)
//   • the selected/active neutral fill (bg-foreground/[0.05])
//   • click-to-open
// The row CONTENT (mail vs campaign) is passed as children, so each screen
// keeps its own layout while the hover/selected behaviour can never drift.
import type { ReactNode } from 'react';

export function ListRow({
  children,
  onClick,
  active,
  testId,
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  active?: boolean;
  testId?: string;
  /** Extra classes for per-screen tweaks (e.g. an off-state dim). Never put
   *  rounding/margins here — the highlight must stay full-bleed like the inbox. */
  className?: string;
}) {
  return (
    <div
      data-testid={testId}
      onClick={onClick}
      className={`relative cursor-pointer select-none block px-4 py-3 hover-elevate active-elevate-2 ${
        active ? 'bg-foreground/[0.05] dark:bg-white/[0.06]' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}
