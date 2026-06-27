// Liquid Glass v2 — displacement map generation.
//
// Per spec §2.2.3 and §5.6: each shape bucket needs an SVG image whose
// red channel encodes X-axis displacement and blue channel encodes Y-axis.
// Two linear gradients (one red horizontal, one blue vertical) combined
// via mix-blend-mode: difference, then a blurred neutral inner rect
// "blocks out" the centre so only the rounded edge band displaces.

export type LG2Shape =
  | 'pill'        // capsule, full radius
  | 'pill-rect'   // squared pill, 16px
  | 'card-20'    // 20px-radius card
  | 'card-24'    // 24px-radius card (sheet)
  | 'rail-28';   // 28px-radius rail (sidebar)

export interface ShapeSpec {
  width: number;
  height: number;
  radius: number;
  bezel: number;
  blockerBlur: number;
}

const SHAPES: Record<LG2Shape, ShapeSpec> = {
  pill:      { width: 52,  height: 52,  radius: 26,  bezel: 6,  blockerBlur: 6  },
  'pill-rect': { width: 240, height: 44, radius: 16, bezel: 7, blockerBlur: 8 },
  'card-20': { width: 320, height: 200, radius: 20, bezel: 14, blockerBlur: 14 },
  'card-24': { width: 480, height: 320, radius: 24, bezel: 18, blockerBlur: 16 },
  'rail-28': { width: 84,  height: 800, radius: 28, bezel: 12, blockerBlur: 12 },
};

/**
 * Build the displacement-map SVG markup for a shape bucket.
 * Returned as raw SVG string (suitable for inline injection inside <defs>).
 *
 * The SVG fills its viewBox with a black rect, then layers:
 *   - rounded red horizontal gradient
 *   - rounded blue vertical gradient (mix-blend-mode: difference)
 *   - blurred neutral inner rect (kills displacement in the centre)
 *
 * The result, when read as the in2 of feDisplacementMap with
 * xChannelSelector=R / yChannelSelector=B, displaces only the
 * rounded-edge band — exactly mirroring Apple's lensing signature.
 */
export function buildDisplacementSymbol(id: string, shape: LG2Shape): string {
  const s = SHAPES[shape];
  const innerX = s.bezel;
  const innerY = s.bezel;
  const innerW = s.width - 2 * s.bezel;
  const innerH = s.height - 2 * s.bezel;
  const innerR = Math.max(0, s.radius - s.bezel);
  // Unique gradient IDs so each symbol's references don't collide.
  const redGrad = `${id}-r`;
  const blueGrad = `${id}-b`;
  return `<symbol id="${id}" viewBox="0 0 ${s.width} ${s.height}" preserveAspectRatio="none">
  <defs>
    <linearGradient id="${redGrad}" x1="100%" y1="0%" x2="0%" y2="0%">
      <stop offset="0%" stop-color="rgb(0 0 0 / 0)"/>
      <stop offset="100%" stop-color="red"/>
    </linearGradient>
    <linearGradient id="${blueGrad}" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="rgb(0 0 0 / 0)"/>
      <stop offset="100%" stop-color="blue"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${s.width}" height="${s.height}" fill="black"/>
  <rect x="0" y="0" width="${s.width}" height="${s.height}" rx="${s.radius}" ry="${s.radius}" fill="url(#${redGrad})"/>
  <rect x="0" y="0" width="${s.width}" height="${s.height}" rx="${s.radius}" ry="${s.radius}" fill="url(#${blueGrad})" style="mix-blend-mode: difference"/>
  <rect x="${innerX}" y="${innerY}" width="${innerW}" height="${innerH}" rx="${innerR}" ry="${innerR}" fill="rgb(127 127 127 / 0.93)" style="filter: blur(${s.blockerBlur}px)"/>
</symbol>`;
}

/** All shape buckets we precompute and inline at app boot. */
export const LG2_SHAPES: LG2Shape[] = [
  'pill',
  'pill-rect',
  'card-20',
  'card-24',
  'rail-28',
];

/** ID for a given shape's <symbol> in the global SVG <defs>. */
export function shapeSymbolId(shape: LG2Shape): string {
  return `lg-disp-${shape}`;
}
