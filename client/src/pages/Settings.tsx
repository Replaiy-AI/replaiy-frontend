import { Moon, Sun, Monitor, Sparkles, Inbox, Wand2, Filter, ShieldCheck, Clock } from 'lucide-react';
import { useStilt } from '@/state/StiltContext';
import { motion } from 'framer-motion';
import { accounts } from '@/data/mockEvents';
import { useInboxSettings } from '@/lib/inboxSettings';

function Toggle({ on, onChange, testId }: { on: boolean; onChange: (v: boolean) => void; testId?: string }) {
  return (
    <button
      data-testid={testId}
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-[28px] w-[46px] items-center rounded-full transition-colors ${on ? 'bg-foreground dark:bg-white' : 'bg-foreground/15'}`}
      role="switch"
      aria-checked={on}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className={`inline-block h-[22px] w-[22px] rounded-full ${on ? 'bg-background dark:bg-foreground' : 'bg-white'} shadow-md ${on ? 'ml-[21px]' : 'ml-[3px]'}`}
        style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.1), 0 2px 6px rgba(0,0,0,0.15)' }}
      />
    </button>
  );
}

export function Settings() {
  const { theme, setTheme, ai, setAI, accountVisible, setAccountVisible } = useStilt();
  const [inbox, setInbox] = useInboxSettings();
  // User-facing connected accounts — personal is implicit, hidden from UI
  const visibleAccounts = accounts.filter((a) => a.id !== 'personal');

  return (
    <div className="flex flex-col h-full min-h-0 overflow-y-auto no-scrollbar">
      <div className="px-4 lg:px-8 pt-6 lg:pt-10 pb-24 lg:pb-12 max-w-2xl mx-auto w-full">
        <h1 className="text-[28px] font-semibold tracking-[-0.025em] leading-tight mb-1">Settings</h1>
        <p className="text-[14px] text-muted-foreground mb-6">Make Stilt feel like yours.</p>

        {/* Appearance */}
        <div className="mb-6">
          <div className="section-header mb-2 px-1">Appearance</div>
          <div className="glass rounded-2xl divide-y divide-foreground/5 overflow-hidden">
            <div className="p-4">
              <div className="text-[13.5px] font-medium mb-3">Theme</div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { k: 'light' as const, icon: Sun, label: 'Light' },
                  { k: 'dark' as const, icon: Moon, label: 'Dark' },
                  { k: 'auto' as const, icon: Monitor, label: 'Auto' },
                ].map(({ k, icon: Icon, label }) => (
                  <button
                    key={k}
                    data-testid={`theme-${k}`}
                    onClick={() => setTheme(k)}
                    className={`flex flex-col items-center gap-1.5 py-3 rounded-xl hover-elevate active-elevate-2 ${theme === k ? 'lg-strong' : 'border border-foreground/10'}`}
                  >
                    <Icon size={16} className={theme === k ? 'text-foreground' : 'text-icon'} />
                    <span className={`text-[12px] font-medium ${theme === k ? 'text-foreground' : 'text-foreground/75'}`}>{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Inbox */}
        <div className="mb-6">
          <div className="section-header mb-2 px-1">Inbox</div>
          <div className="glass rounded-2xl divide-y divide-foreground/5 overflow-hidden">
            <Row
              icon={Clock}
              title="Show timestamps"
              desc="Show a relative time on every mail row (1m, 11h, 2d). Off = clean, time-free list."
              right={<Toggle testId="toggle-timestamps" on={inbox.showTimestamps} onChange={(v) => setInbox({ showTimestamps: v })} />}
            />
          </div>
        </div>

        {/* AI features */}
        <div className="mb-6">
          <div className="section-header mb-2 px-1">AI features</div>
          <div className="glass rounded-2xl divide-y divide-foreground/5 overflow-hidden">
            <Row
              icon={Sparkles}
              title="Auto summary"
              desc="A one-line gist on important mails."
              right={<Toggle testId="toggle-summary" on={ai.summary} onChange={(v) => setAI({ summary: v })} />}
            />
            <Row
              icon={Wand2}
              title="Smart Reply"
              desc="3 quick chips you can send in one tap."
              right={<Toggle testId="toggle-smartreply" on={ai.smartReply} onChange={(v) => setAI({ smartReply: v })} />}
            />
            <Row
              icon={Filter}
              title="Auto-categorize"
              desc="Sorts Primary / Newsletters / FYI for you."
              right={<Toggle testId="toggle-categorize" on={ai.autoCategorize} onChange={(v) => setAI({ autoCategorize: v })} />}
            />
            <Row
              icon={Inbox}
              title="Cleanup suggestions"
              desc="Surfaces stale newsletters and promos to archive."
              right={<Toggle testId="toggle-cleanup" on={ai.cleanup} onChange={(v) => setAI({ cleanup: v })} />}
            />
            <Row
              icon={ShieldCheck}
              title="Tone check"
              desc="Subtle nudge if a reply sounds curt."
              right={<Toggle testId="toggle-tone" on={ai.toneCheck} onChange={(v) => setAI({ toneCheck: v })} />}
            />
          </div>
        </div>

        {/* Philosophy explainer */}
        <div className="glass rounded-2xl p-5 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={13} style={{ color: 'var(--ai-accent)' }} />
            <span className="text-[10.5px] uppercase tracking-wider font-semibold text-foreground/55">Read / unread philosophy</span>
          </div>
          <p className="text-[13.5px] leading-snug">
            Stilt doesn't track read or unread. Every mail is{' '}
            <span className="font-semibold">Open</span>,{' '}
            <span className="font-semibold">Waiting</span>,{' '}
            <span className="font-semibold">Snoozed</span>, or{' '}
            <span className="font-semibold">Done</span>. Swipe to handle. That's it.
          </p>
        </div>

        {/* Accounts */}
        <div className="mb-6">
          <div className="section-header mb-2 px-1">Accounts</div>
          <p className="text-[12px] text-muted-foreground px-1 mb-2 leading-snug">
            Toggle calendar visibility per account. Hidden accounts disappear from every view.
          </p>
          <div className="glass rounded-2xl divide-y divide-foreground/5 overflow-hidden">
            {visibleAccounts.map((acct) => (
              <div
                key={acct.id}
                className="flex items-center justify-between gap-3 p-4"
                data-testid={`account-row-${acct.id}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 relative bg-foreground/[0.06] dark:bg-white/[0.08]">
                    <span className="absolute inset-0 m-auto h-2 w-2 rounded-full bg-foreground/40" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-medium flex items-center gap-2">
                      {acct.provider}
                      <span className="text-[10.5px] uppercase tracking-wider font-semibold text-muted-foreground">
                        Calendar
                      </span>
                    </div>
                    <div className="text-[12px] text-muted-foreground truncate">{acct.email}</div>
                  </div>
                </div>
                <Toggle
                  testId={`toggle-account-${acct.id}`}
                  on={accountVisible[acct.id] !== false}
                  onChange={(v) => setAccountVisible(acct.id, v)}
                />
              </div>
            ))}
          </div>
          <button
            className="mt-3 w-full glass-pill pill h-11 rounded-full flex items-center justify-center gap-1.5 text-[13.5px] font-medium text-foreground/80 hover-elevate active-elevate-2"
            data-testid="button-add-account"
          >
            + Add another account
          </button>
        </div>

        <p className="text-center text-[11px] text-muted-foreground pt-2">Stilt — Version 1.0 (build 2026.10)</p>
      </div>
    </div>
  );
}

function Row({ icon: Icon, title, desc, right }: { icon: React.ComponentType<{ size?: number; className?: string }>; title: string; desc: string; right: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 p-4">
      <div className="flex items-start gap-3 min-w-0">
        <div className="h-8 w-8 rounded-lg bg-foreground/[0.06] dark:bg-white/[0.08] flex items-center justify-center shrink-0">
          <Icon size={15} className="text-icon" />
        </div>
        <div className="min-w-0">
          <div className="text-[13.5px] font-medium">{title}</div>
          <div className="text-[12px] text-muted-foreground leading-snug">{desc}</div>
        </div>
      </div>
      {right}
    </div>
  );
}
