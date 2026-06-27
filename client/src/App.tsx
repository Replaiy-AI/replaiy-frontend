import { Switch, Route, Router, useLocation, useParams, Link } from 'wouter';
import { useHashLocation } from 'wouter/use-hash-location';
import { queryClient } from './lib/queryClient';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useEffect, useState } from 'react';
import { StiltAvatar } from '@/components/Avatar';
import { timeAgo } from '@/lib/avatar';
import { StiltProvider, useStilt } from '@/state/StiltContext';
import { DesktopRail, MobileBottomNav, TabletLeftRail } from '@/components/Chrome';
import { MobileTopChromeProvider, MobileTopChromeShell } from '@/components/MobileTopChrome';
import { DotsMenuSheet } from '@/components/DotsMenuSheet';
import { InboxList } from '@/components/InboxList';
import { ConversationDetail } from '@/pages/ConversationDetail';
import { Briefing } from '@/pages/Briefing';
import { MijnAi } from '@/pages/MijnAi';
import { CampaignsList } from '@/components/CampaignsList';
import CampaignDetail from '@/pages/CampaignDetail';
import { StiltLogo } from '@/components/Logo';
import { UniversalSearch } from '@/components/UniversalSearch';
import { LiquidGlassFilters } from '@/components/LiquidGlassFilters';
import { AnimatePresence, motion } from 'framer-motion';

// v-replaiy — /settings is deprecated. The Stilt profile menu was removed
// (all fake template UI), so this route now simply redirects to the inbox
// so the route doesn't 404.
function SettingsRedirect() {
  const [, navigate] = useLocation();
  useEffect(() => {
    navigate('/');
  }, [navigate]);
  return null;
}

// v-replaiy — clean "Coming soon" placeholder in Stilt's empty-state style.
// Used for Calendar (content-only; same typography/layout as EmptyDetail,
// no new styles). The old working calendar implementation + its data were
// removed in the Stilt cleanup; the Calendar tab now points here.
function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
      <div className="mb-4">
        <StiltLogo size={56} />
      </div>
      <h2 className="text-[20px] font-semibold tracking-[-0.02em]">{title}</h2>
      <p className="text-[14px] text-muted-foreground mt-1.5 max-w-xs">Coming soon.</p>
    </div>
  );
}

function EmptyDetail() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
      <div className="mb-4">
        <StiltLogo size={56} />
      </div>
      <h2 className="text-[20px] font-semibold tracking-[-0.02em]">Select a conversation</h2>
      <p className="text-[14px] text-muted-foreground mt-1.5 max-w-xs">
        Choose a conversation to review the draft and reply. Your approved
        replies are sent straight to the lead.
      </p>
    </div>
  );
}

