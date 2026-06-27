// ─────────────────────────────────────────────────────────────────
// Shared recipient chip used by InlineReplyBar and ComposeModal.
//
// Two variants:
//   • Plain — email-only chip (used by Reply/Forward in InlineReplyBar).
//   • Avatar — avatar + display name chip (Compose). When `name` is
//     provided we render the avatar-rich version; otherwise we fall
//     back to the plain email pill.
// ─────────────────────────────────────────────────────────────────
import { X } from 'lucide-react';
import { StiltAvatar } from './Avatar';

export interface RecipientChipProps {
  email: string;
  name?: string;
  onRemove: () => void;
}

export function RecipientChip({ email, name, onRemove }: RecipientChipProps) {
  if (name) {
    // Avatar + name variant — Compose pattern.
    return (
      <span
        data-testid={`recipient-chip-${email}`}
        className="inline-flex items-center gap-1.5 h-8 pl-1 pr-1.5 rounded-full bg-foreground/[0.06] text-[13px] font-medium tracking-[-0.005em] text-foreground/85 shrink-0"
      >
        <StiltAvatar name={name} size={24} />
        <span className="truncate max-w-[180px]">{name}</span>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${name}`}
          className="h-6 w-6 rounded-full flex items-center justify-center text-foreground/55 hover:text-foreground hover:bg-foreground/10"
        >
          <X size={13} strokeWidth={2.2} />
        </button>
      </span>
    );
  }

  // Plain email variant — Reply pattern.
  return (
    <span
      data-testid={`recipient-chip-${email}`}
      className="inline-flex items-center gap-1.5 h-8 pl-3 pr-1.5 rounded-full bg-foreground/[0.06] text-[13px] font-medium tracking-[-0.005em] text-foreground/85 shrink-0"
    >
      <span className="truncate max-w-[200px]">{email}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${email}`}
        className="h-6 w-6 rounded-full flex items-center justify-center text-foreground/55 hover:text-foreground hover:bg-foreground/10"
      >
        <X size={13} strokeWidth={2.2} />
      </button>
    </span>
  );
}

export default RecipientChip;
