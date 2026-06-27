// ─────────────────────────────────────────────────────────────────
// VadikSinglePill — LETTERLIJK dezelfde JSX-structuur als
// VadikLiquidSwitcher (de werkende tab-pill), maar dan met 1 klikbaar
// label i.p.v. 3 radio-segmenten.
//
// Belangrijk: GEEN <button>, GEEN <span>. Alleen:
//   • OUTER <div> (display:inline-block, hard pixel-width/height,
//     border-radius 9999, alle 10 box-shadows)
//   • INNER <fieldset> (width/height 100%, border:none, backdrop-filter,
//     background, GEEN box-shadow)
//   • Inhoud (icoon + label) als label of div binnen de fieldset
//   • SVG filter chain identiek aan tab-pill (Vadik's WebP)
//
// Het outer <div> krijgt role="button" + tabindex + onKeyDown, zodat
// het volledig toegankelijk is zonder een <button> te zijn (dat zou
// op iOS Safari weer een UA-skin geven met appearance:button).
//
// Klikbaarheid: onClick op de outer div. Hover-press via CSS transform
// op de inner fieldset (zelfde transitie als tab-pill).
//
// We geven het deze proportioneel-correcte default afmetingen:
//   • Native Vadik = 244×70 (W:H = 3.48:1)
//   • Reply       = 174×50 (W:H = 3.48:1)  → zelfde ratio → zelfde rim look
// ─────────────────────────────────────────────────────────────────
import {
  forwardRef,
  useId,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import {
  VADIK_DISPLACEMENT_WEBP,
  vadikTrackBoxShadow,
  vadikGlassSurfaceStyle,
} from '@/lib/vadik-glass-style';

export interface VadikSinglePillProps {
  width: number;
  height: number;
  children?: ReactNode;
  onClick?: (e: MouseEvent<HTMLDivElement>) => void;
  ariaLabel?: string;
  testId?: string;
  style?: CSSProperties;
  disabled?: boolean;
}

export const VadikSinglePill = forwardRef<HTMLDivElement, VadikSinglePillProps>(
  function VadikSinglePill(
    { width, height, children, onClick, ariaLabel, testId, style, disabled },
    ref,
  ) {
    const filterId = useId().replace(/:/g, '_');

    // v30.22 — Vaste scale = 1 (zelfde als tab-pill / VadikGlass / overige
    // glass elementen). Geeft consistente rim-dikte en drop-shadow.
    const scale = 1;
    const s = (v: number) => v * scale;
    const trackBoxShadow = vadikTrackBoxShadow(s);
    const blurPx = s(8);

    // v30.20 — SVG displacement filter UIT. De Vadik WebP is gemaakt
    // voor een 244×70 capsule. Op andere afmetingen vervormt de map
    // asymmetrisch en geeft het de pill-in-pill / balk artifacts. We
    // forceren nu de CSS-only fallback voor alle platforms: dezelfde
    // gradient + backdrop-blur als op iOS, en de 10-layer Vadik shadow
    // stack blijft. Resultaat = clean matte glass zonder distortie.
    const [useFallback] = useState(true);

    const handleKey = (e: KeyboardEvent<HTMLDivElement>) => {
      if (disabled || !onClick) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick(e as unknown as MouseEvent<HTMLDivElement>);
      }
    };

    // v30.24 — Hover-animatie identiek aan tab-pill + VadikGlass: bij
    // hover schaalt het icoon binnenin naar 1.2, niet de hele knop.
    // Geen scale-down op press meer — consistent met alle andere
    // glass-elementen in de app.
    const onMouseEnter = (e: MouseEvent<HTMLDivElement>) => {
      const icon = e.currentTarget.querySelector(
        'svg:not([aria-hidden="true"])',
      ) as SVGElement | null;
      if (icon) {
        icon.style.transition = 'transform 200ms cubic-bezier(0.5, 0, 0, 1)';
        icon.style.transform = 'scale(1.2)';
      }
    };
    const onMouseLeave = (e: MouseEvent<HTMLDivElement>) => {
      const icon = e.currentTarget.querySelector(
        'svg:not([aria-hidden="true"])',
      ) as SVGElement | null;
      if (icon) icon.style.transform = 'scale(1)';
    };

    return (
      // OUTER — LETTERLIJK kopie van VadikLiquidSwitcher's outer <div>.
      // Hard pixel-width + height, geen flex shenanigans, geen <button>.
      <div
        ref={ref}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={ariaLabel}
        aria-disabled={disabled || undefined}
        data-testid={testId}
        onClick={disabled ? undefined : onClick}
        onKeyDown={handleKey}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        style={{
          position: 'relative',
          display: 'inline-block',
          width,
          height,
          borderRadius: 9999,
          // v25 — iOS fallback krijgt een extra outer drop-shadow zodat
          // de pill toch "zwevend" voelt zonder lens-refractie.
          boxShadow: useFallback
            ? `${trackBoxShadow}, 0 0 ${s(20)}px 0 rgba(255, 255, 255, 0.10)`
            : trackBoxShadow,
          cursor: disabled ? 'not-allowed' : onClick ? 'pointer' : 'default',
          transition: 'transform 140ms cubic-bezier(0.4, 0, 0.2, 1)',
          ...style,
        }}
      >
        {/* INNER — LETTERLIJK kopie van VadikLiquidSwitcher's fieldset.
            position:relative, width/height 100%, backdrop-filter, bg,
            GEEN box-shadow. */}
        <fieldset
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            boxSizing: 'border-box',
            padding: 0,
            margin: 0,
            border: 'none',
            borderRadius: 9999,
            color: 'var(--foreground)',
            ...vadikGlassSurfaceStyle(filterId, useFallback, blurPx),
            transition: 'background 400ms cubic-bezier(1, 0, 0.4, 1)',
          }}
        >
          {children}
        </fieldset>

        {/* Per-instance SVG filter — exact Vadik's chain (zoals in
            VadikLiquidSwitcher). Niet in een <span> wrapper, gewoon
            direct in de outer <div> als sibling van de fieldset. */}
        {!useFallback && (
          <svg
            aria-hidden
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
    );
  },
);

export default VadikSinglePill;
