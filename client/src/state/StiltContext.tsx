import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { mockEmails, type Mail, type MailStatus, type MailCategory } from '@/data/mockEmails';
import { MOCK_CAMPAIGNS, type Campaign } from '@/data/mockCampaigns';

type Theme = 'light' | 'dark' | 'auto';
type Category = MailCategory | 'done';
export type ViewMode = 'inbox' | 'smart';

// View-selector state for the inbox (conversation) surface.
export type MailView = 'inbox' | 'snoozed' | 'sent' | 'done' | 'drafts' | 'spam';

// Replaiy AI settings — only toggles that apply to LinkedIn outbound.
interface AISettings {
  summary: boolean;
  smartReply: boolean;
}

interface StiltState {
  mails: Mail[];
  setMailStatus: (id: string, status: MailStatus) => void;
  // Replaiy — campaigns (inbox-style list + detail). Shared so the list,
  // the detail pane, and the create-view all read/write the same data.
  campaigns: Campaign[];
  addCampaign: (c: Campaign) => void;
  updateCampaign: (id: string, patch: Partial<Campaign>) => void;
  /** Replaiy — start a fresh empty conversation with a lead. Creates a
   *  new empty Mail (no messages) and returns its id so the caller can
   *  navigate to /mail/:id (the normal conversation view + reply bar). */
  startConversationWith: (lead: {
    name: string;
    email?: string;
    avatar?: string;
    leadHeadline?: string;
    leadCompany?: string;
    leadLocation?: string;
  }) => string;
  composePrefill: { to?: string; subject?: string; body?: string; replyToId?: string } | null;
  setComposePrefill: (v: StiltState['composePrefill']) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  effectiveDark: boolean;
  category: Category;
  setCategory: (c: Category) => void;
  viewMode: ViewMode;
  setViewMode: (v: ViewMode) => void;
  // GLOBAL Smart toggle for the AI-curated conversation view.
  smartMode: boolean;
  setSmartMode: (v: boolean) => void;
  // Inbox view selector state.
  mailView: MailView;
  setMailView: (v: MailView) => void;
  query: string;
  setQuery: (q: string) => void;
  ai: AISettings;
  setAI: (a: Partial<AISettings>) => void;
  showShortcuts: boolean;
  setShowShortcuts: (b: boolean) => void;
  dotsMenuOpen: boolean;
  setDotsMenuOpen: (b: boolean) => void;
  /** True when any global bottom-sheet/overlay is open. Drives FAB hide. */
  sheetOpen: boolean;
  setSheetOpen: (b: boolean) => void;
  /** v18 — Inline Summary panel (desktop) / bottom-sheet (mobile). Persists across mail navigation. */
  summaryPanelOpen: boolean;
  setSummaryPanelOpen: (b: boolean) => void;
  toggleSummaryPanel: () => void;
  /** v18 — Contact+Linked side-sheet (desktop) / bottom-sheet (mobile). Persists across mail navigation. */
  /** Back-compat alias for v17 callers. Maps to summaryPanelOpen. */
  contextPanelOpen: boolean;
  setContextPanelOpen: (b: boolean) => void;
  toggleContextPanel: () => void;
}

const Ctx = createContext<StiltState | null>(null);

