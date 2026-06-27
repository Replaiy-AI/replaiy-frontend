// ─────────────────────────────────────────────────────────────────
// Generic glass segmented toggle — Apple-style direct manipulation.
//
// One reusable component that powers:
//   • Top inbox toggle      (Smart Inbox / Inbox)
//   • Top calendar toggle   (Smart / Day / Week / Month)
//   • Bottom nav            (Inbox / Calendar)
//
// Features:
//   • Active indicator is a draggable motion.div with springy snap
//   • Drag past 50% threshold (or flick velocity) snaps to next segment
//   • Released before threshold springs back
//   • Tap on a segment animates indicator with same spring
//   • Active segment expands to icon + label, inactive shrinks to icon only
//   • Optional purple tint on a specific segment (AI-flavoured)
//   • External MotionValue<number> (0..1 per-pair) can morph indicator
//     when another gesture drives the same selection (carousel)
// ─────────────────────────────────────────────────────────────────
import {
  motion,
  useMotionValue,
  useTransform,
  animate,
  type PanInfo,
  type MotionValue,
} from 'framer-motion';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { APPLE_SPRING } from '@/lib/motion';
import type { LucideIcon } from 'lucide-react';
import ShudingGlass from './ShudingGlass';

export type ToggleSegment<K extends string> = {
  key: K;
  icon: LucideIcon;
  label: string;
  /** Width of segment when ACTIVE (icon + label visible) */
  activeWidth: number;
  /** Width of segment when INACTIVE (icon only) */
  inactiveWidth: number;
  /** Optional purple tint when this segment is active (Smart-Inbox style) */
  aiTint?: boolean;
};

export interface GlassSegmentedToggleProps<K extends string> {
  segments: ToggleSegment<K>[];
  value: K;
  onChange: (key: K) => void;
  /** Outer padding inside the track (px) */
  pad?: number;
  /** Pixel height (default = parent height) */
  height?: number;
  /** External drag progress (0..1) — e.g. screen-carousel swipe — drives indicator live */
  externalProgress?: MotionValue<number>;
  /** When externalProgress is 1, target the OTHER mode (carousel pattern) */
  externalProgressDirection?: 'self-to-next' | 'self-to-prev';
  /** Icon-only mode — no labels ever appear; indicator just translates between equal-width icon slots. */
  iconOnly?: boolean;
  /** Visual style of the active indicator (default 'neutral' for bottom nav, 'glass-rich' for top toggles, 'liquid' for v21 chromatic-aberration glass, 'shuding' for v23 real refraction). */
  indicatorStyle?: 'neutral' | 'glass-rich' | 'liquid' | 'shuding';
  /** Extra px of inset around the indicator (in addition to `pad`). Use for compact icon-only nav so the indicator becomes a small circle that never bleeds into the next icon slot. */
  indicatorInset?: number;
  /** Layout axis. 'horizontal' (default) flexes left→right; 'vertical' flexes top→bottom. activeWidth/inactiveWidth are interpreted as the segment dimension along the main axis. */
  orientation?: 'horizontal' | 'vertical';
  testId?: string;
}

