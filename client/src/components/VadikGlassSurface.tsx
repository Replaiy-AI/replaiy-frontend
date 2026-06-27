// ─────────────────────────────────────────────────────────────────
// VadikGlassSurface — non-interactive glass container (zelfde recipe
// als VadikGlass) als <div> i.p.v. <button>. Gebruikt voor:
//   • Search bar capsule (bevat een <input>, mag geen <button> zijn)
//   • Andere chrome-elementen die niet zelf klikbaar zijn maar wel
//     het Vadik liquid-glass uiterlijk moeten hebben
//
// Verschil met VadikGlass:
//   • <div> outer + <div> inner (geen <button>/<span>)
//   • width accepteert "fill" → 100% (flex-fill)
//   • Geen hover/press tweens, geen onClick handlers
//   • Behoudt: 10-layer Vadik box-shadow, backdrop-filter, SVG filter,
//     iOS fallback
//
// Plaatsing in v30.7: vervangt de glass-pill className op de mobile
// open search bar, zodat de balk dezelfde glass krijgt als de
// werkende tab-pill / +/Done/Snooze/Forward/search-icon circles.
// ─────────────────────────────────────────────────────────────────
import {
  forwardRef,
  useEffect,
  useId,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { lacksBackdropSVGFilter } from '@/lib/ios-detect';
import {
  VADIK_DISPLACEMENT_WEBP,
  vadikTrackBoxShadow,
  vadikGlassSurfaceStyle,
} from '@/lib/vadik-glass-style';

export interface VadikGlassSurfaceProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Width: px (fixed), "fill" (100% / flex-fill), of "auto" (content). */
  width: number | 'fill' | 'auto';
  /** Height in px, or "auto" voor content-hoogte (e.g. dropdown menu). */
  height: number | 'auto';
  /** Border radius. Default = height/2 (pill/capsule). */
  radius?: number;
  /** Inhoud van de glass surface. */
  children?: ReactNode;
  /** Multiplier voor de Vadik box-shadow stack. Default schaalt op height/70. */
  shadowScale?: number;
  /** Extra styles op de OUTER wrapper. */
  wrapperStyle?: CSSProperties;
}

export const VadikGlassSurface = forwardRef<HTMLDivElement, VadikGlassSurfaceProps>(
  function VadikGlassSurface(
    {
      width,
      height,
      radius,
      children,
      shadowScale,
      wrapperStyle,
      style,
      ...rest
    },
    ref,
  ) {
    const filterId = useId().replace(/:/g, '_');
    // Voor auto-height (dropdown panels) gebruiken we 52 als referentie
    // voor de shadow schaal en standaardradius. Bij vaste hoogtes schaalt
    // de rim op die hoogte zelf (capsule: 70px native).
    const hRef = typeof height === 'number' ? height : 52;
    // v30.22 — Vaste scale = 1 voor consistente rim/drop overal (zie VadikGlass).
    const sScale = shadowScale ?? 1;
    const s = (v: number) => v * sScale;
    const trackBoxShadow = vadikTrackBoxShadow(s);
    const blurPx = s(8);
    const r = radius ?? hRef / 2;

    // v30.21 — Zie VadikGlass: SVG filter overal uit voor consistente matte look.
    const [useFallback] = useState(true);

    const isFill = width === 'fill';
    const isAuto = width === 'auto';

    return (
      // OUTER wrapper — IDENTIEK recept als VadikGlass: <div> i.p.v.
      // <button> zodat we form-controls (input/button) als kind kunnen
      // hebben. Box-shadow stack op deze laag.
      <div
        {...rest}
        ref={ref}
        style={{
          position: 'relative',
          display: isFill ? 'flex' : 'inline-flex',
          width: isFill ? '100%' : isAuto ? 'auto' : width,
          height: height === 'auto' ? 'auto' : height,
          ...(isFill
            ? { flex: 1, minWidth: 0 }
            : isAuto
            ? { flexShrink: 0 }
            : { minWidth: width as number, maxWidth: width as number, flexShrink: 0 }),
          borderRadius: r,
          padding: 0,
          margin: 0,
          border: 'none',
          background: 'transparent',
          boxShadow: useFallback
            ? `${trackBoxShadow}, 0 0 ${s(20)}px 0 rgba(255, 255, 255, 0.10)`
            : trackBoxShadow,
          ...wrapperStyle,
          ...style,
        }}
      >
        {/* INNER glass-surface: <div> met backdrop-filter + bg. Geen
            eigen box-shadow (zit allemaal op outer).
            v30.12 — Inner is nu altijd width:100% en height:100% (of
            voor height=auto: gewoon "natural"). Dat werkt nu correct
            omdat de outer in auto-modus inline-block is (deterministische
            intrinsic sizing), en in fill/fixed-modus al een echte width
            heeft. Identiek patroon als VadikLiquidSwitcher's fieldset. */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            height: height === 'auto' ? 'auto' : '100%',
            boxSizing: 'border-box',
            padding: 0,
            margin: 0,
            border: 'none',
            borderRadius: r,
            color: 'var(--foreground)',
            ...vadikGlassSurfaceStyle(filterId, useFallback, blurPx),
          }}
        >
          {children}

          {/* Per-instance SVG filter — Vadik's exact chain */}
          {!useFallback && (
            <svg
              aria-hidden="true"
              width={0}
              height={0}
              style={{
                position: 'absolute',
                width: 0,
                height: 0,
                overflow: 'hidden',
                zIndex: -1,
              }}
            >
              <filter id={filterId} primitiveUnits="objectBoundingBox">
                <feImage
                  result="map"
                  width="100%"
                  height="100%"
                  x="0"
                  y="0"
                  href={VADIK_DISPLACEMENT_WEBP}
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
          )}
        </div>
      </div>
    );
  },
);

export default VadikGlassSurface;
