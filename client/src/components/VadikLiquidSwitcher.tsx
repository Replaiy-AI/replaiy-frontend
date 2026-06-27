// ─────────────────────────────────────────────────────────────────
// VadikLiquidSwitcher — LITERAL React port of
// https://codepen.io/fooontic/pen/KwpRaGr  (Vadik Matveev)
//
// Every value here is copied verbatim from Vadik's source:
//   • Track 244×70, padding 8px 12px 10px, gap 8px
//   • Each option 68px wide
//   • Active indicator 84×(100%-10px) with stride 76px per tab
//   • Same 10-layer track box-shadow
//   • Same 7-layer indicator box-shadow
//   • Same scaleToggle keyframes
//   • Same SVG filter chain
//
// We accept a `scale` prop to render at smaller sizes proportionally
// (every dimension multiplied), so the visual ratios remain identical.
// ─────────────────────────────────────────────────────────────────
import { useEffect, useId, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { lacksBackdropSVGFilter } from '@/lib/ios-detect';
import {
  VADIK_DISPLACEMENT_WEBP,
  vadikTrackBoxShadow,
  vadikGlassSurfaceStyle,
} from '@/lib/vadik-glass-style';

export interface VadikSegment<K extends string> {
  key: K;
  icon: LucideIcon;
  label: string;
}

export interface VadikLiquidSwitcherProps<K extends string> {
  segments: VadikSegment<K>[];
  value: K;
  onChange: (key: K) => void;
  /** Scale factor relative to Vadik's original 244×70. Default 1 = same as pen. */
  scale?: number;
  /** Override orientation. Default horizontal (Vadik's original). Vertical
     rotates the entire track 90° via CSS transform. */
  orientation?: 'horizontal' | 'vertical';
  testId?: string;
}

// v26 — displacement map nu in een gedeelde module zodat de bundler
// de 16288-char base64 string maar één keer includeert ongeacht hoeveel
// glass-elementen er gerenderd worden. Zie lib/vadik-displacement-map.ts.
const DISPLACEMENT_WEBP = VADIK_DISPLACEMENT_WEBP;

// Vadik's exact numbers
const V_TRACK_W = 244;
const V_TRACK_H = 70;
const V_OPTION_W = 68;
const V_GAP = 8;
const V_PAD_TOP = 8;
const V_PAD_LEFT = 12;
const V_PAD_BOTTOM = 10;
const V_IND_W = 84;
const V_IND_TOP = 4;
const V_IND_LEFT = 4;
const V_IND_HEIGHT_REDUCTION = 10; // calc(100% - 10px)
const V_TAB_STRIDE = V_OPTION_W + V_GAP; // 76px

export function VadikLiquidSwitcher<K extends string>({
  segments,
  value,
  onChange,
  scale = 1,
  orientation = 'horizontal',
  testId,
}: VadikLiquidSwitcherProps<K>) {
  const filterId = useId().replace(/:/g, '_');
  const activeIdx = Math.max(0, segments.findIndex((s) => s.key === value));
  const prevIdxRef = useRef(activeIdx);
  const [wobble, setWobble] = useState(0);

  // v25 — iOS WebKit (en desktop Safari/Firefox) ondersteunt geen SVG
  // filters in backdrop-filter. We detecteren dat één keer bij mount en
  // gebruiken een aparte premium CSS-fallback. Zie lib/ios-detect.ts
  // voor de motivatie en bronnen.
  // v30.21 — SVG filter UIT voor consistente matte glass-look (zie VadikGlass).
  const [useFallback] = useState(true);

  useEffect(() => {
    if (prevIdxRef.current !== activeIdx) {
      prevIdxRef.current = activeIdx;
      setWobble((k) => k + 1);
    }
  }, [activeIdx]);

  // Compute scaled dimensions
  const trackW = V_TRACK_W * scale;
  const trackH = V_TRACK_H * scale;
  const padTop = V_PAD_TOP * scale;
  const padLeft = V_PAD_LEFT * scale;
  const padBottom = V_PAD_BOTTOM * scale;
  const optionW = V_OPTION_W * scale;
  const gap = V_GAP * scale;
  const indW = V_IND_W * scale;
  const indTop = V_IND_TOP * scale;
  const indLeft = V_IND_LEFT * scale;
  const indHeight = trackH - V_IND_HEIGHT_REDUCTION * scale;
  const stride = V_TAB_STRIDE * scale;

  // Translate offset per active tab (Vadik: 0 / 76 / 152 — i.e. activeIdx * stride)
  const translateX = activeIdx * stride;

  // v26 — helper voor scaled px. Track box-shadow nu uit gedeelde module.
  const s = (v: number) => v * scale;
  const trackBoxShadow = vadikTrackBoxShadow(s);

  // Vadik's exact indicator (::after) box-shadow stack
  const indicatorBoxShadow = [
    `inset 0 0 0 ${s(1)}px color-mix(in srgb, var(--vadik-light, #fff) calc(var(--vadik-reflex-light, 1) * 10%), transparent)`,
    `inset ${s(2)}px ${s(1)}px 0px ${s(-1)}px color-mix(in srgb, var(--vadik-light, #fff) calc(var(--vadik-reflex-light, 1) * 90%), transparent)`,
    `inset ${s(-1.5)}px ${s(-1)}px 0px ${s(-1)}px color-mix(in srgb, var(--vadik-light, #fff) calc(var(--vadik-reflex-light, 1) * 80%), transparent)`,
    `inset ${s(-2)}px ${s(-6)}px ${s(1)}px ${s(-5)}px color-mix(in srgb, var(--vadik-light, #fff) calc(var(--vadik-reflex-light, 1) * 60%), transparent)`,
    `inset ${s(-1)}px ${s(2)}px ${s(3)}px ${s(-1)}px color-mix(in srgb, var(--vadik-dark, #000) calc(var(--vadik-reflex-dark, 1) * 20%), transparent)`,
    `inset 0px ${s(-4)}px ${s(1)}px ${s(-2)}px color-mix(in srgb, var(--vadik-dark, #000) calc(var(--vadik-reflex-dark, 1) * 10%), transparent)`,
    `0px ${s(3)}px ${s(6)}px 0px color-mix(in srgb, var(--vadik-dark, #000) calc(var(--vadik-reflex-dark, 1) * 8%), transparent)`,
  ].join(', ');

  // v24.8 — EXACT Vadik recreatie. Bron-CSS gecheckt:
  //   backdrop-filter: blur(8px) url(#switcher) saturate(150%);
  // De vorige base64 displacement map was MIS (200 chars i.p.v. 16288).
  // Met de echte WebP map creëert feDisplacementMap scale=0.5 in
  // objectBoundingBox-units exact het waterdruppel/lens-effect.
  const blurPx = s(8);
  const vertical = orientation === 'vertical';
  // For vertical: swap dimensions, flex column, indicator translates Y
  const dispW = vertical ? trackH : trackW;
  const dispH = vertical ? trackW : trackH;
  const dispPadding = vertical
    ? `${padLeft}px ${padTop}px ${padLeft}px ${padBottom}px`
    : `${padTop}px ${padLeft}px ${padBottom}px`;
  const indStyle: React.CSSProperties = vertical
    ? {
        left: indTop,
        top: indLeft,
        width: indHeight,
        height: indW,
        transform: `translateY(${translateX}px)`,
      }
    : {
        left: indLeft,
        top: indTop,
        width: indW,
        height: indHeight,
        transform: `translateX(${translateX}px)`,
      };

  return (
    // v24.4 — De OUTER wrapper draagt de box-shadow rim/drop. Het
    // BACKDROP-FILTER zit op de fieldset ZELF zonder enige andere
    // filter-clipping eigenschappen. Twee aparte layers zodat ze
    // elkaar niet kapot maken.
    <div
      style={{
        position: 'relative',
        display: 'inline-block',
        width: dispW,
        height: dispH,
        borderRadius: 9999,
        // v25 — iOS fallback krijgt een extra outer drop-shadow zodat
        // de pill toch "zwevend" voelt zonder lens-refractie. Vadik's
        // 10-layer track shadow blijft behouden, we voegen er één
        // zachte rim glow aan toe (alleen in fallback-mode).
        boxShadow: useFallback
          ? `${trackBoxShadow}, 0 0 ${s(20)}px 0 rgba(255, 255, 255, 0.10)`
          : trackBoxShadow,
      }}
    >
      <fieldset
        data-testid={testId}
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: vertical ? 'column' : 'row',
          alignItems: 'center',
          gap,
          width: '100%',
          height: '100%',
          boxSizing: 'border-box',
          padding: dispPadding,
          margin: 0,
          border: 'none',
          borderRadius: 9999,
          // v26 — surface styling via gedeelde helper. Twee paden:
          //   • Chromium/Blink: volledige Vadik backdrop-filter met SVG.
          //   • iOS WebKit / Safari / Firefox: premium CSS-fallback.
          ...vadikGlassSurfaceStyle(filterId, useFallback, blurPx),
          transition: 'background 400ms cubic-bezier(1, 0, 0.4, 1)',
        }}
      >
        {/* The sliding indicator — Vadik's ::after */}
        <div
          key={wobble}
          aria-hidden
          style={{
            content: '""',
            position: 'absolute',
            display: 'block',
            borderRadius: 9999,
            backgroundColor:
              'color-mix(in srgb, var(--vadik-glass, #bbbbbc) 36%, transparent)',
            zIndex: -1,
            boxShadow: indicatorBoxShadow,
            transition:
              'background-color 400ms cubic-bezier(1, 0, 0.4, 1), box-shadow 400ms cubic-bezier(1, 0, 0.4, 1), transform 400ms cubic-bezier(1, 0, 0.4, 1)',
            animation: wobble > 0 ? (vertical ? 'vadikScaleToggleV' : 'vadikScaleToggle') + ' 440ms ease' : undefined,
            transformOrigin: 'center center',
            ...indStyle,
          }}
        />

        {/* Per-segment options */}
        {segments.map((seg) => {
          const I = seg.icon;
          const isActive = seg.key === value;
          return (
            <label
              key={seg.key}
              data-testid={testId ? `${testId}-seg-${seg.key}` : undefined}
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                padding: vertical ? `${16 * scale}px 0` : `0 ${16 * scale}px`,
                width: vertical ? '100%' : optionW,
                height: vertical ? optionW : '100%',
                boxSizing: 'border-box',
                borderRadius: 9999,
                opacity: 1,
                cursor: isActive ? 'auto' : 'pointer',
                // v30.35 — Tab-pill icon-color via het icon color system.
                // Active en inactive gebruiken dezelfde token — het
                // glass-pill oppervlak doet het visuele onderscheid, niet
                // een donkerdere kleur. Apart token voor active zodat we
                // later kunnen tunen zonder primary aan te raken.
                color: isActive
                  ? 'var(--icon-active)'
                  : 'var(--icon-primary)',
                transition: 'color 200ms ease, all 160ms',
              }}
              onClick={() => onChange(seg.key)}
              onMouseEnter={(e) => {
                // v30.36 — Hover-scale teruggeschroefd van 1.2 → 1.03
                // (HOVER_SCALE_SOFT). Consistent met VadikGlass en alle
                // andere glass icon buttons.
                const icon = e.currentTarget.querySelector('svg') as SVGElement | null;
                if (icon && !isActive) icon.style.transform = 'scale(1.03)';
              }}
              onMouseLeave={(e) => {
                const icon = e.currentTarget.querySelector('svg') as SVGElement | null;
                if (icon) icon.style.transform = 'scale(1)';
              }}
            >
              <input
                type="radio"
                name={`vadik-${filterId}`}
                value={seg.key}
                checked={isActive}
                onChange={() => onChange(seg.key)}
                aria-label={seg.label}
                style={{
                  position: 'absolute',
                  width: 1,
                  height: 1,
                  margin: -1,
                  padding: 0,
                  overflow: 'hidden',
                  clip: 'rect(0 0 0 0)',
                  clipPath: 'inset(100%)',
                  whiteSpace: 'nowrap',
                  border: 0,
                }}
              />
              <I
                // v30.36 — Vaste 19px (GLASS_ICON_SIZE). Was schalend
                // met de tab-pill scale (22 * scale = 16.5 bij scale 0.75)
                // wat te klein voelde t.o.v. de andere glass icon buttons.
                // Nu absolute 19 zodat alle icon-buttons in de hele app
                // identiek zijn, ongeacht of de pill compact of full-size is.
                size={19}
                strokeWidth={1.75}
                // v30.35 — Icon color geerfd van de <label> wrapper hierboven
                // (currentColor). Active/inactive logica zit daar centraal in
                // het icon color system (--icon-primary / --icon-active).
                color="currentColor"
                style={{
                  display: 'block',
                  transition: 'transform 180ms cubic-bezier(0.32, 0.72, 0, 1)',
                  transform: 'scale(1)',
                }}
              />
            </label>
          );
        })}

        {/* Per-instance SVG filter — Vadik's exact chain */}
        <svg
          aria-hidden
          width={0}
          height={0}
          style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', zIndex: -1 }}
        >
          {/* v24.8 — EXACTE Vadik filter chain, character-for-character:
              <filter id="switcher" primitiveUnits="objectBoundingBox">
                <feImage result="map" width="100%" height="100%" x="0" y="0" href="..."/>
                <feGaussianBlur in="SourceGraphic" stdDeviation="0.04" result="blur"/>
                <feDisplacementMap in="blur" in2="map" scale="0.5" xChannelSelector="R" yChannelSelector="G"/>
              </filter> */}
          <filter id={filterId} primitiveUnits="objectBoundingBox">
            <feImage
              result="map"
              width="100%"
              height="100%"
              x="0"
              y="0"
              href={DISPLACEMENT_WEBP}
            />
            <feGaussianBlur in="SourceGraphic" stdDeviation="0.04" result="blur" />
            <feDisplacementMap
              in="blur"
              in2="map"
              scale="0.5"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </svg>

        {/* Vadik's scale-toggle keyframe */}
        <style>{`
          @keyframes vadikScaleToggle {
            0%   { scale: 1 1; }
            50%  { scale: 1.1 1; }
            100% { scale: 1 1; }
          }
          @keyframes vadikScaleToggleV {
            0%   { scale: 1 1; }
            50%  { scale: 1 1.1; }
            100% { scale: 1 1; }
          }
        `}</style>
      </fieldset>
    </div>
  );
}

export default VadikLiquidSwitcher;