export function GlassSegmentedToggle<K extends string>({
  segments,
  value,
  onChange,
  pad = 4,
  externalProgress,
  externalProgressDirection = 'self-to-next',
  iconOnly = false,
  indicatorStyle = 'glass-rich',
  indicatorInset = 0,
  orientation = 'horizontal',
  testId,
}: GlassSegmentedToggleProps<K>) {
  const vertical = orientation === 'vertical';
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const activeIdx = Math.max(0, segments.findIndex((s) => s.key === value));

  // Compute rest x positions for each segment's indicator.
  // When segment i is active, its width = activeWidth_i; all others = inactiveWidth.
  // Indicator at i starts at: pad + sum(width_j for j<i, where width depends on j active/not)
  // Since only ONE is active at a time, the rest positions are:
  //   restX(activeWhen=i) = pad + sum_{j<i} inactiveWidth_j
  const restX = (idx: number): number => {
    // The track has CSS padding-left = `pad`, so flex segments start at x = pad
    // in the padding-box. Because the absolutely-positioned indicator is
    // positioned within the padding box too, its x-coordinate is relative to
    // the padding edge (i.e. starts at 0, not `pad`). So we DON'T re-add `pad`.
    let acc = 0;
    for (let j = 0; j < idx; j++) acc += segments[j].inactiveWidth;
    // When the indicator is inset, shift it right by the inset so it
    // sits centred inside the segment slot.
    return acc + indicatorInset;
  };

  const indicatorWidthAt = (idx: number): number =>
    Math.max(0, segments[idx].activeWidth - indicatorInset * 2);

  const x = useMotionValue(restX(activeIdx));
  const indicatorW = useMotionValue(indicatorWidthAt(activeIdx));
  // For vertical layout, x carries the Y coordinate (still named x to keep code paths shared).


  // dragProgress per segment-pair: how far x is between active rest and the NEXT
  // segment's rest. Used for label opacity/width interpolation.
  const dragProgressRaw = useTransform(x, (xv) => {
    // Find which two segments xv sits between.
    const positions = segments.map((_, i) => restX(i));
    for (let i = 0; i < positions.length - 1; i++) {
      const lo = positions[i];
      const hi = positions[i + 1];
      if (xv >= lo && xv <= hi) {
        const t = (xv - lo) / Math.max(1, hi - lo);
        return { fromIdx: i, toIdx: i + 1, t };
      }
    }
    if (xv < positions[0]) return { fromIdx: 0, toIdx: 1, t: 0 };
    return {
      fromIdx: positions.length - 2,
      toIdx: positions.length - 1,
      t: 1,
    };
  });

  // Snap on value change.
  useLayoutEffect(() => {
    if (dragging) return;
    animate(x, restX(activeIdx), APPLE_SPRING);
    animate(indicatorW, indicatorWidthAt(activeIdx), APPLE_SPRING);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIdx, dragging]);

  // External progress drives indicator live (carousel swipe).
  useEffect(() => {
    if (!externalProgress) return;
    const unsub = externalProgress.on('change', (p) => {
      if (dragging) return;
      const otherIdx = externalProgressDirection === 'self-to-next'
        ? Math.min(segments.length - 1, activeIdx + 1)
        : Math.max(0, activeIdx - 1);
      const start = restX(activeIdx);
      const end = restX(otherIdx);
      x.set(start + (end - start) * p);
      const wStart = indicatorWidthAt(activeIdx);
      const wEnd = indicatorWidthAt(otherIdx);
      indicatorW.set(wStart + (wEnd - wStart) * p);
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalProgress, activeIdx, dragging, externalProgressDirection]);

  const onDragStart = () => setDragging(true);
  const onDragEnd = (_: unknown, info: PanInfo) => {
    setDragging(false);
    const v = vertical ? info.velocity.y : info.velocity.x;
    const positions = segments.map((_, i) => restX(i));
    const current = x.get();

    // Find nearest segment by rest position, biased by velocity.
    let bestIdx = 0;
    let bestDist = Infinity;
    let bias = 0;
    if (v > 500) bias = 30;
    if (v < -500) bias = -30;
    positions.forEach((p, i) => {
      const d = Math.abs(p - (current + bias));
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    });

    animate(x, restX(bestIdx), APPLE_SPRING);
    animate(indicatorW, indicatorWidthAt(bestIdx), APPLE_SPRING);
    if (segments[bestIdx].key !== value) onChange(segments[bestIdx].key);
  };

  // Indicator background — purple-tinged when the segment under the indicator
  // (at rest) has aiTint set. We interpolate by drag fromIdx/toIdx.
  const aiTintFlags = segments.map((s) => (s.aiTint ? 1 : 0));
  const indicatorBg = useTransform(dragProgressRaw, ({ fromIdx, toIdx, t }) => {
    const a = aiTintFlags[fromIdx] ?? 0;
    const b = aiTintFlags[toIdx] ?? 0;
    const ai = a * (1 - t) + b * t; // 0..1 "AI-ness"
    // v21: the 'liquid' indicator paints its surface via .lg-aberration
    // pseudo-elements, so the inline background MUST stay transparent.
    if (indicatorStyle === 'liquid') {
      return 'transparent';
    }
    if (indicatorStyle === 'neutral') {
      return `linear-gradient(180deg, rgba(255,255,255,0.78), rgba(255,255,255,0.58))`;
    }
    return `linear-gradient(135deg, rgba(167,139,250,${(0.18 * ai).toFixed(3)}), rgba(255,255,255,0.55))`;
  });
  const indicatorRing = useTransform(dragProgressRaw, ({ fromIdx, toIdx, t }) => {
    const a = aiTintFlags[fromIdx] ?? 0;
    const b = aiTintFlags[toIdx] ?? 0;
    const ai = a * (1 - t) + b * t;
    // v21: liquid mode delegates all shadow/border styling to .lg-aberration.
    if (indicatorStyle === 'liquid') {
      return 'none';
    }
    if (indicatorStyle === 'neutral') {
      return `inset 0 1px 0 rgba(255,255,255,0.95), inset 0 0 0 1px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.06)`;
    }
    return `inset 0 1px 0 rgba(255,255,255,0.95), inset 0 0 0 1px rgba(167,139,250,${(0.22 * ai).toFixed(3)}), 0 1px 2px rgba(0,0,0,0.05)`;
  });

  // Total track length (main axis) = sum of segment lengths + pad*2
  const trackLength =
    segments.reduce((acc, s, i) => acc + (i === activeIdx ? s.activeWidth : s.inactiveWidth), 0) +
    pad * 2;

  // Drag constraints: indicator can travel from first rest to last rest.
  const dragLow = restX(0);
  const dragHigh = restX(segments.length - 1);

  return (
    <div
      ref={trackRef}
      data-testid={testId}
      className={`relative ${vertical ? 'w-full flex-col' : 'h-full'} flex items-center select-none`}
      style={
        vertical
          ? { height: trackLength, paddingTop: pad, paddingBottom: pad, boxSizing: 'border-box' }
          : { width: trackLength, paddingLeft: pad, paddingRight: pad, boxSizing: 'border-box' }
      }
    >
      {/* Draggable indicator */}
      <motion.div
        data-testid={testId ? `${testId}-indicator` : undefined}
        drag={vertical ? 'y' : 'x'}
        dragConstraints={
          vertical
            ? { top: dragLow, bottom: dragHigh }
            : { left: dragLow, right: dragHigh }
        }
        dragElastic={0.06}
        dragMomentum={false}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        whileTap={{ scale: 0.98 }}
        style={
          vertical
            ? {
                y: x,
                height: indicatorW,
                // v16 — cross-axis inset ignores indicatorInset so a vertical
                // indicator becomes a CIRCLE (width === height) inside the
                // square 52×52 segment slot. indicatorInset only shrinks the
                // main axis (height), matching horizontal behaviour.
                left: pad,
                right: pad,
                // v23 — shuding mode draws its own background via per-pill
                // SVG filter; keep the indicator container transparent so
                // refraction is visible. Other modes keep their fills.
                background: indicatorStyle === 'shuding' ? 'transparent' : indicatorBg,
                boxShadow: indicatorStyle === 'shuding' ? 'none' : indicatorRing,
              }
            : {
                x,
                width: indicatorW,
                top: pad + indicatorInset,
                bottom: pad + indicatorInset,
                background: indicatorStyle === 'shuding' ? 'transparent' : indicatorBg,
                boxShadow: indicatorStyle === 'shuding' ? 'none' : indicatorRing,
              }
        }
        className={`absolute rounded-full z-0 cursor-grab active:cursor-grabbing ${
          indicatorStyle === 'liquid' ? 'lg-aberration lg-aberration-sm' : ''
        }`}
      >
        {/* v23 — Real liquid-glass refraction on the indicator (shuding
             technique). Sits absolutely inside the draggable container,
             so its SVG filter follows the indicator as the user drags
             between segments — the icons + labels underneath visibly
             bend through the lens. ShudingGlass measures its container
             with ResizeObserver, so it auto-sizes to indicatorW. */}
        {indicatorStyle === 'shuding' && (
          <ShudingGlass
            radius={22}
            thickness={40}
            bezel={16}
            ior={1.5}
            scaleRatio={1.0}
            blur={0.25}
            specularOpacity={0.55}
            specularSaturation={4}
            innerShadowBlur={14}
            innerShadowSpread={-3}
            innerShadowColor="rgba(255, 255, 255, 0.55)"
            tintColor="255, 255, 255"
            tintOpacity={0.1}
            outerShadowBlur={14}
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
            }}
          />
        )}
      </motion.div>

      {/* Segments */}
      {segments.map((s, i) => {
        const I = s.icon;
        const active = i === activeIdx;
        return (
          <button
            key={s.key}
            data-testid={testId ? `${testId}-seg-${s.key}` : undefined}
            type="button"
            onClick={() => onChange(s.key)}
            aria-label={s.label}
            aria-pressed={active}
            className={`relative z-10 flex items-center justify-center ${vertical ? 'w-full' : 'h-full'} rounded-full text-[13.5px] font-medium overflow-hidden`}
            style={
              vertical
                ? {
                    height: active ? s.activeWidth : s.inactiveWidth,
                    transition: dragging ? 'none' : 'height 280ms cubic-bezier(0.32,0.72,0,1)',
                  }
                : {
                    width: active ? s.activeWidth : s.inactiveWidth,
                    transition: dragging ? 'none' : 'width 280ms cubic-bezier(0.32,0.72,0,1)',
                  }
            }
          >
            <span className={iconOnly ? 'flex items-center justify-center w-full h-full' : 'flex items-center gap-[6px] whitespace-nowrap'} style={iconOnly ? undefined : { paddingLeft: 6, paddingRight: 6 }}>
              <I
                // v30.36 — Tab-pill icon size standardized to 19 (GLASS_ICON_SIZE)
                // when iconOnly. Label-mode keeps its 17px because then
                // the icon sits next to text and needs slightly smaller
                // proportion. StrokeWidth uniform at 1.75 for icon-only.
                size={iconOnly ? 19 : 17}
                strokeWidth={iconOnly ? 1.75 : active ? 1.7 : 1.5}
                className="shrink-0"
                style={{
                  // v30.35 — Icon color system. Één waarde voor active +
                  // inactive (--icon-primary / --icon-active hebben dezelfde
                  // waarde, het glass-pill oppervlak levert het contrast).
                  // AI segments behouden hun accent-teal.
                  color: active
                    ? s.aiTint
                      ? 'var(--icon-accent)'
                      : 'var(--icon-active)'
                    : 'var(--icon-primary)',
                  opacity: active ? 1 : 1,
                  transform: active ? 'scale(1)' : 'scale(0.94)',
                  transition: 'color 200ms ease, opacity 200ms ease, transform 200ms ease',
                }}
              />
              {!iconOnly && active && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={APPLE_SPRING}
                  className="text-foreground tracking-[-0.005em] overflow-hidden inline-block"
                >
                  {s.label}
                </motion.span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