function Shortcuts() {
  const { showShortcuts, setShowShortcuts } = useStilt();
  return (
    <AnimatePresence>
      {showShortcuts && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowShortcuts(false)}
            className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 32 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 glass-strong rounded-3xl p-6 w-[min(420px,90vw)]"
          >
            <h3 className="text-[15px] font-semibold mb-4">Keyboard shortcuts</h3>
            <div className="space-y-2 text-[13px]">
              {[
                ['e', 'Done'],
                ['s', 'Snooze'],
                ['i', 'Context panel'],
                ['r', 'Reply'],
                ['j / k', 'Navigate up / down'],
                ['/', 'Search'],
                ['?', 'Show this menu'],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between">
                  <span className="text-foreground/85">{v}</span>
                  <kbd className="glass pill px-2.5 py-0.5 text-[11px] font-semibold">{k}</kbd>
                </div>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function KeyboardShortcuts() {
  const [loc, navigate] = useLocation();
  const { conversations, category, setConversationStatus, setShowShortcuts, toggleContextPanel } = useStilt();
  const params = useParams<{ id?: string }>();

  useEffect(() => {
    const visible = conversations.filter((m) => {
      if (category === 'done') return m.status === 'done';
      return m.status !== 'done' && m.category === category;
    });
    const handler = (e: KeyboardEvent) => {
      // ignore when typing in inputs
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        if (e.key === 'Escape') (target as HTMLInputElement).blur();
        return;
      }
      const key = e.key.toLowerCase();
      if (key === '?') {
        e.preventDefault();
        setShowShortcuts(true);
        return;
      }
      if (key === '/') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('stilt:open-search'));
        return;
      }
      // mail-specific
      const currentId = params.id || loc.replace('/conversation/', '');
      const idx = visible.findIndex((m) => m.id === currentId);
      if (key === 'j') {
        e.preventDefault();
        const next = visible[Math.min(visible.length - 1, idx + 1)];
        if (next) navigate(`/conversation/${next.id}`);
        return;
      }
      if (key === 'k') {
        e.preventDefault();
        const prev = visible[Math.max(0, idx - 1)];
        if (prev) navigate(`/conversation/${prev.id}`);
        return;
      }
      if (currentId && idx !== -1) {
        if (key === 'e') {
          e.preventDefault();
          setConversationStatus(currentId, 'done');
          const next = visible[idx + 1];
          navigate(next ? `/conversation/${next.id}` : '/');
        }
        if (key === 's') {
          e.preventDefault();
          // v17 — open the snooze picker rather than snoozing immediately.
          const snoozeBtn = document.querySelector<HTMLButtonElement>('[data-testid="button-snooze"]');
          snoozeBtn?.click();
        }
        if (key === 'i') {
          e.preventDefault();
          toggleContextPanel();
        }
        if (key === 'r') {
          e.preventDefault();
          const replyBtn = document.querySelector<HTMLButtonElement>('[data-testid="button-reply"]');
          replyBtn?.click();
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [loc, conversations, category, navigate, setConversationStatus, params.id, setShowShortcuts, toggleContextPanel]);

  return null;
}

function LayoutShell() {
  const [loc] = useLocation();

  // Determine right-pane content based on route
  const showingConversation = loc.startsWith('/conversation/');
  const showingBriefing = loc.startsWith('/briefing');
  const showingSettings = loc.startsWith('/settings');
  const showingArchive = loc.startsWith('/archive');
  const showingCalendar = loc.startsWith('/calendar');
  // v-replaiy — 'Mijn AI' surface (persona + knowledge). Eén volledige
  // pagina (zoals Calendar), geen list+detail: lijst-kolom verbergen en
  // de pagina full-width in de rechter-pane tonen.
  const showingAi = loc.startsWith('/ai');
  const showingCampaigns = loc.startsWith('/campaigns');
  // Campaigns behaves EXACTLY like the inbox: a fixed-width list column on the
  // left (with the briefing + roll-up + campaign list) that never changes when
  // you open a campaign, plus a detail/empty-state pane on the right. Opening a
  // campaign just highlights its row and fills the right pane — same as /mail.
  const showingCampaignDetail = /^\/campaigns\/.+/.test(loc);

  // Mobile: only show one column at a time
  // Tablet: list + detail
  // Desktop: rail + list + detail

  return (
    <div className="h-screen w-full flex relative">
      <LiquidGlassFilters />
      <div className="stilt-canvas" />
      <KeyboardShortcuts />
      <Shortcuts />
      <UniversalSearch />

      {/* PERSISTENT MOBILE TOP CHROME — mounted once, never re-rendered
          across route changes. Pages register their toggle pill via
          useMobileTopChromeSlot(). */}
      <MobileTopChromeShell />

      <DesktopRail />
      <TabletLeftRail />

      {/* MAIN AREA — desktop reserves left padding for the floating sidebar
          (rail is fixed-positioned and overlays this padding). */}
      <main className="flex-1 flex min-w-0 relative lg:pl-[88px]">
        {/* List column. Inbox shows InboxList; Campaigns shows CampaignsList
            (same list+detail architecture).
            Hidden on mobile when a detail pane is open (a conversation or a
            specific campaign), shown again for bare /campaigns (empty state). */}
        <div
          className={`
            ${
              showingCalendar || showingAi
                ? 'hidden'
                : showingConversation || showingBriefing || showingSettings || showingArchive || showingCampaignDetail
                  ? 'hidden md:flex'
                  : 'flex'
            }
            md:w-[360px] lg:w-[560px] xl:w-[600px] flex-col w-full md:shrink-0
            relative lg:pr-2
          `}
        >
          {showingCampaigns ? <CampaignsList /> : <InboxList />}
        </div>

        {/* Right detail pane — list + detail just like the inbox. On desktop it
            always shows (empty state on bare /campaigns); on mobile it only
            appears once an item is actually opened, so bare /campaigns shows the
            full-screen list underneath (matching the inbox). */}
        <div
          className={`
            ${showingConversation || showingBriefing || showingSettings || showingArchive || showingCalendar || showingAi || showingCampaignDetail ? 'flex' : 'hidden md:flex'}
            flex-col flex-1 min-w-0 fixed md:relative inset-0 md:inset-auto z-10 md:z-0
            bg-transparent
          `}
        >
          <Switch>
            <Route path="/conversation/:id" component={ConversationDetail} />
            <Route path="/briefing" component={Briefing} />
            {/* v15.4 — /settings redirects to profile menu (opens sheet). */}
            <Route path="/settings" component={SettingsRedirect} />
            <Route path="/campaigns/:id" component={CampaignDetail} />
            <Route path="/campaigns" component={CampaignDetail} />
            {/* v-replaiy — Calendar tab retained as a "Coming soon" placeholder.
                The old working calendar implementation + its data were deleted
                in the Stilt cleanup; only this placeholder remains. */}
            <Route path="/calendar/new">
              <ComingSoon title="Calendar" />
            </Route>
            <Route path="/calendar">
              <ComingSoon title="Calendar" />
            </Route>
            {/* v-replaiy — 'Mijn AI': persona + knowledge surface. */}
            <Route path="/ai" component={MijnAi} />
            <Route path="/archive">
              <ArchiveView />
            </Route>
            <Route path="/">
              <EmptyDetail />
            </Route>
            <Route>
              <EmptyDetail />
            </Route>
          </Switch>
        </div>
      </main>

      <MobileBottomNav />

      {/* Route-aware ••• menu — mounted once at the layout level so it
          renders on every route. The conversation detail suppresses the
          menu itself since it replaces the ••• button with a back arrow. */}
      <DotsMenuSheet />
    </div>
  );
}

function ArchiveView() {
  const { conversations } = useStilt();
  const [q, setQ] = useState('');
  const items = conversations
    .filter((m) => m.status === 'done')
    .filter((m) => {
      const s = q.trim().toLowerCase();
      if (!s) return true;
      return (
        m.from.name.toLowerCase().includes(s) ||
        m.subject.toLowerCase().includes(s) ||
        m.preview.toLowerCase().includes(s)
      );
    })
    .sort((a, b) => +new Date(b.ts) - +new Date(a.ts));
  return (
    <div className="flex flex-col h-full relative">
      <div className="absolute top-3 inset-x-0 z-30 pointer-events-none flex justify-center px-3">
        <div className="glass-pill pill flex items-center gap-2 px-3.5 py-[7px] pointer-events-auto">
          <span className="text-[14.5px] font-medium tracking-[-0.005em]">Done</span>
          <span className="text-[12.5px] text-muted-foreground">· {items.length}</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto no-scrollbar px-3 lg:px-4 pt-[78px] pb-44 lg:pb-6">
        <div className="px-1 mb-3">
          <input
            data-testid="input-archive-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search archive..."
            className="glass-pill pill w-full px-4 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-[#20B8A6]/30"
          />
        </div>
        {items.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-sm font-medium">Archive is empty</p>
          </div>
        ) : (
          <div className="glass rounded-3xl overflow-hidden">
            {items.map((m, i) => (
              <div key={m.id}>
                {i > 0 && (
                  <div className="ml-[64px] h-px bg-foreground/[0.06] dark:bg-white/[0.06]" />
                )}
                <ConversationRowLite mail={m} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ConversationRowLite({ mail }: { mail: any }) {
  return (
    <Link
      href={`/conversation/${mail.id}`}
      className="px-4 py-3 flex items-start gap-3 hover-elevate active-elevate-2"
    >
      <StiltAvatar name={mail.from.name} src={mail.from.avatar} size={36} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between">
          <span className="font-semibold text-[14.5px] truncate">{mail.from.name}</span>
          <span className="text-[12px] text-muted-foreground">{timeAgo(mail.ts)}</span>
        </div>
        <div className="text-[13.5px] truncate">{mail.subject}</div>
        <div className="text-[12.5px] text-muted-foreground truncate">{mail.preview}</div>
      </div>
    </Link>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <StiltProvider>
          <MobileTopChromeProvider>
            <Toaster />
            <Router hook={useHashLocation}>
              <LayoutShell />
            </Router>
          </MobileTopChromeProvider>
        </StiltProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
