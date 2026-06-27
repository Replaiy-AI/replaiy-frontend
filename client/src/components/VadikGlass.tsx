// ─────────────────────────────────────────────────────────────────
// VadikGlass — generic Apple-grade liquid glass element.
//
// Same visual recipe as VadikLiquidSwitcher (Vadik Matveev's CodePen
// https://codepen.io/fooontic/pen/KwpRaGr) but for SINGLE elements
// instead of segmented switchers. Used for circles (Reply button),
// pill-shaped action buttons (Done/Snooze), and any other chrome
// element that wants the full liquid-glass treatment.
//
// Highlights:
//   • Same SVG displacement filter (objectBoundingBox, scale 0.5).
//   • Same 10-layer Vadik track box-shadow.
//   • iOS WebKit / Safari / Firefox fallback: premium CSS-only sheen.
//   • Mikhail Bespalov's hover-scale animation
//     (https://codepen.io/Mikhail-Bespalov/pen/MYwrMNy):
//       feDisplacementMap scale animates 0.5 → 0.7 on hover for a
//       subtle pop, returning on leave. Disabled when fallback is
//       active (no SVG filter to animate).
//
// Shape options: 'circle' (radius 50%) or 'pill' (capsule).
// ─────────────────────────────────────────────────────────────────
import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';
import { lacksBackdropSVGFilter } from '@/lib/ios-detect';
import {
  VADIK_DISPLACEMENT_WEBP,
  vadikTrackBoxShadow,
  vadikGlassSurfaceStyle,
} from '@/lib/vadik-glass-style';
import { MIKHAIL_CIRCLE_DISPLACEMENT } from '@/lib/vadik-displacement-map';
import { HOVER_SCALE_SOFT } from '@/lib/motion';

export interface VadikGlassProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Width in px. */
  width: number;
  /** Height in px. Defaults to `width` (i.e. circle). */
  height?: number;
  /** 'circle' = 50%, 'pill' = capsule (height/2). */
  shape?: 'circle' | 'pill';
  /** Render content inside the glass surface (icon, text, etc.). */
  children?: ReactNode;
  /** Multiplier for Vadik's box-shadow stack. 1 = native (244×70).
   *  Defaults to width/244 so a 52×52 button gets correctly-scaled rim. */
  shadowScale?: number;
  /** Extra inline styles applied to the OUTER wrapper (e.g. position). */
  wrapperStyle?: CSSProperties;
}

