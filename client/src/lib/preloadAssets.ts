// v-replaiy (perf) — warm the brand mark into the browser cache at app entry
// so the Replaiy logo paints on the very first frame (no late pop-in on the
// inbox / campaigns empty states). Both theme variants are fetched eagerly.
//
// Uses <link rel="preload" as="image"> (highest-priority, non-blocking) plus a
// belt-and-braces Image() decode. The assets are tiny optimized WebP marks
// (~9KB each, transparency preserved), so this is cheap and runs once.
import { LOGO_LIGHT_SRC, LOGO_DARK_SRC } from '@/components/Logo';

let warmed = false;

export function preloadBrandAssets() {
  if (warmed || typeof document === 'undefined') return;
  warmed = true;

  for (const src of [LOGO_LIGHT_SRC, LOGO_DARK_SRC]) {
    // 1) <link rel="preload"> — tells the browser to fetch at high priority.
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = src;
    document.head.appendChild(link);

    // 2) Image() — kicks off the decode so it's display-ready, not just cached.
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
  }
}