function detectSystemDark(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function StiltProvider({ children }: { children: React.ReactNode }) {
  const [mails, setMails] = useState<Mail[]>(mockEmails);
  const [campaigns, setCampaigns] = useState<Campaign[]>(MOCK_CAMPAIGNS);
  const [composePrefill, setComposePrefill] = useState<StiltState['composePrefill']>(null);
  const [theme, setTheme] = useState<Theme>('auto');
  const [systemDark, setSystemDark] = useState<boolean>(detectSystemDark());
  const [category, setCategory] = useState<Category>('primary');
  const [viewMode, setViewMode] = useState<ViewMode>('smart');
  // v15.4 — Default Smart ON. Single state used by all 3 surfaces.
  const [smartMode, setSmartMode] = useState<boolean>(true);
  const [mailView, setMailView] = useState<MailView>('inbox');
  const [query, setQuery] = useState('');
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [dotsMenuOpen, setDotsMenuOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [summaryPanelOpen, setSummaryPanelOpenState] = useState(false);
  const setSummaryPanelOpen = useCallback((b: boolean) => setSummaryPanelOpenState(b), []);
  const toggleSummaryPanel = useCallback(() => setSummaryPanelOpenState((v) => !v), []);
  // v17 back-compat aliases.
  const contextPanelOpen = summaryPanelOpen;
  const setContextPanelOpen = setSummaryPanelOpen;
  const toggleContextPanel = toggleSummaryPanel;
  const [ai, setAIState] = useState<AISettings>({
    summary: true,
    smartReply: true,
  });

  // Watch system theme
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const h = () => setSystemDark(mq.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);

  const effectiveDark = theme === 'dark' || (theme === 'auto' && systemDark);

  // Apply class to <html>
  useEffect(() => {
    const root = document.documentElement;
    if (effectiveDark) root.classList.add('dark');
    else root.classList.remove('dark');
  }, [effectiveDark]);

  const setMailStatus = useCallback((id: string, status: MailStatus) => {
    setMails((prev) => prev.map((m) => (m.id === id ? { ...m, status } : m)));
  }, []);

  const startConversationWith = useCallback(
    (lead: {
      name: string;
      email?: string;
      avatar?: string;
      leadHeadline?: string;
      leadCompany?: string;
      leadLocation?: string;
    }) => {
      const id = `new-${Date.now()}`;
      const newMail: Mail = {
        id,
        from: { name: lead.name, email: lead.email ?? '', avatar: lead.avatar },
        contact: {
          title: lead.leadHeadline,
          company: lead.leadCompany,
          location: lead.leadLocation,
        },
        to: 'me',
        subject: '',
        preview: '',
        body: '',
        ts: new Date().toISOString(),
        status: 'open',
        category: 'primary',
        priority: 'normal',
        needsReply: false,
        summary: '',
        smartReplies: ['', '', ''],
        leadHeadline: lead.leadHeadline,
        leadCompany: lead.leadCompany,
        leadLocation: lead.leadLocation,
        // Empty thread — ConversationTimeline renders the lead header + an
        // empty timeline with the reply/draft bar at the bottom.
        messages: [],
      };
      setMails((prev) => [newMail, ...prev]);
      return id;
    },
    []
  );

  const setAI = useCallback((patch: Partial<AISettings>) => {
    setAIState((prev) => ({ ...prev, ...patch }));
  }, []);

  const addCampaign = useCallback((c: Campaign) => {
    setCampaigns((prev) => [c, ...prev]);
  }, []);
  const updateCampaign = useCallback(
    (id: string, patch: Partial<Campaign>) => {
      setCampaigns((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...patch } : c))
      );
    },
    []
  );

  const value = useMemo<StiltState>(
    () => ({
      mails,
      setMailStatus,
      campaigns,
      addCampaign,
      updateCampaign,
      startConversationWith,
      composePrefill,
      setComposePrefill,
      theme,
      setTheme,
      effectiveDark,
      category,
      setCategory,
      viewMode,
      setViewMode,
      smartMode,
      setSmartMode,
      mailView,
      setMailView,
      query,
      setQuery,
      ai,
      setAI,
      showShortcuts,
      setShowShortcuts,
      dotsMenuOpen,
      setDotsMenuOpen,
      sheetOpen,
      setSheetOpen,
      summaryPanelOpen,
      setSummaryPanelOpen,
      toggleSummaryPanel,
      contextPanelOpen,
      setContextPanelOpen,
      toggleContextPanel,
    }),
    [mails, setMailStatus, campaigns, addCampaign, updateCampaign, startConversationWith, composePrefill, theme, effectiveDark, category, viewMode, smartMode, mailView, query, ai, setAI, showShortcuts, dotsMenuOpen, sheetOpen, summaryPanelOpen, setSummaryPanelOpen, toggleSummaryPanel, contextPanelOpen, setContextPanelOpen, toggleContextPanel]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStilt() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStilt must be used inside StiltProvider');
  return v;
}