export const VadikGlass = forwardRef<HTMLButtonElement, VadikGlassProps>(
  function VadikGlass(
    {
      width,
      height,
      shape = 'circle',
      children,
      shadowScale,
      wrapperStyle,
      style,
      ...buttonProps
    },
    ref,
  ) {
    const filterId = useId().replace(/:/g, '_');
    const h = height ?? width;
    // v29.1 — shadowScale per shape:
    //   • 'circle': klein, op de hoogte gebaseerd (h/244). Een 52×52
    //     circle krijgt ~0.21 → fijne, ingehouden rim.
    //   • 'pill':   Vadik's recipe is gebouwd voor liggende capsules
    //     244×70. We schalen op de WIDTH (lange as) zodat de inset-
    //     shadows niet zo dramatisch comprimeren dat ze een "pill-in-
    //     pill" suggestie geven (zichtbaar op 132×52). 132/244 = 0.54.
    // v30.22 — Vaste scale = 1 voor ALLE elementen (zelfde als de tab-pill
    // die we als style-baseline hebben gekozen). Dit geeft een consistente
    // matte glass-look met identieke rim-dikte en drop-shadow door de hele
    // app, ongeacht of het een circle 52×52 of een capsule 140×52 is.
    const defaultScale = 1;
    const sScale = shadowScale ?? defaultScale;
    const s = (v: number) => v * sScale;
    // v29.3 — Letterlijk de werkende structuur van VadikLiquidSwitcher
    // gekopieerd: ALLE 10 shadows op de OUTER wrapper, INNER glass
    // heeft GEEN box-shadow. v29.2 was de split-aanpak die juist het
    // "pill-in-pill" effect veroorzaakte omdat inset-shadows op een
    // transparante INNER laag visueel een tweede element vormen.
    const trackBoxShadow = vadikTrackBoxShadow(s);

    // iOS WebKit / Safari / Firefox detection (one-time, post-mount).
    // v30.21 — SVG displacement filter UIT voor ALLE platforms. Vadik's
    // WebP is gemaakt voor een 244×70 capsule en geeft bij andere
    // afmetingen visuele artifacts (pill-in-pill, asymmetrische rim).
    // Door overal de CSS-only fallback te gebruiken hebben we één
    // consistente matte glass-look in de hele app. De Vadik 10-layer
    // shadow stack + gradient sheen + backdrop-blur blijven behouden.
    const [useFallback] = useState(true);

    // v27 — Sterkere Mikhail Bespalov-animatie
    //   https://codepen.io/Mikhail-Bespalov/pen/MYwrMNy
    // Op hover tween-en we de feDisplacementMap-scale van 0.5 → 1.0
    // (Mikhail gebruikt 1→1.4 maar onze pillen zijn kleiner). De
    // tween loopt over 300ms via requestAnimationFrame zodat de
    // refractie levendig pakt i.p.v. een harde sprong. Geen React
    // re-render — we muteren het SVG-attribuut direct.
    const dispRef = useRef<SVGFEDisplacementMapElement | null>(null);
    const wrapperRef = useRef<HTMLButtonElement | null>(null);
    const tweenRafRef = useRef<number | null>(null);
    const tweenAnim = (from: number, to: number, durationMs: number) => {
      if (useFallback || !dispRef.current) return;
      if (tweenRafRef.current != null) cancelAnimationFrame(tweenRafRef.current);
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / durationMs);
        // ease-out cubic
        const eased = 1 - Math.pow(1 - t, 3);
        const v = from + (to - from) * eased;
        dispRef.current?.setAttribute('scale', v.toFixed(3));
        if (t < 1) {
          tweenRafRef.current = requestAnimationFrame(tick);
        } else {
          tweenRafRef.current = null;
        }
      };
      tweenRafRef.current = requestAnimationFrame(tick);
    };
    useEffect(() => () => {
      if (tweenRafRef.current != null) cancelAnimationFrame(tweenRafRef.current);
    }, []);

    // v30.18 — Hover-tween waarden gelijkgetrokken voor circle EN pill.
    // Circles werken schoon met base 1.0 → hover 1.4. Pills hadden
    // base 0.5 → hover 1.0 wat een andere displacement-strength gaf en
    // (volgens user) de pill-in-pill / balk artifact triggerde op iOS.
    // Nu beide shapes gebruiken Mikhail's waarden.
    const baseDispScale = 1;
    const hoverDispScale = 1.4;
    // v30.36 — Hover-scale teruggeschroefd van 1.2 → 1.03 (HOVER_SCALE_SOFT
    // uit lib/motion.ts). User feedback: "minder overdreven". Spring is
    // ook iets stijver (kortere settle, 180ms ease) zodat het pop-gevoel
    // behouden blijft zonder dat icons groot omhoog springen. Werkt voor
    // circles én pills (Reply, Done, Snooze, Forward, +, Search, Profile,
    // Inbox dropdown, etc.).
    // v30.36.1 — Hover-scale gestandaardiseerd via HOVER_SCALE_SOFT
    // constant (lib/motion.ts) = 1.05. Vroeger 1.03 hardcoded → te subtiel.
    // Ook: hover effect werkt nu op SVG óf op een [data-glass-content]
    // element zodat non-svg content (zoals de ProfileInitials "SG" letters)
    // ook scale't. Voor ProfileInitials wrappen we de span met dit attribute.
    const findHoverTarget = (root: HTMLElement) =>
      (root.querySelector('svg:not([aria-hidden="true"])') ||
        root.querySelector('[data-glass-content]')) as HTMLElement | SVGElement | null;

    const onEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
      tweenAnim(baseDispScale, hoverDispScale, 280);
      const target = findHoverTarget(e.currentTarget);
      if (target) {
        target.style.transition = 'transform 180ms cubic-bezier(0.32, 0.72, 0, 1)';
        target.style.transform = `scale(${HOVER_SCALE_SOFT})`;
      }
      buttonProps.onMouseEnter?.(e);
    };
    const onLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
      tweenAnim(hoverDispScale, baseDispScale, 280);
      const target = findHoverTarget(e.currentTarget);
      if (target) target.style.transform = 'scale(1)';
      buttonProps.onMouseLeave?.(e);
    };
    const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
      buttonProps.onPointerDown?.(e);
    };
    const onPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
      buttonProps.onPointerUp?.(e);
    };
    const onPointerCancel = (e: React.PointerEvent<HTMLButtonElement>) => {
      buttonProps.onPointerCancel?.(e);
    };

    const radius = shape === 'circle' ? '50%' : `${h / 2}px`;
    const blurPx = s(8);

    return (
      <button
        {...buttonProps}
        ref={(el) => {
          wrapperRef.current = el;
          if (typeof ref === 'function') ref(el);
          else if (ref) (ref as React.MutableRefObject<HTMLButtonElement | null>).current = el;
        }}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        style={{
          // OUTER wrapper carries the box-shadow (Vadik's rim + drop).
          // The actual backdrop-filter goes on the INNER span — same
          // two-layer pattern as VadikLiquidSwitcher (avoids inset
          // shadows clipping the backdrop-filter to a strip).
          position: 'relative',
          display: 'inline-block',
          width,
          height: h,
          // v27 — expliciet min-/max-width vastpinnen om te voorkomen
          // dat een flex-parent (bv het reply-cluster met flex items)
          // de button squeezed. Tevens flexShrink: 0 voor zekerheid.
          minWidth: width,
          maxWidth: width,
          flexShrink: 0,
          borderRadius: radius,
          padding: 0,
          margin: 0,
          border: 'none',
          background: 'transparent',
          // v29.3 — ALLE Vadik shadows op de OUTER wrapper. Dezelfde
          // recipe als VadikLiquidSwitcher (die werkt voor de tab-pill).
          boxShadow: useFallback
            ? `${trackBoxShadow}, 0 0 ${s(20)}px 0 rgba(255, 255, 255, 0.10)`
            : trackBoxShadow,
          cursor: buttonProps.disabled ? 'not-allowed' : 'pointer',
          // v29.6 — ISOLATION VERWIJDERD. Dit was juist de oorzaak
          // van pill-in-pill: isolation:isolate maakt een nieuwe
          // stacking context waarin de outer-shadow's anders
          // composeren dan in de werkende tab-pill (die heeft GEEN
          // isolation). Letterlijk één attribuut verschil tussen
          // werkend en gebroken.
          // v27 — snappy press-feedback transition.
          transition: 'transform 140ms cubic-bezier(0.4, 0, 0.2, 1)',
          ...wrapperStyle,
          ...style,
        }}
      >
        {/* v29.6 — OVERFLOW: HIDDEN VERWIJDERD. Werkende tab-pill
            heeft `overflow: visible` op het glass-element. Door overflow:
            hidden cliënt de browser z'n filter-region af, waardoor de
            inset-shadows van de outer parent visueel niet meer worden
            "gemask" door het inner element — ze schijnen door als
            tweede pill-rand. */}
        <span
          data-vadik-content
          aria-hidden="true"
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            boxSizing: 'border-box',
            margin: 0,
            border: 'none',
            borderRadius: radius,
            color: 'var(--foreground)',
            ...vadikGlassSurfaceStyle(filterId, useFallback, blurPx),
            transition:
              'background 400ms cubic-bezier(1, 0, 0.4, 1), transform 220ms cubic-bezier(0.5, 0, 0, 1)',
            transform: 'scale(1)',
          }}
        >
          {children}
        </span>

        {/* v29 — Per-shape SVG filter. Vadik's WebP is gemaakt voor
            een 244×70 capsule en geeft op circles een lelijke
            horizontale balk-glitch. We gebruiken nu de juiste map per
            shape:
              • 'circle' → Mikhail's radiale PNG (200×200, lens-fade
                naar centrum) met zijn eigen recipe (objectBoundingBox
                + stdDev 0.02 + scale 1).
              • 'pill'   → Vadik's WebP met zijn eigen recipe
                (objectBoundingBox + stdDev 0.04 + scale 0.5). */}
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
            {shape === 'circle' ? (
              // Mikhail Bespalov's circle-recipe (literal port).
              // https://codepen.io/Mikhail-Bespalov/pen/MYwrMNy
              <filter id={filterId} primitiveUnits="objectBoundingBox">
                <feImage
                  result="map"
                  width="1"
                  height="1"
                  x="0"
                  y="0"
                  href={MIKHAIL_CIRCLE_DISPLACEMENT}
                />
                <feGaussianBlur
                  in="SourceGraphic"
                  stdDeviation="0.02"
                  result="blur"
                />
                <feDisplacementMap
                  ref={dispRef}
                  in="blur"
                  in2="map"
                  scale="1"
                  xChannelSelector="R"
                  yChannelSelector="G"
                />
              </filter>
            ) : (
              // Vadik Matveev's pill-recipe.
              // https://codepen.io/fooontic/pen/KwpRaGr
              // v30.18 — initial scale gewijzigd van 0.5 → 1 zodat hij
              // synchroon loopt met baseDispScale=1. Voorheen renderde
              // de pill bij eerste paint met half-displacement (scale 0.5)
              // en dat triggerde de visuele pill-in-pill op iOS Safari
              // omdat de displacement-map voor de Vadik 244×70 capsule
              // op 132×52 vervormde tot een asymmetrische binnen-shape.
              <filter id={filterId} primitiveUnits="objectBoundingBox">
                <feImage
                  result="map"
                  width="100%"
                  height="100%"
                  x="0"
                  y="0"
                  href={VADIK_DISPLACEMENT_WEBP}
                />
                <feGaussianBlur
                  in="SourceGraphic"
                  stdDeviation="0.04"
                  result="blur"
                />
                <feDisplacementMap
                  ref={dispRef}
                  in="blur"
                  in2="map"
                  scale="1"
                  xChannelSelector="R"
                  yChannelSelector="G"
                />
              </filter>
            )}
          </svg>
        )}
      </button>
    );
  },
);

export default VadikGlass;
