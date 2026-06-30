// ─────────────────────────────────────────────────────────────────
// v15 — Snooze popover. Floats above a 52×52 glass Clock button.
//
// Props are minimal: an `onPick` callback that fires with a chosen
// option key. The popover positions itself relative to the trigger
// via `anchor` ('top' for above-the-button on bottom action area,
// 'bottom' for below in the top action area).
// ─────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock } from 'lucide-react';
import { APPLE_SPRING } from '@/lib/motion';

export type SnoozeKey = '1h' | 'tomorrow' | 'nextweek' | 'pick';

export function SnoozeButton({
  onPick,
  testId = 'button-snooze',
  anchor = 'bottom',
}: {
  onPick: (key: SnoozeKey) => void;
  testId?: string;
  anchor?: 'top' | 'bottom';
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (wrapRef.current && !wrapRef.current.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const options: { key: SnoozeKey; label: string }[] = [
    { key: '1h', label: '1 hour' },
    { key: 'tomorrow', label: 'Tomorrow' },
    { key: 'nextweek', label: 'Next week' },
    { key: 'pick', label: 'Pick a time…' },
  ];

  const positionStyle =
    anchor === 'top'
      ? { top: 60, right: 0 as const }
      : { bottom: 60, right: 0 as const };

  return (
    <div ref={wrapRef} className="pointer-events-auto relative flex items-center">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: anchor === 'top' ? -4 : 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: anchor === 'top' ? -4 : 4 }}
            transition={APPLE_SPRING}
            style={{
              position: 'absolute',
              transformOrigin: anchor === 'top' ? 'top right' : 'bottom right',
              ...positionStyle,
            }}
            className="flex flex-col gap-1.5 min-w-[180px]"
            data-testid="snooze-popover"
          >
            {options.map((opt) => (
              <button
                key={opt.key}
                type="button"
                data-testid={`snooze-opt-${opt.key}`}
                onClick={() => {
                  setOpen(false);
                  onPick(opt.key);
                }}
                className="glass-pill pill h-11 flex items-center gap-2.5 px-4 text-[14px] font-medium text-foreground active-elevate-2 hover-elevate"
              >
                <Clock size={16} strokeWidth={1.5} className="shrink-0 text-foreground/75" />
                <span>{opt.label}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        data-testid={testId}
        aria-label="Snooze"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="glass-pill h-[44px] w-[44px] rounded-full flex items-center justify-center active-elevate-2 hover-elevate text-foreground"
      >
        <Clock size={20} strokeWidth={1.5} />
      </button>
    </div>
  );
}
