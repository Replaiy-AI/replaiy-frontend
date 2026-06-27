import { Sparkles, Clock, Inbox as InboxIcon, Star, ArrowRight, CheckCircle2, Moon } from 'lucide-react';
import { motion } from 'framer-motion';
import { useReplaiy } from '@/state/ReplaiyContext';
import { Link } from 'wouter';
import { ReplaiyAvatar } from '@/components/Avatar';

export function Briefing() {
  const { conversations, setConversationStatus } = useReplaiy();

  const replyToday = conversations.filter((m) => m.needsReply && m.status === 'open');
  const waiting = conversations.filter((m) => m.status === 'waiting');
  const snoozed = conversations.filter((m) => m.status === 'snoozed');
  const newsletters = conversations.filter((m) => m.category === 'newsletter' && m.status === 'open');
  const topPriority = conversations
    .filter((m) => m.status === 'open' && m.priority === 'high')
    .sort((a, b) => +new Date(b.ts) - +new Date(a.ts))[0];

  const handledThisWeek = conversations.filter((m) => m.status === 'done').length;

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <div className="flex flex-col h-full min-h-0 overflow-y-auto no-scrollbar">
      <div className="px-4 lg:px-8 pt-6 lg:pt-10 pb-24 lg:pb-12 max-w-3xl mx-auto w-full">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <div className="flex items-center gap-2 text-foreground/70 mb-2">
            <Sparkles size={14} />
            <span className="text-[11px] uppercase tracking-wider font-semibold">Briefing</span>
          </div>
          <h1 className="text-[28px] lg:text-[32px] font-semibold tracking-[-0.025em] leading-tight">
            {greeting}, Simon.
          </h1>
          <p className="text-[15px] text-muted-foreground mt-1.5">Here's your day at a glance.</p>
        </motion.div>

        {/* Stats card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="glass rounded-3xl p-5 lg:p-6 mt-6"
        >
          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Need reply</div>
              <div className="text-[28px] lg:text-[34px] font-semibold tracking-[-0.02em] mt-1 text-foreground/70">
                {replyToday.length}
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Waiting</div>
              <div className="text-[28px] lg:text-[34px] font-semibold tracking-[-0.02em] mt-1 text-foreground">
                {waiting.length}
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Snoozed</div>
              <div className="text-[28px] lg:text-[34px] font-semibold tracking-[-0.02em] mt-1 text-foreground/70">
                {snoozed.length}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Top priority */}
        {topPriority && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="mt-4 rounded-3xl p-5 border"
            style={{
              background: 'linear-gradient(135deg, rgba(10,132,255,0.10), rgba(94,92,230,0.07))',
              borderColor: 'rgba(10,132,255,0.22)',
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Star size={14} className="text-icon-muted" />
              <span className="text-[11px] uppercase tracking-wider font-semibold text-foreground/70">
                Top priority
              </span>
            </div>
            <Link href={`/conversation/${topPriority.id}`} className="block hover-elevate active-elevate-2 rounded-2xl p-3 -m-1">
              <div className="flex items-start gap-3">
                <ReplaiyAvatar name={topPriority.from.name} src={topPriority.from.avatar} size={42} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between">
                    <span className="font-semibold text-[15px] truncate">{topPriority.from.name}</span>
                  </div>
                  <div className="text-[14px] truncate">{topPriority.subject}</div>
                  <div className="text-[12.5px] text-muted-foreground italic mt-1.5">
                    ✨ {topPriority.summary}
                  </div>
                </div>
                <ArrowRight size={16} className="text-muted-foreground shrink-0 mt-1" />
              </div>
            </Link>
          </motion.div>
        )}

        {/* Waiting mention */}
        {waiting.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="glass rounded-3xl p-5 mt-4"
          >
            <div className="flex items-center gap-2 mb-3">
              <Clock size={14} className="text-icon-muted" />
              <span className="text-[11px] uppercase tracking-wider font-semibold text-amber-600 dark:text-amber-400">
                Waiting on them
              </span>
            </div>
            <div className="space-y-2">
              {waiting.slice(0, 3).map((m) => (
                <Link key={m.id} href={`/conversation/${m.id}`} className="flex items-center gap-3 hover-elevate active-elevate-2 -mx-2 px-2 py-1.5 rounded-xl">
                  <ReplaiyAvatar name={m.from.name} src={m.from.avatar} size={32} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] font-medium truncate">{m.from.name}</div>
                    <div className="text-[12px] text-muted-foreground truncate">
                      Since {new Date(m.ts).toLocaleDateString('en-US', { weekday: 'long' })}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </motion.div>
        )}

        {/* Cleanup suggestion */}
        {newsletters.length >= 2 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="glass rounded-3xl p-5 mt-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={14} className="text-icon-muted" />
              <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                Cleanup
              </span>
            </div>
            <p className="text-[14px] leading-snug">
              <span className="font-semibold">{newsletters.length} newsletters</span>{' '}
              from this week.
              <br />
              <span className="text-muted-foreground">Snooze to weekend, or archive?</span>
            </p>
            <div className="flex gap-2 mt-3">
              <button
                data-testid="button-snooze-weekend"
                onClick={() => newsletters.forEach((m) => setConversationStatus(m.id, 'snoozed'))}
                className="pill px-3.5 py-1.5 text-[13px] font-medium glass hover-elevate active-elevate-2 flex items-center gap-1.5"
              >
                <Moon size={13} /> Snooze to weekend
              </button>
              <button
                data-testid="button-archive-all"
                onClick={() => newsletters.forEach((m) => setConversationStatus(m.id, 'done'))}
                className="pill px-3.5 py-1.5 text-[13px] font-semibold bg-foreground text-white hover-elevate active-elevate-2 flex items-center gap-1.5"
              >
                <CheckCircle2 size={13} /> Archive all
              </button>
            </div>
          </motion.div>
        )}

        {/* Stats footer */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
          className="grid grid-cols-3 gap-3 mt-4"
        >
          <div className="glass rounded-2xl p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Handled</div>
            <div className="text-[22px] font-semibold tracking-[-0.02em] mt-1">{handledThisWeek}</div>
            <div className="text-[11px] text-muted-foreground">this week</div>
          </div>
          <div className="glass rounded-2xl p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Avg reply</div>
            <div className="text-[22px] font-semibold tracking-[-0.02em] mt-1">2h 14m</div>
            <div className="text-[11px] text-muted-foreground">7-day rolling</div>
          </div>
          <div className="glass rounded-2xl p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Zero streak</div>
            <div className="text-[22px] font-semibold tracking-[-0.02em] mt-1">5 d</div>
            <div className="text-[11px] text-muted-foreground">keep going</div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
