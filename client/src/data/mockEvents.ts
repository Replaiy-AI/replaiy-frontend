// Mock calendar events for the Stilt calendar surface.
// Times are computed relative to "today" so the calendar always feels
// fresh, but the static day-of-week layout is preserved.

export type EventCategory = 'work' | 'personal' | 'focus' | 'travel';
export type AccountId = 'google' | 'microsoft' | 'apple' | 'personal';

export type RsvpStatus = 'going' | 'maybe' | 'declined' | 'pending';

export interface EventParticipant {
  name: string;
  email: string;
  rsvp?: RsvpStatus;
}

export interface CalEvent {
  id: string;
  title: string;
  start: string; // ISO
  end: string;   // ISO
  category: EventCategory;
  location?: string;       // physical
  videoLink?: string;      // Zoom / Meet
  description?: string;
  participants?: EventParticipant[];
  aiContext?: string;      // short AI-generated context line
  aiSuggestReschedule?: boolean;
  isFocusBlock?: boolean;
  isSuggestion?: boolean;  // AI-suggested, not yet on real calendar
  account?: AccountId;     // which connected account this event lives on
  // YOUR rsvp status on this invite
  rsvpStatus?: RsvpStatus; // 'pending' = invite awaiting your response
  rsvpReason?: string;     // short AI nudge explaining urgency
}

export interface AccountInfo {
  id: AccountId;
  provider: 'Google' | 'Microsoft' | 'Apple' | 'Personal';
  email: string;
  color: string; // dot color
}

export const accounts: AccountInfo[] = [
  { id: 'google',    provider: 'Google',    email: 'simon@beldoo.nl',   color: '#20B8A6' },
  { id: 'microsoft', provider: 'Microsoft', email: 'simon@stilt.app',   color: '#FF9F0A' },
  { id: 'apple',     provider: 'Apple',     email: 'simon@icloud.com',  color: '#8E8E93' },
  { id: 'personal',  provider: 'Personal',  email: 'personal',           color: '#20B8A6' },
];

export function accountColor(id?: AccountId): string {
  return accounts.find((a) => a.id === id)?.color ?? '#8E8E93';
}

export function accountInfo(id?: AccountId): AccountInfo | undefined {
  return accounts.find((a) => a.id === id);
}

