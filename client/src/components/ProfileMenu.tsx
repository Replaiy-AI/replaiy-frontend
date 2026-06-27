// ─────────────────────────────────────────────────────────────────
// v15.4 — ProfileMenu
//
// Replaces the standalone /settings route. Uses ResponsiveSheet:
// bottom-sheet on mobile/tablet, right-side slide-in panel on desktop.
// Sections: Account / Preferences / AI / Connected accounts / About /
// Log out. Stilt-style glass cards with purple-tinted toggle switches.
// ─────────────────────────────────────────────────────────────────
import { motion } from 'framer-motion';
import {
  Sun,
  Moon,
  Monitor,
  Sparkles,
  Wand2,
  Filter,
  Inbox,
  ShieldCheck,
  Bell,
  Languages,
  Globe,
  LogOut,
  ChevronRight,
  Info,
  HelpCircle,
  FileText,
  Lock,
  X,
  Check,
  Clock,
} from 'lucide-react';
import { useStilt } from '@/state/StiltContext';
import { useInboxSettings } from '@/lib/inboxSettings';
import { ResponsiveSheet } from './ResponsiveSheet';
import { StiltAvatar } from './Avatar';
import { accounts } from '@/data/mockEvents';

// ─────────────────────────────────────────────────────────────────
// v19 — Neutral toggle. ON = foreground (dark gray in light mode,
// near-white in dark mode). White thumb in light, dark thumb in dark.
// ─────────────────────────────────────────────────────────────────
function NeutralToggle({
  on,
  onChange,
  testId,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  testId?: string;
}) {
  return (
    <button
      data-testid={testId}
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-[26px] w-[44px] items-center rounded-full transition-colors shrink-0 ${
        on
          ? 'bg-foreground dark:bg-white'
          : 'bg-foreground/15 dark:bg-white/20'
      }`}
      role="switch"
      aria-checked={on}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className={`inline-block h-[20px] w-[20px] rounded-full ${
          on ? 'bg-background dark:bg-foreground' : 'bg-white'
        }`}
        style={{
          marginLeft: on ? 21 : 3,
          boxShadow:
            '0 1px 2px rgba(0,0,0,0.1), 0 2px 6px rgba(0,0,0,0.15)',
        }}
      />
    </button>
  );
}
// Back-compat alias — keep `PurpleToggle` as a name for any external usage.
const PurpleToggle = NeutralToggle;

// ─────────────────────────────────────────────────────────────────
// v19 — Neutral muted-gray section header. No purple labels anywhere.
// ─────────────────────────────────────────────────────────────────
function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pb-1.5 pt-3 text-[10.5px] uppercase tracking-[0.08em] font-semibold text-foreground/45">
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Row — toggle / value / link.
// ─────────────────────────────────────────────────────────────────
function ToggleRow({
  icon: Icon,
  title,
  desc,
  on,
  onChange,
  testId,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  desc?: string;
  on: boolean;
  onChange: (v: boolean) => void;
  testId?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-3.5 py-3">
      <div className="flex items-start gap-2.5 min-w-0">
        {/* v19 — neutral glass icon-circle; sparkle icons inside stay purple via var(--ai-accent). */}
        <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0 bg-foreground/[0.06] dark:bg-white/[0.08]">
          <Icon size={15} className={Icon === Sparkles || Icon === Wand2 ? 'text-icon-accent' : 'text-icon'} />
        </div>
        <div className="min-w-0">
          <div className="text-[13.5px] font-medium">{title}</div>
          {desc && (
            <div className="text-[12px] text-foreground/55 leading-snug">{desc}</div>
          )}
        </div>
      </div>
      <PurpleToggle on={on} onChange={onChange} testId={testId} />
    </div>
  );
}

function ValueRow({
  icon: Icon,
  title,
  value,
  onClick,
  testId,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  value: string;
  onClick?: () => void;
  testId?: string;
}) {
  return (
    <button
      data-testid={testId}
      onClick={onClick}
      className="w-full flex items-center justify-between gap-3 px-3.5 py-3 hover-elevate active-elevate-2 text-left"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0 bg-foreground/[0.06] dark:bg-white/[0.08]">
          <Icon size={15} className="text-icon" />
        </div>
        <div className="text-[13.5px] font-medium">{title}</div>
      </div>
      <div className="flex items-center gap-1 text-foreground/55 text-[12.5px]">
        <span>{value}</span>
        <ChevronRight size={14} strokeWidth={1.7} />
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────
// Theme picker — segmented 3-up.
// ─────────────────────────────────────────────────────────────────
function ThemePicker() {
  const { theme, setTheme } = useStilt();
  return (
    <div className="px-3.5 py-3">
      <div className="text-[13.5px] font-medium mb-2">Theme</div>
      <div className="grid grid-cols-3 gap-1.5">
        {[
          { k: 'light' as const, icon: Sun, label: 'Light' },
          { k: 'dark' as const, icon: Moon, label: 'Dark' },
          { k: 'auto' as const, icon: Monitor, label: 'Auto' },
        ].map(({ k, icon: Icon, label }) => (
          <button
            key={k}
            data-testid={`profile-theme-${k}`}
            onClick={() => setTheme(k)}
            className={`flex flex-col items-center gap-1 py-2.5 rounded-2xl transition-colors ${
              theme === k
                ? 'lg-strong'
                : 'border border-foreground/10 hover-elevate active-elevate-2'
            }`}
          >
            <Icon size={15} className={theme === k ? 'text-foreground' : 'text-icon'} />
            <span className={`text-[11.5px] font-medium ${theme === k ? 'text-foreground' : 'text-foreground/75'}`}>
              {label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Connected accounts row (mock).
// ─────────────────────────────────────────────────────────────────
const PROVIDER_LABEL: Record<string, string> = {
  google: 'Google',
  microsoft: 'Microsoft',
  apple: 'Apple',
};

function ConnectedAccountsBlock() {
  const { accountVisible, setAccountVisible } = useStilt();
  const visible = accounts.filter((a) => a.id !== 'personal');
  return (
    <div className="flex flex-col">
      {visible.map((acct, i) => (
        <div key={acct.id}>
          {i > 0 && (
            <div className="mx-3.5 h-px bg-foreground/[0.06] dark:bg-white/[0.06]" />
          )}
          <div
            className="flex items-center justify-between gap-3 px-3.5 py-3"
            data-testid={`profile-account-row-${acct.id}`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {/* v19 — neutral account chip. No provider-color dot. */}
              <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0 relative bg-foreground/[0.06] dark:bg-white/[0.08]">
                <span className="absolute inset-0 m-auto h-2 w-2 rounded-full bg-foreground/40" />
              </div>
              <div className="min-w-0">
                <div className="text-[13.5px] font-medium">
                  {PROVIDER_LABEL[acct.id] || acct.provider}
                </div>
                <div className="text-[12px] text-foreground/55 truncate">
                  {acct.email}
                </div>
              </div>
            </div>
            <PurpleToggle
              on={accountVisible[acct.id] !== false}
              onChange={(v) => setAccountVisible(acct.id, v)}
              testId={`profile-toggle-account-${acct.id}`}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Profile menu
// ─────────────────────────────────────────────────────────────────
export function ProfileMenu() {
  const {
    profileMenuOpen,
    setProfileMenuOpen,
    smartMode,
    setSmartMode,
    ai,
    setAI,
  } = useStilt();
  const [inbox, setInbox] = useInboxSettings();
  const close = () => setProfileMenuOpen(false);

  return (
    <ResponsiveSheet
      open={profileMenuOpen}
      onClose={close}
      desktopWidth="md"
      mobileMaxHeight="90vh"
      testId="profile-menu"
    >
      <div className="flex-1 overflow-y-auto no-scrollbar lg-sheet-scroll">
        {/* Header — avatar / name / email + close */}
        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-2">
          <div className="flex items-center gap-3 min-w-0">
            <StiltAvatar name="Simon Garner" size={56} />
            <div className="min-w-0">
              <div
                className="text-[17px] font-semibold tracking-[-0.02em]"
                data-testid="profile-name"
              >
                Simon van Basten
              </div>
              <div className="text-[12.5px] text-foreground/55 truncate">
                simon@replaiy.ai
              </div>
            </div>
          </div>
          <button
            data-testid="profile-close"
            onClick={close}
            aria-label="Close"
            className="h-9 w-9 rounded-full glass-pill flex items-center justify-center text-icon shrink-0 active-elevate-2"
          >
            <X size={19} strokeWidth={1.75} />
          </button>
        </div>

        <div className="px-3.5 pb-8">
          {/* Account */}
          <SectionHeader>Account</SectionHeader>
          <div className="glass rounded-2xl divide-y divide-foreground/5 overflow-hidden">
            <ValueRow
              icon={Info}
              title="Manage account"
              value=""
              testId="profile-manage-account"
            />
            <ValueRow
              icon={Bell}
              title="Notifications"
              value="On"
              testId="profile-notifications"
            />
          </div>

          {/* Preferences */}
          <SectionHeader>Preferences</SectionHeader>
          <div className="glass rounded-2xl divide-y divide-foreground/5 overflow-hidden">
            <ThemePicker />
            <ValueRow
              icon={Languages}
              title="Language"
              value="English"
              testId="profile-language"
            />
            <ValueRow
              icon={Globe}
              title="Time zone"
              value="Auto"
              testId="profile-timezone"
            />
          </div>

          {/* Inbox */}
          <SectionHeader>Inbox</SectionHeader>
          <div className="glass rounded-2xl divide-y divide-foreground/5 overflow-hidden">
            <ToggleRow
              icon={Clock}
              title="Show timestamps"
              desc="Relative time (1m, 11h, 2d) on every mail. Off = clean, time-free list."
              on={inbox.showTimestamps}
              onChange={(v) => setInbox({ showTimestamps: v })}
              testId="profile-toggle-timestamps"
            />
          </div>

          {/* AI */}
          <SectionHeader>AI</SectionHeader>
          <div className="glass rounded-2xl divide-y divide-foreground/5 overflow-hidden">
            <ToggleRow
              icon={Sparkles}
              title="Smart mode"
              desc="AI-curated views across Mail, Calendar, Docs."
              on={smartMode}
              onChange={setSmartMode}
              testId="profile-toggle-smart-default"
            />
            <ToggleRow
              icon={Sparkles}
              title="Auto summary"
              desc="One-line gist on important mails."
              on={ai.summary}
              onChange={(v) => setAI({ summary: v })}
              testId="profile-toggle-summary"
            />
            <ToggleRow
              icon={Wand2}
              title="Smart Reply"
              desc="Three quick chips you can send in one tap."
              on={ai.smartReply}
              onChange={(v) => setAI({ smartReply: v })}
              testId="profile-toggle-smartreply"
            />
            <ToggleRow
              icon={Filter}
              title="Auto-categorize"
              desc="Sort Primary / Newsletters / FYI for you."
              on={ai.autoCategorize}
              onChange={(v) => setAI({ autoCategorize: v })}
              testId="profile-toggle-categorize"
            />
            <ToggleRow
              icon={Inbox}
              title="Cleanup suggestions"
              desc="Surfaces stale newsletters to archive."
              on={ai.cleanup}
              onChange={(v) => setAI({ cleanup: v })}
              testId="profile-toggle-cleanup"
            />
            <ToggleRow
              icon={ShieldCheck}
              title="Tone check"
              desc="Subtle nudge if a reply sounds curt."
              on={ai.toneCheck}
              onChange={(v) => setAI({ toneCheck: v })}
              testId="profile-toggle-tone"
            />
          </div>

          {/* Connected accounts */}
          <SectionHeader>Connected accounts</SectionHeader>
          <div className="glass rounded-2xl overflow-hidden">
            <ConnectedAccountsBlock />
          </div>
          <button
            data-testid="profile-add-account"
            className="mt-2 w-full glass-pill pill h-11 rounded-full flex items-center justify-center gap-1.5 text-[13.5px] font-medium text-foreground/80 hover-elevate active-elevate-2"
          >
            + Add another account
          </button>

          {/* About */}
          <SectionHeader>About</SectionHeader>
          <div className="glass rounded-2xl divide-y divide-foreground/5 overflow-hidden">
            <ValueRow
              icon={Info}
              title="Version"
              value="1.0 · 2026.10"
              testId="profile-version"
            />
            <ValueRow icon={Lock} title="Privacy" value="" testId="profile-privacy" />
            <ValueRow icon={FileText} title="Terms" value="" testId="profile-terms" />
            <ValueRow icon={HelpCircle} title="Help" value="" testId="profile-help" />
          </div>

          {/* Log out */}
          <div className="mt-4">
            <button
              data-testid="profile-logout"
              onClick={close}
              className="w-full glass rounded-2xl py-3.5 flex items-center justify-center gap-2 text-[13.5px] font-semibold text-[#FF453A] hover-elevate active-elevate-2"
            >
              <LogOut size={15} strokeWidth={1.8} />
              <span>Log out</span>
            </button>
          </div>

          <p className="text-center text-[11px] text-foreground/45 pt-4">
            Replaiy · made with care
          </p>
        </div>
      </div>
    </ResponsiveSheet>
  );
}
