import { useLocation } from 'wouter';
import { StiltAvatar } from './Avatar';
import { useStilt } from '@/state/StiltContext';
import { formatInboxTime } from '@/lib/avatar';
import { useInboxSettings } from '@/lib/inboxSettings';
import type { Mail } from '@/data/mockEmails';
import { SwipeableRow } from './SwipeableRow';

// ─────────────────────────────────────────────────────────────────
// v16 — Hover-action icon cluster removed (Done / Snooze / Reply).
// Desktop now uses the same swipe gesture as mobile (handled inside
// SwipeableRow with mouse drag). LEFT swipe → Done. RIGHT swipe → Snooze.
//
// HoverActionButton is kept exported for any legacy callers (e.g. the
// search-result rows) but is no longer rendered inline by MailRow.
// ─────────────────────────────────────────────────────────────────
export function MailRow({ mail, active }: { mail: Mail; active?: boolean }) {
  const [, navigate] = useLocation();
  const { setMailStatus } = useStilt();
  const [{ showTimestamps }] = useInboxSettings();

  return (
    <SwipeableRow
      testId={`row-mail-${mail.id}`}
      onCommit={(which) => setMailStatus(mail.id, which === 'done' ? 'done' : 'snoozed')}
      onClick={() => navigate(`/mail/${mail.id}`)}
      className={`rounded-2xl px-4 py-3 flex items-center gap-3 ${active ? 'bg-foreground/[0.05] dark:bg-white/[0.06]' : ''}`}
    >
      <StiltAvatar name={mail.from.name} size={36} className="shrink-0" />

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-semibold text-[15px] truncate tracking-[-0.005em] text-foreground">
              {mail.from.name}
            </span>
            {mail.isThread && mail.threadCount && (
              <span
                data-testid={`thread-badge-${mail.id}`}
                className="shrink-0 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full px-1 text-[10.5px] font-semibold tabular-nums bg-foreground/[0.08] dark:bg-white/[0.10] text-foreground/70"
                aria-label={`${mail.threadCount} messages in thread`}
              >
                {mail.threadCount}
              </span>
            )}
          </div>
          {showTimestamps && (
            <span className="text-[13px] text-muted-foreground shrink-0 font-normal tabular-nums whitespace-nowrap">
              {formatInboxTime(mail.ts)}
            </span>
          )}
        </div>
        <div className="text-[14px] text-muted-foreground truncate leading-snug mt-[1px] font-normal">
          {mail.isThread ? mail.subject.replace(/^Re:\s*/, '') + ' · ' + mail.preview : mail.preview}
        </div>
      </div>
    </SwipeableRow>
  );
}

// Kept for any consumer that still imports it (e.g. specialized rows).
// No longer rendered by MailRow / SmartMailRow themselves.
export function HoverActionButton({
  onClick,
  label,
  testId,
  children,
}: {
  onClick: (e: React.MouseEvent) => void;
  label: string;
  testId?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      data-testid={testId}
      onClick={onClick}
      aria-label={label}
      title={label}
      className="h-7 w-7 rounded-full glass-pill flex items-center justify-center hover-elevate active-elevate-2"
    >
      {children}
    </button>
  );
}
