// ─────────────────────────────────────────────────────────────────
// ShudingGlass — React port of shuding/liquid-glass (the SVG variant).
//
// This is a direct port of the technique published at
// https://github.com/shuding/liquid-glass — the most visually
// convincing free CSS+SVG implementation of Apple's iOS 26
// Liquid Glass effect available today.
//
// What shuding does that other libraries (incl. rdev) don't:
//   1. Compute a per-pill DISPLACEMENT MAP at the exact pill
//      dimensions, using real optical physics:
//        - surface profile (convex squircle)
//        - refractive-index → bezel-angle → displacement vector
//   2. Compute a per-pill SPECULAR MAP that projects a directional
//      light against the bezel curvature
//   3. Chain feGaussianBlur → feDisplacementMap so the refraction
//      operates on a softened source (the recognisable Apple look)
//   4. Layer ::before (inner shadow + tint) and ::after
//      (backdrop-filter url(#filter)) so the glass sits cleanly
//      over any background
//
// Browser support: full effect in Chrome / Chromium / Edge.
// Safari / Firefox fall back to the tint + inner-shadow layer
// (still looks like glass, just without the edge refraction).
//
// Usage:
//   <ShudingGlass radius={26} thickness={50} bezel={26} ior={1.5}>
//     <CornerDownLeft size={22} />
//   </ShudingGlass>
// ─────────────────────────────────────────────────────────────────
import {
  CSSProperties,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

// ─── Surface profile functions (convex squircle is the default Apple-y one)
const convexSquircle = (x: number) => Math.pow(1 - Math.pow(1 - x, 4), 0.25);

// ─── Refraction math (lifted verbatim from shuding's index.html) ───
function calculateRefractionProfile(
  glassThickness: number,
  bezelWidth: number,
  heightFn: (x: number) => number,
  ior: number,
  samples = 128,
): Float64Array {
  const eta = 1 / ior;
  function refract(nx: number, ny: number): [number, number] | null {
    const dot = ny;
    const k = 1 - eta * eta * (1 - dot * dot);
    if (k < 0) return null;
    const sq = Math.sqrt(k);
    return [-(eta * dot + sq) * nx, eta - (eta * dot + sq) * ny];
  }
  const profile = new Float64Array(samples);
  for (let i = 0; i < samples; i++) {
    const x = i / samples;
    const y = heightFn(x);
    const dx = x < 1 ? 0.0001 : -0.0001;
    const y2 = heightFn(x + dx);
    const deriv = (y2 - y) / dx;
    const mag = Math.sqrt(deriv * deriv + 1);
    const ref = refract(-deriv / mag, -1 / mag);
    if (!ref) {
      profile[i] = 0;
      continue;
    }
    profile[i] = ref[0] * ((y * bezelWidth + glassThickness) / ref[1]);
  }
  return profile;
}

// ─── Displacement-map generator (canvas → data URL) ───
function generateDisplacementMap(
  w: number,
  h: number,
  radius: number,
  bezelWidth: number,
  profile: Float64Array,
  maxDisp: number,
): string {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) return '';
  const img = ctx.createImageData(w, h);
  const d = img.data;
  // Fill neutral (128, 128, 0, 255) — no displacement
  for (let i = 0; i < d.length; i += 4) {
    d[i] = 128;
    d[i + 1] = 128;
    d[i + 2] = 0;
    d[i + 3] = 255;
  }

  const r = radius;
  const rSq = r * r;
  const r1Sq = (r + 1) ** 2;
  const rBSq = Math.max(r - bezelWidth, 0) ** 2;
  const wB = w - r * 2;
  const hB = h - r * 2;
  const S = profile.length;

  for (let y1 = 0; y1 < h; y1++) {
    for (let x1 = 0; x1 < w; x1++) {
      const x = x1 < r ? x1 - r : x1 >= w - r ? x1 - r - wB : 0;
      const y = y1 < r ? y1 - r : y1 >= h - r ? y1 - r - hB : 0;
      const dSq = x * x + y * y;
      if (dSq > r1Sq || dSq < rBSq) continue;
      const dist = Math.sqrt(dSq);
      const fromSide = r - dist;
      const op =
        dSq < rSq
          ? 1
          : 1 - (dist - Math.sqrt(rSq)) / (Math.sqrt(r1Sq) - Math.sqrt(rSq));
      if (op <= 0 || dist === 0) continue;
      const cos = x / dist;
      const sin = y / dist;
      const bi = Math.min(((fromSide / bezelWidth) * S) | 0, S - 1);
      const disp = profile[bi] || 0;
      const dX = (-cos * disp) / maxDisp;
      const dY = (-sin * disp) / maxDisp;
      const idx = (y1 * w + x1) * 4;
      d[idx] = (128 + dX * 127 * op + 0.5) | 0;
      d[idx + 1] = (128 + dY * 127 * op + 0.5) | 0;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL();
}

// ─── Specular-map generator (directional light against the bezel) ───
function generateSpecularMap(
  w: number,
  h: number,
  radius: number,
  bezelWidth: number,
  angle = Math.PI / 3,
): string {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) return '';
  const img = ctx.createImageData(w, h);
  const d = img.data;
  d.fill(0);

  const r = radius;
  const rSq = r * r;
  const r1Sq = (r + 1) ** 2;
  const rBSq = Math.max(r - bezelWidth, 0) ** 2;
  const wB = w - r * 2;
  const hB = h - r * 2;
  const sv = [Math.cos(angle), Math.sin(angle)];

  for (let y1 = 0; y1 < h; y1++) {
    for (let x1 = 0; x1 < w; x1++) {
      const x = x1 < r ? x1 - r : x1 >= w - r ? x1 - r - wB : 0;
      const y = y1 < r ? y1 - r : y1 >= h - r ? y1 - r - hB : 0;
      const dSq = x * x + y * y;
      if (dSq > r1Sq || dSq < rBSq) continue;
      const dist = Math.sqrt(dSq);
      const fromSide = r - dist;
      const op =
        dSq < rSq
          ? 1
          : 1 - (dist - Math.sqrt(rSq)) / (Math.sqrt(r1Sq) - Math.sqrt(rSq));
      if (op <= 0 || dist === 0) continue;
      const cos = x / dist;
      const sin = -y / dist;
      const dot = Math.abs(cos * sv[0] + sin * sv[1]);
      const edge = Math.sqrt(Math.max(0, 1 - (1 - fromSide) ** 2));
      const coeff = dot * edge;
      const col = (255 * coeff) | 0;
      const alpha = (col * coeff * op) | 0;
      const idx = (y1 * w + x1) * 4;
      d[idx] = col;
      d[idx + 1] = col;
      d[idx + 2] = col;
      d[idx + 3] = alpha;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL();
}

export interface ShudingGlassProps {
  children?: React.ReactNode;
  /** Border radius in px. Default 60 (matches shuding demo). */
  radius?: number;
  /** Glass thickness in px (controls displacement magnitude). */
  thickness?: number;
  /** Bezel width in px (how wide the refracting edge is). */
  bezel?: number;
  /** Index of refraction (1.0 = no refraction, 3.0 = maximum). */
  ior?: number;
  /** Scale ratio applied to displacement (0..2). Default 1. */
  scaleRatio?: number;
  /** Source blur applied BEFORE displacement. Default 0.3. */
  blur?: number;
  /** Specular opacity (0..1). Default 0.5. */
  specularOpacity?: number;
  /** Specular saturation. Default 4. */
  specularSaturation?: number;
  /** Inner shadow blur. Default 20. */
  innerShadowBlur?: number;
  /** Inner shadow spread. Default -5. */
  innerShadowSpread?: number;
  /** Inner shadow color. Default rgba(255,255,255,0.45). */
  innerShadowColor?: string;
  /** Tint color as rgb tuple. Default white. */
  tintColor?: string;
  /** Tint opacity (0..1). Default 0.06. */
  tintOpacity?: number;
  /** Outer shadow blur in px. Default 24. */
  outerShadowBlur?: number;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
  'data-testid'?: string;
  'aria-label'?: string;
  'aria-expanded'?: boolean;
  'aria-haspopup'?: 'menu' | 'true' | 'false';
}

export default function ShudingGlass({
  children,
  radius = 60,
  thickness = 80,
  bezel = 60,
  ior = 1.5,
  scaleRatio = 1,
  blur = 0.3,
  specularOpacity = 0.5,
  specularSaturation = 4,
  innerShadowBlur = 20,
  innerShadowSpread = -5,
  innerShadowColor = 'rgba(255, 255, 255, 0.45)',
  tintColor = '255, 255, 255',
  tintOpacity = 0.06,
  outerShadowBlur = 24,
  className = '',
  style,
  onClick,
  ...ariaProps
}: ShudingGlassProps) {
  const ref = useRef<HTMLDivElement>(null);
  const filterId = useId().replace(/:/g, '_'); // SVG IDs can't contain colons
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [maps, setMaps] = useState<{ disp: string; spec: string; scale: number } | null>(null);

  // Measure pill size whenever it changes (ResizeObserver)
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setSize({ w: Math.round(r.width), h: Math.round(r.height) });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Regenerate displacement + specular maps when size or params change
  useEffect(() => {
    const { w, h } = size;
    if (w < 2 || h < 2) return;

    const clampedBezel = Math.min(bezel, radius - 1, Math.min(w, h) / 2 - 1);
    if (clampedBezel < 1) return;

    const profile = calculateRefractionProfile(thickness, clampedBezel, convexSquircle, ior, 128);
    let maxDisp = 0;
    for (let i = 0; i < profile.length; i++) {
      maxDisp = Math.max(maxDisp, Math.abs(profile[i]));
    }
    if (maxDisp === 0) maxDisp = 1;

    const disp = generateDisplacementMap(w, h, radius, clampedBezel, profile, maxDisp);
    const spec = generateSpecularMap(w, h, radius, clampedBezel * 2.5);
    const scale = maxDisp * scaleRatio;
    setMaps({ disp, spec, scale });
  }, [size, radius, thickness, bezel, ior, scaleRatio]);

  return (
    <div
      ref={ref}
      onClick={onClick}
      className={className}
      style={{
        position: 'relative',
        borderRadius: radius,
        isolation: 'isolate',
        boxShadow: `0 4px ${outerShadowBlur}px rgba(0, 0, 0, 0.18)`,
        cursor: onClick ? 'pointer' : undefined,
        ...style,
      }}
      {...ariaProps}
    >
      {/* ::before equivalent — inner shadow + tint, sits ON TOP of content (z:1) */}
      <span
        aria-hidden
        style={{
          content: '""',
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          borderRadius: 'inherit',
          boxShadow: `inset 0 0 ${innerShadowBlur}px ${innerShadowSpread}px ${innerShadowColor}`,
          backgroundColor: `rgba(${tintColor}, ${tintOpacity})`,
          pointerEvents: 'none',
        }}
      />

      {/* Children — placed BETWEEN the backdrop-filter (z:-1) and the inner shadow (z:1),
          so the icon stays sharp and on top, glass refraction happens behind. */}
      <div
        style={{
          position: 'relative',
          zIndex: 0,
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 'inherit',
        }}
      >
        {children}
      </div>

      {/* ::after equivalent — backdrop-filter that applies the SVG filter */}
      <span
        aria-hidden
        style={{
          content: '""',
          position: 'absolute',
          inset: 0,
          zIndex: -1,
          borderRadius: 'inherit',
          backdropFilter: maps ? `url(#${filterId})` : undefined,
          WebkitBackdropFilter: maps ? `url(#${filterId})` : undefined,
          isolation: 'isolate',
          pointerEvents: 'none',
        }}
      />

      {/* Per-instance SVG filter (sized to the actual pill dimensions).
          MUST be rendered inside the same document, but doesn't need to
          be inside the glass div. Placed here for component-locality. */}
      {maps && (
        <svg
          aria-hidden
          width={0}
          height={0}
          style={{ position: 'absolute', overflow: 'hidden' }}
          colorInterpolationFilters="sRGB"
        >
          <defs>
            <filter id={filterId} x="0%" y="0%" width="100%" height="100%">
              {/* 1. Blur the source FIRST so the refraction operates on a soft edge */}
              <feGaussianBlur in="SourceGraphic" stdDeviation={blur} result="blurred_source" />
              {/* 2. Inject the per-pill displacement map */}
              <feImage href={maps.disp} x="0" y="0" width={size.w} height={size.h} result="disp_map" />
              {/* 3. Displace the blurred source by the map */}
              <feDisplacementMap
                in="blurred_source"
                in2="disp_map"
                scale={maps.scale}
                xChannelSelector="R"
                yChannelSelector="G"
                result="displaced"
              />
              {/* 4. Boost saturation of the displaced edge */}
              <feColorMatrix in="displaced" type="saturate" values={String(specularSaturation)} result="displaced_sat" />
              {/* 5. Inject the per-pill specular map and mask it with the displaced sat */}
              <feImage href={maps.spec} x="0" y="0" width={size.w} height={size.h} result="spec_layer" />
              <feComposite in="displaced_sat" in2="spec_layer" operator="in" result="spec_masked" />
              {/* 6. Fade the spec layer per opacity setting */}
              <feComponentTransfer in="spec_layer" result="spec_faded">
                <feFuncA type="linear" slope={specularOpacity} />
              </feComponentTransfer>
              {/* 7. Composite: displaced + spec_masked + spec_faded */}
              <feBlend in="spec_masked" in2="displaced" mode="normal" result="with_sat" />
              <feBlend in="spec_faded" in2="with_sat" mode="normal" />
            </filter>
          </defs>
        </svg>
      )}
    </div>
  );
}
