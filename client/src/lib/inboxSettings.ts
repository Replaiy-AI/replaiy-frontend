// v30.34 — Inbox UI preferences (localStorage-backed).
//
// Why localStorage and not a context provider: deze settings worden door
// veel rows en panels gelezen en zelden geschreven. Een storage-event
// listener houdt alle tabs sync zonder dat we de hele tree door een
// provider hoeven te wrappen.
//
// Voeg hier in de toekomst andere kleine inbox-prefs aan toe (compact
// density, show sender domain, etc.) zodat ze één plek hebben.

import { useEffect, useState } from 'react';

export interface InboxSettings {
  /** v30.34 — toon relatieve timestamp op elke row (1m / 11h / May 12). */
  showTimestamps: boolean;
}

const STORAGE_KEY = 'replaiy:inbox-settings:v1';
const DEFAULTS: InboxSettings = {
  showTimestamps: true,
};

function readFromStorage(): InboxSettings {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...parsed };
  } catch {
    return DEFAULTS;
  }
}

function writeToStorage(next: InboxSettings) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    // Cross-component sync (storage event vuurt niet in dezelfde tab,
    // dus dispatch handmatig een custom event).
    window.dispatchEvent(new CustomEvent('replaiy:inbox-settings'));
  } catch {
    /* ignore */
  }
}

export function useInboxSettings(): [
  InboxSettings,
  (patch: Partial<InboxSettings>) => void,
] {
  const [settings, setSettings] = useState<InboxSettings>(() => readFromStorage());

  useEffect(() => {
    const handler = () => setSettings(readFromStorage());
    window.addEventListener('replaiy:inbox-settings', handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('replaiy:inbox-settings', handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  const update = (patch: Partial<InboxSettings>) => {
    const next = { ...readFromStorage(), ...patch };
    writeToStorage(next);
    setSettings(next);
  };

  return [settings, update];
}
