import { useEffect } from 'react';

// ─────────────────────────────────────────────────────────────────
// v17 — useKeyboardShortcuts
//
// Registers a keydown listener that only fires when:
//   • the user is on a mail-detail route (passed via `enabled`)
//   • no input/textarea/contentEditable element is focused
//
// Each key maps to a handler. Empty/undefined handlers are no-ops.
// Used for mail-detail shortcuts E (Done), S (Snooze), I (Context).
// ─────────────────────────────────────────────────────────────────

export interface KeyboardShortcutMap {
  [key: string]: ((e: KeyboardEvent) => void) | undefined;
}

export function useKeyboardShortcuts(
  shortcuts: KeyboardShortcutMap,
  enabled: boolean = true,
) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      // Guard: bail if focus is in an editable element. Typing "Snooze" in
      // a reply must NOT snooze the mail.
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          tag === 'SELECT' ||
          target.isContentEditable
        ) {
          return;
        }
      }
      // Ignore modifier-key combos.
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();
      const fn = shortcuts[key];
      if (fn) {
        e.preventDefault();
        fn(e);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [enabled, shortcuts]);
}
