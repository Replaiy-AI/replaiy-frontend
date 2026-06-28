const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ colorScheme: 'light', viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('http://localhost:5000/#/inbox');
  await page.waitForTimeout(1300);
  await page.click('[data-testid="smart-row-d1"]');
  await page.waitForTimeout(1200);
  await page.click('[data-testid="inline-reply-bar-collapsed"]');
  await page.waitForTimeout(900);
  await page.click('[data-testid="reply-fmt-toggle"]');
  await page.waitForTimeout(1000);

  const data = await page.evaluate(() => {
    const toggle = document.querySelector('[data-testid="reply-fmt-toggle"]');
    const content = toggle.querySelector('[data-glass-content]');
    const pillR = toggle.getBoundingClientRect();
    const contentR = content.getBoundingClientRect();
    const svgs = [...toggle.querySelectorAll('svg')].map(s => {
      const r = s.getBoundingClientRect();
      return { x: +r.x.toFixed(2), right: +(r.x+r.width).toFixed(2), w: +r.width.toFixed(2) };
    });
    return {
      pill: { x: pillR.x, right: pillR.x + pillR.width, w: pillR.width },
      content: { x: contentR.x, right: contentR.x + contentR.width, w: contentR.width },
      svgs
    };
  });
  console.log('pill:', JSON.stringify(data.pill));
  console.log('content (inner padded box):', JSON.stringify(data.content));
  console.log('svg glyphs L->R:');
  data.svgs.forEach((s,i)=>console.log(`  [${i}]`, JSON.stringify(s)));
  // gap from pill-left-edge to first glyph left, and last glyph right to pill-right-edge
  const first = data.svgs[0], last = data.svgs[data.svgs.length-1];
  console.log('GAP pillLeft -> firstGlyphLeft:', (first.x - data.pill.x).toFixed(2));
  console.log('GAP lastGlyphRight -> pillRight:', (data.pill.right - last.right).toFixed(2));
  // inter-glyph edge gaps
  for (let i=1;i<data.svgs.length;i++){
    console.log(`  glyph gap ${i-1}->${i}:`, (data.svgs[i].x - data.svgs[i-1].right).toFixed(2));
  }
  await browser.close();
})();