function dt(dayOffset: number, h: number, m: number = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

// Sunday of THIS week -> dayOffset to Monday is 1 - jsDay (jsDay: 0=Sun..6=Sat)
function offsetToWeekday(weekday: number): number {
  // weekday: 1=Mon..7=Sun
  const today = new Date();
  const jsDay = today.getDay(); // 0=Sun..6=Sat
  const todayWeekday = jsDay === 0 ? 7 : jsDay;
  return weekday - todayWeekday;
}

export const mockEvents: CalEvent[] = [
  // TODAY
  {
    id: 'evt-1',
    title: 'Board prep with Nora',
    start: dt(0, 9, 30),
    end: dt(0, 10, 15),
    category: 'work',
    account: 'google',
    videoLink: 'https://meet.google.com/abc-defg-hij',
    participants: [{ name: 'Nora Chen', email: 'nora.chen@northbeam.co' }],
    aiContext: 'Critical \u2014 Nora needs the pricing decision before Friday',
    description: 'Walk through the metered-pricing margin model before the Friday board.',
  },
  {
    id: 'evt-2',
    title: '1:1 with Marcus',
    start: dt(0, 11, 0),
    end: dt(0, 11, 30),
    category: 'work',
    account: 'microsoft',
    videoLink: 'https://zoom.us/j/4421',
    participants: [{ name: 'Marcus Webb', email: 'marcus@figma.com' }],
    aiContext: 'Marcus asked about onboarding empty-state copy \u2014 bring v3 mocks',
  },
  {
    id: 'evt-focus-today',
    title: 'Deep work \u2014 Q4 roadmap',
    start: dt(0, 14, 0),
    end: dt(0, 16, 0),
    category: 'focus',
    account: 'google',
    isFocusBlock: true,
    aiContext: 'Protected: your only 2-hour gap today',
  },
  {
    id: 'evt-3',
    title: 'School pickup',
    start: dt(0, 17, 0),
    end: dt(0, 17, 30),
    category: 'personal',
    account: 'apple',
    location: 'Eliot Elementary',
  },

  // TOMORROW
  {
    id: 'evt-4',
    title: 'Founder coffee \u2014 Alex',
    start: dt(1, 9, 0),
    end: dt(1, 9, 45),
    category: 'work',
    account: 'google',
    location: 'Sightglass, Mission',
    participants: [{ name: 'Alex Rivera', email: 'alex@parsec.io' }],
    aiContext: 'Alex is fundraising \u2014 useful to compare term sheets',
  },
  {
    id: 'evt-5',
    title: 'Weekly product sync',
    start: dt(1, 10, 30),
    end: dt(1, 11, 0),
    category: 'work',
    account: 'microsoft',
    videoLink: 'https://meet.google.com/xyz-1234-pqr',
    participants: [
      { name: 'Nora Chen', email: 'nora.chen@northbeam.co', rsvp: 'going' },
      { name: 'Marcus Webb', email: 'marcus@figma.com', rsvp: 'going' },
      { name: 'Priya Shah', email: 'priya@stilt.app', rsvp: 'maybe' },
      { name: 'Jordan Lee', email: 'jordan@signal-vc.com', rsvp: 'declined' },
    ],
    aiSuggestReschedule: true,
    aiContext: 'Moved 3 times this month \u2014 consider cancelling',
  },

  // +2 days
  {
    id: 'evt-6',
    title: 'Dentist',
    start: dt(2, 8, 0),
    end: dt(2, 8, 45),
    category: 'personal',
    account: 'apple',
    location: 'Pacific Dental, Hayes Valley',
  },
  {
    id: 'evt-7',
    title: 'Investor update call',
    start: dt(2, 14, 0),
    end: dt(2, 14, 45),
    category: 'work',
    account: 'google',
    videoLink: 'https://zoom.us/j/5552',
    participants: [{ name: 'Jordan Lee', email: 'jordan@signal-vc.com' }],
    aiContext: 'Pull the latest ARR + retention numbers before this',
  },

  // +3 days: PENDING invite — "Needs your response"
  {
    id: 'evt-invite-1',
    title: 'Quarterly review with Sales',
    start: dt(3, 14, 0),
    end: dt(3, 15, 0),
    category: 'work',
    account: 'google',
    videoLink: 'https://meet.google.com/qsr-rev-q3',
    participants: [
      { name: 'Marcus Webb', email: 'marcus@figma.com', rsvp: 'going' },
      { name: 'Nora Chen', email: 'nora.chen@northbeam.co', rsvp: 'going' },
      { name: 'Priya Shah', email: 'priya@stilt.app', rsvp: 'going' },
      { name: 'Alex Rivera', email: 'alex@parsec.io', rsvp: 'maybe' },
    ],
    rsvpStatus: 'pending',
    rsvpReason: 'Required attendee \u2014 Sales lead asked you to confirm',
    aiContext: 'Marcus is also going \u2014 he asked you specifically yesterday',
  },

  // +3 days
  {
    id: 'evt-8',
    title: 'Flight to NYC',
    start: dt(3, 17, 30),
    end: dt(3, 22, 30),
    category: 'travel',
    account: 'personal',
    location: 'SFO \u2192 JFK \u00b7 UA 1428',
  },

  // +4 days
  {
    id: 'evt-9',
    title: 'Coffee with Sam (NYC)',
    start: dt(4, 10, 0),
    end: dt(4, 10, 45),
    category: 'work',
    account: 'microsoft',
    location: 'Devoci\u00f3n, Williamsburg',
    participants: [{ name: 'Sam Park', email: 'sam@hatchery.nyc' }],
  },

  // AI-suggested focus block (not on calendar yet)
  {
    id: 'evt-suggest-focus-1',
    title: '2 hr deep work block',
    start: dt(offsetToWeekday(3), 9, 0),
    end: dt(offsetToWeekday(3), 11, 0),
    category: 'focus',
    isFocusBlock: true,
    isSuggestion: true,
    account: 'google',
    aiContext: 'Wed morning is open and matches your peak focus window',
  },
];

export function categoryDot(c: EventCategory): string {
  switch (c) {
    case 'work':     return '#20B8A6';
    case 'personal': return '#30D158';
    case 'focus':    return '#20B8A6';
    case 'travel':   return '#FF9F0A';
  }
}

export function categoryLabel(c: EventCategory): string {
  switch (c) {
    case 'work':     return 'Work';
    case 'personal': return 'Personal';
    case 'focus':    return 'Focus';
    case 'travel':   return 'Travel';
  }
}

export function hhmm(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

export function durationLabel(startIso: string, endIso: string): string {
  const mins = Math.round((+new Date(endIso) - +new Date(startIso)) / 60000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function eventsOn(date: Date, events: CalEvent[]): CalEvent[] {
  return events
    .filter((e) => !e.isSuggestion && sameDay(new Date(e.start), date))
    .sort((a, b) => +new Date(a.start) - +new Date(b.start));
}
