import { motion, useMotionValue, useTransform, animate, useMotionValueEvent } from 'framer-motion';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CircleCheck, Clock } from 'lucide-react';
import { APPLE_SPRING, APPLE_SPRING_TIGHT } from '@/lib/motion';

// ─────────────────────────────────────────────────────────────────
// v17 — Swipe polarity flipped (matches iOS Mail / Spark muscle memory):
//   • RIGHT swipe  → Done    (emerald CircleCheck, reveals from LEFT edge)
//   • LEFT  swipe  → Snooze  (amber Clock,         reveals from RIGHT edge)
//
// Both directions work on mobile touch AND desktop mouse drag.
// ─────────────────────────────────────────────────────────────────

const THRESHOLD = 110;

export type SwipeAction = 'done' | 'snooze';

export interface SwipeableRowProps {
  testId?: string;
  onCommit: (action: SwipeAction) => void;
  onClick?: () => void;
  className?: string;
  children: ReactNode;
}

export function SwipeableRow({
  testId,
  onCommit,
  onClick,
  className = '',
  children,
}: SwipeableRowProps) {
  const rawX = useMotionValue(0);

  // Done (RIGHT swipe, positive x — emerald block reveals from the LEFT edge)
  const doneOpacity = useTransform(rawX, [0, 30, THRESHOLD], [0, 0.6, 1]);
  const doneScale = useTransform(rawX, [0, THRESHOLD], [0.8, 1.0]);
  const doneIconRotate = useTransform(rawX, [0, THRESHOLD], [0, 8]);

  // Snooze (LEFT swipe, negative x — amber block reveals from the RIGHT edge)
  const snoozeOpacity = useTransform(rawX, [-THRESHOLD, -30, 0], [1, 0.6, 0]);
  const snoozeScale = useTransform(rawX, [-THRESHOLD, 0], [1.0, 0.8]);

  // Threshold-crossing pulse
  const [doneIconPulse, setDoneIconPulse] = useState(1);
  const [snoozeIconPulse, setSnoozeIconPulse] = useState(1);
  const tickedRef = useRef<SwipeAction | null>(null);

  useMotionValueEvent(rawX, 'change', (latest) => {
    if (latest >= THRESHOLD * 0.5 && tickedRef.current !== 'done') {
      tickedRef.current = 'done';
      setDoneIconPulse(1.15);
      setTimeout(() => setDoneIconPulse(1.0), 140);
    } else if (latest <= -THRESHOLD * 0.5 && tickedRef.current !== 'snooze') {
      tickedRef.current = 'snooze';
      setSnoozeIconPulse(1.15);
      setTimeout(() => setSnoozeIconPulse(1.0), 140);
    } else if (Math.abs(latest) < THRESHOLD * 0.4) {
      tickedRef.current = null;
    }
  });

  const [collapsing, setCollapsing] = useState<null | SwipeAction>(null);

  const commit = (which: SwipeAction) => {
    // Done flies RIGHT (+500), Snooze flies LEFT (-500).
    const target = which === 'done' ? 500 : -500;
    animate(rawX, target, { ...APPLE_SPRING, stiffness: 350, damping: 32 });
    setTimeout(() => {
      setCollapsing(which);
      setTimeout(() => {
        onCommit(which);
      }, 200);
    }, 180);
  };

  const handleDragEnd = (
    _: unknown,
    info: { offset: { x: number }; velocity: { x: number } }
  ) => {
    const off = info.offset.x;
    const vx = info.velocity.x;

    // RIGHT swipe → Done. LEFT swipe → Snooze.
    const committedDone = off > THRESHOLD || (off > 40 && vx > 600);
    const committedSnooze = off < -THRESHOLD || (off < -40 && vx < -600);

    if (committedDone) commit('done');
    else if (committedSnooze) commit('snooze');
    else {
      animate(rawX, 0, APPLE_SPRING_TIGHT);
    }
  };

  // v19 — trackpad two-finger swipe support.
  // Framer Motion's drag="x" only handles pointer events. MacBook trackpad
  // two-finger swipe gestures fire `wheel` events (with deltaX). Listen for
  // those, accumulate into the same motion-value rawX, and apply the same
  // threshold logic when the gesture ends (~150ms of no wheel events).
  const rowRef = useRef<HTMLDivElement>(null);
  const wheelAccumRef = useRef(0);
  const wheelEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wheelCommittedRef = useRef(false);

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      // Only horizontal-dominant gestures — ignore regular vertical scroll.
      if (Math.abs(e.deltaX) < Math.abs(e.deltaY) * 1.2) return;
      if (Math.abs(e.deltaX) < 1.5) return;

      // Once we've committed this gesture, eat subsequent wheel deltas
      // until the gesture ends to prevent re-firing.
      if (wheelCommittedRef.current) {
        e.preventDefault();
        return;
      }

      e.preventDefault();

      // Two-finger swipe LEFT on a Mac fires positive deltaX (page would
      // scroll right). Map that to a LEFT visual swipe of the row → Snooze.
      // Negate so a positive deltaX moves the row LEFT (negative rawX).
      wheelAccumRef.current -= e.deltaX;

      // Soft clamp so we don't fling miles.
      const MAX = THRESHOLD * 1.6;
      if (wheelAccumRef.current > MAX) wheelAccumRef.current = MAX;
      if (wheelAccumRef.current < -MAX) wheelAccumRef.current = -MAX;

      rawX.set(wheelAccumRef.current);

      // Schedule a gesture-end check.
      if (wheelEndTimerRef.current) clearTimeout(wheelEndTimerRef.current);
      wheelEndTimerRef.current = setTimeout(() => {
        const finalX = wheelAccumRef.current;
        wheelAccumRef.current = 0;
        if (finalX > THRESHOLD) {
          wheelCommittedRef.current = true;
          commit('done');
        } else if (finalX < -THRESHOLD) {
          wheelCommittedRef.current = true;
          commit('snooze');
        } else {
          animate(rawX, 0, APPLE_SPRING_TIGHT);
        }
        // Allow new gestures after a short settle.
        setTimeout(() => { wheelCommittedRef.current = false; }, 400);
      }, 140);
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
      if (wheelEndTimerRef.current) clearTimeout(wheelEndTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div
      data-testid={testId}
      ref={rowRef}
      animate={
        collapsing
          ? { height: 0, opacity: 0, marginTop: 0, marginBottom: 0 }
          : { height: 'auto', opacity: 1 }
      }
      transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
      style={{ overflow: 'hidden' }}
      className="relative"
    >
      {/* Done action — RIGHT swipe reveals emerald block at the LEFT edge */}
      <motion.div
        className="absolute inset-y-0 left-0 right-0 rounded-2xl bg-emerald-500 flex items-center px-5 pointer-events-none"
        style={{ opacity: doneOpacity, scale: doneScale }}
      >
        <motion.div
          className="flex items-center gap-2 text-white font-medium"
          style={{ scale: doneIconPulse, rotate: doneIconRotate }}
          animate={{ scale: doneIconPulse }}
          transition={APPLE_SPRING}
        >
          <CircleCheck size={20} strokeWidth={2.2} />
          <span className="text-[14px]">Done</span>
        </motion.div>
      </motion.div>

      {/* Snooze action — LEFT swipe reveals amber block at the RIGHT edge */}
      <motion.div
        className="absolute inset-y-0 left-0 right-0 rounded-2xl bg-amber-500 flex items-center justify-end px-5 pointer-events-none"
        style={{ opacity: snoozeOpacity, scale: snoozeScale }}
      >
        <motion.div
          className="flex items-center gap-2 text-white font-medium"
          animate={{ scale: snoozeIconPulse }}
          transition={APPLE_SPRING}
        >
          <span className="text-[14px]">Snooze</span>
          <Clock size={20} strokeWidth={2.2} />
        </motion.div>
      </motion.div>

      {/* Dragging surface — transform-only, will-change, no layout */}
      <motion.div
        drag="x"
        dragDirectionLock
        dragMomentum={false}
        dragConstraints={{ left: -THRESHOLD, right: THRESHOLD }}
        dragElastic={0.55}
        dragTransition={{ bounceStiffness: 600, bounceDamping: 32 }}
        style={{ x: rawX, touchAction: 'pan-y', willChange: 'transform' }}
        onDragEnd={handleDragEnd}
        whileTap={{ cursor: 'grabbing' }}
        onClick={() => {
          if (Math.abs(rawX.get()) > 4) return;
          onClick?.();
        }}
        className={`relative cursor-pointer select-none ${className}`}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
