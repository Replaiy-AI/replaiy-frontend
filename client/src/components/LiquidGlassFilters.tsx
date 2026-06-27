// Liquid Glass v2 — global SVG filter + displacement-map defs.
//
// Mount once at app root. Provides:
//   #lg-edge-refract     — base lensing (single feDisplacementMap)
//   #lg-edge-refract-rgb — chromatic-aberration variant (3 disp passes + screen blend)
//   #lg-aura-bloom       — outer halo with tint
//   #lg-specular-relief  — geometric specular for hero surfaces
//   #lg2-noise           — canvas grain texture
//   #lg-disp-{shape}     — per-shape displacement-map symbols
//
// IMPORTANT: do NOT set display:none on the root <svg>; some browsers
// refuse to resolve url(#…) against display:none symbols.
// Instead, use position:absolute + width:0 + height:0 + overflow:hidden.

import { LG2_SHAPES, buildDisplacementSymbol, shapeSymbolId } from '@/lib/lg2-displacement-maps';

export function LiquidGlassFilters() {
  // Precompute every displacement-map symbol once.
  const symbols = LG2_SHAPES.map((shape) =>
    buildDisplacementSymbol(shapeSymbolId(shape), shape),
  ).join('\n');

  return (
    <svg
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        position: 'absolute',
        width: 0,
        height: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
      // Render the symbol markup as raw HTML — they're static and contain
      // no user-controlled data.
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{
        __html: `
        <defs>
          <!-- ─── Base lensing — single displacement pass ───────────────── -->
          <filter id="lg-edge-refract"
                  x="-15%" y="-15%" width="130%" height="130%"
                  color-interpolation-filters="sRGB"
                  filterUnits="objectBoundingBox" primitiveUnits="userSpaceOnUse">
            <feImage href="#lg-disp-card-20" x="0" y="0" width="100%" height="100%"
                     preserveAspectRatio="none" result="map"/>
            <feDisplacementMap in="SourceGraphic" in2="map"
                               scale="-44"
                               xChannelSelector="R" yChannelSelector="B"
                               result="displaced"/>
            <feGaussianBlur in="displaced" stdDeviation="0.4"/>
          </filter>

          <!-- ─── RGB chromatic-aberration variant ───────────────────────── -->
          <filter id="lg-edge-refract-rgb"
                  x="-15%" y="-15%" width="130%" height="130%"
                  color-interpolation-filters="sRGB"
                  filterUnits="objectBoundingBox" primitiveUnits="userSpaceOnUse">
            <feImage href="#lg-disp-card-24" x="0" y="0" width="100%" height="100%"
                     preserveAspectRatio="none" result="map"/>

            <!-- RED: largest displacement -->
            <feDisplacementMap in="SourceGraphic" in2="map" scale="-48"
                               xChannelSelector="R" yChannelSelector="B" result="dispR"/>
            <feColorMatrix in="dispR" result="redOnly" type="matrix"
                           values="1 0 0 0 0
                                   0 0 0 0 0
                                   0 0 0 0 0
                                   0 0 0 1 0"/>

            <!-- GREEN: reference -->
            <feDisplacementMap in="SourceGraphic" in2="map" scale="-44"
                               xChannelSelector="R" yChannelSelector="B" result="dispG"/>
            <feColorMatrix in="dispG" result="greenOnly" type="matrix"
                           values="0 0 0 0 0
                                   0 1 0 0 0
                                   0 0 0 0 0
                                   0 0 0 1 0"/>

            <!-- BLUE: intermediate -->
            <feDisplacementMap in="SourceGraphic" in2="map" scale="-40"
                               xChannelSelector="R" yChannelSelector="B" result="dispB"/>
            <feColorMatrix in="dispB" result="blueOnly" type="matrix"
                           values="0 0 0 0 0
                                   0 0 0 0 0
                                   0 0 1 0 0
                                   0 0 0 1 0"/>

            <feBlend in="redOnly" in2="greenOnly" mode="screen" result="rg"/>
            <feBlend in="rg"      in2="blueOnly"  mode="screen" result="rgb"/>
            <feGaussianBlur in="rgb" stdDeviation="0.6"/>
          </filter>

          <!-- ─── v22.1: Strong chrome refraction with chromatic aberration ─
               Used by .lg-pill / .glass-pill / .lg-rail / .mono-circle on
               the chrome layer. Higher displacement scale + tighter RGB
               separation than the base card filter so the lensing reads
               at the actual pill edge, not as overall haze. -->
          <filter id="lg-chrome-refract"
                  x="-25%" y="-25%" width="150%" height="150%"
                  color-interpolation-filters="sRGB"
                  filterUnits="objectBoundingBox" primitiveUnits="userSpaceOnUse">
            <feImage href="#lg-disp-pill" x="0" y="0" width="100%" height="100%"
                     preserveAspectRatio="none" result="map"/>

            <!-- RED — outer edge (widest displacement) -->
            <feDisplacementMap in="SourceGraphic" in2="map" scale="-72"
                               xChannelSelector="R" yChannelSelector="B" result="dispR"/>
            <feColorMatrix in="dispR" result="redOnly" type="matrix"
                           values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"/>

            <!-- GREEN — middle reference -->
            <feDisplacementMap in="SourceGraphic" in2="map" scale="-64"
                               xChannelSelector="R" yChannelSelector="B" result="dispG"/>
            <feColorMatrix in="dispG" result="greenOnly" type="matrix"
                           values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0"/>

            <!-- BLUE — inner edge (least displacement) -->
            <feDisplacementMap in="SourceGraphic" in2="map" scale="-56"
                               xChannelSelector="R" yChannelSelector="B" result="dispB"/>
            <feColorMatrix in="dispB" result="blueOnly" type="matrix"
                           values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0"/>

            <!-- Screen-blend → visible chromatic edge -->
            <feBlend in="redOnly" in2="greenOnly" mode="screen" result="rg"/>
            <feBlend in="rg"      in2="blueOnly"  mode="screen" result="rgb"/>
            <feGaussianBlur in="rgb" stdDeviation="0.5"/>
          </filter>

          <!-- ─── Per-shape refraction filters (override displacement source) ── -->
          <filter id="lg-edge-refract-pill"
                  x="-15%" y="-15%" width="130%" height="130%"
                  color-interpolation-filters="sRGB"
                  filterUnits="objectBoundingBox" primitiveUnits="userSpaceOnUse">
            <feImage href="#lg-disp-pill" x="0" y="0" width="100%" height="100%"
                     preserveAspectRatio="none" result="map"/>
            <feDisplacementMap in="SourceGraphic" in2="map" scale="-38"
                               xChannelSelector="R" yChannelSelector="B" result="displaced"/>
            <feGaussianBlur in="displaced" stdDeviation="0.35"/>
          </filter>

          <filter id="lg-edge-refract-pill-rect"
                  x="-15%" y="-15%" width="130%" height="130%"
                  color-interpolation-filters="sRGB"
                  filterUnits="objectBoundingBox" primitiveUnits="userSpaceOnUse">
            <feImage href="#lg-disp-pill-rect" x="0" y="0" width="100%" height="100%"
                     preserveAspectRatio="none" result="map"/>
            <feDisplacementMap in="SourceGraphic" in2="map" scale="-40"
                               xChannelSelector="R" yChannelSelector="B" result="displaced"/>
            <feGaussianBlur in="displaced" stdDeviation="0.4"/>
          </filter>

          <filter id="lg-edge-refract-card-20"
                  x="-15%" y="-15%" width="130%" height="130%"
                  color-interpolation-filters="sRGB"
                  filterUnits="objectBoundingBox" primitiveUnits="userSpaceOnUse">
            <feImage href="#lg-disp-card-20" x="0" y="0" width="100%" height="100%"
                     preserveAspectRatio="none" result="map"/>
            <feDisplacementMap in="SourceGraphic" in2="map" scale="-46"
                               xChannelSelector="R" yChannelSelector="B" result="displaced"/>
            <feGaussianBlur in="displaced" stdDeviation="0.4"/>
          </filter>

          <filter id="lg-edge-refract-sheet"
                  x="-15%" y="-15%" width="130%" height="130%"
                  color-interpolation-filters="sRGB"
                  filterUnits="objectBoundingBox" primitiveUnits="userSpaceOnUse">
            <feImage href="#lg-disp-card-24" x="0" y="0" width="100%" height="100%"
                     preserveAspectRatio="none" result="map"/>

            <feDisplacementMap in="SourceGraphic" in2="map" scale="-52"
                               xChannelSelector="R" yChannelSelector="B" result="dispR"/>
            <feColorMatrix in="dispR" result="redOnly" type="matrix"
                           values="1 0 0 0 0
                                   0 0 0 0 0
                                   0 0 0 0 0
                                   0 0 0 1 0"/>
            <feDisplacementMap in="SourceGraphic" in2="map" scale="-48"
                               xChannelSelector="R" yChannelSelector="B" result="dispG"/>
            <feColorMatrix in="dispG" result="greenOnly" type="matrix"
                           values="0 0 0 0 0
                                   0 1 0 0 0
                                   0 0 0 0 0
                                   0 0 0 1 0"/>
            <feDisplacementMap in="SourceGraphic" in2="map" scale="-44"
                               xChannelSelector="R" yChannelSelector="B" result="dispB"/>
            <feColorMatrix in="dispB" result="blueOnly" type="matrix"
                           values="0 0 0 0 0
                                   0 0 0 0 0
                                   0 0 1 0 0
                                   0 0 0 1 0"/>
            <feBlend in="redOnly" in2="greenOnly" mode="screen" result="rg"/>
            <feBlend in="rg"      in2="blueOnly"  mode="screen" result="rgb"/>
            <feGaussianBlur in="rgb" stdDeviation="0.5"/>
          </filter>

          <filter id="lg-edge-refract-rail"
                  x="-15%" y="-15%" width="130%" height="130%"
                  color-interpolation-filters="sRGB"
                  filterUnits="objectBoundingBox" primitiveUnits="userSpaceOnUse">
            <feImage href="#lg-disp-rail-28" x="0" y="0" width="100%" height="100%"
                     preserveAspectRatio="none" result="map"/>
            <feDisplacementMap in="SourceGraphic" in2="map" scale="-44"
                               xChannelSelector="R" yChannelSelector="B" result="displaced"/>
            <feGaussianBlur in="displaced" stdDeviation="0.45"/>
          </filter>

          <!-- ─── Outer aura bloom — sampled glow ───────────────────────── -->
          <filter id="lg-aura-bloom"
                  x="-25%" y="-25%" width="150%" height="150%"
                  color-interpolation-filters="sRGB">
            <feGaussianBlur in="SourceAlpha" stdDeviation="14" result="bloomAlpha"/>
            <feFlood flood-color="rgb(180 170 200)" flood-opacity="0.55" result="bloomColor"/>
            <feComposite in="bloomColor" in2="bloomAlpha" operator="in" result="bloom"/>
            <feMerge>
              <feMergeNode in="bloom"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>

          <!-- ─── Geometric specular for hero surfaces ──────────────────── -->
          <filter id="lg-specular-relief"
                  x="-5%" y="-5%" width="110%" height="110%"
                  color-interpolation-filters="sRGB">
            <feGaussianBlur in="SourceAlpha" stdDeviation="6" result="heightMap"/>
            <feSpecularLighting in="heightMap" surfaceScale="4"
                                specularConstant="0.85" specularExponent="22"
                                lighting-color="rgb(255 250 240)" result="specOut">
              <fePointLight x="-100" y="-100" z="220"/>
            </feSpecularLighting>
            <feComposite in="specOut" in2="SourceAlpha" operator="in" result="specClipped"/>
            <feComposite in="SourceGraphic" in2="specClipped"
                         operator="arithmetic" k1="0" k2="1" k3="0.8" k4="0"/>
          </filter>

          <!-- ─── Canvas noise — gives backdrop saturate/blur real variance ─ -->
          <filter id="lg2-noise" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.85"
                          numOctaves="2" seed="7" stitchTiles="stitch"/>
            <feColorMatrix type="matrix"
                           values="0 0 0 0 0.5
                                   0 0 0 0 0.5
                                   0 0 0 0 0.5
                                   0 0 0 0.6 0"/>
          </filter>

          <!-- v21: chromatic-aberration glass for ACTIVE indicator.
               Safari-compatible: applied to a pseudo whose backdrop-filter
               captures the blurred backdrop; filter then RGB-displaces it. -->
          <filter id="lg-liquid-aberration"
                  x="-25%" y="-25%" width="150%" height="150%"
                  color-interpolation-filters="sRGB"
                  filterUnits="objectBoundingBox" primitiveUnits="userSpaceOnUse">
            <!-- Cloudy noise as a soft, organic displacement map -->
            <feTurbulence type="fractalNoise" baseFrequency="0.012 0.012"
                          numOctaves="2" seed="7" result="turb"/>
            <feGaussianBlur in="turb" stdDeviation="6" result="softMap"/>

            <!-- RED — largest displacement (outer ring) -->
            <feDisplacementMap in="SourceGraphic" in2="softMap" scale="38"
                               xChannelSelector="R" yChannelSelector="G" result="dispR"/>
            <feColorMatrix in="dispR" result="redOnly" type="matrix"
                           values="1 0 0 0 0
                                   0 0 0 0 0
                                   0 0 0 0 0
                                   0 0 0 1 0"/>

            <!-- GREEN — middle reference -->
            <feDisplacementMap in="SourceGraphic" in2="softMap" scale="30"
                               xChannelSelector="R" yChannelSelector="G" result="dispG"/>
            <feColorMatrix in="dispG" result="greenOnly" type="matrix"
                           values="0 0 0 0 0
                                   0 1 0 0 0
                                   0 0 0 0 0
                                   0 0 0 1 0"/>

            <!-- BLUE — smallest displacement (inner ring) -->
            <feDisplacementMap in="SourceGraphic" in2="softMap" scale="22"
                               xChannelSelector="R" yChannelSelector="G" result="dispB"/>
            <feColorMatrix in="dispB" result="blueOnly" type="matrix"
                           values="0 0 0 0 0
                                   0 0 0 0 0
                                   0 0 1 0 0
                                   0 0 0 1 0"/>

            <!-- Screen-blend the three displaced channels → chromatic aberration -->
            <feBlend in="redOnly" in2="greenOnly" mode="screen" result="rg"/>
            <feBlend in="rg"      in2="blueOnly"  mode="screen" result="rgb"/>
            <feGaussianBlur in="rgb" stdDeviation="0.4"/>
          </filter>

          <!-- Softer variant for the smaller pill indicator (44px circle).
               Same recipe, smaller displacement scale so aberration sits at
               the indicator's edge without bleeding past the rim. -->
          <filter id="lg-liquid-aberration-sm"
                  x="-25%" y="-25%" width="150%" height="150%"
                  color-interpolation-filters="sRGB"
                  filterUnits="objectBoundingBox" primitiveUnits="userSpaceOnUse">
            <feTurbulence type="fractalNoise" baseFrequency="0.02 0.02"
                          numOctaves="2" seed="3" result="turb"/>
            <feGaussianBlur in="turb" stdDeviation="4" result="softMap"/>

            <feDisplacementMap in="SourceGraphic" in2="softMap" scale="22"
                               xChannelSelector="R" yChannelSelector="G" result="dispR"/>
            <feColorMatrix in="dispR" result="redOnly" type="matrix"
                           values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"/>
            <feDisplacementMap in="SourceGraphic" in2="softMap" scale="17"
                               xChannelSelector="R" yChannelSelector="G" result="dispG"/>
            <feColorMatrix in="dispG" result="greenOnly" type="matrix"
                           values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0"/>
            <feDisplacementMap in="SourceGraphic" in2="softMap" scale="12"
                               xChannelSelector="R" yChannelSelector="G" result="dispB"/>
            <feColorMatrix in="dispB" result="blueOnly" type="matrix"
                           values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0"/>

            <feBlend in="redOnly" in2="greenOnly" mode="screen" result="rg"/>
            <feBlend in="rg"      in2="blueOnly"  mode="screen" result="rgb"/>
            <feGaussianBlur in="rgb" stdDeviation="0.3"/>
          </filter>

          <!-- ─── Per-shape displacement-map symbols ────────────────────── -->
          ${symbols}
        </defs>
      `,
      }}
    />
  );
}

export default LiquidGlassFilters;
