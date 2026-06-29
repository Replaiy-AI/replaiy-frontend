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
  // v-textmode — icon is OPTIONAL. In the default 'icon' variant it is
  // required-in-practice (the segment renders the icon). In 'text' variant
  // the segment renders its `label` text instead and needs no icon at all.
  icon?: LucideIcon;
  label: string;
  // v-perseg-width — OPTIONAL per-segment UNSCALED width override (like the
  // top-level `optionWidth`, but for THIS segment only). When ANY segment in
  // the set provides a `width`, the switcher runs in PER-SEGMENT-WIDTH mode:
  // each option uses its own width (falling back to optionWidth / Vadik's 68
  // when unset), the track grows to the sum of all widths + gaps, and the
  // indicator sizes + positions itself from the active segment's own width and
  // the cumulative offset of the segments before it. This is the minimal
  // addition needed to fit FOUR labels of very different lengths (e.g.
  // All / Posts / Comments / Reactions) snugly: a short label like "All" no
  // longer inherits the width of the longest one, so it is not over-spaced and
  // the long labels do not collide. When NO segment sets `width`, behaviour is
  // byte-for-byte identical to before (uniform optionWidth for every segment).
  width?: number;
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
  /** v-textmode — Content variant. 'icon' (default) renders the segment icon
     EXACTLY as before (full backward-compat for the nav rail). 'text' renders
     the segment's `label` text instead of an icon, using the same color
     tokens and the same glass / indicator / wobble recipe. */
  variant?: 'icon' | 'text';
  /** v-textmode — Per-segment option width in UNSCALED px (i.e. like Vadik's
     V_OPTION_W = 68). Text labels are wider than a single icon, so callers in
     text mode pass a larger value sized for the longest label. The indicator
     width + stride math derives from this so the sliding indicator always
     lands exactly under the active segment. Defaults to Vadik's 68. Used as the
     fallback width for any segment that does not set its own `width`. */
  optionWidth?: number;
  /** v-perseg-width — Inner horizontal text padding per side, UNSCALED px.
     Vadik's icon mode uses 16. Text labels of differing lengths read tighter
     and more balanced with a smaller pad, so the Activity tabs pass a smaller
     value. Defaults to 16 (every existing caller is unchanged). Only affects
     the horizontal option padding in the HORIZONTAL orientation. */
  textPaddingX?: number;
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
  variant = 'icon',
  optionWidth,
  textPaddingX = 16,
  testId,
}: VadikLiquidSwitcherProps<K>) {
  const isText = variant === 'text';
  // v-textmode — Vadik's indicator overhangs the option by exactly
  //   V_IND_W - V_OPTION_W = 84 - 68 = 16 unscaled px (8px each side).
  // We preserve this SAME overhang for any chosen option width so the
  // indicator reads identically (slightly wider than the segment, centered).
  const V_IND_OVERHANG = V_IND_W - V_OPTION_W; // 16
  // Effective unscaled option width: caller override > Vadik default.
  const baseOptionW = optionWidth ?? V_OPTION_W;
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
  // v-replaiy — Track-breedte wordt afgeleid van het AANTAL segmenten i.p.v.
  // de hardcoded 244 (die alleen klopte voor exact 3 tabs). Vadik's recipe:
  //   trackW = padLeft*2 + optionW*count + gap*(count-1)
  // Voor 3 segmenten geeft dit weer 244 (12*2 + 68*3 + 8*2). Voor 4 → 320.
  // De indicator-stride (activeIdx * stride) schaalt al mee, dus dit is de
  // enige plek die moest meegroeien. Cross-axis (V_TRACK_H) blijft gelijk.
  const segCount = segments.length;
  // v-perseg-width — Per-segment UNSCALED widths. Any segment without its own
  // `width` falls back to baseOptionW, so when NO segment sets a width every
  // value below collapses to the previous uniform-width behaviour exactly
  // (segW all equal baseOptionW, cumulative offsets become activeIdx * stride).
  const segWidths = segments.map((s) => s.width ?? baseOptionW);
  // Cumulative UNSCALED left offset of each segment inside the flex row:
  // sum of all preceding widths + one gap per preceding segment.
  const segOffsets = segWidths.map(
    (_, i) =>
      segWidths.slice(0, i).reduce((a, b) => a + b, 0) + V_GAP * i,
  );
  const totalOptionsW = segWidths.reduce((a, b) => a + b, 0);
  // v-textmode — trackW, indicator width and stride all derive from the
  // per-segment widths (which default to baseOptionW). In icon mode every
  // segW === V_OPTION_W (68) so every value is identical to before.
  const dynamicTrackW =
    V_PAD_LEFT * 2 + totalOptionsW + V_GAP * (segCount - 1);
  const trackW = dynamicTrackW * scale;
  const trackH = V_TRACK_H * scale;
  const padTop = V_PAD_TOP * scale;
  const padLeft = V_PAD_LEFT * scale;
  const padBottom = V_PAD_BOTTOM * scale;
  const gap = V_GAP * scale;
  // v-perseg-width — Indicator width tracks the ACTIVE segment's own width
  // (plus Vadik's 16px overhang), so a narrow tab like "All" gets a narrow
  // indicator and a wide tab like "Comments" a wide one, always centered with
  // the same 8px-per-side overhang Vadik used.
  const activeSegW = segWidths[activeIdx] ?? baseOptionW;
  const indW = (activeSegW + V_IND_OVERHANG) * scale;
  const indTop = V_IND_TOP * scale;
  const indLeft = V_IND_LEFT * scale;
  const indHeight = trackH - V_IND_HEIGHT_REDUCTION * scale;

  // v-perseg-width — Translate offset is the active segment's cumulative
  // UNSCALED offset, scaled. In uniform mode segOffsets[i] === i * (optionW+gap)
  // so this reduces to Vadik's original activeIdx * stride exactly. The indicator
  // overhangs by 8px each side, so we shift it back by half the overhang to keep
  // it centered on the (possibly wider) active segment, matching the uniform case
  // where indLeft(4) already accounts for the 8px overhang at index 0.
  const translateX = segOffsets[activeIdx] * scale;

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
        {segments.map((seg, segIdx) => {
          const I = seg.icon;
          const isActive = seg.key === value;
          // v-perseg-width — this option's own on-screen width (defaults to
          // baseOptionW when the segment sets no width). textPaddingX defaults
          // to 16 (Vadik's icon padding) so existing callers are unchanged.
          const segOnScreen = segWidths[segIdx] * scale;
          return (
            <label
              key={seg.key}
              data-testid={testId ? `${testId}-seg-${seg.key}` : undefined}
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                padding: vertical
                  ? `${16 * scale}px 0`
                  : `0 ${textPaddingX * scale}px`,
                width: vertical ? '100%' : segOnScreen,
                height: vertical ? segOnScreen : '100%',
                boxSizing: 'border-box',
                borderRadius: 9999,
                opacity: 1,
                cursor: isActive ? 'auto' : 'pointer',
                // v30.35 — Tab-pill icon-color via het icon color system.
                // Active en inactive gebruiken dezelfde token — het
                // glass-pill oppervlak doet het visuele onderscheid, niet
                // een donkerdere kleur. Apart token voor active zodat we
                // later kunnen tunen zonder primary aan te raken.
                //
                // v-fix-tab-text-color — For the TEXT variant (the lead-panel
                // Overview/Contact tabs) the label is TEXT, not an icon, so it
                // must use the app's clean body text color --foreground
                // (a clean warm off-white in dark). The --icon-* tokens are a
                // muted warm grey (hsl(42 15% 75%) dark) that, as text on the
                // dark tab, reads as a dirty yellow/amber tint. The ICON variant
                // (nav rail icons) is left UNCHANGED on the --icon-* tokens.
                color: isText
                  ? 'hsl(var(--foreground))'
                  : isActive
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
              {/* v-textmode — In TEXT variant render the segment label TEXT
                  instead of the icon, using the SAME inherited color tokens
                  (--icon-active active / --icon-primary inactive) from the
                  <label> wrapper. Same font treatment as the app's tab text:
                  ~13.5px, font-medium, tight tracking, no wrap. In ICON
                  variant we render Vadik's icon EXACTLY as before. */}
              {isText ? (
                <span
                  style={{
                    display: 'block',
                    color: 'currentColor',
                    fontSize: 13.5,
                    fontWeight: 500,
                    letterSpacing: '-0.01em',
                    lineHeight: 1,
                    whiteSpace: 'nowrap',
                    transition: 'color 200ms ease, transform 180ms cubic-bezier(0.32, 0.72, 0, 1)',
                    transform: 'scale(1)',
                    userSelect: 'none',
                  }}
                >
                  {seg.label}
                </span>
              ) : (
                I && (
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
                )
              )}
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
