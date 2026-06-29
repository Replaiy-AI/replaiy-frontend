// Measure rendered text widths of the 4 tab labels at the switcher's font
// treatment using a headless browser (real font metrics).
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(`<!doctype html><html><body style="margin:0">
    <span id="probe" style="font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; font-size:13.5px; font-weight:500; letter-spacing:-0.01em; line-height:1; white-space:nowrap; display:inline-block;"></span>
  </body></html>`);
  const labels = ['All', 'Posts', 'Comments', 'Reactions'];
  const widths = {};
  for (const l of labels) {
    const w = await page.evaluate((txt) => {
      const el = document.getElementById('probe');
      el.textContent = txt;
      return el.getBoundingClientRect().width;
    }, l);
    widths[l] = +w.toFixed(2);
  }
  console.log('text widths (px @13.5):', widths);
  const maxText = Math.max(...Object.values(widths));
  console.log('widest:', maxText);
  // For a given scale, on-screen text width = textWidth (font-size is absolute 13.5, NOT scaled)
  // option on-screen width = optionWidth * scale; inner pad each side = 16*scale.
  // We want optionWidth*scale - 2*padInner >= maxText + breathing.
  // Track on-screen width = (24 + optionWidth*4 + 8*3) * scale = (48 + 4*optionWidth) * scale... wait padLeft*2=24, gap*3=24
  for (const scale of [0.72, 0.66, 0.62, 0.6]) {
    for (const ow of [78, 82, 86, 90, 96]) {
      const track = (12*2 + ow*4 + 8*3) * scale;
      const optOnScreen = ow * scale;
      const innerPadEach = 16 * scale; // current code uses 16*scale
      const textArea = optOnScreen - 2*innerPadEach;
      const fitsWidest = textArea - maxText;
      console.log(`scale=${scale} ow=${ow} -> track=${track.toFixed(1)}px optOnScreen=${optOnScreen.toFixed(1)} textArea=${textArea.toFixed(1)} fitWidest(margin)=${fitsWidest.toFixed(1)}`);
    }
  }
  await browser.close();
})();
